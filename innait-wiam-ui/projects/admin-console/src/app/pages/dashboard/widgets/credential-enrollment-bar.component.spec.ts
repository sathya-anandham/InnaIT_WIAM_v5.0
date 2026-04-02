import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform, Directive } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { BaseChartDirective } from 'ng2-charts';
import { CredentialEnrollmentBarComponent } from './credential-enrollment-bar.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Directive({ selector: '[baseChart]', standalone: true })
class MockBaseChartDirective {}

describe('CredentialEnrollmentBarComponent', () => {
  let component: CredentialEnrollmentBarComponent;
  let fixture: ComponentFixture<CredentialEnrollmentBarComponent>;
  let httpMock: HttpTestingController;

  const mockResponse = {
    data: {
      types: ['Password', 'TOTP', 'FIDO', 'SoftToken'],
      counts: [500, 300, 150, 80],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CredentialEnrollmentBarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(CredentialEnrollmentBarComponent, {
        remove: { imports: [TranslatePipe, BaseChartDirective] },
        add: { imports: [MockTranslatePipe, MockBaseChartDirective] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CredentialEnrollmentBarComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne(
      '/api/v1/admin/dashboard/credential-enrollment'
    );
    req.flush(mockResponse);
    expect(component).toBeTruthy();
  });

  it('should fetch credential data and build horizontal bar chart', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(
      '/api/v1/admin/dashboard/credential-enrollment'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();

    expect(component.chartData.labels).toEqual([
      'Password',
      'TOTP',
      'FIDO',
      'SoftToken',
    ]);
    expect(component.chartData.datasets.length).toBe(1);
    expect(component.chartData.datasets[0].data).toEqual([500, 300, 150, 80]);

    // Verify color mapping: Password -> #3b82f6, TOTP -> #22c55e, FIDO -> #8b5cf6, SoftToken -> #f59e0b
    expect(component.chartData.datasets[0].backgroundColor).toEqual([
      '#3b82f6',
      '#22c55e',
      '#8b5cf6',
      '#f59e0b',
    ]);

    // Verify horizontal bar via chartOptions indexAxis
    expect(component.chartOptions!.indexAxis).toBe('y');
  });
});
