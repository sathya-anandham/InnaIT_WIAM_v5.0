import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

interface TotpStatus {
  enrolled: boolean;
  enrolledAt: string;
  lastUsedAt: string;
}

@Component({
  selector: 'app-totp-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    DialogModule,
    InputTextModule,
    TranslatePipe,
  ],
  template: `
    <div class="totp-management" role="region" aria-label="TOTP Management">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>{{ 'mfa.totp.manage.title' | translate }}</h2>
          </div>
        </ng-template>

        <!-- Loading State -->
        <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading TOTP status">
          <p-progressSpinner strokeWidth="3" aria-label="Loading"></p-progressSpinner>
          <p>{{ 'mfa.totp.manage.loading' | translate }}</p>
        </div>

        <!-- Error State -->
        <p-message
          *ngIf="errorMessage && !loading"
          severity="error"
          [text]="errorMessage"
          [closable]="true"
          (onClose)="errorMessage = ''"
          role="alert">
        </p-message>

        <!-- Enrolled State -->
        <div *ngIf="!loading && !errorMessage && totpStatus?.enrolled" class="enrolled-section">
          <div class="status-badge enrolled" role="status">
            <i class="pi pi-check-circle" aria-hidden="true"></i>
            <span>{{ 'mfa.totp.manage.enrolled' | translate }}</span>
          </div>

          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">{{ 'mfa.totp.manage.enrolledAt' | translate }}</span>
              <span class="detail-value">{{ totpStatus!.enrolledAt | date:'medium' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">{{ 'mfa.totp.manage.lastUsed' | translate }}</span>
              <span class="detail-value">
                {{ totpStatus!.lastUsedAt ? (totpStatus!.lastUsedAt | date:'medium') : ('mfa.totp.manage.neverUsed' | translate) }}
              </span>
            </div>
          </div>

          <div class="action-buttons">
            <a
              pButton
              class="p-button-outlined"
              [label]="'mfa.totp.manage.reEnrollButton' | translate"
              icon="pi pi-refresh"
              routerLink="/mfa/totp"
              aria-label="Re-enroll TOTP authenticator">
            </a>
            <button
              pButton
              class="p-button-danger"
              [label]="'mfa.totp.manage.removeButton' | translate"
              icon="pi pi-trash"
              (click)="showRemoveDialog()"
              [disabled]="removing"
              aria-label="Remove TOTP authenticator">
            </button>
          </div>

          <!-- Success message after actions -->
          <p-message
            *ngIf="successMessage"
            severity="success"
            [text]="successMessage"
            [closable]="true"
            (onClose)="successMessage = ''"
            role="status">
          </p-message>
        </div>

        <!-- Not Enrolled State -->
        <div *ngIf="!loading && !errorMessage && totpStatus && !totpStatus.enrolled" class="not-enrolled-section">
          <div class="empty-state">
            <i class="pi pi-mobile empty-icon" aria-hidden="true"></i>
            <h3>{{ 'mfa.totp.manage.notConfigured.title' | translate }}</h3>
            <p>{{ 'mfa.totp.manage.notConfigured.message' | translate }}</p>
            <a
              pButton
              [label]="'mfa.totp.manage.notConfigured.enrollLink' | translate"
              icon="pi pi-plus"
              routerLink="/mfa/totp"
              aria-label="Set up TOTP authenticator">
            </a>
          </div>
        </div>
      </p-card>

      <!-- Remove Confirmation Dialog -->
      <p-dialog
        [(visible)]="removeDialogVisible"
        [header]="'mfa.totp.manage.removeDialog.title' | translate"
        [modal]="true"
        [closable]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '420px' }"
        (onHide)="onRemoveDialogHide()"
        role="dialog"
        aria-label="Confirm TOTP removal">

        <div class="remove-dialog-content">
          <p-message
            severity="warn"
            [text]="'mfa.totp.manage.removeDialog.warning' | translate">
          </p-message>

          <form [formGroup]="removeForm" class="remove-form">
            <label for="confirm-password">{{ 'mfa.totp.manage.removeDialog.passwordLabel' | translate }}</label>
            <input
              id="confirm-password"
              pInputText
              formControlName="password"
              type="password"
              autocomplete="current-password"
              [placeholder]="'mfa.totp.manage.removeDialog.passwordPlaceholder' | translate"
              aria-required="true"
              [attr.aria-invalid]="removeForm.get('password')?.invalid && removeForm.get('password')?.touched"
              class="full-width" />
            <small
              *ngIf="removeForm.get('password')?.invalid && removeForm.get('password')?.touched"
              class="p-error"
              role="alert">
              {{ 'mfa.totp.manage.removeDialog.passwordRequired' | translate }}
            </small>
          </form>

          <p-message
            *ngIf="removeErrorMessage"
            severity="error"
            [text]="removeErrorMessage"
            role="alert">
          </p-message>
        </div>

        <ng-template pTemplate="footer">
          <button
            pButton
            class="p-button-text"
            [label]="'common.cancel' | translate"
            icon="pi pi-times"
            (click)="removeDialogVisible = false"
            [disabled]="removing"
            aria-label="Cancel removal">
          </button>
          <button
            pButton
            class="p-button-danger"
            [label]="'mfa.totp.manage.removeDialog.confirmButton' | translate"
            icon="pi pi-trash"
            (click)="confirmRemove()"
            [loading]="removing"
            [disabled]="removeForm.invalid || removing"
            aria-label="Confirm TOTP removal">
          </button>
        </ng-template>
      </p-dialog>
    </div>
  `,
  styles: [`
    .totp-management {
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

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 3rem 0;
      color: var(--innait-text-secondary);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }

    .status-badge.enrolled {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-badge.enrolled .pi {
      color: #4caf50;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: var(--innait-bg);
      border-radius: 6px;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .detail-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--innait-text-secondary);
    }

    .detail-value {
      font-size: 0.9375rem;
      color: var(--innait-text);
    }

    .action-buttons {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
    }

    .empty-icon {
      font-size: 3rem;
      color: var(--innait-text-secondary);
      opacity: 0.5;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      font-size: 1.125rem;
      color: var(--innait-text);
      margin: 0 0 0.5rem;
    }

    .empty-state p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
    }

    .remove-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .remove-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .remove-form label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--innait-text);
    }

    .full-width {
      width: 100%;
    }

    .p-error {
      display: block;
    }

    :host ::ng-deep .p-message {
      width: 100%;
    }
  `],
})
export class TotpManagementComponent implements OnInit, OnDestroy {
  totpStatus: TotpStatus | null = null;
  loading = false;
  errorMessage = '';
  successMessage = '';

