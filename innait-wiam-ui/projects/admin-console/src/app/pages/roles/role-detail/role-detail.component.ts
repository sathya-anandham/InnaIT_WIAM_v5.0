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
import { Subject, takeUntil, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';

import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  SelectionChangedEvent,
  GridOptions,
} from 'ag-grid-community';

import {
  AuthService,
  ApiResponse,
  PaginationMeta,
  Role,
  Entitlement,
  User,
} from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MultiSelectModule } from 'primeng/multiselect';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface MappedEntitlement extends Entitlement {
  mappedAt?: string;
}

interface RoleMember {
  userId: string;
  displayName: string;
  email: string;
  source: 'DIRECT' | 'MANAGER' | 'POLICY';
  assignedAt: string;
}

interface EntitlementOption {
  id: string;
  entitlementName: string;
  entitlementCode: string;
  resource: string;
  action: string;
}

interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

interface RoleTypeOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-role-detail',
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
    InputTextareaModule,
    InputSwitchModule,
    CardModule,
    MessageModule,
    DialogModule,
    TagModule,
    ProgressSpinnerModule,
    MultiSelectModule,
    TranslatePipe,
    DatePipe,
  ],
  template: `
    <!-- ============================================================ -->
    <!-- Loading State                                                  -->
    <!-- ============================================================ -->
    <div *ngIf="loading" class="loading-container" role="alert" aria-label="Loading role details">
      <p-progressSpinner [style]="{ width: '50px', height: '50px' }" strokeWidth="4"></p-progressSpinner>
      <p>Loading role details...</p>
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
        (click)="loadRole()"
      ></button>
    </div>

    <!-- ============================================================ -->
    <!-- Main Content                                                   -->
    <!-- ============================================================ -->
    <div *ngIf="role && !loading && !loadError" class="role-detail-page">

      <!-- Page Header -->
      <header class="page-header">
        <div class="header-left">
          <button
            class="btn btn-icon"
            routerLink="/roles"
            aria-label="Back to role list">
            <i class="pi pi-arrow-left" aria-hidden="true"></i>
          </button>
          <div class="header-info">
            <h1 class="page-title">{{ role.roleName }}</h1>
            <div class="header-badges">
              <span class="badge badge-code">{{ role.roleCode }}</span>
              <span
                class="badge"
                [class.badge-active]="role.status === 'ACTIVE'"
                [class.badge-inactive]="role.status === 'INACTIVE'">
                {{ role.status }}
              </span>
              <span
                class="badge"
                [class.badge-system]="role.roleType === 'SYSTEM'"
                [class.badge-tenant]="role.roleType === 'TENANT'"
                [class.badge-application]="role.roleType === 'APPLICATION'">
                {{ role.roleType }}
              </span>
            </div>
          </div>
        </div>
        <div class="header-right">
          <button
            class="btn btn-outline"
            (click)="editing = !editing"
            aria-label="Toggle edit mode">
            <i class="pi" [class.pi-pencil]="!editing" [class.pi-times]="editing" aria-hidden="true"></i>
            {{ editing ? 'Cancel Edit' : 'Edit' }}
          </button>
          <button
            class="btn btn-danger-outline"
            (click)="confirmDelete()"
            aria-label="Delete role">
            <i class="pi pi-trash" aria-hidden="true"></i>
            Delete
          </button>
        </div>
      </header>

      <!-- Tab View -->
      <div class="tab-container">
        <p-tabView (onChange)="onTabChange($event)" [activeIndex]="activeTabIndex">

          <!-- ======================================================== -->
          <!-- Tab 1: Details                                            -->
          <!-- ======================================================== -->
          <p-tabPanel header="Details" leftIcon="pi pi-info-circle">
            <div class="tab-content">
              <p-card styleClass="detail-card">
                <!-- View Mode -->
                <div *ngIf="!editing" class="detail-view">
                  <div class="detail-row">
                    <span class="detail-label">Role Name</span>
                    <span class="detail-value">{{ role.roleName }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Role Code</span>
                    <span class="detail-value code-value">{{ role.roleCode }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Role Type</span>
                    <span class="detail-value">{{ role.roleType }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value">{{ role.description || 'No description provided.' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">System Role</span>
                    <span class="detail-value">{{ role.system ? 'Yes' : 'No' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span
                      class="badge"
                      [class.badge-active]="role.status === 'ACTIVE'"
                      [class.badge-inactive]="role.status === 'INACTIVE'">
                      {{ role.status }}
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">{{ role.createdAt | date:'medium' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Updated</span>
                    <span class="detail-value">{{ role.updatedAt | date:'medium' }}</span>
                  </div>
                </div>

                <!-- Edit Mode -->
                <form
                  *ngIf="editing"
                  [formGroup]="editForm"
                  (ngSubmit)="saveRole()"
                  aria-label="Edit role form">

                  <p-message
                    *ngIf="saveError"
                    severity="error"
                    [text]="saveError"
                    styleClass="w-full mb-3">
                  </p-message>

                  <div class="form-field">
                    <label class="form-label" for="edit-roleName">
                      Role Name <span class="required">*</span>
                    </label>
                    <input
                      id="edit-roleName"
                      type="text"
                      pInputText
                      formControlName="roleName"
                      class="w-full"
                      aria-required="true" />
                  </div>

                  <div class="form-field">
                    <label class="form-label" for="edit-roleType">Role Type</label>
                    <p-dropdown
                      id="edit-roleType"
                      formControlName="roleType"
                      [options]="roleTypeOptions"
                      optionLabel="label"
                      optionValue="value"
                      styleClass="w-full">
                    </p-dropdown>
                  </div>

                  <div class="form-field">
                    <label class="form-label" for="edit-description">Description</label>
                    <textarea
                      id="edit-description"
                      pInputTextarea
                      formControlName="description"
                      rows="4"
                      class="w-full">
                    </textarea>
                  </div>

                  <div class="form-field form-field-inline">
                    <label class="form-label" for="edit-status">Status</label>
                    <div class="switch-row">
                      <p-inputSwitch
                        id="edit-status"
                        formControlName="statusActive">
                      </p-inputSwitch>
                      <span
                        class="badge"
                        [class.badge-active]="editForm.get('statusActive')?.value"
                        [class.badge-inactive]="!editForm.get('statusActive')?.value">
                        {{ editForm.get('statusActive')?.value ? 'ACTIVE' : 'INACTIVE' }}
                      </span>
                    </div>
                  </div>

                  <div class="form-actions">
                    <button
                      type="button"
                      class="btn btn-outline"
                      (click)="editing = false"
                      aria-label="Cancel editing">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="btn btn-primary"
                      [disabled]="editForm.invalid || saving"
                      aria-label="Save role changes">
                      <i class="pi pi-spin pi-spinner" *ngIf="saving" aria-hidden="true"></i>
                      {{ saving ? 'Saving...' : 'Save Changes' }}
                    </button>
                  </div>
                </form>
              </p-card>
            </div>
          </p-tabPanel>

          <!-- ======================================================== -->
          <!-- Tab 2: Entitlements                                       -->
          <!-- ======================================================== -->
          <p-tabPanel header="Entitlements" leftIcon="pi pi-key">
            <div class="tab-content">
              <div class="tab-toolbar">
                <h3 class="tab-section-title">Mapped Entitlements</h3>
                <button
                  class="btn btn-primary"
                  (click)="openMapEntitlementDialog()"
                  aria-label="Map a new entitlement to this role">
                  <i class="pi pi-plus" aria-hidden="true"></i>
                  Map Entitlement
                </button>
              </div>

              <div class="ag-theme-alpine tab-grid">
                <ag-grid-angular
                  class="ag-grid"
                  [columnDefs]="entitlementColDefs"
                  [defaultColDef]="defaultColDef"
                  [rowModelType]="'serverSide'"
                  [serverSideStoreType]="'partial'"
                  [pagination]="true"
                  [paginationPageSize]="25"
                  [cacheBlockSize]="25"
                  [animateRows]="true"
                  [overlayLoadingTemplate]="entLoadingOverlay"
                  [overlayNoRowsTemplate]="entNoRowsOverlay"
                  (gridReady)="onEntitlementGridReady($event)">
                </ag-grid-angular>
              </div>
            </div>
          </p-tabPanel>

          <!-- ======================================================== -->
          <!-- Tab 3: Members                                            -->
          <!-- ======================================================== -->
          <p-tabPanel header="Members" leftIcon="pi pi-users">
            <div class="tab-content">
              <div class="tab-toolbar">
                <h3 class="tab-section-title">Role Members</h3>
                <div class="tab-toolbar-right">
                  <button
                    class="btn btn-primary"
                    (click)="openAssignMembersDialog()"
                    aria-label="Assign members to this role">
                    <i class="pi pi-user-plus" aria-hidden="true"></i>
                    Assign Members
                  </button>
                  <button
                    class="btn btn-outline"
                    *ngIf="selectedMembers.length > 0"
                    (click)="bulkAssignMembers()"
                    aria-label="Bulk assign selected members">
                    <i class="pi pi-users" aria-hidden="true"></i>
                    Bulk Assign ({{ selectedMembers.length }})
                  </button>
                  <button
                    class="btn btn-danger-outline"
                    *ngIf="selectedMembers.length > 0"
                    (click)="bulkRemoveMembers()"
                    aria-label="Bulk remove selected members">
                    <i class="pi pi-user-minus" aria-hidden="true"></i>
                    Bulk Remove ({{ selectedMembers.length }})
                  </button>
                </div>
              </div>

              <div class="ag-theme-alpine tab-grid">
                <ag-grid-angular
                  class="ag-grid"
                  [columnDefs]="memberColDefs"
                  [defaultColDef]="defaultColDef"
                  [rowModelType]="'serverSide'"
                  [serverSideStoreType]="'partial'"
                  [pagination]="true"
                  [paginationPageSize]="25"
                  [cacheBlockSize]="25"
                  [rowSelection]="'multiple'"
                  [suppressRowClickSelection]="true"
                  [animateRows]="true"
                  [overlayLoadingTemplate]="memberLoadingOverlay"
                  [overlayNoRowsTemplate]="memberNoRowsOverlay"
                  (gridReady)="onMemberGridReady($event)"
                  (selectionChanged)="onMemberSelectionChanged($event)">
                </ag-grid-angular>
              </div>
            </div>
          </p-tabPanel>
        </p-tabView>
      </div>

      <!-- ============================================================ -->
      <!-- Map Entitlement Dialog                                       -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="entitlementDialog.visible"
        (click)="closeEntitlementDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Map entitlement dialog">
        <div class="dialog-content dialog-wide" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Map Entitlement</h3>
          <p class="dialog-message">Search and select an entitlement to map to this role.</p>

          <div class="form-field">
            <label class="form-label" for="ent-search-input">Search Entitlements</label>
            <input
              id="ent-search-input"
              type="text"
              class="filter-input"
              placeholder="Type to search entitlements..."
              [(ngModel)]="entitlementDialog.searchTerm"
              (ngModelChange)="onEntitlementSearchChange($event)"
              aria-label="Search entitlements" />
          </div>

          <div *ngIf="entitlementDialog.loading" class="dialog-loading">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Searching...
          </div>

          <ul
            class="option-list"
            *ngIf="entitlementDialog.options.length > 0 && !entitlementDialog.loading"
            role="listbox"
            aria-label="Available entitlements">
            <li
              *ngFor="let ent of entitlementDialog.options"
              class="option-item"
              [class.selected]="entitlementDialog.selectedId === ent.id"
              (click)="entitlementDialog.selectedId = ent.id"
              role="option"
              [attr.aria-selected]="entitlementDialog.selectedId === ent.id">
              <div class="option-primary">{{ ent.entitlementName }}</div>
              <div class="option-secondary">{{ ent.entitlementCode }} - {{ ent.resource }} ({{ ent.action }})</div>
            </li>
          </ul>

          <p *ngIf="entitlementDialog.options.length === 0 && entitlementDialog.searchTerm && !entitlementDialog.loading" class="no-results">
            No entitlements found matching "{{ entitlementDialog.searchTerm }}".
          </p>

          <div class="dialog-actions">
            <button class="btn btn-outline" (click)="closeEntitlementDialog()" aria-label="Cancel">
              Cancel
            </button>
            <button
              class="btn btn-primary"
              (click)="mapEntitlement()"
              [disabled]="!entitlementDialog.selectedId || entitlementDialog.submitting"
              aria-label="Map selected entitlement">
              <i class="pi pi-spin pi-spinner" *ngIf="entitlementDialog.submitting" aria-hidden="true"></i>
              {{ entitlementDialog.submitting ? 'Mapping...' : 'Map Entitlement' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Assign Members Dialog                                        -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="memberDialog.visible"
        (click)="closeMemberDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Assign members dialog">
        <div class="dialog-content dialog-wide" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Assign Members</h3>
          <p class="dialog-message">Search and select users to assign to this role.</p>

          <div class="form-field">
            <label class="form-label" for="member-search-input">Search Users</label>
            <input
              id="member-search-input"
              type="text"
              class="filter-input"
              placeholder="Type to search users..."
              [(ngModel)]="memberDialog.searchTerm"
              (ngModelChange)="onMemberSearchChange($event)"
              aria-label="Search users" />
          </div>

          <div *ngIf="memberDialog.loading" class="dialog-loading">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Searching...
          </div>

          <ul
            class="option-list"
            *ngIf="memberDialog.options.length > 0 && !memberDialog.loading"
            role="listbox"
            aria-multiselectable="true"
            aria-label="Available users">
            <li
              *ngFor="let user of memberDialog.options"
              class="option-item"
              [class.selected]="memberDialog.selectedIds.includes(user.id)"
              (click)="toggleMemberSelection(user.id)"
              role="option"
              [attr.aria-selected]="memberDialog.selectedIds.includes(user.id)">
              <div class="option-check">
                <i
                  class="pi"
                  [class.pi-check-square]="memberDialog.selectedIds.includes(user.id)"
                  [class.pi-stop]="!memberDialog.selectedIds.includes(user.id)"
                  aria-hidden="true"></i>
              </div>
              <div class="option-content">
                <div class="option-primary">{{ user.displayName }}</div>
                <div class="option-secondary">{{ user.email }}</div>
              </div>
            </li>
          </ul>

          <p *ngIf="memberDialog.options.length === 0 && memberDialog.searchTerm && !memberDialog.loading" class="no-results">
            No users found matching "{{ memberDialog.searchTerm }}".
          </p>

          <!-- Source selection -->
          <div class="form-field" *ngIf="memberDialog.selectedIds.length > 0">
            <label class="form-label">Assignment Source</label>
            <div class="radio-group" role="radiogroup" aria-label="Assignment source">
              <label class="radio-label" *ngFor="let src of sourceOptions">
                <input
                  type="radio"
                  name="assignmentSource"
                  [value]="src"
                  [(ngModel)]="memberDialog.source"
                  [attr.aria-label]="'Source: ' + src" />
                {{ src }}
              </label>
            </div>
          </div>

          <div class="dialog-actions">
            <button class="btn btn-outline" (click)="closeMemberDialog()" aria-label="Cancel">
              Cancel
            </button>
            <button
              class="btn btn-primary"
              (click)="assignMembers()"
              [disabled]="memberDialog.selectedIds.length === 0 || memberDialog.submitting"
              aria-label="Assign selected members">
              <i class="pi pi-spin pi-spinner" *ngIf="memberDialog.submitting" aria-hidden="true"></i>
              {{ memberDialog.submitting ? 'Assigning...' : 'Assign (' + memberDialog.selectedIds.length + ')' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Remove Member Confirmation Dialog                            -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="removeDialog.visible"
        (click)="closeRemoveDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Remove member confirmation">
        <div class="dialog-content" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Remove Member</h3>
          <p class="dialog-message">
            Are you sure you want to remove
            <strong>{{ removeDialog.count }}</strong>
            {{ removeDialog.count === 1 ? 'member' : 'members' }} from this role?
          </p>

          <div class="form-field">
            <label class="form-label" for="remove-reason">Reason (optional)</label>
            <textarea
              id="remove-reason"
              class="filter-input"
              rows="3"
              placeholder="Provide a reason for removal..."
              [(ngModel)]="removeDialog.reason"
              aria-label="Reason for removal">
            </textarea>
          </div>

          <div class="dialog-actions">
            <button class="btn btn-outline" (click)="closeRemoveDialog()" aria-label="Cancel">
              Cancel
            </button>
            <button
              class="btn btn-danger"
              (click)="executeRemoveMembers()"
              [disabled]="removeDialog.loading"
              aria-label="Confirm removal">
              <i class="pi pi-spin pi-spinner" *ngIf="removeDialog.loading" aria-hidden="true"></i>
              {{ removeDialog.loading ? 'Removing...' : 'Remove' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Delete Role Confirmation Dialog                              -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="deleteDialog.visible"
        (click)="closeDeleteDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Delete role confirmation">
        <div class="dialog-content" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Delete Role</h3>
          <p class="dialog-message">
            Are you sure you want to permanently delete the role
            <strong>{{ role.roleName }}</strong>?
          </p>
          <p class="dialog-warning">
            This action cannot be undone. All entitlement mappings and member assignments will be removed.
          </p>
          <div class="dialog-actions">
            <button class="btn btn-outline" (click)="closeDeleteDialog()" aria-label="Cancel">
              Cancel
            </button>
            <button
              class="btn btn-danger"
              (click)="executeDeleteRole()"
              [disabled]="deleteDialog.loading"
              aria-label="Confirm role deletion">
              <i class="pi pi-spin pi-spinner" *ngIf="deleteDialog.loading" aria-hidden="true"></i>
              {{ deleteDialog.loading ? 'Deleting...' : 'Delete Role' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ============================================================ */
    /* Loading / Error                                               */
    /* ============================================================ */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 1rem;
      color: var(--innait-text-secondary, #757575);
    }

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 0.75rem;
      padding: 2rem;
    }

    /* ============================================================ */
    /* Layout                                                        */
    /* ============================================================ */
    .role-detail-page {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: var(--innait-surface, #fff);
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .header-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .page-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
      color: var(--innait-text, #212121);
    }

    .header-badges {
      display: flex;
      gap: 0.375rem;
    }

    .header-right {
      display: flex;
      gap: 0.5rem;
    }

    .tab-container {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    :host ::ng-deep .p-tabview {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    :host ::ng-deep .p-tabview-panels {
      flex: 1;
      overflow-y: auto;
      padding: 0 !important;
    }

    .tab-content {
      padding: 1.25rem;
    }

    .tab-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .tab-toolbar-right {
      display: flex;
      gap: 0.5rem;
    }

    .tab-section-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
      color: var(--innait-text, #212121);
    }

    .tab-grid {
      height: 400px;
    }

    .ag-grid {
      width: 100%;
      height: 100%;
    }

    /* ============================================================ */
    /* Badges                                                        */
    /* ============================================================ */
    .badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    .badge-code {
      background: #eceff1;
      color: #455a64;
      font-family: monospace;
    }

    .badge-active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .badge-inactive {
      background: #f5f5f5;
      color: #616161;
    }

    .badge-system {
      background: #fce4ec;
      color: #c62828;
    }

    .badge-tenant {
      background: #e3f2fd;
      color: #1565c0;
    }

    .badge-application {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    /* ============================================================ */
    /* Detail View                                                   */
    /* ============================================================ */
    :host ::ng-deep .detail-card {
      max-width: 720px;
    }

    .detail-view {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .detail-row {
      display: flex;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f5f5f5;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      width: 160px;
      flex-shrink: 0;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--innait-text-secondary, #757575);
    }

    .detail-value {
      font-size: 0.8125rem;
      color: var(--innait-text, #212121);
    }

    .code-value {
      font-family: monospace;
      background: #eceff1;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
    }

    /* ============================================================ */
    /* Form Fields                                                   */
    /* ============================================================ */
    .form-field {
      margin-bottom: 1.25rem;
    }

    .form-field-inline {
      display: flex;
      flex-direction: column;
    }

    .form-label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--innait-text, #212121);
      margin-bottom: 0.375rem;
    }

    .required {
      color: #d32f2f;
    }

    .w-full {
      width: 100%;
    }

    .switch-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
      margin-top: 0.5rem;
    }

    .radio-group {
      display: flex;
      gap: 1rem;
      margin-top: 0.25rem;
    }

    .radio-label {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    /* ============================================================ */
    /* Cell Renderers                                                */
    /* ============================================================ */
    :host ::ng-deep .status-cell-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      line-height: 1.6;
    }

    :host ::ng-deep .status-cell-active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    :host ::ng-deep .status-cell-inactive {
      background: #f5f5f5;
      color: #616161;
    }

    :host ::ng-deep .action-cell-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      line-height: 1.6;
    }

    :host ::ng-deep .action-read { background: #e3f2fd; color: #1565c0; }
    :host ::ng-deep .action-write { background: #e8f5e9; color: #2e7d32; }
    :host ::ng-deep .action-delete { background: #fbe9e7; color: #d32f2f; }
    :host ::ng-deep .action-execute { background: #f3e5f5; color: #7b1fa2; }
    :host ::ng-deep .action-admin { background: #fff3e0; color: #e65100; }

    :host ::ng-deep .source-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      line-height: 1.6;
    }

    :host ::ng-deep .source-direct { background: #e3f2fd; color: #1565c0; }
    :host ::ng-deep .source-manager { background: #f3e5f5; color: #7b1fa2; }
    :host ::ng-deep .source-policy { background: #fff3e0; color: #e65100; }

    :host ::ng-deep .action-link {
      color: var(--innait-primary, #1976d2);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    :host ::ng-deep .action-link:hover {
      text-decoration: underline;
    }

    /* ============================================================ */
    /* Buttons                                                       */
    /* ============================================================ */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.4375rem 0.875rem;
      border: 1px solid transparent;
      border-radius: 4px;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      line-height: 1.5;
    }

    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-primary { background: var(--innait-primary, #1976d2); color: #fff; border-color: var(--innait-primary, #1976d2); }
    .btn-primary:hover:not(:disabled) { background: #1565c0; border-color: #1565c0; }
    .btn-outline { background: transparent; color: var(--innait-text, #212121); border-color: #e0e0e0; }
    .btn-outline:hover:not(:disabled) { background: #f5f5f5; border-color: #bdbdbd; }
    .btn-danger { background: #d32f2f; color: #fff; border-color: #d32f2f; }
    .btn-danger:hover:not(:disabled) { background: #c62828; }
    .btn-danger-outline { background: transparent; color: #d32f2f; border-color: #d32f2f; }
    .btn-danger-outline:hover:not(:disabled) { background: rgba(211, 47, 47, 0.06); }
    .btn-icon { padding: 0.4375rem; background: transparent; border: 1px solid #e0e0e0; border-radius: 4px; cursor: pointer; color: var(--innait-text, #212121); }
    .btn-icon:hover { background: #f5f5f5; }

    /* ============================================================ */
    /* Dialog                                                        */
    /* ============================================================ */
    .dialog-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      z-index: 1000;
    }

    .dialog-content {
      background: #fff;
      border-radius: 8px;
      padding: 1.5rem;
      width: 420px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    }

    .dialog-wide { width: 560px; }

    .dialog-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 0.75rem 0;
      color: var(--innait-text, #212121);
    }

    .dialog-message {
      font-size: 0.875rem;
      color: var(--innait-text-secondary, #757575);
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }

    .dialog-warning {
      font-size: 0.8125rem;
      color: #d32f2f;
      background: #fbe9e7;
      border: 1px solid #ffccbc;
      border-radius: 4px;
      padding: 0.625rem 0.75rem;
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .dialog-loading {
      font-size: 0.8125rem;
      color: var(--innait-text-secondary, #757575);
      padding: 0.75rem 0;
    }

    /* ============================================================ */
    /* Option List (dialog list)                                     */
    /* ============================================================ */
    .option-list {
      list-style: none;
      padding: 0;
      margin: 0 0 1rem;
      max-height: 240px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      cursor: pointer;
      border-bottom: 1px solid #f5f5f5;
      transition: background 0.1s;
    }

    .option-item:last-child { border-bottom: none; }
    .option-item:hover { background: #f5f5f5; }
    .option-item.selected { background: #e3f2fd; }

    .option-check {
      color: var(--innait-primary, #1976d2);
      flex-shrink: 0;
    }

    .option-content {
      flex: 1;
      min-width: 0;
    }

    .option-primary {
      font-weight: 500;
      color: var(--innait-text, #212121);
    }

    .option-secondary {
      font-size: 0.75rem;
      color: var(--innait-text-secondary, #757575);
      margin-top: 0.125rem;
    }

    .filter-input {
      padding: 0.4375rem 0.625rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 0.8125rem;
      outline: none;
      transition: border-color 0.15s;
      width: 100%;
      box-sizing: border-box;
    }

    .filter-input:focus {
      border-color: var(--innait-primary, #1976d2);
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
    }

    .no-results {
      font-size: 0.8125rem;
      color: var(--innait-text-secondary, #757575);
      text-align: center;
      padding: 1rem 0;
    }

    /* ============================================================ */
    /* Responsive                                                    */
    /* ============================================================ */
    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .header-right {
        align-self: flex-end;
      }

      .tab-toolbar {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .tab-toolbar-right {
        flex-wrap: wrap;
      }

      .detail-row {
        flex-direction: column;
        gap: 0.25rem;
      }

      .detail-label {
        width: auto;
      }
    }
  `],
})
export class RoleDetailComponent implements OnInit, OnDestroy {
  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  private readonly apiBase = '/api/v1/admin/roles';
  private readonly destroy$ = new Subject<void>();
  private readonly entSearchSubject$ = new Subject<string>();
  private readonly memberSearchSubject$ = new Subject<string>();
  private roleId = '';

