import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  GridOptions,
} from 'ag-grid-community';

import {
  AuthService,
  ApiResponse,
  PaginationMeta,
  User,
  Account,
  Role,
  Group,
  Entitlement,
  Session,
  AuditEvent,
} from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface UserDetail extends User {
  account?: AccountDetail;
}

interface AccountDetail extends Account {
  accountId?: string;
}

interface HistoryEntry {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

interface AssignedRole {
  roleId: string;
  roleName: string;
  roleCode: string;
  roleType: string;
  source: 'DIRECT' | 'MANAGER' | 'POLICY';
  assignedAt: string;
}

interface AssignedGroup {
  groupId: string;
  groupName: string;
  groupCode: string;
  groupType: string;
}

interface CredentialStatus {
  type: string;
  enabled: boolean;
  enrolledAt?: string;
  expiresAt?: string;
  ageDays?: number;
  keys?: FidoKey[];
}

interface FidoKey {
  keyId: string;
  keyName: string;
  registeredAt: string;
}

interface ActiveSession {
  sessionId: string;
  userAgent: string;
  browser?: string;
  os?: string;
  ipAddress: string;
  createdAt: string;
  lastActivity: string;
}

interface CertificationInfo {
  lastCertifiedAt: string;
  nextCertificationDue: string;
  certifierName: string;
  status: string;
}

interface EffectiveEntitlement {
  entitlementName: string;
  resource: string;
  action: string;
  source: string;
  status: string;
}

interface FeatureFlags {
  igaEnabled: boolean;
  [key: string]: any;
}

interface RoleOption {
  id: string;
  name: string;
  code: string;
}

interface GroupOption {
  id: string;
  name: string;
  code: string;
}

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    AgGridAngular,
    TabViewModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    MultiSelectModule,
    CardModule,
    MessageModule,
    DialogModule,
    TagModule,
    TimelineModule,
    ProgressSpinnerModule,
    TranslatePipe,
    DatePipe,
  ],
  template: `
    <!-- ============================================================ -->
    <!-- Loading State                                                  -->
    <!-- ============================================================ -->
    <div *ngIf="loading" class="loading-container" role="alert" aria-label="Loading user details">
      <p-progressSpinner [style]="{ width: '50px', height: '50px' }" strokeWidth="4"></p-progressSpinner>
      <p>Loading user details...</p>
    </div>

    <!-- ============================================================ -->
    <!-- Error State                                                    -->
    <!-- ============================================================ -->
    <div *ngIf="loadError && !loading" class="error-container" role="alert">
      <p-message severity="error" [text]="loadError" styleClass="w-full"></p-message>
      <button
        pButton
        type="button"
        label="Retry"
        icon="pi pi-refresh"
        class="p-button-outlined mt-3"
        (click)="loadUser()"
      ></button>
    </div>

    <!-- ============================================================ -->
    <!-- Main Content                                                   -->
    <!-- ============================================================ -->
    <div *ngIf="user && !loading" class="user-detail-page" role="main" aria-label="User detail page">

      <!-- ============================================================ -->
      <!-- Top Section: User Header                                      -->
      <!-- ============================================================ -->
      <div class="user-header" role="banner">
        <div class="header-left">
          <button
            pButton
            type="button"
            icon="pi pi-arrow-left"
            class="p-button-text p-button-sm"
            [routerLink]="['/users']"
            aria-label="Back to users list"
          ></button>
          <div class="user-avatar" [attr.aria-label]="'Avatar for ' + user.firstName + ' ' + user.lastName">
            {{ getInitials() }}
          </div>
          <div class="user-identity">
            <h2 class="user-name">{{ user.firstName }} {{ user.lastName }}</h2>
            <span class="user-email">{{ user.email }}</span>
          </div>
          <p-tag
            [value]="user.account?.accountStatus || 'UNKNOWN'"
            [severity]="getStatusSeverity(user.account?.accountStatus)"
            styleClass="ml-3"
          ></p-tag>
          <p-tag
            [value]="user.userType || 'EMPLOYEE'"
            severity="info"
            styleClass="ml-1"
          ></p-tag>
        </div>
        <div class="header-right">
          <button
            pButton
            type="button"
            icon="pi pi-refresh"
            class="p-button-outlined p-button-sm"
            (click)="refreshAll()"
            aria-label="Refresh user data"
            pTooltip="Refresh"
          ></button>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Tab View                                                      -->
      <!-- ============================================================ -->
      <p-tabView
        [activeIndex]="activeTabIndex"
        (activeIndexChange)="onTabChange($event)"
        styleClass="user-tabs"
      >
        <!-- ====== TAB 1: Profile ====== -->
        <p-tabPanel header="Profile" [selected]="activeTabIndex === 0" leftIcon="pi pi-user">
          <div class="tab-content" role="tabpanel" aria-label="Profile tab">
            <div class="tab-actions">
              <button
                pButton
                type="button"
                [label]="profileEditMode ? 'Cancel' : 'Edit'"
                [icon]="profileEditMode ? 'pi pi-times' : 'pi pi-pencil'"
                [class]="profileEditMode ? 'p-button-text' : 'p-button-outlined p-button-sm'"
                (click)="toggleProfileEdit()"
                aria-label="Toggle profile edit mode"
              ></button>
              <button
                *ngIf="profileEditMode"
                pButton
                type="button"
                label="Save"
                icon="pi pi-check"
                class="p-button-sm"
                (click)="saveProfile()"
                [loading]="savingProfile"
                [disabled]="profileForm.invalid || savingProfile"
                aria-label="Save profile changes"
              ></button>
            </div>

            <!-- Success / Error Messages -->
            <p-message
              *ngIf="profileSaveSuccess"
              severity="success"
              text="Profile updated successfully."
              styleClass="mb-3 w-full"
            ></p-message>
            <p-message
              *ngIf="profileSaveError"
              severity="error"
              [text]="profileSaveError"
              styleClass="mb-3 w-full"
            ></p-message>

            <!-- View Mode -->
            <div *ngIf="!profileEditMode" class="profile-view">
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">{{ 'users.detail.firstName' | translate }}</span>
                  <span class="detail-value">{{ user.firstName }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'users.detail.lastName' | translate }}</span>
                  <span class="detail-value">{{ user.lastName }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'users.detail.email' | translate }}</span>
                  <span class="detail-value">{{ user.email }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'users.detail.department' | translate }}</span>
                  <span class="detail-value">{{ user.department || '—' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'users.detail.designation' | translate }}</span>
                  <span class="detail-value">{{ user.designation || '—' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'users.detail.userType' | translate }}</span>
                  <span class="detail-value">
                    <p-tag [value]="user.userType || '—'" severity="info"></p-tag>
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'users.detail.createdAt' | translate }}</span>
                  <span class="detail-value">{{ user.createdAt | date:'medium' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ 'users.detail.updatedAt' | translate }}</span>
                  <span class="detail-value">{{ user.updatedAt | date:'medium' }}</span>
                </div>
              </div>
            </div>

            <!-- Edit Mode -->
            <div *ngIf="profileEditMode" class="profile-edit">
              <form [formGroup]="profileForm" class="edit-grid" autocomplete="off">
                <div class="form-field">
                  <label for="editFirstName" class="form-label">First Name <span class="required">*</span></label>
                  <input id="editFirstName" pInputText formControlName="firstName" class="w-full" aria-required="true" />
                  <small class="p-error" *ngIf="profileForm.get('firstName')?.invalid && profileForm.get('firstName')?.touched">
                    First name is required.
                  </small>
                </div>
                <div class="form-field">
                  <label for="editLastName" class="form-label">Last Name <span class="required">*</span></label>
                  <input id="editLastName" pInputText formControlName="lastName" class="w-full" aria-required="true" />
                  <small class="p-error" *ngIf="profileForm.get('lastName')?.invalid && profileForm.get('lastName')?.touched">
                    Last name is required.
                  </small>
                </div>
                <div class="form-field">
                  <label for="editEmail" class="form-label">Email <span class="required">*</span></label>
                  <input id="editEmail" pInputText formControlName="email" type="email" class="w-full" aria-required="true" />
                </div>
                <div class="form-field">
                  <label for="editDepartment" class="form-label">Department</label>
                  <input id="editDepartment" pInputText formControlName="department" class="w-full" />
                </div>
                <div class="form-field">
                  <label for="editDesignation" class="form-label">Designation</label>
                  <input id="editDesignation" pInputText formControlName="designation" class="w-full" />
                </div>
                <div class="form-field">
                  <label for="editUserType" class="form-label">User Type</label>
                  <p-dropdown
                    id="editUserType"
                    formControlName="userType"
                    [options]="userTypes"
                    optionLabel="label"
                    optionValue="value"
                    styleClass="w-full"
                    aria-label="User type"
                  ></p-dropdown>
                </div>
              </form>
            </div>

            <!-- Change History Timeline -->
            <div class="history-section" *ngIf="profileHistory.length > 0">
              <h4>Change History</h4>
              <p-timeline [value]="profileHistory" align="left" styleClass="profile-timeline">
                <ng-template pTemplate="content" let-event>
                  <div class="timeline-event">
                    <strong>{{ event.field }}</strong> changed
                    <span class="timeline-detail">
                      from <code>{{ event.oldValue || '(empty)' }}</code>
                      to <code>{{ event.newValue }}</code>
                    </span>
                    <div class="timeline-meta">
                      <small>by {{ event.changedBy }} &middot; {{ event.changedAt | date:'medium' }}</small>
                    </div>
                  </div>
                </ng-template>
                <ng-template pTemplate="opposite" let-event>
                  <small class="timeline-date">{{ event.changedAt | date:'shortDate' }}</small>
                </ng-template>
              </p-timeline>
            </div>
          </div>
        </p-tabPanel>

        <!-- ====== TAB 2: Account ====== -->
        <p-tabPanel header="Account" leftIcon="pi pi-id-card">
          <div class="tab-content" role="tabpanel" aria-label="Account tab">
            <!-- Loading for tab -->
            <div *ngIf="accountTabLoading" class="tab-loading">
              <p-progressSpinner [style]="{ width: '30px', height: '30px' }" strokeWidth="4"></p-progressSpinner>
            </div>

            <div *ngIf="!accountTabLoading && user.account">
              <!-- Status Banner -->
              <div class="account-status-banner" [ngClass]="'status-' + (user.account.accountStatus || 'UNKNOWN').toLowerCase()">
                <div class="status-badge-large">
                  <i [class]="getAccountStatusIcon(user.account.accountStatus)"></i>
                  <span>{{ user.account.accountStatus }}</span>
                </div>
              </div>

              <!-- Account Details -->
              <div class="detail-grid mt-3">
                <div class="detail-item">
                  <span class="detail-label">Login ID</span>
                  <span class="detail-value">{{ user.account.loginId }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Account Status</span>
                  <span class="detail-value">
                    <p-tag [value]="user.account.accountStatus || ''" [severity]="getStatusSeverity(user.account.accountStatus)"></p-tag>
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Failed Login Attempts</span>
                  <span class="detail-value" [class.danger-text]="(user.account.failedAttemptCount || 0) >= 3">
                    {{ user.account.failedAttemptCount || 0 }}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Must Change Password</span>
                  <span class="detail-value">{{ user.account.mustChangePassword ? 'Yes' : 'No' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Last Login</span>
                  <span class="detail-value">{{ user.account.lastLoginAt ? (user.account.lastLoginAt | date:'medium') : 'Never' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Password Expires</span>
                  <span class="detail-value">{{ user.account.passwordExpiresAt ? (user.account.passwordExpiresAt | date:'mediumDate') : '—' }}</span>
                </div>
              </div>

              <!-- Account Actions -->
              <div class="account-actions mt-3">
                <h4>Actions</h4>
                <div class="action-buttons">
                  <button
                    *ngIf="user.account.accountStatus === 'LOCKED'"
                    pButton
                    type="button"
                    label="Unlock Account"
                    icon="pi pi-unlock"
                    class="p-button-warning p-button-sm"
                    (click)="confirmAccountAction('unlock')"
                    aria-label="Unlock user account"
                  ></button>
                  <button
                    pButton
                    type="button"
                    label="Force Password Change"
                    icon="pi pi-key"
                    class="p-button-outlined p-button-sm"
                    (click)="confirmAccountAction('forcePasswordChange')"
                    aria-label="Force user to change password on next login"
                  ></button>
                  <button
                    *ngIf="user.account.accountStatus === 'ACTIVE'"
                    pButton
                    type="button"
                    label="Suspend"
                    icon="pi pi-pause"
                    class="p-button-warning p-button-sm"
                    (click)="confirmAccountAction('suspend')"
                    aria-label="Suspend user account"
                  ></button>
                  <button
                    *ngIf="$any(user.account.accountStatus) === 'SUSPENDED'"
                    pButton
                    type="button"
                    label="Activate"
                    icon="pi pi-play"
                    class="p-button-success p-button-sm"
                    (click)="confirmAccountAction('activate')"
                    aria-label="Activate user account"
                  ></button>
                  <button
                    *ngIf="user.account.accountStatus !== 'DISABLED'"
                    pButton
                    type="button"
                    label="Disable"
                    icon="pi pi-ban"
                    class="p-button-danger p-button-sm"
                    (click)="confirmAccountAction('disable')"
                    aria-label="Disable user account"
                  ></button>
                </div>
              </div>

              <!-- Account Action Messages -->
              <p-message
                *ngIf="accountActionSuccess"
                severity="success"
                [text]="accountActionSuccess"
                styleClass="mt-2 w-full"
              ></p-message>
              <p-message
                *ngIf="accountActionError"
                severity="error"
                [text]="accountActionError"
                styleClass="mt-2 w-full"
              ></p-message>
            </div>
          </div>
        </p-tabPanel>

        <!-- ====== TAB 3: Roles ====== -->
        <p-tabPanel header="Roles" leftIcon="pi pi-shield">
          <div class="tab-content" role="tabpanel" aria-label="Roles tab">
            <div class="tab-actions">
              <button
                pButton
                type="button"
                label="Assign Role"
                icon="pi pi-plus"
                class="p-button-sm"
                (click)="showAssignRoleDialog = true; loadAvailableRoles()"
                aria-label="Assign a new role to user"
              ></button>
            </div>

            <p-message
              *ngIf="roleActionSuccess"
              severity="success"
              [text]="roleActionSuccess"
              styleClass="mb-2 w-full"
            ></p-message>

            <div class="grid-container">
              <ag-grid-angular
                class="ag-theme-alpine"
                [rowData]="assignedRoles"
                [columnDefs]="rolesColumnDefs"
                [defaultColDef]="defaultColDef"
                [domLayout]="'autoHeight'"
                [pagination]="false"
                [animateRows]="true"
                (gridReady)="onRolesGridReady($event)"
                [overlayNoRowsTemplate]="'No roles assigned to this user.'"
                role="grid"
                aria-label="Assigned roles grid"
              ></ag-grid-angular>
            </div>
          </div>
        </p-tabPanel>

        <!-- ====== TAB 4: Groups ====== -->
        <p-tabPanel header="Groups" leftIcon="pi pi-users">
          <div class="tab-content" role="tabpanel" aria-label="Groups tab">
            <div class="tab-actions">
              <button
                pButton
                type="button"
                label="Add to Group"
                icon="pi pi-plus"
                class="p-button-sm"
                (click)="showAddGroupDialog = true; loadAvailableGroups()"
                aria-label="Add user to a group"
              ></button>
            </div>

            <p-message
              *ngIf="groupActionSuccess"
              severity="success"
              [text]="groupActionSuccess"
              styleClass="mb-2 w-full"
            ></p-message>

            <div class="groups-list">
              <div *ngIf="assignedGroups.length === 0" class="empty-state">
                <i class="pi pi-users"></i>
                <p>No groups assigned to this user.</p>
              </div>
              <div
                *ngFor="let group of assignedGroups"
                class="group-card"
                role="listitem"
              >
                <div class="group-info">
                  <span class="group-name">{{ group.groupName }}</span>
                  <span class="group-meta">{{ group.groupCode }} &middot; {{ group.groupType }}</span>
                </div>
                <button
                  pButton
                  type="button"
                  icon="pi pi-trash"
                  class="p-button-text p-button-danger p-button-sm"
                  (click)="confirmRemoveGroup(group)"
                  [attr.aria-label]="'Remove from group ' + group.groupName"
                ></button>
              </div>
            </div>
          </div>
        </p-tabPanel>

        <!-- ====== TAB 5: Credentials ====== -->
        <p-tabPanel header="Credentials" leftIcon="pi pi-lock">
          <div class="tab-content" role="tabpanel" aria-label="Credentials tab">
            <div *ngIf="credentialsLoading" class="tab-loading">
              <p-progressSpinner [style]="{ width: '30px', height: '30px' }" strokeWidth="4"></p-progressSpinner>
            </div>

            <p-message
              *ngIf="credentialActionSuccess"
              severity="success"
              [text]="credentialActionSuccess"
              styleClass="mb-2 w-full"
            ></p-message>
            <p-message
              *ngIf="credentialActionError"
              severity="error"
              [text]="credentialActionError"
              styleClass="mb-2 w-full"
            ></p-message>

            <div *ngIf="!credentialsLoading" class="credentials-grid">
              <!-- Password Card -->
              <div class="credential-card" role="region" aria-label="Password credential">
                <div class="cred-card-header">
                  <div class="cred-card-icon"><i class="pi pi-lock"></i></div>
                  <div class="cred-card-title">
                    <h5>Password</h5>
                    <p-tag value="Active" severity="success"></p-tag>
                  </div>
                </div>
                <div class="cred-card-body">
                  <div class="cred-detail">
                    <span class="cred-label">Age</span>
                    <span class="cred-value">{{ getCredentialDetail('PASSWORD')?.ageDays ?? '—' }} days</span>
                  </div>
                  <div class="cred-detail">
                    <span class="cred-label">Expires</span>
                    <span class="cred-value">{{ getCredentialDetail('PASSWORD')?.expiresAt ? (getCredentialDetail('PASSWORD')!.expiresAt! | date:'mediumDate') : '—' }}</span>
                  </div>
                </div>
                <div class="cred-card-actions">
                  <button
                    pButton
                    type="button"
                    label="Reset Password"
                    icon="pi pi-refresh"
                    class="p-button-outlined p-button-sm"
                    (click)="resetPassword()"
                    [loading]="resettingPassword"
                    aria-label="Reset user password"
                  ></button>
                  <button
                    pButton
                    type="button"
                    label="Force Enroll"
                    icon="pi pi-plus-circle"
                    class="p-button-text p-button-sm"
                    (click)="forceEnroll('password')"
                    aria-label="Force password enrollment"
                  ></button>
                </div>
              </div>

              <!-- TOTP Card -->
              <div class="credential-card" role="region" aria-label="TOTP credential">
                <div class="cred-card-header">
                  <div class="cred-card-icon"><i class="pi pi-mobile"></i></div>
                  <div class="cred-card-title">
                    <h5>TOTP Authenticator</h5>
                    <p-tag
                      [value]="getCredentialDetail('TOTP')?.enabled ? 'Enrolled' : 'Not Enrolled'"
                      [severity]="getCredentialDetail('TOTP')?.enabled ? 'success' : 'warning'"
                    ></p-tag>
                  </div>
                </div>
                <div class="cred-card-body">
                  <div class="cred-detail">
                    <span class="cred-label">Enrolled At</span>
                    <span class="cred-value">{{ getCredentialDetail('TOTP')?.enrolledAt ? (getCredentialDetail('TOTP')!.enrolledAt! | date:'medium') : '—' }}</span>
                  </div>
                </div>
                <div class="cred-card-actions">
                  <button
                    *ngIf="getCredentialDetail('TOTP')?.enabled"
                    pButton
                    type="button"
                    label="Revoke"
                    icon="pi pi-trash"
                    class="p-button-outlined p-button-danger p-button-sm"
                    (click)="revokeCredential('totp')"
                    aria-label="Revoke TOTP credential"
                  ></button>
                  <button
                    pButton
                    type="button"
                    label="Force Enroll"
                    icon="pi pi-plus-circle"
                    class="p-button-text p-button-sm"
                    (click)="forceEnroll('totp')"
                    aria-label="Force TOTP enrollment"
                  ></button>
                </div>
              </div>

              <!-- FIDO2 Card -->
              <div class="credential-card" role="region" aria-label="FIDO2 credential">
                <div class="cred-card-header">
                  <div class="cred-card-icon"><i class="pi pi-key"></i></div>
                  <div class="cred-card-title">
                    <h5>FIDO2 Security Key</h5>
                    <p-tag
                      [value]="(getCredentialDetail('FIDO2')?.keys?.length || 0) + ' key(s)'"
                      [severity]="(getCredentialDetail('FIDO2')?.keys?.length || 0) > 0 ? 'success' : 'warning'"
                    ></p-tag>
                  </div>
                </div>
                <div class="cred-card-body">
                  <div *ngIf="getCredentialDetail('FIDO2')?.keys?.length; else noFidoKeys">
                    <div *ngFor="let key of getCredentialDetail('FIDO2')!.keys" class="fido-key-item">
                      <div class="fido-key-info">
                        <span class="fido-key-name">{{ key.keyName }}</span>
                        <small>Registered {{ key.registeredAt | date:'mediumDate' }}</small>
                      </div>
                      <button
                        pButton
                        type="button"
                        icon="pi pi-trash"
                        class="p-button-text p-button-danger p-button-sm"
                        (click)="revokeFidoKey(key.keyId)"
                        [attr.aria-label]="'Revoke FIDO2 key ' + key.keyName"
                      ></button>
                    </div>
                  </div>
                  <ng-template #noFidoKeys>
                    <span class="cred-empty">No security keys registered.</span>
                  </ng-template>
                </div>
                <div class="cred-card-actions">
                  <button
                    pButton
                    type="button"
                    label="Force Enroll"
                    icon="pi pi-plus-circle"
                    class="p-button-text p-button-sm"
                    (click)="forceEnroll('fido2')"
                    aria-label="Force FIDO2 enrollment"
                  ></button>
                </div>
              </div>

              <!-- Soft Token Card -->
              <div class="credential-card" role="region" aria-label="Soft Token credential">
                <div class="cred-card-header">
                  <div class="cred-card-icon"><i class="pi pi-shield"></i></div>
                  <div class="cred-card-title">
                    <h5>Soft Token</h5>
                    <p-tag
                      [value]="getCredentialDetail('SOFT_TOKEN')?.enabled ? 'Activated' : 'Not Activated'"
                      [severity]="getCredentialDetail('SOFT_TOKEN')?.enabled ? 'success' : 'warning'"
                    ></p-tag>
                  </div>
                </div>
                <div class="cred-card-body">
                  <div class="cred-detail">
                    <span class="cred-label">Enrolled At</span>
                    <span class="cred-value">{{ getCredentialDetail('SOFT_TOKEN')?.enrolledAt ? (getCredentialDetail('SOFT_TOKEN')!.enrolledAt! | date:'medium') : '—' }}</span>
                  </div>
                </div>
                <div class="cred-card-actions">
                  <button
                    *ngIf="getCredentialDetail('SOFT_TOKEN')?.enabled"
                    pButton
                    type="button"
                    label="Revoke"
                    icon="pi pi-trash"
                    class="p-button-outlined p-button-danger p-button-sm"
                    (click)="revokeCredential('soft-token')"
                    aria-label="Revoke soft token credential"
                  ></button>
                  <button
                    pButton
                    type="button"
                    label="Force Enroll"
                    icon="pi pi-plus-circle"
                    class="p-button-text p-button-sm"
                    (click)="forceEnroll('soft-token')"
                    aria-label="Force soft token enrollment"
                  ></button>
                </div>
              </div>
            </div>
          </div>
        </p-tabPanel>

        <!-- ====== TAB 6: Sessions ====== -->
        <p-tabPanel header="Sessions" leftIcon="pi pi-desktop">
          <div class="tab-content" role="tabpanel" aria-label="Sessions tab">
            <div class="tab-actions">
              <button
                pButton
                type="button"
                label="Force Logout All"
                icon="pi pi-sign-out"
                class="p-button-danger p-button-sm"
                (click)="confirmRevokeAllSessions()"
                [disabled]="activeSessions.length === 0"
                aria-label="Force logout all active sessions"
              ></button>
            </div>

            <p-message
              *ngIf="sessionActionSuccess"
              severity="success"
              [text]="sessionActionSuccess"
              styleClass="mb-2 w-full"
            ></p-message>

            <div *ngIf="sessionsLoading" class="tab-loading">
              <p-progressSpinner [style]="{ width: '30px', height: '30px' }" strokeWidth="4"></p-progressSpinner>
            </div>

            <div *ngIf="!sessionsLoading" class="sessions-list">
              <div *ngIf="activeSessions.length === 0" class="empty-state">
                <i class="pi pi-desktop"></i>
                <p>No active sessions.</p>
              </div>
              <div
                *ngFor="let session of activeSessions"
                class="session-card"
                role="listitem"
              >
                <div class="session-info">
                  <div class="session-browser">
                    <i class="pi pi-globe"></i>
                    <span>{{ session.browser || 'Unknown Browser' }} / {{ session.os || 'Unknown OS' }}</span>
                  </div>
                  <div class="session-meta">
                    <span><i class="pi pi-map-marker"></i> {{ session.ipAddress }}</span>
                    <span><i class="pi pi-clock"></i> Created: {{ session.createdAt | date:'medium' }}</span>
                    <span><i class="pi pi-history"></i> Last Activity: {{ session.lastActivity | date:'medium' }}</span>
                  </div>
                </div>
                <button
                  pButton
                  type="button"
                  label="Force Logout"
                  icon="pi pi-sign-out"
                  class="p-button-outlined p-button-danger p-button-sm"
                  (click)="forceLogoutSession(session.sessionId)"
                  [attr.aria-label]="'Force logout session from ' + session.browser"
                ></button>
              </div>
            </div>
          </div>
        </p-tabPanel>

        <!-- ====== TAB 7: Audit ====== -->
        <p-tabPanel header="Audit" leftIcon="pi pi-list">
          <div class="tab-content" role="tabpanel" aria-label="Audit tab">
            <!-- Filters -->
            <div class="audit-filters">
              <p-dropdown
                [options]="auditEventTypes"
                [(ngModel)]="auditFilterEventType"
                placeholder="All Event Types"
                [showClear]="true"
                (onChange)="reloadAuditGrid()"
                styleClass="filter-dropdown"
                aria-label="Filter by event type"
              ></p-dropdown>
              <p-dropdown
                [options]="auditOutcomes"
                [(ngModel)]="auditFilterOutcome"
                placeholder="All Outcomes"
                [showClear]="true"
                (onChange)="reloadAuditGrid()"
                styleClass="filter-dropdown"
                aria-label="Filter by outcome"
              ></p-dropdown>
              <div class="date-range-filter">
                <input
                  pInputText
                  type="date"
                  [(ngModel)]="auditFilterDateFrom"
                  (change)="reloadAuditGrid()"
                  aria-label="Filter from date"
                  class="date-input"
                />
                <span>to</span>
                <input
                  pInputText
                  type="date"
                  [(ngModel)]="auditFilterDateTo"
                  (change)="reloadAuditGrid()"
                  aria-label="Filter to date"
                  class="date-input"
                />
              </div>
            </div>

            <div class="grid-container">
              <ag-grid-angular
                class="ag-theme-alpine"
                [columnDefs]="auditColumnDefs"
                [defaultColDef]="defaultColDef"
                [rowModelType]="'serverSide'"
                [serverSideDatasource]="auditDatasource"
                [pagination]="true"
                [paginationPageSize]="20"
                [cacheBlockSize]="20"
                [animateRows]="true"
                [domLayout]="'autoHeight'"
                (gridReady)="onAuditGridReady($event)"
                [overlayNoRowsTemplate]="'No audit events found.'"
                role="grid"
                aria-label="Audit events grid"
              ></ag-grid-angular>
            </div>
          </div>
        </p-tabPanel>

        <!-- ====== TAB 8: Access (IGA) — Conditional ====== -->
        <p-tabPanel
          *ngIf="igaEnabled"
          header="Access (IGA)"
          leftIcon="pi pi-sitemap"
        >
          <div class="tab-content" role="tabpanel" aria-label="Access IGA tab">
            <div *ngIf="igaLoading" class="tab-loading">
              <p-progressSpinner [style]="{ width: '30px', height: '30px' }" strokeWidth="4"></p-progressSpinner>
            </div>

            <div *ngIf="!igaLoading">
              <!-- Certification Status -->
              <div class="certification-banner" *ngIf="certificationInfo">
                <h4>Certification Status</h4>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">Last Certified</span>
                    <span class="detail-value">{{ certificationInfo.lastCertifiedAt | date:'mediumDate' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Next Certification Due</span>
                    <span class="detail-value">{{ certificationInfo.nextCertificationDue | date:'mediumDate' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Certifier</span>
                    <span class="detail-value">{{ certificationInfo.certifierName }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">
                      <p-tag [value]="certificationInfo.status" [severity]="certificationInfo.status === 'CERTIFIED' ? 'success' : 'warning'"></p-tag>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Effective Entitlements Table -->
              <h4 class="mt-3">Effective Entitlements</h4>
              <div class="grid-container">
                <ag-grid-angular
                  class="ag-theme-alpine"
                  [rowData]="effectiveEntitlements"
                  [columnDefs]="entitlementColumnDefs"
                  [defaultColDef]="defaultColDef"
                  [domLayout]="'autoHeight'"
                  [pagination]="false"
                  [animateRows]="true"
                  [overlayNoRowsTemplate]="'No entitlements found.'"
                  role="grid"
                  aria-label="Effective entitlements grid"
                ></ag-grid-angular>
              </div>
            </div>
          </div>
        </p-tabPanel>
      </p-tabView>

      <!-- ============================================================ -->
      <!-- Dialogs                                                       -->
      <!-- ============================================================ -->

      <!-- Account Action Confirmation Dialog -->
      <p-dialog
        header="Confirm Action"
        [(visible)]="showAccountActionDialog"
        [modal]="true"
        [style]="{ width: '420px' }"
        aria-label="Confirm account action dialog"
      >
        <p>{{ accountActionMessage }}</p>
        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            label="Cancel"
            class="p-button-text"
            (click)="showAccountActionDialog = false"
          ></button>
          <button
            pButton
            type="button"
            label="Confirm"
            [class]="pendingAccountAction === 'disable' ? 'p-button-danger' : 'p-button-warning'"
            (click)="executeAccountAction()"
            [loading]="executingAccountAction"
          ></button>
        </ng-template>
      </p-dialog>

      <!-- Assign Role Dialog -->
      <p-dialog
        header="Assign Role"
        [(visible)]="showAssignRoleDialog"
        [modal]="true"
        [style]="{ width: '500px' }"
        aria-label="Assign role dialog"
      >
        <div class="dialog-form">
          <div class="form-field">
            <label for="roleSelect" class="form-label">Role <span class="required">*</span></label>
            <p-dropdown
              id="roleSelect"
              [options]="availableRoles"
              [(ngModel)]="selectedRoleToAssign"
              optionLabel="name"
              optionValue="id"
              placeholder="Search and select a role"
              [filter]="true"
              filterPlaceholder="Search roles..."
              styleClass="w-full"
              aria-label="Select role to assign"
            ></p-dropdown>
          </div>
          <div class="form-field">
            <label for="roleSource" class="form-label">Source</label>
            <p-dropdown
              id="roleSource"
              [options]="assignmentSourceOptions"
              [(ngModel)]="selectedRoleSource"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
              aria-label="Assignment source"
            ></p-dropdown>
          </div>
          <div class="form-field">
            <label for="roleReason" class="form-label">Reason</label>
            <textarea
              id="roleReason"
              pInputText
              [(ngModel)]="roleAssignReason"
              rows="3"
              placeholder="Enter reason for assignment..."
              class="w-full reason-textarea"
              aria-label="Reason for role assignment"
            ></textarea>
          </div>
        </div>
        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            label="Cancel"
            class="p-button-text"
            (click)="showAssignRoleDialog = false"
          ></button>
          <button
            pButton
            type="button"
            label="Assign"
            icon="pi pi-check"
            (click)="assignRole()"
            [disabled]="!selectedRoleToAssign"
            [loading]="assigningRole"
          ></button>
        </ng-template>
      </p-dialog>

      <!-- Remove Role Confirmation Dialog -->
      <p-dialog
        header="Remove Role"
        [(visible)]="showRemoveRoleDialog"
        [modal]="true"
        [style]="{ width: '450px' }"
        aria-label="Remove role confirmation dialog"
      >
        <p>
          Are you sure you want to remove the role
          <strong>{{ roleToRemove?.roleName }}</strong> from this user?
        </p>
        <div class="form-field mt-2">
          <label for="removeRoleReason" class="form-label">Reason</label>
          <textarea
            id="removeRoleReason"
            pInputText
            [(ngModel)]="roleRemoveReason"
            rows="3"
            placeholder="Enter reason for removal..."
            class="w-full reason-textarea"
            aria-label="Reason for role removal"
          ></textarea>
        </div>
        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            label="Cancel"
            class="p-button-text"
            (click)="showRemoveRoleDialog = false"
          ></button>
          <button
            pButton
            type="button"
            label="Remove"
            class="p-button-danger"
            (click)="executeRemoveRole()"
            [loading]="removingRole"
          ></button>
        </ng-template>
      </p-dialog>

      <!-- Add Group Dialog -->
      <p-dialog
        header="Add to Group"
        [(visible)]="showAddGroupDialog"
        [modal]="true"
        [style]="{ width: '450px' }"
        aria-label="Add to group dialog"
      >
        <div class="dialog-form">
          <div class="form-field">
            <label for="groupSelect" class="form-label">Group <span class="required">*</span></label>
            <p-dropdown
              id="groupSelect"
              [options]="availableGroupsForAssign"
              [(ngModel)]="selectedGroupToAdd"
              optionLabel="name"
              optionValue="id"
              placeholder="Search and select a group"
              [filter]="true"
              filterPlaceholder="Search groups..."
              styleClass="w-full"
              aria-label="Select group to add"
            ></p-dropdown>
          </div>
        </div>
        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            label="Cancel"
            class="p-button-text"
            (click)="showAddGroupDialog = false"
          ></button>
          <button
            pButton
            type="button"
            label="Add"
            icon="pi pi-check"
            (click)="addToGroup()"
            [disabled]="!selectedGroupToAdd"
            [loading]="addingGroup"
          ></button>
        </ng-template>
      </p-dialog>

      <!-- Remove Group Confirmation Dialog -->
      <p-dialog
        header="Remove from Group"
        [(visible)]="showRemoveGroupDialog"
        [modal]="true"
        [style]="{ width: '420px' }"
        aria-label="Remove from group confirmation dialog"
      >
        <p>
          Are you sure you want to remove this user from group
          <strong>{{ groupToRemove?.groupName }}</strong>?
        </p>
        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            label="Cancel"
            class="p-button-text"
            (click)="showRemoveGroupDialog = false"
          ></button>
          <button
            pButton
            type="button"
            label="Remove"
            class="p-button-danger"
            (click)="executeRemoveGroup()"
            [loading]="removingGroup"
          ></button>
        </ng-template>
      </p-dialog>

      <!-- Revoke All Sessions Confirmation -->
      <p-dialog
        header="Force Logout All Sessions"
        [(visible)]="showRevokeAllSessionsDialog"
        [modal]="true"
        [style]="{ width: '420px' }"
        aria-label="Force logout all sessions confirmation"
      >
        <p>
          This will terminate all <strong>{{ activeSessions.length }}</strong> active session(s)
          for this user. The user will be logged out immediately. Are you sure?
        </p>
        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            label="Cancel"
            class="p-button-text"
            (click)="showRevokeAllSessionsDialog = false"
          ></button>
          <button
            pButton
            type="button"
            label="Logout All"
            class="p-button-danger"
            (click)="revokeAllSessions()"
            [loading]="revokingAllSessions"
          ></button>
        </ng-template>
      </p-dialog>
    </div>
  `,
  styles: [`
    /* ---------------------------------------------------------------- */
    /* Loading & Error States                                            */
    /* ---------------------------------------------------------------- */
    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      gap: 1rem;
    }

    .loading-container p,
    .error-container p {
      color: var(--text-color-secondary, #64748b);
    }

    .tab-loading {
      display: flex;
      justify-content: center;
      padding: 2rem 0;
    }

    /* ---------------------------------------------------------------- */
    /* Page Layout                                                       */
    /* ---------------------------------------------------------------- */
    .user-detail-page {
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ---------------------------------------------------------------- */
    /* User Header                                                       */
    /* ---------------------------------------------------------------- */
    .user-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      background: var(--surface-card, #ffffff);
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 10px;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .user-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--primary-100, #dbeafe);
      color: var(--primary-700, #1d4ed8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .user-identity {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color, #1e293b);
    }

    .user-email {
      font-size: 0.85rem;
      color: var(--text-color-secondary, #64748b);
    }

    .header-right {
      display: flex;
      gap: 0.5rem;
    }

    /* ---------------------------------------------------------------- */
    /* Tabs                                                              */
    /* ---------------------------------------------------------------- */
    :host ::ng-deep .user-tabs .p-tabview-nav {
      border-bottom: 2px solid var(--surface-border, #e2e8f0);
    }

    :host ::ng-deep .user-tabs .p-tabview-panels {
      padding: 0;
    }

    .tab-content {
      padding: 1.5rem 0;
    }

    .tab-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    /* ---------------------------------------------------------------- */
    /* Detail Grid (used across tabs)                                    */
    /* ---------------------------------------------------------------- */
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .detail-label {
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--text-color-secondary, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .detail-value {
      font-size: 0.95rem;
      color: var(--text-color, #1e293b);
    }

    .danger-text {
      color: var(--red-500, #ef4444);
      font-weight: 600;
    }

    /* ---------------------------------------------------------------- */
    /* Edit Form                                                         */
    /* ---------------------------------------------------------------- */
    .edit-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .form-label {
      font-weight: 500;
      font-size: 0.875rem;
      color: var(--text-color, #1e293b);
    }

    .required {
      color: var(--red-500, #ef4444);
    }

    .w-full {
      width: 100%;
    }

    .p-error {
      color: var(--red-500, #ef4444);
      font-size: 0.8rem;
    }

    /* ---------------------------------------------------------------- */
    /* Profile History Timeline                                          */
    /* ---------------------------------------------------------------- */
    .history-section {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--surface-border, #e2e8f0);
    }

    .history-section h4 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .timeline-event {
      font-size: 0.9rem;
    }

    .timeline-event strong {
      color: var(--primary-color, #3b82f6);
    }

    .timeline-detail {
      display: block;
      margin-top: 0.25rem;
    }

    .timeline-detail code {
      background: var(--surface-100, #f1f5f9);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.825rem;
    }

    .timeline-meta {
      margin-top: 0.25rem;
    }

    .timeline-meta small {
      color: var(--text-color-secondary, #64748b);
    }

    .timeline-date {
      color: var(--text-color-secondary, #64748b);
      font-size: 0.8rem;
    }

    /* ---------------------------------------------------------------- */
    /* Account Tab                                                       */
    /* ---------------------------------------------------------------- */
    .account-status-banner {
      padding: 1.25rem 1.5rem;
      border-radius: 8px;
      text-align: center;
    }

    .account-status-banner.status-active {
      background: var(--green-50, #f0fdf4);
      border: 1px solid var(--green-200, #bbf7d0);
    }

    .account-status-banner.status-locked {
      background: var(--red-50, #fef2f2);
      border: 1px solid var(--red-200, #fecaca);
    }

    .account-status-banner.status-suspended {
      background: var(--yellow-50, #fffbeb);
      border: 1px solid var(--yellow-200, #fde68a);
    }

    .account-status-banner.status-disabled {
      background: var(--surface-100, #f1f5f9);
      border: 1px solid var(--surface-300, #cbd5e1);
    }

    .account-status-banner.status-pending_activation {
      background: var(--blue-50, #eff6ff);
      border: 1px solid var(--blue-200, #bfdbfe);
    }

    .account-status-banner.status-unknown {
      background: var(--surface-100, #f1f5f9);
      border: 1px solid var(--surface-300, #cbd5e1);
    }

    .status-badge-large {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }

    .status-badge-large i {
      font-size: 1.5rem;
    }

    .status-badge-large span {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .account-actions h4 {
      margin: 0 0 0.75rem 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    /* ---------------------------------------------------------------- */
    /* Roles Grid                                                        */
    /* ---------------------------------------------------------------- */
    .grid-container {
      width: 100%;
      min-height: 200px;
    }

    .grid-container ag-grid-angular {
      width: 100%;
    }

    /* ---------------------------------------------------------------- */
    /* Groups List                                                       */
    /* ---------------------------------------------------------------- */
    .groups-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .group-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 1.25rem;
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 8px;
      background: var(--surface-card, #ffffff);
      transition: border-color 0.2s;
    }

    .group-card:hover {
      border-color: var(--primary-color, #3b82f6);
    }

    .group-info {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .group-name {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-color, #1e293b);
    }

    .group-meta {
      font-size: 0.8rem;
      color: var(--text-color-secondary, #64748b);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: var(--text-color-secondary, #64748b);
      gap: 0.5rem;
    }

    .empty-state i {
      font-size: 2.5rem;
      opacity: 0.4;
    }

    .empty-state p {
      margin: 0;
    }

    /* ---------------------------------------------------------------- */
    /* Credentials Cards                                                 */
    /* ---------------------------------------------------------------- */
    .credentials-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .credential-card {
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 10px;
      background: var(--surface-card, #ffffff);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .cred-card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: var(--surface-50, #f8fafc);
      border-bottom: 1px solid var(--surface-border, #e2e8f0);
    }

    .cred-card-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--primary-100, #dbeafe);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cred-card-icon i {
      font-size: 1rem;
      color: var(--primary-color, #3b82f6);
    }

    .cred-card-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .cred-card-title h5 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .cred-card-body {
      padding: 1rem 1.25rem;
      flex: 1;
    }

    .cred-detail {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 0;
    }

    .cred-label {
      font-size: 0.825rem;
      color: var(--text-color-secondary, #64748b);
    }

    .cred-value {
      font-size: 0.875rem;
      font-weight: 500;
    }

    .cred-empty {
      color: var(--text-color-secondary, #64748b);
      font-size: 0.85rem;
      font-style: italic;
    }

    .cred-card-actions {
      padding: 0.75rem 1.25rem;
      border-top: 1px solid var(--surface-border, #e2e8f0);
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .fido-key-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.375rem 0;
      border-bottom: 1px solid var(--surface-100, #f1f5f9);
    }

    .fido-key-item:last-child {
      border-bottom: none;
    }

    .fido-key-info {
      display: flex;
      flex-direction: column;
    }

    .fido-key-name {
      font-weight: 500;
      font-size: 0.875rem;
    }

    .fido-key-info small {
      color: var(--text-color-secondary, #64748b);
      font-size: 0.775rem;
    }

    /* ---------------------------------------------------------------- */
    /* Sessions                                                          */
    /* ---------------------------------------------------------------- */
    .sessions-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .session-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 8px;
      background: var(--surface-card, #ffffff);
    }

    .session-info {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .session-browser {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      font-size: 0.95rem;
    }

    .session-meta {
      display: flex;
      gap: 1.25rem;
      font-size: 0.8rem;
      color: var(--text-color-secondary, #64748b);
    }

    .session-meta span {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* ---------------------------------------------------------------- */
    /* Audit Filters                                                     */
    /* ---------------------------------------------------------------- */
    .audit-filters {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      align-items: center;
    }

    :host ::ng-deep .filter-dropdown {
      min-width: 180px;
    }

    .date-range-filter {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .date-input {
      width: 150px;
    }

    /* ---------------------------------------------------------------- */
    /* IGA / Access Tab                                                  */
    /* ---------------------------------------------------------------- */
    .certification-banner {
      padding: 1.25rem 1.5rem;
      background: var(--surface-50, #f8fafc);
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 8px;
    }

    .certification-banner h4 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      font-weight: 600;
    }

    /* ---------------------------------------------------------------- */
    /* Dialog Form                                                       */
    /* ---------------------------------------------------------------- */
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .reason-textarea {
      resize: vertical;
      min-height: 72px;
      padding: 0.5rem;
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9rem;
    }

    /* ---------------------------------------------------------------- */
    /* Utilities                                                         */
    /* ---------------------------------------------------------------- */
    .mt-2 { margin-top: 0.5rem; }
    .mt-3 { margin-top: 1rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 1rem; }
    .ml-1 { margin-left: 0.25rem; }
    .ml-3 { margin-left: 0.75rem; }

    /* ---------------------------------------------------------------- */
    /* Responsive                                                        */
    /* ---------------------------------------------------------------- */
    @media (max-width: 768px) {
      .detail-grid,
      .edit-grid,
      .credentials-grid {
        grid-template-columns: 1fr;
      }

      .user-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .header-left {
        flex-wrap: wrap;
      }

      .audit-filters {
        flex-direction: column;
      }

      .session-card {
        flex-direction: column;
        gap: 0.75rem;
        align-items: flex-start;
      }

      .session-meta {
        flex-direction: column;
        gap: 0.25rem;
      }
    }
  `],
})
export class UserDetailComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/admin';

  /* ------------------------------------------------------------------ */
  /*  Core State                                                         */
  /* ------------------------------------------------------------------ */
  userId!: string;
  user: UserDetail | null = null;
  loading = true;
  loadError: string | null = null;
  activeTabIndex = 0;

  /* ------------------------------------------------------------------ */
  /*  Feature Flags                                                      */
  /* ------------------------------------------------------------------ */
  igaEnabled = false;

  /* ------------------------------------------------------------------ */
  /*  Profile Tab                                                        */
  /* ------------------------------------------------------------------ */
  profileForm!: FormGroup;
  profileEditMode = false;
  savingProfile = false;
  profileSaveSuccess = false;
  profileSaveError: string | null = null;
  profileHistory: HistoryEntry[] = [];

  userTypes = [
    { label: 'Employee', value: 'EMPLOYEE' },
    { label: 'Contractor', value: 'CONTRACTOR' },
    { label: 'Vendor', value: 'VENDOR' },
    { label: 'Service Account', value: 'SERVICE' },
  ];

  /* ------------------------------------------------------------------ */
  /*  Account Tab                                                        */
  /* ------------------------------------------------------------------ */
  accountTabLoading = false;
  showAccountActionDialog = false;
  pendingAccountAction: string | null = null;
  accountActionMessage = '';
  executingAccountAction = false;
  accountActionSuccess: string | null = null;
  accountActionError: string | null = null;

  /* ------------------------------------------------------------------ */
  /*  Roles Tab                                                          */
  /* ------------------------------------------------------------------ */
  assignedRoles: AssignedRole[] = [];
  rolesColumnDefs: ColDef[] = [];
  private rolesGridApi!: GridApi;

  showAssignRoleDialog = false;
  availableRoles: RoleOption[] = [];
  selectedRoleToAssign: string | null = null;
  selectedRoleSource = 'DIRECT';
  roleAssignReason = '';
  assigningRole = false;
  roleActionSuccess: string | null = null;

  showRemoveRoleDialog = false;
  roleToRemove: AssignedRole | null = null;
  roleRemoveReason = '';
  removingRole = false;

  assignmentSourceOptions = [
    { label: 'Direct', value: 'DIRECT' },
    { label: 'Manager', value: 'MANAGER' },
    { label: 'Policy', value: 'POLICY' },
  ];

  /* ------------------------------------------------------------------ */
  /*  Groups Tab                                                         */
  /* ------------------------------------------------------------------ */
  assignedGroups: AssignedGroup[] = [];

  showAddGroupDialog = false;
  availableGroupsForAssign: GroupOption[] = [];
  selectedGroupToAdd: string | null = null;
  addingGroup = false;
  groupActionSuccess: string | null = null;

  showRemoveGroupDialog = false;
  groupToRemove: AssignedGroup | null = null;
  removingGroup = false;

  /* ------------------------------------------------------------------ */
  /*  Credentials Tab                                                    */
  /* ------------------------------------------------------------------ */
  credentialsLoading = false;
  credentials: CredentialStatus[] = [];
  resettingPassword = false;
  credentialActionSuccess: string | null = null;
  credentialActionError: string | null = null;

  /* ------------------------------------------------------------------ */
  /*  Sessions Tab                                                       */
  /* ------------------------------------------------------------------ */
  sessionsLoading = false;
  activeSessions: ActiveSession[] = [];
  sessionActionSuccess: string | null = null;
  showRevokeAllSessionsDialog = false;
  revokingAllSessions = false;

  /* ------------------------------------------------------------------ */
  /*  Audit Tab                                                          */
  /* ------------------------------------------------------------------ */
  auditColumnDefs: ColDef[] = [];
  auditDatasource!: IServerSideDatasource;
  private auditGridApi!: GridApi;

  auditEventTypes = [
    { label: 'LOGIN', value: 'LOGIN' },
    { label: 'LOGOUT', value: 'LOGOUT' },
    { label: 'PASSWORD_CHANGE', value: 'PASSWORD_CHANGE' },
    { label: 'MFA_CHALLENGE', value: 'MFA_CHALLENGE' },
    { label: 'ACCOUNT_LOCKED', value: 'ACCOUNT_LOCKED' },
    { label: 'ROLE_CHANGE', value: 'ROLE_CHANGE' },
    { label: 'PROFILE_UPDATE', value: 'PROFILE_UPDATE' },
  ];

  auditOutcomes = [
    { label: 'SUCCESS', value: 'SUCCESS' },
    { label: 'FAILURE', value: 'FAILURE' },
  ];

  auditFilterEventType: string | null = null;
  auditFilterOutcome: string | null = null;
  auditFilterDateFrom: string | null = null;
  auditFilterDateTo: string | null = null;

  /* ------------------------------------------------------------------ */
  /*  IGA / Access Tab                                                   */
  /* ------------------------------------------------------------------ */
  igaLoading = false;
  effectiveEntitlements: EffectiveEntitlement[] = [];
  certificationInfo: CertificationInfo | null = null;
  entitlementColumnDefs: ColDef[] = [];

  /* ------------------------------------------------------------------ */
  /*  Grid Defaults                                                      */
  /* ------------------------------------------------------------------ */
  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    flex: 1,
    minWidth: 120,
  };

  /* ------------------------------------------------------------------ */
  /*  Constructor                                                        */
  /* ------------------------------------------------------------------ */
  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */
  ngOnInit(): void {
    this.initColumnDefs();
    this.initProfileForm();
    this.initAuditDatasource();
    this.loadFeatureFlags();

    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.userId = params['userId'];
        this.loadUser();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ------------------------------------------------------------------ */
  /*  Initialization                                                     */
  /* ------------------------------------------------------------------ */
  private initProfileForm(): void {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      department: [''],
      designation: [''],
      userType: ['EMPLOYEE'],
    });
  }

  private initColumnDefs(): void {
    // Roles grid
    this.rolesColumnDefs = [
      { headerName: 'Role Name', field: 'roleName', flex: 2 },
      { headerName: 'Role Code', field: 'roleCode', flex: 1.5 },
      { headerName: 'Type', field: 'roleType', flex: 1 },
      {
        headerName: 'Source',
        field: 'source',
        flex: 1,
        cellRenderer: (params: any) => {
          const source = params.value || '';
          const colors: Record<string, string> = {
            DIRECT: '#3b82f6',
            MANAGER: '#f59e0b',
            POLICY: '#8b5cf6',
          };
          const color = colors[source] || '#64748b';
          return `<span style="color:${color}; font-weight:600;">${source}</span>`;
        },
      },
      {
        headerName: 'Assigned At',
        field: 'assignedAt',
        flex: 1.5,
        valueFormatter: (params: any) => {
          if (!params.value) return '—';
          return new Date(params.value).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        },
      },
      {
        headerName: 'Actions',
        field: 'roleId',
        flex: 0.8,
        sortable: false,
        cellRenderer: (params: any) => {
          return `<button class="remove-role-btn" title="Remove role" aria-label="Remove role">
                    <i class="pi pi-trash"></i>
                  </button>`;
        },
        onCellClicked: (params: any) => {
          this.confirmRemoveRole(params.data);
        },
      },
    ];

    // Audit grid
    this.auditColumnDefs = [
      { headerName: 'Event Type', field: 'eventType', flex: 1.5 },
      {
        headerName: 'Outcome',
        field: 'outcome',
        flex: 1,
        cellRenderer: (params: any) => {
          const val = params.value || '';
          const color = val === 'SUCCESS' ? '#22c55e' : '#ef4444';
          return `<span style="color:${color}; font-weight:600;">${val}</span>`;
        },
      },
      { headerName: 'IP Address', field: 'ipAddress', flex: 1.2 },
      {
        headerName: 'Timestamp',
        field: 'timestamp',
        flex: 1.5,
        sort: 'desc',
        valueFormatter: (params: any) => {
          if (!params.value) return '—';
          return new Date(params.value).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        },
      },
      {
        headerName: 'Details',
        field: 'details',
        flex: 2,
        tooltipField: 'details',
      },
    ];

    // Entitlements grid (IGA)
    this.entitlementColumnDefs = [
      { headerName: 'Entitlement', field: 'entitlementName', flex: 2 },
      { headerName: 'Resource', field: 'resource', flex: 1.5 },
      { headerName: 'Action', field: 'action', flex: 1 },
      { headerName: 'Source', field: 'source', flex: 1 },
      {
        headerName: 'Status',
        field: 'status',
        flex: 1,
        cellRenderer: (params: any) => {
          const val = params.value || '';
          const color = val === 'ACTIVE' ? '#22c55e' : '#f59e0b';
          return `<span style="color:${color}; font-weight:600;">${val}</span>`;
        },
      },
    ];
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */
  loadUser(): void {
    this.loading = true;
    this.loadError = null;

    this.http
      .get<ApiResponse<UserDetail>>(`${this.API_BASE}/users/${this.userId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.user = res.data ?? null;
          this.loading = false;
          if (this.user) {
            this.populateProfileForm();
            this.loadProfileHistory();
          }
        },
        error: (err) => {
          this.loading = false;
          this.loadError =
            err.error?.message ?? 'Failed to load user details. Please try again.';
        },
      });
  }

  private loadFeatureFlags(): void {
    this.http
      .get<ApiResponse<FeatureFlags>>(`${this.API_BASE}/config/features`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.igaEnabled = res.data?.igaEnabled ?? false;
        },
        error: () => {
          this.igaEnabled = false;
        },
      });
  }

  refreshAll(): void {
    this.loadUser();
    // Reload the current tab data
    this.onTabChange(this.activeTabIndex);
  }

  /* ------------------------------------------------------------------ */
  /*  Tab Change Handler (Lazy Loading)                                  */
  /* ------------------------------------------------------------------ */
  onTabChange(index: number): void {
    this.activeTabIndex = index;

    // Clear transient messages
    this.profileSaveSuccess = false;
    this.profileSaveError = null;
    this.accountActionSuccess = null;
    this.accountActionError = null;
    this.roleActionSuccess = null;
    this.groupActionSuccess = null;
    this.credentialActionSuccess = null;
    this.credentialActionError = null;
    this.sessionActionSuccess = null;

    switch (index) {
      case 0: // Profile
        this.loadProfileHistory();
        break;
      case 1: // Account — data already in user object
        break;
      case 2: // Roles
        this.loadAssignedRoles();
        break;
      case 3: // Groups
        this.loadAssignedGroups();
        break;
      case 4: // Credentials
        this.loadCredentials();
        break;
      case 5: // Sessions
        this.loadSessions();
        break;
      case 6: // Audit — handled by server-side datasource
        break;
      case 7: // IGA
        if (this.igaEnabled) {
          this.loadIgaData();
        }
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Profile Tab                                                        */
  /* ------------------------------------------------------------------ */
  private populateProfileForm(): void {
    if (!this.user) return;
    this.profileForm.patchValue({
      firstName: this.user.firstName ?? '',
      lastName: this.user.lastName ?? '',
      email: this.user.email ?? '',
      department: (this.user as any).department ?? '',
      designation: (this.user as any).designation ?? '',
      userType: (this.user as any).userType ?? 'EMPLOYEE',
    });
    this.profileForm.markAsPristine();
  }

  toggleProfileEdit(): void {
    if (this.profileEditMode) {
      // Cancel → revert form
      this.populateProfileForm();
      this.profileEditMode = false;
    } else {
      this.profileEditMode = true;
    }
    this.profileSaveSuccess = false;
    this.profileSaveError = null;
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile = true;
    this.profileSaveSuccess = false;
    this.profileSaveError = null;

    this.http
      .put<ApiResponse<UserDetail>>(
        `${this.API_BASE}/users/${this.userId}/profile`,
        this.profileForm.getRawValue(),
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.savingProfile = false;
          this.profileSaveSuccess = true;
          this.profileEditMode = false;
          if (res.data) {
            this.user = { ...this.user, ...res.data } as UserDetail;
            this.populateProfileForm();
          }
          this.loadProfileHistory();
        },
        error: (err) => {
          this.savingProfile = false;
          this.profileSaveError =
            err.error?.message ?? 'Failed to save profile. Please try again.';
        },
      });
  }

  private loadProfileHistory(): void {
    this.http
      .get<ApiResponse<HistoryEntry[]>>(
        `${this.API_BASE}/users/${this.userId}/history`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.profileHistory = res.data ?? [];
        },
        error: () => {
          this.profileHistory = [];
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Account Tab                                                        */
  /* ------------------------------------------------------------------ */
  getAccountStatusIcon(status: string | undefined): string {
    const icons: Record<string, string> = {
      ACTIVE: 'pi pi-check-circle',
      LOCKED: 'pi pi-lock',
      SUSPENDED: 'pi pi-pause-circle',
      DISABLED: 'pi pi-ban',
      PENDING_ACTIVATION: 'pi pi-clock',
    };
    return icons[status ?? ''] ?? 'pi pi-question-circle';
  }

  getStatusSeverity(status: string | undefined): 'success' | 'danger' | 'warning' | 'info' {
    const map: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
      ACTIVE: 'success',
      LOCKED: 'danger',
      SUSPENDED: 'warning',
      DISABLED: 'danger',
      PENDING_ACTIVATION: 'info',
    };
    return map[status ?? ''] ?? 'info';
  }

  confirmAccountAction(action: string): void {
    this.pendingAccountAction = action;
    const messages: Record<string, string> = {
      unlock:
        'Are you sure you want to unlock this account? The failed login attempt counter will be reset.',
      forcePasswordChange:
        'The user will be required to change their password on next login. Continue?',
      suspend:
        'Suspending this account will prevent the user from logging in until reactivated. Continue?',
      activate:
        'This will reactivate the user account and allow login. Continue?',
      disable:
        'Disabling this account is a permanent action. The user will not be able to log in. Are you sure?',
    };
    this.accountActionMessage = messages[action] ?? 'Are you sure you want to proceed?';
    this.showAccountActionDialog = true;
  }

  executeAccountAction(): void {
    if (!this.pendingAccountAction || !this.user?.account?.accountId) return;

    this.executingAccountAction = true;
    this.accountActionSuccess = null;
    this.accountActionError = null;
    const accountId = this.user.account.accountId;
    let request$;

    switch (this.pendingAccountAction) {
      case 'unlock':
        request$ = this.http.post(
          `${this.API_BASE}/accounts/${accountId}/unlock`,
          {},
        );
        break;
      case 'forcePasswordChange':
        request$ = this.http.post(
          `${this.API_BASE}/accounts/${accountId}/force-password-change`,
          {},
        );
        break;
      case 'suspend':
        request$ = this.http.post(
          `${this.API_BASE}/accounts/${accountId}/status`,
          { status: 'SUSPENDED' },
        );
        break;
      case 'activate':
        request$ = this.http.post(
          `${this.API_BASE}/accounts/${accountId}/status`,
          { status: 'ACTIVE' },
        );
        break;
      case 'disable':
        request$ = this.http.post(
          `${this.API_BASE}/accounts/${accountId}/status`,
          { status: 'DISABLED' },
        );
        break;
      default:
        this.executingAccountAction = false;
        return;
    }

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.executingAccountAction = false;
        this.showAccountActionDialog = false;
        this.accountActionSuccess = `Account action "${this.pendingAccountAction}" completed successfully.`;
        // Reload user to reflect updated account status
        this.loadUser();
      },
      error: (err) => {
        this.executingAccountAction = false;
        this.showAccountActionDialog = false;
        this.accountActionError =
          err.error?.message ?? 'Account action failed. Please try again.';
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Roles Tab                                                          */
  /* ------------------------------------------------------------------ */
  private loadAssignedRoles(): void {
    this.http
      .get<ApiResponse<AssignedRole[]>>(`${this.API_BASE}/users/${this.userId}/roles`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.assignedRoles = res.data ?? [];
        },
        error: () => {
          this.assignedRoles = [];
        },
      });
  }

  onRolesGridReady(event: GridReadyEvent): void {
    this.rolesGridApi = event.api;
    this.loadAssignedRoles();
  }

  loadAvailableRoles(): void {
    this.http
      .get<ApiResponse<Role[]>>(`${this.API_BASE}/roles`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.availableRoles = (res.data ?? []).map((r: any) => ({
            id: r.id ?? r.roleId,
            name: r.roleName ?? r.name,
            code: r.roleCode ?? r.code,
          }));
        },
        error: () => {
          this.availableRoles = [];
        },
      });
  }

  assignRole(): void {
    if (!this.selectedRoleToAssign) return;

    this.assigningRole = true;
    this.roleActionSuccess = null;

    this.http
      .post<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/roles`,
        {
          roleId: this.selectedRoleToAssign,
          source: this.selectedRoleSource,
          reason: this.roleAssignReason,
        },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.assigningRole = false;
          this.showAssignRoleDialog = false;
          this.roleActionSuccess = 'Role assigned successfully.';
          this.selectedRoleToAssign = null;
          this.selectedRoleSource = 'DIRECT';
          this.roleAssignReason = '';
          this.loadAssignedRoles();
        },
        error: () => {
          this.assigningRole = false;
        },
      });
  }

  confirmRemoveRole(role: AssignedRole): void {
    this.roleToRemove = role;
    this.roleRemoveReason = '';
    this.showRemoveRoleDialog = true;
  }

  executeRemoveRole(): void {
    if (!this.roleToRemove) return;

    this.removingRole = true;
    this.roleActionSuccess = null;

    this.http
      .delete<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/roles/${this.roleToRemove.roleId}`,
        { body: { reason: this.roleRemoveReason } },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.removingRole = false;
          this.showRemoveRoleDialog = false;
          this.roleActionSuccess = `Role "${this.roleToRemove?.roleName}" removed successfully.`;
          this.roleToRemove = null;
          this.loadAssignedRoles();
        },
        error: () => {
          this.removingRole = false;
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Groups Tab                                                         */
  /* ------------------------------------------------------------------ */
  private loadAssignedGroups(): void {
    this.http
      .get<ApiResponse<AssignedGroup[]>>(
        `${this.API_BASE}/users/${this.userId}/groups`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.assignedGroups = res.data ?? [];
        },
        error: () => {
          this.assignedGroups = [];
        },
      });
  }

  loadAvailableGroups(): void {
    this.http
      .get<ApiResponse<Group[]>>(`${this.API_BASE}/groups`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.availableGroupsForAssign = (res.data ?? []).map((g: any) => ({
            id: g.id ?? g.groupId,
            name: g.groupName ?? g.name,
            code: g.groupCode ?? g.code,
          }));
        },
        error: () => {
          this.availableGroupsForAssign = [];
        },
      });
  }

  addToGroup(): void {
    if (!this.selectedGroupToAdd) return;

    this.addingGroup = true;
    this.groupActionSuccess = null;

    this.http
      .post<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/groups`,
        { groupId: this.selectedGroupToAdd },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addingGroup = false;
          this.showAddGroupDialog = false;
          this.groupActionSuccess = 'User added to group successfully.';
          this.selectedGroupToAdd = null;
          this.loadAssignedGroups();
        },
        error: () => {
          this.addingGroup = false;
        },
      });
  }

  confirmRemoveGroup(group: AssignedGroup): void {
    this.groupToRemove = group;
    this.showRemoveGroupDialog = true;
  }

  executeRemoveGroup(): void {
    if (!this.groupToRemove) return;

    this.removingGroup = true;
    this.groupActionSuccess = null;

    this.http
      .delete<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/groups/${this.groupToRemove.groupId}`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.removingGroup = false;
          this.showRemoveGroupDialog = false;
          this.groupActionSuccess = `Removed from group "${this.groupToRemove?.groupName}" successfully.`;
          this.groupToRemove = null;
          this.loadAssignedGroups();
        },
        error: () => {
          this.removingGroup = false;
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Credentials Tab                                                    */
  /* ------------------------------------------------------------------ */
  private loadCredentials(): void {
    this.credentialsLoading = true;

    this.http
      .get<ApiResponse<CredentialStatus[]>>(
        `${this.API_BASE}/users/${this.userId}/credentials`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.credentials = res.data ?? [];
          this.credentialsLoading = false;
        },
        error: () => {
          this.credentials = [];
          this.credentialsLoading = false;
        },
      });
  }

  getCredentialDetail(type: string): CredentialStatus | undefined {
    return this.credentials.find((c) => c.type === type);
  }

  resetPassword(): void {
    this.resettingPassword = true;
    this.credentialActionSuccess = null;
    this.credentialActionError = null;

    this.http
      .post<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/credentials/password/reset`,
        {},
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.resettingPassword = false;
          this.credentialActionSuccess = 'Password reset successfully. User will receive a notification.';
          this.loadCredentials();
        },
        error: (err) => {
          this.resettingPassword = false;
          this.credentialActionError =
            err.error?.message ?? 'Failed to reset password.';
        },
      });
  }

  revokeCredential(type: string): void {
    this.credentialActionSuccess = null;
    this.credentialActionError = null;

    this.http
      .delete<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/credentials/${type}`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.credentialActionSuccess = `Credential "${type}" revoked successfully.`;
          this.loadCredentials();
        },
        error: (err) => {
          this.credentialActionError =
            err.error?.message ?? `Failed to revoke credential "${type}".`;
        },
      });
  }

  revokeFidoKey(keyId: string): void {
    this.credentialActionSuccess = null;
    this.credentialActionError = null;

    this.http
      .delete<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/credentials/fido2/keys/${keyId}`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.credentialActionSuccess = 'FIDO2 security key revoked successfully.';
          this.loadCredentials();
        },
        error: (err) => {
          this.credentialActionError =
            err.error?.message ?? 'Failed to revoke FIDO2 key.';
        },
      });
  }

  forceEnroll(type: string): void {
    this.credentialActionSuccess = null;
    this.credentialActionError = null;

    this.http
      .post<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/credentials/${type}/force-enroll`,
        {},
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.credentialActionSuccess = `Force enrollment for "${type}" initiated. User will be prompted on next login.`;
          this.loadCredentials();
        },
        error: (err) => {
          this.credentialActionError =
            err.error?.message ?? `Failed to force enrollment for "${type}".`;
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Sessions Tab                                                       */
  /* ------------------------------------------------------------------ */
  private loadSessions(): void {
    this.sessionsLoading = true;

    this.http
      .get<ApiResponse<ActiveSession[]>>(
        `${this.API_BASE}/users/${this.userId}/sessions`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.activeSessions = (res.data ?? []).map((s) => ({
            ...s,
            ...this.parseUserAgent(s.userAgent),
          }));
          this.sessionsLoading = false;
        },
        error: () => {
          this.activeSessions = [];
          this.sessionsLoading = false;
        },
      });
  }

  private parseUserAgent(ua: string): { browser: string; os: string } {
    if (!ua) return { browser: 'Unknown', os: 'Unknown' };

    let browser = 'Unknown';
    let os = 'Unknown';

    // Simple UA parsing
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return { browser, os };
  }

  forceLogoutSession(sessionId: string): void {
    this.sessionActionSuccess = null;

    this.http
      .delete<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/sessions/${sessionId}`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sessionActionSuccess = 'Session terminated successfully.';
          this.loadSessions();
        },
        error: () => {},
      });
  }

  confirmRevokeAllSessions(): void {
    this.showRevokeAllSessionsDialog = true;
  }

  revokeAllSessions(): void {
    this.revokingAllSessions = true;
    this.sessionActionSuccess = null;

    this.http
      .post<ApiResponse<any>>(
        `${this.API_BASE}/users/${this.userId}/sessions/revoke-all`,
        {},
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.revokingAllSessions = false;
          this.showRevokeAllSessionsDialog = false;
          this.sessionActionSuccess = 'All sessions terminated successfully.';
          this.loadSessions();
        },
        error: () => {
          this.revokingAllSessions = false;
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Audit Tab                                                          */
  /* ------------------------------------------------------------------ */
  private initAuditDatasource(): void {
    this.auditDatasource = {
      getRows: (params: IServerSideGetRowsParams) => {
        const page = Math.floor(params.request.startRow! / 20);
        let httpParams = new HttpParams()
          .set('page', page.toString())
          .set('size', '20');

        if (this.auditFilterEventType) {
          httpParams = httpParams.set('eventType', this.auditFilterEventType);
        }
        if (this.auditFilterOutcome) {
          httpParams = httpParams.set('outcome', this.auditFilterOutcome);
        }
        if (this.auditFilterDateFrom) {
          httpParams = httpParams.set('dateFrom', this.auditFilterDateFrom);
        }
        if (this.auditFilterDateTo) {
          httpParams = httpParams.set('dateTo', this.auditFilterDateTo);
        }

        this.http
          .get<ApiResponse<{ content: AuditEvent[]; meta: PaginationMeta }>>(
            `${this.API_BASE}/users/${this.userId}/audit`,
            { params: httpParams },
          )
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              const content = (res.data as any)?.content ?? res.data ?? [];
              const totalRows = (res.data as any)?.meta?.totalElements ?? content.length;
              params.success({
                rowData: content,
                rowCount: totalRows,
              });
            },
            error: () => {
              params.fail();
            },
          });
      },
    };
  }

  onAuditGridReady(event: GridReadyEvent): void {
    this.auditGridApi = event.api;
  }

  reloadAuditGrid(): void {
    if (this.auditGridApi) {
      this.auditGridApi.refreshServerSide({ purge: true });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  IGA / Access Tab                                                   */
  /* ------------------------------------------------------------------ */
  private loadIgaData(): void {
    this.igaLoading = true;

    forkJoin({
      entitlements: this.http.get<ApiResponse<EffectiveEntitlement[]>>(
        `${this.API_BASE}/users/${this.userId}/entitlements`,
      ),
      certifications: this.http.get<ApiResponse<CertificationInfo>>(
        `${this.API_BASE}/users/${this.userId}/certifications`,
      ),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.effectiveEntitlements = res.entitlements.data ?? [];
          this.certificationInfo = res.certifications.data ?? null;
          this.igaLoading = false;
        },
        error: () => {
          this.effectiveEntitlements = [];
          this.certificationInfo = null;
          this.igaLoading = false;
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Utility Helpers                                                    */
  /* ------------------------------------------------------------------ */
  getInitials(): string {
    if (!this.user) return '?';
    const first = (this.user.firstName ?? '').charAt(0).toUpperCase();
    const last = (this.user.lastName ?? '').charAt(0).toUpperCase();
    return first + last || '?';
  }
}
