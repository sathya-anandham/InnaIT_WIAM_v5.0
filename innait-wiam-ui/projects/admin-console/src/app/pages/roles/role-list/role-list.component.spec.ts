import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';
import { RoleListComponent } from './role-list.component';

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
  @Input() suppressRowClickSelection: any;
  @Input() animateRows: any;
  @Input() overlayLoadingTemplate: any;
  @Input() overlayNoRowsTemplate: any;
}

describe('RoleListComponent', () => {
  let component: RoleListComponent;
  let fixture: ComponentFixture<RoleListComponent>;
  let httpTesting: HttpTestingController;
  let router: Router;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);
  const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RoleListComponent,
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
      .overrideComponent(RoleListComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .overrideComponent(RoleListComponent, {
        remove: { imports: [require('ag-grid-angular').AgGridAngular] },
        add: { imports: [MockAgGrid] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(RoleListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should define ag-Grid column definitions', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);

    const fieldNames = component.columnDefs
      .filter((col) => col.field)
      .map((col) => col.field);

    expect(fieldNames).toContain('roleName');
    expect(fieldNames).toContain('roleCode');
    expect(fieldNames).toContain('roleType');
    expect(fieldNames).toContain('status');
    expect(fieldNames).toContain('createdAt');
  });

  it('should apply filters and refresh grid', () => {
    // Set up a mock gridApi
    const mockGridApi = jasmine.createSpyObj('GridApi', ['setServerSideDatasource', 'getSelectedRows']);
    (component as any).gridApi = mockGridApi;

    // Toggle filter values
    component.toggleFilter('statuses', 'ACTIVE');
    expect(component.filters.statuses).toContain('ACTIVE');

    component.toggleFilter('roleTypes', 'SYSTEM');
    expect(component.filters.roleTypes).toContain('SYSTEM');

    // Apply filters should refresh the grid
    component.applyFilters();
    expect(mockGridApi.setServerSideDatasource).toHaveBeenCalled();

    // Clear filters should reset and refresh
    component.clearFilters();
    expect(component.filters.statuses.length).toBe(0);
    expect(component.filters.roleTypes.length).toBe(0);
    expect(component.searchTerm).toBe('');
  });

  it('should navigate to role detail on row click', () => {
    const mockEvent = {
      data: { id: 'role-123' },
      event: {
        target: document.createElement('div'),
      },
    } as any;

    component.onRowClicked(mockEvent);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/roles', 'role-123']);
  });
});
