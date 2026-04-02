import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { tenantInterceptor } from './tenant.interceptor';
import { TenantService } from '../services/tenant.service';

describe('tenantInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let mockTenantService: jasmine.SpyObj<TenantService>;

  function setup(tenantId: string | null): void {
    mockTenantService = jasmine.createSpyObj<TenantService>(
      'TenantService',
      [],
      { currentTenantId: tenantId },
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tenantInterceptor])),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: mockTenantService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpTesting.verify();
  });

  it('should add X-Tenant-ID header when tenant is set', () => {
    setup('acme-corp');

    http.get('/api/resource').subscribe();

    const req = httpTesting.expectOne('/api/resource');
    expect(req.request.headers.get('X-Tenant-ID')).toBe('acme-corp');
    req.flush({});
  });

  it('should not add header when tenant is empty', () => {
    setup(null);

    http.get('/api/resource').subscribe();

    const req = httpTesting.expectOne('/api/resource');
    expect(req.request.headers.has('X-Tenant-ID')).toBeFalse();
    req.flush({});
  });

  it('should pass request to next handler', () => {
    setup('acme-corp');

    http.get('/api/items').subscribe((response) => {
      expect(response).toEqual({ items: [] });
    });

    const req = httpTesting.expectOne('/api/items');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });
  });
});
