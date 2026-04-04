import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';

interface RecoveryMethods {
  email: { configured: boolean; maskedEmail: string };
  phone: { configured: boolean; maskedPhone: string };
  backupCodes: { configured: boolean; remaining: number };
  securityQuestions: { configured: boolean; count: number };
}

interface SecurityQuestionOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-account-recovery',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule,
    BadgeModule,
    TranslatePipe,
  ],
  template: `
    <div class="account-recovery" role="region" aria-label="Account Recovery Options">
      <!-- Page Header -->
      <div class="page-header">
        <h2>{{ 'recovery.title' | translate }}</h2>
        <p class="page-subtitle">{{ 'recovery.subtitle' | translate }}</p>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading recovery methods">
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

      <!-- Recovery Score -->
      <div *ngIf="!loading && recoveryMethods" class="recovery-score" role="status" aria-live="polite">
        <div class="score-bar">
          <div class="score-fill" [style.width.%]="recoveryScore"></div>
        </div>
        <span class="score-label">
          {{ configuredCount }} {{ 'recovery.score.of' | translate }} 4 {{ 'recovery.score.configured' | translate }}
        </span>
      </div>

      <!-- Success Message -->
      <p-message
        *ngIf="successMessage && !loading"
        severity="success"
        [text]="successMessage"
        (onClose)="successMessage = ''"
        role="alert">
      </p-message>

      <!-- Recovery Method Cards -->
      <div *ngIf="!loading && recoveryMethods" class="recovery-grid" role="list">

        <!-- Email Recovery -->
        <p-card class="recovery-card" role="listitem">
          <div class="method-card">
            <div class="method-header">
              <div class="method-icon-wrapper" [class.configured]="recoveryMethods!.email.configured">
                <i class="pi pi-envelope" aria-hidden="true"></i>
              </div>
              <div class="method-info">
                <h3>{{ 'recovery.email.title' | translate }}</h3>
                <p-tag
                  [value]="recoveryMethods!.email.configured ? ('recovery.status.configured' | translate) : ('recovery.status.notConfigured' | translate)"
                  [severity]="recoveryMethods!.email.configured ? 'success' : 'warning'"
                  [rounded]="true">
                </p-tag>
              </div>
            </div>
            <div class="method-body">
              <p *ngIf="recoveryMethods!.email.configured" class="masked-value">
                {{ recoveryMethods!.email.maskedEmail }}
              </p>
              <p *ngIf="!recoveryMethods!.email.configured" class="not-configured-text">
                {{ 'recovery.email.notConfiguredMessage' | translate }}
              </p>
            </div>
            <div class="method-actions">
              <button
                pButton
                type="button"
                [label]="recoveryMethods!.email.configured ? ('recovery.email.update' | translate) : ('recovery.email.setup' | translate)"
                [icon]="recoveryMethods!.email.configured ? 'pi pi-pencil' : 'pi pi-plus'"
                class="p-button-outlined p-button-sm"
                (click)="showEmailDialog = true"
                aria-label="Update recovery email">
              </button>
            </div>
          </div>
        </p-card>

        <!-- Phone Recovery -->
        <p-card class="recovery-card" role="listitem">
          <div class="method-card">
            <div class="method-header">
              <div class="method-icon-wrapper" [class.configured]="recoveryMethods!.phone.configured">
                <i class="pi pi-phone" aria-hidden="true"></i>
              </div>
              <div class="method-info">
                <h3>{{ 'recovery.phone.title' | translate }}</h3>
                <p-tag
                  [value]="recoveryMethods!.phone.configured ? ('recovery.status.configured' | translate) : ('recovery.status.notConfigured' | translate)"
                  [severity]="recoveryMethods!.phone.configured ? 'success' : 'warning'"
                  [rounded]="true">
                </p-tag>
              </div>
            </div>
            <div class="method-body">
              <p *ngIf="recoveryMethods!.phone.configured" class="masked-value">
                {{ recoveryMethods!.phone.maskedPhone }}
              </p>
              <p *ngIf="!recoveryMethods!.phone.configured" class="not-configured-text">
                {{ 'recovery.phone.notConfiguredMessage' | translate }}
              </p>
            </div>
            <div class="method-actions">
              <button
                pButton
                type="button"
                [label]="recoveryMethods!.phone.configured ? ('recovery.phone.update' | translate) : ('recovery.phone.setup' | translate)"
                [icon]="recoveryMethods!.phone.configured ? 'pi pi-pencil' : 'pi pi-plus'"
                class="p-button-outlined p-button-sm"
                (click)="showPhoneDialog = true"
                aria-label="Update recovery phone">
              </button>
            </div>
          </div>
        </p-card>

        <!-- Backup Codes -->
        <p-card class="recovery-card" role="listitem">
          <div class="method-card">
            <div class="method-header">
              <div class="method-icon-wrapper" [class.configured]="recoveryMethods!.backupCodes.configured">
                <i class="pi pi-list" aria-hidden="true"></i>
              </div>
              <div class="method-info">
                <h3>{{ 'recovery.backupCodes.title' | translate }}</h3>
                <p-tag
                  [value]="recoveryMethods!.backupCodes.configured ? ('recovery.status.configured' | translate) : ('recovery.status.notConfigured' | translate)"
                  [severity]="recoveryMethods!.backupCodes.configured ? 'success' : 'warning'"
                  [rounded]="true">
                </p-tag>
              </div>
            </div>
            <div class="method-body">
              <div *ngIf="recoveryMethods!.backupCodes.configured" class="backup-codes-info">
                <span class="remaining-label">{{ 'recovery.backupCodes.remaining' | translate }}:</span>
                <span
                  class="remaining-count"
                  [class.low]="recoveryMethods!.backupCodes.remaining <= 2"
                  pBadge
                  [value]="recoveryMethods!.backupCodes.remaining.toString()"
                  [severity]="recoveryMethods!.backupCodes.remaining <= 2 ? 'danger' : 'info'">
                </span>
              </div>
              <p *ngIf="!recoveryMethods!.backupCodes.configured" class="not-configured-text">
                {{ 'recovery.backupCodes.notConfiguredMessage' | translate }}
              </p>
            </div>
            <div class="method-actions">
              <a
                pButton
                [label]="recoveryMethods!.backupCodes.configured ? ('recovery.backupCodes.manage' | translate) : ('recovery.backupCodes.setup' | translate)"
                [icon]="recoveryMethods!.backupCodes.configured ? 'pi pi-cog' : 'pi pi-plus'"
                class="p-button-outlined p-button-sm"
                routerLink="/mfa/backup-codes"
                aria-label="Manage backup codes">
              </a>
            </div>
          </div>
        </p-card>

        <!-- Security Questions -->
        <p-card class="recovery-card" role="listitem">
          <div class="method-card">
            <div class="method-header">
              <div class="method-icon-wrapper" [class.configured]="recoveryMethods!.securityQuestions.configured">
                <i class="pi pi-question-circle" aria-hidden="true"></i>
              </div>
              <div class="method-info">
                <h3>{{ 'recovery.securityQuestions.title' | translate }}</h3>
                <p-tag
                  [value]="recoveryMethods!.securityQuestions.configured ? ('recovery.status.configured' | translate) : ('recovery.status.notConfigured' | translate)"
                  [severity]="recoveryMethods!.securityQuestions.configured ? 'success' : 'warning'"
                  [rounded]="true">
                </p-tag>
              </div>
            </div>
            <div class="method-body">
              <p *ngIf="recoveryMethods!.securityQuestions.configured" class="configured-text">
                {{ recoveryMethods!.securityQuestions.count }} {{ 'recovery.securityQuestions.questionsConfigured' | translate }}
              </p>
              <p *ngIf="!recoveryMethods!.securityQuestions.configured" class="not-configured-text">
                {{ 'recovery.securityQuestions.notConfiguredMessage' | translate }}
              </p>
            </div>
            <div class="method-actions">
              <button
                pButton
                type="button"
                [label]="recoveryMethods!.securityQuestions.configured ? ('recovery.securityQuestions.update' | translate) : ('recovery.securityQuestions.setup' | translate)"
                [icon]="recoveryMethods!.securityQuestions.configured ? 'pi pi-pencil' : 'pi pi-plus'"
                class="p-button-outlined p-button-sm"
                (click)="openSecurityQuestionsDialog()"
                aria-label="Set up security questions">
              </button>
            </div>
          </div>
        </p-card>
      </div>

      <!-- Email Dialog -->
      <p-dialog
        [(visible)]="showEmailDialog"
        [modal]="true"
        [style]="{ width: '420px' }"
        [header]="'recovery.email.dialog.title' | translate"
        (onHide)="resetEmailForm()"
        aria-label="Update recovery email">

        <form [formGroup]="emailForm" class="dialog-form">
          <div class="form-field">
            <label for="recovery-email">{{ 'recovery.email.dialog.emailLabel' | translate }}</label>
            <input
              id="recovery-email"
              pInputText
              type="email"
              formControlName="email"
              autocomplete="email"
              [placeholder]="'recovery.email.dialog.emailPlaceholder' | translate"
              aria-required="true"
              [attr.aria-invalid]="emailForm.get('email')?.invalid && emailForm.get('email')?.touched"
              class="w-full" />
            <small
              *ngIf="emailForm.get('email')?.hasError('required') && emailForm.get('email')?.touched"
              class="p-error"
              role="alert">
              {{ 'recovery.email.dialog.emailRequired' | translate }}
            </small>
            <small
              *ngIf="emailForm.get('email')?.hasError('email') && emailForm.get('email')?.touched"
              class="p-error"
              role="alert">
              {{ 'recovery.email.dialog.emailInvalid' | translate }}
            </small>
          </div>

          <div class="form-field">
            <label for="email-password">{{ 'recovery.dialog.passwordLabel' | translate }}</label>
            <input
              id="email-password"
              pInputText
              type="password"
              formControlName="password"
              autocomplete="current-password"
              [placeholder]="'recovery.dialog.passwordPlaceholder' | translate"
              aria-required="true"
              [attr.aria-invalid]="emailForm.get('password')?.invalid && emailForm.get('password')?.touched"
              class="w-full" />
            <small
              *ngIf="emailForm.get('password')?.hasError('required') && emailForm.get('password')?.touched"
              class="p-error"
              role="alert">
              {{ 'common.passwordRequired' | translate }}
            </small>
          </div>

          <p-message
            *ngIf="emailDialogError"
            severity="error"
            [text]="emailDialogError"
            role="alert">
          </p-message>
        </form>

        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            [label]="'common.cancel' | translate"
            icon="pi pi-times"
            class="p-button-text"
            (click)="showEmailDialog = false"
            aria-label="Cancel">
          </button>
          <button
            pButton
            type="button"
            [label]="'common.save' | translate"
            icon="pi pi-check"
            (click)="saveEmail()"
            [loading]="savingEmail"
            [disabled]="emailForm.invalid || savingEmail"
            aria-label="Save email">
          </button>
        </ng-template>
      </p-dialog>

      <!-- Phone Dialog -->
      <p-dialog
        [(visible)]="showPhoneDialog"
        [modal]="true"
        [style]="{ width: '420px' }"
        [header]="'recovery.phone.dialog.title' | translate"
        (onHide)="resetPhoneForm()"
        aria-label="Update recovery phone">

        <form [formGroup]="phoneForm" class="dialog-form">
          <div class="form-field">
            <label for="recovery-phone">{{ 'recovery.phone.dialog.phoneLabel' | translate }}</label>
            <input
              id="recovery-phone"
              pInputText
              type="tel"
              formControlName="phone"
              autocomplete="tel"
              [placeholder]="'recovery.phone.dialog.phonePlaceholder' | translate"
              aria-required="true"
              [attr.aria-invalid]="phoneForm.get('phone')?.invalid && phoneForm.get('phone')?.touched"
              class="w-full" />
            <small
              *ngIf="phoneForm.get('phone')?.hasError('required') && phoneForm.get('phone')?.touched"
              class="p-error"
              role="alert">
              {{ 'recovery.phone.dialog.phoneRequired' | translate }}
            </small>
            <small
              *ngIf="phoneForm.get('phone')?.hasError('pattern') && phoneForm.get('phone')?.touched"
              class="p-error"
              role="alert">
              {{ 'recovery.phone.dialog.phoneInvalid' | translate }}
            </small>
          </div>

          <div class="form-field">
            <label for="phone-password">{{ 'recovery.dialog.passwordLabel' | translate }}</label>
            <input
              id="phone-password"
              pInputText
              type="password"
              formControlName="password"
              autocomplete="current-password"
              [placeholder]="'recovery.dialog.passwordPlaceholder' | translate"
              aria-required="true"
              [attr.aria-invalid]="phoneForm.get('password')?.invalid && phoneForm.get('password')?.touched"
              class="w-full" />
            <small
              *ngIf="phoneForm.get('password')?.hasError('required') && phoneForm.get('password')?.touched"
              class="p-error"
              role="alert">
              {{ 'common.passwordRequired' | translate }}
            </small>
          </div>

          <p-message
            *ngIf="phoneDialogError"
            severity="error"
            [text]="phoneDialogError"
            role="alert">
          </p-message>
        </form>

        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            [label]="'common.cancel' | translate"
            icon="pi pi-times"
            class="p-button-text"
            (click)="showPhoneDialog = false"
            aria-label="Cancel">
          </button>
          <button
            pButton
            type="button"
            [label]="'common.save' | translate"
            icon="pi pi-check"
            (click)="savePhone()"
            [loading]="savingPhone"
            [disabled]="phoneForm.invalid || savingPhone"
            aria-label="Save phone number">
          </button>
        </ng-template>
      </p-dialog>

      <!-- Security Questions Dialog -->
      <p-dialog
        [(visible)]="showSecurityQuestionsDialog"
        [modal]="true"
        [style]="{ width: '560px' }"
        [header]="'recovery.securityQuestions.dialog.title' | translate"
        (onHide)="resetSecurityQuestionsForm()"
        aria-label="Set up security questions">

        <form [formGroup]="securityQuestionsForm" class="dialog-form">
          <div formArrayName="questions">
            <div
              *ngFor="let q of questionsArray.controls; let i = index"
              [formGroupName]="i"
              class="question-group">
              <div class="form-field">
                <label [for]="'question-' + i">{{ 'recovery.securityQuestions.dialog.question' | translate }} {{ i + 1 }}</label>
                <p-dropdown
                  [id]="'question-' + i"
                  formControlName="questionId"
                  [options]="availableQuestions"
                  optionLabel="label"
                  optionValue="id"
                  [placeholder]="'recovery.securityQuestions.dialog.selectQuestion' | translate"
                  [style]="{ width: '100%' }"
                  aria-required="true"
                  [attr.aria-invalid]="q.get('questionId')?.invalid && q.get('questionId')?.touched">
                </p-dropdown>
                <small
                  *ngIf="q.get('questionId')?.hasError('required') && q.get('questionId')?.touched"
                  class="p-error"
                  role="alert">
                  {{ 'recovery.securityQuestions.dialog.questionRequired' | translate }}
                </small>
              </div>

              <div class="form-field">
                <label [for]="'answer-' + i">{{ 'recovery.securityQuestions.dialog.answer' | translate }} {{ i + 1 }}</label>
                <input
                  [id]="'answer-' + i"
                  pInputText
                  type="text"
                  formControlName="answer"
                  [placeholder]="'recovery.securityQuestions.dialog.answerPlaceholder' | translate"
                  aria-required="true"
                  [attr.aria-invalid]="q.get('answer')?.invalid && q.get('answer')?.touched"
                  class="w-full" />
                <small
                  *ngIf="q.get('answer')?.hasError('required') && q.get('answer')?.touched"
                  class="p-error"
                  role="alert">
                  {{ 'recovery.securityQuestions.dialog.answerRequired' | translate }}
                </small>
              </div>
            </div>
          </div>

          <p-message
            *ngIf="securityQuestionsDialogError"
            severity="error"
            [text]="securityQuestionsDialogError"
            role="alert">
          </p-message>
        </form>

        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            [label]="'common.cancel' | translate"
            icon="pi pi-times"
            class="p-button-text"
            (click)="showSecurityQuestionsDialog = false"
            aria-label="Cancel">
          </button>
          <button
            pButton
            type="button"
            [label]="'common.save' | translate"
            icon="pi pi-check"
            (click)="saveSecurityQuestions()"
            [loading]="savingSecurityQuestions"
            [disabled]="securityQuestionsForm.invalid || savingSecurityQuestions"
            aria-label="Save security questions">
          </button>
        </ng-template>
      </p-dialog>
    </div>
  `,
  styles: [`
    .account-recovery {
      max-width: 960px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 1.5rem;
    }

    .page-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--innait-text);
    }

    .page-subtitle {
      margin: 0.375rem 0 0;
      color: var(--innait-text-secondary);
      font-size: 0.875rem;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2rem 0;
      color: var(--innait-text-secondary);
    }

    .recovery-score {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding: 1rem 1.25rem;
      background: var(--innait-surface);
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .score-bar {
      flex: 1;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .score-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff9800, #4caf50);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .score-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--innait-text);
      white-space: nowrap;
    }

    .recovery-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 768px) {
      .recovery-grid {
        grid-template-columns: 1fr;
      }
    }

    .recovery-card {
      height: 100%;
    }

    .method-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 180px;
    }

    .method-header {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .method-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #fff3e0;
      color: #f57c00;
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .method-icon-wrapper.configured {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .method-info {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .method-info h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--innait-text);
    }

    .method-body {
      flex: 1;
    }

    .masked-value {
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      color: var(--innait-text);
      background: var(--innait-bg);
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      margin: 0;
    }

    .configured-text {
      font-size: 0.875rem;
      color: var(--innait-text);
      margin: 0;
    }

    .not-configured-text {
      font-size: 0.875rem;
      color: var(--innait-text-secondary);
      margin: 0;
      font-style: italic;
    }

    .backup-codes-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
    }

    .remaining-label {
      color: var(--innait-text-secondary);
    }

    .method-actions {
      padding-top: 0.25rem;
    }

    /* Dialog styles */
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-field label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--innait-text);
    }

    .question-group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding-bottom: 1rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .question-group:last-child {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 0;
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

    :host ::ng-deep .recovery-card .p-card {
      height: 100%;
    }

    :host ::ng-deep .recovery-card .p-card-body {
      height: 100%;
    }

    :host ::ng-deep .recovery-card .p-card-content {
      height: 100%;
      padding-bottom: 0;
    }
  `],
})
export class AccountRecoveryComponent implements OnInit, OnDestroy {
  recoveryMethods: RecoveryMethods | null = null;
  loading = false;
  errorMessage = '';
  successMessage = '';

