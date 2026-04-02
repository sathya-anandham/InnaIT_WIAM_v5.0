import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { IdleService, IdleState } from './idle.service';
import { AuthService } from './auth.service';

describe('IdleService', () => {
  let service: IdleService;
  let mockAuth: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockAuth = jasmine.createSpyObj('AuthService', ['logout', 'getAuthState', 'clearState'], {
      currentState: { status: 'AUTHENTICATED', roles: [], groups: [], amr: [], acr: '' },
    });
    mockAuth.logout.and.returnValue(of(undefined as any));

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockRouter.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        IdleService,
        { provide: AuthService, useValue: mockAuth },
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(IdleService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with idle=false state', () => {
    expect(service.currentState.idle).toBe(false);
    expect(service.currentState.warning).toBe(false);
  });

  it('should emit warning before timeout', fakeAsync(() => {
    const states: IdleState[] = [];
    service.idleState.subscribe((s) => states.push(s));

    // timeout=5s, warning=2s → warning at 3s
    service.start(5000, 2000);
    tick(3100);

    const warningState = states.find((s) => s.warning);
    expect(warningState).toBeTruthy();
    expect(warningState!.remainingSeconds).toBeGreaterThan(0);

    service.stop();
    discardPeriodicTasks();
  }));

  it('should trigger idle and auto-logout on full timeout', fakeAsync(() => {
    service.start(3000, 1000);
    tick(3100);

    expect(service.currentState.idle).toBe(true);
    expect(mockAuth.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/login'],
      { queryParams: { reason: 'idle' } },
    );

    discardPeriodicTasks();
  }));

  it('should reset timers on extend', fakeAsync(() => {
    service.start(4000, 2000);
    tick(2100); // Warning fires

    expect(service.currentState.warning).toBe(true);

    service.extend();
    expect(service.currentState.warning).toBe(false);
    expect(service.currentState.idle).toBe(false);

    service.stop();
    discardPeriodicTasks();
  }));

  it('should stop monitoring', fakeAsync(() => {
    service.start(3000, 1000);
    service.stop();

    tick(4000);
    expect(service.currentState.idle).toBe(false);
    expect(mockAuth.logout).not.toHaveBeenCalled();

    discardPeriodicTasks();
  }));

  it('should not start twice', () => {
    service.start(5000);
    service.start(5000);
    // Should not throw or create duplicate listeners
    expect(service.currentState.idle).toBe(false);
    service.stop();
  });

  it('should emit state changes via observable', fakeAsync(() => {
    const emissions: IdleState[] = [];
    service.idleState.subscribe((s) => emissions.push(s));

    service.start(3000, 1000);
    tick(2100); // Warning

    expect(emissions.length).toBeGreaterThan(1);
    expect(emissions.some((s) => s.warning)).toBe(true);

    service.stop();
    discardPeriodicTasks();
  }));

  it('should countdown remaining seconds during warning', fakeAsync(() => {
    service.start(5000, 3000);
    tick(2100); // Warning at 2s

    const state = service.currentState;
    expect(state.warning).toBe(true);
    expect(state.remainingSeconds).toBeLessThanOrEqual(3);
    expect(state.remainingSeconds).toBeGreaterThan(0);

    service.stop();
    discardPeriodicTasks();
  }));
});
