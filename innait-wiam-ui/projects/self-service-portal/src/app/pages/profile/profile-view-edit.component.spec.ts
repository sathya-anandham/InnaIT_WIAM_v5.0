import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { ProfileViewEditComponent } from './profile-view-edit.component';

// ---------- Mock TranslatePipe ----------
@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

// ---------- Mock auth state ----------
const mockAuthState = {
  status: 'AUTHENTICATED',
  roles: [],
  groups: [],
  amr: ['PASSWORD'],
  acr: 'urn:innait:acr:basic',
  userId: 'user-1',
  accountId: 'acc-1',
  displayName: 'Test User',
  sessionId: 'sess-1',
};

// ---------- Mock user profile ----------
const mockUser = {
  id: 'user-1',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test User',
  email: 'test@example.com',
  employeeNo: 'EMP-001',
  department: 'Engineering',
  designation: 'Software Engineer',
  locale: 'en',
  timezone: 'Asia/Kolkata',
};

const updatedUser = {
  ...mockUser,
  firstName: 'Updated',
  lastName: 'Name',
  displayName: 'Updated Name',
};

describe('ProfileViewEditComponent', () => {
  let component: ProfileViewEditComponent;
  let fixture: ComponentFixture<ProfileViewEditComponent>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ProfileViewEditComponent,
        MockTranslatePipe,
        ReactiveFormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    })
      .overrideComponent(ProfileViewEditComponent, {
        set: {
          imports: [
            ReactiveFormsModule,
            MockTranslatePipe,
            NoopAnimationsModule,
          ],
        },
      })
      .compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfileViewEditComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  /** Helper: flush the initial GET /profile request */
  function flushProfileLoad(): void {
    const req = httpTestingController.expectOne('/api/v1/self/profile');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockUser });
    fixture.detectChanges();
  }

  it('should create the component', () => {
    fixture.detectChanges();
    flushProfileLoad();
    expect(component).toBeTruthy();
  });

  it('should load and display user profile in view mode', () => {
    fixture.detectChanges();
    flushProfileLoad();

    expect(component.loading).toBeFalse();
    expect(component.editMode).toBeFalse();
    expect(component.user).toBeTruthy();
    expect(component.user!.firstName).toBe('Test');

    const compiled = fixture.nativeElement as HTMLElement;
    const fieldValues = compiled.querySelectorAll('.field-value');
    const textContents = Array.from(fieldValues).map((el) => el.textContent?.trim());
    expect(textContents).toContain('Test');
    expect(textContents).toContain('User');
    expect(textContents).toContain('test@example.com');
  });

  it('should switch to edit mode when edit button is clicked', () => {
    fixture.detectChanges();
    flushProfileLoad();

    expect(component.editMode).toBeFalse();

    // Simulate clicking the edit button
    component.enableEdit();
    fixture.detectChanges();

    expect(component.editMode).toBeTrue();

    // Form should be populated with user data
    expect(component.profileForm.get('firstName')?.value).toBe('Test');
    expect(component.profileForm.get('lastName')?.value).toBe('User');
    expect(component.profileForm.get('email')?.value).toBe('test@example.com');
  });

  it('should validate firstName as required with minLength(2)', () => {
    fixture.detectChanges();
    flushProfileLoad();

    component.enableEdit();
    fixture.detectChanges();

    const firstNameCtrl = component.profileForm.get('firstName')!;

    // Set empty value
    firstNameCtrl.setValue('');
    firstNameCtrl.markAsTouched();
    expect(firstNameCtrl.hasError('required')).toBeTrue();

    // Set value with only 1 char
    firstNameCtrl.setValue('A');
    expect(firstNameCtrl.hasError('minlength')).toBeTrue();

    // Set valid value
    firstNameCtrl.setValue('Al');
    expect(firstNameCtrl.valid).toBeTrue();
  });

  it('should save profile changes via PUT and return to view mode', () => {
    fixture.detectChanges();
    flushProfileLoad();

    component.enableEdit();
    fixture.detectChanges();

    // Make changes
    component.profileForm.get('firstName')!.setValue('Updated');
    component.profileForm.get('lastName')!.setValue('Name');
    component.profileForm.markAsDirty();
    fixture.detectChanges();

    // Trigger save
    component.saveProfile();

    const req = httpTestingController.expectOne('/api/v1/self/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.firstName).toBe('Updated');
    expect(req.request.body.lastName).toBe('Name');

    req.flush({ data: updatedUser });
    fixture.detectChanges();

    expect(component.editMode).toBeFalse();
    expect(component.saving).toBeFalse();
    expect(component.user!.firstName).toBe('Updated');
  });

  it('should cancel edit and revert to view mode', () => {
    fixture.detectChanges();
    flushProfileLoad();

    component.enableEdit();
    fixture.detectChanges();

    // Modify form values
    component.profileForm.get('firstName')!.setValue('Changed');
    fixture.detectChanges();

    // Cancel
    component.cancelEdit();
    fixture.detectChanges();

    expect(component.editMode).toBeFalse();
    // Form should be reverted to original user values
    expect(component.profileForm.get('firstName')!.value).toBe('Test');
  });
});
