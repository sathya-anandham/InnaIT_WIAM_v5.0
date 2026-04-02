import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
  discardPeriodicTasks,
} from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform, Directive } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { BaseChartDirective } from 'ng2-charts';
import { ActiveSessionsGaugeComponent } from './active-sessions-gauge.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Directive({ selector: '[baseChart]', standalone: true })
class MockBaseChartDirective {}

describe('ActiveSessionsGaugeComponent', () => {
  let component: ActiveSessionsGaugeComponent;
  let fixture: ComponentFixture<ActiveSessionsGaugeComponent>;
  let httpMock: HttpTestingController;

  const mockResponse = {
    data: {
      count: 75,
      peak: 120,
      limit: 100,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveSessionsGaugeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(ActiveSessionsGaugeComponent, {
        remove: { imports: [TranslatePipe, BaseChartDirective] },
        add: { imports: [MockTranslatePipe, MockBaseChartDirective] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ActiveSessionsGaugeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/active-sessions');
    req.flush(mockResponse);

    expect(component).toBeTruthy();

    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('should fetch session data and calculate gauge color', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/active-sessions');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.sessionData).toEqual({
      count: 75,
      peak: 120,
      limit: 100,
    });

    // 75/100 = 0.75 which is >= 0.7 => yellow (#f59e0b)
    expect(component.chartData.datasets.length).toBe(1);
    expect(component.chartData.datasets[0].data).toEqual([75, 25]);
    expect(component.chartData.datasets[0].backgroundColor).toEqual([
      '#f59e0b',
      '#e5e7eb',
    ]);

    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('should auto-refresh every 30 seconds', fakeAsync(() => {
    fixture.detectChanges();

    // Initial request from startWith(0)
    const initialReq = httpMock.expectOne(
      '/api/v1/admin/dashboard/active-sessions'
    );
    initialReq.flush(mockResponse);
    expect(component.loading).toBe(false);

    // Advance 30 seconds to trigger the interval
    tick(30_000);

    const secondReq = httpMock.expectOne(
      '/api/v1/admin/dashboard/active-sessions'
    );
    secondReq.flush({
      data: { count: 80, peak: 120, limit: 100 },
    });

    expect(component.sessionData!.count).toBe(80);

    // Advance another 30 seconds
    tick(30_000);

    const thirdReq = httpMock.expectOne(
      '/api/v1/admin/dashboard/active-sessions'
    );
    thirdReq.flush({
      data: { count: 95, peak: 120, limit: 100 },
    });

    // 95/100 = 0.95 > 0.9 => red
    expect(component.chartData.datasets[0].backgroundColor).toEqual([
      '#ef4444',
      '#e5e7eb',
    ]);

    component.ngOnDestroy();
    discardPeriodicTasks();
  }));
});
