import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform, Directive } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { BaseChartDirective } from 'ng2-charts';
import { MfaAdoptionChartComponent } from './mfa-adoption-chart.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Directive({ selector: '[baseChart]', standalone: true })
class MockBaseChartDirective {}

describe('MfaAdoptionChartComponent', () => {
  let component: MfaAdoptionChartComponent;
  let fixture: ComponentFixture<MfaAdoptionChartComponent>;
  let httpMock: HttpTestingController;

  const mockResponse = {
    data: {
      totp: 300,
      fido: 150,
      softtoken: 100,
      none: 50,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MfaAdoptionChartComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(MfaAdoptionChartComponent, {
        remove: { imports: [TranslatePipe, BaseChartDirective] },
        add: { imports: [MockTranslatePipe, MockBaseChartDirective] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MfaAdoptionChartComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/admin/dashboard/mfa-adoption');
    req.flush(mockResponse);
    expect(component).toBeTruthy();
  });

  it('should fetch MFA adoption data and build donut chart', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/mfa-adoption');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();

    // Total = 300 + 150 + 100 + 50 = 600
    expect(component.totalCount).toBe(600);

    // Chart data
    expect(component.chartData.labels).toEqual([
      'TOTP',
      'FIDO2/WebAuthn',
      'Soft Token',
      'None',
    ]);
    expect(component.chartData.datasets.length).toBe(1);
    expect(component.chartData.datasets[0].data).toEqual([300, 150, 100, 50]);
    expect(component.chartData.datasets[0].backgroundColor).toEqual([
      '#3b82f6',
      '#8b5cf6',
      '#f59e0b',
      '#94a3b8',
    ]);

    // Legend items
    expect(component.legendItems.length).toBe(4);
    expect(component.legendItems[0].label).toBe('TOTP');
    expect(component.legendItems[0].percentage).toBe('50.0');
  });

  it('should display total count in center', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/mfa-adoption');
    req.flush(mockResponse);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const totalValue = compiled.querySelector('.total-value');
    expect(totalValue).toBeTruthy();
    expect(totalValue!.textContent!.trim()).toBe('600');
  });
});
