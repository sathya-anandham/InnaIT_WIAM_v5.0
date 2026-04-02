import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { StepsModule } from 'primeng/steps';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressBarModule } from 'primeng/progressbar';
import { MenuItem } from 'primeng/api';
import { AuthService, ApiResponse } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, StepsModule, CheckboxModule, ProgressBarModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout [title]="'onboarding.welcome' | translate">
      <p-steps [model]="steps" [activeIndex]="activeStep" [readonly]="true" styleClass="mb-4" />

      <!-- Step 0: Accept Terms -->
      <div *ngIf="activeStep === 0" class="step-content">
        <h3>{{ 'onboarding.acceptTerms' | translate }}</h3>
        <div class="terms-box">
          <p>By proceeding, you agree to the InnaIT WIAM Terms of Service and Privacy Policy.
          You acknowledge that your identity information will be managed within this platform
          in compliance with your organization's security policies.</p>
        </div>
        <div class="flex align-items-center gap-2 mt-3">
          <p-checkbox [(ngModel)]="termsAccepted" [binary]="true" inputId="terms" />
          <label for="terms">I accept the Terms & Conditions</label>
        </div>
        <p-button label="Continue" styleClass="w-full mt-3" [disabled]="!termsAccepted" (onClick)="acceptTerms()" [loading]="loading" />
      </div>

      <!-- Step 1: Set Password -->
      <div *ngIf="activeStep === 1" class="step-content">
        <h3>{{ 'onboarding.setPassword' | translate }}</h3>
        <form [formGroup]="passwordForm">
          <div class="field">
            <label for="newPassword" class="block mb-2 font-medium">{{ 'selfService.newPassword' | translate }}</label>
            <div class="p-inputgroup">
              <input id="newPassword" pInputText formControlName="newPassword"
                [type]="showPassword ? 'text' : 'password'" class="w-full" autocomplete="off" aria-required="true" />
              <button type="button" pButton [icon]="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" class="p-button-text"
                (click)="showPassword = !showPassword"></button>
            </div>
          </div>
          <div class="field">
            <label for="confirmPw" class="block mb-2 font-medium">{{ 'selfService.confirmPassword' | translate }}</label>
            <input id="confirmPw" pInputText formControlName="confirmPassword" type="password" class="w-full" autocomplete="off" aria-required="true" />
            <small class="p-error block mt-1"
              *ngIf="passwordForm.get('confirmPassword')?.touched && passwordForm.hasError('passwordMismatch')">
              {{ 'selfService.passwordMismatch' | translate }}
            </small>
          </div>
          <p-button label="Set Password" styleClass="w-full mt-3" [disabled]="passwordForm.invalid" (onClick)="setPassword()" [loading]="loading" />
        </form>
      </div>

      <!-- Step 2: Enroll MFA -->
      <div *ngIf="activeStep === 2" class="step-content">
        <h3>{{ 'onboarding.enrollMfa' | translate }}</h3>
        <p>Set up multi-factor authentication to secure your account. We recommend using an authenticator app.</p>
        <div class="mfa-options mt-3">
          <button class="mfa-option" (click)="enrollMfa('TOTP')" [disabled]="loading">
            <i class="pi pi-mobile" style="font-size: 1.5rem"></i>
            <span>Authenticator App</span>
          </button>
          <button class="mfa-option" (click)="enrollMfa('FIDO')" [disabled]="loading">
            <i class="pi pi-key" style="font-size: 1.5rem"></i>
            <span>Security Key</span>
          </button>
        </div>
        <p *ngIf="mfaEnrolled" class="text-success mt-2 text-center" role="status">
          <i class="pi pi-check-circle"></i> MFA enrolled successfully
        </p>
        <p-button *ngIf="mfaEnrolled" label="Continue" styleClass="w-full mt-3" (onClick)="activeStep = 3" />
      </div>

      <!-- Step 3: Complete -->
      <div *ngIf="activeStep === 3" class="step-content">
        <div class="complete-container">
          <div class="success-icon">
            <i class="pi pi-check" style="font-size: 2.5rem; color: white"></i>
          </div>
          <h3 class="mt-3">{{ 'onboarding.complete' | translate }}</h3>
          <p>Your account is now fully set up. You can start using InnaIT WIAM.</p>
          <p-button label="Get Started" styleClass="w-full mt-3" (onClick)="completeOnboarding()" [loading]="loading" />
        </div>
      </div>

      <p *ngIf="errorMessage" class="p-error mt-2 text-center" role="alert">{{ errorMessage }}</p>
    </app-login-layout>
  `,
  styles: [`
    .step-content { min-height: 200px; }
    .field { margin-bottom: 1rem; }
    .terms-box {
      max-height: 150px; overflow-y: auto; padding: 1rem;
      border: 1px solid var(--surface-border); border-radius: 8px;
      font-size: 0.875rem; color: var(--innait-text-secondary);
      background: var(--surface-ground, #f8f9fa);
    }
    .mfa-options { display: flex; gap: 1rem; justify-content: center; }
    .mfa-option {
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
      padding: 1.5rem 2rem; border: 2px solid var(--surface-border);
      border-radius: 8px; background: white; cursor: pointer;
      transition: border-color 0.2s;
    }
    .mfa-option:hover { border-color: var(--innait-primary); }
    .mfa-option:disabled { opacity: 0.6; cursor: not-allowed; }
    .complete-container { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .success-icon {
      width: 72px; height: 72px; border-radius: 50%;
      background: var(--green-500, #22c55e);
      display: flex; align-items: center; justify-content: center;
    }
    .text-success { color: var(--green-600); }
  `],
})
export class OnboardingWizardComponent implements OnInit {
  steps: MenuItem[] = [
    { label: 'Terms' },
    { label: 'Password' },
    { label: 'MFA' },
    { label: 'Complete' },
  ];
  activeStep = 0;
  termsAccepted = false;
  showPassword = false;
  mfaEnrolled = false;
  loading = false;
  errorMessage = '';
  passwordForm!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: this.passwordMatchValidator });
  }

  acceptTerms(): void {
    this.loading = true;
    this.errorMessage = '';
    const accountId = this.authService.currentState.accountId;

    this.http.post<ApiResponse<unknown>>('/api/v1/self/onboarding/accept-terms', { accountId }).subscribe({
      next: () => { this.loading = false; this.activeStep = 1; },
      error: (err) => { this.loading = false; this.errorMessage = err.error?.error?.message ?? 'Failed to accept terms'; },
    });
  }

  setPassword(): void {
    if (this.passwordForm.invalid) return;
    this.loading = true;
    this.errorMessage = '';

    const accountId = this.authService.currentState.accountId;
    this.http.post<ApiResponse<unknown>>('/api/v1/self/onboarding/set-password', {
      accountId,
      newPassword: this.passwordForm.get('newPassword')?.value,
    }).subscribe({
      next: () => { this.loading = false; this.activeStep = 2; },
      error: (err) => { this.loading = false; this.errorMessage = err.error?.error?.message ?? 'Failed to set password'; },
    });
  }

  enrollMfa(type: string): void {
    this.loading = true;
    this.errorMessage = '';

    const accountId = this.authService.currentState.accountId;
    this.http.post<ApiResponse<unknown>>('/api/v1/self/onboarding/enroll-mfa', {
      accountId,
      mfaType: type,
    }).subscribe({
      next: () => { this.loading = false; this.mfaEnrolled = true; },
      error: (err) => { this.loading = false; this.errorMessage = err.error?.error?.message ?? 'Failed to enroll MFA'; },
    });
  }

  completeOnboarding(): void {
    this.loading = true;
    this.errorMessage = '';

    const accountId = this.authService.currentState.accountId;
    this.http.post<ApiResponse<unknown>>('/api/v1/self/onboarding/complete', { accountId }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/login/complete']);
      },
      error: (err) => { this.loading = false; this.errorMessage = err.error?.error?.message ?? 'Failed to complete onboarding'; },
    });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const pw = control.get('newPassword')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return pw && confirm && pw !== confirm ? { passwordMismatch: true } : null;
  }
}
