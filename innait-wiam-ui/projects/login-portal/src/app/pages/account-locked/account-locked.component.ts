import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-account-locked',
  standalone: true,
  imports: [CommonModule, ButtonModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout title="Account Locked" [subtitle]="'auth.accountLocked' | translate">
      <div class="locked-container">
        <div class="lock-icon">
          <i class="pi pi-lock" style="font-size: 2.5rem; color: var(--red-500)"></i>
        </div>

        <p class="mt-3">Your account has been temporarily locked due to multiple failed login attempts.</p>

        <div class="countdown" *ngIf="lockoutRemaining > 0">
          <i class="pi pi-clock"></i>
          <span>Try again in <strong>{{ formatTime(lockoutRemaining) }}</strong></span>
        </div>

        <div class="countdown unlocked" *ngIf="lockoutRemaining <= 0 && wasLocked">
          <i class="pi pi-check-circle"></i>
          <span>You can try logging in again</span>
        </div>

        <div class="help-section mt-3">
          <p class="text-sm">If you believe this is an error, contact your administrator:</p>
          <p class="text-sm"><i class="pi pi-envelope"></i> support&#64;innait.io</p>
        </div>

        <div class="button-group mt-3">
          <p-button
            label="Try Again"
            icon="pi pi-arrow-left"
            (onClick)="goToLogin()"
            [disabled]="lockoutRemaining > 0"
          />
          <p-button
            label="Forgot Password?"
            severity="secondary"
            (onClick)="goToForgotPassword()"
          />
        </div>
      </div>
    </app-login-layout>
  `,
  styles: [`
    .locked-container { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1rem 0; }
    .lock-icon {
      width: 72px; height: 72px; border-radius: 50%;
      background: rgba(239, 68, 68, 0.1);
      display: flex; align-items: center; justify-content: center;
    }
    .countdown {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 1.5rem; border-radius: 8px;
      background: rgba(239, 68, 68, 0.05);
      margin-top: 1rem; font-size: 0.95rem;
    }
    .countdown.unlocked { background: rgba(34, 197, 94, 0.05); color: var(--green-600); }
    .help-section { color: var(--innait-text-secondary); }
    .text-sm { font-size: 0.875rem; margin: 0.25rem 0; }
    .button-group { display: flex; gap: 0.5rem; }
  `],
})
export class AccountLockedComponent implements OnInit, OnDestroy {
  lockoutRemaining = 0;
  wasLocked = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    // Default lockout duration: 30 minutes (1800 seconds)
    this.lockoutRemaining = 1800;
    this.wasLocked = true;

    this.timerInterval = setInterval(() => {
      if (this.lockoutRemaining > 0) {
        this.lockoutRemaining--;
      } else if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToForgotPassword(): void {
    window.location.href = '/self-service/forgot-password';
  }
}
