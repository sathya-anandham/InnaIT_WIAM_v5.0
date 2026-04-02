import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil, interval } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  GridOptions,
} from 'ag-grid-community';
import { ApiResponse, PaginationMeta, Session } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/** Extended session row with display fields. */
interface SessionRow extends Session {
  accountLoginId?: string;
  displayName?: string;
}

/** Summary statistics for active sessions. */
interface SessionSummary {
  totalActive: number;
  bySessionType: Record<string, number>;
  peakToday: number;
}

@Component({
  selector: 'app-active-sessions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridAngular,
    TranslatePipe,
  ],
  template: `
    <div class="active-sessions-page" role="main" aria-label="Tenant-wide active session management">
      <!-- ============================================================ -->
      <!-- Page Header                                                   -->
      <!-- ============================================================ -->
      <header class="page-header">
        <h1 class="page-title">{{ 'sessions.activeSessions.title' | translate }}</h1>
        <div class="header-actions">
          <!-- Auto-refresh toggle -->
          <button
            class="btn btn-sm"
            [class.btn-primary]="autoRefresh"
            (click)="toggleAutoRefresh()"
            [attr.aria-pressed]="autoRefresh"
            aria-label="Toggle auto-refresh every 15 seconds">
            <i class="pi pi-sync" aria-hidden="true"></i>
            Auto (15s)
          </button>
          <button
            class="btn btn-outline"
            (click)="exportCurrentView()"
            [disabled]="exporting"
            aria-label="Export current session view as CSV">
            <i class="pi pi-download" aria-hidden="true"></i>
            {{ 'sessions.activeSessions.export' | translate }}
          </button>
          <button
            class="btn btn-icon"
            (click)="refreshGrid()"
            aria-label="Refresh session data">
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Summary Stats                                                 -->
      <!-- ============================================================ -->
      <section class="summary-bar" *ngIf="summary" role="region" aria-label="Session summary statistics">
        <div class="summary-stat">
          <span class="stat-label">{{ 'sessions.activeSessions.totalActive' | translate }}</span>
          <span class="stat-value">{{ summary.totalActive | number }}</span>
        </div>
        <div class="summary-stat" *ngFor="let entry of sessionTypeEntries">
          <span class="stat-label">{{ entry.type }}</span>
          <span class="stat-value">{{ entry.count | number }}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">{{ 'sessions.activeSessions.peakToday' | translate }}</span>
          <span class="stat-value">{{ summary.peakToday | number }}</span>
        </div>
      </section>

      <!-- Loading summary skeleton -->
      <section class="summary-bar" *ngIf="!summary && !summaryError">
        <div class="summary-stat skeleton-stat" *ngFor="let s of [1,2,3,4]">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
        </div>
      </section>

      <!-- ============================================================ -->
      <!-- Filter Toolbar                                                -->
      <!-- ============================================================ -->
      <section class="filter-toolbar" role="search" aria-label="Session filters">
        <div class="filter-group">
          <label for="userSearch" class="filter-label">{{ 'sessions.activeSessions.user' | translate }}</label>
          <input
            id="userSearch"
            type="text"
            class="filter-input"
            [(ngModel)]="filters.userId"
            (ngModelChange)="onFilterChange()"
            placeholder="User ID or login..."
            aria-label="Filter by user" />
        </div>

        <div class="filter-group">
          <label for="ipFilter" class="filter-label">{{ 'sessions.activeSessions.ipAddress' | translate }}</label>
          <input
            id="ipFilter"
            type="text"
            class="filter-input"
            [(ngModel)]="filters.ipAddress"
            (ngModelChange)="onFilterChange()"
            placeholder="IP address..."
            aria-label="Filter by IP address" />
        </div>

        <div class="filter-group">
          <label for="sessionTypeFilter" class="filter-label">{{ 'sessions.activeSessions.sessionType' | translate }}</label>
          <select
            id="sessionTypeFilter"
            class="filter-select"
            [(ngModel)]="filters.sessionType"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter by session type">
            <option value="">{{ 'common.all' | translate }}</option>
            <option value="WEB">WEB</option>
            <option value="API">API</option>
            <option value="MOBILE">MOBILE</option>
            <option value="SSO">SSO</option>
          </select>
        </div>

        <div class="filter-group filter-toggle">
          <label class="filter-label">{{ 'sessions.activeSessions.activeOnly' | translate }}</label>
          <label class="toggle" role="switch" [attr.aria-checked]="filters.activeOnly">
            <input
              type="checkbox"
              [(ngModel)]="filters.activeOnly"
              (ngModelChange)="onFilterChange()"
              aria-label="Show active sessions only" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <button class="btn btn-sm btn-outline" (click)="clearFilters()" aria-label="Clear all filters">
          <i class="pi pi-filter-slash" aria-hidden="true"></i>
          {{ 'common.clearFilters' | translate }}
        </button>
      </section>

      <!-- ============================================================ -->
      <!-- Bulk Action Bar                                               -->
      <!-- ============================================================ -->
      <div
        *ngIf="selectedSessions.length > 0"
        class="bulk-toolbar"
        role="toolbar"
        aria-label="Bulk session actions">
        <span class="selection-badge" aria-live="polite">
          {{ selectedSessions.length }} session(s) selected
        </span>
        <button
          class="btn btn-danger"
          (click)="bulkForceLogout()"
          [disabled]="bulkRevoking"
          aria-label="Force logout selected sessions">
          <i *ngIf="bulkRevoking" class="pi pi-spin pi-spinner" aria-hidden="true"></i>
          <i *ngIf="!bulkRevoking" class="pi pi-sign-out" aria-hidden="true"></i>
          {{ 'sessions.activeSessions.bulkForceLogout' | translate }}
        </button>
      </div>

      <!-- ============================================================ -->
      <!-- ag-Grid                                                       -->
      <!-- ============================================================ -->
      <section class="grid-container" role="region" aria-label="Active sessions table">
        <!-- Loading overlay -->
        <div *ngIf="loading" class="loading-overlay" aria-live="polite">
          <i class="pi pi-spin pi-spinner loading-spinner" aria-hidden="true"></i>
          <span>{{ 'common.loading' | translate }}</span>
        </div>

        <!-- Error state -->
        <div *ngIf="error && !loading" class="error-state" role="alert">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
          <span>{{ error }}</span>
          <button class="btn btn-sm btn-outline" (click)="refreshGrid()">
            {{ 'common.retry' | translate }}
          </button>
        </div>

        <ag-grid-angular
          class="ag-theme-alpine sessions-grid"
          [gridOptions]="gridOptions"
          [columnDefs]="columnDefs"
          [defaultColDef]="defaultColDef"
          [rowModelType]="'serverSide'"
          [pagination]="true"
          [paginationPageSize]="50"
          [cacheBlockSize]="50"
          [rowSelection]="'multiple'"
          [suppressRowClickSelection]="true"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged()"
          aria-label="Sessions grid">
        </ag-grid-angular>
      </section>
    </div>
  `,
  styles: [`
    .active-sessions-page {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      height: 100%;
    }

    /* ── Header ── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
    }
    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    /* ── Summary bar ── */
    .summary-bar {
      display: flex;
      gap: 24px;
      padding: 16px 20px;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      flex-wrap: wrap;
    }
    .summary-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 110px;
    }
    .stat-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--text-color-secondary, #64748b);
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
    }

    /* Skeleton */
    .skeleton-stat .skeleton-line {
      height: 14px;
      background: linear-gradient(90deg, var(--surface-200, #e9ecef) 25%, var(--surface-100, #f8f9fa) 50%, var(--surface-200, #e9ecef) 75%);
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 4px;
      width: 80px;
    }
    .skeleton-stat .skeleton-line.short { width: 50px; height: 10px; }
    @keyframes pulse {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Filters ── */
    .filter-toolbar {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      flex-wrap: wrap;
      padding: 14px 16px;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter-toggle { justify-content: center; }
    .filter-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--text-color-secondary, #64748b);
    }
    .filter-select,
    .filter-input {
      padding: 7px 10px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 6px;
      font-size: 13px;
      background: var(--surface-ground, #f8f9fa);
      color: var(--text-color, #333);
      min-width: 140px;
    }
    .filter-select:focus,
    .filter-input:focus {
      outline: 2px solid var(--primary-color, #3b82f6);
      outline-offset: -1px;
    }

    /* Toggle switch */
    .toggle {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 22px;
      cursor: pointer;
    }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      inset: 0;
      background: var(--surface-300, #cbd5e1);
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
    .toggle input:checked + .toggle-slider {
      background: var(--primary-color, #3b82f6);
    }
    .toggle input:checked + .toggle-slider::before {
      transform: translateX(18px);
    }

    /* ── Bulk Toolbar ── */
    .bulk-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: rgba(59,130,246,0.06);
      border: 1px solid rgba(59,130,246,0.2);
      border-radius: 10px;
    }
    .selection-badge {
      font-size: 13px;
      font-weight: 600;
      color: var(--primary-color, #3b82f6);
    }

    /* ── Grid ── */
    .grid-container {
      flex: 1;
      position: relative;
      min-height: 400px;
    }
    .sessions-grid {
      width: 100%;
      height: 100%;
    }
    .loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(255,255,255,0.8);
      z-index: 10;
      font-size: 14px;
      color: var(--text-color-secondary, #64748b);
    }
    .loading-spinner { font-size: 28px; }
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 40px;
      color: var(--red-500, #ef4444);
      text-align: center;
    }
    .error-state i { font-size: 28px; }

    /* ── Badges in grid ── */
    .session-type-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .type-web    { background: rgba(59,130,246,0.12);  color: #2563eb; }
    .type-api    { background: rgba(139,92,246,0.12);  color: #7c3aed; }
    .type-mobile { background: rgba(34,197,94,0.12);   color: #16a34a; }
    .type-sso    { background: rgba(249,115,22,0.12);  color: #ea580c; }
    .type-default { background: rgba(100,116,139,0.1); color: #64748b; }

    .auth-chip {
      display: inline-block;
      padding: 1px 6px;
      margin-right: 4px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      background: var(--surface-200, #e9ecef);
      color: var(--text-color, #333);
    }

    .acr-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .acr-high   { background: rgba(34,197,94,0.12); color: #16a34a; }
    .acr-medium { background: rgba(249,115,22,0.12); color: #ea580c; }
    .acr-low    { background: rgba(239,68,68,0.12); color: #dc2626; }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      background: transparent;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      color: var(--text-color, #333);
      transition: all 0.15s ease;
    }
    .btn:hover { background: var(--surface-hover, #f1f5f9); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary {
      background: var(--primary-color, #3b82f6);
      color: #fff;
      border-color: var(--primary-color, #3b82f6);
    }
    .btn-primary:hover { filter: brightness(1.1); }
    .btn-danger {
      background: #ef4444;
      color: #fff;
      border-color: #ef4444;
    }
    .btn-danger:hover { filter: brightness(1.1); }
    .btn-outline { border-color: var(--surface-border, #dee2e6); }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-xs { padding: 4px 8px; font-size: 11px; border-radius: 6px; }
    .btn-icon {
      padding: 8px;
      border-radius: 8px;
      min-width: 36px;
      justify-content: center;
    }
  `],
})
export class ActiveSessionsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/sessions';
  private gridApi!: GridApi;
  private autoRefreshSubscription: any = null;

  /** State */
  loading = false;
  error: string | null = null;
  exporting = false;
  bulkRevoking = false;
  autoRefresh = false;
  selectedSessions: SessionRow[] = [];
  summary: SessionSummary | null = null;
  summaryError: string | null = null;
  sessionTypeEntries: { type: string; count: number }[] = [];

  /** Filters */
  filters = {
    userId: '' as string,
    ipAddress: '' as string,
    sessionType: '' as string,
    activeOnly: true,
  };

  /** ag-Grid config */
  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: false,
    minWidth: 80,
  };

  columnDefs: ColDef[] = [
    {
      headerName: '',
      field: 'sessionId',
      width: 50,
      headerCheckboxSelection: true,
      checkboxSelection: true,
      sortable: false,
      resizable: false,
    },
    {
      headerName: 'Login ID',
      field: 'accountLoginId',
      width: 160,
    },
    {
      headerName: 'Display Name',
      field: 'displayName',
      width: 160,
    },
    {
      headerName: 'Session Type',
      field: 'sessionType',
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        const cls = this.getSessionTypeCls(params.value);
        return `<span class="session-type-badge ${cls}">${params.value}</span>`;
      },
    },
    {
      headerName: 'Auth Methods',
      field: 'authMethodsUsed',
      width: 180,
      sortable: false,
      cellRenderer: (params: any) => {
        if (!params.value || !Array.isArray(params.value)) return '';
        return params.value.map((m: string) => `<span class="auth-chip">${m}</span>`).join('');
      },
    },
    {
      headerName: 'ACR Level',
      field: 'acrLevel',
      width: 100,
      cellRenderer: (params: any) => {
        if (params.value == null) return '';
        const cls = params.value >= 3 ? 'acr-high' : params.value >= 2 ? 'acr-medium' : 'acr-low';
        return `<span class="acr-badge ${cls}">ACR ${params.value}</span>`;
      },
    },
    {
      headerName: 'IP Address',
      field: 'ipAddress',
      width: 140,
    },
    {
      headerName: 'User Agent',
      field: 'userAgent',
      width: 200,
      valueFormatter: (params) => this.parseUserAgent(params.value),
    },
    {
      headerName: 'Created',
      field: 'createdAt',
      width: 160,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : '',
    },
    {
      headerName: 'Last Activity',
      field: 'lastActivityAt',
      width: 140,
      valueFormatter: (params) => params.value ? this.getRelativeTime(params.value) : '',
    },
    {
      headerName: 'Expires',
      field: 'expiresAt',
      width: 160,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : '',
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 140,
      sortable: false,
      resizable: false,
      cellRenderer: (params: any) => {
        const sessionId = params.data?.sessionId;
        if (!sessionId) return '';
        return `<button class="btn btn-xs btn-danger" onclick="document.dispatchEvent(new CustomEvent('forceLogout', {detail:'${sessionId}'}))">
          <i class="pi pi-sign-out" aria-hidden="true"></i> Force Logout
        </button>`;
      },
    },
  ];

  gridOptions: GridOptions = {
    rowHeight: 44,
    headerHeight: 46,
    animateRows: true,
    suppressCellFocus: true,
  };

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadSummary();
    // Listen for force-logout events from the cell renderer
    document.addEventListener('forceLogout', this.handleForceLogoutEvent);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
    document.removeEventListener('forceLogout', this.handleForceLogoutEvent);
  }

  /** Event listener for inline force-logout button. */
  private handleForceLogoutEvent = (event: Event): void => {
    const sessionId = (event as CustomEvent).detail;
    if (sessionId) {
      this.forceLogout(sessionId);
    }
  };

  /** Builds HttpParams from filter state. */
  private buildFilterParams(page: number, size: number): HttpParams {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (this.filters.userId)      params = params.set('userId', this.filters.userId);
    if (this.filters.ipAddress)   params = params.set('ipAddress', this.filters.ipAddress);
    if (this.filters.sessionType) params = params.set('sessionType', this.filters.sessionType);
    if (this.filters.activeOnly)  params = params.set('active', 'true');

    return params;
  }

  /** ag-Grid ready handler: sets up server-side datasource. */
  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
    this.setDatasource();
  }

  /** Creates and attaches the server-side datasource. */
  private setDatasource(): void {
    const datasource: IServerSideDatasource = {
      getRows: (params: IServerSideGetRowsParams) => {
        this.loading = true;
        this.error = null;

        const page = Math.floor((params.request.startRow ?? 0) / 50);
        const httpParams = this.buildFilterParams(page, 50);

        this.http
          .get<ApiResponse<{ content: SessionRow[]; meta: PaginationMeta }>>(this.apiBase, { params: httpParams })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              params.success({
                rowData: response.data.content,
                rowCount: response.data.meta.totalElements,
              });
              this.loading = false;
            },
            error: (err) => {
              this.error = err?.error?.error?.message || 'Failed to load sessions';
              params.fail();
              this.loading = false;
            },
          });
      },
    };

    this.gridApi.setGridOption('serverSideDatasource', datasource);
  }

  /** Load session summary. */
  private loadSummary(): void {
    this.summary = null;
    this.summaryError = null;

    this.http
      .get<ApiResponse<SessionSummary>>(`${this.apiBase}/summary`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.summary = response.data;
          this.sessionTypeEntries = Object.entries(response.data.bySessionType || {}).map(
            ([type, count]) => ({ type, count }),
          );
        },
        error: (err) => {
          this.summaryError = err?.error?.error?.message || 'Failed to load summary';
        },
      });
  }

  /** Handle selection changed. */
  onSelectionChanged(): void {
    this.selectedSessions = this.gridApi.getSelectedRows();
  }

  /** Handle filter changes. */
  onFilterChange(): void {
    if (this.gridApi) {
      this.setDatasource();
    }
    this.loadSummary();
  }

  /** Clear all filters. */
  clearFilters(): void {
    this.filters = {
      userId: '',
      ipAddress: '',
      sessionType: '',
      activeOnly: true,
    };
    this.onFilterChange();
  }

  /** Refresh the grid. */
  refreshGrid(): void {
    if (this.gridApi) {
      this.setDatasource();
    }
    this.loadSummary();
  }

  /** Toggle auto-refresh (15s). */
  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.autoRefreshSubscription = interval(15000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.refreshGrid());
    } else {
      this.stopAutoRefresh();
    }
  }

  /** Stop auto-refresh. */
  private stopAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = null;
    }
  }

  /** Force logout a single session. */
  forceLogout(sessionId: string): void {
    this.http
      .delete<ApiResponse<void>>(`${this.apiBase}/${sessionId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.refreshGrid();
        },
        error: () => {
          // Error handling could show a toast notification
        },
      });
  }

  /** Bulk force logout selected sessions. */
  bulkForceLogout(): void {
    if (this.selectedSessions.length === 0) return;
    this.bulkRevoking = true;

    const sessionIds = this.selectedSessions.map(s => s.sessionId);

    this.http
      .post<ApiResponse<void>>(`${this.apiBase}/bulk-revoke`, { sessionIds })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedSessions = [];
          this.bulkRevoking = false;
          this.refreshGrid();
        },
        error: () => {
          this.bulkRevoking = false;
        },
      });
  }

  /** Export current view as CSV. */
  exportCurrentView(): void {
    this.exporting = true;

    const params = this.buildFilterParams(0, 10000).set('format', 'csv');

    this.http
      .get(`${this.apiBase}/export`, { params, responseType: 'blob' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'active-sessions.csv';
          a.click();
          URL.revokeObjectURL(url);
          this.exporting = false;
        },
        error: () => {
          this.exporting = false;
        },
      });
  }

  /** Returns CSS class for session type badge. */
  getSessionTypeCls(type: string): string {
    switch (type?.toUpperCase()) {
      case 'WEB':    return 'type-web';
      case 'API':    return 'type-api';
      case 'MOBILE': return 'type-mobile';
      case 'SSO':    return 'type-sso';
      default:       return 'type-default';
    }
  }

  /** Parse user agent string into a human-readable browser/OS label. */
  parseUserAgent(ua: string): string {
    if (!ua) return '';

    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect browser
    if (ua.includes('Edg/'))        browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

    // Detect OS
    if (ua.includes('Windows'))      os = 'Windows';
    else if (ua.includes('Mac OS'))  os = 'macOS';
    else if (ua.includes('Linux'))   os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${browser} / ${os}`;
  }

  /** Convert a timestamp to a relative time string. */
  getRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60)    return `${diffSec}s ago`;
    if (diffMin < 60)    return `${diffMin}m ago`;
    if (diffHours < 24)  return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
}
