import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { Pipe, PipeTransform } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';
import { RoleCreateComponent } from './role-create.component';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('RoleCreateComponent', () => {
  let component: RoleCreateComponent;
  let fixture: ComponentFixture<RoleCreateComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);
  const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RoleCreateComponent,
        ReactiveFormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(RoleCreateComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(RoleCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.roleForm).toBeDefined();
  });

  it('should auto-generate roleCode from roleName', () => {
    component.roleForm.get('roleName')?.setValue('Account Manager');

    const roleCode = component.roleForm.get('roleCode')?.value;
    expect(roleCode).toBe('ACCOUNT_MANAGER');
  });

  it('should validate roleCode pattern (uppercase + underscore only)', () => {
    const roleCodeCtrl = component.roleForm.get('roleCode')!;

    // Valid values
    roleCodeCtrl.setValue('VALID_CODE');
    expect(roleCodeCtrl.valid).toBeTrue();

    roleCodeCtrl.setValue('SINGLE');
    expect(roleCodeCtrl.valid).toBeTrue();

    // Invalid values
    roleCodeCtrl.setValue('invalid_code');
    expect(roleCodeCtrl.hasError('pattern')).toBeTrue();

    roleCodeCtrl.setValue('HAS SPACES');
    expect(roleCodeCtrl.hasError('pattern')).toBeTrue();

    roleCodeCtrl.setValue('HAS-DASHES');
    expect(roleCodeCtrl.hasError('pattern')).toBeTrue();

    // Empty is required error, not pattern
    roleCodeCtrl.setValue('');
    expect(roleCodeCtrl.hasError('required')).toBeTrue();
  });

  it('should submit role creation and navigate on success', () => {
    // Fill out the form with valid data
    component.roleForm.patchValue({
      roleName: 'Test Role',
      roleCode: 'TEST_ROLE',
      roleType: 'TENANT',
      description: 'A test role',
      statusActive: true,
    });

    expect(component.roleForm.valid).toBeTrue();

    component.onSubmit();

    const req = httpTesting.expectOne('/api/v1/admin/roles');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.roleName).toBe('Test Role');
    expect(req.request.body.roleCode).toBe('TEST_ROLE');
    expect(req.request.body.status).toBe('ACTIVE');

    req.flush({
      data: { id: 'new-role-id', roleName: 'Test Role' },
    });

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/roles', 'new-role-id']);
  });
});
