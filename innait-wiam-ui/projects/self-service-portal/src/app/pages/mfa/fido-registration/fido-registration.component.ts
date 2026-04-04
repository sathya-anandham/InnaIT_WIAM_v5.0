import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { StepsModule } from 'primeng/steps';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-fido-registration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    StepsModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div class="fido-registration" role="region" aria-label="FIDO2 Security Key Registration">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>{{ 'mfa.fido.register.title' | translate }}</h2>
          </div>
        </ng-template>

        <!-- Unsupported Browser Message -->
        <div *ngIf="!webAuthnSupported" class="unsupported-section" role="alert">
          <p-message
            severity="warn"
            [text]="'mfa.fido.register.unsupported' | translate">
          </p-message>
          <div class="unsupported-detail">
            <i class="pi pi-exclamation-triangle unsupported-icon" aria-hidden="true"></i>
            <h3>{{ 'mfa.fido.register.unsupported.title' | translate }}</h3>
            <p>{{ 'mfa.fido.register.unsupported.message' | translate }}</p>
            <a
              pButton
              class="p-button-outlined"
              [label]="'common.backToDashboard' | translate"
              icon="pi pi-home"
              routerLink="/dashboard"
              aria-label="Return to dashboard">
            </a>
          </div>
        </div>

        <!-- Supported Browser Flow -->
        <div *ngIf="webAuthnSupported">
          <p-steps
            [model]="steps"
            [activeIndex]="activeStep"
            [readonly]="true"
            aria-label="Registration progress">
          </p-steps>

          <div class="step-content">
            <!-- Step 1: Info & Nickname -->
            <div *ngIf="activeStep === 0" class="step-info" role="tabpanel" aria-label="Security key information">
              <div class="info-section">
                <i class="pi pi-key info-icon" aria-hidden="true"></i>
                <h3>{{ 'mfa.fido.register.info.heading' | translate }}</h3>
                <p>{{ 'mfa.fido.register.info.description' | translate }}</p>
                <ul class="info-list">
                  <li>{{ 'mfa.fido.register.info.benefit1' | translate }}</li>
                  <li>{{ 'mfa.fido.register.info.benefit2' | translate }}</li>
                  <li>{{ 'mfa.fido.register.info.benefit3' | translate }}</li>
                </ul>
              </div>

              <form [formGroup]="nicknameForm" class="nickname-section" (ngSubmit)="beginRegistration()">
                <label for="key-nickname">{{ 'mfa.fido.register.nicknameLabel' | translate }}</label>
                <div class="nickname-input-row">
                  <input
                    id="key-nickname"
                    pInputText
                    formControlName="nickname"
                    type="text"
                    maxlength="64"
                    [placeholder]="'mfa.fido.register.nicknamePlaceholder' | translate"
                    aria-required="true"
                    [attr.aria-invalid]="nicknameForm.get('nickname')?.invalid && nicknameForm.get('nickname')?.touched"
                    class="nickname-input" />
                  <button
                    pButton
                    type="submit"
                    [label]="'mfa.fido.register.registerButton' | translate"
                    icon="pi pi-key"
                    iconPos="right"
                    [loading]="registering"
                    [disabled]="nicknameForm.invalid || registering"
                    aria-label="Register security key">
                  </button>
                </div>
                <small
                  *ngIf="nicknameForm.get('nickname')?.invalid && nicknameForm.get('nickname')?.touched"
                  class="p-error"
                  role="alert">
                  {{ 'mfa.fido.register.nicknameRequired' | translate }}
                </small>
              </form>

              <p-message
                *ngIf="errorMessage"
                severity="error"
                [text]="errorMessage"
                (onClose)="errorMessage = ''"
                role="alert">
              </p-message>
            </div>

            <!-- Step 2: Authenticating -->
            <div *ngIf="activeStep === 1" class="step-authenticating" role="tabpanel" aria-label="Authenticating with security key">
              <div class="authenticating-section">
                <p-progressSpinner
                  strokeWidth="3"
                  aria-label="Waiting for security key interaction">
                </p-progressSpinner>
                <h3>{{ 'mfa.fido.register.waitingForKey.title' | translate }}</h3>
                <p>{{ 'mfa.fido.register.waitingForKey.message' | translate }}</p>
                <div class="key-animation">
                  <i class="pi pi-key key-pulse" aria-hidden="true"></i>
                </div>
                <p class="hint-text">{{ 'mfa.fido.register.waitingForKey.hint' | translate }}</p>
              </div>

              <p-message
                *ngIf="errorMessage"
                severity="error"
                [text]="errorMessage"
                (onClose)="errorMessage = ''"
                role="alert">
              </p-message>

              <div *ngIf="errorMessage" class="retry-actions">
                <button
                  pButton
                  class="p-button-outlined"
                  [label]="'mfa.fido.register.retryButton' | translate"
                  icon="pi pi-refresh"
                  (click)="retryRegistration()"
                  aria-label="Retry security key registration">
                </button>
                <button
                  pButton
                  class="p-button-text"
                  [label]="'common.cancel' | translate"
                  icon="pi pi-arrow-left"
                  (click)="cancelRegistration()"
                  aria-label="Cancel and go back">
                </button>
              </div>
            </div>

            <!-- Step 3: Success -->
            <div *ngIf="activeStep === 2" class="step-success" role="tabpanel" aria-label="Registration complete">
              <div class="success-section">
                <i class="pi pi-check-circle success-icon" aria-hidden="true"></i>
                <h3>{{ 'mfa.fido.register.success.title' | translate }}</h3>
                <p>
                  {{ 'mfa.fido.register.success.message' | translate }}
                  <strong *ngIf="registeredNickname">"{{ registeredNickname }}"</strong>
                </p>
                <div class="success-actions">
                  <a
                    pButton
                    [label]="'mfa.fido.register.success.manageLink' | translate"
                    icon="pi pi-cog"
                    routerLink="/mfa/fido/manage"
                    aria-label="Go to FIDO key management page">
                  </a>
                  <button
                    pButton
                    class="p-button-outlined"
                    [label]="'mfa.fido.register.success.registerAnother' | translate"
                    icon="pi pi-plus"
                    (click)="resetFlow()"
                    aria-label="Register another security key">
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </p-card>
    </div>
  `,
  styles: [`
    .fido-registration {
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

    :host ::ng-deep .p-steps {
      padding: 1.5rem 0;
    }

    .step-content {
      padding: 1rem 0;
    }

    .unsupported-section {
      padding: 1rem 0;
    }

    .unsupported-detail {
      text-align: center;
      padding: 2rem 1rem;
    }

    .unsupported-icon {
      font-size: 3rem;
      color: #ff9800;
      margin-bottom: 1rem;
    }

    .unsupported-detail h3 {
      font-size: 1.125rem;
      margin: 0 0 0.5rem;
    }

    .unsupported-detail p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
    }

    .info-section {
      text-align: center;
      padding: 1rem 0;
    }

    .info-icon {
      font-size: 3rem;
      color: var(--innait-primary);
      margin-bottom: 1rem;
    }

    .info-section h3 {
      font-size: 1.25rem;
      margin: 0 0 0.75rem;
    }

    .info-section p {
      color: var(--innait-text-secondary);
      line-height: 1.6;
      margin: 0 0 1rem;
    }

    .info-list {
      text-align: left;
      max-width: 480px;
      margin: 0 auto 1.5rem;
      padding-left: 1.25rem;
      line-height: 1.8;
      color: var(--innait-text-secondary);
    }

    .nickname-section {
      max-width: 480px;
      margin: 0 auto;
      padding: 1.5rem 0;
      border-top: 1px solid #e0e0e0;
    }

    .nickname-section label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--innait-text);
    }

    .nickname-input-row {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }

    .nickname-input {
      flex: 1;
    }

    .p-error {
      display: block;
      margin-top: 0.375rem;
    }

    .authenticating-section {
      text-align: center;
      padding: 2rem 0;
    }

    .authenticating-section h3 {
      font-size: 1.125rem;
      margin: 1rem 0 0.5rem;
    }

    .authenticating-section p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
    }

    .key-animation {
      display: flex;
      justify-content: center;
      padding: 1rem 0;
    }

    .key-pulse {
      font-size: 2.5rem;
      color: var(--innait-primary);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.15); }
    }

    .hint-text {
      font-size: 0.875rem;
      color: var(--innait-text-secondary);
      font-style: italic;
    }

    .retry-actions {
      display: flex;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .success-section {
      text-align: center;
      padding: 2rem 0;
    }

    .success-icon {
      font-size: 3.5rem;
      color: #4caf50;
      margin-bottom: 1rem;
    }

    .success-section h3 {
      font-size: 1.25rem;
      color: var(--innait-text);
      margin: 0 0 0.5rem;
    }

    .success-section p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
    }

    .success-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    :host ::ng-deep .p-message {
      margin-top: 1rem;
    }
  `],
})
export class FidoRegistrationComponent implements OnInit, OnDestroy {
  steps: MenuItem[] = [];
  activeStep = 0;

  webAuthnSupported = false;
  registering = false;
  errorMessage = '';
  registeredNickname = '';

  nicknameForm!: FormGroup;

  private currentNickname = '';
  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/mfa/fido';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.webAuthnSupported = !!window.PublicKeyCredential;

    this.steps = [
      { label: 'Info' },
      { label: 'Authenticate' },
      { label: 'Complete' },
    ];

    this.nicknameForm = this.fb.group({
      nickname: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(64)]],
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  beginRegistration(): void {
    if (this.nicknameForm.invalid) {
      this.nicknameForm.markAllAsTouched();
      return;
    }

    this.currentNickname = this.nicknameForm.get('nickname')?.value.trim();
    this.registering = true;
    this.errorMessage = '';

    this.http.post<PublicKeyCredentialCreationOptions>(`${this.API_BASE}/register/begin`, {
      nickname: this.currentNickname,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (options) => {
          this.registering = false;
          this.activeStep = 1;
          this.performWebAuthnCeremony(options);
        },
        error: (err) => {
          this.registering = false;
          this.errorMessage = err?.error?.message || 'Failed to initiate key registration. Please try again.';
        },
      });
  }

  retryRegistration(): void {
    this.errorMessage = '';
    this.beginRegistrationStep2();
  }

  cancelRegistration(): void {
    this.activeStep = 0;
    this.errorMessage = '';
  }

  resetFlow(): void {
    this.activeStep = 0;
    this.errorMessage = '';
    this.registeredNickname = '';
    this.nicknameForm.reset();
  }

  private beginRegistrationStep2(): void {
    this.registering = true;
    this.errorMessage = '';

    this.http.post<PublicKeyCredentialCreationOptions>(`${this.API_BASE}/register/begin`, {
      nickname: this.currentNickname,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (options) => {
          this.registering = false;
          this.performWebAuthnCeremony(options);
        },
        error: (err) => {
          this.registering = false;
          this.errorMessage = err?.error?.message || 'Failed to initiate key registration. Please try again.';
        },
      });
  }

  private async performWebAuthnCeremony(serverOptions: any): Promise<void> {
    try {
      // Convert base64url-encoded fields to ArrayBuffer
      const publicKey = { ...serverOptions };

      if (typeof publicKey.challenge === 'string') {
        publicKey.challenge = this.base64UrlToArrayBuffer(publicKey.challenge);
      }

      if (publicKey.user && typeof publicKey.user.id === 'string') {
        publicKey.user = {
          ...publicKey.user,
          id: this.base64UrlToArrayBuffer(publicKey.user.id),
        };
      }

      if (publicKey.excludeCredentials) {
        publicKey.excludeCredentials = publicKey.excludeCredentials.map((cred: any) => ({
          ...cred,
          id: typeof cred.id === 'string' ? this.base64UrlToArrayBuffer(cred.id) : cred.id,
        }));
      }

      const credential = await navigator.credentials.create({
        publicKey,
      }) as PublicKeyCredential | null;

      if (!credential) {
        this.ngZone.run(() => {
          this.errorMessage = 'No credential was returned. Please try again.';
        });
        return;
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;

      const credentialData = {
        id: credential.id,
        rawId: this.arrayBufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: this.arrayBufferToBase64Url(attestationResponse.attestationObject),
          clientDataJSON: this.arrayBufferToBase64Url(attestationResponse.clientDataJSON),
        },
      };

      this.ngZone.run(() => {
        this.completeRegistration(credentialData);
      });
    } catch (error: any) {
      this.ngZone.run(() => {
        this.errorMessage = this.getWebAuthnErrorMessage(error);
      });
    }
  }

  private completeRegistration(credentialData: any): void {
    this.http.post<{ success: boolean }>(`${this.API_BASE}/register/complete`, credentialData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.registeredNickname = this.currentNickname;
          this.activeStep = 2;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to complete key registration. Please try again.';
        },
      });
  }

  private getWebAuthnErrorMessage(error: any): string {
    if (error.name === 'NotAllowedError') {
      return 'The operation was cancelled or timed out. Please try again.';
    }
    if (error.name === 'NotSupportedError') {
      return 'This security key type is not supported by your browser.';
    }
    if (error.name === 'SecurityError') {
      return 'A security error occurred. Ensure you are using HTTPS.';
    }
    if (error.name === 'InvalidStateError') {
      return 'This security key is already registered. Please use a different key.';
    }
    if (error.name === 'AbortError') {
      return 'The registration was aborted. Please try again.';
    }
    return error.message || 'An unexpected error occurred during key registration.';
  }

  private base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    const binary = atob(base64 + pad);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) { view[i] = binary.charCodeAt(i); }
    return buffer;
  }

  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]!); }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
