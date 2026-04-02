import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, Input, Pipe, PipeTransform } from '@angular/core';

import { ActiveSessionsComponent } from './active-sessions.component';
import { TranslatePipe } from '@innait/i18n';
import { AgGridAngular } from 'ag-grid-angular';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

@Component({ selector: 'ag-grid-angular', standalone: true, template: '' })
class MockAgGrid {
  @Input() rowModelType: any;
  @Input() columnDefs: any;
  @Input() defaultColDef: any;
  @Input() gridOptions: any;
  @Input() pagination: any;
  @Input() paginationPageSize: any;
  @Input() cacheBlockSize: any;
  @Input() rowSelection: any;
  @Input() suppressRowClickSelection: any;
}

describe('ActiveSessionsComponent', () => {
  let component: ActiveSessionsComponent;
  let fixture: ComponentFixture<ActiveSessionsComponent>;
  let httpTesting: HttpTestingController;

  const mockSummary = {
    data: {
      totalActive: 234,
      bySessionType: { WEB: 150, API: 60, MOBILE: 20, SSO: 4 },
      peakToday: 312
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveSessionsComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .overrideComponent(ActiveSessionsComponent, {
      remove: { imports: [TranslatePipe, AgGridAngular] },
      add: { imports: [MockTranslatePipe, MockAgGrid] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ActiveSessionsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const summaryReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/sessions/summary');
    summaryReq.flush(mockSummary);
    expect(component).toBeTruthy();
  });

  it('should define ag-Grid columns', () => {
    fixture.detectChanges();
    const summaryReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/sessions/summary');
    summaryReq.flush(mockSummary);

    expect(component.columnDefs.length).toBeGreaterThan(0);

    const fieldNames = component.columnDefs.map(c => c.field);
    expect(fieldNames).toContain('sessionId');
    expect(fieldNames).toContain('accountLoginId');
    expect(fieldNames).toContain('displayName');
    expect(fieldNames).toContain('sessionType');
    expect(fieldNames).toContain('authMethodsUsed');
    expect(fieldNames).toContain('acrLevel');
    expect(fieldNames).toContain('ipAddress');
    expect(fieldNames).toContain('userAgent');
    expect(fieldNames).toContain('createdAt');
    expect(fieldNames).toContain('lastActivityAt');
    expect(fieldNames).toContain('expiresAt');
  });

  it('should load summary stats', fakeAsync(() => {
    fixture.detectChanges();
    const summaryReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/sessions/summary');
    summaryReq.flush(mockSummary);
    tick();

    expect(component.summary).toBeTruthy();
    expect(component.summary!.totalActive).toBe(234);
    expect(component.summary!.peakToday).toBe(312);
    expect(component.sessionTypeEntries.length).toBe(4);
    expect(component.sessionTypeEntries.find(e => e.type === 'WEB')!.count).toBe(150);
    expect(component.sessionTypeEntries.find(e => e.type === 'API')!.count).toBe(60);
  }));

  it('should handle force logout action', fakeAsync(() => {
    fixture.detectChanges();
    const summaryReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/sessions/summary');
    summaryReq.flush(mockSummary);
    tick();

    component.forceLogout('session-abc-123');

    const deleteReq = httpTesting.expectOne(req =>
      req.method === 'DELETE' && req.url === '/api/v1/admin/sessions/session-abc-123'
    );
    deleteReq.flush({ data: null });

    // After force logout, summary should be reloaded (via refreshGrid -> loadSummary)
    // Since gridApi is not initialized (mock ag-Grid), only loadSummary fires
    const summaryReload = httpTesting.expectOne(req => req.url === '/api/v1/admin/sessions/summary');
    summaryReload.flush(mockSummary);
    tick();

    expect(component).toBeTruthy();
  }));
});
