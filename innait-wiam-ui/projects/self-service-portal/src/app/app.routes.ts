import { Routes } from '@angular/router';
import { authGuard } from '@innait/core';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shared/portal-layout/portal-layout.component').then((m) => m.PortalLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile-view-edit.component').then((m) => m.ProfileViewEditComponent),
      },
      {
        path: 'password',
        loadComponent: () =>
          import('./pages/password/password-change.component').then((m) => m.PasswordChangeComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./pages/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
      },
      {
        path: 'mfa/totp',
        loadComponent: () =>
          import('./pages/mfa/totp-enrollment/totp-enrollment.component').then((m) => m.TotpEnrollmentComponent),
      },
      {
        path: 'mfa/totp/manage',
        loadComponent: () =>
          import('./pages/mfa/totp-management/totp-management.component').then((m) => m.TotpManagementComponent),
      },
      {
        path: 'mfa/fido',
        loadComponent: () =>
          import('./pages/mfa/fido-registration/fido-registration.component').then((m) => m.FidoRegistrationComponent),
      },
      {
        path: 'mfa/fido/manage',
        loadComponent: () =>
          import('./pages/mfa/fido-management/fido-management.component').then((m) => m.FidoManagementComponent),
      },
      {
        path: 'mfa/softtoken',
        loadComponent: () =>
          import('./pages/mfa/softtoken-activation/softtoken-activation.component').then((m) => m.SoftTokenActivationComponent),
      },
      {
        path: 'mfa/softtoken/manage',
        loadComponent: () =>
          import('./pages/mfa/softtoken-management/softtoken-management.component').then((m) => m.SoftTokenManagementComponent),
      },
      {
        path: 'mfa/backup-codes',
        loadComponent: () =>
          import('./pages/mfa/backup-codes/backup-codes.component').then((m) => m.BackupCodesComponent),
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('./pages/sessions/my-sessions.component').then((m) => m.MySessionsComponent),
      },
      {
        path: 'activity',
        loadComponent: () =>
          import('./pages/activity/my-activity-log.component').then((m) => m.MyActivityLogComponent),
      },
      {
        path: 'access-request',
        loadComponent: () =>
          import('./pages/access-request/access-request.component').then((m) => m.AccessRequestComponent),
      },
      {
        path: 'access-requests',
        loadComponent: () =>
          import('./pages/my-access-requests/my-access-requests.component').then((m) => m.MyAccessRequestsComponent),
      },
      {
        path: 'recovery',
        loadComponent: () =>
          import('./pages/recovery/account-recovery.component').then((m) => m.AccountRecoveryComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
