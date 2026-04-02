import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Pipe, PipeTransform, Component, Input } from '@angular/core';
import { of } from 'rxjs';
import { SoftTokenWaitComponent } from './soft-token-wait.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

@Component({ selector: 'app-login-layout', standalone: true, template: '<ng-content />' })
class MockLoginLayoutComponent {
  @Input() title = '';
  @Input() subtitle = '';
}

describe('SoftTokenWaitComponent', () => {
  let component: SoftTokenWaitComponent;
  let fixture: ComponentFixture<SoftTokenWaitComponent>;
  let router: Router;
  let httpMock: HttpTestingController;

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
    await TestBed.configureTestingModule({
      imports: [SoftTokenWaitComponent, HttpClientTestingModule],
      providers: [
        { provide: 'AuthService', useValue: mockAuthService },
      ],
    })
      .overrideComponent(SoftTokenWaitComponent, {
        set: {
          imports: [
            MockTranslatePipe,
            MockLoginLayoutComponent,
            (await import('@angular/common')).CommonModule,
            (await import('primeng/button')).ButtonModule,
            (await import('primeng/progressspinner')).ProgressSpinnerModule,
          ],
          providers: [
            { provide: (await import('@innait/core')).AuthService, useValue: mockAuthService },
          ],
        },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(SoftTokenWaitComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
    mockAuthService.submitMfa.calls.reset();
    mockAuthService.getAuthState.calls.reset();
    mockAuthService.clearState.calls.reset();
    // Restore txnId for other tests
    mockAuthService.currentState.txnId = 'txn-123';
  });

  it('should create the component', () => {
    fixture.detectChanges();
    // Flush the initial polling request
    const req = httpMock.match(/\/api\/v1\/auth\/login\/txn-123\/status/);
    req.forEach(r => r.flush({ data: { status: 'PENDING' } }));
    expect(component).toBeTruthy();
  });

  it('should redirect to /login if no txnId', () => {
    mockAuthService.currentState.txnId = undefined as any;
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should show waiting state initially', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // Flush the polling request to avoid afterEach verify error
    const req = httpMock.match(/\/api\/v1\/auth\/login\/txn-123\/status/);
    req.forEach(r => r.flush({ data: { status: 'PENDING' } }));
    expect(compiled.querySelector('.waiting-state')).toBeTruthy();
    expect(compiled.querySelector('.timeout-state')).toBeFalsy();
    expect(compiled.querySelector('.error-state')).toBeFalsy();
  });

  it('should display timeout state after 60 seconds', fakeAsync(() => {
    fixture.detectChanges();

    // Simulate time passing: the timer fires every 2000ms and decrements timeRemaining each tick.
    // After 60 ticks of decrement, timeRemaining reaches 0.
    // We advance 60 * 2000ms = 120000ms to let the timer fire enough times.
    for (let i = 0; i < 61; i++) {
      tick(2000);
      // Flush any pending HTTP requests
      const reqs = httpMock.match(/\/api\/v1\/auth\/login\/txn-123\/status/);
      reqs.forEach(r => r.flush({ data: { status: 'PENDING' } }));
    }

    fixture.detectChanges();
    expect(component.timedOut).toBeTrue();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.timeout-state')).toBeTruthy();

    // Clean up the component to stop polling
    component.ngOnDestroy();
  }));

  it('should cleanup subscriptions on destroy', () => {
    fixture.detectChanges();
    // Flush initial polling request
    const req = httpMock.match(/\/api\/v1\/auth\/login\/txn-123\/status/);
    req.forEach(r => r.flush({ data: { status: 'PENDING' } }));

    const destroySpy = spyOn((component as any).destroy$, 'next').and.callThrough();
    const completeSpy = spyOn((component as any).destroy$, 'complete').and.callThrough();

    component.ngOnDestroy();

    expect(destroySpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });
});
