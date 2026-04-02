import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { Pipe, PipeTransform } from '@angular/core';

import { DashboardComponent } from './dashboard.component';

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

// ---------- Mock dashboard data ----------
const mockDashboardData = {
  user: {
    id: 'user-1',
    displayName: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
  },
  lastLogin: '2026-04-01T10:30:00Z',
  mfaMethods: ['TOTP'],
  activeSessions: 2,
  recentActivity: [
    {
      eventType: 'LOGIN',
      outcome: 'SUCCESS',
      timestamp: '2026-04-01T10:30:00Z',
      ipAddress: '192.168.1.1',
    },
  ],
};

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let httpTestingController: HttpTestingController;
  let mockAuthService: jasmine.SpyObj<any>;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['getAuthState', 'logout'], {
      currentState: mockAuthState,
      isAuthenticated: true,
    });
    mockAuthService.getAuthState.and.returnValue(of(mockAuthState));
    mockAuthService.logout.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        MockTranslatePipe,
        RouterTestingModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    })
      .overrideComponent(DashboardComponent, {
        set: {
          imports: [
            RouterTestingModule,
            MockTranslatePipe,
          ],
        },
      })
      .compileComponents();

    TestBed.overrideProvider(
      (await import('@innait/core')).AuthService,
      { useValue: mockAuthService },
    );

    httpTestingController = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    // Flush the initial dashboard GET request
    const req = httpTestingController.expectOne('/api/v1/self/dashboard');
    req.flush({ data: mockDashboardData });
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should display welcome card with user\'s name after loading dashboard data', () => {
    fixture.detectChanges();

    const req = httpTestingController.expectOne('/api/v1/self/dashboard');
    req.flush({ data: mockDashboardData });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const welcomeHeading = compiled.querySelector('.welcome-heading');
    expect(welcomeHeading?.textContent).toContain('Test User');
  });

  it('should display 4 quick action cards', () => {
    fixture.detectChanges();

    const req = httpTestingController.expectOne('/api/v1/self/dashboard');
    req.flush({ data: mockDashboardData });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const actionCards = compiled.querySelectorAll('.action-content');
    expect(actionCards.length).toBe(4);
  });

  it('should show loading spinner while fetching data', () => {
    fixture.detectChanges();

    // Before response arrives, component should be in loading state
    expect(component.loading).toBeTrue();

    const compiled = fixture.nativeElement as HTMLElement;
    const loadingContainer = compiled.querySelector('.loading-container');
    expect(loadingContainer).toBeTruthy();

    // Complete the pending request
    const req = httpTestingController.expectOne('/api/v1/self/dashboard');
    req.flush({ data: mockDashboardData });
    fixture.detectChanges();

    expect(component.loading).toBeFalse();
  });

  it('should display error message on API failure', () => {
    fixture.detectChanges();

    const req = httpTestingController.expectOne('/api/v1/self/dashboard');
    req.flush(
      { error: { message: 'Internal server error' } },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBeTruthy();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorEl = compiled.querySelector('p-message[severity="error"]');
    expect(errorEl).toBeTruthy();
  });
});
