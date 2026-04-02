import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslatePipe } from '@innait/i18n';
import { AgGridAngular } from 'ag-grid-angular';
import { AuthService } from '@innait/core';
import { EntitlementCatalogComponent } from './entitlement-catalog.component';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Component({ selector: 'ag-grid-angular', standalone: true, template: '' })
class MockAgGrid {
  @Input() rowModelType: any;
  @Input() columnDefs: any;
  @Input() defaultColDef: any;
  @Input() rowSelection: any;
  @Input() serverSideStoreType: any;
  @Input() pagination: any;
  @Input() paginationPageSize: any;
  @Input() cacheBlockSize: any;
  @Input() animateRows: any;
  @Input() overlayLoadingTemplate: any;
  @Input() overlayNoRowsTemplate: any;
}

describe('EntitlementCatalogComponent', () => {
  let component: EntitlementCatalogComponent;
  let fixture: ComponentFixture<EntitlementCatalogComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);
  const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        EntitlementCatalogComponent,
        ReactiveFormsModule,
        FormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(EntitlementCatalogComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .overrideComponent(EntitlementCatalogComponent, {
        remove: { imports: [AgGridAngular] },
        add: { imports: [MockAgGrid] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(EntitlementCatalogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.entForm).toBeDefined();
  });

  it('should define ag-Grid columns with action color badges', () => {
    expect(component.activeColumnDefs).toBeDefined();
    expect(component.activeColumnDefs.length).toBeGreaterThan(0);

    // Verify key field columns exist
    const fieldNames = component.activeColumnDefs
      .filter((col) => col.field)
      .map((col) => col.field);

    expect(fieldNames).toContain('entitlementName');
    expect(fieldNames).toContain('entitlementCode');
    expect(fieldNames).toContain('resource');
    expect(fieldNames).toContain('action');
    expect(fieldNames).toContain('status');

    // Verify the action column has a cellRenderer for badge rendering
    const actionCol = component.activeColumnDefs.find((col) => col.field === 'action');
    expect(actionCol).toBeDefined();
    expect(actionCol!.cellRenderer).toBeDefined();

    // Test the cellRenderer produces badge HTML
    if (typeof actionCol!.cellRenderer === 'function') {
      const result = actionCol!.cellRenderer({ value: 'READ' } as any);
      expect(result).toContain('action-cell-badge');
      expect(result).toContain('action-read');
      expect(result).toContain('READ');
    }
  });

  it('should open create entitlement dialog', () => {
    expect(component.entDialog.visible).toBeFalse();

    component.openCreateDialog();

    expect(component.entDialog.visible).toBeTrue();
    expect(component.entDialog.mode).toBe('create');
    expect(component.entDialog.submitting).toBeFalse();
    expect(component.entDialog.error).toBe('');
    // Form should be reset
    expect(component.entForm.get('entitlementName')?.value).toBe('');
    expect(component.entForm.get('statusActive')?.value).toBeTrue();
  });

  it('should delete entitlement with confirmation', () => {
    const mockEntitlement = {
      id: 'ent-001',
      entitlementName: 'View Users',
      entitlementCode: 'VIEW_USERS',
      resource: 'users',
      action: 'READ',
      status: 'ACTIVE',
    } as any;

    // Open delete dialog
    component.openDeleteDialog(mockEntitlement);

    expect(component.deleteDialog.visible).toBeTrue();
    expect(component.deleteDialog.entitlementId).toBe('ent-001');
    expect(component.deleteDialog.entitlementName).toBe('View Users');

    // Execute delete
    component.executeDelete();

    const req = httpTesting.expectOne('/api/v1/admin/entitlements/ent-001');
    expect(req.request.method).toBe('DELETE');

    req.flush({ data: null });

    expect(component.deleteDialog.visible).toBeFalse();
  });
});
