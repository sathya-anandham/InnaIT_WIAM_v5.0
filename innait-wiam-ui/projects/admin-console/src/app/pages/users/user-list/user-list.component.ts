import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  RowClickedEvent,
  SelectionChangedEvent,
  GridOptions,
  CellClickedEvent,
} from 'ag-grid-community';
import { AuthService, ApiResponse, PaginationMeta, User } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/**
 * Extended user representation that merges User + Account fields
 * as returned by the admin users API.
 */
interface AdminUserRow extends User {
  lastLoginAt?: string;
}

interface BulkActionPayload {
  action: 'SUSPEND' | 'DISABLE' | 'TERMINATE' | 'ASSIGN_ROLE';
  userIds: string[];
  roleId?: string;
}

interface RoleOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AgGridAngular,
    TranslatePipe,
  ],
  template: `
    <!-- ============================================================ -->
    <!-- Top Toolbar                                                    -->
    <!-- ============================================================ -->
    <div class="user-list-page">
      <header class="page-toolbar" role="toolbar" aria-label="User management toolbar">
        <div class="toolbar-left">
          <h1 class="page-title">User Management</h1>
          <span
            class="row-count-badge"
            aria-live="polite"
            aria-label="Total user count">
            {{ rowCountSummary }}
          </span>
        </div>

        <div class="toolbar-right">
          <div class="toolbar-search">
            <i class="pi pi-search search-icon" aria-hidden="true"></i>
            <input
              type="text"
              class="toolbar-search-input"
              placeholder="Search users..."
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchTermChange($event)"
              aria-label="Search users by name, email or login ID" />
          </div>

          <button
            class="btn btn-primary"
            routerLink="/users/create"
            aria-label="Create a new user">
            <i class="pi pi-user-plus" aria-hidden="true"></i>
            Create User
          </button>

          <button
            class="btn btn-outline"
            routerLink="/users/bulk/import"
            aria-label="Bulk import users">
            <i class="pi pi-upload" aria-hidden="true"></i>
            Bulk Import
          </button>

          <div class="export-dropdown" #exportDropdown>
            <button
              class="btn btn-outline"
              (click)="toggleExportMenu()"
              aria-haspopup="true"
              [attr.aria-expanded]="exportMenuOpen"
              aria-label="Export users">
              <i class="pi pi-download" aria-hidden="true"></i>
              Export
              <i class="pi pi-chevron-down export-chevron" aria-hidden="true"></i>
            </button>
            <ul
              *ngIf="exportMenuOpen"
              class="export-menu"
              role="menu"
              aria-label="Export format options">
              <li role="menuitem">
                <button class="export-menu-item" (click)="exportUsers('csv')">
                  <i class="pi pi-file" aria-hidden="true"></i>
                  Export as CSV
                </button>
              </li>
              <li role="menuitem">
                <button class="export-menu-item" (click)="exportUsers('xlsx')">
                  <i class="pi pi-file-excel" aria-hidden="true"></i>
                  Export as XLSX
                </button>
              </li>
            </ul>
          </div>

          <button
            class="btn btn-icon"
            (click)="refreshGrid()"
            aria-label="Refresh user list">
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Bulk Action Toolbar (visible when rows selected)             -->
      <!-- ============================================================ -->
      <div
        class="bulk-toolbar"
        *ngIf="selectedUsers.length > 0"
        role="toolbar"
        aria-label="Bulk actions for selected users">
        <span class="selection-badge" aria-live="polite">
          {{ selectedUsers.length }} selected
        </span>

        <button
          class="btn btn-warning"
          (click)="confirmBulkAction('SUSPEND')"
          aria-label="Suspend selected users">
          <i class="pi pi-ban" aria-hidden="true"></i>
          Suspend Selected
        </button>

        <button
          class="btn btn-danger-outline"
          (click)="confirmBulkAction('DISABLE')"
          aria-label="Disable selected users">
          <i class="pi pi-times-circle" aria-hidden="true"></i>
          Disable Selected
        </button>

        <button
          class="btn btn-danger"
          (click)="confirmBulkAction('TERMINATE')"
          aria-label="Terminate selected users">
          <i class="pi pi-trash" aria-hidden="true"></i>
          Terminate Selected
        </button>

        <button
          class="btn btn-outline"
          (click)="openAssignRoleDialog()"
          aria-label="Assign role to selected users">
          <i class="pi pi-shield" aria-hidden="true"></i>
          Assign Role
        </button>
      </div>

      <!-- ============================================================ -->
      <!-- Main Content Area (filter panel + grid)                      -->
      <!-- ============================================================ -->
      <div class="content-area">
        <!-- Sidebar Filter Panel -->
        <aside
          class="filter-panel"
          [class.collapsed]="filterPanelCollapsed"
          role="search"
          aria-label="User filter panel">
          <div class="filter-panel-header">
            <h2 class="filter-title">Filters</h2>
            <button
              class="btn btn-icon btn-sm"
              (click)="filterPanelCollapsed = !filterPanelCollapsed"
              [attr.aria-label]="filterPanelCollapsed ? 'Expand filter panel' : 'Collapse filter panel'"
              aria-controls="filter-panel-body">
              <i
                class="pi"
                [class.pi-chevron-left]="!filterPanelCollapsed"
                [class.pi-chevron-right]="filterPanelCollapsed"
                aria-hidden="true"></i>
            </button>
          </div>

          <div
            id="filter-panel-body"
            class="filter-panel-body"
            *ngIf="!filterPanelCollapsed">
            <!-- Search filter -->
            <div class="filter-group">
              <label class="filter-label" for="filter-search">Search</label>
              <input
                id="filter-search"
                type="text"
                class="filter-input"
                placeholder="Name, email, login ID..."
                [(ngModel)]="filters.search"
                aria-label="Filter by name, email or login ID" />
            </div>

            <!-- Status multi-select -->
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
                    [class.status-inactive]="status === 'INACTIVE'"
                    [class.status-suspended]="status === 'SUSPENDED'">
                    {{ status }}
                  </span>
                </label>
              </div>
            </div>

            <!-- User Type multi-select -->
            <div class="filter-group">
              <label class="filter-label">User Type</label>
              <div class="checkbox-group" role="group" aria-label="Filter by user type">
                <label
                  *ngFor="let type of userTypeOptions"
                  class="checkbox-label">
                  <input
                    type="checkbox"
                    [checked]="filters.userTypes.includes(type)"
                    (change)="toggleFilter('userTypes', type)"
                    [attr.aria-label]="'Filter user type: ' + type" />
                  {{ type }}
                </label>
              </div>
            </div>

            <!-- Department text input -->
            <div class="filter-group">
              <label class="filter-label" for="filter-department">Department</label>
              <input
                id="filter-department"
                type="text"
                class="filter-input"
                placeholder="Filter by department..."
                [(ngModel)]="filters.department"
                aria-label="Filter by department" />
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
              [columnDefs]="columnDefs"
              [defaultColDef]="defaultColDef"
              [rowModelType]="'serverSide'"
              [pagination]="true"
              [paginationPageSize]="pageSize"
              [cacheBlockSize]="pageSize"
              [rowSelection]="'multiple'"
              [suppressRowClickSelection]="true"
              [animateRows]="true"
              [overlayLoadingTemplate]="loadingOverlay"
              [overlayNoRowsTemplate]="noRowsOverlay"
              (gridReady)="onGridReady($event)"
              (selectionChanged)="onSelectionChanged($event)"
              (rowClicked)="onRowClicked($event)">
            </ag-grid-angular>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Confirmation Dialog                                          -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="confirmDialog.visible"
        (click)="closeConfirmDialog()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Confirm ' + confirmDialog.action + ' action'">
        <div class="dialog-content" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Confirm {{ confirmDialog.action }}</h3>
          <p class="dialog-message">
            Are you sure you want to <strong>{{ confirmDialog.action | lowercase }}</strong>
            <strong>{{ confirmDialog.count }}</strong>
            {{ confirmDialog.count === 1 ? 'user' : 'users' }}?
          </p>
          <p class="dialog-warning" *ngIf="confirmDialog.action === 'TERMINATE'">
            This action cannot be undone. All associated accounts and data will be permanently removed.
          </p>
          <div class="dialog-actions">
            <button
              class="btn btn-outline"
              (click)="closeConfirmDialog()"
              aria-label="Cancel action">
              Cancel
            </button>
            <button
              class="btn"
              [class.btn-danger]="confirmDialog.action === 'TERMINATE'"
              [class.btn-warning]="confirmDialog.action === 'SUSPEND'"
              [class.btn-primary]="confirmDialog.action === 'DISABLE'"
              (click)="executeBulkAction()"
              [disabled]="confirmDialog.loading"
              [attr.aria-label]="'Confirm ' + confirmDialog.action">
              <i
                class="pi pi-spin pi-spinner"
                *ngIf="confirmDialog.loading"
                aria-hidden="true"></i>
              {{ confirmDialog.loading ? 'Processing...' : 'Confirm' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Assign Role Dialog                                           -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="roleDialog.visible"
        (click)="closeRoleDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Assign role dialog">
        <div class="dialog-content dialog-wide" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Assign Role</h3>
          <p class="dialog-message">
            Assign a role to <strong>{{ selectedUsers.length }}</strong>
            {{ selectedUsers.length === 1 ? 'user' : 'users' }}.
          </p>

          <div class="filter-group">
            <label class="filter-label" for="role-search-input">Search Role</label>
            <input
              id="role-search-input"
              type="text"
              class="filter-input"
              placeholder="Type to search roles..."
              [(ngModel)]="roleDialog.searchTerm"
              (ngModelChange)="onRoleSearchChange($event)"
              aria-label="Search for a role to assign" />
          </div>

          <ul
            class="role-list"
            *ngIf="roleDialog.roles.length > 0"
            role="listbox"
            aria-label="Available roles">
            <li
              *ngFor="let role of roleDialog.roles"
              class="role-item"
              [class.selected]="roleDialog.selectedRoleId === role.id"
              (click)="roleDialog.selectedRoleId = role.id"
              role="option"
              [attr.aria-selected]="roleDialog.selectedRoleId === role.id">
              {{ role.name }}
            </li>
          </ul>
          <p *ngIf="roleDialog.roles.length === 0 && roleDialog.searchTerm" class="no-results">
            No roles found matching "{{ roleDialog.searchTerm }}".
          </p>

          <div class="dialog-actions">
            <button
              class="btn btn-outline"
              (click)="closeRoleDialog()"
              aria-label="Cancel role assignment">
              Cancel
            </button>
            <button
              class="btn btn-primary"
              (click)="executeAssignRole()"
              [disabled]="!roleDialog.selectedRoleId || roleDialog.loading"
              aria-label="Confirm role assignment">
              <i
                class="pi pi-spin pi-spinner"
                *ngIf="roleDialog.loading"
                aria-hidden="true"></i>
              {{ roleDialog.loading ? 'Assigning...' : 'Assign Role' }}
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
    .user-list-page {
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
      width: 220px;
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

    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--innait-primary, #1976d2);
      color: #fff;
      border-color: var(--innait-primary, #1976d2);
    }

    .btn-primary:hover:not(:disabled) {
      background: #1565c0;
      border-color: #1565c0;
    }

    .btn-outline {
      background: transparent;
      color: var(--innait-text, #212121);
      border-color: #e0e0e0;
    }

    .btn-outline:hover:not(:disabled) {
      background: #f5f5f5;
      border-color: #bdbdbd;
    }

    .btn-warning {
      background: #f57c00;
      color: #fff;
      border-color: #f57c00;
    }

    .btn-warning:hover:not(:disabled) {
      background: #ef6c00;
    }

    .btn-danger {
      background: #d32f2f;
      color: #fff;
      border-color: #d32f2f;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c62828;
    }

    .btn-danger-outline {
      background: transparent;
      color: #d32f2f;
      border-color: #d32f2f;
    }

    .btn-danger-outline:hover:not(:disabled) {
      background: rgba(211, 47, 47, 0.06);
    }

    .btn-icon {
      padding: 0.4375rem;
      background: transparent;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      cursor: pointer;
      color: var(--innait-text, #212121);
    }

    .btn-icon:hover {
      background: #f5f5f5;
    }

    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .btn-block {
      width: 100%;
      justify-content: center;
    }

    /* ============================================================ */
    /* Export Dropdown                                                */
    /* ============================================================ */
    .export-dropdown {
      position: relative;
    }

    .export-chevron {
      font-size: 0.625rem;
      margin-left: 0.125rem;
    }

    .export-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 0.25rem;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      list-style: none;
      padding: 0.25rem 0;
      z-index: 50;
      min-width: 160px;
    }

    .export-menu-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.5rem 0.875rem;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 0.8125rem;
      color: var(--innait-text, #212121);
      text-align: left;
    }

    .export-menu-item:hover {
      background: #f5f5f5;
    }

    /* ============================================================ */
    /* Bulk Action Toolbar                                           */
    /* ============================================================ */
    .bulk-toolbar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #e3f2fd;
      border-bottom: 1px solid #bbdefb;
      flex-shrink: 0;
    }

    .selection-badge {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--innait-primary, #1976d2);
      background: #fff;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      border: 1px solid #bbdefb;
      margin-right: 0.5rem;
    }

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

    .filter-panel.collapsed {
      width: 44px;
      min-width: 44px;
    }

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

    .collapsed .filter-title {
      display: none;
    }

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

    .checkbox-label input[type='checkbox'] {
      margin: 0;
      cursor: pointer;
    }

    .filter-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #e0e0e0;
    }

    /* ============================================================ */
    /* Status Badges                                                 */
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

    .status-active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-inactive {
      background: #f5f5f5;
      color: #616161;
    }

    .status-suspended {
      background: #fff3e0;
      color: #e65100;
    }

    /* ============================================================ */
    /* Grid                                                          */
    /* ============================================================ */
    .grid-wrapper {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .grid-container {
      flex: 1;
      min-height: 0;
    }

    .ag-grid {
      width: 100%;
      height: 100%;
    }

    /* Cell renderers */
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

    :host ::ng-deep .status-cell-suspended {
      background: #fff3e0;
      color: #e65100;
    }

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

    .dialog-wide {
      width: 520px;
    }

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

    /* ============================================================ */
    /* Role Dialog                                                   */
    /* ============================================================ */
    .role-list {
      list-style: none;
      padding: 0;
      margin: 0.5rem 0 1rem;
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .role-item {
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      cursor: pointer;
      border-bottom: 1px solid #f5f5f5;
      transition: background 0.1s;
    }

    .role-item:last-child {
      border-bottom: none;
    }

    .role-item:hover {
      background: #f5f5f5;
    }

    .role-item.selected {
      background: #e3f2fd;
      color: var(--innait-primary, #1976d2);
      font-weight: 500;
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
      .page-toolbar {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .toolbar-right {
        flex-wrap: wrap;
      }

      .toolbar-search-input {
        width: 100%;
      }

      .filter-panel {
        display: none;
      }

      .bulk-toolbar {
        flex-wrap: wrap;
      }
    }
  `],
})
export class UserListComponent implements OnInit, OnDestroy {
  // ----------------------------------------------------------------
  // Grid configuration
  // ----------------------------------------------------------------
  readonly pageSize = 50;

