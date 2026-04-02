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
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

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
  Group,
  Role,
  User,
} from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface GroupMember {
  userId: string;
  displayName: string;
  email: string;
  joinedAt: string;
}

interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

interface RoleOption {
  id: string;
  roleName: string;
  roleCode: string;
  roleType: string;
}

interface MappedRole {
  roleId: string;
  roleName: string;
  roleCode: string;
  roleType: string;
}

interface GroupTypeOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-group-detail',
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
    InputTextareaModule,
    InputSwitchModule,
    DropdownModule,
    CardModule,
    MessageModule,
    DialogModule,
    TagModule,
    ProgressSpinnerModule,
    TranslatePipe,
    DatePipe,
  ],
  template: `
    <!-- ============================================================ -->
    <!-- Loading State                                                  -->
    <!-- ============================================================ -->
    <div *ngIf="loading" class="loading-container" role="alert" aria-label="Loading group details">
      <p-progressSpinner [style]="{ width: '50px', height: '50px' }" strokeWidth="4"></p-progressSpinner>
      <p>Loading group details...</p>
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
        (click)="loadGroup()">
      </button>
    </div>

    <!-- ============================================================ -->
    <!-- Main Content                                                   -->
    <!-- ============================================================ -->
    <div *ngIf="group && !loading && !loadError" class="group-detail-page">

      <!-- Page Header -->
      <header class="page-header">
        <div class="header-left">
          <button
            class="btn btn-icon"
            routerLink="/groups"
            aria-label="Back to group list">
            <i class="pi pi-arrow-left" aria-hidden="true"></i>
          </button>
          <div class="header-info">
            <h1 class="page-title">{{ group.groupName }}</h1>
            <div class="header-badges">
              <span class="badge badge-code">{{ group.groupCode }}</span>
              <span
                class="badge"
                [class.badge-static]="group.groupType === 'STATIC'"
                [class.badge-dynamic]="group.groupType === 'DYNAMIC'">
                {{ group.groupType }}
              </span>
              <span
                class="badge"
                [class.badge-active]="group.status === 'ACTIVE'"
                [class.badge-inactive]="group.status === 'INACTIVE'">
                {{ group.status }}
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
                    <span class="detail-label">Group Name</span>
                    <span class="detail-value">{{ group.groupName }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Group Code</span>
                    <span class="detail-value code-value">{{ group.groupCode }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Group Type</span>
                    <span class="detail-value">{{ group.groupType }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value">{{ group.description || 'No description provided.' }}</span>
                  </div>
                  <div class="detail-row" *ngIf="group.groupType === 'DYNAMIC'">
                    <span class="detail-label">Dynamic Rule</span>
                    <code class="detail-value code-block">{{ group.dynamicRule || 'No rule defined.' }}</code>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span
                      class="badge"
                      [class.badge-active]="group.status === 'ACTIVE'"
                      [class.badge-inactive]="group.status === 'INACTIVE'">
                      {{ group.status }}
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">{{ group.createdAt | date:'medium' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Updated</span>
                    <span class="detail-value">{{ group.updatedAt | date:'medium' }}</span>
                  </div>
                </div>

                <!-- Edit Mode -->
                <form
                  *ngIf="editing"
                  [formGroup]="editForm"
                  (ngSubmit)="saveGroup()"
                  aria-label="Edit group form">

                  <p-message
                    *ngIf="saveError"
                    severity="error"
                    [text]="saveError"
                    styleClass="w-full mb-3">
                  </p-message>

                  <div class="form-field">
                    <label class="form-label" for="edit-groupName">
                      Group Name <span class="required">*</span>
                    </label>
                    <input
                      id="edit-groupName"
                      type="text"
                      pInputText
                      formControlName="groupName"
                      class="w-full"
                      aria-required="true" />
                  </div>

                  <div class="form-field">
                    <label class="form-label" for="edit-groupType">Group Type</label>
                    <p-dropdown
                      id="edit-groupType"
                      formControlName="groupType"
                      [options]="groupTypeOptions"
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

                  <!-- Dynamic Rule Editor -->
                  <div class="form-field" *ngIf="editForm.get('groupType')?.value === 'DYNAMIC'">
                    <label class="form-label" for="edit-dynamicRule">
                      Dynamic Rule <span class="required">*</span>
                    </label>
                    <textarea
                      id="edit-dynamicRule"
                      class="dynamic-rule-editor"
                      formControlName="dynamicRule"
                      rows="6"
                      placeholder="Enter SpEL expression..."
                      aria-describedby="dynamicRule-edit-help">
                    </textarea>
                    <small id="dynamicRule-edit-help" class="field-help">
                      SpEL expression that determines group membership. Example: #user.department == 'Engineering'
                    </small>
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
                      aria-label="Save group changes">
                      <i class="pi pi-spin pi-spinner" *ngIf="saving" aria-hidden="true"></i>
                      {{ saving ? 'Saving...' : 'Save Changes' }}
                    </button>
                  </div>
                </form>
              </p-card>
            </div>
          </p-tabPanel>

          <!-- ======================================================== -->
          <!-- Tab 2: Members                                            -->
          <!-- ======================================================== -->
          <p-tabPanel header="Members" leftIcon="pi pi-users">
            <div class="tab-content">
              <!-- DYNAMIC group notice -->
              <div *ngIf="group.groupType === 'DYNAMIC'" class="dynamic-notice" role="status">
                <i class="pi pi-info-circle" aria-hidden="true"></i>
                <span>Members are auto-populated by the dynamic rule. This list is read-only.</span>
                <button
                  class="btn btn-outline btn-sm"
                  (click)="previewDynamicRule()"
                  [disabled]="previewLoading"
                  aria-label="Preview matching users for dynamic rule">
                  <i class="pi pi-spin pi-spinner" *ngIf="previewLoading" aria-hidden="true"></i>
                  {{ previewLoading ? 'Loading...' : 'Preview Rule' }}
                </button>
              </div>

              <!-- STATIC group toolbar -->
              <div *ngIf="group.groupType === 'STATIC'" class="tab-toolbar">
                <h3 class="tab-section-title">Group Members</h3>
                <button
                  class="btn btn-primary"
                  (click)="openAddMembersDialog()"
                  aria-label="Add members to this group">
                  <i class="pi pi-user-plus" aria-hidden="true"></i>
                  Add Members
                </button>
              </div>

              <div *ngIf="group.groupType === 'DYNAMIC' && !previewLoading" class="tab-toolbar">
                <h3 class="tab-section-title">Group Members (Auto-populated)</h3>
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
                  [animateRows]="true"
                  [overlayLoadingTemplate]="memberLoadingOverlay"
                  [overlayNoRowsTemplate]="memberNoRowsOverlay"
                  (gridReady)="onMemberGridReady($event)">
                </ag-grid-angular>
              </div>
            </div>
          </p-tabPanel>

          <!-- ======================================================== -->
          <!-- Tab 3: Mapped Roles                                       -->
          <!-- ======================================================== -->
          <p-tabPanel header="Mapped Roles" leftIcon="pi pi-shield">
            <div class="tab-content">
              <div class="tab-toolbar">
                <h3 class="tab-section-title">Mapped Roles</h3>
                <button
                  class="btn btn-primary"
                  (click)="openMapRoleDialog()"
                  aria-label="Map a role to this group">
                  <i class="pi pi-plus" aria-hidden="true"></i>
                  Map Role
                </button>
              </div>

              <div class="ag-theme-alpine tab-grid">
                <ag-grid-angular
                  class="ag-grid"
                  [columnDefs]="roleColDefs"
                  [defaultColDef]="defaultColDef"
                  [rowModelType]="'serverSide'"
                  [serverSideStoreType]="'partial'"
                  [pagination]="true"
                  [paginationPageSize]="25"
                  [cacheBlockSize]="25"
                  [animateRows]="true"
                  [overlayLoadingTemplate]="roleLoadingOverlay"
                  [overlayNoRowsTemplate]="roleNoRowsOverlay"
                  (gridReady)="onRoleGridReady($event)">
                </ag-grid-angular>
              </div>
            </div>
          </p-tabPanel>
        </p-tabView>
      </div>

      <!-- ============================================================ -->
      <!-- Add Members Dialog (STATIC groups)                           -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="addMemberDialog.visible"
        (click)="closeAddMembersDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Add members dialog">
        <div class="dialog-content dialog-wide" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Add Members</h3>
          <p class="dialog-message">Search and select users to add to this group.</p>

          <div class="form-field">
            <label class="form-label" for="add-member-search">Search Users</label>
            <input
              id="add-member-search"
              type="text"
              class="filter-input"
              placeholder="Type to search users..."
              [(ngModel)]="addMemberDialog.searchTerm"
              (ngModelChange)="onAddMemberSearchChange($event)"
              aria-label="Search users" />
          </div>

          <div *ngIf="addMemberDialog.loading" class="dialog-loading">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Searching...
          </div>

          <ul
            class="option-list"
            *ngIf="addMemberDialog.options.length > 0 && !addMemberDialog.loading"
            role="listbox"
            aria-multiselectable="true"
            aria-label="Available users">
            <li
              *ngFor="let user of addMemberDialog.options"
              class="option-item"
              [class.selected]="addMemberDialog.selectedIds.includes(user.id)"
              (click)="toggleAddMemberSelection(user.id)"
              role="option"
              [attr.aria-selected]="addMemberDialog.selectedIds.includes(user.id)">
              <div class="option-check">
                <i
                  class="pi"
                  [class.pi-check-square]="addMemberDialog.selectedIds.includes(user.id)"
                  [class.pi-stop]="!addMemberDialog.selectedIds.includes(user.id)"
                  aria-hidden="true"></i>
              </div>
              <div class="option-content">
                <div class="option-primary">{{ user.displayName }}</div>
                <div class="option-secondary">{{ user.email }}</div>
              </div>
            </li>
          </ul>

          <p *ngIf="addMemberDialog.options.length === 0 && addMemberDialog.searchTerm && !addMemberDialog.loading" class="no-results">
            No users found matching "{{ addMemberDialog.searchTerm }}".
          </p>

          <div class="dialog-actions">
            <button class="btn btn-outline" (click)="closeAddMembersDialog()" aria-label="Cancel">
              Cancel
            </button>
            <button
              class="btn btn-primary"
              (click)="addMembers()"
              [disabled]="addMemberDialog.selectedIds.length === 0 || addMemberDialog.submitting"
              aria-label="Add selected members">
              <i class="pi pi-spin pi-spinner" *ngIf="addMemberDialog.submitting" aria-hidden="true"></i>
              {{ addMemberDialog.submitting ? 'Adding...' : 'Add (' + addMemberDialog.selectedIds.length + ')' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Map Role Dialog                                              -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="mapRoleDialog.visible"
        (click)="closeMapRoleDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Map role dialog">
        <div class="dialog-content dialog-wide" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Map Role</h3>
          <p class="dialog-message">Search and select a role to map to this group.</p>

          <div class="form-field">
            <label class="form-label" for="map-role-search">Search Roles</label>
            <input
              id="map-role-search"
              type="text"
              class="filter-input"
              placeholder="Type to search roles..."
              [(ngModel)]="mapRoleDialog.searchTerm"
              (ngModelChange)="onMapRoleSearchChange($event)"
              aria-label="Search roles" />
          </div>

          <div *ngIf="mapRoleDialog.loading" class="dialog-loading">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Searching...
          </div>

          <ul
            class="option-list"
            *ngIf="mapRoleDialog.options.length > 0 && !mapRoleDialog.loading"
            role="listbox"
            aria-label="Available roles">
            <li
              *ngFor="let role of mapRoleDialog.options"
              class="option-item"
              [class.selected]="mapRoleDialog.selectedId === role.id"
              (click)="mapRoleDialog.selectedId = role.id"
              role="option"
              [attr.aria-selected]="mapRoleDialog.selectedId === role.id">
              <div class="option-primary">{{ role.roleName }}</div>
              <div class="option-secondary">{{ role.roleCode }} ({{ role.roleType }})</div>
            </li>
          </ul>

          <p *ngIf="mapRoleDialog.options.length === 0 && mapRoleDialog.searchTerm && !mapRoleDialog.loading" class="no-results">
            No roles found matching "{{ mapRoleDialog.searchTerm }}".
          </p>

          <div class="dialog-actions">
            <button class="btn btn-outline" (click)="closeMapRoleDialog()" aria-label="Cancel">
              Cancel
            </button>
            <button
              class="btn btn-primary"
              (click)="mapRole()"
              [disabled]="!mapRoleDialog.selectedId || mapRoleDialog.submitting"
              aria-label="Map selected role">
              <i class="pi pi-spin pi-spinner" *ngIf="mapRoleDialog.submitting" aria-hidden="true"></i>
              {{ mapRoleDialog.submitting ? 'Mapping...' : 'Map Role' }}
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
    .group-detail-page {
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

    .tab-content { padding: 1.25rem; }

    .tab-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .tab-section-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
      color: var(--innait-text, #212121);
    }

    .tab-grid { height: 400px; }
    .ag-grid { width: 100%; height: 100%; }

    /* ============================================================ */
    /* Dynamic Notice                                                */
    /* ============================================================ */
    .dynamic-notice {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      background: #fff3e0;
      border: 1px solid #ffe0b2;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.8125rem;
      color: #e65100;
    }

    .dynamic-notice i { font-size: 1.125rem; flex-shrink: 0; }
    .dynamic-notice span { flex: 1; }

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

    .badge-code { background: #eceff1; color: #455a64; font-family: monospace; }
    .badge-active { background: #e8f5e9; color: #2e7d32; }
    .badge-inactive { background: #f5f5f5; color: #616161; }
    .badge-static { background: #e3f2fd; color: #1565c0; }
    .badge-dynamic { background: #fff3e0; color: #e65100; }

    /* ============================================================ */
    /* Detail View                                                   */
    /* ============================================================ */
    :host ::ng-deep .detail-card { max-width: 720px; }

    .detail-view {
      display: flex;
      flex-direction: column;
    }

    .detail-row {
      display: flex;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f5f5f5;
    }

    .detail-row:last-child { border-bottom: none; }

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

    .code-block {
      display: block;
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      background: #263238;
      color: #eeffff;
      padding: 0.75rem;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-all;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    /* ============================================================ */
    /* Form Fields                                                   */
    /* ============================================================ */
    .form-field { margin-bottom: 1.25rem; }
    .form-field-inline { display: flex; flex-direction: column; }

    .form-label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--innait-text, #212121);
      margin-bottom: 0.375rem;
    }

    .required { color: #d32f2f; }
    .w-full { width: 100%; }

    .switch-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .dynamic-rule-editor {
      width: 100%;
      box-sizing: border-box;
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.8125rem;
      padding: 0.75rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      outline: none;
      transition: border-color 0.15s;
      background: #263238;
      color: #eeffff;
      line-height: 1.5;
    }

    .dynamic-rule-editor:focus {
      border-color: var(--innait-primary, #1976d2);
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
    }

    .field-help {
      display: block;
      font-size: 0.75rem;
      color: var(--innait-text-secondary, #757575);
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

    /* ============================================================ */
    /* Cell Renderers                                                */
    /* ============================================================ */
    :host ::ng-deep .type-cell-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      line-height: 1.6;
    }

    :host ::ng-deep .type-cell-system { background: #fce4ec; color: #c62828; }
    :host ::ng-deep .type-cell-tenant { background: #e3f2fd; color: #1565c0; }
    :host ::ng-deep .type-cell-application { background: #f3e5f5; color: #7b1fa2; }

    :host ::ng-deep .action-link {
      color: var(--innait-primary, #1976d2);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    :host ::ng-deep .action-link:hover { text-decoration: underline; }

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
    .btn-icon { padding: 0.4375rem; background: transparent; border: 1px solid #e0e0e0; border-radius: 4px; cursor: pointer; color: var(--innait-text, #212121); }
    .btn-icon:hover { background: #f5f5f5; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }

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
      max-height: 90vh;
      overflow-y: auto;
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
    /* Option List                                                   */
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

    .option-content { flex: 1; min-width: 0; }
    .option-primary { font-weight: 500; color: var(--innait-text, #212121); }
    .option-secondary { font-size: 0.75rem; color: var(--innait-text-secondary, #757575); margin-top: 0.125rem; }

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

      .header-right { align-self: flex-end; }

      .tab-toolbar {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .detail-row {
        flex-direction: column;
        gap: 0.25rem;
      }

      .detail-label { width: auto; }
    }
  `],
})
export class GroupDetailComponent implements OnInit, OnDestroy {
  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  private readonly apiBase = '/api/v1/admin/groups';
  private readonly destroy$ = new Subject<void>();
  private readonly memberSearchSubject$ = new Subject<string>();
  private readonly roleSearchSubject$ = new Subject<string>();
  private groupId = '';

