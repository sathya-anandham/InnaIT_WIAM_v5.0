import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform, Component, Input } from '@angular/core';
import { of } from 'rxjs';
import { MfaMethodSelectorComponent } from './mfa-method-selector.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

@Component({ selector: 'app-login-layout', standalone: true, template: '<ng-content />' })
class MockLoginLayoutComponent {
  @Input() title = '';
  @Input() subtitle = '';
}

describe('MfaMethodSelectorComponent', () => {
  let component: MfaMethodSelectorComponent;
  let fixture: ComponentFixture<MfaMethodSelectorComponent>;
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
    mockAuthService.currentState.txnId = 'txn-123';
    mockAuthService.currentState.availableMfaMethods = ['TOTP', 'FIDO', 'SOFT_TOKEN', 'BACKUP_CODE'];

    await TestBed.configureTestingModule({
      imports: [MfaMethodSelectorComponent],
    })
      .overrideComponent(MfaMethodSelectorComponent, {
        set: {
          imports: [
            (await import('@angular/common')).CommonModule,
            (await import('primeng/card')).CardModule,
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

    fixture = TestBed.createComponent(MfaMethodSelectorComponent);
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

  it('should display available MFA methods based on auth state', () => {
    mockAuthService.currentState.availableMfaMethods = ['TOTP', 'FIDO'];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const methodCards = compiled.querySelectorAll('.method-card');
    expect(methodCards.length).toBe(2);
    expect(component.availableMethods.length).toBe(2);
    expect(component.availableMethods[0].type).toBe('TOTP');
    expect(component.availableMethods[1].type).toBe('FIDO');
  });

  it('should navigate to /login/totp when TOTP selected', () => {
    mockAuthService.currentState.availableMfaMethods = ['TOTP'];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const totpCard = compiled.querySelector('.method-card') as HTMLButtonElement;
    totpCard.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/login/totp']);
  });

  it('should navigate to /login/fido when FIDO selected', () => {
    mockAuthService.currentState.availableMfaMethods = ['FIDO'];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const fidoCard = compiled.querySelector('.method-card') as HTMLButtonElement;
    fidoCard.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/login/fido']);
  });

  it('should navigate to /login/softtoken when SOFT_TOKEN selected', () => {
    mockAuthService.currentState.availableMfaMethods = ['SOFT_TOKEN'];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const softTokenCard = compiled.querySelector('.method-card') as HTMLButtonElement;
    softTokenCard.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/login/softtoken']);
  });

  it('should show empty state when no methods available', () => {
    mockAuthService.currentState.availableMfaMethods = [];
    fixture.detectChanges();

    expect(component.availableMethods.length).toBe(0);
    const compiled = fixture.nativeElement as HTMLElement;
    const methodCards = compiled.querySelectorAll('.method-card');
    expect(methodCards.length).toBe(0);
    expect(compiled.textContent).toContain('No authentication methods available');
  });
});
