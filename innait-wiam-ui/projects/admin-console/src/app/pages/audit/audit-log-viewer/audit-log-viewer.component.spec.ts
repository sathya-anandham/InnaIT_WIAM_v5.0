import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, Input, Pipe, PipeTransform, Directive } from '@angular/core';

import { AuditLogViewerComponent } from './audit-log-viewer.component';
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
  @Input() masterDetail: any;
  @Input() detailCellRendererParams: any;
}

describe('AuditLogViewerComponent', () => {
  let component: AuditLogViewerComponent;
  let fixture: ComponentFixture<AuditLogViewerComponent>;
  let httpTesting: HttpTestingController;

  const mockSummary = {
    data: {
      totalEvents: 15432,
      successRate: 94.5,
      mostCommonEventType: 'LOGIN'
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditLogViewerComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .overrideComponent(AuditLogViewerComponent, {
      remove: { imports: [TranslatePipe, AgGridAngular] },
      add: { imports: [MockTranslatePipe, MockAgGrid] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditLogViewerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const summaryReq = httpTesting.expectOne(req => req.url.includes('/api/v1/admin/audit/summary'));
    summaryReq.flush(mockSummary);
    expect(component).toBeTruthy();
  });

  it('should define ag-Grid columns', () => {
    fixture.detectChanges();
    const summaryReq = httpTesting.expectOne(req => req.url.includes('/api/v1/admin/audit/summary'));
    summaryReq.flush(mockSummary);

    expect(component.columnDefs.length).toBeGreaterThan(0);

    const fieldNames = component.columnDefs.map(c => c.field);
    expect(fieldNames).toContain('timestamp');
    expect(fieldNames).toContain('eventType');
    expect(fieldNames).toContain('category');
    expect(fieldNames).toContain('actorId');
    expect(fieldNames).toContain('outcome');
    expect(fieldNames).toContain('ipAddress');
  });

  it('should apply category filter', fakeAsync(() => {
    fixture.detectChanges();
    const summaryReq = httpTesting.expectOne(req => req.url.includes('/api/v1/admin/audit/summary'));
    summaryReq.flush(mockSummary);
    tick();

    component.onCategoryChange('AUTH');

    // Should load event types for AUTH category
    const eventTypesReq = httpTesting.expectOne(req =>
      req.url.includes('/api/v1/admin/audit/event-types') && req.params.get('category') === 'AUTH'
    );
    eventTypesReq.flush({
      data: [
        { value: 'LOGIN', label: 'Login' },
        { value: 'LOGOUT', label: 'Logout' }
      ]
    });

    // Summary should also reload
    const summaryReload = httpTesting.expectOne(req => req.url.includes('/api/v1/admin/audit/summary'));
    summaryReload.flush(mockSummary);
    tick();

    expect(component.filters.category).toBe('AUTH');
    expect(component.eventTypeOptions.length).toBe(2);
    expect(component.eventTypeOptions[0].value).toBe('LOGIN');
  }));

  it('should export as CSV', fakeAsync(() => {
    fixture.detectChanges();
    const summaryReq = httpTesting.expectOne(req => req.url.includes('/api/v1/admin/audit/summary'));
    summaryReq.flush(mockSummary);
    tick();

    const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
    const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
    const anchorElement = document.createElement('a');
    spyOn(anchorElement, 'click');
    spyOn(document, 'createElement').and.returnValue(anchorElement);

    component.exportCsv();
    expect(component.exporting).toBeTrue();

    const exportReq = httpTesting.expectOne(req =>
      req.url.includes('/api/v1/admin/audit/export') && req.params.get('format') === 'csv'
    );
    exportReq.flush(new Blob(['csv,data'], { type: 'text/csv' }));
    tick();

    expect(component.exporting).toBeFalse();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchorElement.download).toBe('audit-log.csv');
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  }));
});
