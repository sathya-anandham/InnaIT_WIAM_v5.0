import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse } from '@innait/core';

import { TabViewModule } from 'primeng/tabview';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface AuthTypeConfig {
  primaryFactors: string[];
  secondaryFactors: string[];
  mfaRequired: 'ALWAYS' | 'CONDITIONAL' | 'NEVER';
  mfaGracePeriodDays: number;
}

interface GroupAuthConfig {
  groupId: string;
  groupName: string;
  config: AuthTypeConfig | null;
}

interface RoleAuthConfig {
  roleId: string;
  roleName: string;
  config: AuthTypeConfig | null;
}

interface ApplicationAuthConfig {
  appId: string;
  appName: string;
  config: AuthTypeConfig | null;
}

interface AuthTypeResponse {
  tenant: AuthTypeConfig;
  groups: GroupAuthConfig[];
  roles: RoleAuthConfig[];
  applications: ApplicationAuthConfig[];
}

interface LevelOverride {
  id: string;
  name: string;
  overrideEnabled: boolean;
  config: AuthTypeConfig | null;
  form: FormGroup;
}

@Component({
  selector: 'app-auth-type-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    TabViewModule,
    CardModule,
    CheckboxModule,
    InputNumberModule,
    InputSwitchModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    RadioButtonModule
  ],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading authentication type configuration">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'policies.authType.loading' | translate }}</p>
    </div>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="error-banner" role="alert">
    </p-message>

    <!-- Success State -->
    <p-message *ngIf="successMessage && !loading" severity="success" [text]="successMessage"
               styleClass="success-banner" role="status">
    </p-message>

    <!-- Main Content -->
    <p-card *ngIf="!loading" [header]="'policies.authType.title' | translate"
            [subheader]="'policies.authType.subtitle' | translate"
            styleClass="auth-type-card">

      <p-tabView (onChange)="onTabChange($event)" [(activeIndex)]="activeTabIndex">

        <!-- Tenant Tab -->
        <p-tabPanel [header]="'policies.authType.tenantTab' | translate">
          <form [formGroup]="tenantForm" (ngSubmit)="saveTenantConfig()" aria-label="Tenant authentication type configuration">
            <ng-container *ngTemplateOutlet="authConfigForm; context: { $implicit: tenantForm, level: 'tenant' }">
            </ng-container>

            <div class="actions">
              <p-button type="submit"
                        [label]="'policies.authType.save' | translate"
                        icon="pi pi-save"
                        [disabled]="tenantForm.pristine || saving"
                        [loading]="saving"
                        aria-label="Save tenant authentication configuration">
              </p-button>
            </div>
          </form>
        </p-tabPanel>

        <!-- Groups Tab -->
        <p-tabPanel [header]="'policies.authType.groupsTab' | translate">
          <div *ngIf="groupOverrides.length === 0" class="empty-state" role="status">
            <i class="pi pi-info-circle" aria-hidden="true"></i>
            <p>{{ 'policies.authType.noGroups' | translate }}</p>
          </div>

          <div *ngFor="let group of groupOverrides; trackBy: trackByOverrideId" class="override-card">
            <div class="override-header">
              <span class="override-name">{{ group.name }}</span>
              <div class="override-toggle">
                <label [for]="'group-override-' + group.id" class="toggle-label">
                  {{ 'policies.authType.overrideToggle' | translate }}
                </label>
                <p-inputSwitch [inputId]="'group-override-' + group.id"
                               [(ngModel)]="group.overrideEnabled"
                               [ngModelOptions]="{ standalone: true }"
                               (onChange)="onOverrideToggle(group)"
                               [attr.aria-label]="'Toggle override for group ' + group.name">
                </p-inputSwitch>
              </div>
            </div>

            <div *ngIf="!group.overrideEnabled" class="inherited-notice" role="status">
              <i class="pi pi-link" aria-hidden="true"></i>
              <span>{{ 'policies.authType.inheritedFromTenant' | translate }}</span>
            </div>

            <form *ngIf="group.overrideEnabled" [formGroup]="group.form"
                  (ngSubmit)="saveLevelConfig('groups', group.id, group.form)"
                  [attr.aria-label]="'Authentication configuration for group ' + group.name">
              <ng-container *ngTemplateOutlet="authConfigForm; context: { $implicit: group.form, level: 'group' }">
              </ng-container>

              <div class="actions">
                <p-button type="submit"
                          [label]="'policies.authType.save' | translate"
                          icon="pi pi-save"
                          [disabled]="group.form.pristine || saving"
                          [loading]="saving"
                          aria-label="Save group authentication configuration">
                </p-button>
              </div>
            </form>
          </div>
        </p-tabPanel>

        <!-- Roles Tab -->
        <p-tabPanel [header]="'policies.authType.rolesTab' | translate">
          <div *ngIf="roleOverrides.length === 0" class="empty-state" role="status">
            <i class="pi pi-info-circle" aria-hidden="true"></i>
            <p>{{ 'policies.authType.noRoles' | translate }}</p>
          </div>

          <div *ngFor="let role of roleOverrides; trackBy: trackByOverrideId" class="override-card">
            <div class="override-header">
              <span class="override-name">{{ role.name }}</span>
              <div class="override-toggle">
                <label [for]="'role-override-' + role.id" class="toggle-label">
                  {{ 'policies.authType.overrideToggle' | translate }}
                </label>
                <p-inputSwitch [inputId]="'role-override-' + role.id"
                               [(ngModel)]="role.overrideEnabled"
                               [ngModelOptions]="{ standalone: true }"
                               (onChange)="onOverrideToggle(role)"
                               [attr.aria-label]="'Toggle override for role ' + role.name">
                </p-inputSwitch>
              </div>
            </div>

            <div *ngIf="!role.overrideEnabled" class="inherited-notice" role="status">
              <i class="pi pi-link" aria-hidden="true"></i>
              <span>{{ 'policies.authType.inheritedFromTenant' | translate }}</span>
            </div>

            <form *ngIf="role.overrideEnabled" [formGroup]="role.form"
                  (ngSubmit)="saveLevelConfig('roles', role.id, role.form)"
                  [attr.aria-label]="'Authentication configuration for role ' + role.name">
              <ng-container *ngTemplateOutlet="authConfigForm; context: { $implicit: role.form, level: 'role' }">
              </ng-container>

              <div class="actions">
                <p-button type="submit"
                          [label]="'policies.authType.save' | translate"
                          icon="pi pi-save"
                          [disabled]="role.form.pristine || saving"
                          [loading]="saving"
                          aria-label="Save role authentication configuration">
                </p-button>
              </div>
            </form>
          </div>
        </p-tabPanel>

        <!-- Applications Tab -->
        <p-tabPanel [header]="'policies.authType.applicationsTab' | translate">
          <div *ngIf="applicationOverrides.length === 0" class="empty-state" role="status">
            <i class="pi pi-info-circle" aria-hidden="true"></i>
            <p>{{ 'policies.authType.noApplications' | translate }}</p>
          </div>

          <div *ngFor="let app of applicationOverrides; trackBy: trackByOverrideId" class="override-card">
            <div class="override-header">
              <span class="override-name">{{ app.name }}</span>
              <div class="override-toggle">
                <label [for]="'app-override-' + app.id" class="toggle-label">
                  {{ 'policies.authType.overrideToggle' | translate }}
                </label>
                <p-inputSwitch [inputId]="'app-override-' + app.id"
                               [(ngModel)]="app.overrideEnabled"
                               [ngModelOptions]="{ standalone: true }"
                               (onChange)="onOverrideToggle(app)"
                               [attr.aria-label]="'Toggle override for application ' + app.name">
                </p-inputSwitch>
              </div>
            </div>

            <div *ngIf="!app.overrideEnabled" class="inherited-notice" role="status">
              <i class="pi pi-link" aria-hidden="true"></i>
              <span>{{ 'policies.authType.inheritedFromTenant' | translate }}</span>
            </div>

            <form *ngIf="app.overrideEnabled" [formGroup]="app.form"
                  (ngSubmit)="saveLevelConfig('applications', app.id, app.form)"
                  [attr.aria-label]="'Authentication configuration for application ' + app.name">
              <ng-container *ngTemplateOutlet="authConfigForm; context: { $implicit: app.form, level: 'application' }">
              </ng-container>

              <div class="actions">
                <p-button type="submit"
                          [label]="'policies.authType.save' | translate"
                          icon="pi pi-save"
                          [disabled]="app.form.pristine || saving"
                          [loading]="saving"
                          aria-label="Save application authentication configuration">
                </p-button>
              </div>
            </form>
          </div>
        </p-tabPanel>
      </p-tabView>
    </p-card>

    <!-- Reusable Auth Config Form Template -->
    <ng-template #authConfigForm let-form let-level="level">
      <div class="config-section">
        <!-- Primary Factors -->
        <div class="field-group">
          <h4 class="section-title">{{ 'policies.authType.primaryFactors' | translate }}</h4>
          <div class="checkbox-grid" role="group" aria-label="Primary authentication factors">
            <div *ngFor="let factor of primaryFactorOptions" class="checkbox-item">
              <p-checkbox [formControl]="getPrimaryFactorControl(form, factor.value)"
                          [binary]="true"
                          [inputId]="level + '-primary-' + factor.value"
                          [label]="factor.label"
                          [attr.aria-label]="'Primary factor: ' + factor.label">
              </p-checkbox>
            </div>
          </div>
        </div>

        <!-- Secondary Factors (MFA) -->
        <div class="field-group">
          <h4 class="section-title">{{ 'policies.authType.secondaryFactors' | translate }}</h4>
          <div class="checkbox-grid" role="group" aria-label="Secondary authentication factors (MFA)">
            <div *ngFor="let factor of secondaryFactorOptions" class="checkbox-item">
              <p-checkbox [formControl]="getSecondaryFactorControl(form, factor.value)"
                          [binary]="true"
                          [inputId]="level + '-secondary-' + factor.value"
                          [label]="factor.label"
                          [attr.aria-label]="'Secondary factor: ' + factor.label">
              </p-checkbox>
            </div>
          </div>
        </div>

        <!-- MFA Required -->
        <div class="field-group">
          <h4 class="section-title">{{ 'policies.authType.mfaRequired' | translate }}</h4>
          <div class="radio-group" role="radiogroup" aria-label="MFA requirement level">
            <div *ngFor="let option of mfaRequiredOptions" class="radio-item">
              <p-radioButton [formControlName]="'mfaRequired'"
                             [inputId]="level + '-mfa-' + option.value"
                             [value]="option.value"
                             [label]="option.label">
              </p-radioButton>
            </div>
          </div>
        </div>

        <!-- MFA Grace Period -->
        <div class="field">
          <label [for]="level + '-gracePeriod'" class="field-label">
            {{ 'policies.authType.mfaGracePeriod' | translate }}
          </label>
          <p-inputNumber [inputId]="level + '-gracePeriod'"
                         formControlName="mfaGracePeriodDays"
                         [min]="0"
                         [max]="365"
                         suffix=" days"
                         [showButtons]="true"
                         aria-label="MFA grace period in days">
          </p-inputNumber>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 960px;
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

    .config-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1rem 0;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 600;
      margin: 0;
      color: var(--text-color);
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--surface-border);
    }

    .checkbox-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .checkbox-item {
      min-width: 180px;
    }

    .radio-group {
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
    }

    .radio-item {
      min-width: 150px;
    }

    .field {
      margin-bottom: 1rem;
    }

    .field-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
      font-size: 0.875rem;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    /* Override cards */
    .override-card {
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1rem;
      background: var(--surface-card);
    }

    .override-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .override-name {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .override-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .toggle-label {
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
    }

    .inherited-notice {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--surface-ground);
      border-radius: 6px;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .inherited-notice i {
      color: var(--primary-color);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 2rem;
      color: var(--text-color-secondary);
      gap: 0.5rem;
    }

    .empty-state i {
      font-size: 2rem;
      color: var(--surface-400);
    }

    @media (max-width: 768px) {
      :host {
        padding: 1rem;
      }

      .checkbox-grid {
        flex-direction: column;
      }

      .radio-group {
        flex-direction: column;
      }

      .override-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }
    }
  `]
})
export class AuthTypeConfigComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/policies/auth-type';

  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';
  activeTabIndex = 0;

  tenantForm!: FormGroup;
  groupOverrides: LevelOverride[] = [];
  roleOverrides: LevelOverride[] = [];
  applicationOverrides: LevelOverride[] = [];

  readonly primaryFactorOptions = [
    { label: 'Password', value: 'PASSWORD' },
    { label: 'FIDO2 (WebAuthn)', value: 'FIDO2' },
    { label: 'Certificate', value: 'CERTIFICATE' }
  ];

  readonly secondaryFactorOptions = [
    { label: 'TOTP (Authenticator App)', value: 'TOTP' },
    { label: 'Soft Token', value: 'SOFT_TOKEN' },
    { label: 'FIDO2 (WebAuthn)', value: 'FIDO2' },
    { label: 'Backup Code', value: 'BACKUP_CODE' }
  ];

  readonly mfaRequiredOptions = [
    { label: 'Always', value: 'ALWAYS' },
    { label: 'Conditional', value: 'CONDITIONAL' },
    { label: 'Never', value: 'NEVER' }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.tenantForm = this.createConfigForm();
    this.loadConfiguration();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ------------------------------------------------------------------ */
  /*  Form creation                                                      */
  /* ------------------------------------------------------------------ */

  private createConfigForm(config?: AuthTypeConfig | null): FormGroup {
    const primaryFactors = config?.primaryFactors || [];
    const secondaryFactors = config?.secondaryFactors || [];

    const group: Record<string, FormControl | any> = {
      mfaRequired: [config?.mfaRequired || 'NEVER'],
      mfaGracePeriodDays: [config?.mfaGracePeriodDays ?? 0]
    };

    // Create individual boolean controls for each primary factor
    this.primaryFactorOptions.forEach(opt => {
      group['primary_' + opt.value] = [primaryFactors.includes(opt.value)];
    });

    // Create individual boolean controls for each secondary factor
    this.secondaryFactorOptions.forEach(opt => {
      group['secondary_' + opt.value] = [secondaryFactors.includes(opt.value)];
    });

    return this.fb.group(group);
  }

  private extractConfigFromForm(form: FormGroup): AuthTypeConfig {
    const primaryFactors: string[] = [];
    const secondaryFactors: string[] = [];

    this.primaryFactorOptions.forEach(opt => {
      if (form.get('primary_' + opt.value)?.value) {
        primaryFactors.push(opt.value);
      }
    });

    this.secondaryFactorOptions.forEach(opt => {
      if (form.get('secondary_' + opt.value)?.value) {
        secondaryFactors.push(opt.value);
      }
    });

    return {
      primaryFactors,
      secondaryFactors,
      mfaRequired: form.get('mfaRequired')?.value || 'NEVER',
      mfaGracePeriodDays: form.get('mfaGracePeriodDays')?.value ?? 0
    };
  }

  getPrimaryFactorControl(form: FormGroup, factorValue: string): FormControl {
    return form.get('primary_' + factorValue) as FormControl;
  }

  getSecondaryFactorControl(form: FormGroup, factorValue: string): FormControl {
    return form.get('secondary_' + factorValue) as FormControl;
  }

  /* ------------------------------------------------------------------ */
  /*  Data loading                                                       */
  /* ------------------------------------------------------------------ */

  private loadConfiguration(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<AuthTypeResponse>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (data) {
            // Tenant config
            this.tenantForm = this.createConfigForm(data.tenant);

            // Groups
            this.groupOverrides = (data.groups || []).map(g => ({
              id: g.groupId,
              name: g.groupName,
              overrideEnabled: g.config !== null,
              config: g.config,
              form: this.createConfigForm(g.config || data.tenant)
            }));

            // Roles
            this.roleOverrides = (data.roles || []).map(r => ({
              id: r.roleId,
              name: r.roleName,
              overrideEnabled: r.config !== null,
              config: r.config,
              form: this.createConfigForm(r.config || data.tenant)
            }));

            // Applications
            this.applicationOverrides = (data.applications || []).map(a => ({
              id: a.appId,
              name: a.appName,
              overrideEnabled: a.config !== null,
              config: a.config,
              form: this.createConfigForm(a.config || data.tenant)
            }));
          }
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load authentication type configuration. Please try again.';
          this.loading = false;
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Save operations                                                    */
  /* ------------------------------------------------------------------ */

  saveTenantConfig(): void {
    if (this.tenantForm.pristine) return;

    const config = this.extractConfigFromForm(this.tenantForm);
    this.saveConfig({ level: 'TENANT', targetId: null, config });
  }

  saveLevelConfig(level: string, targetId: string, form: FormGroup): void {
    if (form.pristine) return;

    const levelMap: Record<string, string> = {
      groups: 'GROUP',
      roles: 'ROLE',
      applications: 'APPLICATION'
    };

    const config = this.extractConfigFromForm(form);
    this.saveConfig({ level: levelMap[level]!, targetId, config });
  }

  private saveConfig(payload: { level: string; targetId: string | null; config: AuthTypeConfig }): void {
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.put<ApiResponse<AuthTypeConfig>>(this.apiBase, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Authentication type configuration saved successfully.';
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to save authentication type configuration. Please try again.';
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  UI event handlers                                                  */
  /* ------------------------------------------------------------------ */

  onTabChange(event: any): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  onOverrideToggle(override: LevelOverride): void {
    if (override.overrideEnabled && !override.config) {
      // Reset form to tenant defaults when enabling override
      override.form = this.createConfigForm(this.extractConfigFromForm(this.tenantForm));
    }
  }

  trackByOverrideId(index: number, item: LevelOverride): string {
    return item.id;
  }
}
