import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Pipe, PipeTransform, Component, Input } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BackupCodeFormComponent } from './backup-code-form.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

@Component({ selector: 'app-login-layout', standalone: true, template: '<ng-content />' })
class MockLoginLayoutComponent {
  @Input() title = '';
  @Input() subtitle = '';
}

describe('BackupCodeFormComponent', () => {
  let component: BackupCodeFormComponent;
  let fixture: ComponentFixture<BackupCodeFormComponent>;
  let router: Router;

  const mockAuthService = {
    currentState: {
      status: 'AUTHENTICATING',
      txnId: 'txn-123',
      accountId: 'acc-123',
      loginId: 'testuser',
      roles: [],
      groups: [],
      amr: [],
      acr: '',
      availableMfaMethods: ['TOTP', 'FIDO', 'SOFT_TOKEN', 'BACKUP_CODE'],
    },
    submitMfa: jasmine.createSpy('submitMfa'),
    isAuthenticated: true,
    getAuthState: jasmine.createSpy('getAuthState').and.returnValue(
      of({ status: 'AUTHENTICATED', roles: [], groups: [], amr: [], acr: '' })
    ),
    clearState: jasmine.createSpy('clearState'),
  };

  beforeEach(async () => {
    mockAuthService.submitMfa.calls.reset();
    mockAuthService.currentState.txnId = 'txn-123';

    await TestBed.configureTestingModule({
      imports: [BackupCodeFormComponent],
    })
      .overrideComponent(BackupCodeFormComponent, {
        set: {
          imports: [
            (await import('@angular/common')).CommonModule,
            ReactiveFormsModule,
            (await import('primeng/inputtext')).InputTextModule,
            (await import('primeng/button')).ButtonModule,
            MockLoginLayoutComponent,
            MockTranslatePipe,
          ],
          providers: [
            { provide: (await import('@innait/core')).AuthService, useValue: mockAuthService },
          ],
        },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(BackupCodeFormComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should redirect to /login if no txnId', () => {
    mockAuthService.currentState.txnId = undefined as any;
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should show validation error for empty code', () => {
    fixture.detectChanges();
    const backupCodeControl = component.form.get('backupCode')!;
    backupCodeControl.setValue('');
    backupCodeControl.markAsTouched();
    fixture.detectChanges();

    expect(backupCodeControl.hasError('required')).toBeTrue();
    const compiled = fixture.nativeElement as HTMLElement;
    const errorEl = compiled.querySelector('.p-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl!.textContent).toContain('common.required');
  });

  it('should show validation error for code shorter than 8 chars', () => {
    fixture.detectChanges();
    const backupCodeControl = component.form.get('backupCode')!;
    backupCodeControl.setValue('ABC1');
    backupCodeControl.markAsTouched();
    fixture.detectChanges();

    expect(backupCodeControl.hasError('minlength')).toBeTrue();
    const compiled = fixture.nativeElement as HTMLElement;
    const errorMessages = compiled.querySelectorAll('.p-error');
    const minLengthError = Array.from(errorMessages).find(el =>
      el.textContent?.includes('at least 8 characters')
    );
    expect(minLengthError).toBeTruthy();
  });

  it('should call submitMfa with BACKUP_CODE type on submit', fakeAsync(() => {
    mockAuthService.submitMfa.and.returnValue(
      of({ status: 'AUTHENTICATED', txnId: 'txn-123' })
    );
    fixture.detectChanges();

    component.form.get('backupCode')!.setValue('ABCD1234');
    fixture.detectChanges();

    component.onSubmit();
    tick();

    expect(mockAuthService.submitMfa).toHaveBeenCalledWith(
      'txn-123',
      'BACKUP_CODE',
      { code: 'ABCD1234' }
    );
    expect(router.navigate).toHaveBeenCalledWith(['/login/complete']);
  }));

  it('should strip dashes from code before submitting', fakeAsync(() => {
    mockAuthService.submitMfa.and.returnValue(
      of({ status: 'AUTHENTICATED', txnId: 'txn-123' })
    );
    fixture.detectChanges();

    component.form.get('backupCode')!.setValue('ABCD-1234');
    fixture.detectChanges();

    component.onSubmit();
    tick();

    expect(mockAuthService.submitMfa).toHaveBeenCalledWith(
      'txn-123',
      'BACKUP_CODE',
      { code: 'ABCD1234' }
    );
  }));

  it('should show error message on failure', fakeAsync(() => {
    mockAuthService.submitMfa.and.returnValue(
      throwError(() => new Error('Invalid code'))
    );
    fixture.detectChanges();

    component.form.get('backupCode')!.setValue('WRONGCODE');
    fixture.detectChanges();

    component.onSubmit();
    tick();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Invalid backup code. Please try again.');
    const compiled = fixture.nativeElement as HTMLElement;
    const errorEl = compiled.querySelector('p.p-error[role="alert"]');
    expect(errorEl).toBeTruthy();
    expect(errorEl!.textContent).toContain('Invalid backup code');
  }));
});
