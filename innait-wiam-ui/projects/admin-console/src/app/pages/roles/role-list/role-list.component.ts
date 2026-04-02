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
} from 'ag-grid-community';
import { AuthService, ApiResponse, PaginationMeta, Role } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface BulkStatusPayload {
  action: 'ACTIVATE' | 'DEACTIVATE';
  roleIds: string[];
}

@Component({
  selector: 'app-role-list',
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
    <div class="role-list-page">
      <header class="page-toolbar" role="toolbar" aria-label="Role management toolbar">
        <div class="toolbar-left">
          <h1 class="page-title">{{ 'roles.title' | translate }}</h1>
          <span
            class="row-count-badge"
            aria-live="polite"
            aria-label="Total role count">
            {{ rowCountSummary }}
          </span>
        </div>

        <div class="toolbar-right">
          <div class="toolbar-search">
            <i class="pi pi-search search-icon" aria-hidden="true"></i>
            <input
              type="text"
              class="toolbar-search-input"
              placeholder="Search roles..."
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchTermChange($event)"
              aria-label="Search roles by name or code" />
          </div>

          <button
            class="btn btn-primary"
            routerLink="/roles/create"
            aria-label="Create a new role">
            <i class="pi pi-plus" aria-hidden="true"></i>
            Create Role
          </button>

          <div class="export-dropdown" #exportDropdown>
            <button
              class="btn btn-outline"
              (click)="toggleExportMenu()"
              aria-haspopup="true"
              [attr.aria-expanded]="exportMenuOpen"
              aria-label="Export roles">
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
                <button class="export-menu-item" (click)="exportRoles('csv')">
                  <i class="pi pi-file" aria-hidden="true"></i>
                  Export as CSV
                </button>
              </li>
              <li role="menuitem">
                <button class="export-menu-item" (click)="exportRoles('xlsx')">
                  <i class="pi pi-file-excel" aria-hidden="true"></i>
                  Export as XLSX
                </button>
              </li>
            </ul>
          </div>

          <button
            class="btn btn-icon"
            (click)="refreshGrid()"
            aria-label="Refresh role list">
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Bulk Action Toolbar (visible when rows selected)             -->
      <!-- ============================================================ -->
      <div
        class="bulk-toolbar"
        *ngIf="selectedRoles.length > 0"
        role="toolbar"
        aria-label="Bulk actions for selected roles">
        <span class="selection-badge" aria-live="polite">
          {{ selectedRoles.length }} selected
        </span>

        <button
          class="btn btn-primary"
          (click)="confirmBulkAction('ACTIVATE')"
          aria-label="Activate selected roles">
          <i class="pi pi-check-circle" aria-hidden="true"></i>
          Activate Selected
        </button>

        <button
          class="btn btn-warning"
          (click)="confirmBulkAction('DEACTIVATE')"
          aria-label="Deactivate selected roles">
          <i class="pi pi-ban" aria-hidden="true"></i>
          Deactivate Selected
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
          aria-label="Role filter panel">
          <div class="filter-panel-header">
            <h2 class="filter-title">Filters</h2>
            <button
              class="btn btn-icon btn-sm"
              (click)="filterPanelCollapsed = !filterPanelCollapsed"
              [attr.aria-label]="filterPanelCollapsed ? 'Expand filter panel' : 'Collapse filter panel'"
              aria-controls="role-filter-panel-body">
              <i
                class="pi"
                [class.pi-chevron-left]="!filterPanelCollapsed"
                [class.pi-chevron-right]="filterPanelCollapsed"
                aria-hidden="true"></i>
            </button>
          </div>

          <div
            id="role-filter-panel-body"
            class="filter-panel-body"
            *ngIf="!filterPanelCollapsed">
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

            <!-- Role Type filter -->
            <div class="filter-group">
              <label class="filter-label">Role Type</label>
              <div class="checkbox-group" role="group" aria-label="Filter by role type">
                <label
                  *ngFor="let type of roleTypeOptions"
                  class="checkbox-label">
                  <input
                    type="checkbox"
                    [checked]="filters.roleTypes.includes(type)"
                    (change)="toggleFilter('roleTypes', type)"
                    [attr.aria-label]="'Filter role type: ' + type" />
                  <span class="type-badge" [attr.data-type]="type">{{ type }}</span>
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
              [columnDefs]="columnDefs"
              [defaultColDef]="defaultColDef"
              [rowModelType]="'serverSide'"
              [serverSideStoreType]="'partial'"
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
            {{ confirmDialog.count === 1 ? 'role' : 'roles' }}?
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
              [class.btn-primary]="confirmDialog.action === 'ACTIVATE'"
              [class.btn-warning]="confirmDialog.action === 'DEACTIVATE'"
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
    </div>
  `,
  styles: [`
    /* ============================================================ */
    /* Layout                                                        */
    /* ============================================================ */
    .role-list-page {
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
    /* Status / Type Badges                                          */
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

    .type-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      background: #e3f2fd;
      color: #1565c0;
    }

    .type-badge[data-type='SYSTEM'] {
      background: #fce4ec;
      color: #c62828;
    }

    .type-badge[data-type='TENANT'] {
      background: #e3f2fd;
      color: #1565c0;
    }

    .type-badge[data-type='APPLICATION'] {
      background: #f3e5f5;
      color: #7b1fa2;
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

    :host ::ng-deep .type-cell-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      line-height: 1.6;
    }

    :host ::ng-deep .type-cell-system {
      background: #fce4ec;
      color: #c62828;
    }

    :host ::ng-deep .type-cell-tenant {
      background: #e3f2fd;
      color: #1565c0;
    }

    :host ::ng-deep .type-cell-application {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    :host ::ng-deep .system-icon {
      font-size: 1rem;
    }

    :host ::ng-deep .system-yes {
      color: #2e7d32;
    }

    :host ::ng-deep .system-no {
      color: #bdbdbd;
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
export class RoleListComponent implements OnInit, OnDestroy {
  // ----------------------------------------------------------------
  // Grid configuration
  // ----------------------------------------------------------------
  readonly pageSize = 50;

  readonly loadingOverlay =
    '<div class="ag-overlay-loading-center" role="status" aria-label="Loading roles">' +
    '<i class="pi pi-spin pi-spinner" style="font-size:1.5rem;margin-right:0.5rem"></i> Loading roles...' +
    '</div>';

  readonly noRowsOverlay =
    '<div class="ag-overlay-no-rows-center" role="status" aria-label="No roles found">' +
    '<i class="pi pi-inbox" style="font-size:2rem;margin-bottom:0.5rem;color:#bdbdbd"></i>' +
    '<p style="margin:0;color:#757575">No roles found matching your criteria.</p>' +
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
      field: 'roleName',
      headerName: 'Role Name',
      sortable: true,
      filter: true,
      flex: 2,
    },
    {
      field: 'roleCode',
      headerName: 'Role Code',
      sortable: true,
      filter: true,
      flex: 1,
    },
    {
      field: 'roleType',
      headerName: 'Role Type',
      sortable: true,
      filter: true,
      flex: 1,
      cellRenderer: (params: { value: string }): string => {
        if (!params.value) return '';
        const lower = params.value.toLowerCase();
        return `<span class="type-cell-badge type-cell-${lower}">${params.value}</span>`;
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
      field: 'system',
      headerName: 'System',
      sortable: true,
      flex: 0.7,
      cellRenderer: (params: { value: boolean }): string => {
        if (params.value === true) {
          return '<i class="pi pi-check-circle system-icon system-yes" title="System role"></i>';
        }
        return '<i class="pi pi-minus-circle system-icon system-no" title="Non-system role"></i>';
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
      cellRenderer: (params: { data: Role }): string => {
        if (!params.data) return '';
        return `<a class="action-link" data-action="view" data-role-id="${params.data.id}">View Details</a>`;
      },
      onCellClicked: (params: { data: Role; event: Event }) => {
        const target = params.event?.target as HTMLElement;
        if (target?.getAttribute('data-action') === 'view' && params.data) {
          this.router.navigate(['/roles', params.data.id]);
        }
      },
    },
  ];

  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  private gridApi!: GridApi;
  private readonly apiBase = '/api/v1/admin/roles';

  searchTerm = '';
  exportMenuOpen = false;
  filterPanelCollapsed = false;
  selectedRoles: Role[] = [];
  totalElements = 0;
  rowCountSummary = 'Showing 0 of 0 roles';

  readonly statusOptions: string[] = ['ACTIVE', 'INACTIVE'];
  readonly roleTypeOptions: string[] = ['SYSTEM', 'TENANT', 'APPLICATION'];

  filters = {
    search: '',
    statuses: [] as string[],
    roleTypes: [] as string[],
  };

  confirmDialog = {
    visible: false,
    action: '' as BulkStatusPayload['action'],
    count: 0,
    loading: false,
  };

  // ----------------------------------------------------------------
  // RxJS subjects and subscriptions
  // ----------------------------------------------------------------
  private readonly searchSubject$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private searchSubscription!: Subscription;
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
    this.searchSubscription = this.searchSubject$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe((term) => {
        this.filters.search = term;
        this.refreshGrid();
      });

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
    this.gridApi.setServerSideDatasource(this.createDatasource());
  }

  onSelectionChanged(_event: SelectionChangedEvent): void {
    this.selectedRoles = this.gridApi.getSelectedRows() as Role[];
  }

  onRowClicked(event: RowClickedEvent): void {
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
      this.router.navigate(['/roles', event.data.id]);
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
          const sortCol = sortModel[0].colId;
          const sortDir = sortModel[0].sort;
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

        // Role type filter
        if (this.filters.roleTypes.length > 0) {
          httpParams = httpParams.set('roleType', this.filters.roleTypes.join(','));
        }

        this.http
          .get<ApiResponse<Role[]>>(this.apiBase, { params: httpParams })
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
  toggleFilter(filterKey: 'statuses' | 'roleTypes', value: string): void {
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
      roleTypes: [],
    };
    this.searchTerm = '';
    this.refreshGrid();
  }

  // ================================================================
  // Grid refresh
  // ================================================================
  refreshGrid(): void {
    if (this.gridApi) {
      this.gridApi.setServerSideDatasource(this.createDatasource());
    }
  }

  // ================================================================
  // Export
  // ================================================================
  toggleExportMenu(): void {
    this.exportMenuOpen = !this.exportMenuOpen;
  }

  exportRoles(format: 'csv' | 'xlsx'): void {
    this.exportMenuOpen = false;
    const params = new HttpParams().set('format', format);
    this.http
      .get(`${this.apiBase}/export`, { params, responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `roles-export.${format}`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => {
          // Error handled by HTTP interceptor
        },
      });
  }

  // ================================================================
  // Bulk actions
  // ================================================================
  confirmBulkAction(action: BulkStatusPayload['action']): void {
    this.confirmDialog = {
      visible: true,
      action,
      count: this.selectedRoles.length,
      loading: false,
    };
  }

  closeConfirmDialog(): void {
    this.confirmDialog = {
      visible: false,
      action: '' as BulkStatusPayload['action'],
      count: 0,
      loading: false,
    };
  }

  executeBulkAction(): void {
    this.confirmDialog.loading = true;
    const payload: BulkStatusPayload = {
      action: this.confirmDialog.action,
      roleIds: this.selectedRoles.map((r) => r.id),
    };

    this.http
      .post<ApiResponse<void>>(`${this.apiBase}/bulk-status`, payload)
      .subscribe({
        next: () => {
          this.closeConfirmDialog();
          this.selectedRoles = [];
          this.refreshGrid();
        },
        error: () => {
          this.confirmDialog.loading = false;
        },
      });
  }

  // ================================================================
  // Helpers
  // ================================================================
  private updateRowCountSummary(startRow: number, fetchedCount: number, total: number): void {
    const from = total > 0 ? startRow + 1 : 0;
    const to = startRow + fetchedCount;
    this.rowCountSummary = `Showing ${from}-${to} of ${total} roles`;
  }

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
