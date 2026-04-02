import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-totp-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout title="Authenticator Code" [subtitle]="'auth.enterOtp' | translate">
      <form (ngSubmit)="onSubmit()" role="form" aria-label="TOTP verification">
        <div class="otp-container" role="group" aria-label="Enter 6-digit code">
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

        <div class="timer-row" *ngIf="timeRemaining > 0">
          <i class="pi pi-clock"></i>
          <span>Code expires in {{ timeRemaining }}s</span>
        </div>
        <div class="timer-row expired" *ngIf="timeRemaining <= 0">
          <i class="pi pi-exclamation-triangle"></i>
          <span>Code may have expired</span>
        </div>

        <p *ngIf="errorMessage" class="p-error mt-2 text-center" role="alert">{{ errorMessage }}</p>

        <div class="mt-3 text-center">
          <p-button
            [label]="'common.back' | translate"
            severity="secondary"
            size="small"
            (onClick)="goBack()"
          />
        </div>
      </form>
    </app-login-layout>
  `,
  styles: [`
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
      border-color: var(--innait-primary);
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
    }
    .timer-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--innait-text-secondary);
    }
    .timer-row.expired { color: var(--orange-500, #f59e0b); }
    @media (max-width: 380px) {
      .otp-digit { width: 40px; height: 48px; font-size: 1.25rem; }
    }
  `],
})
export class TotpInputComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  digitIndices = [0, 1, 2, 3, 4, 5];
  digits: string[] = ['', '', '', '', '', ''];
  timeRemaining = 30;
  errorMessage = '';
  loading = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    if (!this.authService.currentState.txnId) {
      this.router.navigate(['/login']);
      return;
    }
    this.startTimer();
  }

  ngAfterViewInit(): void {
    // Focus first input
    setTimeout(() => this.otpInputs?.first?.nativeElement?.focus(), 100);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/[^0-9]/g, '');
    input.value = value;
    this.digits[index] = value;

    if (value && index < 5) {
      // Auto-advance to next field
      const inputs = this.otpInputs.toArray();
      inputs[index + 1]?.nativeElement?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (this.digits.every((d) => d.length === 1)) {
      this.submitCode();
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
      this.submitCode();
    }
  }

  onSubmit(): void {
    if (this.digits.every((d) => d.length === 1)) {
      this.submitCode();
    }
  }

  goBack(): void {
    this.router.navigate(['/login/mfa-select']);
  }

  private submitCode(): void {
    if (this.loading) return;
    this.loading = true;
    this.errorMessage = '';

    const code = this.digits.join('');
    const txnId = this.authService.currentState.txnId!;

    this.authService.submitMfa(txnId, 'TOTP', { code }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.status === 'AUTHENTICATED') {
          this.router.navigate(['/login/complete']);
        }
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Invalid code. Please try again.';
        this.clearDigits();
      },
    });
  }

  private clearDigits(): void {
    this.digits = ['', '', '', '', '', ''];
    const inputs = this.otpInputs.toArray();
    inputs.forEach((input) => (input.nativeElement.value = ''));
    inputs[0]?.nativeElement?.focus();
  }

  private startTimer(): void {
    this.timeRemaining = 30;
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0 && this.timerInterval) {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }
}
