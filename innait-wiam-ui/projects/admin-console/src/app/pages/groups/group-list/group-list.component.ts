import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
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
import { AuthService, ApiResponse, PaginationMeta, Group } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface GroupRow extends Group {
  memberCount?: number;
}

interface GroupTypeOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    AgGridAngular,
    TranslatePipe,
  ],
  template: `
    <!-- ============================================================ -->
    <!-- Top Toolbar                                                    -->
    <!-- ============================================================ -->
    <div class="group-list-page">
      <header class="page-toolbar" role="toolbar" aria-label="Group management toolbar">
        <div class="toolbar-left">
          <h1 class="page-title">{{ 'groups.title' | translate }}</h1>
          <span
            class="row-count-badge"
            aria-live="polite"
            aria-label="Total group count">
            {{ rowCountSummary }}
          </span>
        </div>

        <div class="toolbar-right">
          <div class="toolbar-search">
            <i class="pi pi-search search-icon" aria-hidden="true"></i>
            <input
              type="text"
              class="toolbar-search-input"
              placeholder="Search groups..."
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchTermChange($event)"
              aria-label="Search groups by name or code" />
          </div>

          <button
            class="btn btn-primary"
            (click)="openCreateDialog()"
            aria-label="Create a new group">
            <i class="pi pi-plus" aria-hidden="true"></i>
            Create Group
          </button>

          <button
            class="btn btn-icon"
            (click)="refreshGrid()"
            aria-label="Refresh group list">
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
          aria-label="Group filter panel">
          <div class="filter-panel-header">
            <h2 class="filter-title">Filters</h2>
            <button
              class="btn btn-icon btn-sm"
              (click)="filterPanelCollapsed = !filterPanelCollapsed"
              [attr.aria-label]="filterPanelCollapsed ? 'Expand filter panel' : 'Collapse filter panel'"
              aria-controls="group-filter-panel-body">
              <i
                class="pi"
                [class.pi-chevron-left]="!filterPanelCollapsed"
                [class.pi-chevron-right]="filterPanelCollapsed"
                aria-hidden="true"></i>
            </button>
          </div>

          <div
            id="group-filter-panel-body"
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

            <!-- Group Type filter -->
            <div class="filter-group">
              <label class="filter-label">Group Type</label>
              <div class="checkbox-group" role="group" aria-label="Filter by group type">
                <label
                  *ngFor="let type of groupTypeFilterOptions"
                  class="checkbox-label">
                  <input
                    type="checkbox"
                    [checked]="filters.groupTypes.includes(type)"
                    (change)="toggleFilter('groupTypes', type)"
                    [attr.aria-label]="'Filter group type: ' + type" />
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
              [animateRows]="true"
              [overlayLoadingTemplate]="loadingOverlay"
              [overlayNoRowsTemplate]="noRowsOverlay"
              (gridReady)="onGridReady($event)"
              (rowClicked)="onRowClicked($event)">
            </ag-grid-angular>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Create Group Dialog                                          -->
      <!-- ============================================================ -->
      <div
        class="dialog-overlay"
        *ngIf="createDialog.visible"
        (click)="closeCreateDialog()"
        role="dialog"
        aria-modal="true"
        aria-label="Create group dialog">
        <div class="dialog-content dialog-wide" (click)="$event.stopPropagation()">
          <h3 class="dialog-title">Create Group</h3>

          <div *ngIf="createDialog.error" class="dialog-error" role="alert">
            {{ createDialog.error }}
          </div>

          <form
            [formGroup]="createForm"
            (ngSubmit)="submitCreateGroup()"
            aria-label="Create group form">

            <!-- Group Name -->
            <div class="form-field">
              <label class="form-label" for="create-groupName">
                Group Name <span class="required">*</span>
              </label>
              <input
                id="create-groupName"
                type="text"
                class="filter-input"
                formControlName="groupName"
                placeholder="e.g. Engineering Team"
                aria-required="true"
                [attr.aria-invalid]="createForm.get('groupName')?.invalid && createForm.get('groupName')?.touched" />
              <small
                class="field-error"
                *ngIf="createForm.get('groupName')?.invalid && createForm.get('groupName')?.touched"
                role="alert">
                Group name is required.
              </small>
            </div>

            <!-- Group Code -->
            <div class="form-field">
              <label class="form-label" for="create-groupCode">
                Group Code <span class="required">*</span>
              </label>
              <input
                id="create-groupCode"
                type="text"
                class="filter-input"
                formControlName="groupCode"
                placeholder="e.g. ENGINEERING_TEAM"
                aria-required="true"
                [attr.aria-invalid]="createForm.get('groupCode')?.invalid && createForm.get('groupCode')?.touched" />
              <small class="field-help">Auto-generated from group name.</small>
              <small
                class="field-error"
                *ngIf="createForm.get('groupCode')?.invalid && createForm.get('groupCode')?.touched"
                role="alert">
                <span *ngIf="createForm.get('groupCode')?.errors?.['required']">Group code is required.</span>
                <span *ngIf="createForm.get('groupCode')?.errors?.['pattern']">Must be uppercase letters and underscores only.</span>
              </small>
            </div>

            <!-- Group Type -->
            <div class="form-field">
              <label class="form-label" for="create-groupType">
                Group Type <span class="required">*</span>
              </label>
              <select
                id="create-groupType"
                class="filter-input"
                formControlName="groupType"
                aria-required="true">
                <option value="" disabled>Select group type</option>
                <option *ngFor="let opt of groupTypeDropdownOptions" [value]="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <!-- Description -->
            <div class="form-field">
              <label class="form-label" for="create-description">Description</label>
              <textarea
                id="create-description"
                class="filter-input"
                formControlName="description"
                rows="3"
                placeholder="Describe the purpose of this group...">
              </textarea>
            </div>

            <!-- Dynamic Rule (shown if DYNAMIC) -->
            <div class="form-field" *ngIf="createForm.get('groupType')?.value === 'DYNAMIC'">
              <label class="form-label" for="create-dynamicRule">
                Dynamic Rule <span class="required">*</span>
              </label>
              <textarea
                id="create-dynamicRule"
                class="filter-input dynamic-rule-input"
                formControlName="dynamicRule"
                rows="4"
                placeholder="Enter SpEL expression, e.g. #user.department == 'Engineering'"
                aria-describedby="dynamicRule-help">
              </textarea>
              <small id="dynamicRule-help" class="field-help">
                SpEL expression that determines group membership automatically.
              </small>
            </div>

            <div class="dialog-actions">
              <button
                type="button"
                class="btn btn-outline"
                (click)="closeCreateDialog()"
                aria-label="Cancel">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="createForm.invalid || createDialog.submitting"
                aria-label="Create group">
                <i class="pi pi-spin pi-spinner" *ngIf="createDialog.submitting" aria-hidden="true"></i>
                {{ createDialog.submitting ? 'Creating...' : 'Create Group' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ============================================================ */
    /* Layout                                                        */
    /* ============================================================ */
    .group-list-page {
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

    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-primary { background: var(--innait-primary, #1976d2); color: #fff; border-color: var(--innait-primary, #1976d2); }
    .btn-primary:hover:not(:disabled) { background: #1565c0; border-color: #1565c0; }
    .btn-outline { background: transparent; color: var(--innait-text, #212121); border-color: #e0e0e0; }
    .btn-outline:hover:not(:disabled) { background: #f5f5f5; border-color: #bdbdbd; }
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

    .type-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    .type-badge[data-type='STATIC'] { background: #e3f2fd; color: #1565c0; }
    .type-badge[data-type='DYNAMIC'] { background: #fff3e0; color: #e65100; }

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

    :host ::ng-deep .type-cell-static { background: #e3f2fd; color: #1565c0; }
    :host ::ng-deep .type-cell-dynamic { background: #fff3e0; color: #e65100; }

    :host ::ng-deep .action-link {
      color: var(--innait-primary, #1976d2);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    :host ::ng-deep .action-link:hover { text-decoration: underline; }

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
    .form-field {
      margin-bottom: 1rem;
    }

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

    .dynamic-rule-input {
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.8125rem;
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
export class GroupListComponent implements OnInit, OnDestroy {
  // ----------------------------------------------------------------
  // Grid configuration
  // ----------------------------------------------------------------
  readonly pageSize = 50;

  readonly loadingOverlay =
    '<div class="ag-overlay-loading-center" role="status" aria-label="Loading groups">' +
    '<i class="pi pi-spin pi-spinner" style="font-size:1.5rem;margin-right:0.5rem"></i> Loading groups...' +
    '</div>';

  readonly noRowsOverlay =
    '<div class="ag-overlay-no-rows-center" role="status" aria-label="No groups found">' +
    '<i class="pi pi-inbox" style="font-size:2rem;margin-bottom:0.5rem;color:#bdbdbd"></i>' +
    '<p style="margin:0;color:#757575">No groups found matching your criteria.</p>' +
    '</div>';

  readonly defaultColDef: ColDef = {
    resizable: true,
    sortable: false,
    filter: false,
    suppressMenu: true,
  };

  readonly columnDefs: ColDef[] = [
    {
      field: 'groupName',
      headerName: 'Group Name',
      sortable: true,
      filter: true,
      flex: 2,
    },
    {
      field: 'groupCode',
      headerName: 'Group Code',
      sortable: true,
      filter: true,
      flex: 1.5,
    },
    {
      field: 'groupType',
      headerName: 'Group Type',
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
      field: 'memberCount',
      headerName: 'Members',
      sortable: true,
      flex: 0.8,
      cellRenderer: (params: { value: number }): string => {
        const count = params.value ?? 0;
        return `<span style="font-weight:500">${count}</span>`;
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
      cellRenderer: (params: { data: GroupRow }): string => {
        if (!params.data) return '';
        return `<a class="action-link" data-action="view" data-group-id="${params.data.id}">View Details</a>`;
      },
      onCellClicked: (params: { data: GroupRow; event: Event }) => {
        const target = params.event?.target as HTMLElement;
        if (target?.getAttribute('data-action') === 'view' && params.data) {
          this.router.navigate(['/groups', params.data.id]);
        }
      },
    },
  ];

  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  private gridApi!: GridApi;
  private readonly apiBase = '/api/v1/admin/groups';
  private readonly destroy$ = new Subject<void>();

  searchTerm = '';
  filterPanelCollapsed = false;
  totalElements = 0;
  rowCountSummary = 'Showing 0 of 0 groups';

  readonly statusOptions: string[] = ['ACTIVE', 'INACTIVE'];
  readonly groupTypeFilterOptions: string[] = ['STATIC', 'DYNAMIC'];
  readonly groupTypeDropdownOptions: GroupTypeOption[] = [
    { label: 'Static', value: 'STATIC' },
    { label: 'Dynamic', value: 'DYNAMIC' },
  ];

  filters = {
    search: '',
    statuses: [] as string[],
    groupTypes: [] as string[],
  };

  // Create dialog
  createForm!: FormGroup;
  createDialog = {
    visible: false,
    submitting: false,
    error: '',
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
    this.initCreateForm();

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
  // Grid events
  // ================================================================
  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.setServerSideDatasource(this.createDatasource());
  }

  onRowClicked(event: RowClickedEvent): void {
    const target = event.event?.target as HTMLElement;
    if (!target) return;
    if (target.getAttribute('data-action') === 'view') return;
    if (event.data?.id) {
      this.router.navigate(['/groups', event.data.id]);
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

        const sortModel = params.request.sortModel;
        if (sortModel && sortModel.length > 0) {
          httpParams = httpParams.set('sort', `${sortModel[0].colId},${sortModel[0].sort}`);
        }

        if (this.filters.search) {
          httpParams = httpParams.set('search', this.filters.search);
        }

        if (this.filters.statuses.length > 0) {
          httpParams = httpParams.set('status', this.filters.statuses.join(','));
        }

        if (this.filters.groupTypes.length > 0) {
          httpParams = httpParams.set('groupType', this.filters.groupTypes.join(','));
        }

        this.http
          .get<ApiResponse<GroupRow[]>>(this.apiBase, { params: httpParams })
          .subscribe({
            next: (response) => {
              const rows = response.data ?? [];
              const total = response.meta?.totalElements ?? rows.length;
              this.totalElements = total;
              this.updateRowCountSummary(startRow, rows.length, total);
              params.success({ rowData: rows, rowCount: total });
            },
            error: () => params.fail(),
          });
      },
    };
  }

  // ================================================================
  // Search & Filters
  // ================================================================
  onSearchTermChange(term: string): void {
    this.searchSubject$.next(term);
  }

  toggleFilter(filterKey: 'statuses' | 'groupTypes', value: string): void {
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
    this.filters = { search: '', statuses: [], groupTypes: [] };
    this.searchTerm = '';
    this.refreshGrid();
  }

  refreshGrid(): void {
    if (this.gridApi) {
      this.gridApi.setServerSideDatasource(this.createDatasource());
    }
  }

  // ================================================================
  // Create Group Dialog
  // ================================================================
  private initCreateForm(): void {
    this.createForm = this.fb.group({
      groupName: ['', [Validators.required]],
      groupCode: ['', [Validators.required, Validators.pattern(/^[A-Z_]+$/)]],
      groupType: ['', [Validators.required]],
      description: [''],
      dynamicRule: [''],
    });

    // Auto-generate groupCode from groupName
    this.createForm.get('groupName')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((name: string) => {
        if (name) {
          const code = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '_');
          this.createForm.get('groupCode')?.setValue(code, { emitEvent: false });
        }
      });

    // Make dynamicRule required when DYNAMIC is selected
    this.createForm.get('groupType')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((type: string) => {
        const dynamicRuleCtrl = this.createForm.get('dynamicRule');
        if (type === 'DYNAMIC') {
          dynamicRuleCtrl?.setValidators([Validators.required]);
        } else {
          dynamicRuleCtrl?.clearValidators();
          dynamicRuleCtrl?.setValue('');
        }
        dynamicRuleCtrl?.updateValueAndValidity();
      });
  }

  openCreateDialog(): void {
    this.createForm.reset({ groupName: '', groupCode: '', groupType: '', description: '', dynamicRule: '' });
    this.createDialog = { visible: true, submitting: false, error: '' };
  }

  closeCreateDialog(): void {
    this.createDialog.visible = false;
  }

  submitCreateGroup(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.createDialog.submitting = true;
    this.createDialog.error = '';

    const formValue = this.createForm.value;
    const payload: Record<string, string> = {
      groupName: formValue.groupName,
      groupCode: formValue.groupCode,
      groupType: formValue.groupType,
      description: formValue.description || '',
    };

    if (formValue.groupType === 'DYNAMIC' && formValue.dynamicRule) {
      payload['dynamicRule'] = formValue.dynamicRule;
    }

    this.http
      .post<ApiResponse<Group>>(this.apiBase, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.closeCreateDialog();
          const groupId = response.data?.id;
          if (groupId) {
            this.router.navigate(['/groups', groupId]);
          } else {
            this.refreshGrid();
          }
        },
        error: (err) => {
          this.createDialog.submitting = false;
          this.createDialog.error = err?.error?.message || 'Failed to create group. Please try again.';
        },
      });
  }

  // ================================================================
  // Helpers
  // ================================================================
  private updateRowCountSummary(startRow: number, fetchedCount: number, total: number): void {
    const from = total > 0 ? startRow + 1 : 0;
    const to = startRow + fetchedCount;
    this.rowCountSummary = `Showing ${from}-${to} of ${total} groups`;
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
