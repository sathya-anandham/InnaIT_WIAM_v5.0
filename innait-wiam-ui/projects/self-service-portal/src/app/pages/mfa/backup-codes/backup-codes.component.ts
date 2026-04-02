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
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

interface BackupCodesStatus {
  generated: boolean;
  generatedAt: string;
  totalCodes: number;
  remainingCodes: number;
}

interface BackupCodesGenerateResponse {
  codes: string[];
}

@Component({
  selector: 'app-backup-codes',
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
    <div class="backup-codes" role="region" aria-label="Backup Codes Management">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>{{ 'mfa.backupCodes.title' | translate }}</h2>
          </div>
        </ng-template>

        <!-- Loading state -->
        <div *ngIf="loading" class="loading-container">
          <p-progressSpinner
            strokeWidth="3"
            aria-label="Loading backup codes status">
          </p-progressSpinner>
          <p>{{ 'mfa.backupCodes.loading' | translate }}</p>
        </div>

        <!-- Error state -->
        <p-message
          *ngIf="errorMessage && !loading"
          severity="error"
          [text]="errorMessage"
          [closable]="true"
          (onClose)="errorMessage = ''"
          role="alert">
        </p-message>

        <!-- No codes generated -->
        <div *ngIf="!loading && status && !status.generated" class="no-codes-section">
          <div class="empty-state">
            <i class="pi pi-list empty-icon" aria-hidden="true"></i>
            <h3>{{ 'mfa.backupCodes.noCodes.heading' | translate }}</h3>
            <p>{{ 'mfa.backupCodes.noCodes.description' | translate }}</p>
            <button
              pButton
              type="button"
              [label]="'mfa.backupCodes.generateButton' | translate"
              icon="pi pi-plus"
              (click)="generateCodes()"
              [loading]="generating"
              [disabled]="generating"
              aria-label="Generate backup codes">
            </button>
          </div>
        </div>

        <!-- Codes exist - status view -->
        <div *ngIf="!loading && status?.generated && !revealedCodes" class="status-section">
          <div class="stats-grid" role="group" aria-label="Backup codes statistics">
            <div class="stat-card">
              <span class="stat-value">{{ status.totalCodes }}</span>
              <span class="stat-label">{{ 'mfa.backupCodes.stats.total' | translate }}</span>
            </div>
            <div class="stat-card" [class.stat-warning]="status.remainingCodes < 3">
              <span class="stat-value">{{ status.remainingCodes }}</span>
              <span class="stat-label">{{ 'mfa.backupCodes.stats.remaining' | translate }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-value stat-date">{{ status.generatedAt | date:'mediumDate' }}</span>
              <span class="stat-label">{{ 'mfa.backupCodes.stats.generatedOn' | translate }}</span>
            </div>
          </div>

          <p-message
            *ngIf="status.remainingCodes < 3"
            severity="warn"
            [text]="'mfa.backupCodes.fewRemainingWarning' | translate"
            role="alert"
            class="warning-message">
          </p-message>

          <div class="action-buttons">
            <button
              pButton
              type="button"
              [label]="'mfa.backupCodes.viewButton' | translate"
              icon="pi pi-eye"
              (click)="showPasswordDialog = true"
              aria-label="View backup codes">
            </button>
            <button
              pButton
              type="button"
              class="p-button-outlined p-button-danger"
              [label]="'mfa.backupCodes.regenerateButton' | translate"
              icon="pi pi-refresh"
              (click)="showRegenerateDialog = true"
              aria-label="Regenerate backup codes">
            </button>
          </div>
        </div>

        <!-- Codes revealed view -->
        <div *ngIf="revealedCodes" class="codes-section">
          <div class="codes-header">
            <h3>{{ 'mfa.backupCodes.yourCodes' | translate }}</h3>
            <p class="codes-instruction">{{ 'mfa.backupCodes.codesInstruction' | translate }}</p>
          </div>

          <div class="codes-grid" role="list" aria-label="Backup codes list">
            <div *ngFor="let code of revealedCodes; let i = index"
                 class="code-box"
                 role="listitem"
                 [attr.aria-label]="'Backup code ' + (i + 1) + ': ' + code">
              <span class="code-index">{{ i + 1 }}</span>
              <code class="code-value">{{ formatCode(code) }}</code>
            </div>
          </div>

          <div class="codes-actions">
            <button
              pButton
              type="button"
              [label]="'mfa.backupCodes.downloadButton' | translate"
              icon="pi pi-download"
              class="p-button-outlined"
              (click)="downloadCodes()"
              aria-label="Download backup codes as text file">
            </button>
            <button
              pButton
              type="button"
              [label]="'mfa.backupCodes.printButton' | translate"
              icon="pi pi-print"
              class="p-button-outlined"
              (click)="printCodes()"
              aria-label="Print backup codes">
            </button>
            <button
              pButton
              type="button"
              [label]="'mfa.backupCodes.hideButton' | translate"
              icon="pi pi-eye-slash"
              class="p-button-text"
              (click)="hideCodes()"
              aria-label="Hide backup codes">
            </button>
          </div>

          <p-message
            severity="warn"
            [text]="'mfa.backupCodes.saveWarning' | translate"
            role="alert"
            class="save-warning">
          </p-message>
        </div>
      </p-card>

      <!-- Password Confirmation Dialog -->
      <p-dialog
        [(visible)]="showPasswordDialog"
        [header]="'mfa.backupCodes.passwordDialog.title' | translate"
        [modal]="true"
        [closable]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '400px' }"
        aria-label="Confirm your password to view codes">
        <form [formGroup]="passwordForm" (ngSubmit)="revealCodes()">
          <div class="dialog-content">
            <p>{{ 'mfa.backupCodes.passwordDialog.message' | translate }}</p>
            <div class="form-field">
              <label for="confirm-password">{{ 'mfa.backupCodes.passwordDialog.label' | translate }}</label>
              <input
                id="confirm-password"
                pInputText
                type="password"
                formControlName="password"
                autocomplete="current-password"
                [placeholder]="'mfa.backupCodes.passwordDialog.placeholder' | translate"
                aria-required="true"
                [attr.aria-invalid]="passwordForm.get('password')?.invalid && passwordForm.get('password')?.touched"
                class="full-width" />
              <small
                *ngIf="passwordForm.get('password')?.invalid && passwordForm.get('password')?.touched"
                class="p-error"
                role="alert">
                {{ 'mfa.backupCodes.passwordDialog.required' | translate }}
              </small>
            </div>
            <p-message
              *ngIf="revealError"
              severity="error"
              [text]="revealError"
              role="alert"
              class="dialog-error">
            </p-message>
          </div>
          <div class="dialog-footer">
            <button
              pButton
              type="button"
              class="p-button-text"
              [label]="'common.cancel' | translate"
              (click)="closePasswordDialog()"
              aria-label="Cancel">
            </button>
            <button
              pButton
              type="submit"
              [label]="'mfa.backupCodes.passwordDialog.confirmButton' | translate"
              icon="pi pi-check"
              [loading]="revealing"
              [disabled]="passwordForm.invalid || revealing"
              aria-label="Confirm password and view codes">
            </button>
          </div>
        </form>
      </p-dialog>

      <!-- Regenerate Confirmation Dialog -->
      <p-dialog
        [(visible)]="showRegenerateDialog"
        [header]="'mfa.backupCodes.regenerateDialog.title' | translate"
        [modal]="true"
        [closable]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '450px' }"
        aria-label="Confirm code regeneration">
        <div class="dialog-content">
          <p-message
            severity="warn"
            [text]="'mfa.backupCodes.regenerateDialog.warning' | translate"
            role="alert">
          </p-message>
          <p class="regenerate-message">{{ 'mfa.backupCodes.regenerateDialog.message' | translate }}</p>
        </div>
        <div class="dialog-footer">
          <button
            pButton
            type="button"
            class="p-button-text"
            [label]="'common.cancel' | translate"
            (click)="showRegenerateDialog = false"
            aria-label="Cancel regeneration">
          </button>
          <button
            pButton
            type="button"
            class="p-button-danger"
            [label]="'mfa.backupCodes.regenerateDialog.confirmButton' | translate"
            icon="pi pi-refresh"
            [loading]="generating"
            [disabled]="generating"
            (click)="regenerateCodes()"
            aria-label="Confirm and regenerate codes">
          </button>
        </div>
      </p-dialog>
    </div>
  `,
  styles: [`
    .backup-codes {
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

    /* Empty state */
    .empty-state {
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
      margin: 0 0 0.5rem;
      color: var(--innait-text);
    }

    .empty-state p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.6;
    }

    /* Stats grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 1rem;
      background: var(--innait-bg);
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .stat-card.stat-warning {
      border-color: #f59e0b;
      background: #fffbeb;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--innait-text);
    }

    .stat-warning .stat-value {
      color: #d97706;
    }

    .stat-date {
      font-size: 0.95rem;
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--innait-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .warning-message {
      display: block;
      margin-bottom: 1.5rem;
    }

    .action-buttons {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    /* Codes display */
    .codes-section {
      padding: 0.5rem 0;
    }

    .codes-header {
      margin-bottom: 1rem;
    }

    .codes-header h3 {
      font-size: 1.1rem;
      margin: 0 0 0.25rem;
      color: var(--innait-text);
    }

    .codes-instruction {
      font-size: 0.875rem;
      color: var(--innait-text-secondary);
      margin: 0;
    }

    .codes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .code-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      background: var(--innait-bg);
      border: 1px solid #e0e0e0;
      border-radius: 6px;
    }

    .code-index {
      font-size: 0.75rem;
      color: var(--innait-text-secondary);
      min-width: 1.25rem;
      text-align: center;
    }

    .code-value {
      font-family: 'Courier New', monospace;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--innait-text);
      user-select: all;
    }

    .codes-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .save-warning {
      display: block;
    }

    /* Dialog styles */
    .dialog-content {
      padding: 0.5rem 0;
    }

    .dialog-content p {
      color: var(--innait-text-secondary);
      margin: 0 0 1rem;
      line-height: 1.5;
    }

    .form-field {
      margin-bottom: 0.5rem;
    }

    .form-field label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--innait-text);
    }

    .full-width {
      width: 100%;
    }

    .p-error {
      display: block;
      margin-top: 0.375rem;
    }

    .dialog-error {
      display: block;
      margin-top: 0.75rem;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
      margin-top: 1rem;
    }

    .regenerate-message {
      margin-top: 1rem !important;
    }

    @media (max-width: 576px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .codes-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Print styles */
    @media print {
      .action-buttons,
      .codes-actions,
      .card-header,
      .warning-message,
      .save-warning {
        display: none !important;
      }

      .codes-grid {
        break-inside: avoid;
      }

      .code-box {
        border: 1px solid #000;
      }
    }
  `],
})
export class BackupCodesComponent implements OnInit, OnDestroy {
  status: BackupCodesStatus | null = null;
  revealedCodes: string[] | null = null;

  loading = false;
  generating = false;
  revealing = false;
  errorMessage = '';
  revealError = '';

  showPasswordDialog = false;
  showRegenerateDialog = false;

  passwordForm!: FormGroup;

  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/mfa/backup-codes';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required]],
    });

    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formatCode(code: string): string {
    if (code.includes('-')) {
      return code;
    }
    const mid = Math.ceil(code.length / 2);
    return code.slice(0, mid) + '-' + code.slice(mid);
  }

  revealCodes(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.revealing = true;
    this.revealError = '';

    const password = this.passwordForm.get('password')?.value;

    this.http.post<BackupCodesGenerateResponse>(`${this.API_BASE}/reveal`, { password })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.revealing = false),
      )
      .subscribe({
        next: (response) => {
          this.revealedCodes = response.codes;
          this.closePasswordDialog();
        },
        error: (err) => {
          this.revealError = err?.error?.message || 'Incorrect password. Please try again.';
        },
      });
  }

  generateCodes(): void {
    this.generating = true;
    this.errorMessage = '';

    this.http.post<BackupCodesGenerateResponse>(`${this.API_BASE}/generate`, {})
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.generating = false),
      )
      .subscribe({
        next: (response) => {
          this.revealedCodes = response.codes;
          this.loadStatus();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to generate backup codes. Please try again.';
        },
      });
  }

  regenerateCodes(): void {
    this.generating = true;
    this.errorMessage = '';

    this.http.post<BackupCodesGenerateResponse>(`${this.API_BASE}/generate`, {})
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.generating = false;
          this.showRegenerateDialog = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.revealedCodes = response.codes;
          this.loadStatus();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to regenerate backup codes. Please try again.';
        },
      });
  }

  downloadCodes(): void {
    if (!this.revealedCodes) {
      return;
    }

    const header = 'InnaIT WIAM - Backup Codes';
    const separator = '='.repeat(35);
    const warning = 'Keep these codes in a safe place.\nEach code can only be used once.';
    const date = `Generated: ${new Date().toLocaleString()}`;
    const codesText = this.revealedCodes
      .map((code, i) => `${(i + 1).toString().padStart(2, ' ')}. ${this.formatCode(code)}`)
      .join('\n');

    const content = `${header}\n${separator}\n${warning}\n${date}\n${separator}\n\n${codesText}\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'innait-wiam-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  printCodes(): void {
    window.print();
  }

  hideCodes(): void {
    this.revealedCodes = null;
  }

  closePasswordDialog(): void {
    this.showPasswordDialog = false;
    this.passwordForm.reset();
    this.revealError = '';
  }

  private loadStatus(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<BackupCodesStatus>(this.API_BASE)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false),
      )
      .subscribe({
        next: (status) => {
          this.status = status;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load backup codes status.';
        },
      });
  }
}
