import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Directive, Input, Pipe, PipeTransform } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslatePipe } from '@innait/i18n';
import { BaseChartDirective } from 'ng2-charts';
import { CredentialOverviewComponent } from './credential-overview.component';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Directive({ selector: '[baseChart]', standalone: true })
class MockBaseChartDirective {
  @Input() data: any;
  @Input() options: any;
  @Input() type: any;
}

describe('CredentialOverviewComponent', () => {
  let component: CredentialOverviewComponent;
  let fixture: ComponentFixture<CredentialOverviewComponent>;
  let httpTesting: HttpTestingController;

  const mockPasswordAgeResponse = {
    data: {
      buckets: [
        { label: '0-30 days', count: 500 },
        { label: '31-60 days', count: 300 },
        { label: '61-90 days', count: 150 },
        { label: '91-180 days', count: 80 },
        { label: '180+ days', count: 40 },
      ],
    },
  };

  const mockMfaAdoptionResponse = {
    data: {
      methods: [
        { name: 'TOTP', percentage: 65, count: 650 },
        { name: 'FIDO', percentage: 35, count: 350 },
        { name: 'Soft Token', percentage: 45, count: 450 },
      ],
    },
  };

  const mockEnrollmentResponse = {
    data: {
      password: 1000,
      totp: 650,
      fido: 350,
      softtoken: 450,
      total: 2450,
    },
  };

  const mockTrendsResponse = {
    data: {
      dates: ['2025-01-01', '2025-01-02', '2025-01-03'],
      password: [10, 15, 12],
      totp: [5, 8, 6],
      fido: [3, 2, 4],
      softtoken: [7, 9, 5],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CredentialOverviewComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    })
      .overrideComponent(CredentialOverviewComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .overrideComponent(CredentialOverviewComponent, {
        remove: { imports: [BaseChartDirective] },
        add: { imports: [MockBaseChartDirective] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(CredentialOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Respond to all 4 initial data loads from ngOnInit -> refreshAll()
    const passwordAgeReq = httpTesting.expectOne('/api/v1/admin/credentials/stats/password-age');
    passwordAgeReq.flush(mockPasswordAgeResponse);

    const mfaReq = httpTesting.expectOne('/api/v1/admin/credentials/stats/mfa-adoption');
    mfaReq.flush(mockMfaAdoptionResponse);

    const enrollmentReq = httpTesting.expectOne('/api/v1/admin/credentials/stats/enrollment');
    enrollmentReq.flush(mockEnrollmentResponse);

    const trendsReq = httpTesting.expectOne('/api/v1/admin/credentials/stats/trends');
    trendsReq.flush(mockTrendsResponse);

    fixture.detectChanges();
  });

  afterEach(() => {
    // Stop auto-refresh if active, then verify
    if (component.autoRefreshEnabled) {
      component.toggleAutoRefresh();
    }
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load all 4 chart/panel data sets', () => {
    // Password age
    expect(component.passwordAgeLoading).toBeFalse();
    expect(component.passwordAgeChartData.labels!.length).toBe(5);
    expect(component.passwordAgeChartData.datasets.length).toBe(1);

    // MFA adoption
    expect(component.mfaAdoptionLoading).toBeFalse();
    expect(component.mfaAdoptionChartData.labels!.length).toBe(3);

    // Enrollment cards
    expect(component.enrollmentLoading).toBeFalse();
    expect(component.enrollmentCards.length).toBe(4);
    expect(component.enrollmentCards[0].label).toBe('Password');
    expect(component.enrollmentCards[0].count).toBe(1000);

    // Trends
    expect(component.trendsLoading).toBeFalse();
    expect(component.trendsChartData.datasets.length).toBe(4);
  });

  it('should build password age bar chart data', () => {
    const chartData = component.passwordAgeChartData;

    // Labels match buckets
    expect(chartData.labels).toEqual([
      '0-30 days',
      '31-60 days',
      '61-90 days',
      '91-180 days',
      '180+ days',
    ]);

    // Data values match counts
    const dataset = chartData.datasets[0];
    expect(dataset.data).toEqual([500, 300, 150, 80, 40]);

    // Colors are assigned
    expect(dataset.backgroundColor).toBeDefined();
    expect((dataset.backgroundColor as string[]).length).toBe(5);
  });

  it('should toggle auto-refresh', fakeAsync(() => {
    expect(component.autoRefreshEnabled).toBeFalse();

    // Enable auto-refresh
    component.toggleAutoRefresh();
    expect(component.autoRefreshEnabled).toBeTrue();

    // Disable auto-refresh before interval fires to keep test clean
    component.toggleAutoRefresh();
    expect(component.autoRefreshEnabled).toBeFalse();
  }));
});
