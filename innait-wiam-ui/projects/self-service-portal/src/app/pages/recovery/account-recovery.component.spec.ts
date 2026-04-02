import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { AccountRecoveryComponent } from './account-recovery.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('AccountRecoveryComponent', () => {
  let component: AccountRecoveryComponent;
  let fixture: ComponentFixture<AccountRecoveryComponent>;
  let httpMock: HttpTestingController;

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

  const mockAuthService = {
    getAuthState: jasmine.createSpy('getAuthState').and.returnValue(of(mockAuthState)),
    get currentState() {
      return mockAuthState;
    },
  };

  const mockRouter = {
    navigate: jasmine.createSpy('navigate'),
  };

  const mockRecoveryMethodsFull = {
    email: { configured: true, maskedEmail: 'u***@example.com' },
    phone: { configured: true, maskedPhone: '+1***456' },
    backupCodes: { configured: true, remaining: 8 },
    securityQuestions: { configured: true, count: 3 },
  };

  const mockRecoveryMethodsPartial = {
    email: { configured: true, maskedEmail: 'u***@example.com' },
    phone: { configured: false, maskedPhone: '' },
    backupCodes: { configured: true, remaining: 5 },
    securityQuestions: { configured: false, count: 0 },
  };

  const mockRecoveryMethodsNone = {
    email: { configured: false, maskedEmail: '' },
    phone: { configured: false, maskedPhone: '' },
    backupCodes: { configured: false, remaining: 0 },
    securityQuestions: { configured: false, count: 0 },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AccountRecoveryComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(AccountRecoveryComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AccountRecoveryComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/recovery/methods');
    req.flush(mockRecoveryMethodsFull);

    expect(component).toBeTruthy();
  });

  it('should load recovery methods on init', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/recovery/methods');
    expect(req.request.method).toBe('GET');
    req.flush(mockRecoveryMethodsFull);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.recoveryMethods).toBeTruthy();
    expect(component.recoveryMethods!.email.configured).toBeTrue();
    expect(component.recoveryMethods!.phone.configured).toBeTrue();
    expect(component.recoveryMethods!.backupCodes.configured).toBeTrue();
    expect(component.recoveryMethods!.securityQuestions.configured).toBeTrue();
  }));

  it('should display configured methods with green indicator', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/recovery/methods');
    req.flush(mockRecoveryMethodsFull);
    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // All four method icons should have the 'configured' class
    const configuredIcons = compiled.querySelectorAll('.method-icon-wrapper.configured');
    expect(configuredIcons.length).toBe(4);

    // No not-configured-text paragraphs should be visible
    const notConfiguredTexts = compiled.querySelectorAll('.not-configured-text');
    expect(notConfiguredTexts.length).toBe(0);
  }));

  it('should display unconfigured methods with warning indicator', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/recovery/methods');
    req.flush(mockRecoveryMethodsPartial);
    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Two methods configured (email, backupCodes), two not (phone, securityQuestions)
    const configuredIcons = compiled.querySelectorAll('.method-icon-wrapper.configured');
    expect(configuredIcons.length).toBe(2);

    // Two unconfigured icons (without 'configured' class)
    const allIcons = compiled.querySelectorAll('.method-icon-wrapper');
    const unconfiguredIcons = Array.from(allIcons).filter(
      el => !el.classList.contains('configured')
    );
    expect(unconfiguredIcons.length).toBe(2);

    // Should show not-configured text for phone and security questions
    const notConfiguredTexts = compiled.querySelectorAll('.not-configured-text');
    expect(notConfiguredTexts.length).toBe(2);
  }));

  it('should calculate recovery score correctly', fakeAsync(() => {
    // Test with all 4 methods configured
    fixture.detectChanges();

    let req = httpMock.expectOne('/api/v1/self/recovery/methods');
    req.flush(mockRecoveryMethodsFull);
    tick();

    expect(component.configuredCount).toBe(4);
    expect(component.recoveryScore).toBe(100);

    // Reload with partial methods (2 of 4)
    component.loadRecoveryMethods();
    req = httpMock.expectOne('/api/v1/self/recovery/methods');
    req.flush(mockRecoveryMethodsPartial);
    tick();

    expect(component.configuredCount).toBe(2);
    expect(component.recoveryScore).toBe(50);

    // Reload with no methods configured (0 of 4)
    component.loadRecoveryMethods();
    req = httpMock.expectOne('/api/v1/self/recovery/methods');
    req.flush(mockRecoveryMethodsNone);
    tick();

    expect(component.configuredCount).toBe(0);
    expect(component.recoveryScore).toBe(0);
  }));
});
