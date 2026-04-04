import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

interface FidoKey {
  credentialId: string;
  nickname: string;
  registeredAt: string;
  lastUsedAt: string;
  aaguid: string;
}

/** Transient UI state tracked alongside each key. */
interface FidoKeyRow extends FidoKey {
  editing: boolean;
  editNickname: string;
  saving: boolean;
}

@Component({
  selector: 'app-fido-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div class="fido-management" role="region" aria-label="FIDO2 Key Management">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>{{ 'mfa.fido.manage.title' | translate }}</h2>
            <a
              *ngIf="!loading && keys.length > 0"
              pButton
              class="p-button-sm"
              [label]="'mfa.fido.manage.registerNewButton' | translate"
              icon="pi pi-plus"
              routerLink="/mfa/fido"
              aria-label="Register a new security key">
            </a>
          </div>
        </ng-template>

        <!-- Loading State -->
        <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading FIDO keys">
          <p-progressSpinner strokeWidth="3" aria-label="Loading"></p-progressSpinner>
          <p>{{ 'mfa.fido.manage.loading' | translate }}</p>
        </div>

        <!-- Error State -->
        <p-message
          *ngIf="errorMessage && !loading"
          severity="error"
          [text]="errorMessage"
          (onClose)="errorMessage = ''"
          role="alert">
        </p-message>

        <!-- Success Message -->
        <p-message
          *ngIf="successMessage && !loading"
          severity="success"
          [text]="successMessage"
          (onClose)="successMessage = ''"
          role="status">
        </p-message>

        <!-- Keys Table -->
        <div *ngIf="!loading && !errorMessage && keys.length > 0" class="keys-table-container">
          <p-table
            [value]="keys"
            [responsive]="true"
            [breakpoint]="'768px'"
            aria-label="Registered FIDO2 security keys">
            <ng-template pTemplate="header">
              <tr>
                <th scope="col">{{ 'mfa.fido.manage.table.nickname' | translate }}</th>
                <th scope="col">{{ 'mfa.fido.manage.table.registered' | translate }}</th>
                <th scope="col">{{ 'mfa.fido.manage.table.lastUsed' | translate }}</th>
                <th scope="col" class="actions-col">{{ 'mfa.fido.manage.table.actions' | translate }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-key>
              <tr>
                <td [attr.data-label]="'Nickname'">
                  <!-- Display mode -->
                  <span *ngIf="!key.editing" class="key-nickname">
                    <i class="pi pi-key" aria-hidden="true"></i>
                    {{ key.nickname }}
                  </span>
                  <!-- Edit mode -->
                  <div *ngIf="key.editing" class="inline-edit">
                    <input
                      pInputText
                      [(ngModel)]="key.editNickname"
                      type="text"
                      maxlength="64"
                      class="edit-input"
                      [attr.aria-label]="'Edit nickname for ' + key.nickname" />
                    <button
                      pButton
                      icon="pi pi-check"
                      class="p-button-text p-button-success p-button-sm"
                      (click)="saveNickname(key)"
                      [loading]="key.saving"
                      [disabled]="!key.editNickname?.trim() || key.saving"
                      [attr.aria-label]="'Save nickname'">
                    </button>
                    <button
                      pButton
                      icon="pi pi-times"
                      class="p-button-text p-button-sm"
                      (click)="cancelEdit(key)"
                      [disabled]="key.saving"
                      [attr.aria-label]="'Cancel edit'">
                    </button>
                  </div>
                </td>
                <td [attr.data-label]="'Registered'">
                  {{ key.registeredAt | date:'mediumDate' }}
                </td>
                <td [attr.data-label]="'Last Used'">
                  {{ key.lastUsedAt ? (key.lastUsedAt | date:'medium') : ('mfa.fido.manage.neverUsed' | translate) }}
                </td>
                <td [attr.data-label]="'Actions'" class="actions-col">
                  <div class="action-buttons">
                    <button
                      pButton
                      icon="pi pi-pencil"
                      class="p-button-text p-button-sm"
                      [label]="'common.rename' | translate"
                      (click)="startEdit(key)"
                      *ngIf="!key.editing"
                      [attr.aria-label]="'Rename key ' + key.nickname">
                    </button>
                    <button
                      pButton
                      icon="pi pi-trash"
                      class="p-button-text p-button-danger p-button-sm"
                      [label]="'common.remove' | translate"
                      (click)="showRemoveDialog(key)"
                      *ngIf="!key.editing"
                      [attr.aria-label]="'Remove key ' + key.nickname">
                    </button>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <!-- Empty State -->
        <div *ngIf="!loading && !errorMessage && keys.length === 0" class="empty-state">
          <i class="pi pi-key empty-icon" aria-hidden="true"></i>
          <h3>{{ 'mfa.fido.manage.empty.title' | translate }}</h3>
          <p>{{ 'mfa.fido.manage.empty.message' | translate }}</p>
          <a
            pButton
            [label]="'mfa.fido.manage.empty.registerLink' | translate"
            icon="pi pi-plus"
            routerLink="/mfa/fido"
            aria-label="Register your first security key">
          </a>
        </div>
      </p-card>

      <!-- Remove Confirmation Dialog -->
      <p-dialog
        [(visible)]="removeDialogVisible"
        [header]="'mfa.fido.manage.removeDialog.title' | translate"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '420px' }"
        (onHide)="onRemoveDialogHide()"
        role="dialog"
        aria-label="Confirm key removal">

        <div class="remove-dialog-content">
          <p>
            {{ 'mfa.fido.manage.removeDialog.message' | translate }}
            <strong *ngIf="keyToRemove">"{{ keyToRemove.nickname }}"</strong>?
          </p>

          <p-message
            severity="warn"
            [text]="'mfa.fido.manage.removeDialog.warning' | translate">
          </p-message>

          <form [formGroup]="removeForm" class="remove-form">
            <label for="remove-password">{{ 'mfa.fido.manage.removeDialog.passwordLabel' | translate }}</label>
            <input
              id="remove-password"
              pInputText
              formControlName="password"
              type="password"
              autocomplete="current-password"
              [placeholder]="'mfa.fido.manage.removeDialog.passwordPlaceholder' | translate"
              aria-required="true"
              [attr.aria-invalid]="removeForm.get('password')?.invalid && removeForm.get('password')?.touched"
              class="full-width" />
            <small
              *ngIf="removeForm.get('password')?.invalid && removeForm.get('password')?.touched"
              class="p-error"
              role="alert">
              {{ 'mfa.fido.manage.removeDialog.passwordRequired' | translate }}
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
            [label]="'mfa.fido.manage.removeDialog.confirmButton' | translate"
            icon="pi pi-trash"
            (click)="confirmRemove()"
            [loading]="removing"
            [disabled]="removeForm.invalid || removing"
            aria-label="Confirm key removal">
          </button>
        </ng-template>
      </p-dialog>
    </div>
  `,
  styles: [`
    .fido-management {
      max-width: 960px;
      margin: 0 auto;
    }

    .card-header {
      padding: 1.25rem 1.5rem 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
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

    .keys-table-container {
      margin-top: 0.5rem;
    }

    .key-nickname {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    }

    .key-nickname .pi {
      color: var(--innait-primary);
      font-size: 0.875rem;
    }

    .inline-edit {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .edit-input {
      width: 180px;
      font-size: 0.875rem;
    }

    .actions-col {
      width: 200px;
      text-align: right;
    }

    .action-buttons {
      display: flex;
      gap: 0.25rem;
      justify-content: flex-end;
      flex-wrap: wrap;
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

    .remove-dialog-content > p {
      margin: 0;
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

    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      background: var(--innait-bg);
      font-weight: 600;
      font-size: 0.8125rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--innait-text-secondary);
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      padding: 0.75rem 1rem;
      vertical-align: middle;
    }

    @media (max-width: 768px) {
      .actions-col {
        width: auto;
        text-align: left;
      }

      .action-buttons {
        justify-content: flex-start;
      }

      .edit-input {
        width: 140px;
      }
    }
  `],
})
export class FidoManagementComponent implements OnInit, OnDestroy {
  keys: FidoKeyRow[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  removeDialogVisible = false;
  removing = false;
  removeErrorMessage = '';
  removeForm!: FormGroup;
  keyToRemove: FidoKeyRow | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/mfa/fido/keys';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.removeForm = this.fb.group({
      password: ['', [Validators.required]],
    });

    this.loadKeys();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadKeys(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<FidoKey[]>(this.API_BASE)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false),
      )
      .subscribe({
        next: (keys) => {
          this.keys = keys.map((k) => ({
            ...k,
            editing: false,
            editNickname: k.nickname,
            saving: false,
          }));
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load FIDO2 keys. Please try again.';
        },
      });
  }

  startEdit(key: FidoKeyRow): void {
    // Cancel any other edits first
    this.keys.forEach((k) => {
      k.editing = false;
      k.editNickname = k.nickname;
    });

    key.editing = true;
    key.editNickname = key.nickname;
  }

  cancelEdit(key: FidoKeyRow): void {
    key.editing = false;
    key.editNickname = key.nickname;
  }

  saveNickname(key: FidoKeyRow): void {
    const newNickname = key.editNickname?.trim();
    if (!newNickname) {
      return;
    }

    if (newNickname === key.nickname) {
      key.editing = false;
      return;
    }

    key.saving = true;

    this.http.put<{ success: boolean }>(`${this.API_BASE}/${encodeURIComponent(key.credentialId)}`, {
      nickname: newNickname,
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => key.saving = false),
      )
      .subscribe({
        next: () => {
          key.nickname = newNickname;
          key.editing = false;
          this.successMessage = `Key renamed to "${newNickname}" successfully.`;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to rename key. Please try again.';
        },
      });
  }

  showRemoveDialog(key: FidoKeyRow): void {
    this.keyToRemove = key;
    this.removeForm.reset();
    this.removeErrorMessage = '';
    this.removeDialogVisible = true;
  }

  onRemoveDialogHide(): void {
    this.keyToRemove = null;
    this.removeForm.reset();
    this.removeErrorMessage = '';
  }

  confirmRemove(): void {
    if (this.removeForm.invalid || !this.keyToRemove) {
      this.removeForm.markAllAsTouched();
      return;
    }

    this.removing = true;
    this.removeErrorMessage = '';

    const password = this.removeForm.get('password')?.value;
    const credentialId = this.keyToRemove.credentialId;
    const removedName = this.keyToRemove.nickname;

    this.http.delete(`${this.API_BASE}/${encodeURIComponent(credentialId)}`, {
      body: { password },
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.removing = false),
      )
      .subscribe({
        next: () => {
          this.removeDialogVisible = false;
          this.keys = this.keys.filter((k) => k.credentialId !== credentialId);
          this.successMessage = `Security key "${removedName}" has been removed successfully.`;
        },
        error: (err) => {
          this.removeErrorMessage = err?.error?.message || 'Failed to remove key. Please verify your password and try again.';
        },
      });
  }
}