  removeDialogVisible = false;
  removing = false;
  removeErrorMessage = '';
  removeForm!: FormGroup;

  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/mfa/totp';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.removeForm = this.fb.group({
      password: ['', [Validators.required]],
    });

    this.loadTotpStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTotpStatus(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<TotpStatus>(this.API_BASE)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false),
      )
      .subscribe({
        next: (status) => {
          this.totpStatus = status;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load TOTP status. Please try again.';
        },
      });
  }

  showRemoveDialog(): void {
    this.removeForm.reset();
    this.removeErrorMessage = '';
    this.removeDialogVisible = true;
  }

  onRemoveDialogHide(): void {
    this.removeForm.reset();
    this.removeErrorMessage = '';
  }

  confirmRemove(): void {
    if (this.removeForm.invalid) {
      this.removeForm.markAllAsTouched();
      return;
    }

    this.removing = true;
    this.removeErrorMessage = '';

    const password = this.removeForm.get('password')?.value;

    this.http.delete(this.API_BASE, {
      body: { password },
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.removing = false),
      )
      .subscribe({
        next: () => {
          this.removeDialogVisible = false;
          this.successMessage = 'TOTP authenticator has been removed successfully.';
          this.loadTotpStatus();
        },
        error: (err) => {
          this.removeErrorMessage = err?.error?.message || 'Failed to remove TOTP. Please verify your password and try again.';
        },
      });
  }
}
