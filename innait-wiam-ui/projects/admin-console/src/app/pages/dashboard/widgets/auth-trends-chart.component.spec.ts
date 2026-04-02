import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform, Directive } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { BaseChartDirective } from 'ng2-charts';
import { AuthTrendsChartComponent } from './auth-trends-chart.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Directive({ selector: '[baseChart]', standalone: true })
class MockBaseChartDirective {}

describe('AuthTrendsChartComponent', () => {
  let component: AuthTrendsChartComponent;
  let fixture: ComponentFixture<AuthTrendsChartComponent>;
  let httpMock: HttpTestingController;

  const mockResponse = {
    data: {
      dates: ['2026-03-28', '2026-03-29', '2026-03-30'],
      success: [120, 135, 150],
      failure: [10, 8, 12],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthTrendsChartComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(AuthTrendsChartComponent, {
        remove: { imports: [TranslatePipe, BaseChartDirective] },
        add: { imports: [MockTranslatePipe, MockBaseChartDirective] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuthTrendsChartComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/admin/dashboard/auth-trends');
    req.flush(mockResponse);
    expect(component).toBeTruthy();
  });

  it('should fetch auth trends data and build chart data', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/auth-trends');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    expect(component.chartData.labels).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
    ]);
    expect(component.chartData.datasets.length).toBe(2);
    expect(component.chartData.datasets[0].label).toBe('Success');
    expect(component.chartData.datasets[0].data).toEqual([120, 135, 150]);
    expect(component.chartData.datasets[1].label).toBe('Failure');
    expect(component.chartData.datasets[1].data).toEqual([10, 8, 12]);
  });

  it('should show skeleton loader while loading', () => {
    fixture.detectChanges();

    // Before HTTP response, loading should be true
    expect(component.loading).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    const skeleton = compiled.querySelector('.skeleton-container');
    expect(skeleton).toBeTruthy();

    // Flush the request
    const req = httpMock.expectOne('/api/v1/admin/dashboard/auth-trends');
    req.flush(mockResponse);
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    const skeletonAfter = compiled.querySelector('.skeleton-container');
    expect(skeletonAfter).toBeFalsy();
  });
});
