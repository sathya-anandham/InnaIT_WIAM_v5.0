import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { FailedLoginHeatmapComponent } from './failed-login-heatmap.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('FailedLoginHeatmapComponent', () => {
  let component: FailedLoginHeatmapComponent;
  let fixture: ComponentFixture<FailedLoginHeatmapComponent>;
  let httpMock: HttpTestingController;

  const mockResponse = {
    data: {
      data: [
        { day: 0, hour: 9, count: 5 },
        { day: 0, hour: 14, count: 20 },
        { day: 1, hour: 3, count: 10 },
        { day: 2, hour: 22, count: 15 },
        { day: 3, hour: 12, count: 0 },
      ],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FailedLoginHeatmapComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(FailedLoginHeatmapComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FailedLoginHeatmapComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne(
      '/api/v1/admin/dashboard/failed-login-heatmap'
    );
    req.flush(mockResponse);
    expect(component).toBeTruthy();
  });

  it('should fetch heatmap data and build grid', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(
      '/api/v1/admin/dashboard/failed-login-heatmap'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();

    // Verify days and hours arrays exist
    expect(component.days.length).toBe(7);
    expect(component.hours.length).toBe(24);

    fixture.detectChanges();

    // After data is loaded the heatmap-wrapper should be rendered
    const compiled = fixture.nativeElement as HTMLElement;
    const wrapper = compiled.querySelector('.heatmap-wrapper');
    expect(wrapper).toBeTruthy();

    // Check heatmap rows - 7 days
    const rows = compiled.querySelectorAll('.heatmap-row');
    expect(rows.length).toBe(7);
  });

  it('should calculate cell color based on intensity', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(
      '/api/v1/admin/dashboard/failed-login-heatmap'
    );
    req.flush(mockResponse);

    // Max count in mock data is 20 (day=0, hour=14)

    // count=0 or no entry => '#f3f4f6'
    expect(component.getCellColor(3, 12)).toBe('#f3f4f6');
    expect(component.getCellColor(6, 0)).toBe('#f3f4f6');

    // count=5, intensity=5/20=0.25 => '#fecaca' (<=0.25)
    expect(component.getCellColor(0, 9)).toBe('#fecaca');

    // count=10, intensity=10/20=0.5 => '#f87171' (<=0.5)
    expect(component.getCellColor(1, 3)).toBe('#f87171');

    // count=15, intensity=15/20=0.75 => '#dc2626' (<=0.75)
    expect(component.getCellColor(2, 22)).toBe('#dc2626');

    // count=20, intensity=20/20=1.0 => '#7f1d1d' (>0.75)
    expect(component.getCellColor(0, 14)).toBe('#7f1d1d');
  });
});
