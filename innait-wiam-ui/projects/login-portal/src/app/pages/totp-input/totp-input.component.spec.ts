import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';
import { of, throwError } from 'rxjs';

import { TotpInputComponent } from './totp-input.component';
import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('TotpInputComponent', () => {
  let component: TotpInputComponent;
  let fixture: ComponentFixture<TotpInputComponent>;
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
      imports: [TotpInputComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(TotpInputComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(TotpInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Ensure the timer is cleaned up
    component.ngOnDestroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.digitIndices.length).toBe(6);
  });

  it('should focus first input on init', fakeAsync(() => {
    // ngAfterViewInit focuses the first input after a 100ms timeout
    tick(100);
    fixture.detectChanges();

    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll('.otp-digit');
    expect(inputs.length).toBe(6);

    // The first input should be the active (focused) element within the component
    const firstInput = inputs[0] as HTMLInputElement;
    expect(document.activeElement).toBe(firstInput);
  }));

  it('should auto-advance to next input on digit entry', fakeAsync(() => {
    tick(100); // wait for initial focus
    fixture.detectChanges();

    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.otp-digit'
    ) as NodeListOf<HTMLInputElement>;

    // Simulate typing '7' in the first input
    inputs[0].value = '7';
    inputs[0].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.digits[0]).toBe('7');

    // The second input should now be focused
    expect(document.activeElement).toBe(inputs[1]);
  }));

  it('should handle paste of 6 digits', fakeAsync(() => {
    tick(100);
    fixture.detectChanges();

    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.otp-digit'
    ) as NodeListOf<HTMLInputElement>;

    // Mock submitMfa to prevent actual submission side-effects
    mockAuthService.submitMfa.and.returnValue(
      of({ txnId: 'txn-123', status: 'AUTHENTICATED', sessionId: 'sess-1' })
    );

    // Create a paste event with clipboardData
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: new DataTransfer(),
    });
    spyOn(pasteEvent, 'preventDefault');
    spyOnProperty(pasteEvent, 'clipboardData', 'get').and.returnValue({
      getData: (type: string) => '123456',
    } as any);

    inputs[0].dispatchEvent(pasteEvent);
    fixture.detectChanges();

    // All 6 digits should be populated
    expect(component.digits).toEqual(['1', '2', '3', '4', '5', '6']);

    // All input fields should show their digit
    inputs.forEach((input, i) => {
      expect(input.value).toBe(String(i + 1));
    });

    // Auto-submit should have been called
    expect(mockAuthService.submitMfa).toHaveBeenCalledWith('txn-123', 'TOTP', { code: '123456' });
  }));

  it('should auto-submit when all 6 digits entered', fakeAsync(() => {
    tick(100);
    fixture.detectChanges();

    mockAuthService.submitMfa.and.returnValue(
      of({ txnId: 'txn-123', status: 'AUTHENTICATED', sessionId: 'sess-1' })
    );

    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.otp-digit'
    ) as NodeListOf<HTMLInputElement>;

    // Simulate entering digits 1 through 6
    for (let i = 0; i < 6; i++) {
      inputs[i].value = String(i + 1);
      inputs[i].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    expect(mockAuthService.submitMfa).toHaveBeenCalledWith('txn-123', 'TOTP', {
      code: '123456',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/login/complete']);
  }));

  it('should show error and clear digits on failure', fakeAsync(() => {
    tick(100);
    fixture.detectChanges();

    mockAuthService.submitMfa.and.returnValue(
      throwError(() => new Error('Invalid code'))
    );

    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.otp-digit'
    ) as NodeListOf<HTMLInputElement>;

    // Enter all 6 digits to trigger auto-submit
    for (let i = 0; i < 6; i++) {
      inputs[i].value = String(i + 1);
      inputs[i].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    expect(component.errorMessage).toBe('Invalid code. Please try again.');
    expect(component.loading).toBeFalse();

    // All digits should be cleared
    expect(component.digits).toEqual(['', '', '', '', '', '']);

    // All input values should be empty
    inputs.forEach((input) => {
      expect(input.value).toBe('');
    });

    fixture.detectChanges();
    const errorEl = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(errorEl).toBeTruthy();
    expect(errorEl?.textContent).toContain('Invalid code');
  }));

  it('should show countdown timer', fakeAsync(() => {
    // Timer starts at 30
    expect(component.timeRemaining).toBe(30);

    const timerRow = (fixture.nativeElement as HTMLElement).querySelector('.timer-row');
    expect(timerRow).toBeTruthy();
    expect(timerRow?.textContent).toContain('30s');

    // Advance 10 seconds
    tick(10000);
    fixture.detectChanges();

    expect(component.timeRemaining).toBe(20);
    const updatedTimerRow = (fixture.nativeElement as HTMLElement).querySelector('.timer-row');
    expect(updatedTimerRow?.textContent).toContain('20s');

    // Advance to expiry
    tick(20000);
    fixture.detectChanges();

    expect(component.timeRemaining).toBeLessThanOrEqual(0);
    const expiredRow = (fixture.nativeElement as HTMLElement).querySelector('.timer-row.expired');
    expect(expiredRow).toBeTruthy();
    expect(expiredRow?.textContent).toContain('Code may have expired');
  }));
});
