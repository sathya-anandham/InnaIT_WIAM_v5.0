import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { StepsModule } from 'primeng/steps';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';

import { MenuItem } from 'primeng/api';

interface TotpEnrollResponse {
  secret: string;
  qrCodeDataUrl: string;
  issuer: string;
  accountName: string;
}

@Component({
  selector: 'app-totp-enrollment',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    StepsModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    TooltipModule,
    TranslatePipe,
  ],
  template: `
    <div class="totp-enrollment" role="region" aria-label="TOTP Authenticator Enrollment">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>{{ 'mfa.totp.enrollment.title' | translate }}</h2>
          </div>
        </ng-template>

        <p-steps
          [model]="steps"
          [activeIndex]="activeStep"
          [readonly]="true"
          aria-label="Enrollment progress">
        </p-steps>

        <div class="step-content">
          <!-- Step 1: Info -->
          <div *ngIf="activeStep === 0" class="step-info" role="tabpanel" aria-label="Information step">
            <div class="info-section">
              <i class="pi pi-mobile info-icon" aria-hidden="true"></i>
              <h3>{{ 'mfa.totp.enrollment.info.heading' | translate }}</h3>
              <p>{{ 'mfa.totp.enrollment.info.description' | translate }}</p>
              <ul class="info-list">
                <li>{{ 'mfa.totp.enrollment.info.step1' | translate }}</li>
                <li>{{ 'mfa.totp.enrollment.info.step2' | translate }}</li>
                <li>{{ 'mfa.totp.enrollment.info.step3' | translate }}</li>
              </ul>
              <p class="info-note">
                <i class="pi pi-info-circle" aria-hidden="true"></i>
                {{ 'mfa.totp.enrollment.info.note' | translate }}
              </p>
            </div>
            <div class="step-actions">
              <button
                pButton
                type="button"
                [label]="'mfa.totp.enrollment.beginButton' | translate"
                icon="pi pi-arrow-right"
                iconPos="right"
                (click)="beginEnrollment()"
                [loading]="enrolling"
                [disabled]="enrolling"
                aria-label="Begin TOTP enrollment">
              </button>
            </div>
          </div>

          <!-- Step 2: Scan QR -->
          <div *ngIf="activeStep === 1" class="step-scan" role="tabpanel" aria-label="Scan QR code step">
            <div *ngIf="enrolling" class="loading-container">
              <p-progressSpinner
                strokeWidth="3"
                aria-label="Loading enrollment data">
              </p-progressSpinner>
              <p>{{ 'mfa.totp.enrollment.generating' | translate }}</p>
            </div>

            <div *ngIf="!enrolling && enrollmentData" class="scan-section">
              <div class="context-info">
                <p><strong>{{ 'mfa.totp.enrollment.issuer' | translate }}:</strong> {{ enrollmentData.issuer }}</p>
                <p><strong>{{ 'mfa.totp.enrollment.account' | translate }}:</strong> {{ enrollmentData.accountName }}</p>
              </div>

              <div class="qr-container" role="img" aria-label="QR code for TOTP enrollment">
                <img
                  [src]="enrollmentData.qrCodeDataUrl"
                  alt="TOTP QR Code - scan with your authenticator app"
                  class="qr-image" />
              </div>

              <div class="secret-section">
                <label id="secret-label">{{ 'mfa.totp.enrollment.secretKey' | translate }}</label>
                <div class="secret-display" aria-labelledby="secret-label">
                  <code class="secret-text">{{ enrollmentData.secret }}</code>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-copy"
                    class="p-button-text p-button-sm"
                    (click)="copySecret()"
                    [pTooltip]="secretCopied ? ('common.copied' | translate) : ('common.copyToClipboard' | translate)"
                    tooltipPosition="top"
                    [attr.aria-label]="'Copy secret key to clipboard'">
                  </button>
                </div>
              </div>

              <form [formGroup]="verifyForm" class="verify-section" (ngSubmit)="verifyCode()">
                <label for="totp-code">{{ 'mfa.totp.enrollment.verificationCode' | translate }}</label>
                <div class="code-input-row">
                  <input
                    id="totp-code"
                    pInputText
                    formControlName="code"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    maxlength="6"
                    autocomplete="one-time-code"
                    [placeholder]="'mfa.totp.enrollment.codePlaceholder' | translate"
                    aria-required="true"
                    [attr.aria-invalid]="verifyForm.get('code')?.invalid && verifyForm.get('code')?.touched" />
                  <button
                    pButton
                    type="submit"
                    [label]="'mfa.totp.enrollment.verifyButton' | translate"
                    icon="pi pi-check"
                    [loading]="verifying"
                    [disabled]="verifyForm.invalid || verifying"
                    aria-label="Verify TOTP code">
                  </button>
                </div>
                <small
                  *ngIf="verifyForm.get('code')?.invalid && verifyForm.get('code')?.touched"
                  class="p-error"
                  role="alert">
                  {{ 'mfa.totp.enrollment.codeRequired' | translate }}
                </small>
              </form>
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
          <div *ngIf="activeStep === 2" class="step-success" role="tabpanel" aria-label="Enrollment complete">
            <div class="success-section">
              <i class="pi pi-check-circle success-icon" aria-hidden="true"></i>
              <h3>{{ 'mfa.totp.enrollment.success.title' | translate }}</h3>
              <p>{{ 'mfa.totp.enrollment.success.message' | translate }}</p>
              <div class="success-actions">
                <a
                  pButton
                  [label]="'mfa.totp.enrollment.success.manageLink' | translate"
                  icon="pi pi-cog"
                  routerLink="/mfa/totp/manage"
                  aria-label="Go to TOTP management page">
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
    .totp-enrollment {
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

    .context-info {
      background: var(--innait-bg);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
    }

    .context-info p {
      margin: 0.25rem 0;
      font-size: 0.875rem;
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

    .secret-section {
      margin: 1rem 0;
    }

    .secret-section label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--innait-text);
    }

    .secret-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--innait-bg);
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
    }

    .secret-text {
      flex: 1;
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      letter-spacing: 0.05em;
      word-break: break-all;
      user-select: all;
    }

    .verify-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e0e0e0;
    }

    .verify-section label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--innait-text);
    }

    .code-input-row {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }

    .code-input-row input {
      flex: 1;
      max-width: 200px;
      font-size: 1.25rem;
      letter-spacing: 0.3em;
      text-align: center;
    }

    .p-error {
      display: block;
      margin-top: 0.375rem;
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
export class TotpEnrollmentComponent implements OnInit, OnDestroy {
  steps: MenuItem[] = [];
  activeStep = 0;

  enrollmentData: TotpEnrollResponse | null = null;
  enrolling = false;
  verifying = false;
  secretCopied = false;
  errorMessage = '';

  verifyForm!: FormGroup;

  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/mfa/totp';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.steps = [
      { label: 'Info' },
      { label: 'Scan QR' },
      { label: 'Verify' },
    ];

    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  beginEnrollment(): void {
    this.enrolling = true;
    this.errorMessage = '';

    this.http.post<TotpEnrollResponse>(`${this.API_BASE}/enroll`, {})
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.enrolling = false),
      )
      .subscribe({
        next: (response) => {
          this.enrollmentData = response;
          this.activeStep = 1;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to start TOTP enrollment. Please try again.';
        },
      });
  }

  verifyCode(): void {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.verifying = true;
    this.errorMessage = '';

    const code = this.verifyForm.get('code')?.value;

    this.http.post<{ success: boolean }>(`${this.API_BASE}/verify`, { code })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.verifying = false),
      )
      .subscribe({
        next: () => {
          this.activeStep = 2;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Verification failed. Please check the code and try again.';
          this.verifyForm.get('code')?.reset();
        },
      });
  }

  copySecret(): void {
    if (!this.enrollmentData?.secret) {
      return;
    }

    navigator.clipboard.writeText(this.enrollmentData.secret).then(() => {
      this.secretCopied = true;
      setTimeout(() => this.secretCopied = false, 2500);
    });
  }
}
