import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform, Directive, Input } from '@angular/core';

import { LoginAnalyticsComponent } from './login-analytics.component';
import { TranslatePipe } from '@innait/i18n';
import { BaseChartDirective } from 'ng2-charts';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

@Directive({ selector: '[baseChart]', standalone: true })
class MockBaseChartDirective {
  @Input() data: any;
  @Input() options: any;
  @Input() type: any;
}

describe('LoginAnalyticsComponent', () => {
  let component: LoginAnalyticsComponent;
  let fixture: ComponentFixture<LoginAnalyticsComponent>;
  let httpTesting: HttpTestingController;

  const mockTrends = {
    data: {
      dates: ['2025-04-01', '2025-04-02', '2025-04-03'],
      success: [120, 135, 140],
      failure: [5, 8, 3]
    }
  };

  const mockGeo = {
    data: [
      { country: 'US', region: 'California', loginCount: 500, failureRate: 2.1, lastLogin: '2025-05-01T10:00:00Z' },
      { country: 'DE', region: 'Bavaria', loginCount: 120, failureRate: 15.3, lastLogin: '2025-05-01T09:00:00Z' }
    ]
  };

  const mockFailedIps = {
    data: [
      { ipAddress: '10.0.1.50', failureCount: 42, lastAttempt: '2025-05-01T08:30:00Z', blockedStatus: false },
      { ipAddress: '192.168.1.99', failureCount: 15, lastAttempt: '2025-04-30T22:00:00Z', blockedStatus: true }
    ]
  };

  const mockAuthMethods = {
    data: [
      { method: 'PASSWORD', count: 800 },
      { method: 'TOTP', count: 350 },
      { method: 'FIDO2', count: 120 }
    ]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginAnalyticsComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .overrideComponent(LoginAnalyticsComponent, {
      remove: { imports: [TranslatePipe, BaseChartDirective] },
      add: { imports: [MockTranslatePipe, MockBaseChartDirective] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginAnalyticsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  /** Flush the 4 initial requests that ngOnInit triggers via refreshAll(). */
  function flushInitialRequests(): void {
    const trendsReq = httpTesting.expectOne(req => req.url.includes('/login-analytics/trends'));
    trendsReq.flush(mockTrends);
    const geoReq = httpTesting.expectOne(req => req.url.includes('/login-analytics/geo'));
    geoReq.flush(mockGeo);
    const failedReq = httpTesting.expectOne(req => req.url.includes('/login-analytics/failed-ips'));
    failedReq.flush(mockFailedIps);
    const authReq = httpTesting.expectOne(req => req.url.includes('/login-analytics/auth-methods'));
    authReq.flush(mockAuthMethods);
  }

  it('should create the component', () => {
    fixture.detectChanges();
    flushInitialRequests();
    expect(component).toBeTruthy();
  });

  it('should load trend data and build line chart', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    expect(component.trendsLoading).toBeFalse();
    expect(component.trendsChartData.labels!.length).toBe(3);
    expect(component.trendsChartData.labels![0]).toBe('2025-04-01');
    expect(component.trendsChartData.datasets.length).toBe(2);
    expect(component.trendsChartData.datasets[0].label).toBe('Successful Logins');
    expect(component.trendsChartData.datasets[0].data).toEqual([120, 135, 140]);
    expect(component.trendsChartData.datasets[1].label).toBe('Failed Logins');
    expect(component.trendsChartData.datasets[1].data).toEqual([5, 8, 3]);
  }));

  it('should load top failed IPs', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    expect(component.failedIpsLoading).toBeFalse();
    expect(component.failedIps.length).toBe(2);
    expect(component.failedIps[0].ipAddress).toBe('10.0.1.50');
    expect(component.failedIps[0].failureCount).toBe(42);
    expect(component.failedIps[0].blockedStatus).toBeFalse();
    expect(component.failedIps[1].ipAddress).toBe('192.168.1.99');
    expect(component.failedIps[1].blockedStatus).toBeTrue();

    // Block the first IP
    component.blockIp(component.failedIps[0]);
    expect(component.blockingIps.has('10.0.1.50')).toBeTrue();

    const blockReq = httpTesting.expectOne(req =>
      req.method === 'POST' && req.url.includes('/login-analytics/block-ip')
    );
    expect(blockReq.request.body.ipAddress).toBe('10.0.1.50');
    blockReq.flush({ data: null });
    tick();

    expect(component.failedIps[0].blockedStatus).toBeTrue();
    expect(component.blockingIps.has('10.0.1.50')).toBeFalse();
  }));
});
