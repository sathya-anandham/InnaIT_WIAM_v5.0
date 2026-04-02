import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { FidoRegistrationComponent } from './fido-registration.component';
import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('FidoRegistrationComponent', () => {
  let component: FidoRegistrationComponent;
  let fixture: ComponentFixture<FidoRegistrationComponent>;
  let router: Router;
  let httpTesting: HttpTestingController;

  const mockAuthState = {
    status: 'AUTHENTICATED',
    txnId: 'txn-001',
    loginId: 'testuser',
    roles: [],
    groups: [],
    amr: [],
    acr: '',
    sessionId: 'sess-001',
  };

  const mockAuthService = {
    currentState: mockAuthState,
    getAuthState: jasmine.createSpy('getAuthState').and.returnValue(of(mockAuthState)),
    isAuthenticated: true,
    clearState: jasmine.createSpy('clearState'),
  };

  /**
   * Helper to configure TestBed with optional PublicKeyCredential mock.
   * When `supported` is true, window.PublicKeyCredential is set to an
   * empty object so the component detects WebAuthn support.
   */
  async function createComponent(supported: boolean): Promise<void> {
    // Set or remove PublicKeyCredential on window before component init
    if (supported) {
      (window as any).PublicKeyCredential = {};
    } else {
      delete (window as any).PublicKeyCredential;
    }

    mockAuthService.getAuthState.calls.reset();
    mockAuthService.clearState.calls.reset();

    await TestBed.configureTestingModule({
      imports: [FidoRegistrationComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(FidoRegistrationComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(FidoRegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    httpTesting.verify();
    component.ngOnDestroy();
    // Restore PublicKeyCredential to prevent leaking across tests
    delete (window as any).PublicKeyCredential;
    TestBed.resetTestingModule();
  });

  it('should create the component', async () => {
    await createComponent(true);

    expect(component).toBeTruthy();
    expect(component.steps.length).toBe(3);
    expect(component.nicknameForm).toBeTruthy();
    expect(component.activeStep).toBe(0);
  });

  it('should check WebAuthn browser support on init', async () => {
    await createComponent(true);

    expect(component.webAuthnSupported).toBeTrue();
    expect(component.steps[0].label).toBe('Info');
    expect(component.steps[1].label).toBe('Authenticate');
    expect(component.steps[2].label).toBe('Complete');

    // Steps and info section should be visible when supported
    const stepsEl = (fixture.nativeElement as HTMLElement).querySelector('p-steps');
    expect(stepsEl).toBeTruthy();

    const infoSection = (fixture.nativeElement as HTMLElement).querySelector('.step-info');
    expect(infoSection).toBeTruthy();
  });

  it('should show unsupported message when PublicKeyCredential is not available', async () => {
    await createComponent(false);

    expect(component.webAuthnSupported).toBeFalse();

    fixture.detectChanges();

    // Unsupported section should be visible
    const unsupportedSection = (fixture.nativeElement as HTMLElement).querySelector('.unsupported-section');
    expect(unsupportedSection).toBeTruthy();

    const unsupportedDetail = (fixture.nativeElement as HTMLElement).querySelector('.unsupported-detail');
    expect(unsupportedDetail).toBeTruthy();

    // Steps should NOT be shown
    const stepsEl = (fixture.nativeElement as HTMLElement).querySelector('p-steps');
    expect(stepsEl).toBeFalsy();

    // Registration flow should not be visible
    const stepInfo = (fixture.nativeElement as HTMLElement).querySelector('.step-info');
    expect(stepInfo).toBeFalsy();
  });

  it('should start registration flow with nickname input', async () => {
    await createComponent(true);

    // Nickname form should be present
    const nicknameInput = (fixture.nativeElement as HTMLElement).querySelector('#key-nickname') as HTMLInputElement;
    expect(nicknameInput).toBeTruthy();

    // Form should be invalid initially (nickname required)
    expect(component.nicknameForm.valid).toBeFalse();

    // Fill in a nickname
    component.nicknameForm.get('nickname')?.setValue('My YubiKey');
    expect(component.nicknameForm.valid).toBeTrue();

    // registering flag should be false initially
    expect(component.registering).toBeFalse();
    expect(component.errorMessage).toBe('');
  });

  it('should call begin registration API', fakeAsync(async () => {
    await createComponent(true);

    const mockCreationOptions = {
      rp: { name: 'InnaIT WIAM', id: 'innait.example.com' },
      user: {
        id: 'dGVzdHVzZXI',
        name: 'testuser',
        displayName: 'Test User',
      },
      challenge: 'cmFuZG9tQ2hhbGxlbmdl',
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
      attestation: 'none',
    };

    // Set nickname and trigger registration
    component.nicknameForm.get('nickname')?.setValue('My Security Key');
    component.beginRegistration();

    expect(component.registering).toBeTrue();
    expect(component.errorMessage).toBe('');

    // Verify the HTTP POST to begin registration
    const req = httpTesting.expectOne('/api/v1/self/mfa/fido/register/begin');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nickname: 'My Security Key' });

    // Flush the response - this will trigger performWebAuthnCeremony which calls
    // navigator.credentials.create(), but we cannot mock that here.
    // We just verify the API call was correct and the component transitions.
    req.flush(mockCreationOptions);
    tick();

    // After API success, registering should be false and step should advance to 1
    expect(component.registering).toBeFalse();
    expect(component.activeStep).toBe(1);

    fixture.detectChanges();

    // The authenticating section should now be visible
    const authenticatingSection = (fixture.nativeElement as HTMLElement).querySelector('.step-authenticating');
    expect(authenticatingSection).toBeTruthy();
  }));
});
