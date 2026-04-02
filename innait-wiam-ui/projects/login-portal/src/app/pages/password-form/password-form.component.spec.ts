import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';
import { of, throwError } from 'rxjs';

import { PasswordFormComponent } from './password-form.component';
import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('PasswordFormComponent', () => {
  let component: PasswordFormComponent;
  let fixture: ComponentFixture<PasswordFormComponent>;
  let router: Router;
  let httpTesting: HttpTestingController;

  let mockAuthService: {
    currentState: {
      status: string;
      txnId: string | undefined;
      loginId: string;
      roles: string[];
      groups: string[];
      amr: string[];
      acr: string;
      availableMfaMethods: string[];
    };
    login: jasmine.Spy;
    submitPrimary: jasmine.Spy;
    submitMfa: jasmine.Spy;
    getAuthState: jasmine.Spy;
    isAuthenticated: boolean;
    clearState: jasmine.Spy;
  };

  function buildMockAuthService(): typeof mockAuthService {
    return {
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
  }

  beforeEach(async () => {
    mockAuthService = buildMockAuthService();

    await TestBed.configureTestingModule({
      imports: [PasswordFormComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(PasswordFormComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(PasswordFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create the component', () => {
    createComponent();
    expect(component).toBeTruthy();
    expect(component.form).toBeDefined();
  });

  it('should redirect to /login if no txnId', () => {
    mockAuthService.currentState.txnId = undefined;
    createComponent();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should toggle password visibility', () => {
    createComponent();

    const inputEl = (fixture.nativeElement as HTMLElement).querySelector('#password') as HTMLInputElement;
    expect(inputEl.type).toBe('password');

    // Click the toggle button
    const toggleBtn = (fixture.nativeElement as HTMLElement).querySelector(
      'button[type="button"]'
    ) as HTMLButtonElement;
    toggleBtn.click();
    fixture.detectChanges();

    expect(component.showPassword).toBeTrue();
    expect(inputEl.type).toBe('text');

    // Toggle back
    toggleBtn.click();
    fixture.detectChanges();

    expect(component.showPassword).toBeFalse();
    expect(inputEl.type).toBe('password');
  });

  it('should detect caps lock', () => {
    createComponent();

    expect(component.capsLockOn).toBeFalse();

    // Dispatch a keydown event with CapsLock modifier active
    const event = new KeyboardEvent('keydown', {
      key: 'A',
      modifierCapsLock: true,
    } as KeyboardEventInit);
    // Override getModifierState to return true for CapsLock
    spyOn(event, 'getModifierState').and.callFake((modifier: string) => modifier === 'CapsLock');

    window.dispatchEvent(event);
    fixture.detectChanges();

    expect(component.capsLockOn).toBeTrue();

    const capsWarning = (fixture.nativeElement as HTMLElement).querySelector('.caps-lock-warning');
    expect(capsWarning).toBeTruthy();
    expect(capsWarning?.textContent).toContain('Caps Lock is on');
  });

  it('should navigate to /login/complete on AUTHENTICATED', fakeAsync(() => {
    createComponent();

    mockAuthService.submitPrimary.and.returnValue(
      of({ txnId: 'txn-123', status: 'AUTHENTICATED', sessionId: 'sess-1' })
    );

    component.form.get('password')?.setValue('Str0ngP@ss!');
    component.onSubmit();

    // failedAttempts is 0, so delay is 0ms
    tick(0);

    expect(mockAuthService.submitPrimary).toHaveBeenCalledWith('txn-123', 'PASSWORD', {
      password: 'Str0ngP@ss!',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/login/complete']);
  }));

  it('should navigate to /login/mfa-select on MFA_REQUIRED', fakeAsync(() => {
    createComponent();

    mockAuthService.submitPrimary.and.returnValue(
      of({ txnId: 'txn-123', status: 'MFA_REQUIRED', availableMfaMethods: ['TOTP'] })
    );

    component.form.get('password')?.setValue('MyP@ssw0rd');
    component.onSubmit();

    tick(0);

    expect(router.navigate).toHaveBeenCalledWith(['/login/mfa-select']);
  }));

  it('should show error and increment delay on failure', fakeAsync(() => {
    createComponent();

    mockAuthService.submitPrimary.and.returnValue(
      throwError(() => new Error('Invalid credentials'))
    );

    // First failed attempt
    component.form.get('password')?.setValue('wrongpass');
    component.onSubmit();
    tick(0); // delay = 0 * 1000 = 0ms
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Invalid credentials. Please try again.');
    expect(component.loading).toBeFalse();
    // The password field should be reset
    expect(component.form.get('password')?.value).toBeFalsy();

    // Second failed attempt — the delay should now be 1000ms
    component.form.get('password')?.setValue('wrongpass2');
    component.onSubmit();
    tick(1000); // delay = 1 * 1000 = 1000ms
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Invalid credentials. Please try again.');

    const errorEl = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(errorEl).toBeTruthy();
    expect(errorEl?.textContent).toContain('Invalid credentials');
  }));
});
