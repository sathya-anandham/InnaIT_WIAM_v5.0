import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  GridOptions,
  CellClickedEvent,
} from 'ag-grid-community';
import { AuthService, ApiResponse, PaginationMeta, Entitlement } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface EntitlementRow extends Entitlement {
  mappedRoles?: string[];
}

interface ActionOption {
  label: string;
  value: string;
}

interface MappedRoleInfo {
  roleId: string;
  roleName: string;
}

@Component({
  selector: 'app-entitlement-catalog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridAngular,
    TranslatePipe,
  ],
  template: `
    <!-- ============================================================ -->
    <!-- Top Toolbar                                                    -->
    <!-- ============================================================ -->
    <div class="entitlement-catalog-page">
      <header class="page-toolbar" role="toolbar" aria-label="Entitlement catalog toolbar">
        <div class="toolbar-left">
          <h1 class="page-title">{{ 'entitlements.title' | translate }}</h1>
          <span
            class="row-count-badge"
            aria-live="polite"
            aria-label="Total entitlement count">
            {{ rowCountSummary }}
          </span>
        </div>

        <div class="toolbar-right">
          <div class="toolbar-search">
            <i class="pi pi-search search-icon" aria-hidden="true"></i>
            <input
              type="text"
              class="toolbar-search-input"
              placeholder="Search entitlements..."
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchTermChange($event)"
              aria-label="Search entitlements by name, code or resource" />
          </div>

          <!-- Role Mapping View Toggle -->
          <button
            class="btn"
            [class.btn-primary]="roleMappingView"
            [class.btn-outline]="!roleMappingView"
            (click)="toggleRoleMappingView()"
            [attr.aria-pressed]="roleMappingView"
            aria-label="Toggle role mapping view">
            <i class="pi pi-sitemap" aria-hidden="true"></i>
            Role Mapping
          </button>

          <button
            class="btn btn-primary"
            (click)="openCreateDialog()"
            aria-label="Create a new entitlement">
            <i class="pi pi-plus" aria-hidden="true"></i>
            Create
          </button>

          <button
            class="btn btn-icon"
            (click)="refreshGrid()"
            aria-label="Refresh entitlement list">
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Main Content Area (filter panel + grid)                      -->
      <!-- ============================================================ -->
      <div class="content-area">
        <!-- Sidebar Filter Panel -->
        <aside
          class="filter-panel"
          [class.collapsed]="filterPanelCollapsed"
          role="search"
          aria-label="Entitlement filter panel">
          <div class="filter-panel-header">
            <h2 class="filter-title">Filters</h2>
            <button
              class="btn btn-icon btn-sm"
              (click)="filterPanelCollapsed = !filterPanelCollapsed"
              [attr.aria-label]="filterPanelCollapsed ? 'Expand filter panel' : 'Collapse filter panel'"
              aria-controls="ent-filter-panel-body">
              <i
                class="pi"
                [class.pi-chevron-left]="!filterPanelCollapsed"
                [class.pi-chevron-right]="filterPanelCollapsed"
                aria-hidden="true"></i>
            </button>
          </div>

          <div
            id="ent-filter-panel-body"
            class="filter-panel-body"
            *ngIf="!filterPanelCollapsed">
            <!-- Action filter -->
            <div class="filter-group">
              <label class="filter-label">Action</label>
              <div class="checkbox-group" role="group" aria-label="Filter by action">
                <label
                  *ngFor="let action of actionFilterOptions"
                  class="checkbox-label">
                  <input
                    type="checkbox"
                    [checked]="filters.actions.includes(action)"
                    (change)="toggleFilter('actions', action)"
                    [attr.aria-label]="'Filter action: ' + action" />
                  <span class="action-filter-badge" [attr.data-action]="action">{{ action }}</span>
                </label>
              </div>
            </div>

            <!-- Status filter -->
            <div class="filter-group">
              <label class="filter-label">Status</label>
              <div class="checkbox-group" role="group" aria-label="Filter by status">
                <label
                  *ngFor="let status of statusOptions"
                  class="checkbox-label">
                  <input
                    type="checkbox"
                    [checked]="filters.statuses.includes(status)"
                    (change)="toggleFilter('statuses', status)"
                    [attr.aria-label]="'Filter status: ' + status" />
                  <span
                    class="status-badge"
                    [class.status-active]="status === 'ACTIVE'"
                    [class.status-inactive]="status === 'INACTIVE'">
                    {{ status }}
                  </span>
                </label>
              </div>
            </div>

            <!-- Filter action buttons -->
            <div class="filter-actions">
              <button
                class="btn btn-primary btn-block"
                (click)="applyFilters()"
                aria-label="Apply filters">
                Apply Filters
              </button>
              <button
                class="btn btn-outline btn-block"
                (click)="clearFilters()"
                aria-label="Clear all filters">
                Clear Filters
              </button>
            </div>
          </div>
        </aside>

        <!-- ag-Grid -->
        <div class="grid-wrapper">
          <div class="ag-theme-alpine grid-container">
            <ag-grid-angular
              class="ag-grid"
              [columnDefs]="activeColumnDefs"
              [defaultColDef]="defaultColDef"
              [rowModelType]="'serverSide'"
              [pagination]="true"
              [paginationPageSize]="pageSize"
              [cacheBlockSize]="pageSize"
              [animateRows]="true"
              [overlayLoadingTemplate]="loadingOverlay"
              [overlayNoRowsTemplate]="noRowsOverlay"
              (gridReady)="onGridReady($event)">
            </ag-grid-angular>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Create / Edit Entitlement Dialog                             -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="entDialog.visible"
        (click)="closeEntDialog()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="entDialog.mode === 'create' ? 'Create entitlement dialog' : 'Edit entitlement dialog'">
        <div class="dialog-content dialog-wide" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">
            {{ entDialog.mode === 'create' ? 'Create Entitlement' : 'Edit Entitlement' }}
          </h3>

          <div *ngIf="entDialog.error" class="dialog-error" role="alert">
            {{ entDialog.error }}
          </div>

          <form
            [formGroup]="entForm"
            (ngSubmit)="submitEntDialog()"
            [attr.aria-label]="entDialog.mode === 'create' ? 'Create entitlement form' : 'Edit entitlement form'">

            <!-- Entitlement Name -->
            <div class="form-field">
              <label class="form-label" for="ent-name">
                Entitlement Name <span class="required">*</span>
              </label>
              <input
                id="ent-name"
                type="text"
                class="filter-input"
                formControlName="entitlementName"
                placeholder="e.g. User Profile Read"
                aria-required="true"
                [attr.aria-invalid]="entForm.get('entitlementName')?.invalid && entForm.get('entitlementName')?.touched" />
              <small
                class="field-error"
                *ngIf="entForm.get('entitlementName')?.invalid && entForm.get('entitlementName')?.touched"
                role="alert">
                Entitlement name is required.
              </small>
            </div>

            <!-- Entitlement Code -->
            <div class="form-field">
              <label class="form-label" for="ent-code">
                Entitlement Code <span class="required">*</span>
              </label>
              <input
                id="ent-code"
                type="text"
                class="filter-input"
                formControlName="entitlementCode"
                placeholder="e.g. USER_PROFILE_READ"
                aria-required="true"
                [attr.aria-invalid]="entForm.get('entitlementCode')?.invalid && entForm.get('entitlementCode')?.touched" />
              <small class="field-help">Auto-generated from name. Uppercase letters and underscores only.</small>
              <small
                class="field-error"
                *ngIf="entForm.get('entitlementCode')?.invalid && entForm.get('entitlementCode')?.touched"
                role="alert">
                <span *ngIf="entForm.get('entitlementCode')?.errors?.['required']">Code is required.</span>
                <span *ngIf="entForm.get('entitlementCode')?.errors?.['pattern']">Must be uppercase letters and underscores only.</span>
              </small>
            </div>

            <!-- Resource -->
            <div class="form-field">
              <label class="form-label" for="ent-resource">
                Resource <span class="required">*</span>
              </label>
              <input
                id="ent-resource"
                type="text"
                class="filter-input"
                formControlName="resource"
                placeholder="e.g. /api/users, user-profile"
                aria-required="true" />
              <small
                class="field-error"
                *ngIf="entForm.get('resource')?.invalid && entForm.get('resource')?.touched"
                role="alert">
                Resource is required.
              </small>
            </div>

            <!-- Action -->
            <div class="form-field">
              <label class="form-label" for="ent-action">
                Action <span class="required">*</span>
              </label>
              <select
                id="ent-action"
                class="filter-input"
                formControlName="action"
                aria-required="true">
                <option value="" disabled>Select action</option>
                <option *ngFor="let opt of actionDropdownOptions" [value]="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <!-- Status Toggle -->
            <div class="form-field">
              <label class="form-label">Status</label>
              <div class="switch-row">
                <label class="toggle-switch" for="ent-status-toggle">
                  <input
                    id="ent-status-toggle"
                    type="checkbox"
                    formControlName="statusActive"
                    aria-label="Entitlement active status" />
                  <span class="toggle-slider"></span>
                </label>
                <span
                  class="switch-label-text"
                  [class.switch-active]="entForm.get('statusActive')?.value"
                  [class.switch-inactive]="!entForm.get('statusActive')?.value">
                  {{ entForm.get('statusActive')?.value ? 'ACTIVE' : 'INACTIVE' }}
                </span>
              </div>
            </div>

            <div class="dialog-actions">
              <button
                type="button"
                class="btn btn-outline"
                (click)="closeEntDialog()"
                aria-label="Cancel">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="entForm.invalid || entDialog.submitting"
                [attr.aria-label]="entDialog.mode === 'create' ? 'Create entitlement' : 'Save entitlement'">
                <i class="pi pi-spin pi-spinner" *ngIf="entDialog.submitting" aria-hidden="true"></i>
                {{ entDialog.submitting
                    ? (entDialog.mode === 'create' ? 'Creating...' : 'Saving...')
                    : (entDialog.mode === 'create' ? 'Create' : 'Save Changes') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Delete Confirmation Dialog                                   -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="deleteDialog.visible"
        (click)="closeDeleteDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Delete entitlement confirmation">
        <div class="dialog-content" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Delete Entitlement</h3>
          <p class="dialog-message">
            Are you sure you want to permanently delete
            <strong>{{ deleteDialog.entitlementName }}</strong>?
          </p>
          <p class="dialog-warning">
            This action cannot be undone. All role mappings for this entitlement will be removed.
          </p>
          <div class="dialog-actions">
            <button class="btn btn-outline" (click)="closeDeleteDialog()" aria-label="Cancel">
              Cancel
            </button>
            <button
              class="btn btn-danger"
              (click)="executeDelete()"
              [disabled]="deleteDialog.loading"
              aria-label="Confirm deletion">
              <i class="pi pi-spin pi-spinner" *ngIf="deleteDialog.loading" aria-hidden="true"></i>
              {{ deleteDialog.loading ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ============================================================ */
    /* Layout                                                        */
    /* ============================================================ */
    .entitlement-catalog-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 0;
    }

    .content-area {
      display: flex;
      flex: 1;
      min-height: 0;
      gap: 0;
    }

    /* ============================================================ */
    /* Top Toolbar                                                   */
    /* ============================================================ */
    .page-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: var(--innait-surface, #fff);
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .page-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
      color: var(--innait-text, #212121);
    }

    .row-count-badge {
      font-size: 0.75rem;
      color: var(--innait-text-secondary, #757575);
      background: #f5f5f5;
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .toolbar-search {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 0.625rem;
      color: #9e9e9e;
      font-size: 0.875rem;
      pointer-events: none;
    }

    .toolbar-search-input {
      padding: 0.4375rem 0.75rem 0.4375rem 2rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 0.875rem;
      width: 240px;
      outline: none;
      transition: border-color 0.15s;
    }

    .toolbar-search-input:focus {
      border-color: var(--innait-primary, #1976d2);
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
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
    .btn-icon { padding: 0.4375rem; background: transparent; border: 1px solid #e0e0e0; border-radius: 4px; cursor: pointer; color: var(--innait-text, #212121); }
    .btn-icon:hover { background: #f5f5f5; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
    .btn-block { width: 100%; justify-content: center; }

    /* ============================================================ */
    /* Filter Panel                                                  */
    /* ============================================================ */
    .filter-panel {
      width: 260px;
      min-width: 260px;
      background: var(--innait-surface, #fff);
      border-right: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      flex-shrink: 0;
      transition: width 0.2s, min-width 0.2s;
    }

    .filter-panel.collapsed { width: 44px; min-width: 44px; }

    .filter-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .filter-title {
      font-size: 0.875rem;
      font-weight: 600;
      margin: 0;
      color: var(--innait-text, #212121);
    }

    .collapsed .filter-title { display: none; }

    .filter-panel-body {
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .filter-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--innait-text-secondary, #757575);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      cursor: pointer;
      color: var(--innait-text, #212121);
    }

    .checkbox-label input[type='checkbox'] { margin: 0; cursor: pointer; }

    .filter-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #e0e0e0;
    }

    /* ============================================================ */
    /* Badges                                                        */
    /* ============================================================ */
    .status-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    .status-active { background: #e8f5e9; color: #2e7d32; }
    .status-inactive { background: #f5f5f5; color: #616161; }

    .action-filter-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    .action-filter-badge[data-action='READ'] { background: #e3f2fd; color: #1565c0; }
    .action-filter-badge[data-action='WRITE'] { background: #e8f5e9; color: #2e7d32; }
    .action-filter-badge[data-action='DELETE'] { background: #fbe9e7; color: #d32f2f; }
    .action-filter-badge[data-action='EXECUTE'] { background: #f3e5f5; color: #7b1fa2; }
    .action-filter-badge[data-action='ADMIN'] { background: #fff3e0; color: #e65100; }

    /* ============================================================ */
    /* Grid                                                          */
    /* ============================================================ */
    .grid-wrapper {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .grid-container { flex: 1; min-height: 0; }
    .ag-grid { width: 100%; height: 100%; }

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

    :host ::ng-deep .status-cell-active { background: #e8f5e9; color: #2e7d32; }
    :host ::ng-deep .status-cell-inactive { background: #f5f5f5; color: #616161; }

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

    :host ::ng-deep .role-chip {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 500;
      background: #e3f2fd;
      color: #1565c0;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      margin: 0.0625rem 0.125rem;
    }

    :host ::ng-deep .action-link {
      color: var(--innait-primary, #1976d2);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.8125rem;
      cursor: pointer;
      margin-right: 0.625rem;
    }

    :host ::ng-deep .action-link:hover { text-decoration: underline; }

    :host ::ng-deep .action-link-danger {
      color: #d32f2f;
      text-decoration: none;
      font-weight: 500;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    :host ::ng-deep .action-link-danger:hover { text-decoration: underline; }

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

    .dialog-wide { width: 520px; }

    .dialog-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
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

    .dialog-error {
      font-size: 0.8125rem;
      color: #d32f2f;
      background: #fbe9e7;
      border: 1px solid #ffccbc;
      border-radius: 4px;
      padding: 0.625rem 0.75rem;
      margin: 0 0 1rem 0;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    /* ============================================================ */
    /* Form Fields                                                   */
    /* ============================================================ */
    .form-field { margin-bottom: 1rem; }

    .form-label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--innait-text, #212121);
      margin-bottom: 0.375rem;
    }

    .required { color: #d32f2f; }

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

    .field-help {
      display: block;
      font-size: 0.75rem;
      color: var(--innait-text-secondary, #757575);
      margin-top: 0.25rem;
    }

    .field-error {
      display: block;
      font-size: 0.75rem;
      color: #d32f2f;
      margin-top: 0.25rem;
    }

    .switch-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    /* Custom toggle switch */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 22px;
      cursor: pointer;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      inset: 0;
      background: #ccc;
      border-radius: 22px;
      transition: background 0.2s;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle-switch input:checked + .toggle-slider {
      background: var(--innait-primary, #1976d2);
    }

    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(18px);
    }

    .switch-label-text {
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    .switch-active { background: #e8f5e9; color: #2e7d32; }
    .switch-inactive { background: #f5f5f5; color: #616161; }

    /* ============================================================ */
    /* Responsive                                                    */
    /* ============================================================ */
    @media (max-width: 768px) {
      .page-toolbar {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .toolbar-right { flex-wrap: wrap; }
      .toolbar-search-input { width: 100%; }
      .filter-panel { display: none; }
    }
  `],
})
export class EntitlementCatalogComponent implements OnInit, OnDestroy {
  // ----------------------------------------------------------------
  // Grid configuration
  // ----------------------------------------------------------------
  readonly pageSize = 50;

