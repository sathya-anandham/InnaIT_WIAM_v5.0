import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { FidoAuthComponent } from './fido-auth.component';
import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('FidoAuthComponent', () => {
  let component: FidoAuthComponent;
  let fixture: ComponentFixture<FidoAuthComponent>;
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

  // Store original PublicKeyCredential for restoration
  let originalPublicKeyCredential: typeof window.PublicKeyCredential | undefined;

  beforeEach(async () => {
    originalPublicKeyCredential = window.PublicKeyCredential;

    mockAuthService.login.calls.reset();
    mockAuthService.submitPrimary.calls.reset();
    mockAuthService.submitMfa.calls.reset();
    mockAuthService.getAuthState.calls.reset();
    mockAuthService.clearState.calls.reset();

    await TestBed.configureTestingModule({
      imports: [FidoAuthComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(FidoAuthComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');
  });

  afterEach(() => {
    // Restore original PublicKeyCredential
    (window as any).PublicKeyCredential = originalPublicKeyCredential;
  });

  it('should create the component', () => {
    // Ensure WebAuthn is available so startAuthentication() fires; stub it
    (window as any).PublicKeyCredential = class {};
    spyOn(navigator.credentials, 'get').and.returnValue(
      new Promise(() => {}) // Never resolves — keeps authenticating=true
    );

    fixture = TestBed.createComponent(FidoAuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should show unsupported message when WebAuthn not available', () => {
    (window as any).PublicKeyCredential = undefined;

    fixture = TestBed.createComponent(FidoAuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.webAuthnSupported).toBeFalse();

    const unsupported = (fixture.nativeElement as HTMLElement).querySelector(
      '.unsupported-message'
    );
    expect(unsupported).toBeTruthy();
    expect(unsupported?.textContent).toContain('does not support WebAuthn');
  });

  it('should start authentication when WebAuthn is supported', () => {
    (window as any).PublicKeyCredential = class {};

    const credentialGetSpy = spyOn(navigator.credentials, 'get').and.returnValue(
      new Promise(() => {}) // Pending promise — authentication in progress
    );

    fixture = TestBed.createComponent(FidoAuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.webAuthnSupported).toBeTrue();
    expect(component.authenticating).toBeTrue();
    expect(credentialGetSpy).toHaveBeenCalled();

    // Verify the publicKey options were passed
    const callArgs = credentialGetSpy.calls.mostRecent().args[0] as CredentialRequestOptions;
    expect(callArgs.publicKey).toBeDefined();
    expect(callArgs.publicKey!.timeout).toBe(60000);
    expect(callArgs.publicKey!.userVerification).toBe('preferred');
  });

  it('should navigate to /login/mfa-select on goToMfaSelect()', () => {
    (window as any).PublicKeyCredential = undefined;

    fixture = TestBed.createComponent(FidoAuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.goToMfaSelect();

    expect(router.navigate).toHaveBeenCalledWith(['/login/mfa-select']);
  });
});
