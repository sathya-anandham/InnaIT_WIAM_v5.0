import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { User, ApiResponse } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

interface DropdownOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-profile-view-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    DropdownModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    ToastModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-right" />

    <!-- Loading State -->
    <div class="loading-container" *ngIf="loading" role="status" aria-label="Loading profile">
      <p-progressSpinner strokeWidth="3" animationDuration="1s" />
      <p class="loading-text">{{ 'profile.loading' | translate }}</p>
    </div>

    <!-- Error State -->
    <p-message
      *ngIf="errorMessage && !loading"
      severity="error"
      [text]="errorMessage"
      styleClass="mb-3 w-full"
      role="alert"
    />

    <!-- Profile Card -->
    <p-card *ngIf="!loading && user" [header]="'profile.title' | translate" styleClass="profile-card">
      <ng-template pTemplate="header">
        <div class="profile-header">
          <div class="profile-avatar" aria-hidden="true">
            <span class="avatar-initials">{{ getInitials() }}</span>
          </div>
          <div class="profile-header-info">
            <h2 class="profile-name">{{ user.displayName }}</h2>
            <p class="profile-role">{{ user.designation }} &middot; {{ user.department }}</p>
          </div>
          <div class="profile-header-actions">
            <p-button
              *ngIf="!editMode"
              [label]="'profile.edit' | translate"
              icon="pi pi-pencil"
              severity="secondary"
              (onClick)="enableEdit()"
              [attr.aria-label]="'profile.edit' | translate"
            />
            <p-button
              *ngIf="editMode"
              [label]="'common.cancel' | translate"
              icon="pi pi-times"
              severity="secondary"
              (onClick)="cancelEdit()"
              class="mr-2"
              [attr.aria-label]="'common.cancel' | translate"
            />
            <p-button
              *ngIf="editMode"
              [label]="'common.save' | translate"
              icon="pi pi-check"
              (onClick)="saveProfile()"
              [loading]="saving"
              [disabled]="!profileForm.valid || !profileForm.dirty"
              [attr.aria-label]="'common.save' | translate"
            />
          </div>
        </div>
      </ng-template>

      <!-- View Mode -->
      <div class="profile-fields" *ngIf="!editMode" role="region" aria-label="Profile information">
        <div class="field-group">
          <div class="field-row">
            <span class="field-label">{{ 'profile.firstName' | translate }}</span>
            <span class="field-value">{{ user.firstName }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{ 'profile.lastName' | translate }}</span>
            <span class="field-value">{{ user.lastName }}</span>
          </div>
        </div>
        <div class="field-group">
          <div class="field-row">
            <span class="field-label">{{ 'profile.email' | translate }}</span>
            <span class="field-value">{{ user.email }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{ 'profile.employeeNo' | translate }}</span>
            <span class="field-value">{{ user.employeeNo || '—' }}</span>
          </div>
        </div>
        <div class="field-group">
          <div class="field-row">
            <span class="field-label">{{ 'profile.department' | translate }}</span>
            <span class="field-value">{{ user.department || '—' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{ 'profile.designation' | translate }}</span>
            <span class="field-value">{{ user.designation || '—' }}</span>
          </div>
        </div>
        <div class="field-group">
          <div class="field-row">
            <span class="field-label">{{ 'profile.locale' | translate }}</span>
            <span class="field-value">{{ getLocaleLabel(user.locale) }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">{{ 'profile.timezone' | translate }}</span>
            <span class="field-value">{{ user.timezone }}</span>
          </div>
        </div>
      </div>

      <!-- Edit Mode -->
      <form
        *ngIf="editMode"
        [formGroup]="profileForm"
        (ngSubmit)="saveProfile()"
        class="profile-form"
        role="form"
        aria-label="Edit profile form"
      >
        <div class="form-grid">
          <!-- First Name -->
          <div class="form-field">
            <label for="firstName">{{ 'profile.firstName' | translate }} *</label>
            <input
              pInputText
              id="firstName"
              formControlName="firstName"
              [attr.aria-label]="'profile.firstName' | translate"
              aria-required="true"
            />
            <small
              class="p-error"
              *ngIf="profileForm.get('firstName')?.invalid && profileForm.get('firstName')?.touched"
              role="alert"
            >
              <span *ngIf="profileForm.get('firstName')?.errors?.['required']">
                {{ 'profile.firstNameRequired' | translate }}
              </span>
              <span *ngIf="profileForm.get('firstName')?.errors?.['minlength']">
                {{ 'profile.firstNameMinLength' | translate }}
              </span>
            </small>
          </div>

          <!-- Last Name -->
          <div class="form-field">
            <label for="lastName">{{ 'profile.lastName' | translate }} *</label>
            <input
              pInputText
              id="lastName"
              formControlName="lastName"
              [attr.aria-label]="'profile.lastName' | translate"
              aria-required="true"
            />
            <small
              class="p-error"
              *ngIf="profileForm.get('lastName')?.invalid && profileForm.get('lastName')?.touched"
              role="alert"
            >
              <span *ngIf="profileForm.get('lastName')?.errors?.['required']">
                {{ 'profile.lastNameRequired' | translate }}
              </span>
              <span *ngIf="profileForm.get('lastName')?.errors?.['minlength']">
                {{ 'profile.lastNameMinLength' | translate }}
              </span>
            </small>
          </div>

          <!-- Email (readonly) -->
          <div class="form-field">
            <label for="email">{{ 'profile.email' | translate }}</label>
            <input
              pInputText
              id="email"
              formControlName="email"
              [attr.aria-label]="'profile.email' | translate"
              [readonly]="true"
              class="readonly-input"
            />
            <small class="field-hint">{{ 'profile.emailReadonly' | translate }}</small>
          </div>

          <!-- Department -->
          <div class="form-field">
            <label for="department">{{ 'profile.department' | translate }}</label>
            <input
              pInputText
              id="department"
              formControlName="department"
              [attr.aria-label]="'profile.department' | translate"
            />
          </div>

          <!-- Designation -->
          <div class="form-field">
            <label for="designation">{{ 'profile.designation' | translate }}</label>
            <input
              pInputText
              id="designation"
              formControlName="designation"
              [attr.aria-label]="'profile.designation' | translate"
            />
          </div>

          <!-- Locale Dropdown -->
          <div class="form-field">
            <label for="locale">{{ 'profile.locale' | translate }}</label>
            <p-dropdown
              id="locale"
              formControlName="locale"
              [options]="localeOptions"
              optionLabel="label"
              optionValue="value"
              [attr.aria-label]="'profile.locale' | translate"
            />
          </div>

          <!-- Timezone Dropdown -->
          <div class="form-field form-field--full">
            <label for="timezone">{{ 'profile.timezone' | translate }}</label>
            <p-dropdown
              id="timezone"
              formControlName="timezone"
              [options]="timezoneOptions"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              filterPlaceholder="Search timezone..."
              [attr.aria-label]="'profile.timezone' | translate"
            />
          </div>
        </div>
      </form>
    </p-card>
  `,
  styles: [`
    :host {
      display: block;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      gap: 1rem;
    }

    .loading-text {
      color: var(--innait-text-secondary, #6b7280);
      font-size: 0.875rem;
    }

    /* Profile Header */
    .profile-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
    }

    .profile-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--innait-primary, #1976d2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar-initials {
      color: #ffffff;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .profile-header-info {
      flex: 1;
    }

    .profile-name {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--innait-text, #1f2937);
    }

    .profile-role {
      margin: 0.25rem 0 0;
      font-size: 0.85rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    .profile-header-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    /* View Mode Fields */
    .profile-fields {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .field-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #f3f4f6;
    }

    .field-group:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .field-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .field-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--innait-text-secondary, #6b7280);
    }

    .field-value {
      font-size: 0.95rem;
      color: var(--innait-text, #1f2937);
    }

    /* Edit Mode Form */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .form-field--full {
      grid-column: 1 / -1;
    }

    .form-field label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--innait-text, #1f2937);
    }

    .form-field input,
    .form-field :host ::ng-deep .p-dropdown {
      width: 100%;
    }

    .readonly-input {
      background: var(--innait-bg, #f9fafb) !important;
      cursor: not-allowed;
      opacity: 0.7;
    }

    .field-hint {
      font-size: 0.75rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    .p-error {
      font-size: 0.75rem;
    }

    .mr-2 {
      margin-right: 0.5rem;
    }

    @media (max-width: 640px) {
      .profile-header {
        flex-wrap: wrap;
      }

      .profile-header-actions {
        width: 100%;
        justify-content: flex-end;
      }

      .field-group,
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class ProfileViewEditComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  editMode = false;
  errorMessage = '';
  user: User | null = null;
  profileForm!: FormGroup;

  localeOptions: DropdownOption[] = [
    { label: 'English', value: 'en' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Tamil', value: 'ta' },
  ];

  timezoneOptions: DropdownOption[] = [
    { label: '(UTC-12:00) Baker Island', value: 'Etc/GMT+12' },
    { label: '(UTC-11:00) Pago Pago', value: 'Pacific/Pago_Pago' },
    { label: '(UTC-10:00) Honolulu', value: 'Pacific/Honolulu' },
    { label: '(UTC-09:00) Anchorage', value: 'America/Anchorage' },
    { label: '(UTC-08:00) Los Angeles', value: 'America/Los_Angeles' },
    { label: '(UTC-07:00) Denver', value: 'America/Denver' },
    { label: '(UTC-06:00) Chicago', value: 'America/Chicago' },
    { label: '(UTC-05:00) New York', value: 'America/New_York' },
    { label: '(UTC-04:00) Halifax', value: 'America/Halifax' },
    { label: '(UTC-03:00) Sao Paulo', value: 'America/Sao_Paulo' },
    { label: '(UTC-02:00) Mid-Atlantic', value: 'Atlantic/South_Georgia' },
    { label: '(UTC-01:00) Azores', value: 'Atlantic/Azores' },
    { label: '(UTC+00:00) London', value: 'Europe/London' },
    { label: '(UTC+01:00) Berlin', value: 'Europe/Berlin' },
    { label: '(UTC+02:00) Cairo', value: 'Africa/Cairo' },
    { label: '(UTC+03:00) Moscow', value: 'Europe/Moscow' },
    { label: '(UTC+03:30) Tehran', value: 'Asia/Tehran' },
    { label: '(UTC+04:00) Dubai', value: 'Asia/Dubai' },
    { label: '(UTC+04:30) Kabul', value: 'Asia/Kabul' },
    { label: '(UTC+05:00) Karachi', value: 'Asia/Karachi' },
    { label: '(UTC+05:30) Kolkata', value: 'Asia/Kolkata' },
    { label: '(UTC+05:45) Kathmandu', value: 'Asia/Kathmandu' },
    { label: '(UTC+06:00) Dhaka', value: 'Asia/Dhaka' },
    { label: '(UTC+06:30) Yangon', value: 'Asia/Yangon' },
    { label: '(UTC+07:00) Bangkok', value: 'Asia/Bangkok' },
    { label: '(UTC+08:00) Singapore', value: 'Asia/Singapore' },
    { label: '(UTC+09:00) Tokyo', value: 'Asia/Tokyo' },
    { label: '(UTC+09:30) Adelaide', value: 'Australia/Adelaide' },
    { label: '(UTC+10:00) Sydney', value: 'Australia/Sydney' },
    { label: '(UTC+11:00) Noumea', value: 'Pacific/Noumea' },
    { label: '(UTC+12:00) Auckland', value: 'Pacific/Auckland' },
    { label: '(UTC+13:00) Apia', value: 'Pacific/Apia' },
  ];

  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/self';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly messageService: MessageService,
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getInitials(): string {
    if (!this.user) return '';
    const first = this.user.firstName?.charAt(0) ?? '';
    const last = this.user.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }

  getLocaleLabel(locale: string): string {
    const found = this.localeOptions.find((o) => o.value === locale);
    return found ? found.label : locale;
  }

  enableEdit(): void {
    this.editMode = true;
    this.patchFormFromUser();
  }

  cancelEdit(): void {
    this.editMode = false;
    this.profileForm.reset();
    this.patchFormFromUser();
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.saving) return;

    this.saving = true;
    const formValue = this.profileForm.getRawValue();

    const payload = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      department: formValue.department,
      designation: formValue.designation,
      locale: formValue.locale,
      timezone: formValue.timezone,
    };

    this.http
      .put<ApiResponse<User>>(`${this.apiBase}/profile`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.user = response.data;
          this.editMode = false;
          this.saving = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Profile Updated',
            detail: 'Your profile has been saved successfully.',
            life: 4000,
          });
        },
        error: (err) => {
          this.saving = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Update Failed',
            detail: err?.error?.error?.message ?? 'Failed to update profile. Please try again.',
            life: 5000,
          });
        },
      });
  }

  private initForm(): void {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }],
      department: [''],
      designation: [''],
      locale: ['en'],
      timezone: ['Asia/Kolkata'],
    });
  }

  private patchFormFromUser(): void {
    if (!this.user) return;
    this.profileForm.patchValue({
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      email: this.user.email,
      department: this.user.department,
      designation: this.user.designation,
      locale: this.user.locale || 'en',
      timezone: this.user.timezone || 'Asia/Kolkata',
    });
    this.profileForm.markAsPristine();
  }

  private loadProfile(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<ApiResponse<User>>(`${this.apiBase}/profile`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.user = response.data;
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage =
            err?.error?.error?.message ?? 'Failed to load profile. Please try again.';
          this.loading = false;
        },
      });
  }
}
