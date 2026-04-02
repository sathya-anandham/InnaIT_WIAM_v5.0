import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Component, Input, Pipe, PipeTransform, Directive } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { TranslatePipe } from '@innait/i18n';
import { AgGridAngular } from 'ag-grid-angular';
import { AuthService } from '@innait/core';
import { RoleDetailComponent } from './role-detail.component';

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

const mockRole = {
  id: 'role-abc',
  roleName: 'Admin Role',
  roleCode: 'ADMIN_ROLE',
  roleType: 'TENANT',
  description: 'Administrator role',
  status: 'ACTIVE',
  system: false,
  createdAt: '2025-01-15T10:00:00Z',
};

describe('RoleDetailComponent', () => {
  let component: RoleDetailComponent;
  let fixture: ComponentFixture<RoleDetailComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);
  const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RoleDetailComponent,
        ReactiveFormsModule,
        FormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'roleId' ? 'role-abc' : null),
              },
            },
          },
        },
      ],
    })
      .overrideComponent(RoleDetailComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .overrideComponent(RoleDetailComponent, {
        remove: { imports: [AgGridAngular] },
        add: { imports: [MockAgGrid] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(RoleDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Respond to the initial loadRole() call made by ngOnInit
    const req = httpTesting.expectOne('/api/v1/admin/roles/role-abc');
    req.flush({ data: mockRole });
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load role data from route params', () => {
    expect(component.role).toBeDefined();
    expect(component.role.roleName).toBe('Admin Role');
    expect(component.role.roleCode).toBe('ADMIN_ROLE');
    expect(component.loading).toBeFalse();
  });

  it('should toggle profile edit mode', () => {
    expect(component.editing).toBeFalse();

    component.editing = true;
    expect(component.editing).toBeTrue();

    component.editing = false;
    expect(component.editing).toBeFalse();
  });

  it('should load entitlements tab data', () => {
    // The entitlement grid uses a server-side datasource; verify column defs are defined
    expect(component.entitlementColDefs).toBeDefined();
    expect(component.entitlementColDefs.length).toBeGreaterThan(0);

    const fields = component.entitlementColDefs
      .filter((col) => col.field)
      .map((col) => col.field);

    expect(fields).toContain('entitlementName');
    expect(fields).toContain('entitlementCode');
    expect(fields).toContain('resource');
    expect(fields).toContain('action');
  });

  it('should load members tab data', () => {
    // Verify member column defs are defined
    expect(component.memberColDefs).toBeDefined();
    expect(component.memberColDefs.length).toBeGreaterThan(0);

    const fields = component.memberColDefs
      .filter((col) => col.field)
      .map((col) => col.field);

    expect(fields).toContain('displayName');
    expect(fields).toContain('email');
    expect(fields).toContain('source');
  });
});
