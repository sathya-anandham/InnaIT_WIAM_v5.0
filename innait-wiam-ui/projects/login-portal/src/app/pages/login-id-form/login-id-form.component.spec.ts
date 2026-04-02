import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';
import { of, throwError } from 'rxjs';

import { LoginIdFormComponent } from './login-id-form.component';
import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('LoginIdFormComponent', () => {
  let component: LoginIdFormComponent;
  let fixture: ComponentFixture<LoginIdFormComponent>;
  let router: Router;
  let httpTesting: HttpTestingController;

  const mockAuthService = {
    currentState: {
      status: 'AUTHENTICATING',
      txnId: 'txn-123',
      loginId: 'testuser',
      roles: [],
      groups: [],
      amr: [],
      acr: '',
      availableMfaMethods: ['TOTP', 'FIDO'],
    },
    login: jasmine.createSpy('login'),
    submitPrimary: jasmine.createSpy('submitPrimary'),
    submitMfa: jasmine.createSpy('submitMfa'),
    getAuthState: jasmine.createSpy('getAuthState'),
    isAuthenticated: false,
    clearState: jasmine.createSpy('clearState'),
  };

  beforeEach(async () => {
    mockAuthService.login.calls.reset();
    mockAuthService.submitPrimary.calls.reset();
    mockAuthService.submitMfa.calls.reset();
    mockAuthService.getAuthState.calls.reset();
    mockAuthService.clearState.calls.reset();

    await TestBed.configureTestingModule({
      imports: [LoginIdFormComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(LoginIdFormComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(LoginIdFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.form).toBeDefined();
  });

  it('should show validation error when loginId is empty', () => {
    const control = component.form.get('loginId');
    control?.setValue('');
    control?.markAsTouched();
    fixture.detectChanges();

    const errorEl = (fixture.nativeElement as HTMLElement).querySelector('.p-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl?.textContent?.trim()).toBe('common.required');
  });

  it('should call AuthService.login on submit and navigate to /login/password', () => {
    mockAuthService.login.and.returnValue(
      of({ txnId: 'txn-1', availableMethods: ['PASSWORD'], accountStatus: 'ACTIVE' })
    );

    component.form.get('loginId')?.setValue('testuser');
    component.onSubmit();

    expect(mockAuthService.login).toHaveBeenCalledWith('testuser');
    expect(router.navigate).toHaveBeenCalledWith(['/login/password']);
  });

  it('should navigate to /login/fido when FIDO is available', () => {
    mockAuthService.login.and.returnValue(
      of({ txnId: 'txn-1', availableMethods: ['FIDO'], accountStatus: 'ACTIVE' })
    );

    component.form.get('loginId')?.setValue('testuser');
    component.onSubmit();

    expect(mockAuthService.login).toHaveBeenCalledWith('testuser');
    expect(router.navigate).toHaveBeenCalledWith(['/login/fido']);
  });

  it('should show timing-safe error on login failure', () => {
    mockAuthService.login.and.returnValue(
      throwError(() => new Error('Not found'))
    );

    component.form.get('loginId')?.setValue('nonexistent');
    component.onSubmit();
    fixture.detectChanges();

    // The error message should NOT reveal whether the account exists
    expect(component.errorMessage).toBe(
      'Unable to proceed. Please check your login ID and try again.'
    );
    expect(component.loading).toBeFalse();

    const errorEl = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(errorEl).toBeTruthy();
    expect(errorEl?.textContent).toContain('Unable to proceed');
  });
});
