import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { FeatureFlagsComponent } from './feature-flags.component';
import { TranslatePipe } from '@innait/i18n';
import { ConfirmationService, MessageService } from 'primeng/api';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('FeatureFlagsComponent', () => {
  let component: FeatureFlagsComponent;
  let fixture: ComponentFixture<FeatureFlagsComponent>;
  let httpTesting: HttpTestingController;
  let confirmationService: ConfirmationService;

  const mockFlags = [
    {
      key: 'auth.sso',
      name: 'Single Sign-On',
      description: 'Enable SSO for users',
      enabled: true,
      category: 'AUTHENTICATION' as const,
      modifiedAt: null,
      modifiedBy: null
    },
    {
      key: 'mfa.enforcement',
      name: 'MFA Enforcement',
      description: 'Enforce MFA for all users',
      enabled: true,
      category: 'MFA' as const,
      modifiedAt: '2026-01-01T00:00:00Z',
      modifiedBy: 'admin'
    },
    {
      key: 'iga.access.reviews',
      name: 'Access Reviews',
      description: 'Enable periodic access reviews',
      enabled: false,
      category: 'IGA' as const,
      modifiedAt: null,
      modifiedBy: null
    },
    {
      key: 'notifications.email',
      name: 'Email Notifications',
      description: 'Enable email notifications',
      enabled: true,
      category: 'NOTIFICATIONS' as const,
      modifiedAt: null,
      modifiedBy: null
    },
    {
      key: 'auth.lockout',
      name: 'Account Lockout',
      description: 'Lock accounts after failed attempts',
      enabled: true,
      category: 'AUTHENTICATION' as const,
      modifiedAt: null,
      modifiedBy: null
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FeatureFlagsComponent,
        FormsModule,
        NoopAnimationsModule
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService
      ]
    })
    .overrideComponent(FeatureFlagsComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    confirmationService = TestBed.inject(ConfirmationService);
    fixture = TestBed.createComponent(FeatureFlagsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/features');
    req.flush({ data: mockFlags });

    expect(component).toBeTruthy();
  });

  it('should load and group feature flags by category', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/features');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockFlags });

    expect(component.loading).toBeFalse();
    expect(component.totalCount).toBe(5);
    expect(component.enabledCount).toBe(4);

    // Verify grouping by category
    const groups = component.filteredGroups;
    expect(groups.length).toBeGreaterThanOrEqual(3);

    // Find the AUTHENTICATION group
    const authGroup = groups.find(g => g.category === 'AUTHENTICATION');
    expect(authGroup).toBeTruthy();
    expect(authGroup!.label).toBe('Authentication');
    expect(authGroup!.flags.length).toBe(2);

    // Find the MFA group
    const mfaGroup = groups.find(g => g.category === 'MFA');
    expect(mfaGroup).toBeTruthy();
    expect(mfaGroup!.label).toBe('Multi-Factor Authentication');
    expect(mfaGroup!.flags.length).toBe(1);

    // Find the IGA group
    const igaGroup = groups.find(g => g.category === 'IGA');
    expect(igaGroup).toBeTruthy();
    expect(igaGroup!.flags.length).toBe(1);

    // Verify ordering: AUTHENTICATION (0), MFA (1), IGA (2), NOTIFICATIONS (3)
    expect(groups[0].category).toBe('AUTHENTICATION');
    expect(groups[1].category).toBe('MFA');
  });

  it('should toggle a feature flag', () => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/features');
    loadReq.flush({ data: mockFlags });

    // Toggle a non-critical flag (Access Reviews - currently disabled)
    const igaGroup = component.filteredGroups.find(g => g.category === 'IGA');
    const accessReviewsFlag = igaGroup!.flags[0];
    expect(accessReviewsFlag.enabled).toBeFalse();

    // Simulate toggle event (enabling the flag)
    component.onToggle(accessReviewsFlag, { checked: true });
    expect(component.togglingKey).toBe('iga.access.reviews');

    const toggleReq = httpTesting.expectOne('/api/v1/admin/settings/features/iga.access.reviews');
    expect(toggleReq.request.method).toBe('PUT');
    expect(toggleReq.request.body.enabled).toBeTrue();

    toggleReq.flush({
      data: {
        ...accessReviewsFlag,
        enabled: true,
        modifiedAt: '2026-04-03T12:00:00Z',
        modifiedBy: 'admin'
      }
    });

    expect(component.togglingKey).toBeNull();
    expect(accessReviewsFlag.modifiedAt).toBe('2026-04-03T12:00:00Z');
    expect(accessReviewsFlag.modifiedBy).toBe('admin');
  });

  it('should show confirmation for critical features', () => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/features');
    loadReq.flush({ data: mockFlags });

    spyOn(confirmationService, 'confirm').and.callFake((options: any) => {
      // Verify the confirmation dialog has proper warning messaging
      expect(options.message).toContain('critical security feature');
      expect(options.header).toBe('Disable Critical Feature');
      expect(options.acceptButtonStyleClass).toBe('p-button-danger');

      // Simulate user accepting the confirmation
      if (options.accept) {
        options.accept();
      }
    });

    // Find the MFA Enforcement flag (critical feature)
    const mfaGroup = component.filteredGroups.find(g => g.category === 'MFA');
    const mfaFlag = mfaGroup!.flags.find(f => f.key === 'mfa.enforcement')!;
    expect(mfaFlag.enabled).toBeTrue();

    // Try to disable a critical feature
    component.onToggle(mfaFlag, { checked: false });

    // Confirm dialog should have been triggered
    expect(confirmationService.confirm).toHaveBeenCalled();

    // After accepting, the PUT request should be made
    const toggleReq = httpTesting.expectOne('/api/v1/admin/settings/features/mfa.enforcement');
    expect(toggleReq.request.method).toBe('PUT');
    expect(toggleReq.request.body.enabled).toBeFalse();

    toggleReq.flush({
      data: {
        ...mfaFlag,
        enabled: false,
        modifiedAt: '2026-04-03T12:30:00Z',
        modifiedBy: 'admin'
      }
    });

    expect(component.togglingKey).toBeNull();
  });
});
