import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-fido-auth',
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressSpinnerModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout title="Security Key" subtitle="Please insert or tap your security key">
      <div class="fido-container" role="status" aria-live="polite">
        <div *ngIf="!webAuthnSupported" class="unsupported-message">
          <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: var(--orange-500)"></i>
          <p>Your browser does not support WebAuthn. Please use a supported browser or choose another authentication method.</p>
          <p-button label="Choose Another Method" (onClick)="goToMfaSelect()" styleClass="mt-2" />
        </div>

        <div *ngIf="webAuthnSupported && authenticating" class="authenticating">
          <p-progressSpinner [style]="{ width: '60px', height: '60px' }" strokeWidth="4" />
          <p class="mt-3">{{ 'auth.verifying' | translate }}</p>
          <p class="text-secondary text-sm">Interact with your security key when prompted by the browser...</p>
        </div>

        <div *ngIf="webAuthnSupported && !authenticating && errorMessage" class="error-state">
          <i class="pi pi-times-circle" style="font-size: 2rem; color: var(--red-500)"></i>
          <p class="p-error mt-2" role="alert">{{ errorMessage }}</p>
          <div class="button-group mt-3">
            <p-button label="Retry" icon="pi pi-refresh" (onClick)="startAuthentication()" />
            <p-button label="Use Another Method" severity="secondary" (onClick)="goToMfaSelect()" />
          </div>
        </div>
      </div>
    </app-login-layout>
  `,
  styles: [`
    .fido-container { display: flex; flex-direction: column; align-items: center; padding: 2rem 0; text-align: center; }
    .unsupported-message, .authenticating, .error-state { display: flex; flex-direction: column; align-items: center; }
    .button-group { display: flex; gap: 0.5rem; }
    .text-secondary { color: var(--innait-text-secondary); }
    .text-sm { font-size: 0.875rem; }
  `],
})
export class FidoAuthComponent implements OnInit {
  webAuthnSupported = false;
  authenticating = false;
  errorMessage = '';

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.webAuthnSupported = !!window.PublicKeyCredential;
    if (!this.authService.currentState.txnId) {
      this.router.navigate(['/login']);
      return;
    }
    if (this.webAuthnSupported) {
      this.startAuthentication();
    }
  }

  async startAuthentication(): Promise<void> {
    this.authenticating = true;
    this.errorMessage = '';

    try {
      // In a real implementation, the publicKeyCredentialRequestOptions would
      // come from the server via the auth state or a separate API call
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          timeout: 60000,
          rpId: window.location.hostname,
          userVerification: 'preferred',
        },
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('No credential returned');
      }

      const txnId = this.authService.currentState.txnId!;
      const response = credential.response as AuthenticatorAssertionResponse;

      this.authService.submitMfa(txnId, 'FIDO', {
        credentialId: credential.id,
        authenticatorData: this.arrayBufferToBase64(response.authenticatorData),
        clientDataJSON: this.arrayBufferToBase64(response.clientDataJSON),
        signature: this.arrayBufferToBase64(response.signature),
      }).subscribe({
        next: (res) => {
          this.authenticating = false;
          if (res.status === 'AUTHENTICATED') {
            this.router.navigate(['/login/complete']);
          }
        },
        error: () => {
          this.authenticating = false;
          this.errorMessage = 'Security key verification failed. Please try again.';
        },
      });
    } catch (err) {
      this.authenticating = false;
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        this.errorMessage = 'Authentication was cancelled or timed out.';
      } else {
        this.errorMessage = 'Failed to authenticate with security key.';
      }
    }
  }

  goToMfaSelect(): void {
    this.router.navigate(['/login/mfa-select']);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }
}
