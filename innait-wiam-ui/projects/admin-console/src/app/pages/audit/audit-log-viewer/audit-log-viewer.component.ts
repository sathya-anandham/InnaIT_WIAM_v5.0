import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  GridOptions,
} from 'ag-grid-community';
import { ApiResponse, PaginationMeta, AuditEvent } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/** Categories available for filtering audit events. */
type AuditCategory = 'AUTH' | 'USER' | 'ROLE' | 'GROUP' | 'CREDENTIAL' | 'SESSION' | 'POLICY' | 'SYSTEM';

/** Summary bar statistics. */
interface AuditSummary {
  totalEvents: number;
  successRate: number;
  mostCommonEventType: string;
}

/** Dynamic event-type option loaded per category. */
interface EventTypeOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-audit-log-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridAngular,
    TranslatePipe,
    DatePipe,
  ],
  template: `
    <div class="audit-log-page" role="main" aria-label="Audit log viewer">
      <!-- ============================================================ -->
      <!-- Page Header                                                   -->
      <!-- ============================================================ -->
      <header class="page-header">
        <h1 class="page-title">{{ 'audit.logViewer.title' | translate }}</h1>
        <div class="header-actions">
          <button
            class="btn btn-outline"
            (click)="exportCsv()"
            [disabled]="exporting"
            aria-label="Export filtered audit logs as CSV">
            <i class="pi pi-file" aria-hidden="true"></i>
            {{ 'audit.logViewer.exportCsv' | translate }}
          </button>
          <button
            class="btn btn-outline"
            (click)="exportPdf()"
            [disabled]="exporting"
            aria-label="Export filtered audit logs as PDF">
            <i class="pi pi-file-pdf" aria-hidden="true"></i>
            {{ 'audit.logViewer.exportPdf' | translate }}
          </button>
          <button
            class="btn btn-icon"
            (click)="refreshGrid()"
            aria-label="Refresh audit logs">
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Summary Bar                                                   -->
      <!-- ============================================================ -->
      <section
        class="summary-bar"
        *ngIf="summary"
        role="region"
        aria-label="Audit log summary statistics">
        <div class="summary-stat">
          <span class="stat-label">{{ 'audit.logViewer.totalEvents' | translate }}</span>
          <span class="stat-value">{{ summary.totalEvents | number }}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">{{ 'audit.logViewer.successRate' | translate }}</span>
          <span class="stat-value" [class.text-success]="summary.successRate >= 90" [class.text-warning]="summary.successRate < 90 && summary.successRate >= 70" [class.text-danger]="summary.successRate < 70">
            {{ summary.successRate | number:'1.1-1' }}%
          </span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">{{ 'audit.logViewer.mostCommon' | translate }}</span>
          <span class="stat-value">{{ summary.mostCommonEventType }}</span>
        </div>
      </section>

      <!-- Loading summary skeleton -->
      <section class="summary-bar" *ngIf="!summary && !summaryError">
        <div class="summary-stat skeleton-stat" *ngFor="let s of [1,2,3]">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
        </div>
      </section>

      <!-- ============================================================ -->
      <!-- Filter Toolbar                                                -->
      <!-- ============================================================ -->
      <section class="filter-toolbar" role="search" aria-label="Audit log filters">
        <!-- Category -->
        <div class="filter-group">
          <label for="categoryFilter" class="filter-label">{{ 'audit.logViewer.category' | translate }}</label>
          <select
            id="categoryFilter"
            class="filter-select"
            [(ngModel)]="filters.category"
            (ngModelChange)="onCategoryChange($event)"
            aria-label="Filter by category">
            <option value="">{{ 'common.all' | translate }}</option>
            <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
          </select>
        </div>

        <!-- Event Type (dynamic) -->
        <div class="filter-group">
          <label for="eventTypeFilter" class="filter-label">{{ 'audit.logViewer.eventType' | translate }}</label>
          <select
            id="eventTypeFilter"
            class="filter-select"
            [(ngModel)]="filters.eventType"
            (ngModelChange)="onFilterChange()"
            [disabled]="!filters.category"
            aria-label="Filter by event type">
            <option value="">{{ 'common.all' | translate }}</option>
            <option *ngFor="let et of eventTypeOptions" [value]="et.value">{{ et.label }}</option>
          </select>
        </div>

        <!-- Actor Search -->
        <div class="filter-group">
          <label for="actorSearch" class="filter-label">{{ 'audit.logViewer.actor' | translate }}</label>
          <input
            id="actorSearch"
            type="text"
            class="filter-input"
            [(ngModel)]="filters.actorId"
            (ngModelChange)="onFilterChange()"
            placeholder="Search actor ID..."
            aria-label="Filter by actor ID" />
        </div>

        <!-- Date From -->
        <div class="filter-group">
          <label for="dateFrom" class="filter-label">{{ 'audit.logViewer.from' | translate }}</label>
          <input
            id="dateFrom"
            type="datetime-local"
            class="filter-input"
            [(ngModel)]="filters.from"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter from date" />
        </div>

        <!-- Date To -->
        <div class="filter-group">
          <label for="dateTo" class="filter-label">{{ 'audit.logViewer.to' | translate }}</label>
          <input
            id="dateTo"
            type="datetime-local"
            class="filter-input"
            [(ngModel)]="filters.to"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter to date" />
        </div>

        <!-- Outcome -->
        <div class="filter-group">
          <label for="outcomeFilter" class="filter-label">{{ 'audit.logViewer.outcome' | translate }}</label>
          <select
            id="outcomeFilter"
            class="filter-select"
            [(ngModel)]="filters.outcome"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter by outcome">
            <option value="">{{ 'common.all' | translate }}</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
          </select>
        </div>

        <button class="btn btn-sm btn-outline" (click)="clearFilters()" aria-label="Clear all filters">
          <i class="pi pi-filter-slash" aria-hidden="true"></i>
          {{ 'common.clearFilters' | translate }}
        </button>
      </section>

      <!-- ============================================================ -->
      <!-- ag-Grid                                                       -->
      <!-- ============================================================ -->
      <section class="grid-container" role="region" aria-label="Audit events table">
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
          class="ag-theme-alpine audit-grid"
          [gridOptions]="gridOptions"
          [columnDefs]="columnDefs"
          [defaultColDef]="defaultColDef"
          [rowModelType]="'serverSide'"
          [pagination]="true"
          [paginationPageSize]="50"
          [cacheBlockSize]="50"
          [masterDetail]="true"
          [detailCellRendererParams]="detailCellRendererParams"
          (gridReady)="onGridReady($event)"
          aria-label="Audit log grid">
        </ag-grid-angular>
      </section>

      <!-- ============================================================ -->
      <!-- Row Detail Template (expanded details)                        -->
      <!-- ============================================================ -->
      <ng-template #detailTemplate let-row>
        <div class="detail-panel" role="region" aria-label="Event details">
          <h4>{{ 'audit.logViewer.eventDetails' | translate }}</h4>
          <div class="detail-kv-list">
            <div class="detail-kv-row" *ngFor="let entry of getDetailEntries(row)">
              <span class="detail-key">{{ entry.key }}</span>
              <span class="detail-value">{{ entry.value }}</span>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .audit-log-page {
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
    }
    .summary-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 140px;
    }
    .stat-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-color-secondary, #64748b);
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
    }
    .text-success { color: var(--green-500, #22c55e); }
    .text-warning { color: var(--orange-500, #f97316); }
    .text-danger  { color: var(--red-500, #ef4444); }

    /* Skeleton */
    .skeleton-stat .skeleton-line {
      height: 14px;
      background: linear-gradient(90deg, var(--surface-200, #e9ecef) 25%, var(--surface-100, #f8f9fa) 50%, var(--surface-200, #e9ecef) 75%);
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 4px;
      width: 100px;
    }
    .skeleton-stat .skeleton-line.short { width: 60px; height: 10px; }
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

    /* ── Grid ── */
    .grid-container {
      flex: 1;
      position: relative;
      min-height: 400px;
    }
    .audit-grid {
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

    /* ── Detail panel ── */
    .detail-panel {
      padding: 16px 24px;
      background: var(--surface-ground, #f8f9fa);
    }
    .detail-panel h4 {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color, #1e293b);
    }
    .detail-kv-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 8px;
    }
    .detail-kv-row {
      display: flex;
      gap: 8px;
      font-size: 13px;
    }
    .detail-key {
      font-weight: 600;
      color: var(--text-color-secondary, #64748b);
      min-width: 120px;
    }
    .detail-value {
      color: var(--text-color, #333);
      word-break: break-all;
    }

    /* ── Tags / Badges ── */
    .outcome-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .outcome-success {
      background: rgba(34,197,94,0.12);
      color: #16a34a;
    }
    .outcome-failure {
      background: rgba(239,68,68,0.12);
      color: #dc2626;
    }
    .category-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(59,130,246,0.1);
      color: var(--primary-color, #3b82f6);
    }
    .actor-cell {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .actor-icon { font-size: 14px; opacity: 0.6; }

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
    .btn-outline { border-color: var(--surface-border, #dee2e6); }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-icon {
      padding: 8px;
      border-radius: 8px;
      min-width: 36px;
      justify-content: center;
    }
  `],
})
export class AuditLogViewerComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/audit';
  private gridApi!: GridApi;

  /** Filter state */
  readonly categories: AuditCategory[] = ['AUTH', 'USER', 'ROLE', 'GROUP', 'CREDENTIAL', 'SESSION', 'POLICY', 'SYSTEM'];
  eventTypeOptions: EventTypeOption[] = [];

  filters = {
    category: '' as string,
    eventType: '' as string,
    actorId: '' as string,
    from: '' as string,
    to: '' as string,
    outcome: '' as string,
  };

  /** State */
  loading = false;
  error: string | null = null;
  exporting = false;
  summary: AuditSummary | null = null;
  summaryError: string | null = null;

  /** ag-Grid configuration */
  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: false,
    minWidth: 100,
  };

  columnDefs: ColDef[] = [
    {
      headerName: 'Timestamp',
      field: 'timestamp',
      sortable: true,
      width: 180,
      valueFormatter: (params) => {
        if (!params.value) return '';
        return new Date(params.value).toLocaleString();
      },
    },
    {
      headerName: 'Event Type',
      field: 'eventType',
      width: 180,
      valueFormatter: (params) => {
        if (!params.value) return '';
        return params.value.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      },
    },
    {
      headerName: 'Category',
      field: 'category',
      width: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        return `<span class="category-tag">${params.value}</span>`;
      },
    },
    {
      headerName: 'Actor',
      field: 'actorId',
      width: 180,
      cellRenderer: (params: any) => {
        const icon = this.getActorTypeIcon(params.data?.actorType);
        return `<span class="actor-cell"><i class="pi ${icon} actor-icon" aria-hidden="true"></i>${params.value || ''}</span>`;
      },
    },
    {
      headerName: 'Target',
      field: 'targetId',
      width: 160,
    },
    {
      headerName: 'Outcome',
      field: 'outcome',
      width: 110,
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        const cls = params.value === 'SUCCESS' ? 'outcome-success' : 'outcome-failure';
        return `<span class="outcome-tag ${cls}">${params.value}</span>`;
      },
    },
    {
      headerName: 'IP Address',
      field: 'ipAddress',
      width: 140,
    },
    {
      headerName: 'Details',
      field: 'details',
      width: 100,
      cellRenderer: 'agGroupCellRenderer',
      sortable: false,
    },
  ];

  gridOptions: GridOptions = {
    rowHeight: 44,
    headerHeight: 46,
    animateRows: true,
    rowSelection: 'single' as any,
    suppressCellFocus: true,
  };

  detailCellRendererParams = {
    detailGridOptions: {},
    getDetailRowData: (params: any) => {
      params.successCallback(this.getDetailEntries(params.data));
    },
  };

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadSummary();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Builds HttpParams from current filter state. */
  private buildFilterParams(page: number, size: number): HttpParams {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (this.filters.category)  params = params.set('category', this.filters.category);
    if (this.filters.eventType) params = params.set('eventType', this.filters.eventType);
    if (this.filters.actorId)   params = params.set('actorId', this.filters.actorId);
    if (this.filters.from)      params = params.set('from', this.filters.from);
    if (this.filters.to)        params = params.set('to', this.filters.to);
    if (this.filters.outcome)   params = params.set('outcome', this.filters.outcome);

    return params;
  }

  /** Called when ag-Grid is ready. Sets up server-side datasource. */
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
        const size = 50;
        const httpParams = this.buildFilterParams(page, size);

        this.http
          .get<ApiResponse<{ content: AuditEvent[]; meta: PaginationMeta }>>(this.apiBase, { params: httpParams })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              const rows = response.data.content;
              const total = response.data.meta.totalElements;
              params.success({ rowData: rows, rowCount: total });
              this.loading = false;
            },
            error: (err) => {
              this.error = err?.error?.error?.message || 'Failed to load audit events';
              params.fail();
              this.loading = false;
            },
          });
      },
    };

    this.gridApi.setGridOption('serverSideDatasource', datasource);
  }

  /** Loads summary statistics. */
  private loadSummary(): void {
    this.summary = null;
    this.summaryError = null;

    let params = new HttpParams();
    if (this.filters.from) params = params.set('from', this.filters.from);
    if (this.filters.to)   params = params.set('to', this.filters.to);

    this.http
      .get<ApiResponse<AuditSummary>>(`${this.apiBase}/summary`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.summary = response.data;
        },
        error: (err) => {
          this.summaryError = err?.error?.error?.message || 'Failed to load summary';
        },
      });
  }

  /** Called when the category filter changes. Loads event types for that category. */
  onCategoryChange(category: string): void {
    this.filters.eventType = '';
    this.eventTypeOptions = [];

    if (category) {
      this.http
        .get<ApiResponse<EventTypeOption[]>>(`${this.apiBase}/event-types`, {
          params: new HttpParams().set('category', category),
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.eventTypeOptions = response.data;
          },
          error: () => {
            this.eventTypeOptions = [];
          },
        });
    }

    this.onFilterChange();
  }

  /** Reloads grid and summary when any filter changes. */
  onFilterChange(): void {
    if (this.gridApi) {
      this.setDatasource();
    }
    this.loadSummary();
  }

  /** Clears all filters and reloads. */
  clearFilters(): void {
    this.filters = {
      category: '',
      eventType: '',
      actorId: '',
      from: '',
      to: '',
      outcome: '',
    };
    this.eventTypeOptions = [];
    this.onFilterChange();
  }

  /** Refresh the grid data without changing filters. */
  refreshGrid(): void {
    if (this.gridApi) {
      this.setDatasource();
    }
    this.loadSummary();
  }

  /** Export current filtered results as CSV. */
  exportCsv(): void {
    this.exporting = true;

    const params = this.buildFilterParams(0, 10000)
      .set('format', 'csv');

    this.http
      .get(`${this.apiBase}/export`, { params, responseType: 'blob' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.downloadBlob(blob, 'audit-log.csv');
          this.exporting = false;
        },
        error: () => {
          this.exporting = false;
        },
      });
  }

  /** Export current filtered results as PDF. */
  exportPdf(): void {
    this.exporting = true;

    const params = this.buildFilterParams(0, 10000);

    this.http
      .post(`${this.apiBase}/export`, null, {
        params: params.set('format', 'pdf'),
        responseType: 'blob',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.downloadBlob(blob, 'audit-log.pdf');
          this.exporting = false;
        },
        error: () => {
          this.exporting = false;
        },
      });
  }

  /** Triggers a browser file download from a Blob. */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Returns the PrimeNG icon class for a given actor type. */
  getActorTypeIcon(actorType?: string): string {
    switch (actorType) {
      case 'USER':    return 'pi-user';
      case 'ADMIN':   return 'pi-shield';
      case 'SYSTEM':  return 'pi-server';
      case 'SERVICE': return 'pi-cog';
      default:        return 'pi-question-circle';
    }
  }

  /** Converts the details map of an audit event to an array of key-value pairs. */
  getDetailEntries(row: any): { key: string; value: string }[] {
    if (!row?.details) return [];
    if (typeof row.details === 'string') {
      try {
        const parsed = JSON.parse(row.details);
        return Object.entries(parsed).map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        }));
      } catch {
        return [{ key: 'details', value: row.details }];
      }
    }
    return Object.entries(row.details).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));
  }
}
