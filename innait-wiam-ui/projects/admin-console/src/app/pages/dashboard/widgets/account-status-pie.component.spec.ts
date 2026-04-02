import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform, Directive } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { BaseChartDirective } from 'ng2-charts';
import { AccountStatusPieComponent } from './account-status-pie.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Directive({ selector: '[baseChart]', standalone: true })
class MockBaseChartDirective {}

describe('AccountStatusPieComponent', () => {
  let component: AccountStatusPieComponent;
  let fixture: ComponentFixture<AccountStatusPieComponent>;
  let httpMock: HttpTestingController;

  const mockResponse = {
    data: {
      active: 800,
      suspended: 50,
      locked: 30,
      disabled: 20,
      pendingActivation: 100,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountStatusPieComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(AccountStatusPieComponent, {
        remove: { imports: [TranslatePipe, BaseChartDirective] },
        add: { imports: [MockTranslatePipe, MockBaseChartDirective] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccountStatusPieComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/admin/dashboard/account-status');
    req.flush(mockResponse);
    expect(component).toBeTruthy();
  });

  it('should fetch account status data and build pie chart', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/account-status');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();

    // Chart data
    expect(component.chartData.labels).toEqual([
      'Active',
      'Suspended',
      'Locked',
      'Disabled',
      'Pending Activation',
    ]);
    expect(component.chartData.datasets.length).toBe(1);
    expect(component.chartData.datasets[0].data).toEqual([
      800, 50, 30, 20, 100,
    ]);
    expect(component.chartData.datasets[0].backgroundColor).toEqual([
      '#22c55e',
      '#f59e0b',
      '#ef4444',
      '#94a3b8',
      '#3b82f6',
    ]);

    // Legend items
    expect(component.legendItems.length).toBe(5);
    expect(component.legendItems[0]).toEqual({
      label: 'Active',
      color: '#22c55e',
      count: 800,
    });
    expect(component.legendItems[2]).toEqual({
      label: 'Locked',
      color: '#ef4444',
      count: 30,
    });
  });
});
