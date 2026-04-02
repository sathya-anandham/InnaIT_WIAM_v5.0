import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject, fromEvent, merge, takeUntil, throttleTime } from 'rxjs';
import { AuthService } from './auth.service';

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 60 * 1000; // 1 minute warning
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export interface IdleState {
  idle: boolean;
  warning: boolean;
  remainingSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class IdleService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly state$ = new BehaviorSubject<IdleState>({
    idle: false,
    warning: false,
    remainingSeconds: 0,
  });

  private timeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
  private warningMs = WARNING_BEFORE_MS;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly ngZone: NgZone,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  get idleState(): Observable<IdleState> {
    return this.state$.asObservable();
  }

  get currentState(): IdleState {
    return this.state$.getValue();
  }

  /**
   * Start monitoring user activity. Call once after login.
   * @param timeoutMs Total idle time before auto-logout (default 15 min)
   * @param warningMs Time before timeout to show warning (default 1 min)
   */
  start(timeoutMs?: number, warningMs?: number): void {
    if (this.running) return;
    this.running = true;

    if (timeoutMs) this.timeoutMs = timeoutMs;
    if (warningMs) this.warningMs = warningMs;

    // Run event listeners outside Angular to avoid triggering change detection on every mouse move
    this.ngZone.runOutsideAngular(() => {
      const events$ = ACTIVITY_EVENTS.map((e) => fromEvent(document, e));
      merge(...events$)
        .pipe(throttleTime(1000), takeUntil(this.destroy$))
        .subscribe(() => this.resetTimers());
    });

    this.resetTimers();
  }

  stop(): void {
    this.running = false;
    this.clearTimers();
    this.state$.next({ idle: false, warning: false, remainingSeconds: 0 });
  }

  /**
   * Extend the session (e.g., user clicks "Stay logged in" on warning dialog).
   */
  extend(): void {
    this.resetTimers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearTimers();
  }

  private resetTimers(): void {
    this.clearTimers();
    this.state$.next({ idle: false, warning: false, remainingSeconds: 0 });

    const warningAt = this.timeoutMs - this.warningMs;

    this.warningTimer = setTimeout(() => {
      this.ngZone.run(() => this.startWarningCountdown());
    }, warningAt);

    this.idleTimer = setTimeout(() => {
      this.ngZone.run(() => this.handleIdle());
    }, this.timeoutMs);
  }

  private startWarningCountdown(): void {
    let remaining = Math.ceil(this.warningMs / 1000);
    this.state$.next({ idle: false, warning: true, remainingSeconds: remaining });

    this.countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        this.clearCountdown();
      } else {
        this.state$.next({ idle: false, warning: true, remainingSeconds: remaining });
      }
    }, 1000);
  }

  private handleIdle(): void {
    this.clearTimers();
    this.state$.next({ idle: true, warning: false, remainingSeconds: 0 });
    this.running = false;

    // Auto-logout
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/login'], { queryParams: { reason: 'idle' } }),
      error: () => this.router.navigate(['/login'], { queryParams: { reason: 'idle' } }),
    });
  }

  private clearTimers(): void {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (this.warningTimer) { clearTimeout(this.warningTimer); this.warningTimer = null; }
    this.clearCountdown();
  }

  private clearCountdown(): void {
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }
}
