import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { ApiResponse, PaginationMeta } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/** Shape of a single admin action record returned by the API. */
interface AdminAction {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  timestamp: string;
  ipAddress: string;
}

/** Represents one field-level diff entry for display. */
interface DiffEntry {
  key: string;
  oldValue: any;
  newValue: any;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
}

@Component({
  selector: 'app-admin-action-history',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="action-history-page" role="main" aria-label="Admin action history">
      <!-- ============================================================ -->
      <!-- Page Header                                                   -->
      <!-- ============================================================ -->
      <header class="page-header">
        <h1 class="page-title">{{ 'audit.adminActions.title' | translate }}</h1>
        <button
          class="btn btn-icon"
          (click)="loadActions()"
          aria-label="Refresh admin action history">
          <i class="pi pi-refresh" aria-hidden="true"></i>
        </button>
      </header>

      <!-- ============================================================ -->
      <!-- Filters                                                       -->
      <!-- ============================================================ -->
      <section class="filter-toolbar" role="search" aria-label="Admin action filters">
        <div class="filter-group">
          <label for="adminFilter" class="filter-label">{{ 'audit.adminActions.admin' | translate }}</label>
          <input
            id="adminFilter"
            type="text"
            class="filter-input"
            [(ngModel)]="filters.adminId"
            (ngModelChange)="onFilterChange()"
            placeholder="Admin ID or name..."
            aria-label="Filter by admin" />
        </div>

        <div class="filter-group">
          <label for="actionTypeFilter" class="filter-label">{{ 'audit.adminActions.actionType' | translate }}</label>
          <select
            id="actionTypeFilter"
            class="filter-select"
            [(ngModel)]="filters.actionType"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter by action type">
            <option value="">{{ 'common.all' | translate }}</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="ENABLE">ENABLE</option>
            <option value="DISABLE">DISABLE</option>
            <option value="ASSIGN">ASSIGN</option>
            <option value="REVOKE">REVOKE</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="targetTypeFilter" class="filter-label">{{ 'audit.adminActions.targetType' | translate }}</label>
          <select
            id="targetTypeFilter"
            class="filter-select"
            [(ngModel)]="filters.targetType"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter by target type">
            <option value="">{{ 'common.all' | translate }}</option>
            <option value="USER">USER</option>
            <option value="ROLE">ROLE</option>
            <option value="GROUP">GROUP</option>
            <option value="POLICY">POLICY</option>
            <option value="ENTITLEMENT">ENTITLEMENT</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="dateFromFilter" class="filter-label">{{ 'audit.adminActions.from' | translate }}</label>
          <input
            id="dateFromFilter"
            type="datetime-local"
            class="filter-input"
            [(ngModel)]="filters.from"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter from date" />
        </div>

        <div class="filter-group">
          <label for="dateToFilter" class="filter-label">{{ 'audit.adminActions.to' | translate }}</label>
          <input
            id="dateToFilter"
            type="datetime-local"
            class="filter-input"
            [(ngModel)]="filters.to"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter to date" />
        </div>

        <button class="btn btn-sm btn-outline" (click)="clearFilters()" aria-label="Clear all filters">
          <i class="pi pi-filter-slash" aria-hidden="true"></i>
          {{ 'common.clearFilters' | translate }}
        </button>
      </section>

      <!-- ============================================================ -->
      <!-- Loading State                                                 -->
      <!-- ============================================================ -->
      <div *ngIf="loading" class="loading-container" aria-live="polite">
        <i class="pi pi-spin pi-spinner loading-spinner" aria-hidden="true"></i>
        <span>{{ 'common.loading' | translate }}</span>
      </div>

      <!-- ============================================================ -->
      <!-- Error State                                                   -->
      <!-- ============================================================ -->
      <div *ngIf="error && !loading" class="error-state" role="alert">
        <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
        <span>{{ error }}</span>
        <button class="btn btn-sm btn-outline" (click)="loadActions()">
          {{ 'common.retry' | translate }}
        </button>
      </div>

      <!-- ============================================================ -->
      <!-- Empty State                                                   -->
      <!-- ============================================================ -->
      <div *ngIf="!loading && !error && actions.length === 0" class="empty-state" role="status">
        <i class="pi pi-inbox" aria-hidden="true"></i>
        <span>{{ 'audit.adminActions.noRecords' | translate }}</span>
      </div>

      <!-- ============================================================ -->
      <!-- Timeline / Card List                                          -->
      <!-- ============================================================ -->
      <div *ngIf="!loading && !error && actions.length > 0" class="timeline" role="list" aria-label="Admin action timeline">
        <div
          *ngFor="let action of actions; let i = index; trackBy: trackById"
          class="timeline-item"
          role="listitem"
          [attr.aria-label]="action.adminName + ' performed ' + action.action + ' on ' + action.targetType">
          <!-- Timeline connector -->
          <div class="timeline-connector">
            <div class="timeline-dot" [ngClass]="getActionColorClass(action.action)"></div>
            <div class="timeline-line" *ngIf="i < actions.length - 1"></div>
          </div>

          <!-- Action Card -->
          <div class="action-card">
            <div class="card-header" (click)="toggleExpand(action.id)" role="button"
              [attr.aria-expanded]="expandedIds.has(action.id)"
              [attr.aria-controls]="'diff-' + action.id"
              tabindex="0"
              (keydown.enter)="toggleExpand(action.id)"
              (keydown.space)="toggleExpand(action.id); $event.preventDefault()">
              <div class="card-header-content">
                <div class="card-meta-row">
                  <span class="action-badge" [ngClass]="getActionColorClass(action.action)">
                    {{ action.action }}
                  </span>
                  <span class="target-badge">{{ action.targetType }}</span>
                  <span class="timestamp">{{ action.timestamp | date:'medium' }}</span>
                </div>
                <div class="card-title-row">
                  <span class="admin-name">
                    <i class="pi pi-shield" aria-hidden="true"></i>
                    {{ action.adminName }}
                  </span>
                  <span class="action-desc">
                    performed <strong>{{ action.action }}</strong> on
                    <strong>{{ action.targetType }}</strong>: {{ action.targetName || action.targetId }}
                  </span>
                </div>
                <div class="card-detail-row">
                  <span class="ip-address">
                    <i class="pi pi-globe" aria-hidden="true"></i>
                    {{ action.ipAddress }}
                  </span>
                </div>
              </div>
              <i
                class="pi expand-icon"
                [ngClass]="expandedIds.has(action.id) ? 'pi-chevron-up' : 'pi-chevron-down'"
                aria-hidden="true">
              </i>
            </div>

            <!-- ── Expandable Diff View ── -->
            <div
              *ngIf="expandedIds.has(action.id)"
              [id]="'diff-' + action.id"
              class="diff-container"
              role="region"
              [attr.aria-label]="'Change diff for action ' + action.id">

              <div *ngIf="!action.oldValues && !action.newValues" class="diff-empty">
                {{ 'audit.adminActions.noDiffData' | translate }}
              </div>

              <!-- Diff Mode Toggle -->
              <div *ngIf="action.oldValues || action.newValues" class="diff-toolbar">
                <button
                  class="btn btn-sm"
                  [class.btn-primary]="diffMode === 'side-by-side'"
                  (click)="diffMode = 'side-by-side'"
                  aria-label="Side by side diff view">
                  Side by Side
                </button>
                <button
                  class="btn btn-sm"
                  [class.btn-primary]="diffMode === 'inline'"
                  (click)="diffMode = 'inline'"
                  aria-label="Inline diff view">
                  Inline
                </button>
              </div>

              <!-- Side-by-side diff -->
              <div *ngIf="diffMode === 'side-by-side' && (action.oldValues || action.newValues)" class="diff-side-by-side">
                <div class="diff-col diff-old">
                  <div class="diff-col-header">{{ 'audit.adminActions.oldValues' | translate }}</div>
                  <pre class="diff-json">{{ formatJson(action.oldValues) }}</pre>
                </div>
                <div class="diff-col diff-new">
                  <div class="diff-col-header">{{ 'audit.adminActions.newValues' | translate }}</div>
                  <pre class="diff-json">{{ formatJson(action.newValues) }}</pre>
                </div>
              </div>

              <!-- Inline diff -->
              <div *ngIf="diffMode === 'inline' && (action.oldValues || action.newValues)" class="diff-inline">
                <table class="diff-table" role="table" aria-label="Inline diff table">
                  <thead>
                    <tr>
                      <th>{{ 'audit.adminActions.field' | translate }}</th>
                      <th>{{ 'audit.adminActions.oldValue' | translate }}</th>
                      <th>{{ 'audit.adminActions.newValue' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      *ngFor="let entry of computeDiff(action.oldValues, action.newValues)"
                      [ngClass]="'diff-row-' + entry.status">
                      <td class="diff-field-name">{{ entry.key }}</td>
                      <td class="diff-old-val">
                        <span *ngIf="entry.status !== 'added'">{{ formatValue(entry.oldValue) }}</span>
                      </td>
                      <td class="diff-new-val">
                        <span *ngIf="entry.status !== 'removed'">{{ formatValue(entry.newValue) }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Pagination                                                    -->
      <!-- ============================================================ -->
      <div *ngIf="totalRecords > 0" class="pagination-bar" role="navigation" aria-label="Pagination">
        <span class="pagination-info">
          Showing {{ (currentPage - 1) * pageSize + 1 }}
          - {{ currentPage * pageSize > totalRecords ? totalRecords : currentPage * pageSize }}
          of {{ totalRecords }}
        </span>
        <div class="pagination-controls">
          <button
            class="btn btn-sm btn-icon"
            [disabled]="currentPage <= 1"
            (click)="goToPage(currentPage - 1)"
            aria-label="Previous page">
            <i class="pi pi-chevron-left" aria-hidden="true"></i>
          </button>
          <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
          <button
            class="btn btn-sm btn-icon"
            [disabled]="currentPage >= totalPages"
            (click)="goToPage(currentPage + 1)"
            aria-label="Next page">
            <i class="pi pi-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .action-history-page {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ── Header ── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
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

    /* ── Loading / Error / Empty ── */
    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 60px 20px;
      color: var(--text-color-secondary, #64748b);
    }
    .loading-spinner { font-size: 24px; }
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px;
      color: var(--red-500, #ef4444);
      text-align: center;
    }
    .error-state i { font-size: 28px; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 60px;
      color: var(--text-color-secondary, #64748b);
    }
    .empty-state i { font-size: 36px; opacity: 0.5; }

    /* ── Timeline ── */
    .timeline {
      display: flex;
      flex-direction: column;
    }
    .timeline-item {
      display: flex;
      gap: 16px;
    }
    .timeline-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 24px;
      flex-shrink: 0;
    }
    .timeline-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--primary-color, #3b82f6);
      margin-top: 18px;
      flex-shrink: 0;
    }
    .timeline-line {
      width: 2px;
      flex: 1;
      background: var(--surface-border, #dee2e6);
    }

    /* ── Action Card ── */
    .action-card {
      flex: 1;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      margin-bottom: 12px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .card-header:hover { background: var(--surface-hover, #f8fafc); }
    .card-header-content {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }
    .card-meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .card-title-row {
      font-size: 14px;
      color: var(--text-color, #333);
    }
    .admin-name {
      font-weight: 600;
      margin-right: 4px;
    }
    .admin-name i { margin-right: 2px; opacity: 0.6; }
    .action-desc strong { font-weight: 600; }
    .card-detail-row {
      font-size: 12px;
      color: var(--text-color-secondary, #64748b);
    }
    .ip-address i { margin-right: 4px; }
    .expand-icon {
      font-size: 14px;
      color: var(--text-color-secondary, #64748b);
      flex-shrink: 0;
    }

    /* Badges */
    .action-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .target-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(100,116,139,0.1);
      color: var(--text-color-secondary, #64748b);
    }
    .timestamp {
      font-size: 12px;
      color: var(--text-color-secondary, #94a3b8);
    }

    /* Badge colors per action */
    .action-create  { background: rgba(34,197,94,0.12); color: #16a34a; }
    .action-update  { background: rgba(59,130,246,0.12); color: #2563eb; }
    .action-delete  { background: rgba(239,68,68,0.12); color: #dc2626; }
    .action-enable  { background: rgba(34,197,94,0.12); color: #16a34a; }
    .action-disable { background: rgba(249,115,22,0.12); color: #ea580c; }
    .action-assign  { background: rgba(139,92,246,0.12); color: #7c3aed; }
    .action-revoke  { background: rgba(239,68,68,0.12); color: #dc2626; }
    .action-default { background: rgba(100,116,139,0.1); color: #64748b; }

    /* Timeline dot colors */
    .timeline-dot.action-create  { background: #16a34a; }
    .timeline-dot.action-update  { background: #2563eb; }
    .timeline-dot.action-delete  { background: #dc2626; }
    .timeline-dot.action-enable  { background: #16a34a; }
    .timeline-dot.action-disable { background: #ea580c; }
    .timeline-dot.action-assign  { background: #7c3aed; }
    .timeline-dot.action-revoke  { background: #dc2626; }
    .timeline-dot.action-default { background: #64748b; }

    /* ── Diff ── */
    .diff-container {
      border-top: 1px solid var(--surface-border, #dee2e6);
      padding: 16px 18px;
      background: var(--surface-ground, #f8f9fa);
    }
    .diff-empty {
      color: var(--text-color-secondary, #94a3b8);
      font-style: italic;
      text-align: center;
      padding: 12px;
    }
    .diff-toolbar {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }

    /* Side-by-side */
    .diff-side-by-side {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .diff-col {
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      overflow: hidden;
    }
    .diff-col-header {
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .diff-old .diff-col-header {
      background: rgba(239,68,68,0.08);
      color: #dc2626;
    }
    .diff-new .diff-col-header {
      background: rgba(34,197,94,0.08);
      color: #16a34a;
    }
    .diff-json {
      margin: 0;
      padding: 12px;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.6;
      background: var(--surface-card, #fff);
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--text-color, #333);
    }

    /* Inline diff table */
    .diff-inline {
      overflow-x: auto;
    }
    .diff-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .diff-table th {
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: var(--text-color-secondary, #64748b);
      background: var(--surface-card, #fff);
      border-bottom: 2px solid var(--surface-border, #dee2e6);
    }
    .diff-table td {
      padding: 6px 12px;
      border-bottom: 1px solid var(--surface-border, #dee2e6);
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      word-break: break-all;
    }
    .diff-field-name {
      font-weight: 600;
      color: var(--text-color, #333);
      font-family: inherit !important;
    }
    .diff-row-added   { background: rgba(34,197,94,0.08); }
    .diff-row-removed { background: rgba(239,68,68,0.08); }
    .diff-row-changed { background: rgba(234,179,8,0.08); }
    .diff-row-added .diff-new-val   { color: #16a34a; font-weight: 600; }
    .diff-row-removed .diff-old-val { color: #dc2626; font-weight: 600; }
    .diff-row-changed .diff-old-val { color: #dc2626; }
    .diff-row-changed .diff-new-val { color: #16a34a; font-weight: 600; }

    /* ── Pagination ── */
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
    }
    .pagination-info {
      font-size: 13px;
      color: var(--text-color-secondary, #64748b);
    }
    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .page-indicator {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-color, #333);
    }

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
export class AdminActionHistoryComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/audit/admin-actions';

  /** State */
  loading = false;
  error: string | null = null;
  actions: AdminAction[] = [];
  expandedIds = new Set<string>();
  diffMode: 'side-by-side' | 'inline' = 'inline';

  /** Pagination */
  currentPage = 1;
  pageSize = 20;
  totalRecords = 0;
  totalPages = 0;

  /** Filters */
  filters = {
    adminId: '' as string,
    actionType: '' as string,
    targetType: '' as string,
    from: '' as string,
    to: '' as string,
  };

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadActions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load admin actions from the API. */
  loadActions(): void {
    this.loading = true;
    this.error = null;

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('size', this.pageSize.toString());

    if (this.filters.adminId)    params = params.set('adminId', this.filters.adminId);
    if (this.filters.actionType) params = params.set('actionType', this.filters.actionType);
    if (this.filters.targetType) params = params.set('targetType', this.filters.targetType);
    if (this.filters.from)       params = params.set('from', this.filters.from);
    if (this.filters.to)         params = params.set('to', this.filters.to);

    this.http
      .get<ApiResponse<{ content: AdminAction[]; meta: PaginationMeta }>>(this.apiUrl, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.actions = response.data.content;
          this.totalRecords = response.data.meta.totalElements;
          this.totalPages = response.data.meta.totalPages;
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.error?.message || 'Failed to load admin action history';
          this.loading = false;
        },
      });
  }

  /** Handle filter change: reset to page 1 and reload. */
  onFilterChange(): void {
    this.currentPage = 1;
    this.loadActions();
  }

  /** Clear all filters and reload. */
  clearFilters(): void {
    this.filters = {
      adminId: '',
      actionType: '',
      targetType: '',
      from: '',
      to: '',
    };
    this.onFilterChange();
  }

  /** Navigate to a specific page. */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadActions();
  }

  /** Toggle expansion of an action card. */
  toggleExpand(id: string): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  /** Track-by function for ngFor. */
  trackById(_index: number, item: AdminAction): string {
    return item.id;
  }

  /** Returns a CSS class based on the action type. */
  getActionColorClass(action: string): string {
    switch (action?.toUpperCase()) {
      case 'CREATE':  return 'action-create';
      case 'UPDATE':  return 'action-update';
      case 'DELETE':  return 'action-delete';
      case 'ENABLE':  return 'action-enable';
      case 'DISABLE': return 'action-disable';
      case 'ASSIGN':  return 'action-assign';
      case 'REVOKE':  return 'action-revoke';
      default:        return 'action-default';
    }
  }

  /** Formats a JSON object as a pretty-printed string. */
  formatJson(obj: Record<string, any> | null): string {
    if (!obj) return '(empty)';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  /** Formats a single value for display in the inline diff table. */
  formatValue(value: any): string {
    if (value === null || value === undefined) return '(null)';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * Computes a field-level diff between old and new JSON values.
   * Returns entries classified as added, removed, changed, or unchanged.
   */
  computeDiff(
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null,
  ): DiffEntry[] {
    const old = oldValues || {};
    const nev = newValues || {};
    const allKeys = new Set([...Object.keys(old), ...Object.keys(nev)]);
    const entries: DiffEntry[] = [];

    for (const key of allKeys) {
      const hasOld = key in old;
      const hasNew = key in nev;

      if (hasOld && !hasNew) {
        entries.push({ key, oldValue: old[key], newValue: undefined, status: 'removed' });
      } else if (!hasOld && hasNew) {
        entries.push({ key, oldValue: undefined, newValue: nev[key], status: 'added' });
      } else if (JSON.stringify(old[key]) !== JSON.stringify(nev[key])) {
        entries.push({ key, oldValue: old[key], newValue: nev[key], status: 'changed' });
      } else {
        entries.push({ key, oldValue: old[key], newValue: nev[key], status: 'unchanged' });
      }
    }

    // Sort: changed/added/removed first, then unchanged
    const order = { added: 0, removed: 1, changed: 2, unchanged: 3 };
    entries.sort((a, b) => order[a.status] - order[b.status]);

    return entries;
  }
}
