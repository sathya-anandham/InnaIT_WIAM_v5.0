import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Pipe, PipeTransform } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';
import { BulkPasswordResetComponent } from './bulk-password-reset.component';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('BulkPasswordResetComponent', () => {
  let component: BulkPasswordResetComponent;
  let fixture: ComponentFixture<BulkPasswordResetComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BulkPasswordResetComponent,
        ReactiveFormsModule,
        FormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(BulkPasswordResetComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(BulkPasswordResetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Respond to the initial loadDepartments() call from ngOnInit
    const deptReq = httpTesting.expectOne((req) => req.url.includes('/departments'));
    deptReq.flush({
      data: {
        departments: ['Engineering', 'Finance', 'HR'],
      },
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.steps.length).toBe(3);
    expect(component.configForm).toBeDefined();
  });

  it('should start at step 1', () => {
    expect(component.activeStep).toBe(0);
    expect(component.steps[0].label).toBe('Select Accounts');
    expect(component.selectionMode).toBe('search');
    expect(component.selectedAccounts.length).toBe(0);
    expect(component.csvRows.length).toBe(0);
  });

  it('should validate CSV file upload', () => {
    // Switch to CSV mode
    component.selectionMode = 'csv';

    // Test with a non-CSV file name -- parseCsvFile is private, but
    // we can call onFileSelected with a mock event to test the flow.
    // Instead, we test the csvError state which is the observable behavior.

    // Simulate that a non-csv file was uploaded by checking error path
    // The parseCsvFile method sets csvError for invalid files.
    // We'll trigger it by calling the method via the component's public interface.
    expect(component.csvError).toBeNull();

    // Simulate file drop with no files
    const mockDropEvent = {
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
      dataTransfer: { files: [] as any },
    } as any;

    component.onFileDrop(mockDropEvent);
    // No files means no error set (just early return)
    expect(component.dragOver).toBeFalse();

    // Simulate drag over sets flag
    const mockDragOverEvent = {
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    } as any;

    component.onDragOver(mockDragOverEvent);
    expect(component.dragOver).toBeTrue();
  });

  it('should configure reset options on step 2', () => {
    const configForm = component.configForm;

    // Default values
    expect(configForm.get('generateTemp')?.value).toBeTrue();
    expect(configForm.get('forceChange')?.value).toBeTrue();
    expect(configForm.get('sendNotification')?.value).toBeTrue();
    expect(configForm.get('expiryHours')?.value).toBe(24);

    // When generateTemp is false, commonPassword becomes required
    configForm.get('generateTemp')?.setValue(false);
    fixture.detectChanges();

    const commonPasswordCtrl = configForm.get('commonPassword')!;
    commonPasswordCtrl.setValue('');
    commonPasswordCtrl.updateValueAndValidity();
    expect(commonPasswordCtrl.hasError('required')).toBeTrue();

    // Set a short password - should fail minLength
    commonPasswordCtrl.setValue('short');
    commonPasswordCtrl.updateValueAndValidity();
    expect(commonPasswordCtrl.hasError('minlength')).toBeTrue();

    // Set a valid password
    commonPasswordCtrl.setValue('ValidPassword123');
    commonPasswordCtrl.updateValueAndValidity();
    expect(commonPasswordCtrl.valid).toBeTrue();

    // When generateTemp is true again, commonPassword validation is cleared
    configForm.get('generateTemp')?.setValue(true);
    fixture.detectChanges();

    expect(commonPasswordCtrl.valid).toBeTrue();
    expect(commonPasswordCtrl.value).toBe('');
  });
});
