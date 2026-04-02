import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService, ApiResponse } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';
import { Subject, switchMap, timer, takeUntil, takeWhile, tap } from 'rxjs';

@Component({
  selector: 'app-soft-token-wait',
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressSpinnerModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout title="Soft Token" subtitle="Check your mobile device">
      <div class="wait-container">
        <div *ngIf="!timedOut && !errorMessage" class="waiting-state">
          <div class="pulse-circle">
            <i class="pi pi-mobile" style="font-size: 2.5rem; color: var(--innait-primary)"></i>
          </div>
          <p class="mt-3 font-medium">Waiting for approval on your device...</p>
          <p class="text-secondary text-sm">Time remaining: {{ timeRemaining }}s</p>
          <div class="progress-bar mt-2">
            <div class="progress-fill" [style.width.%]="(timeRemaining / 60) * 100"></div>
          </div>
        </div>

        <div *ngIf="timedOut" class="timeout-state">
          <i class="pi pi-clock" style="font-size: 2rem; color: var(--orange-500)"></i>
          <p class="mt-2">Request timed out</p>
          <div class="button-group mt-3">
            <p-button label="Retry" icon="pi pi-refresh" (onClick)="retry()" />
            <p-button label="Use Another Method" severity="secondary" (onClick)="goToMfaSelect()" />
          </div>
        </div>

        <div *ngIf="errorMessage" class="error-state">
          <i class="pi pi-times-circle" style="font-size: 2rem; color: var(--red-500)"></i>
          <p class="p-error mt-2" role="alert">{{ errorMessage }}</p>
          <p-button label="Try Again" icon="pi pi-refresh" (onClick)="retry()" styleClass="mt-2" />
        </div>
      </div>
    </app-login-layout>
  `,
  styles: [`
    .wait-container { display: flex; flex-direction: column; align-items: center; padding: 2rem 0; text-align: center; }
    .waiting-state, .timeout-state, .error-state { display: flex; flex-direction: column; align-items: center; }
    .pulse-circle {
      width: 80px; height: 80px; border-radius: 50%;
      background: rgba(25, 118, 210, 0.1);
      display: flex; align-items: center; justify-content: center;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.4); }
      70% { box-shadow: 0 0 0 20px rgba(25, 118, 210, 0); }
      100% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0); }
    }
    .progress-bar { width: 200px; height: 4px; background: var(--surface-border); border-radius: 2px; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--innait-primary); transition: width 1s linear; }
    .button-group { display: flex; gap: 0.5rem; }
    .text-secondary { color: var(--innait-text-secondary); }
    .text-sm { font-size: 0.875rem; }
  `],
})
export class SoftTokenWaitComponent implements OnInit, OnDestroy {
  timeRemaining = 60;
  timedOut = false;
  errorMessage = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    if (!this.authService.currentState.txnId) {
      this.router.navigate(['/login']);
      return;
    }
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  retry(): void {
    this.timedOut = false;
    this.errorMessage = '';
    this.timeRemaining = 60;
    this.startPolling();
  }

  goToMfaSelect(): void {
    this.router.navigate(['/login/mfa-select']);
  }

  private startPolling(): void {
    const txnId = this.authService.currentState.txnId;

    timer(0, 2000).pipe(
      takeUntil(this.destroy$),
      takeWhile(() => this.timeRemaining > 0 && !this.timedOut),
      tap(() => this.timeRemaining--),
      switchMap(() =>
        this.http.get<ApiResponse<{ status: string }>>(`/api/v1/auth/login/${txnId}/status`)
      ),
    ).subscribe({
      next: (response) => {
        const status = response.data?.status;
        if (status === 'APPROVED') {
          this.authService.submitMfa(txnId!, 'SOFT_TOKEN', { approved: true }).subscribe({
            next: (res) => {
              if (res.status === 'AUTHENTICATED') {
                this.router.navigate(['/login/complete']);
              }
            },
            error: () => {
              this.errorMessage = 'Failed to complete authentication.';
            },
          });
          this.destroy$.next();
        } else if (status === 'DENIED') {
          this.errorMessage = 'Request was denied on your device.';
          this.destroy$.next();
        }

        if (this.timeRemaining <= 0) {
          this.timedOut = true;
        }
      },
      error: () => {
        this.errorMessage = 'Failed to check approval status.';
      },
    });
  }
}
