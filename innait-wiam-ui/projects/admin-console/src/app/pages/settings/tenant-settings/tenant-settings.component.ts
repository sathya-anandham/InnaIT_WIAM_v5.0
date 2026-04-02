import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

interface TenantSettings {
  tenantName: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  defaultLocale: string;
  address: string;
  industry: string;
  lastModifiedAt?: string;
  lastModifiedBy?: string;
}

@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    DropdownModule,
    InputTextareaModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule
  ],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading tenant settings">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'settings.tenant.loading' | translate }}</p>
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
    <p-card *ngIf="!loading" [header]="'settings.tenant.title' | translate"
            [subheader]="lastModifiedLabel" styleClass="tenant-settings-card">
      <form [formGroup]="settingsForm" (ngSubmit)="onSave()" aria-label="Tenant settings form">

        <!-- Tenant Name -->
        <div class="field">
          <label for="tenantName" class="field-label">{{ 'settings.tenant.tenantName' | translate }} *</label>
          <input pInputText id="tenantName" formControlName="tenantName"
                 [placeholder]="'settings.tenant.tenantNamePlaceholder' | translate"
                 aria-required="true"
                 [attr.aria-invalid]="settingsForm.get('tenantName')?.invalid && settingsForm.get('tenantName')?.touched"
                 class="w-full" />
          <small *ngIf="settingsForm.get('tenantName')?.invalid && settingsForm.get('tenantName')?.touched"
                 class="p-error" role="alert">
            {{ 'settings.tenant.tenantNameRequired' | translate }}
          </small>
        </div>

        <!-- Contact Email -->
        <div class="field">
          <label for="contactEmail" class="field-label">{{ 'settings.tenant.contactEmail' | translate }} *</label>
          <input pInputText id="contactEmail" formControlName="contactEmail"
                 type="email"
                 [placeholder]="'settings.tenant.contactEmailPlaceholder' | translate"
                 aria-required="true"
                 [attr.aria-invalid]="settingsForm.get('contactEmail')?.invalid && settingsForm.get('contactEmail')?.touched"
                 class="w-full" />
          <small *ngIf="settingsForm.get('contactEmail')?.hasError('required') && settingsForm.get('contactEmail')?.touched"
                 class="p-error" role="alert">
            {{ 'settings.tenant.contactEmailRequired' | translate }}
          </small>
          <small *ngIf="settingsForm.get('contactEmail')?.hasError('email') && settingsForm.get('contactEmail')?.touched"
                 class="p-error" role="alert">
            {{ 'settings.tenant.contactEmailInvalid' | translate }}
          </small>
        </div>

        <!-- Contact Phone -->
        <div class="field">
          <label for="contactPhone" class="field-label">{{ 'settings.tenant.contactPhone' | translate }}</label>
          <input pInputText id="contactPhone" formControlName="contactPhone"
                 [placeholder]="'settings.tenant.contactPhonePlaceholder' | translate"
                 class="w-full" />
          <small *ngIf="settingsForm.get('contactPhone')?.hasError('pattern') && settingsForm.get('contactPhone')?.touched"
                 class="p-error" role="alert">
            {{ 'settings.tenant.contactPhoneInvalid' | translate }}
          </small>
        </div>

        <!-- Timezone -->
        <div class="field">
          <label for="timezone" class="field-label">{{ 'settings.tenant.timezone' | translate }}</label>
          <p-dropdown id="timezone" formControlName="timezone"
                      [options]="timezoneOptions"
                      [filter]="true"
                      filterBy="label"
                      [placeholder]="'settings.tenant.timezonePlaceholder' | translate"
                      [showClear]="true"
                      appendTo="body"
                      styleClass="w-full"
                      aria-label="Select timezone">
          </p-dropdown>
        </div>

        <!-- Default Locale -->
        <div class="field">
          <label for="defaultLocale" class="field-label">{{ 'settings.tenant.defaultLocale' | translate }}</label>
          <p-dropdown id="defaultLocale" formControlName="defaultLocale"
                      [options]="localeOptions"
                      [placeholder]="'settings.tenant.defaultLocalePlaceholder' | translate"
                      styleClass="w-full"
                      aria-label="Select default locale">
          </p-dropdown>
        </div>

        <!-- Address -->
        <div class="field">
          <label for="address" class="field-label">{{ 'settings.tenant.address' | translate }}</label>
          <textarea pInputTextarea id="address" formControlName="address"
                    [placeholder]="'settings.tenant.addressPlaceholder' | translate"
                    rows="3"
                    class="w-full"
                    aria-label="Tenant address">
          </textarea>
        </div>

        <!-- Industry -->
        <div class="field">
          <label for="industry" class="field-label">{{ 'settings.tenant.industry' | translate }}</label>
          <p-dropdown id="industry" formControlName="industry"
                      [options]="industryOptions"
                      [placeholder]="'settings.tenant.industryPlaceholder' | translate"
                      styleClass="w-full"
                      aria-label="Select industry">
          </p-dropdown>
        </div>

        <!-- Actions -->
        <div class="actions">
          <p-button type="submit"
                    [label]="'settings.tenant.save' | translate"
                    icon="pi pi-save"
                    [disabled]="settingsForm.invalid || settingsForm.pristine || saving"
                    [loading]="saving"
                    aria-label="Save tenant settings">
          </p-button>
          <p-button [label]="'settings.tenant.reset' | translate"
                    icon="pi pi-undo"
                    styleClass="p-button-outlined p-button-secondary"
                    [disabled]="settingsForm.pristine || saving"
                    (onClick)="onReset()"
                    aria-label="Reset form changes">
          </p-button>
        </div>
      </form>
    </p-card>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 720px;
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

    .field {
      margin-bottom: 1.25rem;
    }

    .field-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
      font-size: 0.875rem;
    }

    .w-full {
      width: 100%;
    }

    .p-error {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    :host ::ng-deep .error-banner,
    :host ::ng-deep .success-banner {
      width: 100%;
      margin-bottom: 1rem;
    }

    :host ::ng-deep .tenant-settings-card .p-card-subtitle {
      font-size: 0.8rem;
      color: var(--text-color-secondary);
    }
  `]
})
export class TenantSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/settings/tenant';
  private originalSettings: TenantSettings | null = null;

  settingsForm!: FormGroup;
  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';
  lastModifiedLabel = '';

  timezoneOptions = [
    { label: 'UTC (Coordinated Universal Time)', value: 'UTC' },
    { label: 'Asia/Kolkata (IST, +05:30)', value: 'Asia/Kolkata' },
    { label: 'Asia/Chennai (IST, +05:30)', value: 'Asia/Chennai' },
    { label: 'America/New_York (EST, -05:00)', value: 'America/New_York' },
    { label: 'America/Chicago (CST, -06:00)', value: 'America/Chicago' },
    { label: 'America/Denver (MST, -07:00)', value: 'America/Denver' },
    { label: 'America/Los_Angeles (PST, -08:00)', value: 'America/Los_Angeles' },
    { label: 'Europe/London (GMT, +00:00)', value: 'Europe/London' },
    { label: 'Europe/Paris (CET, +01:00)', value: 'Europe/Paris' },
    { label: 'Europe/Berlin (CET, +01:00)', value: 'Europe/Berlin' },
    { label: 'Asia/Tokyo (JST, +09:00)', value: 'Asia/Tokyo' },
    { label: 'Asia/Shanghai (CST, +08:00)', value: 'Asia/Shanghai' },
    { label: 'Asia/Singapore (SGT, +08:00)', value: 'Asia/Singapore' },
    { label: 'Asia/Dubai (GST, +04:00)', value: 'Asia/Dubai' },
    { label: 'Australia/Sydney (AEST, +10:00)', value: 'Australia/Sydney' },
    { label: 'Pacific/Auckland (NZST, +12:00)', value: 'Pacific/Auckland' },
    { label: 'America/Sao_Paulo (BRT, -03:00)', value: 'America/Sao_Paulo' },
    { label: 'Africa/Johannesburg (SAST, +02:00)', value: 'Africa/Johannesburg' }
  ];

  localeOptions = [
    { label: 'English', value: 'en' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Tamil', value: 'ta' }
  ];

  industryOptions = [
    { label: 'Finance', value: 'Finance' },
    { label: 'Healthcare', value: 'Healthcare' },
    { label: 'Technology', value: 'Technology' },
    { label: 'Education', value: 'Education' },
    { label: 'Government', value: 'Government' },
    { label: 'Other', value: 'Other' }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.settingsForm = this.fb.group({
      tenantName: ['', [Validators.required]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactPhone: ['', [Validators.pattern(/^\+?[\d\s\-().]{7,20}$/)]],
      timezone: ['UTC'],
      defaultLocale: ['en'],
      address: [''],
      industry: ['']
    });
  }

  private loadSettings(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<TenantSettings>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (data) {
            this.originalSettings = { ...data };
            this.settingsForm.patchValue({
              tenantName: data.tenantName || '',
              contactEmail: data.contactEmail || '',
              contactPhone: data.contactPhone || '',
              timezone: data.timezone || 'UTC',
              defaultLocale: data.defaultLocale || 'en',
              address: data.address || '',
              industry: data.industry || ''
            });
            this.settingsForm.markAsPristine();
            this.updateLastModifiedLabel(data);
          }
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load tenant settings. Please try again.';
          this.loading = false;
        }
      });
  }

  private updateLastModifiedLabel(data: TenantSettings): void {
    if (data.lastModifiedAt) {
      const date = new Date(data.lastModifiedAt).toLocaleString();
      const by = data.lastModifiedBy || 'Unknown';
      this.lastModifiedLabel = `Last modified on ${date} by ${by}`;
    } else {
      this.lastModifiedLabel = '';
    }
  }

  onSave(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.put<ApiResponse<TenantSettings>>(this.apiBase, this.settingsForm.value)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: (response) => {
          this.successMessage = 'Tenant settings saved successfully.';
          if (response.data) {
            this.originalSettings = { ...response.data };
            this.updateLastModifiedLabel(response.data);
          }
          this.settingsForm.markAsPristine();
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to save tenant settings. Please try again.';
        }
      });
  }

  onReset(): void {
    if (this.originalSettings) {
      this.settingsForm.patchValue({
        tenantName: this.originalSettings.tenantName || '',
        contactEmail: this.originalSettings.contactEmail || '',
        contactPhone: this.originalSettings.contactPhone || '',
        timezone: this.originalSettings.timezone || 'UTC',
        defaultLocale: this.originalSettings.defaultLocale || 'en',
        address: this.originalSettings.address || '',
        industry: this.originalSettings.industry || ''
      });
      this.settingsForm.markAsPristine();
    }
    this.errorMessage = '';
    this.successMessage = '';
  }
}
