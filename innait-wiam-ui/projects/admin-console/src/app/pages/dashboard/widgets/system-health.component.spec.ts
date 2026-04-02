import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { SystemHealthComponent } from './system-health.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('SystemHealthComponent', () => {
  let component: SystemHealthComponent;
  let fixture: ComponentFixture<SystemHealthComponent>;
  let httpMock: HttpTestingController;

  const mockServices = [
    {
      name: 'Auth Service',
      status: 'UP' as const,
      responseTime: 45,
      lastCheck: new Date().toISOString(),
    },
    {
      name: 'User Service',
      status: 'UP' as const,
      responseTime: 32,
      lastCheck: new Date().toISOString(),
    },
    {
      name: 'MFA Service',
      status: 'DEGRADED' as const,
      responseTime: 250,
      lastCheck: new Date().toISOString(),
    },
    {
      name: 'Audit Service',
      status: 'DOWN' as const,
      responseTime: 0,
      lastCheck: new Date().toISOString(),
    },
  ];

  const mockResponse = {
    data: {
      services: mockServices,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SystemHealthComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(SystemHealthComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SystemHealthComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/admin/dashboard/health');
    req.flush(mockResponse);
    expect(component).toBeTruthy();
  });

  it('should fetch and display service health statuses', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/health');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    expect(component.services.length).toBe(4);
    expect(component.services[0].name).toBe('Auth Service');
    expect(component.services[0].status).toBe('UP');
    expect(component.services[2].status).toBe('DEGRADED');
    expect(component.services[3].status).toBe('DOWN');

    // hasDown=true => summary-down
    expect(component.overallStatusClass).toBe('summary-down');
    expect(component.overallIcon).toBe('pi-times-circle');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const serviceRows = compiled.querySelectorAll('.service-row');
    expect(serviceRows.length).toBe(4);
  });

  it('should calculate overall healthy count', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/health');
    req.flush(mockResponse);

    // 2 services are UP out of 4
    expect(component.healthyCount).toBe(2);

    // Test with all UP
    component.services = [];
    component.healthyCount = 0;

    const allUpResponse = {
      data: {
        services: [
          {
            name: 'Auth Service',
            status: 'UP' as const,
            responseTime: 45,
            lastCheck: new Date().toISOString(),
          },
          {
            name: 'User Service',
            status: 'UP' as const,
            responseTime: 32,
            lastCheck: new Date().toISOString(),
          },
        ],
      },
    };

    component.loadData();
    const req2 = httpMock.expectOne('/api/v1/admin/dashboard/health');
    req2.flush(allUpResponse);

    expect(component.healthyCount).toBe(2);
    expect(component.overallStatusClass).toBe('summary-healthy');
    expect(component.overallIcon).toBe('pi-check-circle');
  });
});