  loading = true;
  loadError = '';
  group!: Group;
  editing = false;
  saving = false;
  saveError = '';
  activeTabIndex = 0;
  previewLoading = false;

  editForm!: FormGroup;

  // Grid APIs
  private memberGridApi!: GridApi;
  private roleGridApi!: GridApi;

  readonly groupTypeOptions: GroupTypeOption[] = [
    { label: 'Static', value: 'STATIC' },
    { label: 'Dynamic', value: 'DYNAMIC' },
  ];

  // ----------------------------------------------------------------
  // Grid column defs
  // ----------------------------------------------------------------
  readonly defaultColDef: ColDef = {
    resizable: true,
    sortable: false,
    filter: false,
    suppressMenu: true,
  };

  memberColDefs: ColDef[] = [];

  readonly roleColDefs: ColDef[] = [
    { field: 'roleName', headerName: 'Role Name', flex: 2, sortable: true },
    { field: 'roleCode', headerName: 'Role Code', flex: 1.5, sortable: true },
    {
      field: 'roleType',
      headerName: 'Role Type',
      flex: 1,
      sortable: true,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        const lower = params.value.toLowerCase();
        return `<span class="type-cell-badge type-cell-${lower}">${params.value}</span>`;
      },
    },
    {
      headerName: 'Actions',
      flex: 0.8,
      pinned: 'right',
      sortable: false,
      cellRenderer: (params: { data: MappedRole }): string => {
        if (!params.data) return '';
        return `<a class="action-link" data-action="unmap" data-role-id="${params.data.roleId}">Unmap</a>`;
      },
      onCellClicked: (params: { data: MappedRole; event: Event }) => {
        const target = params.event?.target as HTMLElement;
        if (target?.getAttribute('data-action') === 'unmap' && params.data) {
          this.unmapRole(params.data.roleId);
        }
      },
    },
  ];

  // Overlay templates
  readonly memberLoadingOverlay =
    '<div class="ag-overlay-loading-center" role="status"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;margin-right:0.5rem"></i> Loading members...</div>';
  readonly memberNoRowsOverlay =
    '<div class="ag-overlay-no-rows-center" role="status"><p style="margin:0;color:#757575">No members in this group.</p></div>';
  readonly roleLoadingOverlay =
    '<div class="ag-overlay-loading-center" role="status"><i class="pi pi-spin pi-spinner" style="font-size:1.5rem;margin-right:0.5rem"></i> Loading roles...</div>';
  readonly roleNoRowsOverlay =
    '<div class="ag-overlay-no-rows-center" role="status"><p style="margin:0;color:#757575">No roles mapped to this group.</p></div>';

  // ----------------------------------------------------------------
  // Dialogs
  // ----------------------------------------------------------------
  addMemberDialog = {
    visible: false,
    searchTerm: '',
    options: [] as UserOption[],
    selectedIds: [] as string[],
    loading: false,
    submitting: false,
  };

  mapRoleDialog = {
    visible: false,
    searchTerm: '',
    options: [] as RoleOption[],
    selectedId: '',
    loading: false,
    submitting: false,
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
    this.groupId = this.route.snapshot.paramMap.get('groupId') || '';
    this.loadGroup();

    this.memberSearchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => this.searchUsers(term));

    this.roleSearchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => this.searchRoles(term));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ================================================================
  // Load group
  // ================================================================
  loadGroup(): void {
    this.loading = true;
    this.loadError = '';

    this.http
      .get<ApiResponse<Group>>(`${this.apiBase}/${this.groupId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.group = response.data!;
          this.initEditForm();
          this.buildMemberColDefs();
          this.loading = false;
        },
        error: (err) => {
          this.loadError = err?.error?.message || 'Failed to load group details.';
          this.loading = false;
        },
      });
  }

  // ================================================================
  // Edit form
  // ================================================================
  private initEditForm(): void {
    this.editForm = this.fb.group({
      groupName: [this.group.groupName, [Validators.required]],
      groupType: [this.group.groupType, [Validators.required]],
      description: [this.group.description || ''],
      dynamicRule: [this.group.dynamicRule || ''],
      statusActive: [this.group.status === 'ACTIVE'],
    });

    // Make dynamicRule required when DYNAMIC
    this.editForm.get('groupType')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((type: string) => {
        const ctrl = this.editForm.get('dynamicRule');
        if (type === 'DYNAMIC') {
          ctrl?.setValidators([Validators.required]);
        } else {
          ctrl?.clearValidators();
        }
        ctrl?.updateValueAndValidity();
      });
  }

  saveGroup(): void {
    if (this.editForm.invalid) return;

    this.saving = true;
    this.saveError = '';

    const formValue = this.editForm.value;
    const payload: Record<string, string> = {
      groupName: formValue.groupName,
      groupType: formValue.groupType,
      description: formValue.description,
      status: formValue.statusActive ? 'ACTIVE' : 'INACTIVE',
    };

    if (formValue.groupType === 'DYNAMIC') {
      payload['dynamicRule'] = formValue.dynamicRule;
    }

    this.http
      .put<ApiResponse<Group>>(`${this.apiBase}/${this.groupId}`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.group = response.data!;
          this.initEditForm();
          this.buildMemberColDefs();
          this.saving = false;
          this.editing = false;
        },
        error: (err) => {
          this.saveError = err?.error?.message || 'Failed to save group changes.';
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
  // Member grid
  // ================================================================
  private buildMemberColDefs(): void {
    const baseCols: ColDef[] = [
      { field: 'displayName', headerName: 'Name', flex: 2, sortable: true },
      { field: 'email', headerName: 'Email', flex: 2, sortable: true },
      {
        field: 'joinedAt',
        headerName: 'Joined',
        flex: 1,
        sortable: true,
        cellRenderer: (params: { value: string }): string => {
          if (!params.value) return '';
          return this.formatDate(params.value);
        },
      },
    ];

    // Only STATIC groups get the remove action
    if (this.group.groupType === 'STATIC') {
      baseCols.push({
        headerName: 'Actions',
        flex: 0.8,
        pinned: 'right',
        sortable: false,
        cellRenderer: (params: { data: GroupMember }): string => {
          if (!params.data) return '';
          return `<a class="action-link" data-action="remove" data-user-id="${params.data.userId}">Remove</a>`;
        },
        onCellClicked: (params: { data: GroupMember; event: Event }) => {
          const target = params.event?.target as HTMLElement;
          if (target?.getAttribute('data-action') === 'remove' && params.data) {
            this.removeMember(params.data.userId);
          }
        },
      });
    }

    this.memberColDefs = baseCols;
  }

  onMemberGridReady(event: GridReadyEvent): void {
    this.memberGridApi = event.api;
    this.memberGridApi.setServerSideDatasource(this.createMemberDatasource());
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
          .get<ApiResponse<GroupMember[]>>(
            `${this.apiBase}/${this.groupId}/members`,
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
  // Add / Remove members
  // ================================================================
  openAddMembersDialog(): void {
    this.addMemberDialog = {
      visible: true,
      searchTerm: '',
      options: [],
      selectedIds: [],
      loading: false,
      submitting: false,
    };
  }

  closeAddMembersDialog(): void {
    this.addMemberDialog.visible = false;
  }

  onAddMemberSearchChange(term: string): void {
    this.memberSearchSubject$.next(term);
  }

  private searchUsers(term: string): void {
    if (!term || term.length < 2) {
      this.addMemberDialog.options = [];
      return;
    }

    this.addMemberDialog.loading = true;
    const params = new HttpParams().set('search', term);

    this.http
      .get<ApiResponse<UserOption[]>>('/api/v1/admin/users', { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.addMemberDialog.options = response.data ?? [];
          this.addMemberDialog.loading = false;
        },
        error: () => {
          this.addMemberDialog.options = [];
          this.addMemberDialog.loading = false;
        },
      });
  }

  toggleAddMemberSelection(userId: string): void {
    const index = this.addMemberDialog.selectedIds.indexOf(userId);
    if (index > -1) {
      this.addMemberDialog.selectedIds.splice(index, 1);
    } else {
      this.addMemberDialog.selectedIds.push(userId);
    }
  }

  addMembers(): void {
    if (this.addMemberDialog.selectedIds.length === 0) return;

    this.addMemberDialog.submitting = true;

    this.http
      .post<ApiResponse<void>>(
        `${this.apiBase}/${this.groupId}/members`,
        { userIds: this.addMemberDialog.selectedIds },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeAddMembersDialog();
          this.refreshMemberGrid();
        },
        error: () => {
          this.addMemberDialog.submitting = false;
        },
      });
  }

  removeMember(userId: string): void {
    this.http
      .delete<ApiResponse<void>>(
        `${this.apiBase}/${this.groupId}/members/${userId}`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refreshMemberGrid(),
        error: () => {
          // Error handled by HTTP interceptor
        },
      });
  }

  private refreshMemberGrid(): void {
    if (this.memberGridApi) {
      this.memberGridApi.setServerSideDatasource(this.createMemberDatasource());
    }
  }

  // ================================================================
  // Dynamic rule preview
  // ================================================================
  previewDynamicRule(): void {
    this.previewLoading = true;

    this.http
      .post<ApiResponse<GroupMember[]>>(
        `${this.apiBase}/${this.groupId}/preview-rule`,
        { rule: this.group.dynamicRule },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.previewLoading = false;
          this.refreshMemberGrid();
        },
        error: () => {
          this.previewLoading = false;
        },
      });
  }

  // ================================================================
  // Role grid
  // ================================================================
  onRoleGridReady(event: GridReadyEvent): void {
    this.roleGridApi = event.api;
    this.roleGridApi.setServerSideDatasource(this.createRoleDatasource());
  }

  private createRoleDatasource(): IServerSideDatasource {
    return {
      getRows: (params: IServerSideGetRowsParams): void => {
        const startRow = params.request.startRow ?? 0;
        const page = Math.floor(startRow / 25);

        const httpParams = new HttpParams()
          .set('page', page.toString())
          .set('size', '25');

        this.http
          .get<ApiResponse<MappedRole[]>>(
            `${this.apiBase}/${this.groupId}/roles`,
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
  // Map / Unmap role
  // ================================================================
  openMapRoleDialog(): void {
    this.mapRoleDialog = {
      visible: true,
      searchTerm: '',
      options: [],
      selectedId: '',
      loading: false,
      submitting: false,
    };
  }

  closeMapRoleDialog(): void {
    this.mapRoleDialog.visible = false;
  }

  onMapRoleSearchChange(term: string): void {
    this.roleSearchSubject$.next(term);
  }

  private searchRoles(term: string): void {
    if (!term || term.length < 2) {
      this.mapRoleDialog.options = [];
      return;
    }

    this.mapRoleDialog.loading = true;
    const params = new HttpParams().set('search', term);

    this.http
      .get<ApiResponse<RoleOption[]>>('/api/v1/admin/roles', { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.mapRoleDialog.options = response.data ?? [];
          this.mapRoleDialog.loading = false;
        },
        error: () => {
          this.mapRoleDialog.options = [];
          this.mapRoleDialog.loading = false;
        },
      });
  }

  mapRole(): void {
    if (!this.mapRoleDialog.selectedId) return;

    this.mapRoleDialog.submitting = true;

    this.http
      .post<ApiResponse<void>>(
        `${this.apiBase}/${this.groupId}/roles`,
        { roleId: this.mapRoleDialog.selectedId },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeMapRoleDialog();
          this.refreshRoleGrid();
        },
        error: () => {
          this.mapRoleDialog.submitting = false;
        },
      });
  }

  unmapRole(roleId: string): void {
    this.http
      .delete<ApiResponse<void>>(
        `${this.apiBase}/${this.groupId}/roles/${roleId}`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refreshRoleGrid(),
        error: () => {
          // Error handled by HTTP interceptor
        },
      });
  }

  private refreshRoleGrid(): void {
    if (this.roleGridApi) {
      this.roleGridApi.setServerSideDatasource(this.createRoleDatasource());
    }
  }

  // ================================================================
  // Helpers
  // ================================================================
  private formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }
}