  readonly loadingOverlay =
    '<div class="ag-overlay-loading-center" role="status" aria-label="Loading users">' +
    '<i class="pi pi-spin pi-spinner" style="font-size:1.5rem;margin-right:0.5rem"></i> Loading users...' +
    '</div>';

  readonly noRowsOverlay =
    '<div class="ag-overlay-no-rows-center" role="status" aria-label="No users found">' +
    '<i class="pi pi-inbox" style="font-size:2rem;margin-bottom:0.5rem;color:#bdbdbd"></i>' +
    '<p style="margin:0;color:#757575">No users found matching your criteria.</p>' +
    '</div>';

  readonly defaultColDef: ColDef = {
    resizable: true,
    sortable: false,
    filter: false,
    suppressMenu: true,
  };

  readonly columnDefs: ColDef[] = [
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
    {
      field: 'displayName',
      headerName: 'Name',
      sortable: true,
      filter: true,
      flex: 2,
    },
    {
      field: 'email',
      headerName: 'Email',
      sortable: true,
      filter: true,
      flex: 2,
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
      field: 'userType',
      headerName: 'User Type',
      sortable: true,
      filter: true,
      flex: 1,
    },
    {
      field: 'department',
      headerName: 'Department',
      sortable: true,
      filter: true,
      flex: 1,
    },
    {
      field: 'lastLoginAt',
      headerName: 'Last Login',
      sortable: true,
      flex: 1,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '<span style="color:#bdbdbd">Never</span>';
        return this.formatDate(params.value);
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
      flex: 1,
      pinned: 'right',
      sortable: false,
      cellRenderer: (params: { data: AdminUserRow }): string => {
        if (!params.data) return '';
        return `<a class="action-link" data-action="view" data-user-id="${params.data.id}">View Details</a>`;
      },
      onCellClicked: (params: CellClickedEvent) => {
        const target = params.event?.target as HTMLElement;
        if (target?.getAttribute('data-action') === 'view' && params.data) {
          this.router.navigate(['/users', params.data.id]);
        }
      },
    },
  ];

  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  private gridApi!: GridApi;
  private readonly apiBase = '/api/v1/admin/users';

