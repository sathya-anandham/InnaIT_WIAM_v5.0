import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { UserCreateComponent } from './user-create.component';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

const mockAuthState = {
  token: 'mock-token',
  user: { id: 'admin-1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
};

describe('UserCreateComponent', () => {
  let component: UserCreateComponent;
  let fixture: ComponentFixture<UserCreateComponent>;
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
        UserCreateComponent,
        NoopAnimationsModule,
        ReactiveFormsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
        { provide: 'AuthService', useValue: mockAuthService },
      ],
    })
      .overrideComponent(UserCreateComponent, {
        remove: { imports: [MockTranslatePipe as any] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserCreateComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    // Trigger ngOnInit which loads departments, roles, groups
    fixture.detectChanges();

    // Flush the initial loading requests
    const deptReq = httpMock.match('/api/v1/admin/departments');
    deptReq.forEach((req) => req.flush({ data: [] }));
    const rolesReq = httpMock.match('/api/v1/admin/roles');
    rolesReq.forEach((req) => req.flush({ data: [] }));
    const groupsReq = httpMock.match('/api/v1/admin/groups');
    groupsReq.forEach((req) => req.flush({ data: [] }));
  });

  afterEach(() => {
    httpMock.verify();
    component.ngOnDestroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should start at step 1 (profile)', () => {
    expect(component.currentStep).toBe(0);
    expect(component.wizardSteps.length).toBe(5);
    expect(component.wizardSteps[0].label).toBe('Profile');
  });

  it('should validate required fields on step 1 (firstName, lastName, email)', () => {
    // Profile form should exist
    expect(component.profileForm).toBeDefined();

    // All required fields should be initially empty/invalid
    const firstName = component.profileForm.get('firstName');
    const lastName = component.profileForm.get('lastName');
    const email = component.profileForm.get('email');

    expect(firstName).toBeTruthy();
    expect(lastName).toBeTruthy();
    expect(email).toBeTruthy();

    // Mark all as touched to trigger validation display
    component.profileForm.markAllAsTouched();

    // Assert invalid when empty
    expect(firstName!.hasError('required')).toBeTrue();
    expect(lastName!.hasError('required')).toBeTrue();
    expect(email!.hasError('required')).toBeTrue();

    // Fill in valid values
    firstName!.setValue('John');
    lastName!.setValue('Doe');
    email!.setValue('john.doe@example.com');

    expect(firstName!.valid).toBeTrue();
    expect(lastName!.valid).toBeTrue();
    expect(email!.valid).toBeTrue();

    // Test invalid email
    email!.setValue('not-an-email');
    expect(email!.hasError('email')).toBeTrue();
  });

  it('should auto-generate loginId from email on step 2', fakeAsync(() => {
    // The email watcher auto-generates loginId from email
    const emailControl = component.profileForm.get('email');
    const loginIdControl = component.accountForm.get('loginId');

    expect(loginIdControl).toBeTruthy();

    // loginId should not be dirty (so auto-generation kicks in)
    loginIdControl!.markAsPristine();

    // Set email
    emailControl!.setValue('john.doe@example.com');
    tick();

    // loginId should be auto-generated
    expect(loginIdControl!.value).toBe('john.doe');
  }));

  it('should advance through all 5 steps', fakeAsync(() => {
    // Fill in step 1 (Profile)
    component.profileForm.patchValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      userType: 'EMPLOYEE',
    });

    expect(component.currentStep).toBe(0);

    // Call nextStep -- triggers server validation then advances
    component.nextStep();

    // Flush the server-side validation request
    const validateReq1 = httpMock.expectOne('/api/v1/admin/users/validate-step');
    expect(validateReq1.request.body.step).toBe(0);
    validateReq1.flush({ data: { valid: true, errors: {} } });
    tick();

    expect(component.currentStep).toBe(1);

    // Step 2 (Account) - loginId should be auto-set
    component.accountForm.patchValue({
      loginId: 'john.doe',
      passwordOption: 'AUTO_GENERATE',
      accountStatus: 'ACTIVE',
    });

    component.nextStep();
    const validateReq2 = httpMock.expectOne('/api/v1/admin/users/validate-step');
    validateReq2.flush({ data: { valid: true, errors: {} } });
    tick();

    expect(component.currentStep).toBe(2);

    // Step 3 (Credentials) - defaults are fine
    component.nextStep();
    const validateReq3 = httpMock.expectOne('/api/v1/admin/users/validate-step');
    validateReq3.flush({ data: { valid: true, errors: {} } });
    tick();

    expect(component.currentStep).toBe(3);

    // Step 4 (Roles & Groups) - optional
    component.nextStep();
    const validateReq4 = httpMock.expectOne('/api/v1/admin/users/validate-step');
    validateReq4.flush({ data: { valid: true, errors: {} } });
    tick();

    expect(component.currentStep).toBe(4);
  }));

  it('should show review summary on step 5', fakeAsync(() => {
    // Set up form data that would appear in review
    component.profileForm.patchValue({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      userType: 'EMPLOYEE',
    });

    component.accountForm.patchValue({
      loginId: 'jane.smith',
      passwordOption: 'AUTO_GENERATE',
      mustChangePassword: true,
      accountStatus: 'ACTIVE',
    });

    // Jump directly to step 5 (review)
    component.goToStep(4);
    expect(component.currentStep).toBe(4);

    // Review data should be accessible from the forms
    expect(component.profileForm.get('firstName')!.value).toBe('Jane');
    expect(component.profileForm.get('lastName')!.value).toBe('Smith');
    expect(component.profileForm.get('email')!.value).toBe('jane.smith@example.com');
    expect(component.accountForm.get('loginId')!.value).toBe('jane.smith');
    expect(component.accountForm.get('passwordOption')!.value).toBe('AUTO_GENERATE');
  }));

  it('should submit user creation and show success', fakeAsync(() => {
    // Fill required fields
    component.profileForm.patchValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      userType: 'EMPLOYEE',
    });
    component.accountForm.patchValue({
      loginId: 'john.doe',
      passwordOption: 'AUTO_GENERATE',
      mustChangePassword: true,
      accountStatus: 'ACTIVE',
    });

    // Go to review step
    component.goToStep(4);
    expect(component.currentStep).toBe(4);

    // Submit
    component.submitUser();
    expect(component.submitting).toBeTrue();

    const req = httpMock.expectOne('/api/v1/admin/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.profile.firstName).toBe('John');
    expect(req.request.body.profile.email).toBe('john.doe@example.com');
    expect(req.request.body.account.loginId).toBe('john.doe');

    req.flush({
      data: {
        userId: 'user-new-123',
        loginId: 'john.doe',
        displayName: 'John Doe',
      },
    });
    tick();

    expect(component.submitting).toBeFalse();
    expect(component.submitSuccess).toBeTrue();
    expect(component.createdUser).toBeTruthy();
    expect(component.createdUser!.userId).toBe('user-new-123');
    expect(component.createdUser!.displayName).toBe('John Doe');
  }));
});
