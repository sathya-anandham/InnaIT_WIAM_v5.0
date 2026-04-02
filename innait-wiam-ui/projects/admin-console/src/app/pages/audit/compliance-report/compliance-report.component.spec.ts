import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { ComplianceReportComponent } from './compliance-report.component';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('ComplianceReportComponent', () => {
  let component: ComplianceReportComponent;
  let fixture: ComponentFixture<ComplianceReportComponent>;
  let httpTesting: HttpTestingController;

  const mockMfaData = {
    data: {
      totalUsers: 1000,
      mfaEnrolled: 850,
      percentage: 85,
      byMethod: { totp: 500, fido: 250, softtoken: 100 }
    }
  };

  const mockPasswordAgeData = {
    data: {
      totalUsers: 1000,
      compliant: 920,
      percentage: 92,
      expired: 30,
      nearExpiry: 50
    }
  };

  const mockAccessReviewData = {
    data: {
      totalReviews: 50,
      completed: 40,
      pending: 5,
      overdue: 5,
      completionRate: 80
    }
  };

  const mockPasswordPolicyData = {
    data: {
      totalUsers: 1000,
      compliant: 970,
      percentage: 97,
      nonCompliantReasons: [
        { reason: 'Too short', count: 20 },
        { reason: 'No special char', count: 10 }
      ]
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplianceReportComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .overrideComponent(ComplianceReportComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ComplianceReportComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /** Flush the 4 forkJoin requests triggered by loadAll(). */
  function flushForkJoinRequests(): void {
    const mfaReq = httpTesting.expectOne(req => req.url.includes('/compliance/mfa'));
    mfaReq.flush(mockMfaData);
    const pwdAgeReq = httpTesting.expectOne(req => req.url.includes('/compliance/password-age'));
    pwdAgeReq.flush(mockPasswordAgeData);
    const accessReq = httpTesting.expectOne(req => req.url.includes('/compliance/access-review'));
    accessReq.flush(mockAccessReviewData);
    const pwdPolicyReq = httpTesting.expectOne(req => req.url.includes('/compliance/password-policy'));
    pwdPolicyReq.flush(mockPasswordPolicyData);
  }

  it('should create the component', () => {
    fixture.detectChanges();
    flushForkJoinRequests();
    expect(component).toBeTruthy();
  });

  it('should load all compliance data via forkJoin', fakeAsync(() => {
    fixture.detectChanges();
    flushForkJoinRequests();
    tick();

    expect(component.loading).toBeFalse();
    expect(component.error).toBeNull();
    expect(component.lastRefresh).toBeTruthy();

    // MFA data
    expect(component.mfaData).toBeTruthy();
    expect(component.mfaData!.totalUsers).toBe(1000);
    expect(component.mfaData!.mfaEnrolled).toBe(850);
    expect(component.mfaData!.percentage).toBe(85);

    // Password age data
    expect(component.passwordAgeData).toBeTruthy();
    expect(component.passwordAgeData!.compliant).toBe(920);
    expect(component.passwordAgeData!.expired).toBe(30);

    // Access review data
    expect(component.accessReviewData).toBeTruthy();
    expect(component.accessReviewData!.totalReviews).toBe(50);
    expect(component.accessReviewData!.completionRate).toBe(80);

    // Password policy data
    expect(component.passwordPolicyData).toBeTruthy();
    expect(component.passwordPolicyData!.percentage).toBe(97);
  }));

  it('should calculate compliance percentages', fakeAsync(() => {
    fixture.detectChanges();
    flushForkJoinRequests();
    tick();

    // Test getStrokeDasharray
    const circumference = 2 * Math.PI * 52; // ~326.73
    const result = component.getStrokeDasharray(85);
    const filled = (85 / 100) * circumference;
    expect(result).toBe(`${filled} ${circumference - filled}`);

    // Test getProgressColor
    expect(component.getProgressColor(85)).toBe('progress-green');
    expect(component.getProgressColor(65)).toBe('progress-yellow');
    expect(component.getProgressColor(40)).toBe('progress-red');

    // Test getMethodPercent
    expect(component.getMethodPercent(500, 850)).toBeCloseTo((500 / 850) * 100, 1);
    expect(component.getMethodPercent(0, 0)).toBe(0);
  }));
});
