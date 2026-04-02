import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FileUploadModule } from 'primeng/fileupload';
import { DividerModule } from 'primeng/divider';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

interface BrandingSettings {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  loginBackgroundUrl: string;
  loginTitle: string;
  loginSubtitle: string;
  footerText: string;
}

@Component({
  selector: 'app-branding-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    FileUploadModule,
    DividerModule,
    ConfirmDialogModule
  ],
  providers: [ConfirmationService],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading branding settings">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'settings.branding.loading' | translate }}</p>
    </div>

    <!-- Messages -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage" styleClass="msg-banner" role="alert"></p-message>
    <p-message *ngIf="successMessage && !loading" severity="success" [text]="successMessage" styleClass="msg-banner" role="status"></p-message>

    <div *ngIf="!loading" class="branding-layout">
      <!-- Left Panel: Editor -->
      <div class="editor-panel">
        <p-card [header]="'settings.branding.editorTitle' | translate">
          <form [formGroup]="brandingForm" aria-label="Branding editor form">

            <!-- Logo Upload -->
            <div class="field">
              <label class="field-label">{{ 'settings.branding.logo' | translate }}</label>
              <div class="upload-row">
                <img *ngIf="logoPreview" [src]="logoPreview" alt="Logo preview" class="upload-preview" />
                <div class="upload-controls">
                  <input #logoInput type="file" accept="image/*" (change)="onLogoSelected($event)"
                         class="hidden-input" aria-label="Upload logo image" />
                  <p-button icon="pi pi-upload" [label]="'settings.branding.uploadLogo' | translate"
                            styleClass="p-button-outlined p-button-sm"
                            (onClick)="logoInput.click()" [loading]="uploadingLogo">
                  </p-button>
                  <small class="help-text">{{ 'settings.branding.maxFileSize' | translate }} (2MB)</small>
                </div>
              </div>
            </div>

            <!-- Favicon Upload -->
            <div class="field">
              <label class="field-label">{{ 'settings.branding.favicon' | translate }}</label>
              <div class="upload-row">
                <img *ngIf="faviconPreview" [src]="faviconPreview" alt="Favicon preview" class="upload-preview upload-preview--small" />
                <div class="upload-controls">
                  <input #faviconInput type="file" accept="image/*" (change)="onFaviconSelected($event)"
                         class="hidden-input" aria-label="Upload favicon image" />
                  <p-button icon="pi pi-upload" [label]="'settings.branding.uploadFavicon' | translate"
                            styleClass="p-button-outlined p-button-sm"
                            (onClick)="faviconInput.click()" [loading]="uploadingFavicon">
                  </p-button>
                  <small class="help-text">{{ 'settings.branding.maxFileSize' | translate }} (2MB)</small>
                </div>
              </div>
            </div>

            <p-divider></p-divider>

            <!-- Primary Color -->
            <div class="field">
              <label for="primaryColor" class="field-label">{{ 'settings.branding.primaryColor' | translate }}</label>
              <div class="color-row">
                <input type="color" id="primaryColor" formControlName="primaryColor"
                       class="color-picker" aria-label="Primary color picker" />
                <input pInputText formControlName="primaryColor" class="color-text" placeholder="#3B82F6" />
              </div>
            </div>

            <!-- Accent Color -->
            <div class="field">
              <label for="accentColor" class="field-label">{{ 'settings.branding.accentColor' | translate }}</label>
              <div class="color-row">
                <input type="color" id="accentColor" formControlName="accentColor"
                       class="color-picker" aria-label="Accent color picker" />
                <input pInputText formControlName="accentColor" class="color-text" placeholder="#10B981" />
              </div>
            </div>

            <p-divider></p-divider>

            <!-- Login Background -->
            <div class="field">
              <label class="field-label">{{ 'settings.branding.loginBackground' | translate }}</label>
              <div class="upload-row">
                <input #bgInput type="file" accept="image/*" (change)="onBackgroundSelected($event)"
                       class="hidden-input" aria-label="Upload login background image" />
                <p-button icon="pi pi-image" [label]="'settings.branding.uploadBackground' | translate"
                          styleClass="p-button-outlined p-button-sm"
                          (onClick)="bgInput.click()" [loading]="uploadingBg">
                </p-button>
              </div>
              <div class="field mt-half">
                <label for="loginBackgroundUrl" class="field-label-sm">{{ 'settings.branding.orEnterUrl' | translate }}</label>
                <input pInputText id="loginBackgroundUrl" formControlName="loginBackgroundUrl"
                       placeholder="https://example.com/background.jpg" class="w-full" />
              </div>
            </div>

            <!-- Login Title -->
            <div class="field">
              <label for="loginTitle" class="field-label">{{ 'settings.branding.loginTitle' | translate }}</label>
              <input pInputText id="loginTitle" formControlName="loginTitle"
                     placeholder="Welcome to InnaIT WIAM" class="w-full" />
            </div>

            <!-- Login Subtitle -->
            <div class="field">
              <label for="loginSubtitle" class="field-label">{{ 'settings.branding.loginSubtitle' | translate }}</label>
              <input pInputText id="loginSubtitle" formControlName="loginSubtitle"
                     placeholder="Sign in to your account" class="w-full" />
            </div>

            <!-- Footer Text -->
            <div class="field">
              <label for="footerText" class="field-label">{{ 'settings.branding.footerText' | translate }}</label>
              <input pInputText id="footerText" formControlName="footerText"
                     placeholder="&copy; 2026 Your Company" class="w-full" />
            </div>

            <!-- Actions -->
            <div class="actions">
              <p-button type="button" [label]="'settings.branding.save' | translate"
                        icon="pi pi-save" [loading]="saving" [disabled]="saving"
                        (onClick)="onSave()" aria-label="Save branding settings">
              </p-button>
              <p-button [label]="'settings.branding.resetDefaults' | translate"
                        icon="pi pi-refresh"
                        styleClass="p-button-outlined p-button-danger"
                        (onClick)="onResetToDefaults()" [disabled]="saving"
                        aria-label="Reset branding to defaults">
              </p-button>
            </div>
          </form>
        </p-card>
      </div>

      <!-- Right Panel: Live Preview -->
      <div class="preview-panel">
        <p-card [header]="'settings.branding.previewTitle' | translate" styleClass="preview-card">
          <div class="login-preview"
               [style.background-image]="previewBgUrl ? 'url(' + previewBgUrl + ')' : 'none'"
               [style.background-color]="!previewBgUrl ? (brandingForm.get('primaryColor')?.value || '#3B82F6') + '15' : 'transparent'"
               role="img" aria-label="Login page preview">

            <div class="login-card-preview"
                 [style.border-top-color]="brandingForm.get('primaryColor')?.value || '#3B82F6'">

              <!-- Logo -->
              <img *ngIf="logoPreview" [src]="logoPreview" alt="Logo" class="preview-logo" />
              <div *ngIf="!logoPreview" class="preview-logo-placeholder">
                <i class="pi pi-image"></i>
              </div>

              <!-- Title -->
              <h3 class="preview-title">
                {{ brandingForm.get('loginTitle')?.value || 'Welcome' }}
              </h3>
              <p class="preview-subtitle">
                {{ brandingForm.get('loginSubtitle')?.value || 'Sign in to your account' }}
              </p>

              <!-- Mock Form -->
              <div class="mock-field">
                <div class="mock-label">Email</div>
                <div class="mock-input"></div>
              </div>
              <div class="mock-field">
                <div class="mock-label">Password</div>
                <div class="mock-input"></div>
              </div>

              <div class="mock-button"
                   [style.background-color]="brandingForm.get('primaryColor')?.value || '#3B82F6'">
                Sign In
              </div>

              <div class="mock-link"
                   [style.color]="brandingForm.get('accentColor')?.value || '#10B981'">
                Forgot password?
              </div>
            </div>

            <!-- Footer -->
            <div class="preview-footer">
              {{ brandingForm.get('footerText')?.value || '&copy; Your Company' }}
            </div>
          </div>
        </p-card>
      </div>
    </div>

    <p-confirmDialog aria-label="Confirmation dialog"></p-confirmDialog>
  `,
  styles: [`
    :host {
      display: block;
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

    :host ::ng-deep .msg-banner {
      width: 100%;
      margin-bottom: 1rem;
    }

    .branding-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }

    @media (max-width: 1024px) {
      .branding-layout {
        grid-template-columns: 1fr;
      }
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

    .field-label-sm {
      display: block;
      font-weight: 500;
      margin-bottom: 0.35rem;
      color: var(--text-color-secondary);
      font-size: 0.8rem;
    }

    .mt-half { margin-top: 0.5rem; }
    .w-full { width: 100%; }

    .hidden-input {
      display: none;
    }

    .upload-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .upload-preview {
      width: 64px;
      height: 64px;
      object-fit: contain;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      padding: 4px;
      background: var(--surface-ground);
    }

    .upload-preview--small {
      width: 32px;
      height: 32px;
    }

    .upload-controls {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .help-text {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .color-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .color-picker {
      width: 42px;
      height: 42px;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      padding: 2px;
      cursor: pointer;
      background: transparent;
    }

    .color-text {
      width: 120px;
      font-family: monospace;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    /* ---- Live Preview Styles ---- */
    :host ::ng-deep .preview-card {
      position: sticky;
      top: 1rem;
    }

    .login-preview {
      border-radius: 8px;
      min-height: 480px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      background-size: cover;
      background-position: center;
      position: relative;
    }

    .login-card-preview {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      width: 280px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      border-top: 4px solid #3B82F6;
      text-align: center;
    }

    .preview-logo {
      width: 56px;
      height: 56px;
      object-fit: contain;
      margin: 0 auto 0.75rem;
      display: block;
    }

    .preview-logo-placeholder {
      width: 56px;
      height: 56px;
      margin: 0 auto 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px dashed var(--surface-border);
      border-radius: 8px;
      color: var(--text-color-secondary);
      font-size: 1.5rem;
    }

    .preview-title {
      margin: 0 0 0.25rem;
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
    }

    .preview-subtitle {
      margin: 0 0 1.25rem;
      font-size: 0.75rem;
      color: #64748b;
    }

    .mock-field {
      margin-bottom: 0.75rem;
      text-align: left;
    }

    .mock-label {
      font-size: 0.65rem;
      color: #64748b;
      margin-bottom: 0.2rem;
      font-weight: 600;
    }

    .mock-input {
      height: 32px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background: #f8fafc;
    }

    .mock-button {
      width: 100%;
      padding: 0.5rem;
      border-radius: 6px;
      color: white;
      font-weight: 600;
      font-size: 0.8rem;
      text-align: center;
      margin-top: 0.5rem;
      cursor: default;
    }

    .mock-link {
      font-size: 0.7rem;
      margin-top: 0.75rem;
      cursor: default;
    }

    .preview-footer {
      position: absolute;
      bottom: 0.75rem;
      font-size: 0.65rem;
      color: #94a3b8;
      text-align: center;
    }
  `]
})
export class BrandingEditorComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/settings/branding';

  brandingForm!: FormGroup;
  loading = true;
  saving = false;
  uploadingLogo = false;
  uploadingFavicon = false;
  uploadingBg = false;
  errorMessage = '';
  successMessage = '';

  logoPreview: string | null = null;
  faviconPreview: string | null = null;
  previewBgUrl: string | null = null;

  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadBranding();
    this.watchFormChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.brandingForm = this.fb.group({
      logoUrl: [''],
      faviconUrl: [''],
      primaryColor: ['#3B82F6'],
      accentColor: ['#10B981'],
      loginBackgroundUrl: [''],
      loginTitle: [''],
      loginSubtitle: [''],
      footerText: ['']
    });
  }

  private watchFormChanges(): void {
    this.brandingForm.get('loginBackgroundUrl')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(url => {
        this.previewBgUrl = url || null;
      });
  }

  private loadBranding(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<BrandingSettings>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (data) {
            this.brandingForm.patchValue({
              logoUrl: data.logoUrl || '',
              faviconUrl: data.faviconUrl || '',
              primaryColor: data.primaryColor || '#3B82F6',
              accentColor: data.accentColor || '#10B981',
              loginBackgroundUrl: data.loginBackgroundUrl || '',
              loginTitle: data.loginTitle || '',
              loginSubtitle: data.loginSubtitle || '',
              footerText: data.footerText || ''
            });
            this.logoPreview = data.logoUrl || null;
            this.faviconPreview = data.faviconUrl || null;
            this.previewBgUrl = data.loginBackgroundUrl || null;
          }
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load branding settings.';
          this.loading = false;
        }
      });
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > this.MAX_FILE_SIZE) {
      this.errorMessage = 'Logo file size must be less than 2MB.';
      return;
    }

    this.uploadingLogo = true;
    this.errorMessage = '';
    const formData = new FormData();
    formData.append('file', file);

    // Show immediate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    this.http.post<ApiResponse<{ url: string }>>(`${this.apiBase}/logo`, formData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.uploadingLogo = false)
      )
      .subscribe({
        next: (response) => {
          const url = response.data?.url;
          if (url) {
            this.brandingForm.patchValue({ logoUrl: url });
            this.logoPreview = url;
          }
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to upload logo.';
        }
      });
  }

  onFaviconSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > this.MAX_FILE_SIZE) {
      this.errorMessage = 'Favicon file size must be less than 2MB.';
      return;
    }

    this.uploadingFavicon = true;
    this.errorMessage = '';
    const formData = new FormData();
    formData.append('file', file);

    const reader = new FileReader();
    reader.onload = (e) => {
      this.faviconPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    this.http.post<ApiResponse<{ url: string }>>(`${this.apiBase}/favicon`, formData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.uploadingFavicon = false)
      )
      .subscribe({
        next: (response) => {
          const url = response.data?.url;
          if (url) {
            this.brandingForm.patchValue({ faviconUrl: url });
            this.faviconPreview = url;
          }
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to upload favicon.';
        }
      });
  }

  onBackgroundSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > this.MAX_FILE_SIZE) {
      this.errorMessage = 'Background image size must be less than 2MB.';
      return;
    }

    this.uploadingBg = true;
    this.errorMessage = '';
    const formData = new FormData();
    formData.append('file', file);

    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewBgUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    this.http.post<ApiResponse<{ url: string }>>(`${this.apiBase}/background`, formData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.uploadingBg = false)
      )
      .subscribe({
        next: (response) => {
          const url = response.data?.url;
          if (url) {
            this.brandingForm.patchValue({ loginBackgroundUrl: url });
            this.previewBgUrl = url;
          }
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to upload background image.';
        }
      });
  }

  onSave(): void {
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.put<ApiResponse<BrandingSettings>>(this.apiBase, this.brandingForm.value)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Branding settings saved successfully.';
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to save branding settings.';
        }
      });
  }

  onResetToDefaults(): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to reset all branding to default values? This cannot be undone.',
      header: 'Reset Branding',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.brandingForm.patchValue({
          logoUrl: '',
          faviconUrl: '',
          primaryColor: '#3B82F6',
          accentColor: '#10B981',
          loginBackgroundUrl: '',
          loginTitle: '',
          loginSubtitle: '',
          footerText: ''
        });
        this.logoPreview = null;
        this.faviconPreview = null;
        this.previewBgUrl = null;
        this.onSave();
      }
    });
  }
}
