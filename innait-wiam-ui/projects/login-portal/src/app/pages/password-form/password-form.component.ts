import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-password-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, PasswordModule, RouterLink, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout [title]="'auth.password' | translate" [subtitle]="'auth.enterPassword' | translate">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" role="form" aria-label="Password entry">
        <div class="field">
          <label for="password" class="block mb-2 font-medium">{{ 'auth.password' | translate }}</label>
          <div class="p-inputgroup">
            <input
              id="password"
              pInputText
              formControlName="password"
              [type]="showPassword ? 'text' : 'password'"
              [placeholder]="'auth.enterPassword' | translate"
              class="w-full"
              autocomplete="off"
              aria-required="true"
              autofocus
              [attr.aria-invalid]="form.get('password')?.invalid && form.get('password')?.touched"
            />
            <button
              type="button"
              pButton
              [icon]="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"
              class="p-button-text"
              (click)="showPassword = !showPassword"
              [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
            ></button>
          </div>
          <small class="caps-lock-warning" *ngIf="capsLockOn" role="alert">
            <i class="pi pi-exclamation-triangle"></i> Caps Lock is on
          </small>
          <small class="p-error block mt-1" *ngIf="form.get('password')?.touched && form.get('password')?.hasError('required')">
            {{ 'common.required' | translate }}
          </small>
        </div>
        <p-button
          type="submit"
          [label]="'auth.login' | translate"
          styleClass="w-full mt-3"
          [disabled]="form.invalid || loading"
          [loading]="loading"
        />
        <p *ngIf="errorMessage" class="p-error mt-2 text-center" role="alert">{{ errorMessage }}</p>
        <div class="mt-3 text-center">
          <a routerLink="/login" class="text-link">{{ 'common.back' | translate }}</a>
          <span class="mx-2">|</span>
          <a href="javascript:void(0)" class="text-link" (click)="onForgotPassword()">{{ 'auth.forgotPassword' | translate }}</a>
        </div>
      </form>
    </app-login-layout>
  `,
  styles: [`
    .caps-lock-warning {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: 0.25rem;
      color: var(--orange-500, #f59e0b);
      font-size: 0.75rem;
    }
    .text-link {
      color: var(--innait-primary);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .text-link:hover { text-decoration: underline; }
    .field { margin-bottom: 1rem; }
  `],
})
export class PasswordFormComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = '';
  showPassword = false;
  capsLockOn = false;
  private failedAttempts = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    // Redirect if no txnId (user jumped directly to this page)
    if (!this.authService.currentState.txnId) {
      this.router.navigate(['/login']);
      return;
    }

    this.form = this.fb.group({
      password: ['', [Validators.required]],
    });
  }

  @HostListener('window:keydown', ['$event'])
  @HostListener('window:keyup', ['$event'])
  onKeyEvent(event: KeyboardEvent): void {
    this.capsLockOn = event.getModifierState?.('CapsLock') ?? false;
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.errorMessage = '';
    const txnId = this.authService.currentState.txnId!;
    const password = this.form.get('password')?.value;

    // Progressive delay after failed attempts
    const delay = Math.min(this.failedAttempts * 1000, 5000);
    setTimeout(() => {
      this.authService.submitPrimary(txnId, 'PASSWORD', { password }).subscribe({
        next: (response) => {
          this.loading = false;
          this.failedAttempts = 0;

          switch (response.status) {
            case 'AUTHENTICATED':
              this.router.navigate(['/login/complete']);
              break;
            case 'MFA_REQUIRED':
              this.router.navigate(['/login/mfa-select']);
              break;
            case 'ACCOUNT_LOCKED':
              this.router.navigate(['/login/locked']);
              break;
            case 'PASSWORD_EXPIRED':
              this.router.navigate(['/login/password-expired']);
              break;
            case 'ONBOARDING_REQUIRED':
              this.router.navigate(['/login/onboarding']);
              break;
            default:
              this.router.navigate(['/login/error']);
          }
        },
        error: () => {
          this.loading = false;
          this.failedAttempts++;
          this.errorMessage = 'Invalid credentials. Please try again.';
          this.form.get('password')?.reset();
        },
      });
    }, delay);
  }

  onForgotPassword(): void {
    // Would navigate to forgot-password flow in self-service portal
    window.location.href = '/self-service/forgot-password';
  }
}
