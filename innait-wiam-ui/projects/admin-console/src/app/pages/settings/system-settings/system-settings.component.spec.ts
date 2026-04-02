import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { SystemSettingsComponent } from './system-settings.component';
import { TranslatePipe } from '@innait/i18n';
import { ConfirmationService, MessageService } from 'primeng/api';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('SystemSettingsComponent', () => {
  let component: SystemSettingsComponent;
  let fixture: ComponentFixture<SystemSettingsComponent>;
  let httpTesting: HttpTestingController;
  let confirmationService: ConfirmationService;

  const mockSettings = [
    {
      key: 'session.timeout',
      value: '1800',
      description: 'Session timeout in seconds',
      category: 'Session',
      dataType: 'DURATION' as const,
      defaultValue: '1800',
      modifiedAt: null
    },
    {
      key: 'session.maxConcurrent',
      value: '5',
      description: 'Maximum concurrent sessions per user',
      category: 'Session',
      dataType: 'NUMBER' as const,
      defaultValue: '3',
      modifiedAt: '2026-03-01T10:00:00Z'
    },
    {
      key: 'otp.length',
      value: '6',
      description: 'OTP code length',
      category: 'OTP',
      dataType: 'NUMBER' as const,
      defaultValue: '6',
      modifiedAt: null
    },
    {
      key: 'otp.expiry',
      value: '300',
      description: 'OTP expiry time in seconds',
      category: 'OTP',
      dataType: 'DURATION' as const,
      defaultValue: '300',
      modifiedAt: null
    },
    {
      key: 'ratelimit.login.maxAttempts',
      value: '10',
      description: 'Maximum login attempts before lockout',
      category: 'Rate Limits',
      dataType: 'NUMBER' as const,
      defaultValue: '5',
      modifiedAt: '2026-02-15T08:00:00Z'
    },
    {
      key: 'security.enforceHttps',
      value: 'true',
      description: 'Enforce HTTPS for all connections',
      category: 'Security',
      dataType: 'BOOLEAN' as const,
      defaultValue: 'true',
      modifiedAt: null
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SystemSettingsComponent,
        ReactiveFormsModule,
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
    .overrideComponent(SystemSettingsComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    confirmationService = TestBed.inject(ConfirmationService);
    fixture = TestBed.createComponent(SystemSettingsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/system');
    req.flush({ data: mockSettings });

    expect(component).toBeTruthy();
  });

  it('should load and group settings by category', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/system');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockSettings });

    expect(component.loading).toBeFalse();

    const groups = component.filteredGroups;
    expect(groups.length).toBe(4); // Session, OTP, Rate Limits, Security

    // Verify ordering: Session (0), OTP (1), Rate Limits (2), Security (4)
    expect(groups[0].category).toBe('Session');
    expect(groups[0].label).toBe('Session Management');
    expect(groups[0].settings.length).toBe(2);

    expect(groups[1].category).toBe('OTP');
    expect(groups[1].label).toBe('OTP Configuration');
    expect(groups[1].settings.length).toBe(2);

    expect(groups[2].category).toBe('Rate Limits');
    expect(groups[2].label).toBe('Rate Limits');
    expect(groups[2].settings.length).toBe(1);

    expect(groups[3].category).toBe('Security');
    expect(groups[3].label).toBe('Security');
    expect(groups[3].settings.length).toBe(1);

    // Verify modified count for Session category (session.maxConcurrent is modified)
    const sessionGroup = groups[0];
    expect(component.getModifiedCount(sessionGroup)).toBe(1);

    // Rate Limits group has modified setting (10 vs default 5)
    const rateLimitsGroup = groups[2];
    expect(component.getModifiedCount(rateLimitsGroup)).toBe(1);
  });

  it('should save individual setting via PUT', () => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/system');
    loadReq.flush({ data: mockSettings });

    // Find the session.maxConcurrent setting
    const sessionGroup = component.filteredGroups.find(g => g.category === 'Session');
    const maxConcurrentSetting = sessionGroup!.settings.find(s => s.key === 'session.maxConcurrent')!;

    // Start editing
    component.startEdit(maxConcurrentSetting);
    expect(maxConcurrentSetting.editing).toBeTrue();
    expect(maxConcurrentSetting.editValue).toBe(5); // parsed from '5'

    // Change the value
    maxConcurrentSetting.editValue = 10;

    // Save the edit
    component.saveEdit(maxConcurrentSetting);
    expect(maxConcurrentSetting.saving).toBeTrue();

    const saveReq = httpTesting.expectOne('/api/v1/admin/settings/system/session.maxConcurrent');
    expect(saveReq.request.method).toBe('PUT');
    expect(saveReq.request.body.value).toBe('10');

    saveReq.flush({
      data: {
        ...maxConcurrentSetting,
        value: '10',
        modifiedAt: '2026-04-03T14:00:00Z'
      }
    });

    expect(maxConcurrentSetting.saving).toBeFalse();
    expect(maxConcurrentSetting.editing).toBeFalse();
    expect(maxConcurrentSetting.value).toBe('10');
    expect(maxConcurrentSetting.modifiedAt).toBe('2026-04-03T14:00:00Z');
  });

  it('should reset setting to default', () => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/system');
    loadReq.flush({ data: mockSettings });

    spyOn(confirmationService, 'confirm').and.callFake((options: any) => {
      // Verify the confirmation dialog shows the default value
      expect(options.message).toContain('session.maxConcurrent');
      expect(options.header).toBe('Reset to Default');

      // Simulate user accepting the confirmation
      if (options.accept) {
        options.accept();
      }
    });

    // Find the modified session.maxConcurrent setting (value: '5', default: '3')
    const sessionGroup = component.filteredGroups.find(g => g.category === 'Session');
    const maxConcurrentSetting = sessionGroup!.settings.find(s => s.key === 'session.maxConcurrent')!;
    expect(component.isModified(maxConcurrentSetting)).toBeTrue();

    // Trigger reset to default
    component.onResetSetting(maxConcurrentSetting);

    // Confirm dialog should have been triggered
    expect(confirmationService.confirm).toHaveBeenCalled();

    // After accepting, a PUT request should set value to defaultValue
    const resetReq = httpTesting.expectOne('/api/v1/admin/settings/system/session.maxConcurrent');
    expect(resetReq.request.method).toBe('PUT');
    expect(resetReq.request.body.value).toBe('3'); // defaultValue

    resetReq.flush({
      data: {
        ...maxConcurrentSetting,
        value: '3',
        modifiedAt: '2026-04-03T15:00:00Z'
      }
    });

    expect(maxConcurrentSetting.saving).toBeFalse();
    expect(maxConcurrentSetting.value).toBe('3');
    expect(component.isModified(maxConcurrentSetting)).toBeFalse();
  });
});
