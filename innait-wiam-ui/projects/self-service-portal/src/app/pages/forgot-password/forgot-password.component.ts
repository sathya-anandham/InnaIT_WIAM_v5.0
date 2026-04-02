import {
  Component,
  OnInit,
  OnDestroy,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { CardModule } from 'primeng/card';
import { StepsModule } from 'primeng/steps';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { MenuItem } from 'primeng/api';
import { ApiResponse } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

interface PasswordPolicy {
  label: string;
  key: string;
  validator: (value: string) => boolean;
  met: boolean;
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    StepsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    ProgressBarModule,
    TranslatePipe,
  ],
  template: `
    <div class="forgot-password-container">
      <!-- Steps Indicator -->
      <p-steps
        [model]="steps"
        [activeIndex]="currentStep"
        [readonly]="true"
        styleClass="forgot-steps"
        aria-label="Password reset progress"
      />

      <p-card styleClass="forgot-card">

        <!-- Step 1: Email -->
        <div *ngIf="currentStep === 0" role="region" aria-label="Enter email step">
          <h2 class="step-title">{{ 'forgotPassword.emailTitle' | translate }}</h2>
          <p class="step-subtitle">{{ 'forgotPassword.emailSubtitle' | translate }}</p>

          <p-message
            *ngIf="errorMessage"
            severity="error"
            [text]="errorMessage"
            styleClass="mb-3 w-full"
            role="alert"
          />

          <form
            [formGroup]="emailForm"
            (ngSubmit)="submitEmail()"
            role="form"
            aria-label="Email form"
          >
            <div class="form-field">
              <label for="email">{{ 'forgotPassword.emailLabel' | translate }} *</label>
              <input
                pInputText
                type="email"
                id="email"
                formControlName="email"
                [attr.aria-label]="'forgotPassword.emailLabel' | translate"
                aria-required="true"
                autocomplete="email"
                class="w-full"
                placeholder="you@company.com"
              />
              <small
                class="p-error"
                *ngIf="emailForm.get('email')?.invalid && emailForm.get('email')?.touched"
                role="alert"
              >
                <span *ngIf="emailForm.get('email')?.errors?.['required']">
                  {{ 'forgotPassword.emailRequired' | translate }}
                </span>
                <span *ngIf="emailForm.get('email')?.errors?.['email']">
                  {{ 'forgotPassword.emailInvalid' | translate }}
                </span>
              </small>
            </div>

            <div class="form-actions">
              <p-button
                type="submit"
                [label]="'forgotPassword.sendCode' | translate"
                icon="pi pi-send"
                [loading]="submitting"
                [disabled]="emailForm.invalid"
                [attr.aria-label]="'forgotPassword.sendCode' | translate"
              />
            </div>
          </form>

          <!-- Timing-safe message after submission -->
          <p-message
            *ngIf="emailSent"
            severity="info"
            [text]="'If an account exists with this email, you will receive a verification code.'"
            styleClass="mt-3 w-full"
            role="status"
          />
        </div>

        <!-- Step 2: OTP Verification -->
        <div *ngIf="currentStep === 1" role="region" aria-label="Verify OTP step">
          <h2 class="step-title">{{ 'forgotPassword.verifyTitle' | translate }}</h2>
          <p class="step-subtitle">{{ 'forgotPassword.verifySubtitle' | translate }}</p>

          <p-message
            *ngIf="errorMessage"
            severity="error"
            [text]="errorMessage"
            styleClass="mb-3 w-full"
            role="alert"
          />

          <form (ngSubmit)="submitOtp()" role="form" aria-label="OTP verification form">
            <div class="otp-container" role="group" aria-label="Enter 6-digit verification code">
              <input
                *ngFor="let i of digitIndices"
                #otpInput
                type="text"
                inputmode="numeric"
                pattern="[0-9]"
                maxlength="1"
                class="otp-digit"
                [attr.aria-label]="'Digit ' + (i + 1) + ' of 6'"
                autocomplete="off"
                (input)="onDigitInput($event, i)"
                (keydown)="onKeyDown($event, i)"
                (paste)="onPaste($event)"
              />
            </div>

            <div class="otp-actions">
              <p-button
                type="submit"
                [label]="'forgotPassword.verifyCode' | translate"
                icon="pi pi-check"
                [loading]="submitting"
                [disabled]="!isOtpComplete()"
                [attr.aria-label]="'forgotPassword.verifyCode' | translate"
              />
            </div>

            <!-- Resend OTP -->
            <div class="resend-row">
              <span class="resend-text">{{ 'forgotPassword.didntReceive' | translate }}</span>
              <button
                type="button"
                class="resend-btn"
                [disabled]="resendCooldown > 0"
                (click)="resendOtp()"
                [attr.aria-label]="resendCooldown > 0
                  ? 'Resend code available in ' + resendCooldown + ' seconds'
                  : 'Resend verification code'"
              >
                <span *ngIf="resendCooldown > 0">
                  {{ 'forgotPassword.resendIn' | translate }} {{ resendCooldown }}s
                </span>
                <span *ngIf="resendCooldown <= 0">
                  {{ 'forgotPassword.resendCode' | translate }}
                </span>
              </button>
            </div>

            <!-- Back to Email -->
            <div class="back-row">
              <p-button
                [label]="'common.back' | translate"
                severity="secondary"
                icon="pi pi-arrow-left"
                size="small"
                (onClick)="goToStep(0)"
                [attr.aria-label]="'common.back' | translate"
              />
            </div>
          </form>
        </div>

        <!-- Step 3: Reset Password -->
        <div *ngIf="currentStep === 2" role="region" aria-label="Set new password step">
          <h2 class="step-title">{{ 'forgotPassword.resetTitle' | translate }}</h2>
          <p class="step-subtitle">{{ 'forgotPassword.resetSubtitle' | translate }}</p>

          <p-message
            *ngIf="errorMessage"
            severity="error"
            [text]="errorMessage"
            styleClass="mb-3 w-full"
            role="alert"
          />

          <!-- Success State -->
          <div *ngIf="resetSuccess" class="success-panel" role="status">
            <div class="success-icon-container">
              <i class="pi pi-check-circle success-icon"></i>
            </div>
            <h3 class="success-heading">{{ 'forgotPassword.resetSuccess' | translate }}</h3>
            <p class="success-text">{{ 'forgotPassword.resetSuccessMessage' | translate }}</p>
            <p-button
              [label]="'forgotPassword.goToLogin' | translate"
              icon="pi pi-sign-in"
              routerLink="/login"
              [attr.aria-label]="'forgotPassword.goToLogin' | translate"
            />
          </div>

          <!-- Reset Form -->
          <form
            *ngIf="!resetSuccess"
            [formGroup]="resetForm"
            (ngSubmit)="submitReset()"
            role="form"
            aria-label="Set new password form"
          >
            <!-- New Password -->
            <div class="form-field">
              <label for="resetNewPassword">{{ 'password.newPassword' | translate }} *</label>
              <div class="password-input-wrapper">
                <input
                  pInputText
                  [type]="showNewPassword ? 'text' : 'password'"
                  id="resetNewPassword"
                  formControlName="newPassword"
                  [attr.aria-label]="'password.newPassword' | translate"
                  aria-required="true"
                  aria-describedby="reset-strength reset-rules"
                  autocomplete="new-password"
                  class="w-full"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  (click)="showNewPassword = !showNewPassword"
                  [attr.aria-label]="showNewPassword ? 'Hide password' : 'Show password'"
                  tabindex="-1"
                >
                  <i class="pi" [ngClass]="showNewPassword ? 'pi-eye-slash' : 'pi-eye'"></i>
                </button>
              </div>
              <small
                class="p-error"
                *ngIf="resetForm.get('newPassword')?.hasError('required') && resetForm.get('newPassword')?.touched"
                role="alert"
              >
                {{ 'password.newPasswordRequired' | translate }}
              </small>
              <small
                class="p-error"
                *ngIf="resetForm.get('newPassword')?.hasError('minlength') && resetForm.get('newPassword')?.touched"
                role="alert"
              >
                {{ 'password.minLength' | translate }}
              </small>
            </div>

            <!-- Password Strength Meter -->
            <div class="strength-meter" id="reset-strength" role="region" aria-label="Password strength">
              <div class="strength-bar-container">
                <p-progressBar
                  [value]="strengthPercent"
                  [showValue]="false"
                  [style]="{ height: '6px' }"
                  [styleClass]="'strength-bar strength-' + strengthLevel"
                />
              </div>
              <span
                class="strength-label"
                [ngClass]="'strength-text-' + strengthLevel"
                aria-live="polite"
              >
                {{ strengthLabel }}
              </span>
            </div>

            <!-- Policy Rules Checklist -->
            <div class="policy-rules" id="reset-rules" role="list" aria-label="Password requirements">
              <div
                class="policy-rule"
                *ngFor="let rule of policyRules"
                [class.rule-met]="rule.met"
                role="listitem"
                [attr.aria-label]="rule.label + (rule.met ? ' - met' : ' - not met')"
              >
                <i class="pi" [ngClass]="rule.met ? 'pi-check-circle' : 'pi-circle'"></i>
                <span>{{ rule.label }}</span>
              </div>
            </div>

            <!-- Confirm Password -->
            <div class="form-field">
              <label for="resetConfirmPassword">{{ 'password.confirmPassword' | translate }} *</label>
              <div class="password-input-wrapper">
                <input
                  pInputText
                  [type]="showConfirmPassword ? 'text' : 'password'"
                  id="resetConfirmPassword"
                  formControlName="confirmPassword"
                  [attr.aria-label]="'password.confirmPassword' | translate"
                  aria-required="true"
                  autocomplete="new-password"
                  class="w-full"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  (click)="showConfirmPassword = !showConfirmPassword"
                  [attr.aria-label]="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
                  tabindex="-1"
                >
                  <i class="pi" [ngClass]="showConfirmPassword ? 'pi-eye-slash' : 'pi-eye'"></i>
                </button>
              </div>
              <small
                class="p-error"
                *ngIf="resetForm.get('confirmPassword')?.hasError('required') && resetForm.get('confirmPassword')?.touched"
                role="alert"
              >
                {{ 'password.confirmPasswordRequired' | translate }}
              </small>
              <small
                class="p-error"
                *ngIf="resetForm.hasError('passwordMismatch') && resetForm.get('confirmPassword')?.touched && !resetForm.get('confirmPassword')?.hasError('required')"
                role="alert"
              >
                {{ 'password.passwordMismatch' | translate }}
              </small>
            </div>

            <div class="form-actions">
              <p-button
                [label]="'common.back' | translate"
                severity="secondary"
                icon="pi pi-arrow-left"
                (onClick)="goToStep(1)"
                class="mr-2"
                [attr.aria-label]="'common.back' | translate"
              />
              <p-button
                type="submit"
                [label]="'forgotPassword.resetPassword' | translate"
                icon="pi pi-lock"
                [loading]="submitting"
                [disabled]="resetForm.invalid"
                [attr.aria-label]="'forgotPassword.resetPassword' | translate"
              />
            </div>
          </form>
        </div>
      </p-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .forgot-password-container {
      max-width: 560px;
      margin: 0 auto;
    }

    :host ::ng-deep .forgot-steps {
      margin-bottom: 1.5rem;
    }

    .step-title {
      margin: 0 0 0.375rem;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--innait-text, #1f2937);
    }

    .step-subtitle {
      margin: 0 0 1.5rem;
      font-size: 0.875rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    .form-field {
      margin-bottom: 1.25rem;
    }

    .form-field label {
      display: block;
      margin-bottom: 0.375rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--innait-text, #1f2937);
    }

    .w-full {
      width: 100%;
    }

    .p-error {
      font-size: 0.75rem;
    }

    .mb-3 {
      margin-bottom: 0.75rem;
    }

    .mt-3 {
      margin-top: 0.75rem;
    }

    .mr-2 {
      margin-right: 0.5rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    /* OTP Input */
    .otp-container {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin: 1.5rem 0;
    }

    .otp-digit {
      width: 48px;
      height: 56px;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 600;
      border: 2px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s;
    }

    .otp-digit:focus {
      border-color: var(--innait-primary, #1976d2);
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
    }

    .otp-actions {
      display: flex;
      justify-content: center;
      margin-bottom: 1rem;
    }

    /* Resend Row */
    .resend-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin: 1rem 0;
      font-size: 0.85rem;
    }

    .resend-text {
      color: var(--innait-text-secondary, #6b7280);
    }

    .resend-btn {
      background: none;
      border: none;
      color: var(--innait-primary, #1976d2);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      padding: 0;
    }

    .resend-btn:disabled {
      color: var(--innait-text-secondary, #6b7280);
      cursor: not-allowed;
    }

    .resend-btn:not(:disabled):hover {
      text-decoration: underline;
    }

    .back-row {
      display: flex;
      justify-content: center;
      margin-top: 0.5rem;
    }

    /* Password Input */
    .password-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .password-input-wrapper input {
      padding-right: 2.5rem;
    }

    .toggle-visibility {
      position: absolute;
      right: 0.75rem;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25rem;
      color: var(--innait-text-secondary, #6b7280);
      font-size: 1rem;
      line-height: 1;
    }

    .toggle-visibility:hover {
      color: var(--innait-primary, #1976d2);
    }

    /* Strength Meter */
    .strength-meter {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .strength-bar-container {
      flex: 1;
    }

    :host ::ng-deep .strength-bar .p-progressbar-value {
      transition: width 0.3s ease, background 0.3s ease;
    }

    :host ::ng-deep .strength-0 .p-progressbar-value { background: #e5e7eb; }
    :host ::ng-deep .strength-1 .p-progressbar-value { background: #ef4444; }
    :host ::ng-deep .strength-2 .p-progressbar-value { background: #f97316; }
    :host ::ng-deep .strength-3 .p-progressbar-value { background: #eab308; }
    :host ::ng-deep .strength-4 .p-progressbar-value { background: #22c55e; }
    :host ::ng-deep .strength-5 .p-progressbar-value { background: #16a34a; }

    .strength-label {
      font-size: 0.75rem;
      font-weight: 600;
      min-width: 80px;
      text-align: right;
    }

    .strength-text-0 { color: #9ca3af; }
    .strength-text-1 { color: #ef4444; }
    .strength-text-2 { color: #f97316; }
    .strength-text-3 { color: #eab308; }
    .strength-text-4 { color: #22c55e; }
    .strength-text-5 { color: #16a34a; }

    /* Policy Rules */
    .policy-rules {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.375rem 1rem;
      margin-bottom: 1.5rem;
      padding: 0.75rem 1rem;
      background: var(--innait-bg, #f9fafb);
      border-radius: 8px;
    }

    .policy-rule {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: var(--innait-text-secondary, #6b7280);
      transition: color 0.2s;
    }

    .policy-rule.rule-met {
      color: #16a34a;
    }

    .policy-rule .pi-check-circle {
      color: #22c55e;
    }

    .policy-rule .pi-circle {
      color: #d1d5db;
    }

    /* Success Panel */
    .success-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2rem 1rem;
    }

    .success-icon-container {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(34, 197, 94, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .success-icon {
      font-size: 2rem;
      color: #22c55e;
    }

    .success-heading {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--innait-text, #1f2937);
    }

    .success-text {
      margin: 0 0 1.5rem;
      font-size: 0.9rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    @media (max-width: 480px) {
      .otp-digit {
        width: 40px;
        height: 48px;
        font-size: 1.25rem;
      }

      .policy-rules {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  currentStep = 0;
  submitting = false;
  errorMessage = '';
  emailSent = false;
  resetSuccess = false;
  showNewPassword = false;
  showConfirmPassword = false;
  resendCooldown = 0;

  emailForm!: FormGroup;
  resetForm!: FormGroup;

  digits: string[] = ['', '', '', '', '', ''];
  digitIndices = [0, 1, 2, 3, 4, 5];

  private resetToken = '';
  private resendInterval: ReturnType<typeof setInterval> | null = null;

  steps: MenuItem[] = [
    { label: 'Email' },
    { label: 'Verify' },
    { label: 'Reset' },
  ];

  // Password strength
  strengthPercent = 0;
  strengthLevel = 0;
  strengthLabel = '';

  policyRules: PasswordPolicy[] = [
    { label: 'At least 12 characters', key: 'minLength', validator: (v) => v.length >= 12, met: false },
    { label: 'One uppercase letter', key: 'uppercase', validator: (v) => /[A-Z]/.test(v), met: false },
    { label: 'One lowercase letter', key: 'lowercase', validator: (v) => /[a-z]/.test(v), met: false },
    { label: 'One digit', key: 'digit', validator: (v) => /[0-9]/.test(v), met: false },
    { label: 'One special character (!@#$%^&*)', key: 'special', validator: (v) => /[!@#$%^&*]/.test(v), met: false },
  ];

  private readonly strengthLabels: Record<number, string> = {
    0: '',
    1: 'Very Weak',
    2: 'Weak',
    3: 'Fair',
    4: 'Strong',
    5: 'Very Strong',
  };

  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/self';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForms();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearResendTimer();
  }

  // -- Step 1: Email --

  submitEmail(): void {
    if (this.emailForm.invalid || this.submitting) return;

    this.submitting = true;
    this.errorMessage = '';
    this.emailSent = false;

    const email = this.emailForm.value.email;

    this.http
      .post<ApiResponse<void>>(`${this.apiBase}/credentials/password/forgot`, { email })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.emailSent = true;
          // Always advance regardless of whether an account exists (timing-safe)
          setTimeout(() => {
            this.currentStep = 1;
            this.startResendCooldown();
          }, 1500);
        },
        error: () => {
          this.submitting = false;
          // Still show the timing-safe message even on error
          this.emailSent = true;
          setTimeout(() => {
            this.currentStep = 1;
            this.startResendCooldown();
          }, 1500);
        },
      });
  }

  // -- Step 2: OTP Verification --

  onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/[^0-9]/g, '');
    input.value = value;
    this.digits[index] = value;

    if (value && index < 5) {
      const inputs = this.otpInputs.toArray();
      inputs[index + 1]?.nativeElement?.focus();
    }
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      const inputs = this.otpInputs.toArray();
      inputs[index - 1]?.nativeElement?.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text')?.replace(/[^0-9]/g, '') ?? '';
    if (pasted.length === 6) {
      const inputs = this.otpInputs.toArray();
      for (let i = 0; i < 6; i++) {
        this.digits[i] = pasted[i];
        if (inputs[i]) inputs[i].nativeElement.value = pasted[i];
      }
    }
  }

  isOtpComplete(): boolean {
    return this.digits.every((d) => d.length === 1);
  }

  submitOtp(): void {
    if (!this.isOtpComplete() || this.submitting) return;

    this.submitting = true;
    this.errorMessage = '';

    const email = this.emailForm.value.email;
    const otp = this.digits.join('');

    this.http
      .post<ApiResponse<{ resetToken: string }>>(`${this.apiBase}/credentials/password/verify-otp`, {
        email,
        otp,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.submitting = false;
          this.resetToken = response.data.resetToken;
          this.currentStep = 2;
          this.errorMessage = '';
        },
        error: (err) => {
          this.submitting = false;
          this.errorMessage =
            err?.error?.error?.message ?? 'Invalid or expired verification code. Please try again.';
          this.clearDigits();
        },
      });
  }

  resendOtp(): void {
    if (this.resendCooldown > 0) return;

    const email = this.emailForm.value.email;

    this.http
      .post<ApiResponse<void>>(`${this.apiBase}/credentials/password/forgot`, { email })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.startResendCooldown();
        },
        error: () => {
          // Still start cooldown for timing safety
          this.startResendCooldown();
        },
      });
  }

  // -- Step 3: Reset Password --

  submitReset(): void {
    if (this.resetForm.invalid || this.submitting) return;

    this.submitting = true;
    this.errorMessage = '';

    const { newPassword } = this.resetForm.value;

    this.http
      .post<ApiResponse<void>>(`${this.apiBase}/credentials/password/reset`, {
        resetToken: this.resetToken,
        newPassword,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.resetSuccess = true;
        },
        error: (err) => {
          this.submitting = false;
          this.errorMessage =
            err?.error?.error?.message ?? 'Failed to reset password. Please try again.';
        },
      });
  }

  // -- Navigation --

  goToStep(step: number): void {
    this.errorMessage = '';
    this.currentStep = step;

    if (step === 0) {
      this.emailSent = false;
      this.clearDigits();
      this.clearResendTimer();
    }

    if (step === 1) {
      this.clearDigits();
      setTimeout(() => {
        const inputs = this.otpInputs?.toArray();
        inputs?.[0]?.nativeElement?.focus();
      }, 100);
    }
  }

  // -- Private helpers --

  private buildForms(): void {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.resetForm = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(12), this.policyValidator()]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: [this.passwordMatchValidator] },
    );

    this.resetForm.get('newPassword')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value: string) => {
        this.updateStrength(value ?? '');
        this.updatePolicyRules(value ?? '');
      });
  }

  private policyValidator(): (control: AbstractControl) => ValidationErrors | null {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value ?? '';
      if (!value) return null;

      const hasUpper = /[A-Z]/.test(value);
      const hasLower = /[a-z]/.test(value);
      const hasDigit = /[0-9]/.test(value);
      const hasSpecial = /[!@#$%^&*]/.test(value);

      if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
        return { policyViolation: true };
      }
      return null;
    };
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    if (confirmPassword && newPassword !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  private updateStrength(password: string): void {
    if (!password) {
      this.strengthPercent = 0;
      this.strengthLevel = 0;
      this.strengthLabel = '';
      return;
    }

    let score = 0;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*]/.test(password)) score++;

    this.strengthLevel = score;
    this.strengthPercent = (score / 5) * 100;
    this.strengthLabel = this.strengthLabels[score] ?? '';
  }

  private updatePolicyRules(password: string): void {
    this.policyRules = this.policyRules.map((rule) => ({
      ...rule,
      met: !!password && rule.validator(password),
    }));
  }

  private clearDigits(): void {
    this.digits = ['', '', '', '', '', ''];
    const inputs = this.otpInputs?.toArray();
    inputs?.forEach((input) => (input.nativeElement.value = ''));
  }

  private startResendCooldown(): void {
    this.clearResendTimer();
    this.resendCooldown = 60;
    this.resendInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        this.clearResendTimer();
      }
    }, 1000);
  }

  private clearResendTimer(): void {
    if (this.resendInterval) {
      clearInterval(this.resendInterval);
      this.resendInterval = null;
    }
  }
}
