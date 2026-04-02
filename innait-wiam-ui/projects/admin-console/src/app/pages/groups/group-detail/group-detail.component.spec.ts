import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslatePipe } from '@innait/i18n';
import { AgGridAngular } from 'ag-grid-angular';
import { AuthService } from '@innait/core';
import { GroupDetailComponent } from './group-detail.component';

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

const mockStaticGroup = {
  id: 'group-abc',
  groupName: 'Engineering Team',
  groupCode: 'ENGINEERING_TEAM',
  groupType: 'STATIC',
  description: 'Engineering department group',
  status: 'ACTIVE',
  dynamicRule: '',
  createdAt: '2025-01-10T08:00:00Z',
};

const mockDynamicGroup = {
  id: 'group-xyz',
  groupName: 'All Engineers',
  groupCode: 'ALL_ENGINEERS',
  groupType: 'DYNAMIC',
  description: 'Dynamic engineering group',
  status: 'ACTIVE',
  dynamicRule: "#user.department == 'Engineering'",
  createdAt: '2025-02-20T12:00:00Z',
};

describe('GroupDetailComponent', () => {
  let component: GroupDetailComponent;
  let fixture: ComponentFixture<GroupDetailComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);
  const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        GroupDetailComponent,
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
                get: (key: string) => (key === 'groupId' ? 'group-abc' : null),
              },
            },
          },
        },
      ],
    })
      .overrideComponent(GroupDetailComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .overrideComponent(GroupDetailComponent, {
        remove: { imports: [AgGridAngular] },
        add: { imports: [MockAgGrid] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(GroupDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Respond to the initial loadGroup() call
    const req = httpTesting.expectOne('/api/v1/admin/groups/group-abc');
    req.flush({ data: mockStaticGroup });
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load group data from route params', () => {
    expect(component.group).toBeDefined();
    expect(component.group.groupName).toBe('Engineering Team');
    expect(component.group.groupCode).toBe('ENGINEERING_TEAM');
    expect(component.group.groupType).toBe('STATIC');
    expect(component.loading).toBeFalse();
  });

  it('should show dynamic rule editor for DYNAMIC groups', () => {
    // Reinitialize with a dynamic group
    // The editForm should have the dynamicRule control
    expect(component.editForm).toBeDefined();

    // Simulate switching group type to DYNAMIC
    component.editForm.get('groupType')?.setValue('DYNAMIC');
    fixture.detectChanges();

    // dynamicRule should now be required
    const dynamicRuleCtrl = component.editForm.get('dynamicRule')!;
    dynamicRuleCtrl.setValue('');
    dynamicRuleCtrl.updateValueAndValidity();

    expect(dynamicRuleCtrl.hasError('required')).toBeTrue();

    // Set a valid rule
    dynamicRuleCtrl.setValue("#user.department == 'Engineering'");
    expect(dynamicRuleCtrl.valid).toBeTrue();
  });

  it('should load members tab', () => {
    // Verify that member column defs are built after group loads
    expect(component.memberColDefs).toBeDefined();
    expect(component.memberColDefs.length).toBeGreaterThan(0);

    const fields = component.memberColDefs
      .filter((col) => col.field)
      .map((col) => col.field);

    expect(fields).toContain('displayName');
    expect(fields).toContain('email');
    expect(fields).toContain('joinedAt');

    // For STATIC groups, there should be an Actions column
    const actionsCol = component.memberColDefs.find((col) => col.headerName === 'Actions');
    expect(actionsCol).toBeDefined();
  });
});
