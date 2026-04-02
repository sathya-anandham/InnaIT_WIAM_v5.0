import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-backup-code-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout title="Backup Code" [subtitle]="'auth.enterBackupCode' | translate">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" role="form" aria-label="Backup code entry">
        <div class="field">
          <label for="backupCode" class="block mb-2 font-medium">{{ 'credential.backupCodes' | translate }}</label>
          <input
            id="backupCode"
            pInputText
            formControlName="backupCode"
            placeholder="XXXX-XXXX"
            class="w-full backup-code-input"
            autocomplete="off"
            autofocus
            maxlength="9"
            aria-required="true"
            [attr.aria-invalid]="form.get('backupCode')?.invalid && form.get('backupCode')?.touched"
          />
          <small class="p-error block mt-1"
            *ngIf="form.get('backupCode')?.touched && form.get('backupCode')?.hasError('required')">
            {{ 'common.required' | translate }}
          </small>
          <small class="p-error block mt-1"
            *ngIf="form.get('backupCode')?.touched && form.get('backupCode')?.hasError('minlength')">
            Code must be at least 8 characters
          </small>
        </div>
        <p-button
          type="submit"
          [label]="'common.submit' | translate"
          styleClass="w-full mt-3"
          [disabled]="form.invalid || loading"
          [loading]="loading"
        />
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
    .field { margin-bottom: 1rem; }
    .backup-code-input {
      text-align: center;
      font-family: 'Courier New', monospace;
      font-size: 1.25rem;
      letter-spacing: 0.15rem;
      text-transform: uppercase;
    }
  `],
})
export class BackupCodeFormComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    if (!this.authService.currentState.txnId) {
      this.router.navigate(['/login']);
      return;
    }

    this.form = this.fb.group({
      backupCode: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.errorMessage = '';
    const code = this.form.get('backupCode')?.value?.replace(/[-\s]/g, '').trim();
    const txnId = this.authService.currentState.txnId!;

    this.authService.submitMfa(txnId, 'BACKUP_CODE', { code }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.status === 'AUTHENTICATED') {
          this.router.navigate(['/login/complete']);
        }
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Invalid backup code. Please try again.';
        this.form.get('backupCode')?.reset();
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/login/mfa-select']);
  }
}
