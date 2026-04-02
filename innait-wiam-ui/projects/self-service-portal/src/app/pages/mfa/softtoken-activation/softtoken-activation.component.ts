import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, interval, takeUntil, switchMap, finalize, timer, takeWhile, tap } from 'rxjs';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { StepsModule } from 'primeng/steps';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { MenuItem } from 'primeng/api';

interface SoftTokenActivateResponse {
  activationCode: string;
  qrCodeDataUrl: string;
  expiresIn: number;
}

interface SoftTokenStatusResponse {
  activated: boolean;
}

@Component({
  selector: 'app-softtoken-activation',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    StepsModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div class="softtoken-activation" role="region" aria-label="Soft Token Activation">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>{{ 'mfa.softtoken.activation.title' | translate }}</h2>
          </div>
        </ng-template>

        <p-steps
          [model]="steps"
          [activeIndex]="activeStep"
          [readonly]="true"
          aria-label="Activation progress">
        </p-steps>

        <div class="step-content">
          <!-- Step 1: Info -->
          <div *ngIf="activeStep === 0" class="step-info" role="tabpanel" aria-label="Information step">
            <div class="info-section">
              <i class="pi pi-shield info-icon" aria-hidden="true"></i>
              <h3>{{ 'mfa.softtoken.activation.info.heading' | translate }}</h3>
              <p>{{ 'mfa.softtoken.activation.info.description' | translate }}</p>
              <ul class="info-list">
                <li>{{ 'mfa.softtoken.activation.info.step1' | translate }}</li>
                <li>{{ 'mfa.softtoken.activation.info.step2' | translate }}</li>
                <li>{{ 'mfa.softtoken.activation.info.step3' | translate }}</li>
              </ul>
              <p class="info-note">
                <i class="pi pi-info-circle" aria-hidden="true"></i>
                {{ 'mfa.softtoken.activation.info.note' | translate }}
              </p>
            </div>
            <div class="step-actions">
              <button
                pButton
                type="button"
                [label]="'mfa.softtoken.activation.activateButton' | translate"
                icon="pi pi-bolt"
                iconPos="right"
                (click)="beginActivation()"
                [loading]="activating"
                [disabled]="activating"
                aria-label="Begin soft token activation">
              </button>
            </div>
          </div>

          <!-- Step 2: Scan & Wait -->
          <div *ngIf="activeStep === 1" class="step-scan" role="tabpanel" aria-label="Scan and activate step">
            <div *ngIf="activating" class="loading-container">
              <p-progressSpinner
                strokeWidth="3"
                aria-label="Loading activation data">
              </p-progressSpinner>
              <p>{{ 'mfa.softtoken.activation.generating' | translate }}</p>
            </div>

            <div *ngIf="!activating && activationData" class="scan-section">
              <!-- QR Code -->
              <div class="qr-container" role="img" aria-label="QR code for soft token activation">
                <img
                  [src]="activationData.qrCodeDataUrl"
                  alt="Soft Token QR Code - scan with your mobile app"
                  class="qr-image" />
              </div>

              <!-- Activation Code for manual entry -->
              <div class="activation-code-section">
                <label id="activation-code-label">{{ 'mfa.softtoken.activation.manualCode' | translate }}</label>
                <div class="activation-code-display" aria-labelledby="activation-code-label">
                  <code class="activation-code-text">{{ activationData.activationCode }}</code>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-copy"
                    class="p-button-text p-button-sm"
                    (click)="copyActivationCode()"
                    [attr.aria-label]="'Copy activation code to clipboard'"
                    [label]="codeCopied ? ('common.copied' | translate) : ''">
                  </button>
                </div>
              </div>

              <!-- Countdown Timer -->
              <div class="countdown-section" [class.countdown-warning]="remainingSeconds <= 60"
                   role="timer" [attr.aria-label]="'Time remaining: ' + formatCountdown()">
                <i class="pi pi-clock" aria-hidden="true"></i>
                <span class="countdown-text">
                  {{ 'mfa.softtoken.activation.timeRemaining' | translate }}:
                  <strong>{{ formatCountdown() }}</strong>
                </span>
                <div class="countdown-bar-container">
                  <div class="countdown-bar"
                       [style.width.%]="countdownPercent"
                       [class.countdown-bar-warning]="remainingSeconds <= 60">
                  </div>
                </div>
              </div>

              <!-- Waiting for activation -->
              <div class="waiting-section">
                <p-progressSpinner
                  strokeWidth="3"
                  [style]="{ width: '32px', height: '32px' }"
                  aria-label="Waiting for activation">
                </p-progressSpinner>
                <p>{{ 'mfa.softtoken.activation.waitingForActivation' | translate }}</p>
              </div>
            </div>

            <!-- Expired state -->
            <div *ngIf="expired" class="expired-section">
              <i class="pi pi-clock expired-icon" aria-hidden="true"></i>
              <h3>{{ 'mfa.softtoken.activation.expired.title' | translate }}</h3>
              <p>{{ 'mfa.softtoken.activation.expired.message' | translate }}</p>
              <button
                pButton
                type="button"
                [label]="'mfa.softtoken.activation.retryButton' | translate"
                icon="pi pi-refresh"
                (click)="retryActivation()"
                [loading]="activating"
                aria-label="Retry activation">
              </button>
            </div>

            <p-message
              *ngIf="errorMessage"
              severity="error"
              [text]="errorMessage"
              [closable]="true"
              (onClose)="errorMessage = ''"
              role="alert">
            </p-message>
          </div>

          <!-- Step 3: Success -->
          <div *ngIf="activeStep === 2" class="step-success" role="tabpanel" aria-label="Activation complete">
            <div class="success-section">
              <i class="pi pi-check-circle success-icon" aria-hidden="true"></i>
              <h3>{{ 'mfa.softtoken.activation.success.title' | translate }}</h3>
              <p>{{ 'mfa.softtoken.activation.success.message' | translate }}</p>
              <div class="success-actions">
                <a
                  pButton
                  [label]="'mfa.softtoken.activation.success.manageLink' | translate"
                  icon="pi pi-cog"
                  routerLink="/mfa/softtoken/manage"
                  aria-label="Go to soft token management page">
                </a>
                <a
                  pButton
                  class="p-button-outlined"
                  [label]="'common.backToDashboard' | translate"
                  icon="pi pi-home"
                  routerLink="/dashboard"
                  aria-label="Return to dashboard">
                </a>
              </div>
            </div>
          </div>
        </div>
      </p-card>
    </div>
  `,
  styles: [`
    .softtoken-activation {
      max-width: 720px;
      margin: 0 auto;
    }

    .card-header {
      padding: 1.25rem 1.5rem 0;
    }

    .card-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--innait-text);
    }

    :host ::ng-deep .p-steps {
      padding: 1.5rem 0;
    }

    .step-content {
      padding: 1rem 0;
    }

    .info-section {
      text-align: center;
      padding: 1rem 0;
    }

    .info-icon {
      font-size: 3rem;
      color: var(--innait-primary);
      margin-bottom: 1rem;
    }

    .info-section h3 {
      font-size: 1.25rem;
      margin: 0 0 0.75rem;
    }

    .info-section p {
      color: var(--innait-text-secondary);
      line-height: 1.6;
      margin: 0 0 1rem;
    }

    .info-list {
      text-align: left;
      max-width: 480px;
      margin: 0 auto 1.5rem;
      padding-left: 1.25rem;
      line-height: 1.8;
      color: var(--innait-text-secondary);
    }

    .info-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--innait-text-secondary);
      background: var(--innait-bg);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      max-width: 480px;
      margin: 0 auto;
    }

    .step-actions {
      display: flex;
      justify-content: center;
      padding-top: 1rem;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2rem 0;
      color: var(--innait-text-secondary);
    }

    .qr-container {
      display: flex;
      justify-content: center;
      padding: 1rem 0;
    }

    .qr-image {
      width: 220px;
      height: 220px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 8px;
      background: #fff;
    }

    .activation-code-section {
      margin: 1rem 0;
    }

    .activation-code-section label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--innait-text);
    }

    .activation-code-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--innait-bg);
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      justify-content: center;
    }

    .activation-code-text {
      font-family: 'Courier New', monospace;
      font-size: 1.25rem;
      letter-spacing: 0.15em;
      font-weight: 600;
      user-select: all;
    }

    .countdown-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      margin: 1.5rem 0;
      padding: 1rem;
      background: var(--innait-bg);
      border-radius: 8px;
    }

    .countdown-section .pi-clock {
      font-size: 1.25rem;
      color: var(--innait-primary);
    }

    .countdown-warning .pi-clock {
      color: #f59e0b;
    }

    .countdown-text {
      font-size: 0.95rem;
      color: var(--innait-text);
    }

    .countdown-bar-container {
      width: 100%;
      max-width: 300px;
      height: 6px;
      background: #e0e0e0;
      border-radius: 3px;
      overflow: hidden;
    }

    .countdown-bar {
      height: 100%;
      background: var(--innait-primary);
      border-radius: 3px;
      transition: width 1s linear;
    }

    .countdown-bar-warning {
      background: #f59e0b;
    }

    .waiting-section {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 1rem 0;
      color: var(--innait-text-secondary);
      font-size: 0.95rem;
    }

    .waiting-section p {
      margin: 0;
    }

    .expired-section {
      text-align: center;
      padding: 2rem 0;
    }

    .expired-icon {
      font-size: 3rem;
      color: #f59e0b;
      margin-bottom: 1rem;
    }

    .expired-section h3 {
      font-size: 1.25rem;
      margin: 0 0 0.5rem;
      color: var(--innait-text);
    }

    .expired-section p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
    }

    .scan-section :host ::ng-deep .p-message {
      margin-top: 1rem;
    }

    .success-section {
      text-align: center;
      padding: 2rem 0;
    }

    .success-icon {
      font-size: 3.5rem;
      color: #4caf50;
      margin-bottom: 1rem;
    }

    .success-section h3 {
      font-size: 1.25rem;
      color: var(--innait-text);
      margin: 0 0 0.5rem;
    }

    .success-section p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
    }

    .success-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
  `],
})
export class SoftTokenActivationComponent implements OnInit, OnDestroy {
  steps: MenuItem[] = [];
  activeStep = 0;

  activationData: SoftTokenActivateResponse | null = null;
  activating = false;
  codeCopied = false;
  expired = false;
  errorMessage = '';

  remainingSeconds = 0;
  countdownPercent = 100;

  private totalSeconds = 0;
  private readonly destroy$ = new Subject<void>();
  private readonly stopPolling$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/mfa/softtoken';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.steps = [
      { label: 'Info' },
      { label: 'Activate' },
      { label: 'Done' },
    ];
  }

  ngOnDestroy(): void {
    this.stopPolling$.next();
    this.stopPolling$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  beginActivation(): void {
    this.activating = true;
    this.errorMessage = '';
    this.expired = false;

    this.http.post<SoftTokenActivateResponse>(`${this.API_BASE}/activate`, {})
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.activating = false),
      )
      .subscribe({
        next: (response) => {
          this.activationData = response;
          this.totalSeconds = response.expiresIn;
          this.remainingSeconds = response.expiresIn;
          this.countdownPercent = 100;
          this.activeStep = 1;
          this.startCountdown();
          this.startPolling();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to start soft token activation. Please try again.';
        },
      });
  }

  retryActivation(): void {
    this.expired = false;
    this.activationData = null;
    this.beginActivation();
  }

  formatCountdown(): string {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  copyActivationCode(): void {
    if (!this.activationData?.activationCode) {
      return;
    }

    navigator.clipboard.writeText(this.activationData.activationCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => this.codeCopied = false, 2500);
    });
  }

  private startCountdown(): void {
    timer(0, 1000).pipe(
      takeUntil(this.destroy$),
      takeUntil(this.stopPolling$),
      takeWhile(() => this.remainingSeconds > 0),
      tap(() => {
        this.remainingSeconds--;
        this.countdownPercent = this.totalSeconds > 0
          ? (this.remainingSeconds / this.totalSeconds) * 100
          : 0;
      }),
    ).subscribe({
      complete: () => {
        if (this.activeStep === 1 && this.remainingSeconds <= 0) {
          this.expired = true;
          this.activationData = null;
          this.stopPolling$.next();
        }
      },
    });
  }

  private startPolling(): void {
    interval(3000).pipe(
      takeUntil(this.destroy$),
      takeUntil(this.stopPolling$),
      switchMap(() => this.http.get<SoftTokenStatusResponse>(`${this.API_BASE}/status`)),
    ).subscribe({
      next: (status) => {
        if (status.activated) {
          this.stopPolling$.next();
          this.activeStep = 2;
        }
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to check activation status.';
      },
    });
  }
}