  searchTerm = '';
  exportMenuOpen = false;
  filterPanelCollapsed = false;
  selectedUsers: AdminUserRow[] = [];
  totalElements = 0;
  rowCountSummary = 'Showing 0 of 0 users';

  readonly statusOptions: User['status'][] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  readonly userTypeOptions: User['userType'][] = ['EMPLOYEE', 'CONTRACTOR', 'VENDOR', 'SERVICE'];

  filters = {
    search: '',
    statuses: [] as string[],
    userTypes: [] as string[],
    department: '',
  };

  confirmDialog = {
    visible: false,
    action: '' as BulkActionPayload['action'],
    count: 0,
    loading: false,
  };

  roleDialog = {
    visible: false,
    searchTerm: '',
    roles: [] as RoleOption[],
    selectedRoleId: '',
    loading: false,
  };

  // ----------------------------------------------------------------
  // RxJS subjects and subscriptions
  // ----------------------------------------------------------------
  private readonly searchSubject$ = new Subject<string>();
  private readonly roleSearchSubject$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private searchSubscription!: Subscription;
  private roleSearchSubscription!: Subscription;
  private documentClickListener: ((event: MouseEvent) => void) | null = null;

  @ViewChild('exportDropdown', { read: ElementRef })
  exportDropdownRef!: ElementRef<HTMLElement>;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  // ================================================================
  // Lifecycle
  // ================================================================
  ngOnInit(): void {
    // Debounced toolbar search
    this.searchSubscription = this.searchSubject$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe((term) => {
        this.filters.search = term;
        this.refreshGrid();
      });

    // Debounced role search
    this.roleSearchSubscription = this.roleSearchSubject$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((term) => this.fetchRoles(term));

    // Close export menu on outside click
    this.documentClickListener = (event: MouseEvent) => {
      if (
        this.exportMenuOpen &&
        this.exportDropdownRef &&
        !this.exportDropdownRef.nativeElement.contains(event.target as Node)
      ) {
        this.exportMenuOpen = false;
      }
    };
    document.addEventListener('click', this.documentClickListener);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubscription?.unsubscribe();
    this.roleSearchSubscription?.unsubscribe();
    if (this.documentClickListener) {
      document.removeEventListener('click', this.documentClickListener);
      this.documentClickListener = null;
    }
  }

