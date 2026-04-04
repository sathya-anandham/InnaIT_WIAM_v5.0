import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize, timer, switchMap, takeWhile } from 'rxjs';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

interface SoftTokenStatus {
  activated: boolean;
  activatedAt: string;
  deviceName: string;
  lastUsedAt: string;
}

interface TestStatus {
  status: 'PENDING' | 'APPROVED' | 'TIMEOUT' | 'DENIED';
}

@Component({
  selector: 'app-softtoken-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div class="softtoken-management" role="region" aria-label="Soft Token Management">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>{{ 'mfa.softtoken.management.title' | translate }}</h2>
          </div>
        </ng-template>

        <!-- Loading State -->
        <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading soft token status">
          <p-progressSpinner strokeWidth="3" aria-label="Loading"></p-progressSpinner>
          <p>{{ 'common.loading' | translate }}</p>
        </div>

        <!-- Error State -->
        <p-message
          *ngIf="errorMessage && !loading"
          severity="error"
          [text]="errorMessage"
          (onClose)="errorMessage = ''"
          role="alert">
        </p-message>

        <!-- Activated State -->
        <div *ngIf="!loading && !errorMessage && tokenStatus?.activated" class="activated-section">
          <div class="status-badge activated" role="status">
            <i class="pi pi-check-circle" aria-hidden="true"></i>
            <span>{{ 'mfa.softtoken.management.active' | translate }}</span>
          </div>

          <div class="token-details">
            <div class="detail-row">
              <span class="detail-label">{{ 'mfa.softtoken.management.deviceName' | translate }}</span>
              <span class="detail-value">{{ tokenStatus!.deviceName }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ 'mfa.softtoken.management.activatedAt' | translate }}</span>
              <span class="detail-value">{{ tokenStatus!.activatedAt | date:'medium' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ 'mfa.softtoken.management.lastUsedAt' | translate }}</span>
              <span class="detail-value">{{ tokenStatus!.lastUsedAt ? (tokenStatus!.lastUsedAt | date:'medium') : ('common.never' | translate) }}</span>
            </div>
          </div>

          <!-- Test Token Section -->
          <div class="actions-section">
            <button
              pButton
              type="button"
              [label]="'mfa.softtoken.management.testToken' | translate"
              icon="pi pi-send"
              class="p-button-outlined"
              (click)="testToken()"
              [disabled]="testing"
              aria-label="Send test push notification">
            </button>
            <button
              pButton
              type="button"
              [label]="'mfa.softtoken.management.deactivate' | translate"
              icon="pi pi-trash"
              class="p-button-danger p-button-outlined"
              (click)="showDeactivateDialog = true"
              [disabled]="testing"
              aria-label="Deactivate soft token">
            </button>
          </div>

          <!-- Test In Progress -->
          <div *ngIf="testing" class="test-progress" role="status" aria-live="polite">
            <p-progressSpinner
              strokeWidth="3"
              [style]="{ width: '40px', height: '40px' }"
              aria-label="Waiting for push notification approval">
            </p-progressSpinner>
            <p>{{ 'mfa.softtoken.management.testWaiting' | translate }}</p>
            <small class="timeout-counter">{{ testTimeRemaining }}s {{ 'mfa.softtoken.management.remaining' | translate }}</small>
          </div>

          <!-- Test Result -->
          <p-message
            *ngIf="testResult === 'APPROVED'"
            severity="success"
            [text]="'mfa.softtoken.management.testSuccess' | translate"
            role="alert">
          </p-message>
          <p-message
            *ngIf="testResult === 'TIMEOUT'"
            severity="warn"
            [text]="'mfa.softtoken.management.testTimeout' | translate"
            role="alert">
          </p-message>
          <p-message
            *ngIf="testResult === 'DENIED'"
            severity="error"
            [text]="'mfa.softtoken.management.testDenied' | translate"
            role="alert">
          </p-message>

          <!-- Deactivation Success -->
          <p-message
            *ngIf="successMessage"
            severity="success"
            [text]="successMessage"
            (onClose)="successMessage = ''"
            role="alert">
          </p-message>
        </div>

        <!-- Not Activated State -->
        <div *ngIf="!loading && !errorMessage && tokenStatus && !tokenStatus.activated" class="not-activated-section">
          <div class="empty-state">
            <i class="pi pi-shield empty-icon" aria-hidden="true"></i>
            <h3>{{ 'mfa.softtoken.management.notConfigured' | translate }}</h3>
            <p>{{ 'mfa.softtoken.management.notConfiguredMessage' | translate }}</p>
            <a
              pButton
              [label]="'mfa.softtoken.management.activateLink' | translate"
              icon="pi pi-plus"
              routerLink="/mfa/softtoken"
              aria-label="Go to soft token activation page">
            </a>
          </div>
        </div>
      </p-card>

      <!-- Deactivate Confirmation Dialog -->
      <p-dialog
        [(visible)]="showDeactivateDialog"
        [modal]="true"
        [style]="{ width: '420px' }"
        [header]="'mfa.softtoken.management.deactivateDialog.title' | translate"
        aria-label="Confirm soft token deactivation">

        <div class="dialog-content">
          <p-message
            severity="warn"
            [text]="'mfa.softtoken.management.deactivateDialog.warning' | translate"
            role="alert">
          </p-message>

          <form [formGroup]="deactivateForm" class="deactivate-form">
            <label for="deactivate-password">{{ 'mfa.softtoken.management.deactivateDialog.passwordLabel' | translate }}</label>
            <input
              id="deactivate-password"
              pInputText
              type="password"
              formControlName="password"
              autocomplete="current-password"
              [placeholder]="'mfa.softtoken.management.deactivateDialog.passwordPlaceholder' | translate"
              aria-required="true"
              [attr.aria-invalid]="deactivateForm.get('password')?.invalid && deactivateForm.get('password')?.touched"
              class="w-full" />
            <small
              *ngIf="deactivateForm.get('password')?.invalid && deactivateForm.get('password')?.touched"
              class="p-error"
              role="alert">
              {{ 'common.passwordRequired' | translate }}
            </small>
          </form>

          <p-message
            *ngIf="deactivateError"
            severity="error"
            [text]="deactivateError"
            role="alert">
          </p-message>
        </div>

        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            [label]="'common.cancel' | translate"
            icon="pi pi-times"
            class="p-button-text"
            (click)="cancelDeactivation()"
            aria-label="Cancel deactivation">
          </button>
          <button
            pButton
            type="button"
            [label]="'mfa.softtoken.management.deactivateDialog.confirm' | translate"
            icon="pi pi-trash"
            class="p-button-danger"
            (click)="confirmDeactivation()"
            [loading]="deactivating"
            [disabled]="deactivateForm.invalid || deactivating"
            aria-label="Confirm deactivation">
          </button>
        </ng-template>
      </p-dialog>
    </div>
  `,
  styles: [`
    .softtoken-management {
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
      padding: 2rem 0;
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

    .status-badge.activated {
      background: rgba(76, 175, 80, 0.1);
      color: #2e7d32;
    }

    .token-details {
      background: var(--innait-bg);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.625rem 0;
    }

    .detail-row:not(:last-child) {
      border-bottom: 1px solid #e0e0e0;
    }

    .detail-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--innait-text-secondary);
    }

    .detail-value {
      font-size: 0.875rem;
      color: var(--innait-text);
    }

    .actions-section {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .test-progress {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem 0;
      color: var(--innait-text-secondary);
    }

    .test-progress p {
      margin: 0;
      font-weight: 500;
    }

    .timeout-counter {
      color: var(--innait-text-secondary);
      font-size: 0.8rem;
    }

    .not-activated-section .empty-state {
      text-align: center;
      padding: 2rem 0;
    }

    .empty-icon {
      font-size: 3rem;
      color: var(--innait-text-secondary);
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      font-size: 1.25rem;
      color: var(--innait-text);
      margin: 0 0 0.5rem;
    }

    .empty-state p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
    }

    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .deactivate-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .deactivate-form label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--innait-text);
    }

    .w-full {
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
export class SoftTokenManagementComponent implements OnInit, OnDestroy {
  tokenStatus: SoftTokenStatus | null = null;
  loading = false;
  errorMessage = '';
  successMessage = '';

  testing = false;
  testResult: 'APPROVED' | 'TIMEOUT' | 'DENIED' | null = null;
  testTimeRemaining = 30;

  showDeactivateDialog = false;
  deactivating = false;
  deactivateError = '';
  deactivateForm!: FormGroup;

  private readonly destroy$ = new Subject<void>();
  private readonly testCancel$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/mfa/softtoken';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.deactivateForm = this.fb.group({
      password: ['', [Validators.required]],
    });

    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.testCancel$.next();
    this.testCancel$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStatus(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<SoftTokenStatus>(this.API_BASE)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false),
      )
      .subscribe({
        next: (status) => {
          this.tokenStatus = status;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load soft token status. Please try again.';
        },
      });
  }

  testToken(): void {
    this.testing = true;
    this.testResult = null;
    this.testTimeRemaining = 30;

    this.http.post<void>(`${this.API_BASE}/test`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.pollTestStatus();
        },
        error: (err) => {
          this.testing = false;
          this.errorMessage = err?.error?.message || 'Failed to send test push notification.';
        },
      });
  }

  private pollTestStatus(): void {
    const maxPolls = 15; // 15 polls * 2 seconds = 30 seconds
    let pollCount = 0;

    timer(0, 2000).pipe(
      takeUntil(this.destroy$),
      takeUntil(this.testCancel$),
      takeWhile(() => pollCount < maxPolls),
      switchMap(() => {
        pollCount++;
        this.testTimeRemaining = Math.max(0, 30 - (pollCount * 2));
        return this.http.get<TestStatus>(`${this.API_BASE}/test/status`);
      }),
    ).subscribe({
      next: (result) => {
        if (result.status === 'APPROVED' || result.status === 'DENIED') {
          this.testing = false;
          this.testResult = result.status;
          this.testCancel$.next();
        } else if (pollCount >= maxPolls) {
          this.testing = false;
          this.testResult = 'TIMEOUT';
        }
      },
      error: () => {
        this.testing = false;
        this.testResult = 'TIMEOUT';
      },
      complete: () => {
        if (this.testing) {
          this.testing = false;
          this.testResult = 'TIMEOUT';
        }
      },
    });
  }

  confirmDeactivation(): void {
    if (this.deactivateForm.invalid) {
      this.deactivateForm.markAllAsTouched();
      return;
    }

    this.deactivating = true;
    this.deactivateError = '';

    const password = this.deactivateForm.get('password')?.value;

    this.http.delete(this.API_BASE, { body: { password } })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.deactivating = false),
      )
      .subscribe({
        next: () => {
          this.showDeactivateDialog = false;
          this.deactivateForm.reset();
          this.successMessage = 'Soft token has been deactivated successfully.';
          this.loadStatus();
        },
        error: (err) => {
          this.deactivateError = err?.error?.message || 'Deactivation failed. Please check your password and try again.';
        },
      });
  }

  cancelDeactivation(): void {
    this.showDeactivateDialog = false;
    this.deactivateForm.reset();
    this.deactivateError = '';
  }
}
