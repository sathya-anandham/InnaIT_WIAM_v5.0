import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { Pipe, PipeTransform } from '@angular/core';

import { PortalLayoutComponent } from './portal-layout.component';

// ---------- Mock TranslatePipe ----------
@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

// ---------- Mock auth state ----------
const mockAuthState = {
  status: 'AUTHENTICATED',
  roles: [],
  groups: [],
  amr: ['PASSWORD'],
  acr: 'urn:innait:acr:basic',
  userId: 'user-1',
  accountId: 'acc-1',
  displayName: 'Test User',
  sessionId: 'sess-1',
};

// ---------- Mock TenantBranding ----------
const mockBranding = {
  tenantName: 'Acme Corp',
  logoUrl: 'https://acme.example.com/logo.png',
  primaryColor: '#1976d2',
};

describe('PortalLayoutComponent', () => {
  let component: PortalLayoutComponent;
  let fixture: ComponentFixture<PortalLayoutComponent>;

  let mockAuthService: jasmine.SpyObj<any>;
  let brandingSubject: BehaviorSubject<any>;
  let mockTenantService: { branding: BehaviorSubject<any> };

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['getAuthState', 'logout'], {
      currentState: mockAuthState,
      isAuthenticated: true,
    });
    mockAuthService.getAuthState.and.returnValue(of(mockAuthState));
    mockAuthService.logout.and.returnValue(of(void 0));

    brandingSubject = new BehaviorSubject<any>(null);
    mockTenantService = { branding: brandingSubject };

    await TestBed.configureTestingModule({
      imports: [
        PortalLayoutComponent,
        MockTranslatePipe,
        RouterTestingModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: 'AuthService', useValue: mockAuthService },
        { provide: 'TenantService', useValue: mockTenantService },
      ],
    })
      .overrideComponent(PortalLayoutComponent, {
        set: {
          imports: [
            RouterTestingModule,
            MockTranslatePipe,
          ],
          providers: [],
        },
      })
      .compileComponents();

    // Override injected services at the component level
    TestBed.overrideProvider(
      (await import('@innait/core')).AuthService,
      { useValue: mockAuthService },
    );
    TestBed.overrideProvider(
      (await import('@innait/core')).TenantService,
      { useValue: mockTenantService },
    );

    fixture = TestBed.createComponent(PortalLayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display tenant branding when available', () => {
    brandingSubject.next(mockBranding);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.topbar-title');
    expect(title?.textContent?.trim()).toBe('Acme Corp');

    const logo = compiled.querySelector('.topbar-logo') as HTMLImageElement;
    expect(logo).toBeTruthy();
    expect(logo.src).toContain('acme.example.com/logo.png');
  });

  it('should show user display name from auth state', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const displayNameEl = compiled.querySelector('.user-display-name');
    expect(displayNameEl?.textContent?.trim()).toBe('Test User');
  });

  it('should toggle sidebar on button click', () => {
    fixture.detectChanges();

    expect(component.sidebarCollapsed).toBeFalse();

    const toggleBtn = fixture.nativeElement.querySelector('.sidebar-toggle') as HTMLButtonElement;
    toggleBtn.click();
    fixture.detectChanges();

    expect(component.sidebarCollapsed).toBeTrue();

    toggleBtn.click();
    fixture.detectChanges();

    expect(component.sidebarCollapsed).toBeFalse();
  });

  it('should call AuthService.logout on logout button click', () => {
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('.logout-btn') as HTMLButtonElement;
    logoutBtn.click();

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should collapse sidebar on mobile viewport (window.innerWidth <= 768)', () => {
    // Spy on window.innerWidth to simulate a mobile viewport
    spyOnProperty(window, 'innerWidth').and.returnValue(768);

    // Re-trigger ngOnInit so the viewport check runs
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.sidebarCollapsed).toBeTrue();
  });
});