  // ================================================================
  // Grid events
  // ================================================================
  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.setGridOption('serverSideDatasource', this.createDatasource());
  }

  onSelectionChanged(_event: SelectionChangedEvent): void {
    this.selectedUsers = this.gridApi.getSelectedRows() as AdminUserRow[];
  }

  onRowClicked(event: RowClickedEvent): void {
    // Ignore clicks on checkboxes and action links
    const target = event.event?.target as HTMLElement;
    if (!target) return;
    if (
      target.closest('.ag-selection-checkbox') ||
      target.closest('.ag-cell-last-left-pinned') ||
      target.getAttribute('data-action') === 'view'
    ) {
      return;
    }
    if (event.data?.id) {
      this.router.navigate(['/users', event.data.id]);
    }
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

        // Sorting
        const sortModel = params.request.sortModel;
        if (sortModel && sortModel.length > 0) {
          const sortCol = sortModel[0]!.colId;
          const sortDir = sortModel[0]!.sort;
          httpParams = httpParams.set('sort', `${sortCol},${sortDir}`);
        }

        // Search
        if (this.filters.search) {
          httpParams = httpParams.set('search', this.filters.search);
        }

        // Status filter
        if (this.filters.statuses.length > 0) {
          httpParams = httpParams.set('status', this.filters.statuses.join(','));
        }

        // User type filter
        if (this.filters.userTypes.length > 0) {
          httpParams = httpParams.set('userType', this.filters.userTypes.join(','));
        }

        // Department filter
        if (this.filters.department) {
          httpParams = httpParams.set('department', this.filters.department);
        }

        this.http
          .get<ApiResponse<AdminUserRow[]>>(this.apiBase, { params: httpParams })
          .subscribe({
            next: (response) => {
              const rows = response.data ?? [];
              const total = response.meta?.totalElements ?? rows.length;
              this.totalElements = total;
              this.updateRowCountSummary(startRow, rows.length, total);

              params.success({
                rowData: rows,
                rowCount: total,
              });
            },
            error: () => {
              params.fail();
            },
          });
      },
    };
  }

  // ================================================================
  // Search
  // ================================================================
  onSearchTermChange(term: string): void {
    this.searchSubject$.next(term);
  }

  // ================================================================
  // Filters
  // ================================================================
  toggleFilter(filterKey: 'statuses' | 'userTypes', value: string): void {
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
    this.filters = {
      search: '',
      statuses: [],
      userTypes: [],
      department: '',
    };
    this.searchTerm = '';
    this.refreshGrid();
  }

  refreshGrid(): void {
    if (this.gridApi) {
      (this.gridApi as any).purgeServerSideCache?.();
    }
  }

  // ================================================================
  // Export
  // ================================================================
  toggleExportMenu(): void {
    this.exportMenuOpen = !this.exportMenuOpen;
  }

  exportUsers(format: 'csv' | 'xlsx'): void {
    this.exportMenuOpen = false;

    let httpParams = new HttpParams().set('format', format);

    // Include current filters in export
    if (this.filters.search) {
      httpParams = httpParams.set('search', this.filters.search);
    }
    if (this.filters.statuses.length > 0) {
      httpParams = httpParams.set('status', this.filters.statuses.join(','));
    }
    if (this.filters.userTypes.length > 0) {
      httpParams = httpParams.set('userType', this.filters.userTypes.join(','));
    }
    if (this.filters.department) {
      httpParams = httpParams.set('department', this.filters.department);
    }

    this.http
      .get(`${this.apiBase}/export`, {
        params: httpParams,
        responseType: 'blob',
        observe: 'response',
      })
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (!blob) return;

          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = `users-export.${format}`;
          if (contentDisposition) {
            const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match?.[1]) {
              filename = match[1].replace(/['"]/g, '');
            }
          }

          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          // Error handling: could integrate with a toast/notification service
          console.error('Failed to export users.');
        },
      });
  }

  // ================================================================
  // Bulk Actions
  // ================================================================
  confirmBulkAction(action: 'SUSPEND' | 'DISABLE' | 'TERMINATE'): void {
    this.confirmDialog = {
      visible: true,
      action,
      count: this.selectedUsers.length,
      loading: false,
    };
  }

  closeConfirmDialog(): void {
    if (!this.confirmDialog.loading) {
      this.confirmDialog.visible = false;
    }
  }

  executeBulkAction(): void {
    this.confirmDialog.loading = true;
    const payload: BulkActionPayload = {
      action: this.confirmDialog.action,
      userIds: this.selectedUsers.map((u) => u.id),
    };

    this.http.post<ApiResponse<unknown>>(`${this.apiBase}/bulk`, payload).subscribe({
      next: () => {
        this.confirmDialog.loading = false;
        this.confirmDialog.visible = false;
        this.selectedUsers = [];
        this.gridApi.deselectAll();
        this.refreshGrid();
      },
      error: () => {
        this.confirmDialog.loading = false;
        // Error handling: could integrate with a toast/notification service
        console.error(`Bulk ${this.confirmDialog.action} failed.`);
      },
    });
  }

  // ================================================================
  // Assign Role Dialog
  // ================================================================
  openAssignRoleDialog(): void {
    this.roleDialog = {
      visible: true,
      searchTerm: '',
      roles: [],
      selectedRoleId: '',
      loading: false,
    };
  }

  closeRoleDialog(): void {
    if (!this.roleDialog.loading) {
      this.roleDialog.visible = false;
    }
  }

  onRoleSearchChange(term: string): void {
    this.roleSearchSubject$.next(term);
  }

  private fetchRoles(search: string): void {
    if (!search || search.trim().length < 2) {
      this.roleDialog.roles = [];
      return;
    }

    this.http
      .get<ApiResponse<RoleOption[]>>('/api/v1/admin/roles', {
        params: new HttpParams().set('search', search).set('size', '20'),
      })
      .subscribe({
        next: (response) => {
          this.roleDialog.roles = response.data ?? [];
        },
        error: () => {
          this.roleDialog.roles = [];
        },
      });
  }

  executeAssignRole(): void {
    if (!this.roleDialog.selectedRoleId) return;

    this.roleDialog.loading = true;
    const payload: BulkActionPayload = {
      action: 'ASSIGN_ROLE',
      userIds: this.selectedUsers.map((u) => u.id),
      roleId: this.roleDialog.selectedRoleId,
    };

    this.http.post<ApiResponse<unknown>>(`${this.apiBase}/bulk`, payload).subscribe({
      next: () => {
        this.roleDialog.loading = false;
        this.roleDialog.visible = false;
        this.selectedUsers = [];
        this.gridApi.deselectAll();
        this.refreshGrid();
      },
      error: () => {
        this.roleDialog.loading = false;
        console.error('Assign role failed.');
      },
    });
  }

  // ================================================================
  // Helpers
  // ================================================================
  private updateRowCountSummary(startRow: number, fetchedCount: number, total: number): void {
    const endRow = Math.min(startRow + fetchedCount, total);
    if (total === 0) {
      this.rowCountSummary = 'Showing 0 of 0 users';
    } else {
      this.rowCountSummary = `Showing ${startRow + 1}\u2013${endRow} of ${total} users`;
    }
  }

  private formatDate(isoString: string): string {
    try {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch {
      return isoString;
    }
  }
}
