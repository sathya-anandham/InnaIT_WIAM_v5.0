import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, ButtonModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout title="Something Went Wrong">
      <div class="error-container" role="alert">
        <div class="error-icon">
          <i class="pi pi-exclamation-triangle" style="font-size: 2.5rem; color: var(--orange-500)"></i>
        </div>

        <p class="mt-3 error-message">{{ displayMessage }}</p>

        <div class="button-group mt-3">
          <p-button label="Try Again" icon="pi pi-refresh" (onClick)="retry()" />
          <p-button label="Back to Login" severity="secondary" icon="pi pi-arrow-left" (onClick)="goToLogin()" />
        </div>

        <p class="help-text mt-3">
          If this problem persists, please contact your administrator.
        </p>
      </div>
    </app-login-layout>
  `,
  styles: [`
    .error-container { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1.5rem 0; }
    .error-icon {
      width: 72px; height: 72px; border-radius: 50%;
      background: rgba(249, 115, 22, 0.1);
      display: flex; align-items: center; justify-content: center;
    }
    .error-message { font-size: 1rem; max-width: 320px; }
    .button-group { display: flex; gap: 0.5rem; }
    .help-text { color: var(--innait-text-secondary); font-size: 0.8rem; }
  `],
})
export class ErrorPageComponent implements OnInit {
  displayMessage = 'An unexpected error occurred during authentication. Please try again.';

  private readonly errorMessages: Record<string, string> = {
    auth_failed: 'Authentication could not be completed. Please try again.',
    session_expired: 'Your session has expired. Please sign in again.',
    access_denied: 'You do not have permission to access this resource.',
    service_unavailable: 'The service is temporarily unavailable. Please try again later.',
    invalid_request: 'The request could not be processed. Please start over.',
  };

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const errorCode = this.route.snapshot.queryParamMap.get('code');
    if (errorCode && this.errorMessages[errorCode]) {
      this.displayMessage = this.errorMessages[errorCode];
    }
    // Never display raw error details that could leak credentials
  }

  retry(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
    } else {
      this.router.navigate(['/login']);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/']);
  }
}
