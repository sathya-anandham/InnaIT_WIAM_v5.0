import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TenantService, TenantBranding } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;
  let httpMock: HttpTestingController;

  const mockBranding: TenantBranding = {
    tenantId: 'acme',
    tenantName: 'Acme Corp',
    logoUrl: 'https://acme.example.com/logo.png',
    primaryColor: '#1a73e8',
    accentColor: '#ff5722',
    defaultLocale: 'en-US',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TenantService],
    });

    service = TestBed.inject(TenantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    // Clean up any CSS custom properties set during tests
    document.documentElement.style.removeProperty('--innait-primary');
    document.documentElement.style.removeProperty('--innait-accent');
  });

  // ---------------------------------------------------------------
  // 1. should start with empty tenantId
  // ---------------------------------------------------------------
  it('should start with empty tenantId', () => {
    expect(service.currentTenantId).toBe('');

    service.branding.subscribe((branding) => {
      expect(branding).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // 2. setTenantId() should update the tenant ID
  // ---------------------------------------------------------------
  it('setTenantId() should update the tenant ID', () => {
    service.setTenantId('acme');

    // setTenantId internally calls loadBranding which fires an HTTP request
    const req = httpMock.expectOne('/api/v1/tenants/acme/branding');
    req.flush(mockBranding);

    expect(service.currentTenantId).toBe('acme');
  });

  // ---------------------------------------------------------------
  // 3. setTenantId() should not update if same value
  // ---------------------------------------------------------------
  it('setTenantId() should not update if same value', () => {
    // First call – sets to 'acme'
    service.setTenantId('acme');
    const req = httpMock.expectOne('/api/v1/tenants/acme/branding');
    req.flush(mockBranding);

    // Second call with the same value – should be a no-op
    service.setTenantId('acme');
    httpMock.expectNone('/api/v1/tenants/acme/branding');

    expect(service.currentTenantId).toBe('acme');
  });

  // ---------------------------------------------------------------
  // 4. setTenantId() should not update if empty string
  // ---------------------------------------------------------------
  it('setTenantId() should not update if empty string', () => {
    service.setTenantId('');

    httpMock.expectNone('/api/v1/tenants//branding');
    expect(service.currentTenantId).toBe('');
  });

  // ---------------------------------------------------------------
  // 5. resolveFromUrl() should extract tenant from auth subdomain
  // ---------------------------------------------------------------
  it('resolveFromUrl() should extract tenant from auth subdomain', () => {
    // window.location is read-only, so we spy on the service's internal call path
    // by temporarily replacing the hostname via Object.defineProperty on window.location.
    const originalHostname = window.location.hostname;
    const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

    // Create a fake Location-like object with the desired hostname
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, hostname: 'acme.auth.innait.io' },
    });

    service.resolveFromUrl();

    // resolveFromUrl -> setTenantId -> loadBranding fires an HTTP request
    const req = httpMock.expectOne('/api/v1/tenants/acme/branding');
    req.flush(mockBranding);

    expect(service.currentTenantId).toBe('acme');

    // Restore original location
    if (locationDescriptor) {
      Object.defineProperty(window, 'location', locationDescriptor);
    } else {
      (window as any).location = { hostname: originalHostname } as Location;
    }
  });

  // ---------------------------------------------------------------
  // 6. resolveFromUrl() should extract tenant from admin subdomain
  // ---------------------------------------------------------------
  it('resolveFromUrl() should extract tenant from admin subdomain', () => {
    const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, hostname: 'acme.admin.innait.io' },
    });

    service.resolveFromUrl();

    const req = httpMock.expectOne('/api/v1/tenants/acme/branding');
    req.flush(mockBranding);

    expect(service.currentTenantId).toBe('acme');

    if (locationDescriptor) {
      Object.defineProperty(window, 'location', locationDescriptor);
    }
  });

  // ---------------------------------------------------------------
  // 7. resolveFromUrl() should not set tenant for non-matching hostname
  // ---------------------------------------------------------------
  it('resolveFromUrl() should not set tenant for non-matching hostname', () => {
    const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, hostname: 'localhost' },
    });

    service.resolveFromUrl();

    // No HTTP request should be fired since no tenant was resolved
    httpMock.expectNone('/api/v1/tenants/localhost/branding');
    expect(service.currentTenantId).toBe('');

    if (locationDescriptor) {
      Object.defineProperty(window, 'location', locationDescriptor);
    }
  });

  // ---------------------------------------------------------------
  // 8. loadBranding() should fetch and store branding
  // ---------------------------------------------------------------
  it('loadBranding() should fetch and store branding', () => {
    let result: TenantBranding | null = null;

    service.loadBranding('acme').subscribe((b) => {
      result = b;
    });

    const req = httpMock.expectOne('/api/v1/tenants/acme/branding');
    expect(req.request.method).toBe('GET');
    req.flush(mockBranding);

    expect(result).toEqual(mockBranding);

    // Verify the branding BehaviorSubject was updated
    service.branding.subscribe((branding) => {
      expect(branding).toEqual(mockBranding);
    });
  });

  // ---------------------------------------------------------------
  // 9. loadBranding() should apply CSS custom properties
  // ---------------------------------------------------------------
  it('loadBranding() should apply CSS custom properties', () => {
    service.loadBranding('acme').subscribe();

    const req = httpMock.expectOne('/api/v1/tenants/acme/branding');
    req.flush(mockBranding);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--innait-primary')).toBe('#1a73e8');
    expect(root.style.getPropertyValue('--innait-accent')).toBe('#ff5722');
  });

  // ---------------------------------------------------------------
  // 10. loadBranding() should set null branding on error
  // ---------------------------------------------------------------
  it('loadBranding() should set null branding on error', () => {
    let result: TenantBranding | null | undefined;

    service.loadBranding('bad-tenant').subscribe((b) => {
      result = b;
    });

    const req = httpMock.expectOne('/api/v1/tenants/bad-tenant/branding');
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });

    expect(result).toBeNull();

    service.branding.subscribe((branding) => {
      expect(branding).toBeNull();
    });
  });
});
