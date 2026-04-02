import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { UserListComponent } from './user-list.component';

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
  @Input() animateRows: any;
  @Input() pagination: any;
  @Input() paginationPageSize: any;
  @Input() cacheBlockSize: any;
  @Input() suppressRowClickSelection: any;
  @Input() overlayLoadingTemplate: any;
  @Input() overlayNoRowsTemplate: any;
  @Input() serverSideStoreType: any;
  gridApi: any;
}

const mockAuthState = {
  token: 'mock-token',
  user: { id: 'admin-1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
};

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    const mockRouter = {
      navigate: jasmine.createSpy('navigate'),
    };

    const mockAuthService = {
      getAuthState: () => of(mockAuthState),
      get currentState() { return mockAuthState; },
      get isAuthenticated() { return true; },
    };

    await TestBed.configureTestingModule({
      imports: [
        UserListComponent,
        NoopAnimationsModule,
        FormsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
        { provide: 'AuthService', useValue: mockAuthService },
      ],
    })
      .overrideComponent(UserListComponent, {
        remove: { imports: [MockTranslatePipe as any] },
        add: { imports: [MockTranslatePipe] },
      })
      .overrideComponent(UserListComponent, {
        set: {
          imports: [
            FormsModule,
            MockTranslatePipe,
            MockAgGrid,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should set up ag-Grid column definitions', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);

    const fieldNames = component.columnDefs
      .filter((col) => col.field)
      .map((col) => col.field);

    expect(fieldNames).toContain('displayName');
    expect(fieldNames).toContain('email');
    expect(fieldNames).toContain('status');
    expect(fieldNames).toContain('userType');
    expect(fieldNames).toContain('department');
    expect(fieldNames).toContain('lastLoginAt');
    expect(fieldNames).toContain('createdAt');

    // Verify default column def
    expect(component.defaultColDef).toBeDefined();
    expect(component.defaultColDef.resizable).toBeTrue();
  });

  it('should debounce search input at 400ms', fakeAsync(() => {
    fixture.detectChanges();

    // Mock the gridApi so refreshGrid doesn't fail
    (component as any).gridApi = {
      purgeServerSideCache: jasmine.createSpy('purgeServerSideCache'),
    };

    // Trigger multiple search terms rapidly
    component.onSearchTermChange('j');
    tick(100);
    component.onSearchTermChange('jo');
    tick(100);
    component.onSearchTermChange('joh');
    tick(100);
    component.onSearchTermChange('john');
    tick(400);

    // Only the last value should have been applied after debounce
    expect(component.filters.search).toBe('john');
    expect((component as any).gridApi.purgeServerSideCache).toHaveBeenCalledTimes(1);

    // Cleanup subscriptions
    component.ngOnDestroy();
  }));

  it('should apply filters and refresh grid', () => {
    fixture.detectChanges();

    // Mock gridApi
    const mockGridApi = {
      purgeServerSideCache: jasmine.createSpy('purgeServerSideCache'),
    };
    (component as any).gridApi = mockGridApi;

    // Set some filters
    component.filters.statuses = ['ACTIVE'];
    component.filters.userTypes = ['EMPLOYEE'];
    component.filters.department = 'Engineering';

    // Apply filters
    component.applyFilters();

    expect(mockGridApi.purgeServerSideCache).toHaveBeenCalled();

    // Clear filters
    component.clearFilters();

    expect(component.filters.search).toBe('');
    expect(component.filters.statuses).toEqual([]);
    expect(component.filters.userTypes).toEqual([]);
    expect(component.filters.department).toBe('');
    expect(component.searchTerm).toBe('');
    expect(mockGridApi.purgeServerSideCache).toHaveBeenCalledTimes(2);

    // Cleanup
    component.ngOnDestroy();
  });

  it('should navigate to user detail on row click', () => {
    fixture.detectChanges();

    const mockEvent = {
      data: { id: 'user-456' },
      event: {
        target: document.createElement('div'),
      },
    } as any;

    component.onRowClicked(mockEvent);

    expect(router.navigate).toHaveBeenCalledWith(['/users', 'user-456']);

    // Cleanup
    component.ngOnDestroy();
  });

  it('should handle bulk export as CSV', () => {
    fixture.detectChanges();

    // Set up filters to verify they are included in export
    component.filters.search = 'test';
    component.filters.statuses = ['ACTIVE'];

    component.exportUsers('csv');

    const req = httpMock.expectOne((r) =>
      r.url === '/api/v1/admin/users/export' &&
      r.params.get('format') === 'csv' &&
      r.params.get('search') === 'test' &&
      r.params.get('status') === 'ACTIVE',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');

    // Respond with a blob
    req.flush(new Blob(['id,name\n1,John'], { type: 'text/csv' }), {
      headers: { 'Content-Disposition': 'attachment; filename="users-export.csv"' },
    });

    // Export menu should be closed
    expect(component.exportMenuOpen).toBeFalse();

    // Cleanup
    component.ngOnDestroy();
  });
});