  // Email dialog
  showEmailDialog = false;
  emailForm!: FormGroup;
  savingEmail = false;
  emailDialogError = '';

  // Phone dialog
  showPhoneDialog = false;
  phoneForm!: FormGroup;
  savingPhone = false;
  phoneDialogError = '';

  // Security questions dialog
  showSecurityQuestionsDialog = false;
  securityQuestionsForm!: FormGroup;
  savingSecurityQuestions = false;
  securityQuestionsDialogError = '';

  availableQuestions: SecurityQuestionOption[] = [
    { id: 'q1', label: 'What was the name of your first pet?' },
    { id: 'q2', label: 'What city were you born in?' },
    { id: 'q3', label: 'What was the name of your first school?' },
    { id: 'q4', label: 'What is your mother\'s maiden name?' },
    { id: 'q5', label: 'What was the make of your first car?' },
    { id: 'q6', label: 'What is the name of the street you grew up on?' },
    { id: 'q7', label: 'What was your childhood nickname?' },
    { id: 'q8', label: 'What is the middle name of your oldest sibling?' },
    { id: 'q9', label: 'What was the name of your favorite teacher?' },
    { id: 'q10', label: 'In what city did your parents meet?' },
  ];

  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/recovery';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadRecoveryMethods();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get configuredCount(): number {
    if (!this.recoveryMethods) return 0;
    let count = 0;
    if (this.recoveryMethods.email.configured) count++;
    if (this.recoveryMethods.phone.configured) count++;
    if (this.recoveryMethods.backupCodes.configured) count++;
    if (this.recoveryMethods.securityQuestions.configured) count++;
    return count;
  }

  get recoveryScore(): number {
    return (this.configuredCount / 4) * 100;
  }

  get questionsArray(): FormArray {
    return this.securityQuestionsForm.get('questions') as FormArray;
  }

  private initForms(): void {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });

    this.phoneForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]],
      password: ['', [Validators.required]],
    });

    this.securityQuestionsForm = this.fb.group({
      questions: this.fb.array([
        this.createQuestionGroup(),
        this.createQuestionGroup(),
        this.createQuestionGroup(),
      ]),
    });
  }

  private createQuestionGroup(): FormGroup {
    return this.fb.group({
      questionId: ['', [Validators.required]],
      answer: ['', [Validators.required]],
    });
  }

  loadRecoveryMethods(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<RecoveryMethods>(`${this.API_BASE}/methods`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false),
      )
      .subscribe({
        next: (methods) => {
          this.recoveryMethods = methods;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load recovery methods. Please try again.';
        },
      });
  }

  // Email methods
  saveEmail(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.savingEmail = true;
    this.emailDialogError = '';

    const { email, password } = this.emailForm.value;

    this.http.put<void>(`${this.API_BASE}/email`, { email, password })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.savingEmail = false),
      )
      .subscribe({
        next: () => {
          this.showEmailDialog = false;
          this.resetEmailForm();
          this.successMessage = 'Recovery email updated successfully.';
          this.loadRecoveryMethods();
        },
        error: (err) => {
          this.emailDialogError = err?.error?.message || 'Failed to update email. Please check your password and try again.';
        },
      });
  }

  resetEmailForm(): void {
    this.emailForm.reset();
    this.emailDialogError = '';
  }

  // Phone methods
  savePhone(): void {
    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }

    this.savingPhone = true;
    this.phoneDialogError = '';

    const { phone, password } = this.phoneForm.value;

    this.http.put<void>(`${this.API_BASE}/phone`, { phone, password })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.savingPhone = false),
      )
      .subscribe({
        next: () => {
          this.showPhoneDialog = false;
          this.resetPhoneForm();
          this.successMessage = 'Recovery phone updated successfully.';
          this.loadRecoveryMethods();
        },
        error: (err) => {
          this.phoneDialogError = err?.error?.message || 'Failed to update phone. Please check your password and try again.';
        },
      });
  }

  resetPhoneForm(): void {
    this.phoneForm.reset();
    this.phoneDialogError = '';
  }

  // Security Questions methods
  openSecurityQuestionsDialog(): void {
    this.showSecurityQuestionsDialog = true;
  }

  saveSecurityQuestions(): void {
    if (this.securityQuestionsForm.invalid) {
      this.securityQuestionsForm.markAllAsTouched();
      return;
    }

    this.savingSecurityQuestions = true;
    this.securityQuestionsDialogError = '';

    const questions = this.questionsArray.value as { questionId: string; answer: string }[];

    this.http.put<void>(`${this.API_BASE}/security-questions`, { questions })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.savingSecurityQuestions = false),
      )
      .subscribe({
        next: () => {
          this.showSecurityQuestionsDialog = false;
          this.resetSecurityQuestionsForm();
          this.successMessage = 'Security questions updated successfully.';
          this.loadRecoveryMethods();
        },
        error: (err) => {
          this.securityQuestionsDialogError = err?.error?.message || 'Failed to update security questions. Please try again.';
        },
      });
  }

  resetSecurityQuestionsForm(): void {
    this.questionsArray.controls.forEach((control) => control.reset());
    this.securityQuestionsDialogError = '';
  }
}
