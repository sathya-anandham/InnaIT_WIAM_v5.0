import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@innait/core';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shared/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'SUPER_ADMIN', 'IAM_ADMIN'] },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      // Dashboard
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      // User Management
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'users/create',
        loadComponent: () =>
          import('./pages/users/user-create/user-create.component').then((m) => m.UserCreateComponent),
      },
      {
        path: 'users/:userId',
        loadComponent: () =>
          import('./pages/users/user-detail/user-detail.component').then((m) => m.UserDetailComponent),
      },
      {
        path: 'users/bulk/import',
        loadComponent: () =>
          import('./pages/users/bulk-import/bulk-import.component').then((m) => m.BulkImportComponent),
      },
      {
        path: 'users/bulk/operations',
        loadComponent: () =>
          import('./pages/users/bulk-operations/bulk-operations.component').then((m) => m.BulkOperationsComponent),
      },
      // Role & Group Management
      {
        path: 'roles',
        loadComponent: () =>
          import('./pages/roles/role-list/role-list.component').then((m) => m.RoleListComponent),
      },
      {
        path: 'roles/create',
        loadComponent: () =>
          import('./pages/roles/role-create/role-create.component').then((m) => m.RoleCreateComponent),
      },
      {
        path: 'roles/:roleId',
        loadComponent: () =>
          import('./pages/roles/role-detail/role-detail.component').then((m) => m.RoleDetailComponent),
      },
      {
        path: 'groups',
        loadComponent: () =>
          import('./pages/groups/group-list/group-list.component').then((m) => m.GroupListComponent),
      },
      {
        path: 'groups/:groupId',
        loadComponent: () =>
          import('./pages/groups/group-detail/group-detail.component').then((m) => m.GroupDetailComponent),
      },
      {
        path: 'entitlements',
        loadComponent: () =>
          import('./pages/entitlements/entitlement-catalog/entitlement-catalog.component').then((m) => m.EntitlementCatalogComponent),
      },
      // Device & Credential
      {
        path: 'devices/fido',
        loadComponent: () =>
          import('./pages/devices/fido-inventory/fido-inventory.component').then((m) => m.FidoInventoryComponent),
      },
      {
        path: 'devices/softtoken',
        loadComponent: () =>
          import('./pages/devices/softtoken-inventory/softtoken-inventory.component').then((m) => m.SoftTokenInventoryComponent),
      },
      {
        path: 'credentials/overview',
        loadComponent: () =>
          import('./pages/credentials/credential-overview/credential-overview.component').then((m) => m.CredentialOverviewComponent),
      },
      {
        path: 'credentials/bulk-reset',
        loadComponent: () =>
          import('./pages/credentials/bulk-password-reset/bulk-password-reset.component').then((m) => m.BulkPasswordResetComponent),
      },
      // Policy Configuration
      {
        path: 'policies/auth-type',
        loadComponent: () =>
          import('./pages/policies/auth-type-config/auth-type-config.component').then((m) => m.AuthTypeConfigComponent),
      },
      {
        path: 'policies/password',
        loadComponent: () =>
          import('./pages/policies/password-policy/password-policy.component').then((m) => m.PasswordPolicyComponent),
      },
      {
        path: 'policies/mfa',
        loadComponent: () =>
          import('./pages/policies/mfa-policy/mfa-policy.component').then((m) => m.MfaPolicyComponent),
      },
      {
        path: 'policies/auth-rules',
        loadComponent: () =>
          import('./pages/policies/auth-policy/auth-policy.component').then((m) => m.AuthPolicyComponent),
      },
      {
        path: 'policies/bindings',
        loadComponent: () =>
          import('./pages/policies/policy-bindings/policy-bindings.component').then((m) => m.PolicyBindingsComponent),
      },
      {
        path: 'policies/simulator',
        loadComponent: () =>
          import('./pages/policies/policy-simulator/policy-simulator.component').then((m) => m.PolicySimulatorComponent),
      },
      // Audit & Analytics
      {
        path: 'audit/logs',
        loadComponent: () =>
          import('./pages/audit/audit-log-viewer/audit-log-viewer.component').then((m) => m.AuditLogViewerComponent),
      },
      {
        path: 'audit/admin-history',
        loadComponent: () =>
          import('./pages/audit/admin-action-history/admin-action-history.component').then((m) => m.AdminActionHistoryComponent),
      },
      {
        path: 'audit/incidents',
        loadComponent: () =>
          import('./pages/audit/security-incidents/security-incidents.component').then((m) => m.SecurityIncidentsComponent),
      },
      {
        path: 'audit/login-analytics',
        loadComponent: () =>
          import('./pages/audit/login-analytics/login-analytics.component').then((m) => m.LoginAnalyticsComponent),
      },
      {
        path: 'audit/compliance',
        loadComponent: () =>
          import('./pages/audit/compliance-report/compliance-report.component').then((m) => m.ComplianceReportComponent),
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('./pages/sessions/active-sessions/active-sessions.component').then((m) => m.ActiveSessionsComponent),
      },
      // Settings
      {
        path: 'settings/tenant',
        loadComponent: () =>
          import('./pages/settings/tenant-settings/tenant-settings.component').then((m) => m.TenantSettingsComponent),
      },
      {
        path: 'settings/branding',
        loadComponent: () =>
          import('./pages/settings/branding-editor/branding-editor.component').then((m) => m.BrandingEditorComponent),
      },
      {
        path: 'settings/domains',
        loadComponent: () =>
          import('./pages/settings/domain-management/domain-management.component').then((m) => m.DomainManagementComponent),
      },
      {
        path: 'settings/features',
        loadComponent: () =>
          import('./pages/settings/feature-flags/feature-flags.component').then((m) => m.FeatureFlagsComponent),
      },
      {
        path: 'settings/notifications',
        loadComponent: () =>
          import('./pages/settings/notification-templates/notification-templates.component').then((m) => m.NotificationTemplatesComponent),
      },
      {
        path: 'settings/connectors',
        loadComponent: () =>
          import('./pages/settings/connector-config/connector-config.component').then((m) => m.ConnectorConfigComponent),
      },
      {
        path: 'settings/system',
        loadComponent: () =>
          import('./pages/settings/system-settings/system-settings.component').then((m) => m.SystemSettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