  readonly loadingOverlay =
    '<div class="ag-overlay-loading-center" role="status" aria-label="Loading entitlements">' +
    '<i class="pi pi-spin pi-spinner" style="font-size:1.5rem;margin-right:0.5rem"></i> Loading entitlements...' +
    '</div>';

  readonly noRowsOverlay =
    '<div class="ag-overlay-no-rows-center" role="status" aria-label="No entitlements found">' +
    '<i class="pi pi-inbox" style="font-size:2rem;margin-bottom:0.5rem;color:#bdbdbd"></i>' +
    '<p style="margin:0;color:#757575">No entitlements found matching your criteria.</p>' +
    '</div>';

  readonly defaultColDef: ColDef = {
    resizable: true,
    sortable: false,
    filter: false,
    suppressMenu: true,
  };

  // Base column definitions (without role mapping)
  private readonly baseColumnDefs: ColDef[] = [
    {
      field: 'entitlementName',
      headerName: 'Entitlement Name',
      sortable: true,
      filter: true,
      flex: 2,
    },
    {
      field: 'entitlementCode',
      headerName: 'Code',
      sortable: true,
      filter: true,
      flex: 1.5,
    },
    {
      field: 'resource',
      headerName: 'Resource',
      sortable: true,
      filter: true,
      flex: 1.5,
    },
    {
      field: 'action',
      headerName: 'Action',
      sortable: true,
      filter: true,
      flex: 1,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        const lower = params.value.toLowerCase();
        return `<span class="action-cell-badge action-${lower}">${params.value}</span>`;
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      sortable: true,
      filter: true,
      flex: 1,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        const lower = params.value.toLowerCase();
        return `<span class="status-cell-badge status-cell-${lower}">${params.value}</span>`;
      },
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      sortable: true,
      flex: 1,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        return this.formatDate(params.value);
      },
    },
    {
      headerName: 'Actions',
      flex: 1.2,
      pinned: 'right',
      sortable: false,
      cellRenderer: (params: { data: EntitlementRow }): string => {
        if (!params.data) return '';
        return `<a class="action-link" data-action="edit" data-ent-id="${params.data.id}">Edit</a>` +
               `<a class="action-link-danger" data-action="delete" data-ent-id="${params.data.id}">Delete</a>`;
      },
      onCellClicked: (params: CellClickedEvent) => {
        const target = params.event?.target as HTMLElement;
        if (!target || !params.data) return;
        const action = target.getAttribute('data-action');
        if (action === 'edit') {
          this.openEditDialog(params.data);
        } else if (action === 'delete') {
          this.openDeleteDialog(params.data);
        }
      },
    },
  ];

  // Additional column for role mapping view
  private readonly roleMappingCol: ColDef = {
    field: 'mappedRoles',
    headerName: 'Mapped Roles',
    flex: 2,
    sortable: false,
    cellRenderer: (params: { value: string[] }): string => {
      if (!params.value || params.value.length === 0) {
        return '<span style="color:#bdbdbd">None</span>';
      }
      return params.value
        .map((name: string) => `<span class="role-chip">${name}</span>`)
        .join('');
    },
  };

  activeColumnDefs: ColDef[] = [...this.baseColumnDefs];

  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  private gridApi!: GridApi;
  private readonly apiBase = '/api/v1/admin/entitlements';
  private readonly destroy$ = new Subject<void>();

  searchTerm = '';
  filterPanelCollapsed = false;
  totalElements = 0;
  rowCountSummary = 'Showing 0 of 0 entitlements';
  roleMappingView = false;

  readonly statusOptions: string[] = ['ACTIVE', 'INACTIVE'];
  readonly actionFilterOptions: string[] = ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'ADMIN'];
  readonly actionDropdownOptions: ActionOption[] = [
    { label: 'READ', value: 'READ' },
    { label: 'WRITE', value: 'WRITE' },
    { label: 'DELETE', value: 'DELETE' },
    { label: 'EXECUTE', value: 'EXECUTE' },
    { label: 'ADMIN', value: 'ADMIN' },
  ];

  filters = {
    search: '',
    statuses: [] as string[],
    actions: [] as string[],
  };

  // Create/Edit dialog
  entForm!: FormGroup;
  entDialog = {
    visible: false,
    mode: 'create' as 'create' | 'edit',
    editId: '',
    submitting: false,
    error: '',
  };

  // Delete dialog
  deleteDialog = {
    visible: false,
    entitlementId: '',
    entitlementName: '',
    loading: false,
  };

  // ----------------------------------------------------------------
  // RxJS
  // ----------------------------------------------------------------
  private readonly searchSubject$ = new Subject<string>();
  private searchSubscription!: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  // ================================================================
  // Lifecycle
  // ================================================================
  ngOnInit(): void {
    this.initForm();

    this.searchSubscription = this.searchSubject$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe((term) => {
        this.filters.search = term;
        this.refreshGrid();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubscription?.unsubscribe();
  }

  // ================================================================
  // Form initialization
  // ================================================================
  private initForm(): void {
    this.entForm = this.fb.group({
      entitlementName: ['', [Validators.required]],
      entitlementCode: ['', [Validators.required, Validators.pattern(/^[A-Z_]+$/)]],
      resource: ['', [Validators.required]],
      action: ['', [Validators.required]],
      statusActive: [true],
    });

    // Auto-generate code from name
    this.entForm.get('entitlementName')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((name: string) => {
        if (name && this.entDialog.mode === 'create') {
          const code = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '_');
          this.entForm.get('entitlementCode')?.setValue(code, { emitEvent: false });
        }
      });
  }

  // ================================================================
  // Grid events
  // ================================================================
  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.setGridOption('serverSideDatasource', this.createDatasource());
  }

  // ================================================================
  // Server-side datasource
  // ================================================================
  private createDatasource(): IServerSideDatasource {
    return {
      getRows: (params: IServerSideGetRowsParams): void => {
        const startRow = params.request.startRow ?? 0;
        const page = Math.floor(startRow / this.pageSize);

        let httpParams = new HttpParams()
          .set('page', page.toString())
          .set('size', this.pageSize.toString());

        const sortModel = params.request.sortModel;
        if (sortModel && sortModel.length > 0) {
          httpParams = httpParams.set('sort', `${sortModel[0]!.colId},${sortModel[0]!.sort}`);
        }

        if (this.filters.search) {
          httpParams = httpParams.set('search', this.filters.search);
        }

        if (this.filters.statuses.length > 0) {
          httpParams = httpParams.set('status', this.filters.statuses.join(','));
        }

        if (this.filters.actions.length > 0) {
          httpParams = httpParams.set('action', this.filters.actions.join(','));
        }

        this.http
          .get<ApiResponse<EntitlementRow[]>>(this.apiBase, { params: httpParams })
          .subscribe({
            next: (response) => {
              const rows = response.data ?? [];
              const total = response.meta?.totalElements ?? rows.length;
              this.totalElements = total;
              this.updateRowCountSummary(startRow, rows.length, total);

              if (this.roleMappingView) {
                this.loadRoleMappingsForRows(rows, params);
              } else {
                params.success({ rowData: rows, rowCount: total });
              }
            },
            error: () => params.fail(),
          });
      },
    };
  }

  /**
   * When role mapping view is active, fetch mapped roles for each entitlement
   * in the current page and enrich the rows before passing to the grid.
   */
  private loadRoleMappingsForRows(
    rows: EntitlementRow[],
    params: IServerSideGetRowsParams,
  ): void {
    if (rows.length === 0) {
      params.success({ rowData: rows, rowCount: 0 });
      return;
    }

    let completed = 0;
    const total = rows.length;

    rows.forEach((row) => {
      this.http
        .get<ApiResponse<MappedRoleInfo[]>>(`${this.apiBase}/${row.id}/roles`)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            row.mappedRoles = (response.data ?? []).map((r) => r.roleName);
            completed++;
            if (completed === total) {
              params.success({ rowData: rows, rowCount: this.totalElements });
            }
          },
          error: () => {
            row.mappedRoles = [];
            completed++;
            if (completed === total) {
              params.success({ rowData: rows, rowCount: this.totalElements });
            }
          },
        });
    });
  }

  // ================================================================
  // Role Mapping View Toggle
  // ================================================================
  toggleRoleMappingView(): void {
    this.roleMappingView = !this.roleMappingView;

    if (this.roleMappingView) {
      // Insert the role mapping column before the actions column
      const cols = [...this.baseColumnDefs];
      cols.splice(cols.length - 1, 0, this.roleMappingCol);
      this.activeColumnDefs = cols;
    } else {
      this.activeColumnDefs = [...this.baseColumnDefs];
    }

    // Refresh grid with new columns
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.activeColumnDefs);
      this.gridApi.setGridOption('serverSideDatasource', this.createDatasource());
    }
  }

  // ================================================================
  // Search & Filters
  // ================================================================
  onSearchTermChange(term: string): void {
    this.searchSubject$.next(term);
  }

  toggleFilter(filterKey: 'statuses' | 'actions', value: string): void {
    const list = this.filters[filterKey];
    const index = list.indexOf(value);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(value);
    }
  }

  applyFilters(): void {
    this.refreshGrid();
  }

  clearFilters(): void {
    this.filters = { search: '', statuses: [], actions: [] };
    this.searchTerm = '';
    this.refreshGrid();
  }

  refreshGrid(): void {
    if (this.gridApi) {
      this.gridApi.setGridOption('serverSideDatasource', this.createDatasource());
    }
  }

  // ================================================================
  // Create Dialog
  // ================================================================
  openCreateDialog(): void {
    this.entForm.reset({
      entitlementName: '',
      entitlementCode: '',
      resource: '',
      action: '',
      statusActive: true,
    });
    this.entDialog = {
      visible: true,
      mode: 'create',
      editId: '',
      submitting: false,
      error: '',
    };
  }

  // ================================================================
  // Edit Dialog
  // ================================================================
  openEditDialog(ent: EntitlementRow): void {
    this.entForm.reset({
      entitlementName: ent.entitlementName,
      entitlementCode: ent.entitlementCode,
      resource: ent.resource,
      action: ent.action,
      statusActive: ent.status === 'ACTIVE',
    });
    this.entDialog = {
      visible: true,
      mode: 'edit',
      editId: ent.id,
      submitting: false,
      error: '',
    };
  }

  closeEntDialog(): void {
    this.entDialog.visible = false;
  }

  submitEntDialog(): void {
    if (this.entForm.invalid) {
      this.entForm.markAllAsTouched();
      return;
    }

    this.entDialog.submitting = true;
    this.entDialog.error = '';

    const formValue = this.entForm.value;
    const payload = {
      entitlementName: formValue.entitlementName,
      entitlementCode: formValue.entitlementCode,
      resource: formValue.resource,
      action: formValue.action,
      status: formValue.statusActive ? 'ACTIVE' : 'INACTIVE',
    };

    const request$ = this.entDialog.mode === 'create'
      ? this.http.post<ApiResponse<Entitlement>>(this.apiBase, payload)
      : this.http.put<ApiResponse<Entitlement>>(
          `${this.apiBase}/${this.entDialog.editId}`,
          payload,
        );

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeEntDialog();
          this.refreshGrid();
        },
        error: (err) => {
          this.entDialog.submitting = false;
          this.entDialog.error =
            err?.error?.message ||
            `Failed to ${this.entDialog.mode} entitlement. Please try again.`;
        },
      });
  }

  // ================================================================
  // Delete
  // ================================================================
  openDeleteDialog(ent: EntitlementRow): void {
    this.deleteDialog = {
      visible: true,
      entitlementId: ent.id,
      entitlementName: ent.entitlementName,
      loading: false,
    };
  }

  closeDeleteDialog(): void {
    this.deleteDialog.visible = false;
  }

  executeDelete(): void {
    this.deleteDialog.loading = true;

    this.http
      .delete<ApiResponse<void>>(`${this.apiBase}/${this.deleteDialog.entitlementId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeDeleteDialog();
          this.refreshGrid();
        },
        error: () => {
          this.deleteDialog.loading = false;
        },
      });
  }

  // ================================================================
  // Helpers
  // ================================================================
  private updateRowCountSummary(startRow: number, fetchedCount: number, total: number): void {
    const from = total > 0 ? startRow + 1 : 0;
    const to = startRow + fetchedCount;
    this.rowCountSummary = `Showing ${from}-${to} of ${total} entitlements`;
  }

  private formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }
}