  loading = true;
  loadError = '';
  role!: Role;
  editing = false;
  saving = false;
  saveError = '';
  activeTabIndex = 0;

  editForm!: FormGroup;
  selectedMembers: RoleMember[] = [];

  // Grid APIs
  private entGridApi!: GridApi;
  private memberGridApi!: GridApi;

  readonly roleTypeOptions: RoleTypeOption[] = [
    { label: 'System', value: 'SYSTEM' },
    { label: 'Tenant', value: 'TENANT' },
    { label: 'Application', value: 'APPLICATION' },
  ];

  readonly sourceOptions: string[] = ['DIRECT', 'MANAGER', 'POLICY'];

  // ----------------------------------------------------------------
  // Grid column defs
  // ----------------------------------------------------------------
  readonly defaultColDef: ColDef = {
    resizable: true,
    sortable: false,
    filter: false,
    suppressMenu: true,
  };

  readonly entitlementColDefs: ColDef[] = [
    { field: 'entitlementName', headerName: 'Entitlement Name', flex: 2, sortable: true },
    { field: 'entitlementCode', headerName: 'Code', flex: 1.5, sortable: true },
    { field: 'resource', headerName: 'Resource', flex: 1.5, sortable: true },
    {
      field: 'action',
      headerName: 'Action',
      flex: 1,
      sortable: true,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        const lower = params.value.toLowerCase();
        return `<span class="action-cell-badge action-${lower}">${params.value}</span>`;
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      sortable: true,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        const lower = params.value.toLowerCase();
        return `<span class="status-cell-badge status-cell-${lower}">${params.value}</span>`;
      },
    },
    {
      headerName: 'Actions',
      flex: 0.8,
      pinned: 'right',
      sortable: false,
      cellRenderer: (params: { data: MappedEntitlement }): string => {
        if (!params.data) return '';
        return `<a class="action-link" data-action="unmap" data-ent-id="${params.data.id}">Unmap</a>`;
      },
      onCellClicked: (params: { data: MappedEntitlement; event: Event }) => {
        const target = params.event?.target as HTMLElement;
        if (target?.getAttribute('data-action') === 'unmap' && params.data) {
          this.unmapEntitlement(params.data.id);
        }
      },
    },
  ];

  readonly memberColDefs: ColDef[] = [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      width: 48,
      maxWidth: 48,
      suppressMenu: true,
      sortable: false,
      resizable: false,
      lockPosition: 'left',
    },
    { field: 'displayName', headerName: 'Name', flex: 2, sortable: true },
    { field: 'email', headerName: 'Email', flex: 2, sortable: true },
    {
      field: 'source',
      headerName: 'Source',
      flex: 1,
      sortable: true,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        const lower = params.value.toLowerCase();
        return `<span class="source-badge source-${lower}">${params.value}</span>`;
      },
    },
    {
      field: 'assignedAt',
      headerName: 'Assigned',
      flex: 1,
      sortable: true,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        return this.formatDate(params.value);
      },
    },
    {
      headerName: 'Actions',
      flex: 0.8,
      pinned: 'right',
      sortable: false,
      cellRenderer: (params: { data: RoleMember }): string => {
        if (!params.data) return '';
        return `<a class="action-link" data-action="remove" data-user-id="${params.data.userId}">Remove</a>`;
      },
      onCellClicked: (params: { data: RoleMember; event: Event }) => {
        const target = params.event?.target as HTMLElement;
        if (target?.getAttribute('data-action') === 'remove' && params.data) {
          this.confirmRemoveMember([params.data]);
        }
      },
    },
  ];

  // Overlay templates
  readonly entLoadingOverlay =
    '<div class="ag-overlay-loading-center" role="status"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;margin-right:0.5rem"></i> Loading entitlements...</div>';
  readonly entNoRowsOverlay =
    '<div class="ag-overlay-no-rows-center" role="status"><p style="margin:0;color:#757575">No entitlements mapped to this role.</p></div>';
  readonly memberLoadingOverlay =
    '<div class="ag-overlay-loading-center" role="status"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;margin-right:0.5rem"></i> Loading members...</div>';
  readonly memberNoRowsOverlay =
    '<div class="ag-overlay-no-rows-center" role="status"><p style="margin:0;color:#757575">No members assigned to this role.</p></div>';

  // ----------------------------------------------------------------
  // Dialogs
  // ----------------------------------------------------------------
  entitlementDialog = {
    visible: false,
    searchTerm: '',
    options: [] as EntitlementOption[],
    selectedId: '',
    loading: false,
    submitting: false,
  };

  memberDialog = {
    visible: false,
    searchTerm: '',
    options: [] as UserOption[],
    selectedIds: [] as string[],
    source: 'DIRECT' as string,
    loading: false,
    submitting: false,
  };

  removeDialog = {
    visible: false,
    members: [] as RoleMember[],
    count: 0,
    reason: '',
    loading: false,
  };

  deleteDialog = {
    visible: false,
    loading: false,
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
  ) {}

  // ================================================================
  // Lifecycle
  // ================================================================
  ngOnInit(): void {
    this.roleId = this.route.snapshot.paramMap.get('roleId') || '';
    this.loadRole();

    // Debounced entitlement search
    this.entSearchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => this.searchEntitlements(term));

    // Debounced member search
    this.memberSearchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => this.searchUsers(term));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ================================================================
  // Load role
  // ================================================================
  loadRole(): void {
    this.loading = true;
    this.loadError = '';

    this.http
      .get<ApiResponse<Role>>(`${this.apiBase}/${this.roleId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.role = response.data!;
          this.initEditForm();
          this.loading = false;
        },
        error: (err) => {
          this.loadError = err?.error?.message || 'Failed to load role details.';
          this.loading = false;
        },
      });
  }

  // ================================================================
  // Edit form
  // ================================================================
  private initEditForm(): void {
    this.editForm = this.fb.group({
      roleName: [this.role.roleName, [Validators.required]],
      roleType: [this.role.roleType, [Validators.required]],
      description: [this.role.description || ''],
      statusActive: [this.role.status === 'ACTIVE'],
    });
  }

  saveRole(): void {
    if (this.editForm.invalid) return;

    this.saving = true;
    this.saveError = '';

    const formValue = this.editForm.value;
    const payload = {
      roleName: formValue.roleName,
      roleType: formValue.roleType,
      description: formValue.description,
      status: formValue.statusActive ? 'ACTIVE' : 'INACTIVE',
    };

    this.http
      .put<ApiResponse<Role>>(`${this.apiBase}/${this.roleId}`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.role = response.data!;
          this.initEditForm();
          this.saving = false;
          this.editing = false;
        },
        error: (err) => {
          this.saveError = err?.error?.message || 'Failed to save role changes.';
          this.saving = false;
        },
      });
  }

  // ================================================================
  // Tab change
  // ================================================================
  onTabChange(event: { index: number }): void {
    this.activeTabIndex = event.index;
  }

  // ================================================================
  // Entitlements grid
  // ================================================================
  onEntitlementGridReady(event: GridReadyEvent): void {
    this.entGridApi = event.api;
    this.entGridApi.setServerSideDatasource(this.createEntitlementDatasource());
  }

  private createEntitlementDatasource(): IServerSideDatasource {
    return {
      getRows: (params: IServerSideGetRowsParams): void => {
        const startRow = params.request.startRow ?? 0;
        const page = Math.floor(startRow / 25);

        const httpParams = new HttpParams()
          .set('page', page.toString())
          .set('size', '25');

        this.http
          .get<ApiResponse<MappedEntitlement[]>>(
            `${this.apiBase}/${this.roleId}/entitlements`,
            { params: httpParams },
          )
          .subscribe({
            next: (response) => {
              const rows = response.data ?? [];
              const total = response.meta?.totalElements ?? rows.length;
              params.success({ rowData: rows, rowCount: total });
            },
            error: () => params.fail(),
          });
      },
    };
  }

  // ================================================================
  // Map / Unmap entitlement
  // ================================================================
  openMapEntitlementDialog(): void {
    this.entitlementDialog = {
      visible: true,
      searchTerm: '',
      options: [],
      selectedId: '',
      loading: false,
      submitting: false,
    };
  }

  closeEntitlementDialog(): void {
    this.entitlementDialog.visible = false;
  }

  onEntitlementSearchChange(term: string): void {
    this.entSearchSubject$.next(term);
  }

  private searchEntitlements(term: string): void {
    if (!term || term.length < 2) {
      this.entitlementDialog.options = [];
      return;
    }

    this.entitlementDialog.loading = true;
    const params = new HttpParams().set('search', term);

    this.http
      .get<ApiResponse<EntitlementOption[]>>('/api/v1/admin/entitlements', { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.entitlementDialog.options = response.data ?? [];
          this.entitlementDialog.loading = false;
        },
        error: () => {
          this.entitlementDialog.options = [];
          this.entitlementDialog.loading = false;
        },
      });
  }

  mapEntitlement(): void {
    if (!this.entitlementDialog.selectedId) return;

    this.entitlementDialog.submitting = true;

    this.http
      .post<ApiResponse<void>>(
        `${this.apiBase}/${this.roleId}/entitlements`,
        { entitlementId: this.entitlementDialog.selectedId },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeEntitlementDialog();
          this.refreshEntitlementGrid();
        },
        error: () => {
          this.entitlementDialog.submitting = false;
        },
      });
  }

  unmapEntitlement(entitlementId: string): void {
    this.http
      .delete<ApiResponse<void>>(
        `${this.apiBase}/${this.roleId}/entitlements/${entitlementId}`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refreshEntitlementGrid(),
        error: () => {
          // Error handled by HTTP interceptor
        },
      });
  }

  private refreshEntitlementGrid(): void {
    if (this.entGridApi) {
      this.entGridApi.setServerSideDatasource(this.createEntitlementDatasource());
    }
  }

  // ================================================================
  // Members grid
  // ================================================================
  onMemberGridReady(event: GridReadyEvent): void {
    this.memberGridApi = event.api;
    this.memberGridApi.setServerSideDatasource(this.createMemberDatasource());
  }

  onMemberSelectionChanged(_event: SelectionChangedEvent): void {
    this.selectedMembers = this.memberGridApi.getSelectedRows() as RoleMember[];
  }

  private createMemberDatasource(): IServerSideDatasource {
    return {
      getRows: (params: IServerSideGetRowsParams): void => {
        const startRow = params.request.startRow ?? 0;
        const page = Math.floor(startRow / 25);

        const httpParams = new HttpParams()
          .set('page', page.toString())
          .set('size', '25');

        this.http
          .get<ApiResponse<RoleMember[]>>(
            `${this.apiBase}/${this.roleId}/members`,
            { params: httpParams },
          )
          .subscribe({
            next: (response) => {
              const rows = response.data ?? [];
              const total = response.meta?.totalElements ?? rows.length;
              params.success({ rowData: rows, rowCount: total });
            },
            error: () => params.fail(),
          });
      },
    };
  }

  // ================================================================
  // Assign / Remove members
  // ================================================================
  openAssignMembersDialog(): void {
    this.memberDialog = {
      visible: true,
      searchTerm: '',
      options: [],
      selectedIds: [],
      source: 'DIRECT',
      loading: false,
      submitting: false,
    };
  }

  closeMemberDialog(): void {
    this.memberDialog.visible = false;
  }

  onMemberSearchChange(term: string): void {
    this.memberSearchSubject$.next(term);
  }

  private searchUsers(term: string): void {
    if (!term || term.length < 2) {
      this.memberDialog.options = [];
      return;
    }

    this.memberDialog.loading = true;
    const params = new HttpParams().set('search', term);

    this.http
      .get<ApiResponse<UserOption[]>>('/api/v1/admin/users', { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.memberDialog.options = response.data ?? [];
          this.memberDialog.loading = false;
        },
        error: () => {
          this.memberDialog.options = [];
          this.memberDialog.loading = false;
        },
      });
  }

  toggleMemberSelection(userId: string): void {
    const index = this.memberDialog.selectedIds.indexOf(userId);
    if (index > -1) {
      this.memberDialog.selectedIds.splice(index, 1);
    } else {
      this.memberDialog.selectedIds.push(userId);
    }
  }

  assignMembers(): void {
    if (this.memberDialog.selectedIds.length === 0) return;

    this.memberDialog.submitting = true;

    this.http
      .post<ApiResponse<void>>(
        `${this.apiBase}/${this.roleId}/members`,
        { userIds: this.memberDialog.selectedIds, source: this.memberDialog.source },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeMemberDialog();
          this.refreshMemberGrid();
        },
        error: () => {
          this.memberDialog.submitting = false;
        },
      });
  }

  confirmRemoveMember(members: RoleMember[]): void {
    this.removeDialog = {
      visible: true,
      members,
      count: members.length,
      reason: '',
      loading: false,
    };
  }

  closeRemoveDialog(): void {
    this.removeDialog.visible = false;
  }

  executeRemoveMembers(): void {
    this.removeDialog.loading = true;
    const userIds = this.removeDialog.members.map((m) => m.userId);

    this.http
      .request<ApiResponse<void>>('DELETE', `${this.apiBase}/${this.roleId}/members`, {
        body: { userIds, reason: this.removeDialog.reason },
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeRemoveDialog();
          this.selectedMembers = [];
          this.refreshMemberGrid();
        },
        error: () => {
          this.removeDialog.loading = false;
        },
      });
  }

  bulkAssignMembers(): void {
    this.openAssignMembersDialog();
  }

  bulkRemoveMembers(): void {
    this.confirmRemoveMember(this.selectedMembers);
  }

  private refreshMemberGrid(): void {
    if (this.memberGridApi) {
      this.memberGridApi.setServerSideDatasource(this.createMemberDatasource());
    }
  }

  // ================================================================
  // Delete role
  // ================================================================
  confirmDelete(): void {
    this.deleteDialog = { visible: true, loading: false };
  }

  closeDeleteDialog(): void {
    this.deleteDialog.visible = false;
  }

  executeDeleteRole(): void {
    this.deleteDialog.loading = true;

    this.http
      .delete<ApiResponse<void>>(`${this.apiBase}/${this.roleId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.router.navigate(['/roles']);
        },
        error: () => {
          this.deleteDialog.loading = false;
        },
      });
  }

  // ================================================================
  // Helpers
  // ================================================================
  private formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  }
}
