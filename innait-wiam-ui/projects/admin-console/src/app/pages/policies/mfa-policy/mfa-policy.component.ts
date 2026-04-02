import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface StepUpCondition {
  trigger: 'IP_CHANGE' | 'DEVICE_CHANGE' | 'SENSITIVE_ACTION' | 'TIME_BASED';
  action: 'REQUIRE_MFA' | 'REQUIRE_REAUTHENTICATION';
}

interface MfaPolicy {
  allowedMethods: string[];
  stepUpConditions: StepUpCondition[];
  deviceRememberEnabled: boolean;
  deviceRememberDays: number;
  enrollmentGracePeriodDays: number;
  backupCodesCount: number;
}

@Component({
  selector: 'app-mfa-policy',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    CardModule,
    CheckboxModule,
    InputNumberModule,
    InputSwitchModule,
    DropdownModule,
    MultiSelectModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule
  ],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading MFA policy configuration">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'policies.mfa.loading' | translate }}</p>
    </div>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="error-banner" role="alert">
    </p-message>

    <!-- Success State -->
    <p-message *ngIf="successMessage && !loading" severity="success" [text]="successMessage"
               styleClass="success-banner" role="status">
    </p-message>

    <!-- Main Form -->
    <div *ngIf="!loading" class="mfa-policy-container">
      <form [formGroup]="mfaForm" (ngSubmit)="onSave()" aria-label="MFA policy configuration form">

        <!-- Allowed Methods Section -->
        <p-card [header]="'policies.mfa.allowedMethods' | translate"
                [subheader]="'policies.mfa.allowedMethodsSubtitle' | translate"
                styleClass="section-card">
          <div class="methods-grid" role="group" aria-label="Allowed MFA methods">
            <div *ngFor="let method of mfaMethodOptions" class="method-item">
              <div class="method-card" [ngClass]="{ 'method-selected': isMethodSelected(method.value) }">
                <p-checkbox [formControl]="getMethodControl(method.value)"
                            [binary]="true"
                            [inputId]="'method-' + method.value"
                            [attr.aria-label]="'MFA method: ' + method.label">
                </p-checkbox>
                <div class="method-info">
                  <label [for]="'method-' + method.value" class="method-label">{{ method.label }}</label>
                  <span class="method-description">{{ method.description }}</span>
                </div>
              </div>
            </div>
          </div>
          <small *ngIf="noMethodSelected" class="p-error method-error" role="alert">
            {{ 'policies.mfa.atLeastOneMethod' | translate }}
          </small>
        </p-card>

        <!-- Step-up Conditions Section -->
        <p-card [header]="'policies.mfa.stepUpConditions' | translate"
                [subheader]="'policies.mfa.stepUpConditionsSubtitle' | translate"
                styleClass="section-card">
          <div formArrayName="stepUpConditions" aria-label="Step-up authentication conditions">

            <div *ngIf="conditionsArray.length === 0" class="empty-state" role="status">
              <i class="pi pi-info-circle" aria-hidden="true"></i>
              <p>{{ 'policies.mfa.noConditions' | translate }}</p>
            </div>

            <div *ngFor="let condition of conditionsArray.controls; let i = index; trackBy: trackByIndex"
                 [formGroupName]="i"
                 class="condition-row">
              <div class="condition-fields">
                <div class="condition-field">
                  <label [for]="'trigger-' + i" class="field-label">
                    {{ 'policies.mfa.trigger' | translate }}
                  </label>
                  <p-dropdown [inputId]="'trigger-' + i"
                              formControlName="trigger"
                              [options]="triggerOptions"
                              placeholder="Select trigger..."
                              styleClass="w-full"
                              aria-label="Condition trigger">
                  </p-dropdown>
                </div>
                <div class="condition-arrow">
                  <i class="pi pi-arrow-right" aria-hidden="true"></i>
                </div>
                <div class="condition-field">
                  <label [for]="'action-' + i" class="field-label">
                    {{ 'policies.mfa.action' | translate }}
                  </label>
                  <p-dropdown [inputId]="'action-' + i"
                              formControlName="action"
                              [options]="actionOptions"
                              placeholder="Select action..."
                              styleClass="w-full"
                              aria-label="Condition action">
                  </p-dropdown>
                </div>
                <button type="button" class="remove-condition-btn"
                        (click)="removeCondition(i)"
                        [attr.aria-label]="'Remove condition ' + (i + 1)">
                  <i class="pi pi-trash" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="add-condition-container">
            <p-button [label]="'policies.mfa.addCondition' | translate"
                      icon="pi pi-plus"
                      styleClass="p-button-outlined p-button-sm"
                      (onClick)="addCondition()"
                      aria-label="Add a new step-up condition">
            </p-button>
          </div>
        </p-card>

        <!-- Device Remember Section -->
        <p-card [header]="'policies.mfa.deviceRemember' | translate"
                [subheader]="'policies.mfa.deviceRememberSubtitle' | translate"
                styleClass="section-card">
          <div class="device-remember-row">
            <div class="switch-item">
              <label for="deviceRememberEnabled" class="switch-label">
                {{ 'policies.mfa.enableDeviceRemember' | translate }}
              </label>
              <p-inputSwitch inputId="deviceRememberEnabled"
                             formControlName="deviceRememberEnabled"
                             aria-label="Enable device remember">
              </p-inputSwitch>
            </div>
            <div class="field" *ngIf="mfaForm.get('deviceRememberEnabled')?.value">
              <label for="deviceRememberDays" class="field-label">
                {{ 'policies.mfa.rememberDuration' | translate }}
              </label>
              <p-inputNumber inputId="deviceRememberDays"
                             formControlName="deviceRememberDays"
                             [min]="1" [max]="90"
                             [showButtons]="true"
                             suffix=" days"
                             aria-label="Device remember duration in days">
              </p-inputNumber>
            </div>
          </div>
        </p-card>

        <!-- Enrollment & Backup Codes Section -->
        <p-card [header]="'policies.mfa.enrollmentSettings' | translate"
                styleClass="section-card">
          <div class="settings-grid">
            <div class="field">
              <label for="enrollmentGracePeriodDays" class="field-label">
                {{ 'policies.mfa.enrollmentGracePeriod' | translate }}
              </label>
              <p-inputNumber inputId="enrollmentGracePeriodDays"
                             formControlName="enrollmentGracePeriodDays"
                             [min]="0"
                             [showButtons]="true"
                             suffix=" days"
                             aria-label="Enrollment grace period in days, 0 means immediate">
              </p-inputNumber>
              <small class="hint">{{ 'policies.mfa.enrollmentGraceHint' | translate }}</small>
            </div>
            <div class="field">
              <label for="backupCodesCount" class="field-label">
                {{ 'policies.mfa.backupCodesCount' | translate }}
              </label>
              <p-inputNumber inputId="backupCodesCount"
                             formControlName="backupCodesCount"
                             [min]="5" [max]="20"
                             [showButtons]="true"
                             aria-label="Number of backup codes to auto-generate">
              </p-inputNumber>
            </div>
          </div>
        </p-card>

        <!-- Actions -->
        <div class="form-actions">
          <p-button type="submit"
                    [label]="'policies.mfa.save' | translate"
                    icon="pi pi-save"
                    [disabled]="mfaForm.invalid || mfaForm.pristine || saving || noMethodSelected"
                    [loading]="saving"
                    aria-label="Save MFA policy">
          </p-button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 860px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      gap: 1rem;
      color: var(--text-color-secondary);
    }

    :host ::ng-deep .error-banner,
    :host ::ng-deep .success-banner {
      width: 100%;
      margin-bottom: 1rem;
    }

    .mfa-policy-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    :host ::ng-deep .section-card {
      width: 100%;
    }

    :host ::ng-deep .section-card .p-card-subtitle {
      font-size: 0.8rem;
      color: var(--text-color-secondary);
    }

    /* Methods Grid */
    .methods-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .method-card {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      border: 2px solid var(--surface-border);
      border-radius: 8px;
      transition: border-color 0.2s ease, background-color 0.2s ease;
      cursor: pointer;
    }

    .method-card:hover {
      border-color: var(--primary-200);
    }

    .method-selected {
      border-color: var(--primary-color);
      background: var(--primary-50, #e3f2fd);
    }

    .method-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .method-label {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-color);
      cursor: pointer;
    }

    .method-description {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .method-error {
      display: block;
      margin-top: 0.75rem;
    }

    /* Step-up Conditions */
    .condition-row {
      margin-bottom: 0.75rem;
    }

    .condition-fields {
      display: flex;
      align-items: flex-end;
      gap: 0.75rem;
    }

    .condition-field {
      flex: 1;
    }

    .condition-arrow {
      display: flex;
      align-items: center;
      padding-bottom: 0.5rem;
      color: var(--text-color-secondary);
    }

    .remove-condition-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      margin-bottom: 0.25rem;
      background: none;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      color: #c62828;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }

    .remove-condition-btn:hover {
      background: #ffebee;
    }

    .add-condition-container {
      margin-top: 0.75rem;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem;
      color: var(--text-color-secondary);
      gap: 0.5rem;
    }

    .empty-state i {
      font-size: 1.5rem;
      color: var(--surface-400);
    }

    /* Device Remember */
    .device-remember-row {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .switch-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: var(--surface-ground);
      border-radius: 6px;
      border: 1px solid var(--surface-border);
    }

    .switch-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-color);
    }

    /* Settings Grid */
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .field {
      margin-bottom: 0;
    }

    .field-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
      font-size: 0.875rem;
    }

    .hint {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .w-full {
      width: 100%;
    }

    .p-error {
      font-size: 0.75rem;
    }

    /* Actions */
    .form-actions {
      display: flex;
      gap: 0.75rem;
      padding-top: 0.5rem;
    }

    @media (max-width: 768px) {
      :host {
        padding: 1rem;
      }

      .methods-grid {
        grid-template-columns: 1fr;
      }

      .condition-fields {
        flex-direction: column;
        align-items: stretch;
      }

      .condition-arrow {
        display: none;
      }

      .remove-condition-btn {
        align-self: flex-end;
      }

      .settings-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class MfaPolicyComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/policies/mfa';

  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';

  mfaForm!: FormGroup;

  readonly mfaMethodOptions = [
    { label: 'TOTP (Authenticator App)', value: 'TOTP', description: 'Time-based one-time password via authenticator apps like Google Authenticator' },
    { label: 'FIDO2 (WebAuthn)', value: 'FIDO2', description: 'Hardware security keys or platform authenticators (fingerprint, face)' },
    { label: 'Soft Token', value: 'SOFT_TOKEN', description: 'Software-based token generation on enrolled devices' },
    { label: 'Backup Code', value: 'BACKUP_CODE', description: 'Pre-generated one-time use recovery codes' }
  ];

  readonly triggerOptions = [
    { label: 'IP Address Change', value: 'IP_CHANGE' },
    { label: 'Device Change', value: 'DEVICE_CHANGE' },
    { label: 'Sensitive Action', value: 'SENSITIVE_ACTION' },
    { label: 'Time-Based', value: 'TIME_BASED' }
  ];

  readonly actionOptions = [
    { label: 'Require MFA', value: 'REQUIRE_MFA' },
    { label: 'Require Re-authentication', value: 'REQUIRE_REAUTHENTICATION' }
  ];

  get conditionsArray(): FormArray {
    return this.mfaForm.get('stepUpConditions') as FormArray;
  }

  get noMethodSelected(): boolean {
    return !this.mfaMethodOptions.some(m => this.mfaForm.get('method_' + m.value)?.value === true);
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPolicy();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ------------------------------------------------------------------ */
  /*  Form initialization                                                */
  /* ------------------------------------------------------------------ */

  private initForm(): void {
    const group: Record<string, any> = {
      stepUpConditions: this.fb.array([]),
      deviceRememberEnabled: [false],
      deviceRememberDays: [30],
      enrollmentGracePeriodDays: [0],
      backupCodesCount: [10, [Validators.min(5), Validators.max(20)]]
    };

    // Individual method controls
    this.mfaMethodOptions.forEach(m => {
      group['method_' + m.value] = [false];
    });

    this.mfaForm = this.fb.group(group);
  }

  private createConditionGroup(condition?: StepUpCondition): FormGroup {
    return this.fb.group({
      trigger: [condition?.trigger || 'IP_CHANGE', Validators.required],
      action: [condition?.action || 'REQUIRE_MFA', Validators.required]
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Data loading                                                       */
  /* ------------------------------------------------------------------ */

  private loadPolicy(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<MfaPolicy>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (data) {
            // Set allowed methods
            this.mfaMethodOptions.forEach(m => {
              this.mfaForm.get('method_' + m.value)?.setValue(
                (data.allowedMethods || []).includes(m.value)
              );
            });

            // Set step-up conditions
            const conditionsArray = this.mfaForm.get('stepUpConditions') as FormArray;
            conditionsArray.clear();
            (data.stepUpConditions || []).forEach(c => {
              conditionsArray.push(this.createConditionGroup(c));
            });

            // Set other fields
            this.mfaForm.patchValue({
              deviceRememberEnabled: data.deviceRememberEnabled ?? false,
              deviceRememberDays: data.deviceRememberDays ?? 30,
              enrollmentGracePeriodDays: data.enrollmentGracePeriodDays ?? 0,
              backupCodesCount: data.backupCodesCount ?? 10
            });

            this.mfaForm.markAsPristine();
          }
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load MFA policy. Please try again.';
          this.loading = false;
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Save operations                                                    */
  /* ------------------------------------------------------------------ */

  onSave(): void {
    if (this.mfaForm.invalid || this.noMethodSelected) {
      this.mfaForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = this.buildPayload();

    this.http.put<ApiResponse<MfaPolicy>>(this.apiBase, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.successMessage = 'MFA policy saved successfully.';
          this.mfaForm.markAsPristine();
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to save MFA policy. Please try again.';
        }
      });
  }

  private buildPayload(): MfaPolicy {
    const allowedMethods: string[] = [];
    this.mfaMethodOptions.forEach(m => {
      if (this.mfaForm.get('method_' + m.value)?.value) {
        allowedMethods.push(m.value);
      }
    });

    const stepUpConditions: StepUpCondition[] = this.conditionsArray.value;

    return {
      allowedMethods,
      stepUpConditions,
      deviceRememberEnabled: this.mfaForm.get('deviceRememberEnabled')?.value,
      deviceRememberDays: this.mfaForm.get('deviceRememberDays')?.value,
      enrollmentGracePeriodDays: this.mfaForm.get('enrollmentGracePeriodDays')?.value,
      backupCodesCount: this.mfaForm.get('backupCodesCount')?.value
    };
  }

  /* ------------------------------------------------------------------ */
  /*  UI helpers                                                         */
  /* ------------------------------------------------------------------ */

  isMethodSelected(value: string): boolean {
    return this.mfaForm.get('method_' + value)?.value === true;
  }

  getMethodControl(value: string): any {
    return this.mfaForm.get('method_' + value);
  }

  addCondition(): void {
    this.conditionsArray.push(this.createConditionGroup());
    this.mfaForm.markAsDirty();
  }

  removeCondition(index: number): void {
    this.conditionsArray.removeAt(index);
    this.mfaForm.markAsDirty();
  }

  trackByIndex(index: number): number {
    return index;
  }
}
