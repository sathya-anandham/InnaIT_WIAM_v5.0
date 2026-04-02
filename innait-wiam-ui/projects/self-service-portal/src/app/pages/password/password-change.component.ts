import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { CardModule } from 'primeng/card';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ApiResponse } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

interface PasswordPolicy {
  label: string;
  key: string;
  validator: (value: string) => boolean;
  met: boolean;
}

@Component({
  selector: 'app-password-change',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    ProgressBarModule,
    InputTextModule,
    ToastModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-right" />

    <div class="password-change-container">
      <p-card [header]="'password.changeTitle' | translate" styleClass="password-card">
        <p class="card-subtitle">{{ 'password.changeSubtitle' | translate }}</p>

        <!-- Success Message -->
        <p-message
          *ngIf="successMessage"
          severity="success"
          [text]="successMessage"
          styleClass="mb-3 w-full"
          role="status"
        />

        <!-- Error Message -->
        <p-message
          *ngIf="errorMessage"
          severity="error"
          [text]="errorMessage"
          styleClass="mb-3 w-full"
          role="alert"
        />

        <form
          [formGroup]="passwordForm"
          (ngSubmit)="onSubmit()"
          role="form"
          aria-label="Change password form"
        >
          <!-- Current Password -->
          <div class="form-field">
            <label for="currentPassword">{{ 'password.currentPassword' | translate }} *</label>
            <div class="password-input-wrapper">
              <input
                pInputText
                [type]="showCurrentPassword ? 'text' : 'password'"
                id="currentPassword"
                formControlName="currentPassword"
                [attr.aria-label]="'password.currentPassword' | translate"
                aria-required="true"
                autocomplete="current-password"
                class="w-full"
              />
              <button
                type="button"
                class="toggle-visibility"
                (click)="showCurrentPassword = !showCurrentPassword"
                [attr.aria-label]="showCurrentPassword ? 'Hide current password' : 'Show current password'"
                tabindex="-1"
              >
                <i class="pi" [ngClass]="showCurrentPassword ? 'pi-eye-slash' : 'pi-eye'"></i>
              </button>
            </div>
            <small
              class="p-error"
              *ngIf="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched"
              role="alert"
            >
              {{ 'password.currentPasswordRequired' | translate }}
            </small>
          </div>

          <!-- New Password -->
          <div class="form-field">
            <label for="newPassword">{{ 'password.newPassword' | translate }} *</label>
            <div class="password-input-wrapper">
              <input
                pInputText
                [type]="showNewPassword ? 'text' : 'password'"
                id="newPassword"
                formControlName="newPassword"
                [attr.aria-label]="'password.newPassword' | translate"
                aria-required="true"
                aria-describedby="password-strength password-rules"
                autocomplete="new-password"
                class="w-full"
              />
              <button
                type="button"
                class="toggle-visibility"
                (click)="showNewPassword = !showNewPassword"
                [attr.aria-label]="showNewPassword ? 'Hide new password' : 'Show new password'"
                tabindex="-1"
              >
                <i class="pi" [ngClass]="showNewPassword ? 'pi-eye-slash' : 'pi-eye'"></i>
              </button>
            </div>
            <small
              class="p-error"
              *ngIf="passwordForm.get('newPassword')?.hasError('required') && passwordForm.get('newPassword')?.touched"
              role="alert"
            >
              {{ 'password.newPasswordRequired' | translate }}
            </small>
            <small
              class="p-error"
              *ngIf="passwordForm.get('newPassword')?.hasError('minlength') && passwordForm.get('newPassword')?.touched"
              role="alert"
            >
              {{ 'password.minLength' | translate }}
            </small>
            <small
              class="p-error"
              *ngIf="passwordForm.get('newPassword')?.hasError('sameAsCurrent') && passwordForm.get('newPassword')?.touched"
              role="alert"
            >
              {{ 'password.sameAsCurrent' | translate }}
            </small>
          </div>

          <!-- Password Strength Meter -->
          <div class="strength-meter" id="password-strength" role="region" aria-label="Password strength">
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
          <div class="policy-rules" id="password-rules" role="list" aria-label="Password requirements">
            <div
              class="policy-rule"
              *ngFor="let rule of policyRules"
              [class.rule-met]="rule.met"
              role="listitem"
              [attr.aria-label]="rule.label + (rule.met ? ' - met' : ' - not met')"
            >
              <i
                class="pi"
                [ngClass]="rule.met ? 'pi-check-circle' : 'pi-circle'"
              ></i>
              <span>{{ rule.label }}</span>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="form-field">
            <label for="confirmPassword">{{ 'password.confirmPassword' | translate }} *</label>
            <div class="password-input-wrapper">
              <input
                pInputText
                [type]="showConfirmPassword ? 'text' : 'password'"
                id="confirmPassword"
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
              *ngIf="passwordForm.get('confirmPassword')?.hasError('required') && passwordForm.get('confirmPassword')?.touched"
              role="alert"
            >
              {{ 'password.confirmPasswordRequired' | translate }}
            </small>
            <small
              class="p-error"
              *ngIf="passwordForm.hasError('passwordMismatch') && passwordForm.get('confirmPassword')?.touched && !passwordForm.get('confirmPassword')?.hasError('required')"
              role="alert"
            >
              {{ 'password.passwordMismatch' | translate }}
            </small>
          </div>

          <!-- Submit Button -->
          <div class="form-actions">
            <p-button
              type="submit"
              [label]="'password.changeButton' | translate"
              icon="pi pi-lock"
              [loading]="submitting"
              [disabled]="passwordForm.invalid"
              [attr.aria-label]="'password.changeButton' | translate"
            />
          </div>
        </form>
      </p-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .password-change-container {
      max-width: 560px;
      margin: 0 auto;
    }

    .card-subtitle {
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

    .w-full {
      width: 100%;
    }

    .p-error {
      font-size: 0.75rem;
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

    :host ::ng-deep .strength-0 .p-progressbar-value {
      background: #e5e7eb;
    }

    :host ::ng-deep .strength-1 .p-progressbar-value {
      background: #ef4444;
    }

    :host ::ng-deep .strength-2 .p-progressbar-value {
      background: #f97316;
    }

    :host ::ng-deep .strength-3 .p-progressbar-value {
      background: #eab308;
    }

    :host ::ng-deep .strength-4 .p-progressbar-value {
      background: #22c55e;
    }

    :host ::ng-deep .strength-5 .p-progressbar-value {
      background: #16a34a;
    }

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

    /* Form Actions */
    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }

    .mb-3 {
      margin-bottom: 0.75rem;
    }

    @media (max-width: 480px) {
      .policy-rules {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class PasswordChangeComponent implements OnInit, OnDestroy {
  passwordForm!: FormGroup;
  submitting = false;
  successMessage = '';
  errorMessage = '';
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  strengthPercent = 0;
  strengthLevel = 0;
  strengthLabel = '';

  policyRules: PasswordPolicy[] = [
    {
      label: 'At least 12 characters',
      key: 'minLength',
      validator: (v) => v.length >= 12,
      met: false,
    },
    {
      label: 'One uppercase letter',
      key: 'uppercase',
      validator: (v) => /[A-Z]/.test(v),
      met: false,
    },
    {
      label: 'One lowercase letter',
      key: 'lowercase',
      validator: (v) => /[a-z]/.test(v),
      met: false,
    },
    {
      label: 'One digit',
      key: 'digit',
      validator: (v) => /[0-9]/.test(v),
      met: false,
    },
    {
      label: 'One special character (!@#$%^&*)',
      key: 'special',
      validator: (v) => /[!@#$%^&*]/.test(v),
      met: false,
    },
    {
      label: 'Not same as current password',
      key: 'notSame',
      validator: (_v) => true, // Evaluated separately
      met: false,
    },
  ];

  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/self';

  private readonly strengthLabels: Record<number, string> = {
    0: '',
    1: 'Very Weak',
    2: 'Weak',
    3: 'Fair',
    4: 'Strong',
    5: 'Very Strong',
  };

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.passwordForm.invalid || this.submitting) return;

    this.submitting = true;
    this.successMessage = '';
    this.errorMessage = '';

    const { currentPassword, newPassword } = this.passwordForm.value;

    this.http
      .post<ApiResponse<void>>(`${this.apiBase}/credentials/password/change`, {
        currentPassword,
        newPassword,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.successMessage = 'Your password has been changed successfully.';
          this.passwordForm.reset();
          this.updateStrength('');
          this.messageService.add({
            severity: 'success',
            summary: 'Password Changed',
            detail: 'Your password has been updated successfully.',
            life: 5000,
          });
        },
        error: (err) => {
          this.submitting = false;
          const code = err?.error?.error?.code;
          if (code === 'INVALID_CURRENT_PASSWORD') {
            this.errorMessage = 'The current password you entered is incorrect.';
          } else {
            this.errorMessage =
              err?.error?.error?.message ?? 'Failed to change password. Please try again.';
          }
        },
      });
  }

  private buildForm(): void {
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        newPassword: ['', [Validators.required, Validators.minLength(12), this.policyValidator()]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: [this.passwordMatchValidator] },
    );

    // Listen for new password changes to update strength meter and policy checklist
    this.passwordForm.get('newPassword')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value: string) => {
        this.updateStrength(value ?? '');
        this.updatePolicyRules(value ?? '');
      });

    // Re-evaluate "not same as current" when current password changes
    this.passwordForm.get('currentPassword')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const newPwd = this.passwordForm.get('newPassword')?.value ?? '';
        this.updatePolicyRules(newPwd);
        this.passwordForm.get('newPassword')?.updateValueAndValidity({ emitEvent: false });
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
      const currentPwd = this.passwordForm?.get('currentPassword')?.value ?? '';
      const notSame = !currentPwd || value !== currentPwd;

      const errors: ValidationErrors = {};
      if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
        errors['policyViolation'] = true;
      }
      if (!notSame) {
        errors['sameAsCurrent'] = true;
      }

      return Object.keys(errors).length > 0 ? errors : null;
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
    const currentPwd = this.passwordForm?.get('currentPassword')?.value ?? '';

    this.policyRules = this.policyRules.map((rule) => {
      if (rule.key === 'notSame') {
        return {
          ...rule,
          met: !!password && ((!currentPwd) || password !== currentPwd),
        };
      }
      return {
        ...rule,
        met: !!password && rule.validator(password),
      };
    });
  }
}
