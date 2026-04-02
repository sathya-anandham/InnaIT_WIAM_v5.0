import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/tenant-input/tenant-input.component').then((m) => m.TenantInputComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-id-form/login-id-form.component').then((m) => m.LoginIdFormComponent),
  },
  {
    path: 'login/password',
    loadComponent: () =>
      import('./pages/password-form/password-form.component').then((m) => m.PasswordFormComponent),
  },
  {
    path: 'login/fido',
    loadComponent: () =>
      import('./pages/fido-auth/fido-auth.component').then((m) => m.FidoAuthComponent),
  },
  {
    path: 'login/totp',
    loadComponent: () =>
      import('./pages/totp-input/totp-input.component').then((m) => m.TotpInputComponent),
  },
  {
    path: 'login/softtoken',
    loadComponent: () =>
      import('./pages/soft-token-wait/soft-token-wait.component').then((m) => m.SoftTokenWaitComponent),
  },
  {
    path: 'login/backup-code',
    loadComponent: () =>
      import('./pages/backup-code-form/backup-code-form.component').then((m) => m.BackupCodeFormComponent),
  },
  {
    path: 'login/mfa-select',
    loadComponent: () =>
      import('./pages/mfa-method-selector/mfa-method-selector.component').then((m) => m.MfaMethodSelectorComponent),
  },
  {
    path: 'login/complete',
    loadComponent: () =>
      import('./pages/auth-success-redirect/auth-success-redirect.component').then((m) => m.AuthSuccessRedirectComponent),
  },
  {
    path: 'login/locked',
    loadComponent: () =>
      import('./pages/account-locked/account-locked.component').then((m) => m.AccountLockedComponent),
  },
  {
    path: 'login/password-expired',
    loadComponent: () =>
      import('./pages/password-expired/password-expired.component').then((m) => m.PasswordExpiredComponent),
  },
  {
    path: 'login/onboarding',
    loadComponent: () =>
      import('./pages/onboarding-wizard/onboarding-wizard.component').then((m) => m.OnboardingWizardComponent),
  },
  {
    path: 'login/error',
    loadComponent: () =>
      import('./pages/error-page/error-page.component').then((m) => m.ErrorPageComponent),
  },
  { path: '**', redirectTo: '' },
];
