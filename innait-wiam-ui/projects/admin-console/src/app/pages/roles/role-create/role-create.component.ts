import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

import { AuthService, ApiResponse, Role } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface RoleTypeOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-role-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    InputTextareaModule,
    InputSwitchModule,
    MessageModule,
    ProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div class="role-create-page">
      <!-- ============================================================ -->
      <!-- Page Header                                                   -->
      <!-- ============================================================ -->
      <header class="page-header">
        <div class="header-left">
          <button
            class="btn btn-icon"
            routerLink="/roles"
            aria-label="Back to role list">
            <i class="pi pi-arrow-left" aria-hidden="true"></i>
          </button>
          <h1 class="page-title">{{ 'roles.create.title' | translate }}</h1>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Form Card                                                     -->
      <!-- ============================================================ -->
      <div class="form-container">
        <p-card styleClass="role-form-card">
          <ng-template pTemplate="header">
            <div class="card-header">
              <h2 class="card-title">Role Information</h2>
              <p class="card-subtitle">Define the new role's properties and configuration.</p>
            </div>
          </ng-template>

          <!-- Error Message -->
          <p-message
            *ngIf="submitError"
            severity="error"
            [text]="submitError"
            styleClass="w-full mb-3"
            role="alert">
          </p-message>

          <form
            [formGroup]="roleForm"
            (ngSubmit)="onSubmit()"
            aria-label="Create role form">

            <!-- Role Name -->
            <div class="form-field">
              <label class="form-label" for="roleName">
                Role Name <span class="required" aria-hidden="true">*</span>
              </label>
              <input
                id="roleName"
                type="text"
                pInputText
                formControlName="roleName"
                placeholder="e.g. Account Manager"
                class="w-full"
                aria-required="true"
                [attr.aria-invalid]="roleForm.get('roleName')?.invalid && roleForm.get('roleName')?.touched"
                aria-describedby="roleName-error" />
              <small
                id="roleName-error"
                class="field-error"
                *ngIf="roleForm.get('roleName')?.invalid && roleForm.get('roleName')?.touched"
                role="alert">
                Role name is required.
              </small>
            </div>

            <!-- Role Code -->
            <div class="form-field">
              <label class="form-label" for="roleCode">
                Role Code <span class="required" aria-hidden="true">*</span>
              </label>
              <input
                id="roleCode"
                type="text"
                pInputText
                formControlName="roleCode"
                placeholder="e.g. ACCOUNT_MANAGER"
                class="w-full"
                aria-required="true"
                [attr.aria-invalid]="roleForm.get('roleCode')?.invalid && roleForm.get('roleCode')?.touched"
                aria-describedby="roleCode-help roleCode-error" />
              <small id="roleCode-help" class="field-help">
                Auto-generated from role name. Must be uppercase letters and underscores only.
              </small>
              <small
                id="roleCode-error"
                class="field-error"
                *ngIf="roleForm.get('roleCode')?.invalid && roleForm.get('roleCode')?.touched"
                role="alert">
                <span *ngIf="roleForm.get('roleCode')?.errors?.['required']">
                  Role code is required.
                </span>
                <span *ngIf="roleForm.get('roleCode')?.errors?.['pattern']">
                  Role code must contain only uppercase letters and underscores (e.g. ACCOUNT_MANAGER).
                </span>
              </small>
            </div>

            <!-- Role Type -->
            <div class="form-field">
              <label class="form-label" for="roleType">
                Role Type <span class="required" aria-hidden="true">*</span>
              </label>
              <p-dropdown
                id="roleType"
                formControlName="roleType"
                [options]="roleTypeOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Select role type"
                styleClass="w-full"
                aria-required="true"
                [attr.aria-invalid]="roleForm.get('roleType')?.invalid && roleForm.get('roleType')?.touched"
                aria-describedby="roleType-error">
              </p-dropdown>
              <small
                id="roleType-error"
                class="field-error"
                *ngIf="roleForm.get('roleType')?.invalid && roleForm.get('roleType')?.touched"
                role="alert">
                Role type is required.
              </small>
            </div>

            <!-- Description -->
            <div class="form-field">
              <label class="form-label" for="description">Description</label>
              <textarea
                id="description"
                pInputTextarea
                formControlName="description"
                rows="4"
                placeholder="Describe the purpose and scope of this role..."
                class="w-full"
                aria-describedby="description-help">
              </textarea>
              <small id="description-help" class="field-help">
                Optional. Provide a clear description of what this role grants.
              </small>
            </div>

            <!-- Status Toggle -->
            <div class="form-field form-field-inline">
              <label class="form-label" for="status">Status</label>
              <div class="switch-row">
                <p-inputSwitch
                  id="status"
                  formControlName="statusActive"
                  aria-label="Role active status">
                </p-inputSwitch>
                <span
                  class="switch-label"
                  [class.switch-active]="roleForm.get('statusActive')?.value"
                  [class.switch-inactive]="!roleForm.get('statusActive')?.value">
                  {{ roleForm.get('statusActive')?.value ? 'ACTIVE' : 'INACTIVE' }}
                </span>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
              <button
                type="button"
                class="btn btn-outline"
                routerLink="/roles"
                aria-label="Cancel and return to role list">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="roleForm.invalid || submitting"
                aria-label="Create role">
                <i
                  class="pi pi-spin pi-spinner"
                  *ngIf="submitting"
                  aria-hidden="true"></i>
                {{ submitting ? 'Creating...' : 'Create Role' }}
              </button>
            </div>
          </form>
        </p-card>
      </div>
    </div>
  `,
  styles: [`
    /* ============================================================ */
    /* Layout                                                        */
    /* ============================================================ */
    .role-create-page {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: var(--innait-surface, #fff);
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .page-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
      color: var(--innait-text, #212121);
    }

    .form-container {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      justify-content: center;
    }

    :host ::ng-deep .role-form-card {
      width: 100%;
      max-width: 640px;
    }

    .card-header {
      padding: 1.25rem 1.5rem 0.75rem;
    }

    .card-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 0.25rem 0;
      color: var(--innait-text, #212121);
    }

    .card-subtitle {
      font-size: 0.8125rem;
      color: var(--innait-text-secondary, #757575);
      margin: 0;
    }

    /* ============================================================ */
    /* Form Fields                                                   */
    /* ============================================================ */
    .form-field {
      margin-bottom: 1.25rem;
    }

    .form-field-inline {
      display: flex;
      flex-direction: column;
    }

    .form-label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--innait-text, #212121);
      margin-bottom: 0.375rem;
    }

    .required {
      color: #d32f2f;
    }

    .field-help {
      display: block;
      font-size: 0.75rem;
      color: var(--innait-text-secondary, #757575);
      margin-top: 0.25rem;
    }

    .field-error {
      display: block;
      font-size: 0.75rem;
      color: #d32f2f;
      margin-top: 0.25rem;
    }

    .w-full {
      width: 100%;
    }

    .switch-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .switch-label {
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    .switch-active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .switch-inactive {
      background: #f5f5f5;
      color: #616161;
    }

    /* ============================================================ */
    /* Form Actions                                                  */
    /* ============================================================ */
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
      margin-top: 0.5rem;
    }

    /* ============================================================ */
    /* Buttons                                                       */
    /* ============================================================ */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.4375rem 0.875rem;
      border: 1px solid transparent;
      border-radius: 4px;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      line-height: 1.5;
    }

    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--innait-primary, #1976d2);
      color: #fff;
      border-color: var(--innait-primary, #1976d2);
    }

    .btn-primary:hover:not(:disabled) {
      background: #1565c0;
      border-color: #1565c0;
    }

    .btn-outline {
      background: transparent;
      color: var(--innait-text, #212121);
      border-color: #e0e0e0;
    }

    .btn-outline:hover:not(:disabled) {
      background: #f5f5f5;
      border-color: #bdbdbd;
    }

    .btn-icon {
      padding: 0.4375rem;
      background: transparent;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      cursor: pointer;
      color: var(--innait-text, #212121);
    }

    .btn-icon:hover {
      background: #f5f5f5;
    }

    /* ============================================================ */
    /* Responsive                                                    */
    /* ============================================================ */
    @media (max-width: 768px) {
      .form-container {
        padding: 1rem;
      }

      .form-actions {
        flex-direction: column-reverse;
      }

      .form-actions .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `],
})
export class RoleCreateComponent implements OnInit, OnDestroy {
  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  private readonly apiBase = '/api/v1/admin/roles';
  private readonly destroy$ = new Subject<void>();

  roleForm!: FormGroup;
  submitting = false;
  submitError = '';

  readonly roleTypeOptions: RoleTypeOption[] = [
    { label: 'Tenant', value: 'TENANT' },
    { label: 'Application', value: 'APPLICATION' },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  // ================================================================
  // Lifecycle
  // ================================================================
  ngOnInit(): void {
    this.initForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ================================================================
  // Form initialization
  // ================================================================
  private initForm(): void {
    this.roleForm = this.fb.group({
      roleName: ['', [Validators.required]],
      roleCode: ['', [Validators.required, Validators.pattern(/^[A-Z_]+$/)]],
      roleType: ['', [Validators.required]],
      description: [''],
      statusActive: [true],
    });

    // Auto-generate roleCode from roleName
    this.roleForm.get('roleName')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((name: string) => {
        if (name) {
          const code = name
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9\s]/g, '')
            .replace(/\s+/g, '_');
          this.roleForm.get('roleCode')?.setValue(code, { emitEvent: false });
        }
      });
  }

  // ================================================================
  // Submit
  // ================================================================
  onSubmit(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.submitError = '';

    const formValue = this.roleForm.value;
    const payload = {
      roleName: formValue.roleName,
      roleCode: formValue.roleCode,
      roleType: formValue.roleType,
      description: formValue.description || '',
      status: formValue.statusActive ? 'ACTIVE' : 'INACTIVE',
    };

    this.http
      .post<ApiResponse<Role>>(this.apiBase, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.submitting = false;
          const roleId = response.data?.id;
          if (roleId) {
            this.router.navigate(['/roles', roleId]);
          } else {
            this.router.navigate(['/roles']);
          }
        },
        error: (err) => {
          this.submitting = false;
          this.submitError =
            err?.error?.message || 'Failed to create role. Please try again.';
        },
      });
  }
}
