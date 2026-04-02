import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TranslatePipe } from '@innait/i18n';
import { AuthService, TenantService, TenantBranding } from '@innait/core';
import { AdminLayoutComponent } from './admin-layout.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;
  let brandingSubject: BehaviorSubject<TenantBranding | null>;

  const mockBranding: TenantBranding = {
    tenantName: 'Acme Corp',
    logoUrl: 'https://example.com/logo.png',
    primaryColor: '#1976d2',
    accentColor: '#ff9800',
  };

  beforeEach(async () => {
    brandingSubject = new BehaviorSubject<TenantBranding | null>(mockBranding);

    mockAuthService = jasmine.createSpyObj('AuthService', [
      'getAuthState',
      'logout',
    ]);
    mockAuthService.getAuthState.and.returnValue(
      of({ displayName: 'Admin User', isAuthenticated: true })
    );
    mockAuthService.logout.and.returnValue(of(void 0));

    mockTenantService = jasmine.createSpyObj('TenantService', [], {
      branding: brandingSubject.asObservable(),
    });

    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent, RouterModule.forRoot([])],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    })
      .overrideComponent(AdminLayoutComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should toggle sidebar', () => {
    fixture.detectChanges();

    const initialState = component.sidebarCollapsed;

    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(!initialState);

    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(initialState);
  });

  it('should display tenant branding', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Tenant name should be displayed
    const title = compiled.querySelector('.topbar-title');
    expect(title).toBeTruthy();
    expect(title!.textContent!.trim()).toBe('Acme Corp');

    // Logo should be displayed
    const logo = compiled.querySelector('.topbar-logo') as HTMLImageElement;
    expect(logo).toBeTruthy();
    expect(logo.src).toContain('logo.png');
  });

  it('should call logout on button click', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const logoutBtn = compiled.querySelector('.logout-btn') as HTMLButtonElement;
    expect(logoutBtn).toBeTruthy();

    logoutBtn.click();

    expect(mockAuthService.logout).toHaveBeenCalled();
  });
});
