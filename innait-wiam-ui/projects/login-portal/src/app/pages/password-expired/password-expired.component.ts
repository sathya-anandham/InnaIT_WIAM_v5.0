import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { ProgressBarModule } from 'primeng/progressbar';
import { AuthService, ApiResponse } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-password-expired',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, PasswordModule, ProgressBarModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout [title]="'auth.passwordExpired' | translate" subtitle="Your password has expired. Please create a new one.">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" role="form" aria-label="Change expired password">
        <div class="field">
          <label for="currentPassword" class="block mb-2 font-medium">Current Password</label>
          <input
            id="currentPassword"
            pInputText
            formControlName="currentPassword"
            type="password"
            class="w-full"
            autocomplete="off"
            aria-required="true"
          />
        </div>

        <div class="field">
          <label for="newPassword" class="block mb-2 font-medium">{{ 'selfService.newPassword' | translate }}</label>
          <div class="p-inputgroup">
            <input
              id="newPassword"
              pInputText
              formControlName="newPassword"
              [type]="showNew ? 'text' : 'password'"
              class="w-full"
              autocomplete="off"
              aria-required="true"
              (input)="updateStrength()"
            />
            <button type="button" pButton [icon]="showNew ? 'pi pi-eye-slash' : 'pi pi-eye'" class="p-button-text"
              (click)="showNew = !showNew" [attr.aria-label]="showNew ? 'Hide password' : 'Show password'"></button>
          </div>
          <p-progressBar [value]="strength" [showValue]="false" [style]="{ height: '4px', marginTop: '0.5rem' }"
            [styleClass]="strengthClass" />
          <small [class]="'block mt-1 ' + strengthClass">{{ strengthLabel }}</small>
        </div>

        <div class="field">
          <label for="confirmPassword" class="block mb-2 font-medium">{{ 'selfService.confirmPassword' | translate }}</label>
          <input
            id="confirmPassword"
            pInputText
            formControlName="confirmPassword"
            type="password"
            class="w-full"
            autocomplete="off"
            aria-required="true"
          />
          <small class="p-error block mt-1"
            *ngIf="form.get('confirmPassword')?.touched && form.hasError('passwordMismatch')">
            {{ 'selfService.passwordMismatch' | translate }}
          </small>
        </div>

        <div class="policy-rules">
          <p class="text-sm font-medium mb-1">Password requirements:</p>
          <div class="rule" [class.met]="hasMinLength"><i [class]="hasMinLength ? 'pi pi-check' : 'pi pi-times'"></i> At least 8 characters</div>
          <div class="rule" [class.met]="hasUppercase"><i [class]="hasUppercase ? 'pi pi-check' : 'pi pi-times'"></i> One uppercase letter</div>
          <div class="rule" [class.met]="hasLowercase"><i [class]="hasLowercase ? 'pi pi-check' : 'pi pi-times'"></i> One lowercase letter</div>
          <div class="rule" [class.met]="hasDigit"><i [class]="hasDigit ? 'pi pi-check' : 'pi pi-times'"></i> One number</div>
          <div class="rule" [class.met]="hasSpecial"><i [class]="hasSpecial ? 'pi pi-check' : 'pi pi-times'"></i> One special character</div>
        </div>

        <p-button
          type="submit"
          label="Change Password"
          styleClass="w-full mt-3"
          [disabled]="form.invalid || loading"
          [loading]="loading"
        />
        <p *ngIf="errorMessage" class="p-error mt-2 text-center" role="alert">{{ errorMessage }}</p>
        <p *ngIf="successMessage" class="text-success mt-2 text-center" role="status">{{ successMessage }}</p>
      </form>
    </app-login-layout>
  `,
  styles: [`
    .field { margin-bottom: 1rem; }
    .policy-rules { padding: 0.75rem; background: var(--surface-ground, #f8f9fa); border-radius: 8px; margin-top: 0.5rem; }
    .rule { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--red-500); padding: 0.15rem 0; }
    .rule.met { color: var(--green-500); }
    .text-sm { font-size: 0.875rem; }
    .text-success { color: var(--green-600); }
    :host ::ng-deep .strength-weak .p-progressbar-value { background: var(--red-500); }
    :host ::ng-deep .strength-fair .p-progressbar-value { background: var(--orange-500); }
    :host ::ng-deep .strength-good .p-progressbar-value { background: var(--yellow-500); }
    :host ::ng-deep .strength-strong .p-progressbar-value { background: var(--green-500); }
  `],
})
export class PasswordExpiredComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';
  showNew = false;
  strength = 0;
  strengthLabel = '';
  strengthClass = '';
  hasMinLength = false;
  hasUppercase = false;
  hasLowercase = false;
  hasDigit = false;
  hasSpecial = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: this.passwordMatchValidator });
  }

  updateStrength(): void {
    const pw = this.form.get('newPassword')?.value ?? '';
    this.hasMinLength = pw.length >= 8;
    this.hasUppercase = /[A-Z]/.test(pw);
    this.hasLowercase = /[a-z]/.test(pw);
    this.hasDigit = /[0-9]/.test(pw);
    this.hasSpecial = /[^A-Za-z0-9]/.test(pw);

    const checks = [this.hasMinLength, this.hasUppercase, this.hasLowercase, this.hasDigit, this.hasSpecial];
    const met = checks.filter(Boolean).length;
    this.strength = (met / 5) * 100;

    if (met <= 2) { this.strengthLabel = 'Weak'; this.strengthClass = 'strength-weak'; }
    else if (met === 3) { this.strengthLabel = 'Fair'; this.strengthClass = 'strength-fair'; }
    else if (met === 4) { this.strengthLabel = 'Good'; this.strengthClass = 'strength-good'; }
    else { this.strengthLabel = 'Strong'; this.strengthClass = 'strength-strong'; }
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const accountId = this.authService.currentState.accountId;
    const payload = {
      currentPassword: this.form.get('currentPassword')?.value,
      newPassword: this.form.get('newPassword')?.value,
    };

    this.http.post<ApiResponse<unknown>>(`/api/v1/credentials/password/change`, {
      accountId,
      ...payload,
    }).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Password changed successfully. Redirecting...';
        setTimeout(() => this.router.navigate(['/login/complete']), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.error?.message ?? 'Failed to change password. Please try again.';
      },
    });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPw = control.get('newPassword')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return newPw && confirm && newPw !== confirm ? { passwordMismatch: true } : null;
  }
}
