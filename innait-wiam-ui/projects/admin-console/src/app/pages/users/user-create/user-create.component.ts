import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

import { AuthService, ApiResponse, User, Role, Group } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { StepsModule } from 'primeng/steps';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { MenuItem } from 'primeng/api';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface PasswordStrength {
  score: number;       // 0-4
  label: string;
  color: string;
  percent: number;
}

interface RoleOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface GroupOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface AssignedItem {
  id: string;
  name: string;
  code: string;
  source: 'DIRECT' | 'MANAGER' | 'POLICY';
}

interface StepValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

interface UserCreatePayload {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
    designation: string;
    userType: string;
  };
  account: {
    loginId: string;
    passwordOption: string;
    password: string | null;
    mustChangePassword: boolean;
    accountStatus: string;
  };
  credentials: {
    password: boolean;
    totp: boolean;
    fido2: boolean;
    softToken: boolean;
  };
  roles: AssignedItem[];
  groups: AssignedItem[];
}

interface UserCreateResponse {
  userId: string;
  loginId: string;
  displayName: string;
}

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    StepsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    MultiSelectModule,
    CardModule,
    MessageModule,
    DialogModule,
    ProgressSpinnerModule,
    ProgressBarModule,
    TagModule,
    TranslatePipe,
  ],
  template: `
    <!-- ============================================================ -->
    <!-- Page Header                                                    -->
    <!-- ============================================================ -->
    <div class="user-create-page" role="main" aria-label="Create New User">
      <div class="page-header">
        <div class="header-left">
          <button
            pButton
            type="button"
            icon="pi pi-arrow-left"
            class="p-button-text p-button-sm"
            [routerLink]="['/users']"
            [attr.aria-label]="'Back to users list'"
          ></button>
          <h2>{{ 'users.create.title' | translate }}</h2>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Steps Indicator                                               -->
      <!-- ============================================================ -->
      <div class="steps-container" role="navigation" aria-label="Creation wizard steps">
        <p-steps
          [model]="wizardSteps"
          [activeIndex]="currentStep"
          [readonly]="false"
          (activeIndexChange)="onStepClick($event)"
          styleClass="wizard-steps"
        ></p-steps>
      </div>

      <!-- ============================================================ -->
      <!-- Step Content                                                  -->
      <!-- ============================================================ -->
      <div class="step-content-wrapper">

        <!-- ====== STEP 1: Profile ====== -->
        <div *ngIf="currentStep === 0" class="step-panel" role="tabpanel" aria-label="Profile step">
          <p-card header="Profile Information" styleClass="step-card">
            <form [formGroup]="profileForm" class="form-grid" autocomplete="off">
              <!-- First Name -->
              <div class="form-field">
                <label for="firstName" class="form-label">
                  {{ 'users.create.firstName' | translate }} <span class="required">*</span>
                </label>
                <input
                  id="firstName"
                  pInputText
                  formControlName="firstName"
                  placeholder="Enter first name"
                  [attr.aria-required]="true"
                  [attr.aria-invalid]="profileForm.get('firstName')?.invalid && profileForm.get('firstName')?.touched"
                  class="w-full"
                />
                <small
                  class="p-error"
                  *ngIf="profileForm.get('firstName')?.invalid && profileForm.get('firstName')?.touched"
                >
                  First name is required.
                </small>
              </div>

              <!-- Last Name -->
              <div class="form-field">
                <label for="lastName" class="form-label">
                  {{ 'users.create.lastName' | translate }} <span class="required">*</span>
                </label>
                <input
                  id="lastName"
                  pInputText
                  formControlName="lastName"
                  placeholder="Enter last name"
                  [attr.aria-required]="true"
                  [attr.aria-invalid]="profileForm.get('lastName')?.invalid && profileForm.get('lastName')?.touched"
                  class="w-full"
                />
                <small
                  class="p-error"
                  *ngIf="profileForm.get('lastName')?.invalid && profileForm.get('lastName')?.touched"
                >
                  Last name is required.
                </small>
              </div>

              <!-- Email -->
              <div class="form-field form-field-full">
                <label for="email" class="form-label">
                  {{ 'users.create.email' | translate }} <span class="required">*</span>
                </label>
                <input
                  id="email"
                  pInputText
                  formControlName="email"
                  placeholder="user@company.com"
                  type="email"
                  [attr.aria-required]="true"
                  [attr.aria-invalid]="profileForm.get('email')?.invalid && profileForm.get('email')?.touched"
                  class="w-full"
                />
                <small
                  class="p-error"
                  *ngIf="profileForm.get('email')?.hasError('required') && profileForm.get('email')?.touched"
                >
                  Email is required.
                </small>
                <small
                  class="p-error"
                  *ngIf="profileForm.get('email')?.hasError('email') && profileForm.get('email')?.touched"
                >
                  Please enter a valid email address.
                </small>
              </div>

              <!-- Department -->
              <div class="form-field">
                <label for="department" class="form-label">
                  {{ 'users.create.department' | translate }}
                </label>
                <p-dropdown
                  id="department"
                  formControlName="department"
                  [options]="departments"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Select department"
                  [showClear]="true"
                  [filter]="true"
                  filterPlaceholder="Search departments"
                  styleClass="w-full"
                  aria-label="Department"
                ></p-dropdown>
              </div>

              <!-- Designation -->
              <div class="form-field">
                <label for="designation" class="form-label">
                  {{ 'users.create.designation' | translate }}
                </label>
                <input
                  id="designation"
                  pInputText
                  formControlName="designation"
                  placeholder="Enter designation / job title"
                  class="w-full"
                />
              </div>

              <!-- User Type -->
              <div class="form-field">
                <label for="userType" class="form-label">
                  {{ 'users.create.userType' | translate }} <span class="required">*</span>
                </label>
                <p-dropdown
                  id="userType"
                  formControlName="userType"
                  [options]="userTypes"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Select user type"
                  styleClass="w-full"
                  aria-label="User type"
                ></p-dropdown>
              </div>
            </form>
          </p-card>
        </div>

        <!-- ====== STEP 2: Account ====== -->
        <div *ngIf="currentStep === 1" class="step-panel" role="tabpanel" aria-label="Account step">
          <p-card header="Account Settings" styleClass="step-card">
            <form [formGroup]="accountForm" class="form-grid" autocomplete="off">
              <!-- Login ID -->
              <div class="form-field form-field-full">
                <label for="loginId" class="form-label">
                  {{ 'users.create.loginId' | translate }} <span class="required">*</span>
                </label>
                <div class="login-id-row">
                  <input
                    id="loginId"
                    pInputText
                    formControlName="loginId"
                    placeholder="Login ID"
                    [attr.aria-required]="true"
                    class="w-full"
                  />
                  <button
                    pButton
                    type="button"
                    icon="pi pi-sync"
                    class="p-button-outlined p-button-sm"
                    (click)="regenerateLoginId()"
                    [attr.aria-label]="'Re-generate login ID from email'"
                    pTooltip="Re-generate from email"
                  ></button>
                </div>
                <small class="hint-text">Auto-generated from email. You may edit if needed.</small>
              </div>

              <!-- Password Option -->
              <div class="form-field form-field-full">
                <label class="form-label">{{ 'users.create.passwordOption' | translate }}</label>
                <div class="radio-group" role="radiogroup" aria-label="Password option">
                  <div class="radio-item">
                    <input
                      type="radio"
                      id="pwdAutoGenerate"
                      formControlName="passwordOption"
                      value="AUTO_GENERATE"
                    />
                    <label for="pwdAutoGenerate">Auto-generate and email to user</label>
                  </div>
                  <div class="radio-item">
                    <input
                      type="radio"
                      id="pwdManual"
                      formControlName="passwordOption"
                      value="MANUAL"
                    />
                    <label for="pwdManual">Set password manually</label>
                  </div>
                </div>
              </div>

              <!-- Manual Password -->
              <div
                *ngIf="accountForm.get('passwordOption')?.value === 'MANUAL'"
                class="form-field form-field-full"
              >
                <label for="password" class="form-label">
                  {{ 'users.create.password' | translate }} <span class="required">*</span>
                </label>
                <input
                  id="password"
                  pInputText
                  type="password"
                  formControlName="password"
                  placeholder="Enter password"
                  [attr.aria-required]="true"
                  class="w-full"
                />
                <!-- Strength Meter -->
                <div class="password-strength" *ngIf="accountForm.get('password')?.value">
                  <p-progressBar
                    [value]="passwordStrength.percent"
                    [style]="{ height: '6px' }"
                    [showValue]="false"
                    [ngStyle]="{ '--progressbar-color': passwordStrength.color }"
                  ></p-progressBar>
                  <small [style.color]="passwordStrength.color">{{ passwordStrength.label }}</small>
                </div>
                <small
                  class="p-error"
                  *ngIf="accountForm.get('password')?.hasError('required') && accountForm.get('password')?.touched"
                >
                  Password is required when setting manually.
                </small>
                <small
                  class="p-error"
                  *ngIf="accountForm.get('password')?.hasError('minlength') && accountForm.get('password')?.touched"
                >
                  Password must be at least 12 characters.
                </small>
              </div>

              <!-- Must Change Password -->
              <div class="form-field form-field-full">
                <div class="checkbox-row">
                  <input
                    type="checkbox"
                    id="mustChangePassword"
                    formControlName="mustChangePassword"
                  />
                  <label for="mustChangePassword">
                    {{ 'users.create.mustChangePassword' | translate }}
                  </label>
                </div>
              </div>

              <!-- Account Status -->
              <div class="form-field">
                <label for="accountStatus" class="form-label">
                  {{ 'users.create.accountStatus' | translate }}
                </label>
                <p-dropdown
                  id="accountStatus"
                  formControlName="accountStatus"
                  [options]="accountStatuses"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full"
                  aria-label="Initial account status"
                ></p-dropdown>
              </div>
            </form>
          </p-card>
        </div>

        <!-- ====== STEP 3: Credentials ====== -->
        <div *ngIf="currentStep === 2" class="step-panel" role="tabpanel" aria-label="Credentials step">
          <p-card header="Credential Types" styleClass="step-card">
            <p class="step-description">
              Select which credential types to enable for this user. Enabled types will be
              available for enrollment.
            </p>
            <form [formGroup]="credentialsForm" class="credentials-list">
              <!-- Password (always on) -->
              <div class="credential-item credential-locked" role="group" aria-label="Password credential">
                <div class="credential-left">
                  <div class="credential-icon">
                    <i class="pi pi-lock"></i>
                  </div>
                  <div class="credential-info">
                    <span class="credential-name">Password</span>
                    <span class="credential-desc">Standard password authentication</span>
                  </div>
                </div>
                <div class="credential-right">
                  <p-tag value="Always Enabled" severity="info"></p-tag>
                </div>
              </div>

              <!-- TOTP -->
              <div class="credential-item" role="group" aria-label="TOTP credential">
                <div class="credential-left">
                  <div class="credential-icon">
                    <i class="pi pi-mobile"></i>
                  </div>
                  <div class="credential-info">
                    <span class="credential-name">TOTP Authenticator</span>
                    <span class="credential-desc">
                      Time-based one-time password via authenticator app (e.g. Google Authenticator)
                    </span>
                  </div>
                </div>
                <div class="credential-right">
                  <label class="toggle-switch" for="totp">
                    <input type="checkbox" id="totp" formControlName="totp" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <!-- FIDO2 -->
              <div class="credential-item" role="group" aria-label="FIDO2 credential">
                <div class="credential-left">
                  <div class="credential-icon">
                    <i class="pi pi-key"></i>
                  </div>
                  <div class="credential-info">
                    <span class="credential-name">FIDO2 Security Key</span>
                    <span class="credential-desc">
                      Hardware security key or platform authenticator (e.g. YubiKey, Windows Hello)
                    </span>
                  </div>
                </div>
                <div class="credential-right">
                  <label class="toggle-switch" for="fido2">
                    <input type="checkbox" id="fido2" formControlName="fido2" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <!-- Soft Token -->
              <div class="credential-item" role="group" aria-label="Soft Token credential">
                <div class="credential-left">
                  <div class="credential-icon">
                    <i class="pi pi-shield"></i>
                  </div>
                  <div class="credential-info">
                    <span class="credential-name">Soft Token</span>
                    <span class="credential-desc">
                      Software-based token for push notifications or OTP generation
                    </span>
                  </div>
                </div>
                <div class="credential-right">
                  <label class="toggle-switch" for="softToken">
                    <input type="checkbox" id="softToken" formControlName="softToken" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </form>

            <!-- Enrollment Note -->
            <div
              *ngIf="credentialsForm.get('totp')?.value || credentialsForm.get('fido2')?.value"
              class="enrollment-note"
              role="note"
            >
              <i class="pi pi-info-circle"></i>
              <span>User will be prompted to enroll enabled credential types during first login.</span>
            </div>
          </p-card>
        </div>

        <!-- ====== STEP 4: Roles & Groups ====== -->
        <div *ngIf="currentStep === 3" class="step-panel" role="tabpanel" aria-label="Roles and Groups step">
          <!-- Roles Section -->
          <p-card header="Assign Roles" styleClass="step-card">
            <div class="assignment-section">
              <div class="assignment-controls">
                <p-multiSelect
                  [options]="availableRoles"
                  [(ngModel)]="selectedRoleIds"
                  [ngModelOptions]="{ standalone: true }"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Search and select roles"
                  [filter]="true"
                  filterPlaceholder="Search roles..."
                  [maxSelectedLabels]="2"
                  [showClear]="true"
                  styleClass="w-full"
                  (onChange)="onRolesSelected($event)"
                  aria-label="Select roles"
                ></p-multiSelect>
              </div>

              <!-- Assigned Roles Chips -->
              <div class="assigned-items" *ngIf="assignedRoles.length > 0">
                <div
                  *ngFor="let role of assignedRoles; let i = index"
                  class="assigned-chip"
                  role="listitem"
                >
                  <div class="chip-info">
                    <span class="chip-name">{{ role.name }}</span>
                    <span class="chip-code">{{ role.code }}</span>
                  </div>
                  <div class="chip-source">
                    <p-dropdown
                      [options]="assignmentSources"
                      [(ngModel)]="role.source"
                      [ngModelOptions]="{ standalone: true }"
                      optionLabel="label"
                      optionValue="value"
                      [style]="{ width: '130px' }"
                      [attr.aria-label]="'Assignment source for role ' + role.name"
                    ></p-dropdown>
                  </div>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-times"
                    class="p-button-text p-button-danger p-button-sm"
                    (click)="removeRole(i)"
                    [attr.aria-label]="'Remove role ' + role.name"
                  ></button>
                </div>
              </div>
              <div *ngIf="assignedRoles.length === 0" class="empty-assignment">
                <i class="pi pi-info-circle"></i>
                <span>No roles assigned. Use the dropdown above to select roles.</span>
              </div>
            </div>
          </p-card>

          <!-- Groups Section -->
          <p-card header="Assign Groups" styleClass="step-card mt-3">
            <div class="assignment-section">
              <div class="assignment-controls">
                <p-multiSelect
                  [options]="availableGroups"
                  [(ngModel)]="selectedGroupIds"
                  [ngModelOptions]="{ standalone: true }"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Search and select groups"
                  [filter]="true"
                  filterPlaceholder="Search groups..."
                  [maxSelectedLabels]="2"
                  [showClear]="true"
                  styleClass="w-full"
                  (onChange)="onGroupsSelected($event)"
                  aria-label="Select groups"
                ></p-multiSelect>
              </div>

              <!-- Assigned Groups Chips -->
              <div class="assigned-items" *ngIf="assignedGroups.length > 0">
                <div
                  *ngFor="let group of assignedGroups; let i = index"
                  class="assigned-chip"
                  role="listitem"
                >
                  <div class="chip-info">
                    <span class="chip-name">{{ group.name }}</span>
                    <span class="chip-code">{{ group.code }}</span>
                  </div>
                  <div class="chip-source">
                    <p-dropdown
                      [options]="assignmentSources"
                      [(ngModel)]="group.source"
                      [ngModelOptions]="{ standalone: true }"
                      optionLabel="label"
                      optionValue="value"
                      [style]="{ width: '130px' }"
                      [attr.aria-label]="'Assignment source for group ' + group.name"
                    ></p-dropdown>
                  </div>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-times"
                    class="p-button-text p-button-danger p-button-sm"
                    (click)="removeGroup(i)"
                    [attr.aria-label]="'Remove group ' + group.name"
                  ></button>
                </div>
              </div>
              <div *ngIf="assignedGroups.length === 0" class="empty-assignment">
                <i class="pi pi-info-circle"></i>
                <span>No groups assigned. Use the dropdown above to select groups.</span>
              </div>
            </div>
          </p-card>
        </div>

        <!-- ====== STEP 5: Review & Submit ====== -->
        <div *ngIf="currentStep === 4" class="step-panel" role="tabpanel" aria-label="Review and submit step">

          <!-- Success State -->
          <div *ngIf="submitSuccess" class="success-panel">
            <div class="success-icon">
              <i class="pi pi-check-circle"></i>
            </div>
            <h3>User Created Successfully</h3>
            <p>
              User <strong>{{ createdUser?.displayName }}</strong> has been created with ID
              <code>{{ createdUser?.userId }}</code>.
            </p>
            <div class="success-actions">
              <button
                pButton
                type="button"
                label="View User"
                icon="pi pi-eye"
                class="p-button-outlined"
                (click)="viewCreatedUser()"
                aria-label="View the newly created user"
              ></button>
              <button
                pButton
                type="button"
                label="Create Another"
                icon="pi pi-plus"
                (click)="resetWizard()"
                aria-label="Create another user"
              ></button>
            </div>
          </div>

          <!-- Review State -->
          <div *ngIf="!submitSuccess">
            <!-- Error message -->
            <p-message
              *ngIf="submitError"
              severity="error"
              [text]="submitError"
              styleClass="mb-3 w-full"
            ></p-message>

            <!-- Profile Summary -->
            <p-card styleClass="step-card review-card">
              <ng-template pTemplate="header">
                <div class="review-header">
                  <h4>Profile</h4>
                  <button
                    pButton
                    type="button"
                    label="Edit"
                    icon="pi pi-pencil"
                    class="p-button-text p-button-sm"
                    (click)="goToStep(0)"
                    aria-label="Edit profile information"
                  ></button>
                </div>
              </ng-template>
              <div class="review-grid">
                <div class="review-item">
                  <span class="review-label">First Name</span>
                  <span class="review-value">{{ profileForm.get('firstName')?.value }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Last Name</span>
                  <span class="review-value">{{ profileForm.get('lastName')?.value }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Email</span>
                  <span class="review-value">{{ profileForm.get('email')?.value }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Department</span>
                  <span class="review-value">{{ getDepartmentName(profileForm.get('department')?.value) }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Designation</span>
                  <span class="review-value">{{ profileForm.get('designation')?.value || '—' }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">User Type</span>
                  <span class="review-value">
                    <p-tag [value]="profileForm.get('userType')?.value" severity="info"></p-tag>
                  </span>
                </div>
              </div>
            </p-card>

            <!-- Account Summary -->
            <p-card styleClass="step-card review-card mt-3">
              <ng-template pTemplate="header">
                <div class="review-header">
                  <h4>Account</h4>
                  <button
                    pButton
                    type="button"
                    label="Edit"
                    icon="pi pi-pencil"
                    class="p-button-text p-button-sm"
                    (click)="goToStep(1)"
                    aria-label="Edit account settings"
                  ></button>
                </div>
              </ng-template>
              <div class="review-grid">
                <div class="review-item">
                  <span class="review-label">Login ID</span>
                  <span class="review-value">{{ accountForm.get('loginId')?.value }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Password</span>
                  <span class="review-value">
                    {{ accountForm.get('passwordOption')?.value === 'AUTO_GENERATE'
                      ? 'Auto-generated (emailed to user)'
                      : 'Manually set' }}
                  </span>
                </div>
                <div class="review-item">
                  <span class="review-label">Must Change Password</span>
                  <span class="review-value">{{ accountForm.get('mustChangePassword')?.value ? 'Yes' : 'No' }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Account Status</span>
                  <span class="review-value">
                    <p-tag
                      [value]="accountForm.get('accountStatus')?.value"
                      [severity]="accountForm.get('accountStatus')?.value === 'ACTIVE' ? 'success' : 'warning'"
                    ></p-tag>
                  </span>
                </div>
              </div>
            </p-card>

            <!-- Credentials Summary -->
            <p-card styleClass="step-card review-card mt-3">
              <ng-template pTemplate="header">
                <div class="review-header">
                  <h4>Credentials</h4>
                  <button
                    pButton
                    type="button"
                    label="Edit"
                    icon="pi pi-pencil"
                    class="p-button-text p-button-sm"
                    (click)="goToStep(2)"
                    aria-label="Edit credential settings"
                  ></button>
                </div>
              </ng-template>
              <div class="review-tags">
                <p-tag value="Password" severity="info" icon="pi pi-lock"></p-tag>
                <p-tag
                  *ngIf="credentialsForm.get('totp')?.value"
                  value="TOTP Authenticator"
                  severity="success"
                  icon="pi pi-mobile"
                ></p-tag>
                <p-tag
                  *ngIf="credentialsForm.get('fido2')?.value"
                  value="FIDO2 Security Key"
                  severity="success"
                  icon="pi pi-key"
                ></p-tag>
                <p-tag
                  *ngIf="credentialsForm.get('softToken')?.value"
                  value="Soft Token"
                  severity="success"
                  icon="pi pi-shield"
                ></p-tag>
              </div>
            </p-card>

            <!-- Roles & Groups Summary -->
            <p-card styleClass="step-card review-card mt-3">
              <ng-template pTemplate="header">
                <div class="review-header">
                  <h4>Roles &amp; Groups</h4>
                  <button
                    pButton
                    type="button"
                    label="Edit"
                    icon="pi pi-pencil"
                    class="p-button-text p-button-sm"
                    (click)="goToStep(3)"
                    aria-label="Edit roles and groups"
                  ></button>
                </div>
              </ng-template>
              <div class="review-assignments">
                <div class="review-subsection">
                  <h5>Roles ({{ assignedRoles.length }})</h5>
                  <div *ngIf="assignedRoles.length === 0" class="review-empty">No roles assigned</div>
                  <div *ngFor="let role of assignedRoles" class="review-assignment-item">
                    <span>{{ role.name }} <small>({{ role.code }})</small></span>
                    <p-tag [value]="role.source" [severity]="role.source === 'DIRECT' ? 'info' : 'warning'" class="ml-2"></p-tag>
                  </div>
                </div>
                <div class="review-subsection mt-2">
                  <h5>Groups ({{ assignedGroups.length }})</h5>
                  <div *ngIf="assignedGroups.length === 0" class="review-empty">No groups assigned</div>
                  <div *ngFor="let group of assignedGroups" class="review-assignment-item">
                    <span>{{ group.name }} <small>({{ group.code }})</small></span>
                    <p-tag [value]="group.source" [severity]="group.source === 'DIRECT' ? 'info' : 'warning'" class="ml-2"></p-tag>
                  </div>
                </div>
              </div>
            </p-card>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- Step Validation Errors                                        -->
        <!-- ============================================================ -->
        <p-message
          *ngIf="stepValidationError"
          severity="warn"
          [text]="stepValidationError"
          styleClass="mt-2 w-full"
        ></p-message>

        <!-- ============================================================ -->
        <!-- Navigation Buttons                                            -->
        <!-- ============================================================ -->
        <div class="wizard-nav" *ngIf="!submitSuccess" role="navigation" aria-label="Wizard navigation">
          <div class="nav-left">
            <button
              pButton
              type="button"
              label="Cancel"
              icon="pi pi-times"
              class="p-button-text"
              (click)="onCancel()"
              aria-label="Cancel user creation"
            ></button>
          </div>
          <div class="nav-right">
            <button
              *ngIf="currentStep > 0"
              pButton
              type="button"
              label="Back"
              icon="pi pi-arrow-left"
              class="p-button-outlined"
              (click)="prevStep()"
              [disabled]="validatingStep"
              aria-label="Go to previous step"
            ></button>
            <button
              *ngIf="currentStep < 4"
              pButton
              type="button"
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              (click)="nextStep()"
              [disabled]="validatingStep"
              [loading]="validatingStep"
              aria-label="Go to next step"
            ></button>
            <button
              *ngIf="currentStep === 4"
              pButton
              type="button"
              label="Submit"
              icon="pi pi-check"
              class="p-button-success"
              (click)="submitUser()"
              [disabled]="submitting"
              [loading]="submitting"
              aria-label="Submit and create user"
            ></button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Cancel Confirmation Dialog                                     -->
      <!-- ============================================================ -->
      <p-dialog
        header="Discard Changes?"
        [(visible)]="showCancelDialog"
        [modal]="true"
        [style]="{ width: '420px' }"
        aria-label="Cancel confirmation dialog"
      >
        <p>You have unsaved changes. Are you sure you want to discard them and leave this page?</p>
        <ng-template pTemplate="footer">
          <button
            pButton
            type="button"
            label="Keep Editing"
            class="p-button-text"
            (click)="showCancelDialog = false"
          ></button>
          <button
            pButton
            type="button"
            label="Discard"
            class="p-button-danger"
            (click)="confirmCancel()"
          ></button>
        </ng-template>
      </p-dialog>

      <!-- ============================================================ -->
      <!-- Loading Overlay                                                -->
      <!-- ============================================================ -->
      <div *ngIf="submitting" class="loading-overlay" role="alert" aria-label="Creating user">
        <p-progressSpinner
          [style]="{ width: '60px', height: '60px' }"
          strokeWidth="4"
        ></p-progressSpinner>
        <p>Creating user account...</p>
      </div>
    </div>
  `,
  styles: [`
    /* ---------------------------------------------------------------- */
    /* Page Layout                                                       */
    /* ---------------------------------------------------------------- */
    .user-create-page {
      padding: 1.5rem;
      max-width: 900px;
      margin: 0 auto;
      position: relative;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .header-left h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color, #1e293b);
    }

    /* ---------------------------------------------------------------- */
    /* Steps                                                             */
    /* ---------------------------------------------------------------- */
    .steps-container {
      margin-bottom: 2rem;
    }

    :host ::ng-deep .wizard-steps .p-steps-item {
      flex: 1;
    }

    /* ---------------------------------------------------------------- */
    /* Step Content                                                      */
    /* ---------------------------------------------------------------- */
    .step-content-wrapper {
      min-height: 400px;
    }

    :host ::ng-deep .step-card .p-card-body {
      padding: 1.5rem;
    }

    .step-description {
      color: var(--text-color-secondary, #64748b);
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }

    /* ---------------------------------------------------------------- */
    /* Form Layout                                                       */
    /* ---------------------------------------------------------------- */
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

    .form-field-full {
      grid-column: 1 / -1;
    }

    .form-label {
      font-weight: 500;
      font-size: 0.875rem;
      color: var(--text-color, #1e293b);
    }

    .required {
      color: var(--red-500, #ef4444);
    }

    .hint-text {
      color: var(--text-color-secondary, #64748b);
      font-size: 0.8rem;
    }

    .w-full {
      width: 100%;
    }

    .p-error {
      color: var(--red-500, #ef4444);
      font-size: 0.8rem;
    }

    /* ---------------------------------------------------------------- */
    /* Login ID                                                          */
    /* ---------------------------------------------------------------- */
    .login-id-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .login-id-row input {
      flex: 1;
    }

    /* ---------------------------------------------------------------- */
    /* Radio & Checkbox                                                  */
    /* ---------------------------------------------------------------- */
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .radio-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .radio-item input[type='radio'] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .radio-item label {
      cursor: pointer;
      font-size: 0.9rem;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .checkbox-row input[type='checkbox'] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .checkbox-row label {
      cursor: pointer;
      font-size: 0.9rem;
    }

    /* ---------------------------------------------------------------- */
    /* Password Strength                                                 */
    /* ---------------------------------------------------------------- */
    .password-strength {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-top: 0.25rem;
    }

    .password-strength small {
      font-size: 0.8rem;
      font-weight: 500;
    }

    /* ---------------------------------------------------------------- */
    /* Credentials                                                       */
    /* ---------------------------------------------------------------- */
    .credentials-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .credential-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 8px;
      background: var(--surface-card, #ffffff);
      transition: border-color 0.2s;
    }

    .credential-item:hover {
      border-color: var(--primary-color, #3b82f6);
    }

    .credential-locked {
      background: var(--surface-100, #f1f5f9);
      opacity: 0.8;
    }

    .credential-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .credential-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--primary-100, #dbeafe);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .credential-icon i {
      font-size: 1.1rem;
      color: var(--primary-color, #3b82f6);
    }

    .credential-info {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .credential-name {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-color, #1e293b);
    }

    .credential-desc {
      font-size: 0.8rem;
      color: var(--text-color-secondary, #64748b);
    }

    /* Toggle Switch */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 26px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--surface-400, #94a3b8);
      transition: 0.3s;
      border-radius: 26px;
    }

    .toggle-slider::before {
      position: absolute;
      content: '';
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }

    .toggle-switch input:checked + .toggle-slider {
      background-color: var(--primary-color, #3b82f6);
    }

    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(22px);
    }

    .toggle-switch input:focus + .toggle-slider {
      box-shadow: 0 0 0 3px var(--primary-200, #bfdbfe);
    }

    .enrollment-note {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.875rem 1rem;
      margin-top: 1rem;
      background: var(--blue-50, #eff6ff);
      border-left: 3px solid var(--blue-400, #60a5fa);
      border-radius: 4px;
      font-size: 0.875rem;
      color: var(--blue-800, #1e40af);
    }

    .enrollment-note i {
      margin-top: 2px;
    }

    /* ---------------------------------------------------------------- */
    /* Roles & Groups Assignments                                        */
    /* ---------------------------------------------------------------- */
    .assignment-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .assignment-controls {
      max-width: 100%;
    }

    .assigned-items {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .assigned-chip {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 6px;
      background: var(--surface-50, #f8fafc);
    }

    .chip-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .chip-name {
      font-weight: 500;
      font-size: 0.9rem;
    }

    .chip-code {
      font-size: 0.775rem;
      color: var(--text-color-secondary, #64748b);
    }

    .chip-source {
      flex-shrink: 0;
    }

    .empty-assignment {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      color: var(--text-color-secondary, #64748b);
      font-size: 0.875rem;
      border: 1px dashed var(--surface-border, #e2e8f0);
      border-radius: 6px;
      justify-content: center;
    }

    /* ---------------------------------------------------------------- */
    /* Review                                                            */
    /* ---------------------------------------------------------------- */
    .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem 0;
    }

    .review-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .review-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .review-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .review-label {
      font-size: 0.8rem;
      color: var(--text-color-secondary, #64748b);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .review-value {
      font-size: 0.95rem;
      color: var(--text-color, #1e293b);
    }

    .review-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .review-assignments {
      display: flex;
      flex-direction: column;
    }

    .review-subsection h5 {
      margin: 0 0 0.5rem 0;
      font-size: 0.875rem;
      color: var(--text-color-secondary, #64748b);
    }

    .review-assignment-item {
      display: flex;
      align-items: center;
      padding: 0.375rem 0;
      font-size: 0.9rem;
    }

    .review-assignment-item small {
      color: var(--text-color-secondary, #64748b);
    }

    .review-empty {
      color: var(--text-color-secondary, #64748b);
      font-size: 0.875rem;
      font-style: italic;
    }

    /* ---------------------------------------------------------------- */
    /* Success Panel                                                     */
    /* ---------------------------------------------------------------- */
    .success-panel {
      text-align: center;
      padding: 3rem 2rem;
    }

    .success-icon {
      margin-bottom: 1rem;
    }

    .success-icon i {
      font-size: 4rem;
      color: var(--green-500, #22c55e);
    }

    .success-panel h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      color: var(--text-color, #1e293b);
    }

    .success-panel p {
      color: var(--text-color-secondary, #64748b);
      margin-bottom: 2rem;
    }

    .success-panel code {
      background: var(--surface-100, #f1f5f9);
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }

    .success-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    /* ---------------------------------------------------------------- */
    /* Navigation                                                        */
    /* ---------------------------------------------------------------- */
    .wizard-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--surface-border, #e2e8f0);
    }

    .nav-right {
      display: flex;
      gap: 0.5rem;
    }

    /* ---------------------------------------------------------------- */
    /* Loading Overlay                                                   */
    /* ---------------------------------------------------------------- */
    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      z-index: 100;
      border-radius: 8px;
    }

    .loading-overlay p {
      font-size: 0.95rem;
      color: var(--text-color-secondary, #64748b);
    }

    /* ---------------------------------------------------------------- */
    /* Utilities                                                         */
    /* ---------------------------------------------------------------- */
    .mt-2 { margin-top: 0.5rem; }
    .mt-3 { margin-top: 1rem; }
    .mb-3 { margin-bottom: 1rem; }
    .ml-2 { margin-left: 0.5rem; }

    /* ---------------------------------------------------------------- */
    /* Responsive                                                        */
    /* ---------------------------------------------------------------- */
    @media (max-width: 768px) {
      .form-grid {
        grid-template-columns: 1fr;
      }

      .review-grid {
        grid-template-columns: 1fr;
      }

      .success-actions {
        flex-direction: column;
      }
    }
  `],
})
export class UserCreateComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/admin';

  /* ------------------------------------------------------------------ */
  /*  Wizard State                                                       */
  /* ------------------------------------------------------------------ */
  wizardSteps: MenuItem[] = [
    { label: 'Profile' },
    { label: 'Account' },
    { label: 'Credentials' },
    { label: 'Roles & Groups' },
    { label: 'Review' },
  ];

  currentStep = 0;
  highestCompletedStep = -1;
  validatingStep = false;
  stepValidationError: string | null = null;

  /* ------------------------------------------------------------------ */
  /*  Forms                                                              */
  /* ------------------------------------------------------------------ */
  profileForm!: FormGroup;
  accountForm!: FormGroup;
  credentialsForm!: FormGroup;

  /* ------------------------------------------------------------------ */
  /*  Dropdown Options                                                   */
  /* ------------------------------------------------------------------ */
  departments: DepartmentOption[] = [];

  userTypes = [
    { label: 'Employee', value: 'EMPLOYEE' },
    { label: 'Contractor', value: 'CONTRACTOR' },
    { label: 'Vendor', value: 'VENDOR' },
    { label: 'Service Account', value: 'SERVICE' },
  ];

  accountStatuses = [
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Pending Activation', value: 'PENDING_ACTIVATION' },
  ];

  assignmentSources = [
    { label: 'Direct', value: 'DIRECT' },
    { label: 'Manager', value: 'MANAGER' },
    { label: 'Policy', value: 'POLICY' },
  ];

  /* ------------------------------------------------------------------ */
  /*  Roles & Groups                                                     */
  /* ------------------------------------------------------------------ */
  availableRoles: RoleOption[] = [];
  availableGroups: GroupOption[] = [];
  selectedRoleIds: string[] = [];
  selectedGroupIds: string[] = [];
  assignedRoles: AssignedItem[] = [];
  assignedGroups: AssignedItem[] = [];

  /* ------------------------------------------------------------------ */
  /*  Password                                                           */
  /* ------------------------------------------------------------------ */
  passwordStrength: PasswordStrength = {
    score: 0,
    label: '',
    color: '',
    percent: 0,
  };

  /* ------------------------------------------------------------------ */
  /*  Submission                                                         */
  /* ------------------------------------------------------------------ */
  submitting = false;
  submitSuccess = false;
  submitError: string | null = null;
  createdUser: UserCreateResponse | null = null;

  /* ------------------------------------------------------------------ */
  /*  Cancel Dialog                                                      */
  /* ------------------------------------------------------------------ */
  showCancelDialog = false;

  /* ------------------------------------------------------------------ */
  /*  Constructor                                                        */
  /* ------------------------------------------------------------------ */
  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */
  ngOnInit(): void {
    this.initForms();
    this.loadDepartments();
    this.loadRoles();
    this.loadGroups();
    this.watchEmailForLoginId();
    this.watchPasswordForStrength();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Guard against accidental browser navigation when form is dirty.
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isFormDirty() && !this.submitSuccess) {
      event.preventDefault();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Form Initialization                                                */
  /* ------------------------------------------------------------------ */
  private initForms(): void {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      department: [null],
      designation: [''],
      userType: ['EMPLOYEE', Validators.required],
    });

    this.accountForm = this.fb.group({
      loginId: ['', [Validators.required, Validators.maxLength(128)]],
      passwordOption: ['AUTO_GENERATE'],
      password: [''],
      mustChangePassword: [true],
      accountStatus: ['ACTIVE'],
    });

    this.credentialsForm = this.fb.group({
      password: [{ value: true, disabled: true }],
      totp: [false],
      fido2: [false],
      softToken: [false],
    });

    // Dynamically require password when manual option is selected
    this.accountForm.get('passwordOption')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((option: string) => {
        const pwdControl = this.accountForm.get('password')!;
        if (option === 'MANUAL') {
          pwdControl.setValidators([Validators.required, Validators.minLength(12)]);
        } else {
          pwdControl.clearValidators();
          pwdControl.setValue('');
        }
        pwdControl.updateValueAndValidity();
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Watchers                                                           */
  /* ------------------------------------------------------------------ */
  private watchEmailForLoginId(): void {
    this.profileForm.get('email')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((email: string) => {
        if (email && email.includes('@') && !this.accountForm.get('loginId')!.dirty) {
          const loginId = email.split('@')[0];
          this.accountForm.get('loginId')!.setValue(loginId, { emitEvent: false });
        }
      });
  }

  private watchPasswordForStrength(): void {
    this.accountForm.get('password')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((pwd: string) => {
        this.passwordStrength = this.calculatePasswordStrength(pwd);
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */
  private loadDepartments(): void {
    this.http
      .get<ApiResponse<DepartmentOption[]>>(`${this.API_BASE}/departments`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.departments = res.data ?? [];
        },
        error: () => {
          this.departments = [];
        },
      });
  }

  private loadRoles(): void {
    this.http
      .get<ApiResponse<Role[]>>(`${this.API_BASE}/roles`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.availableRoles = (res.data ?? []).map((r: any) => ({
            id: r.id ?? r.roleId,
            name: r.roleName ?? r.name,
            code: r.roleCode ?? r.code,
            type: r.roleType ?? r.type ?? '',
          }));
        },
        error: () => {
          this.availableRoles = [];
        },
      });
  }

  private loadGroups(): void {
    this.http
      .get<ApiResponse<Group[]>>(`${this.API_BASE}/groups`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.availableGroups = (res.data ?? []).map((g: any) => ({
            id: g.id ?? g.groupId,
            name: g.groupName ?? g.name,
            code: g.groupCode ?? g.code,
            type: g.groupType ?? g.type ?? '',
          }));
        },
        error: () => {
          this.availableGroups = [];
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Step Navigation                                                    */
  /* ------------------------------------------------------------------ */
  onStepClick(index: number): void {
    // Only allow clicking on completed steps or current step
    if (index <= this.highestCompletedStep + 1 && index <= this.currentStep) {
      this.currentStep = index;
      this.stepValidationError = null;
    }
  }

  goToStep(step: number): void {
    this.currentStep = step;
    this.stepValidationError = null;
  }

  nextStep(): void {
    this.stepValidationError = null;

    // Client-side validation
    if (!this.validateCurrentStep()) {
      return;
    }

    // Server-side validation
    this.validatingStep = true;
    const stepData = this.getStepData(this.currentStep);

    this.http
      .post<ApiResponse<StepValidationResult>>(
        `${this.API_BASE}/users/validate-step`,
        { step: this.currentStep, data: stepData },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.validatingStep = false;
          if (res.data?.valid === false) {
            const errors = res.data.errors;
            const firstError = Object.values(errors)[0];
            this.stepValidationError = firstError ?? 'Validation failed. Please check your input.';
          } else {
            if (this.currentStep > this.highestCompletedStep) {
              this.highestCompletedStep = this.currentStep;
            }
            this.currentStep++;
          }
        },
        error: (err) => {
          this.validatingStep = false;
          // If server validation is unavailable, still allow navigation on client-valid data
          if (this.currentStep > this.highestCompletedStep) {
            this.highestCompletedStep = this.currentStep;
          }
          this.currentStep++;
        },
      });
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.stepValidationError = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Client-side Validation                                             */
  /* ------------------------------------------------------------------ */
  private validateCurrentStep(): boolean {
    switch (this.currentStep) {
      case 0: {
        this.profileForm.markAllAsTouched();
        if (this.profileForm.invalid) {
          this.stepValidationError = 'Please fill in all required profile fields.';
          return false;
        }
        return true;
      }
      case 1: {
        this.accountForm.markAllAsTouched();
        if (this.accountForm.invalid) {
          this.stepValidationError = 'Please fill in all required account fields.';
          return false;
        }
        return true;
      }
      case 2:
        return true; // Credentials step has no required validation beyond defaults
      case 3:
        return true; // Roles & Groups are optional
      default:
        return true;
    }
  }

  private getStepData(step: number): any {
    switch (step) {
      case 0:
        return this.profileForm.getRawValue();
      case 1:
        return this.accountForm.getRawValue();
      case 2:
        return this.credentialsForm.getRawValue();
      case 3:
        return { roles: this.assignedRoles, groups: this.assignedGroups };
      default:
        return {};
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Roles & Groups Management                                          */
  /* ------------------------------------------------------------------ */
  onRolesSelected(event: any): void {
    const selectedIds: string[] = event.value ?? [];
    // Add new selections
    for (const id of selectedIds) {
      if (!this.assignedRoles.find((r) => r.id === id)) {
        const role = this.availableRoles.find((r) => r.id === id);
        if (role) {
          this.assignedRoles.push({
            id: role.id,
            name: role.name,
            code: role.code,
            source: 'DIRECT',
          });
        }
      }
    }
    // Remove deselected
    this.assignedRoles = this.assignedRoles.filter((r) => selectedIds.includes(r.id));
  }

  removeRole(index: number): void {
    const removed = this.assignedRoles.splice(index, 1);
    if (removed.length > 0) {
      this.selectedRoleIds = this.selectedRoleIds.filter((id) => id !== removed[0]!.id);
    }
  }

  onGroupsSelected(event: any): void {
    const selectedIds: string[] = event.value ?? [];
    for (const id of selectedIds) {
      if (!this.assignedGroups.find((g) => g.id === id)) {
        const group = this.availableGroups.find((g) => g.id === id);
        if (group) {
          this.assignedGroups.push({
            id: group.id,
            name: group.name,
            code: group.code,
            source: 'DIRECT',
          });
        }
      }
    }
    this.assignedGroups = this.assignedGroups.filter((g) => selectedIds.includes(g.id));
  }

  removeGroup(index: number): void {
    const removed = this.assignedGroups.splice(index, 1);
    if (removed.length > 0) {
      this.selectedGroupIds = this.selectedGroupIds.filter((id) => id !== removed[0]!.id);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Password Strength                                                  */
  /* ------------------------------------------------------------------ */
  private calculatePasswordStrength(password: string): PasswordStrength {
    if (!password) {
      return { score: 0, label: '', color: '', percent: 0 };
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Normalize to 0-4
    score = Math.min(score, 4);

    const levels: PasswordStrength[] = [
      { score: 0, label: 'Very Weak', color: '#ef4444', percent: 10 },
      { score: 1, label: 'Weak', color: '#f97316', percent: 25 },
      { score: 2, label: 'Fair', color: '#eab308', percent: 50 },
      { score: 3, label: 'Strong', color: '#22c55e', percent: 75 },
      { score: 4, label: 'Very Strong', color: '#16a34a', percent: 100 },
    ];

    return levels[score]!;
  }

  /* ------------------------------------------------------------------ */
  /*  Login ID                                                           */
  /* ------------------------------------------------------------------ */
  regenerateLoginId(): void {
    const email = this.profileForm.get('email')?.value;
    if (email && email.includes('@')) {
      const loginId = email.split('@')[0];
      this.accountForm.get('loginId')!.setValue(loginId);
      this.accountForm.get('loginId')!.markAsPristine();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Review Helpers                                                     */
  /* ------------------------------------------------------------------ */
  getDepartmentName(departmentId: string | null): string {
    if (!departmentId) return '—';
    const dept = this.departments.find((d) => d.id === departmentId);
    return dept?.name ?? departmentId;
  }

  /* ------------------------------------------------------------------ */
  /*  Submit                                                             */
  /* ------------------------------------------------------------------ */
  submitUser(): void {
    this.submitError = null;
    this.submitting = true;

    const payload: UserCreatePayload = {
      profile: this.profileForm.getRawValue(),
      account: {
        ...this.accountForm.getRawValue(),
        password:
          this.accountForm.get('passwordOption')?.value === 'MANUAL'
            ? this.accountForm.get('password')?.value
            : null,
      },
      credentials: this.credentialsForm.getRawValue(),
      roles: this.assignedRoles,
      groups: this.assignedGroups,
    };

    this.http
      .post<ApiResponse<UserCreateResponse>>(`${this.API_BASE}/users`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.submitting = false;
          this.submitSuccess = true;
          this.createdUser = res.data ?? null;
        },
        error: (err) => {
          this.submitting = false;
          this.submitError =
            err.error?.message ??
            err.error?.error ??
            'An unexpected error occurred while creating the user. Please try again.';
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Post-Submit Actions                                                */
  /* ------------------------------------------------------------------ */
  viewCreatedUser(): void {
    if (this.createdUser?.userId) {
      this.router.navigate(['/users', this.createdUser.userId]);
    }
  }

  resetWizard(): void {
    this.profileForm.reset({ userType: 'EMPLOYEE' });
    this.accountForm.reset({
      passwordOption: 'AUTO_GENERATE',
      mustChangePassword: true,
      accountStatus: 'ACTIVE',
    });
    this.credentialsForm.reset({ password: true, totp: false, fido2: false, softToken: false });
    this.assignedRoles = [];
    this.assignedGroups = [];
    this.selectedRoleIds = [];
    this.selectedGroupIds = [];
    this.currentStep = 0;
    this.highestCompletedStep = -1;
    this.submitSuccess = false;
    this.submitError = null;
    this.createdUser = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Cancel                                                             */
  /* ------------------------------------------------------------------ */
  onCancel(): void {
    if (this.isFormDirty()) {
      this.showCancelDialog = true;
    } else {
      this.router.navigate(['/users']);
    }
  }

  confirmCancel(): void {
    this.showCancelDialog = false;
    this.router.navigate(['/users']);
  }

  private isFormDirty(): boolean {
    return (
      this.profileForm.dirty ||
      this.accountForm.dirty ||
      this.credentialsForm.dirty ||
      this.assignedRoles.length > 0 ||
      this.assignedGroups.length > 0
    );
  }
}
