import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
  specialCharsAllowed: string;
  maxAge: number;
  historyCount: number;
  maxFailedAttempts: number;
  lockoutDuration: number;
}

interface PasswordRule {
  label: string;
  passed: boolean;
  active: boolean;
}

@Component({
  selector: 'app-password-policy',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    CardModule,
    InputNumberModule,
    InputSwitchModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule
  ],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading password policy">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'policies.password.loading' | translate }}</p>
    </div>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="error-banner" role="alert">
    </p-message>

    <!-- Success State -->
    <p-message *ngIf="successMessage && !loading" severity="success" [text]="successMessage"
               styleClass="success-banner" role="status">
    </p-message>

    <!-- Main Content -->
    <div *ngIf="!loading" class="policy-layout">

      <!-- Left Panel - Form (60%) -->
      <p-card [header]="'policies.password.title' | translate"
              [subheader]="'policies.password.subtitle' | translate"
              styleClass="policy-form-card">
        <form [formGroup]="policyForm" (ngSubmit)="onSave()" aria-label="Password policy configuration form">

          <!-- Complexity Section -->
          <h4 class="section-title">{{ 'policies.password.complexity' | translate }}</h4>

          <div class="form-row">
            <div class="field">
              <label for="minLength" class="field-label">
                {{ 'policies.password.minLength' | translate }}
              </label>
              <p-inputNumber inputId="minLength"
                             formControlName="minLength"
                             [min]="8" [max]="128"
                             [showButtons]="true"
                             aria-label="Minimum password length">
              </p-inputNumber>
            </div>
            <div class="field">
              <label for="maxLength" class="field-label">
                {{ 'policies.password.maxLength' | translate }}
              </label>
              <p-inputNumber inputId="maxLength"
                             formControlName="maxLength"
                             [min]="policyForm.get('minLength')?.value || 8" [max]="128"
                             [showButtons]="true"
                             aria-label="Maximum password length">
              </p-inputNumber>
            </div>
          </div>

          <div class="switch-grid">
            <div class="switch-item">
              <label for="requireUppercase" class="switch-label">
                {{ 'policies.password.requireUppercase' | translate }}
              </label>
              <p-inputSwitch inputId="requireUppercase"
                             formControlName="requireUppercase"
                             aria-label="Require uppercase letter">
              </p-inputSwitch>
            </div>
            <div class="switch-item">
              <label for="requireLowercase" class="switch-label">
                {{ 'policies.password.requireLowercase' | translate }}
              </label>
              <p-inputSwitch inputId="requireLowercase"
                             formControlName="requireLowercase"
                             aria-label="Require lowercase letter">
              </p-inputSwitch>
            </div>
            <div class="switch-item">
              <label for="requireDigit" class="switch-label">
                {{ 'policies.password.requireDigit' | translate }}
              </label>
              <p-inputSwitch inputId="requireDigit"
                             formControlName="requireDigit"
                             aria-label="Require digit">
              </p-inputSwitch>
            </div>
            <div class="switch-item">
              <label for="requireSpecialChar" class="switch-label">
                {{ 'policies.password.requireSpecialChar' | translate }}
              </label>
              <p-inputSwitch inputId="requireSpecialChar"
                             formControlName="requireSpecialChar"
                             aria-label="Require special character">
              </p-inputSwitch>
            </div>
          </div>

          <div class="field" *ngIf="policyForm.get('requireSpecialChar')?.value">
            <label for="specialCharsAllowed" class="field-label">
              {{ 'policies.password.specialCharsAllowed' | translate }}
            </label>
            <input pInputText id="specialCharsAllowed"
                   formControlName="specialCharsAllowed"
                   class="w-full"
                   aria-label="Allowed special characters" />
          </div>

          <!-- Expiration Section -->
          <h4 class="section-title">{{ 'policies.password.expiration' | translate }}</h4>

          <div class="form-row">
            <div class="field">
              <label for="maxAge" class="field-label">
                {{ 'policies.password.maxAge' | translate }}
              </label>
              <p-inputNumber inputId="maxAge"
                             formControlName="maxAge"
                             [min]="0"
                             [showButtons]="true"
                             suffix=" days"
                             aria-label="Password maximum age in days, 0 means never expires">
              </p-inputNumber>
              <small class="hint">{{ 'policies.password.maxAgeHint' | translate }}</small>
            </div>
            <div class="field">
              <label for="historyCount" class="field-label">
                {{ 'policies.password.historyCount' | translate }}
              </label>
              <p-inputNumber inputId="historyCount"
                             formControlName="historyCount"
                             [min]="0" [max]="24"
                             [showButtons]="true"
                             aria-label="Password history count">
              </p-inputNumber>
            </div>
          </div>

          <!-- Lockout Section -->
          <h4 class="section-title">{{ 'policies.password.lockout' | translate }}</h4>

          <div class="form-row">
            <div class="field">
              <label for="maxFailedAttempts" class="field-label">
                {{ 'policies.password.maxFailedAttempts' | translate }}
              </label>
              <p-inputNumber inputId="maxFailedAttempts"
                             formControlName="maxFailedAttempts"
                             [min]="1" [max]="10"
                             [showButtons]="true"
                             aria-label="Maximum failed login attempts before lockout">
              </p-inputNumber>
            </div>
            <div class="field">
              <label for="lockoutDuration" class="field-label">
                {{ 'policies.password.lockoutDuration' | translate }}
              </label>
              <p-inputNumber inputId="lockoutDuration"
                             formControlName="lockoutDuration"
                             [min]="1"
                             [showButtons]="true"
                             suffix=" min"
                             aria-label="Account lockout duration in minutes">
              </p-inputNumber>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions">
            <p-button type="submit"
                      [label]="'policies.password.save' | translate"
                      icon="pi pi-save"
                      [disabled]="policyForm.invalid || policyForm.pristine || saving"
                      [loading]="saving"
                      aria-label="Save password policy">
            </p-button>
            <p-button [label]="'policies.password.resetDefaults' | translate"
                      icon="pi pi-undo"
                      styleClass="p-button-outlined p-button-secondary"
                      [disabled]="saving"
                      (onClick)="onResetToDefaults()"
                      aria-label="Reset to default password policy">
            </p-button>
          </div>
        </form>
      </p-card>

      <!-- Right Panel - Live Preview (40%) -->
      <div class="preview-panel">
        <p-card [header]="'policies.password.preview' | translate"
                styleClass="preview-card">

          <!-- Test Password Input -->
          <div class="field">
            <label for="testPassword" class="field-label">
              {{ 'policies.password.testPassword' | translate }}
            </label>
            <input pInputText id="testPassword"
                   [type]="showTestPassword ? 'text' : 'password'"
                   [(ngModel)]="testPassword"
                   [ngModelOptions]="{ standalone: true }"
                   (ngModelChange)="onTestPasswordChange()"
                   class="w-full test-password-input"
                   placeholder="Type a password to test..."
                   aria-label="Test password against current policy rules" />
            <button type="button" class="toggle-visibility-btn"
                    (click)="showTestPassword = !showTestPassword"
                    [attr.aria-label]="showTestPassword ? 'Hide password' : 'Show password'">
              <i class="pi" [ngClass]="showTestPassword ? 'pi-eye-slash' : 'pi-eye'" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Strength Meter -->
          <div class="strength-meter" role="meter" [attr.aria-valuenow]="strengthScore"
               aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'Password strength: ' + strengthLabel">
            <div class="strength-bar">
              <div class="strength-fill"
                   [style.width.%]="strengthScore"
                   [ngClass]="strengthClass">
              </div>
            </div>
            <span class="strength-label" [ngClass]="strengthClass">{{ strengthLabel }}</span>
          </div>

          <!-- Rules Checklist -->
          <div class="rules-checklist" role="list" aria-label="Password policy rules checklist">
            <div *ngFor="let rule of passwordRules; trackBy: trackByRuleLabel"
                 class="rule-item"
                 [ngClass]="{ 'rule-passed': rule.passed, 'rule-failed': !rule.passed && testPassword.length > 0, 'rule-inactive': !rule.active }"
                 role="listitem">
              <i class="pi"
                 [ngClass]="{
                   'pi-check-circle': rule.passed,
                   'pi-times-circle': !rule.passed && testPassword.length > 0,
                   'pi-circle': testPassword.length === 0
                 }"
                 aria-hidden="true"></i>
              <span>{{ rule.label }}</span>
            </div>
          </div>
        </p-card>
      </div>
    </div>

    <!-- Reset Defaults Confirmation Dialog -->
    <div *ngIf="showResetConfirm" class="dialog-overlay"
         role="dialog" aria-modal="true" aria-label="Confirm reset to defaults">
      <div class="dialog-content" (click)="$event.stopPropagation()">
        <h3 class="dialog-title">{{ 'policies.password.resetConfirmTitle' | translate }}</h3>
        <p class="dialog-message">{{ 'policies.password.resetConfirmMessage' | translate }}</p>
        <div class="dialog-actions">
          <p-button [label]="'common.cancel' | translate"
                    styleClass="p-button-outlined p-button-secondary"
                    (onClick)="showResetConfirm = false"
                    aria-label="Cancel reset">
          </p-button>
          <p-button [label]="'policies.password.confirmReset' | translate"
                    icon="pi pi-undo"
                    styleClass="p-button-warning"
                    (onClick)="confirmResetDefaults()"
                    aria-label="Confirm reset to defaults">
          </p-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      gap: 1rem;
      color: var(--text-color-secondary);
    }

    :host ::ng-deep .error-banner,
    :host ::ng-deep .success-banner {
      width: 100%;
      margin-bottom: 1rem;
    }

    .policy-layout {
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
    }

    :host ::ng-deep .policy-form-card {
      flex: 0 0 60%;
      min-width: 0;
    }

    .preview-panel {
      flex: 0 0 calc(40% - 1.5rem);
      position: sticky;
      top: 1.5rem;
    }

    :host ::ng-deep .preview-card {
      width: 100%;
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 600;
      margin: 1.5rem 0 0.75rem 0;
      color: var(--text-color);
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--surface-border);
    }

    .section-title:first-of-type {
      margin-top: 0;
    }

    .form-row {
      display: flex;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .form-row .field {
      flex: 1;
    }

    .field {
      margin-bottom: 1rem;
      position: relative;
    }

    .field-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
      font-size: 0.875rem;
    }

    .hint {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .w-full {
      width: 100%;
    }

    .switch-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .switch-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0.875rem;
      background: var(--surface-ground);
      border-radius: 6px;
      border: 1px solid var(--surface-border);
    }

    .switch-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    /* Test password input with visibility toggle */
    .test-password-input {
      padding-right: 2.5rem;
    }

    .toggle-visibility-btn {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(25%);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-color-secondary);
      padding: 0.25rem;
    }

    .toggle-visibility-btn:hover {
      color: var(--text-color);
    }

    /* Strength Meter */
    .strength-meter {
      margin-bottom: 1.25rem;
    }

    .strength-bar {
      height: 6px;
      background: var(--surface-200);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 0.375rem;
    }

    .strength-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease, background-color 0.3s ease;
    }

    .strength-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .strength-weak {
      background-color: #ef5350;
      color: #ef5350;
    }

    .strength-fair {
      background-color: #ff9800;
      color: #ff9800;
    }

    .strength-good {
      background-color: #66bb6a;
      color: #66bb6a;
    }

    .strength-strong {
      background-color: #2e7d32;
      color: #2e7d32;
    }

    /* Rules Checklist */
    .rules-checklist {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .rule-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      padding: 0.375rem 0;
      color: var(--text-color-secondary);
      transition: color 0.2s ease;
    }

    .rule-item i {
      font-size: 1rem;
      flex-shrink: 0;
    }

    .rule-passed {
      color: #2e7d32;
    }

    .rule-passed i {
      color: #2e7d32;
    }

    .rule-failed {
      color: #c62828;
    }

    .rule-failed i {
      color: #c62828;
    }

    .rule-inactive {
      color: var(--surface-400);
      text-decoration: line-through;
    }

    /* Dialog */
    .dialog-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      z-index: 1000;
    }

    .dialog-content {
      background: var(--surface-card);
      border-radius: 8px;
      padding: 1.5rem;
      width: 420px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    }

    .dialog-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 0.75rem 0;
      color: var(--text-color);
    }

    .dialog-message {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
      margin: 0 0 1.25rem 0;
      line-height: 1.5;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    @media (max-width: 960px) {
      .policy-layout {
        flex-direction: column;
      }

      :host ::ng-deep .policy-form-card {
        flex: 1 1 auto;
      }

      .preview-panel {
        flex: 1 1 auto;
        position: static;
        width: 100%;
      }

      .form-row {
        flex-direction: column;
      }

      .switch-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PasswordPolicyComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/policies/password';

  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';
  showResetConfirm = false;

  policyForm!: FormGroup;
  testPassword = '';
  showTestPassword = false;

  passwordRules: PasswordRule[] = [];
  strengthScore = 0;
  strengthLabel = '';
  strengthClass = '';

  private readonly defaults: PasswordPolicy = {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSpecialChar: true,
    specialCharsAllowed: '!@#$%^&*',
    maxAge: 90,
    historyCount: 5,
    maxFailedAttempts: 5,
    lockoutDuration: 30
  };

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPolicy();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ------------------------------------------------------------------ */
  /*  Form initialization                                                */
  /* ------------------------------------------------------------------ */

  private initForm(): void {
    this.policyForm = this.fb.group({
      minLength: [this.defaults.minLength, [Validators.required, Validators.min(8), Validators.max(128)]],
      maxLength: [this.defaults.maxLength, [Validators.required, Validators.min(8), Validators.max(128)]],
      requireUppercase: [this.defaults.requireUppercase],
      requireLowercase: [this.defaults.requireLowercase],
      requireDigit: [this.defaults.requireDigit],
      requireSpecialChar: [this.defaults.requireSpecialChar],
      specialCharsAllowed: [this.defaults.specialCharsAllowed],
      maxAge: [this.defaults.maxAge, [Validators.required, Validators.min(0)]],
      historyCount: [this.defaults.historyCount, [Validators.required, Validators.min(0), Validators.max(24)]],
      maxFailedAttempts: [this.defaults.maxFailedAttempts, [Validators.required, Validators.min(1), Validators.max(10)]],
      lockoutDuration: [this.defaults.lockoutDuration, [Validators.required, Validators.min(1)]]
    });

    // Update rules checklist whenever form values change
    this.policyForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateRulesAndStrength());

    this.updateRulesAndStrength();
  }

  /* ------------------------------------------------------------------ */
  /*  Data loading                                                       */
  /* ------------------------------------------------------------------ */

  private loadPolicy(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<PasswordPolicy>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (data) {
            this.policyForm.patchValue({
              minLength: data.minLength ?? this.defaults.minLength,
              maxLength: data.maxLength ?? this.defaults.maxLength,
              requireUppercase: data.requireUppercase ?? this.defaults.requireUppercase,
              requireLowercase: data.requireLowercase ?? this.defaults.requireLowercase,
              requireDigit: data.requireDigit ?? this.defaults.requireDigit,
              requireSpecialChar: data.requireSpecialChar ?? this.defaults.requireSpecialChar,
              specialCharsAllowed: data.specialCharsAllowed ?? this.defaults.specialCharsAllowed,
              maxAge: data.maxAge ?? this.defaults.maxAge,
              historyCount: data.historyCount ?? this.defaults.historyCount,
              maxFailedAttempts: data.maxFailedAttempts ?? this.defaults.maxFailedAttempts,
              lockoutDuration: data.lockoutDuration ?? this.defaults.lockoutDuration
            });
            this.policyForm.markAsPristine();
          }
          this.loading = false;
          this.updateRulesAndStrength();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load password policy. Please try again.';
          this.loading = false;
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Save operations                                                    */
  /* ------------------------------------------------------------------ */

  onSave(): void {
    if (this.policyForm.invalid) {
      this.policyForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.put<ApiResponse<PasswordPolicy>>(this.apiBase, this.policyForm.value)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Password policy saved successfully.';
          this.policyForm.markAsPristine();
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to save password policy. Please try again.';
        }
      });
  }

  onResetToDefaults(): void {
    this.showResetConfirm = true;
  }

  confirmResetDefaults(): void {
    this.showResetConfirm = false;
    this.policyForm.patchValue(this.defaults);
    this.policyForm.markAsDirty();
    this.updateRulesAndStrength();
  }

  /* ------------------------------------------------------------------ */
  /*  Live preview logic                                                 */
  /* ------------------------------------------------------------------ */

  onTestPasswordChange(): void {
    this.updateRulesAndStrength();
  }

  private updateRulesAndStrength(): void {
    const formValues = this.policyForm.value;
    const pwd = this.testPassword;

    this.passwordRules = [
      {
        label: `At least ${formValues.minLength} characters`,
        passed: pwd.length >= formValues.minLength,
        active: true
      },
      {
        label: `At most ${formValues.maxLength} characters`,
        passed: pwd.length > 0 && pwd.length <= formValues.maxLength,
        active: true
      },
      {
        label: 'Contains uppercase letter',
        passed: /[A-Z]/.test(pwd),
        active: formValues.requireUppercase
      },
      {
        label: 'Contains lowercase letter',
        passed: /[a-z]/.test(pwd),
        active: formValues.requireLowercase
      },
      {
        label: 'Contains digit',
        passed: /[0-9]/.test(pwd),
        active: formValues.requireDigit
      },
      {
        label: `Contains special character (${formValues.specialCharsAllowed || '!@#$%^&*'})`,
        passed: this.hasSpecialChar(pwd, formValues.specialCharsAllowed || '!@#$%^&*'),
        active: formValues.requireSpecialChar
      }
    ];

    this.calculateStrength(pwd, formValues);
  }

  private hasSpecialChar(password: string, allowed: string): boolean {
    if (!password) return false;
    for (const char of password) {
      if (allowed.includes(char)) return true;
    }
    return false;
  }

  private calculateStrength(password: string, policy: PasswordPolicy): void {
    if (!password) {
      this.strengthScore = 0;
      this.strengthLabel = '';
      this.strengthClass = '';
      return;
    }

    let score = 0;
    const activeRules = this.passwordRules.filter(r => r.active);
    const passedRules = activeRules.filter(r => r.passed);

    // Base score from rule compliance
    if (activeRules.length > 0) {
      score = (passedRules.length / activeRules.length) * 60;
    }

    // Bonus for length beyond minimum
    if (password.length > policy.minLength) {
      score += Math.min((password.length - policy.minLength) * 2, 20);
    }

    // Bonus for character variety
    let variety = 0;
    if (/[A-Z]/.test(password)) variety++;
    if (/[a-z]/.test(password)) variety++;
    if (/[0-9]/.test(password)) variety++;
    if (/[^A-Za-z0-9]/.test(password)) variety++;
    score += variety * 5;

    this.strengthScore = Math.min(Math.round(score), 100);

    if (this.strengthScore < 25) {
      this.strengthLabel = 'Weak';
      this.strengthClass = 'strength-weak';
    } else if (this.strengthScore < 50) {
      this.strengthLabel = 'Fair';
      this.strengthClass = 'strength-fair';
    } else if (this.strengthScore < 75) {
      this.strengthLabel = 'Good';
      this.strengthClass = 'strength-good';
    } else {
      this.strengthLabel = 'Strong';
      this.strengthClass = 'strength-strong';
    }
  }

  trackByRuleLabel(index: number, rule: PasswordRule): string {
    return rule.label;
  }
}
