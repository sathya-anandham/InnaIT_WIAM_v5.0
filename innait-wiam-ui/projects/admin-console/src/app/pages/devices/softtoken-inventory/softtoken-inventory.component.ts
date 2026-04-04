import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  RowClickedEvent,
  GridOptions,
} from 'ag-grid-community';
import { AuthService, ApiResponse, PaginationMeta } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface SoftTokenRow {
  tokenId: string;
  deviceName: string;
  platform: 'iOS' | 'Android';
  accountLoginId: string;
  accountDisplayName: string;
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  activatedAt: string;
  lastUsedAt: string | null;
  pushHealth: 'GREEN' | 'YELLOW' | 'RED';
}

interface SoftTokenStats {
  total: number;
  ios: number;
  android: number;
  healthyPushPercent: number;
}

interface SoftTokenPageResponse {
  content: SoftTokenRow[];
  meta: PaginationMeta;
  stats: SoftTokenStats;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_BASE = '/api/v1/admin';
const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

@Component({
  selector: 'app-softtoken-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridAngular,
    TranslatePipe,
  ],
  template: `
    <div class="softtoken-inventory-page">
      <!-- ============================================================ -->
      <!-- Summary Stats                                                 -->
      <!-- ============================================================ -->
      <div class="stats-bar" role="region" aria-label="Soft token statistics">
        <div class="stat-card">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">{{ 'softtoken.stats.total' | translate }}</span>
        </div>
        <div class="stat-card stat-ios">
          <i class="pi pi-apple stat-icon" aria-hidden="true"></i>
          <span class="stat-value">{{ stats.ios }}</span>
          <span class="stat-label">{{ 'softtoken.stats.ios' | translate }}</span>
        </div>
        <div class="stat-card stat-android">
          <i class="pi pi-android stat-icon" aria-hidden="true"></i>
          <span class="stat-value">{{ stats.android }}</span>
          <span class="stat-label">{{ 'softtoken.stats.android' | translate }}</span>
        </div>
        <div class="stat-card stat-push">
          <span class="stat-value">{{ stats.healthyPushPercent }}%</span>
          <span class="stat-label">{{ 'softtoken.stats.healthyPush' | translate }}</span>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Toolbar                                                       -->
      <!-- ============================================================ -->
      <header class="page-toolbar" role="toolbar" aria-label="Soft token inventory toolbar">
        <div class="toolbar-left">
          <h1 class="page-title">{{ 'softtoken.title' | translate }}</h1>
        </div>

        <div class="toolbar-right">
          <div class="toolbar-search">
            <i class="pi pi-search search-icon" aria-hidden="true"></i>
            <input
              type="text"
              class="toolbar-search-input"
              placeholder="Search device name or login ID..."
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchChange($event)"
              aria-label="Search soft tokens by device name or login ID" />
          </div>

          <button
            class="btn btn-icon"
            (click)="refreshGrid()"
            aria-label="Refresh soft token list">
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Content Area: Filter Panel + Grid                             -->
      <!-- ============================================================ -->
      <div class="content-area">
        <!-- Sidebar Filter Panel -->
        <aside
          class="filter-panel"
          [class.collapsed]="filterPanelCollapsed"
          role="search"
          aria-label="Soft token filter panel">
          <div class="filter-panel-header">
            <h2 class="filter-title">{{ 'common.filters' | translate }}</h2>
            <button
              class="btn btn-icon btn-sm"
              (click)="filterPanelCollapsed = !filterPanelCollapsed"
              [attr.aria-label]="filterPanelCollapsed ? 'Expand filter panel' : 'Collapse filter panel'">
              <i class="pi" [ngClass]="filterPanelCollapsed ? 'pi-chevron-right' : 'pi-chevron-left'" aria-hidden="true"></i>
            </button>
          </div>

          <div class="filter-body" *ngIf="!filterPanelCollapsed">
            <!-- Platform Filter -->
            <div class="filter-group">
              <label for="filter-platform" class="filter-label">{{ 'softtoken.filter.platform' | translate }}</label>
              <select
                id="filter-platform"
                class="filter-select"
                [(ngModel)]="filterPlatform"
                (ngModelChange)="onFilterChange()"
                aria-label="Filter by platform">
                <option value="">{{ 'common.all' | translate }}</option>
                <option value="iOS">iOS</option>
                <option value="Android">Android</option>
              </select>
            </div>

            <!-- Status Filter -->
            <div class="filter-group">
              <label for="filter-status" class="filter-label">{{ 'softtoken.filter.status' | translate }}</label>
              <select
                id="filter-status"
                class="filter-select"
                [(ngModel)]="filterStatus"
                (ngModelChange)="onFilterChange()"
                aria-label="Filter by device status">
                <option value="">{{ 'common.all' | translate }}</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            <!-- Clear Filters -->
            <button
              class="btn btn-sm btn-text"
              (click)="clearFilters()"
              aria-label="Clear all filters">
              <i class="pi pi-filter-slash" aria-hidden="true"></i>
              {{ 'common.clearFilters' | translate }}
            </button>
          </div>
        </aside>

        <!-- ag-Grid -->
        <div class="grid-container">
          <!-- Loading Overlay -->
          <div *ngIf="loading" class="grid-loading-overlay" role="alert" aria-label="Loading soft tokens">
            <div class="spinner"></div>
            <span>{{ 'common.loading' | translate }}</span>
          </div>

          <!-- Error State -->
          <div *ngIf="error && !loading" class="grid-error-state" role="alert">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            <span>{{ error }}</span>
            <button class="btn btn-sm btn-outline" (click)="refreshGrid()">
              {{ 'common.retry' | translate }}
            </button>
          </div>

          <ag-grid-angular
            class="ag-theme-alpine softtoken-grid"
            [columnDefs]="columnDefs"
            [gridOptions]="gridOptions"
            [rowModelType]="'serverSide'"
            [pagination]="true"
            [paginationPageSize]="pageSize"
            [cacheBlockSize]="pageSize"
            [animateRows]="true"
            (gridReady)="onGridReady($event)"
            (rowClicked)="onRowClicked($event)"
            aria-label="Soft token inventory table">
          </ag-grid-angular>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Confirmation Dialog                                           -->
      <!-- ============================================================ -->
      <div
        *ngIf="confirmDialog.visible"
        class="dialog-backdrop"
        (click)="confirmDialog.visible = false"
        role="presentation">
        <div
          class="dialog-panel"
          role="dialog"
          [attr.aria-label]="confirmDialog.title"
          (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>{{ confirmDialog.title }}</h3>
            <button
              class="btn btn-icon btn-sm"
              (click)="confirmDialog.visible = false"
              aria-label="Close dialog">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
          <div class="dialog-body">
            <p>{{ confirmDialog.message }}</p>
          </div>
          <div class="dialog-footer">
            <button
              class="btn btn-outline"
              (click)="confirmDialog.visible = false">
              {{ 'common.cancel' | translate }}
            </button>
            <button
              class="btn"
              [ngClass]="confirmDialog.severity === 'danger' ? 'btn-danger' : 'btn-primary'"
              (click)="executeAction()"
              [disabled]="actionInProgress">
              <i *ngIf="actionInProgress" class="pi pi-spinner pi-spin" aria-hidden="true"></i>
              {{ confirmDialog.confirmLabel }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Test Push Result Toast                                        -->
      <!-- ============================================================ -->
      <div
        *ngIf="testPushResult"
        class="toast"
        [ngClass]="testPushResult.success ? 'toast-success' : 'toast-error'"
        role="alert"
        aria-live="polite">
        <i class="pi" [ngClass]="testPushResult.success ? 'pi-check-circle' : 'pi-times-circle'" aria-hidden="true"></i>
        <span>{{ testPushResult.message }}</span>
        <button class="toast-close" (click)="testPushResult = null" aria-label="Dismiss notification">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    /* ============================================================ */
    /* Page Layout                                                    */
    /* ============================================================ */
    .softtoken-inventory-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 16px;
      padding: 24px;
      background: var(--surface-ground, #f8f9fa);
    }

    /* ============================================================ */
    /* Stats Bar                                                      */
    /* ============================================================ */
    .stats-bar {
      display: flex;
      gap: 16px;
    }
    .stat-card {
      flex: 1;
      background: var(--surface-card, #ffffff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }
    .stat-card.stat-ios { border-left: 4px solid #007aff; }
    .stat-card.stat-android { border-left: 4px solid #3ddc84; }
    .stat-card.stat-push { border-left: 4px solid var(--green-500, #22c55e); }
    .stat-icon {
      font-size: 20px;
      color: var(--text-color-secondary, #6c757d);
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-color, #333);
    }
    .stat-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-color-secondary, #6c757d);
    }

    /* ============================================================ */
    /* Toolbar                                                        */
    /* ============================================================ */
    .page-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .page-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: var(--text-color, #333);
    }
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .toolbar-search {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 10px;
      color: var(--text-color-secondary, #6c757d);
      font-size: 14px;
    }
    .toolbar-search-input {
      padding: 8px 12px 8px 32px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      font-size: 14px;
      width: 280px;
      outline: none;
      transition: border-color 0.2s;
      background: var(--surface-card, #ffffff);
      color: var(--text-color, #333);
    }
    .toolbar-search-input:focus {
      border-color: var(--primary-color, #3b82f6);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }

    /* ============================================================ */
    /* Buttons                                                        */
    /* ============================================================ */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary {
      background: var(--primary-color, #3b82f6);
      color: #fff;
      border-color: var(--primary-color, #3b82f6);
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
    .btn-outline {
      background: var(--surface-card, #ffffff);
      color: var(--text-color, #333);
      border-color: var(--surface-border, #dee2e6);
    }
    .btn-outline:hover:not(:disabled) { background: var(--surface-hover, #f1f5f9); }
    .btn-danger {
      background: var(--red-500, #ef4444);
      color: #fff;
      border-color: var(--red-500, #ef4444);
    }
    .btn-danger:hover:not(:disabled) { filter: brightness(0.92); }
    .btn-icon {
      padding: 8px;
      background: var(--surface-card, #ffffff);
      border-color: var(--surface-border, #dee2e6);
      border-radius: 8px;
      color: var(--text-color, #333);
    }
    .btn-icon:hover:not(:disabled) { background: var(--surface-hover, #f1f5f9); }
    .btn-sm { padding: 4px 10px; font-size: 13px; }
    .btn-text {
      background: transparent;
      border: none;
      color: var(--primary-color, #3b82f6);
      padding: 4px 8px;
    }
    .btn-text:hover { text-decoration: underline; }

    /* ============================================================ */
    /* Content Area                                                   */
    /* ============================================================ */
    .content-area {
      display: flex;
      flex: 1;
      gap: 16px;
      min-height: 0;
    }

    /* Filter Panel */
    .filter-panel {
      width: 240px;
      min-width: 240px;
      background: var(--surface-card, #ffffff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: width 0.2s, min-width 0.2s, padding 0.2s;
      overflow: hidden;
    }
    .filter-panel.collapsed {
      width: 48px;
      min-width: 48px;
      padding: 16px 8px;
    }
    .filter-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .filter-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color, #333);
    }
    .filter-panel.collapsed .filter-title { display: none; }
    .filter-body { display: flex; flex-direction: column; gap: 16px; }
    .filter-group { display: flex; flex-direction: column; gap: 6px; }
    .filter-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-color-secondary, #6c757d);
    }
    .filter-select {
      padding: 8px 10px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      font-size: 14px;
      background: var(--surface-card, #ffffff);
      color: var(--text-color, #333);
      outline: none;
    }
    .filter-select:focus {
      border-color: var(--primary-color, #3b82f6);
    }

    /* Grid Container */
    .grid-container {
      flex: 1;
      min-height: 0;
      position: relative;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--surface-border, #dee2e6);
    }
    .softtoken-grid {
      width: 100%;
      height: 100%;
    }

    /* Loading / Error */
    .grid-loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 10;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid var(--surface-border, #dee2e6);
      border-top-color: var(--primary-color, #3b82f6);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .grid-error-state {
      position: absolute;
      inset: 0;
      background: var(--surface-card, #ffffff);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--red-500, #ef4444);
      z-index: 10;
    }
    .grid-error-state i { font-size: 32px; }

    /* ============================================================ */
    /* Badges                                                         */
    /* ============================================================ */
    :host ::ng-deep .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    :host ::ng-deep .status-badge.badge-active {
      background: var(--green-50, #f0fdf4);
      color: var(--green-600, #16a34a);
    }
    :host ::ng-deep .status-badge.badge-suspended {
      background: var(--yellow-50, #fffbeb);
      color: var(--yellow-600, #ca8a04);
    }

    :host ::ng-deep .platform-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    :host ::ng-deep .platform-badge.badge-ios {
      background: #e8f0fe;
      color: #007aff;
    }
    :host ::ng-deep .platform-badge.badge-android {
      background: #e6f9ed;
      color: #0d9e3f;
    }

    /* Push health dot */
    :host ::ng-deep .push-health-dot {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    :host ::ng-deep .push-health-dot.dot-green { background: var(--green-500, #22c55e); }
    :host ::ng-deep .push-health-dot.dot-yellow { background: var(--yellow-500, #f59e0b); }
    :host ::ng-deep .push-health-dot.dot-red { background: var(--red-500, #ef4444); }

    /* Action buttons inside grid */
    :host ::ng-deep .action-btn-group {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    :host ::ng-deep .grid-action-btn {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    :host ::ng-deep .grid-action-btn.act-suspend {
      background: var(--yellow-50, #fffbeb);
      color: var(--yellow-700, #a16207);
      border-color: var(--yellow-200, #fde68a);
    }
    :host ::ng-deep .grid-action-btn.act-suspend:hover { background: var(--yellow-100, #fef3c7); }
    :host ::ng-deep .grid-action-btn.act-revoke {
      background: var(--red-50, #fef2f2);
      color: var(--red-700, #b91c1c);
      border-color: var(--red-200, #fecaca);
    }
    :host ::ng-deep .grid-action-btn.act-revoke:hover { background: var(--red-100, #fee2e2); }
    :host ::ng-deep .grid-action-btn.act-test-push {
      background: var(--blue-50, #eff6ff);
      color: var(--blue-700, #1d4ed8);
      border-color: var(--blue-200, #bfdbfe);
    }
    :host ::ng-deep .grid-action-btn.act-test-push:hover { background: var(--blue-100, #dbeafe); }

    /* ============================================================ */
    /* Dialog                                                         */
    /* ============================================================ */
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .dialog-panel {
      background: var(--surface-card, #ffffff);
      border-radius: 12px;
      width: 440px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--surface-border, #dee2e6);
    }
    .dialog-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    .dialog-body { padding: 20px; }
    .dialog-body p { margin: 0; font-size: 14px; line-height: 1.5; }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid var(--surface-border, #dee2e6);
    }

    /* ============================================================ */
    /* Toast                                                          */
    /* ============================================================ */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      z-index: 2000;
      animation: slideIn 0.3s ease-out;
    }
    .toast-success {
      background: var(--green-50, #f0fdf4);
      color: var(--green-700, #15803d);
      border: 1px solid var(--green-200, #bbf7d0);
    }
    .toast-error {
      background: var(--red-50, #fef2f2);
      color: var(--red-700, #b91c1c);
      border: 1px solid var(--red-200, #fecaca);
    }
    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      color: inherit;
      padding: 2px;
    }
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `],
})
export class SoftTokenInventoryComponent implements OnInit, OnDestroy {
  /* ---------------------------------------------------------------- */
  /*  State                                                            */
  /* ---------------------------------------------------------------- */
  loading = false;
  error: string | null = null;
  actionInProgress = false;
  filterPanelCollapsed = false;

  searchTerm = '';
  filterPlatform = '';
  filterStatus = '';
  pageSize = PAGE_SIZE;

  stats: SoftTokenStats = { total: 0, ios: 0, android: 0, healthyPushPercent: 0 };

  testPushResult: { success: boolean; message: string } | null = null;

  confirmDialog = {
    visible: false,
    title: '',
    message: '',
    confirmLabel: '',
    severity: 'primary' as 'primary' | 'danger',
    tokenId: '',
    action: '' as 'suspend' | 'revoke' | 'test-push',
  };

  /* ag-Grid */
  gridOptions: GridOptions = {
    rowHeight: 48,
    headerHeight: 44,
    suppressCellFocus: true,
    rowSelection: 'single',
    overlayNoRowsTemplate: '<span class="ag-overlay-no-rows-center">No soft tokens found</span>',
  };
  columnDefs: ColDef[] = [];
  private gridApi!: GridApi;

  /* RxJS */
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  ngOnInit(): void {
    this.initColumnDefs();
    this.loadStats();

    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.refreshGrid());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ---------------------------------------------------------------- */
  /*  Column Definitions                                               */
  /* ---------------------------------------------------------------- */

  private initColumnDefs(): void {
    this.columnDefs = [
      {
        headerName: 'Device Name',
        field: 'deviceName',
        flex: 2,
      },
      {
        headerName: 'Platform',
        field: 'platform',
        flex: 1,
        cellRenderer: (params: any) => {
          if (!params.value) return '';
          const platform = params.value as string;
          const badgeClass = platform === 'iOS' ? 'badge-ios' : 'badge-android';
          const icon = platform === 'iOS' ? 'pi-apple' : 'pi-android';
          return `<span class="platform-badge ${badgeClass}"><i class="pi ${icon}" style="font-size:12px"></i> ${platform}</span>`;
        },
      },
      {
        headerName: 'Login ID',
        field: 'accountLoginId',
        flex: 1.5,
      },
      {
        headerName: 'Status',
        field: 'status',
        flex: 1,
        cellRenderer: (params: any) => {
          if (!params.value) return '';
          const status = params.value as string;
          const badgeClass = status === 'ACTIVE' ? 'badge-active' : 'badge-suspended';
          return `<span class="status-badge ${badgeClass}">${status}</span>`;
        },
      },
      {
        headerName: 'Activated At',
        field: 'activatedAt',
        flex: 1,
        cellRenderer: (params: any) => {
          if (!params.value) return '';
          return this.formatDate(params.value);
        },
      },
      {
        headerName: 'Last Used At',
        field: 'lastUsedAt',
        flex: 1,
        cellRenderer: (params: any) => {
          if (!params.value) return '<span style="color:var(--text-color-secondary,#6c757d)">Never</span>';
          return this.formatDate(params.value);
        },
      },
      {
        headerName: 'Push',
        field: 'pushHealth',
        flex: 0.5,
        cellRenderer: (params: any) => {
          if (!params.value) return '';
          const health = params.value as string;
          const dotClass = health === 'GREEN' ? 'dot-green' : health === 'YELLOW' ? 'dot-yellow' : 'dot-red';
          const tooltip = health === 'GREEN' ? 'Push notifications delivered successfully'
            : health === 'YELLOW' ? 'Push notifications partially delivered'
            : 'Push notifications failing';
          return `<span class="push-health-dot ${dotClass}" title="${tooltip}" role="img" aria-label="${tooltip}"></span>`;
        },
      },
      {
        headerName: 'Actions',
        field: 'tokenId',
        flex: 1,
        sortable: false,
        filter: false,
        cellRenderer: (params: any) => {
          if (!params.data) return '';
          const row = params.data as SoftTokenRow;
          let html = '<div class="action-btn-group">';
          if (row.status === 'ACTIVE') {
            html += `<button class="grid-action-btn act-suspend" data-action="suspend" data-id="${this.escapeHtml(row.tokenId)}" title="Suspend token">Suspend</button>`;
          }
          html += `<button class="grid-action-btn act-revoke" data-action="revoke" data-id="${this.escapeHtml(row.tokenId)}" title="Revoke token">Revoke</button>`;
          html += `<button class="grid-action-btn act-test-push" data-action="test-push" data-id="${this.escapeHtml(row.tokenId)}" title="Send test push notification">Test</button>`;
          html += '</div>';
          return html;
        },
        onCellClicked: (params: any) => {
          const target = params.event?.target as HTMLElement;
          if (target?.classList.contains('grid-action-btn')) {
            const action = target.getAttribute('data-action') as 'suspend' | 'revoke' | 'test-push';
            const tokenId = target.getAttribute('data-id') || '';
            if (action && tokenId) {
              this.openConfirmDialog(action, tokenId, params.data);
            }
          }
        },
      },
    ];
  }

  /* ---------------------------------------------------------------- */
  /*  Grid Setup                                                       */
  /* ---------------------------------------------------------------- */

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.setGridOption('serverSideDatasource', this.createDatasource());
  }

  private createDatasource(): IServerSideDatasource {
    return {
      getRows: (params: IServerSideGetRowsParams) => {
        this.loading = true;
        this.error = null;

        const page = Math.floor(params.request.startRow! / this.pageSize);
        let httpParams = new HttpParams()
          .set('page', page.toString())
          .set('size', this.pageSize.toString());

        if (this.searchTerm.trim()) {
          httpParams = httpParams.set('search', this.searchTerm.trim());
        }
        if (this.filterPlatform) {
          httpParams = httpParams.set('platform', this.filterPlatform);
        }
        if (this.filterStatus) {
          httpParams = httpParams.set('status', this.filterStatus);
        }

        this.http
          .get<ApiResponse<SoftTokenPageResponse>>(`${API_BASE}/devices/softtoken`, { params: httpParams })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              const data = response.data;
              if (data.stats) {
                this.stats = data.stats;
              }
              params.success({
                rowData: data.content,
                rowCount: data.meta.totalElements,
              });
              this.loading = false;
            },
            error: (err) => {
              this.error = err?.error?.error?.message || 'Failed to load soft tokens';
              params.fail();
              this.loading = false;
            },
          });
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Grid Events                                                      */
  /* ---------------------------------------------------------------- */

  onRowClicked(event: RowClickedEvent): void {
    const target = event.event?.target as HTMLElement;
    if (target?.classList.contains('grid-action-btn')) {
      return;
    }
    const row = event.data as SoftTokenRow;
    if (row?.userId) {
      this.router.navigate(['/users', row.userId]);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Search & Filters                                                 */
  /* ---------------------------------------------------------------- */

  onSearchChange(term: string): void {
    this.search$.next(term);
  }

  onFilterChange(): void {
    this.refreshGrid();
  }

  clearFilters(): void {
    this.filterPlatform = '';
    this.filterStatus = '';
    this.searchTerm = '';
    this.refreshGrid();
  }

  refreshGrid(): void {
    if (this.gridApi) {
      this.gridApi.refreshServerSide({ purge: true });
    }
    this.loadStats();
  }

  /* ---------------------------------------------------------------- */
  /*  Stats                                                            */
  /* ---------------------------------------------------------------- */

  private loadStats(): void {
    let httpParams = new HttpParams();
    if (this.searchTerm.trim()) {
      httpParams = httpParams.set('search', this.searchTerm.trim());
    }
    if (this.filterPlatform) {
      httpParams = httpParams.set('platform', this.filterPlatform);
    }
    if (this.filterStatus) {
      httpParams = httpParams.set('status', this.filterStatus);
    }

    this.http
      .get<ApiResponse<SoftTokenStats>>(`${API_BASE}/devices/softtoken/stats`, { params: httpParams })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.stats = res.data;
        },
        error: () => {
          // Stats are non-critical
        },
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Device Actions                                                   */
  /* ---------------------------------------------------------------- */

  openConfirmDialog(
    action: 'suspend' | 'revoke' | 'test-push',
    tokenId: string,
    row: SoftTokenRow,
  ): void {
    const label = row.deviceName || tokenId;

    if (action === 'suspend') {
      this.confirmDialog = {
        visible: true,
        title: 'Suspend Soft Token',
        message: `Are you sure you want to suspend the soft token "${label}"? The user will not be able to use this token for authentication until it is reactivated.`,
        confirmLabel: 'Suspend',
        severity: 'primary',
        tokenId,
        action,
      };
    } else if (action === 'revoke') {
      this.confirmDialog = {
        visible: true,
        title: 'Revoke Soft Token',
        message: `Are you sure you want to permanently revoke the soft token "${label}"? This action cannot be undone.`,
        confirmLabel: 'Revoke',
        severity: 'danger',
        tokenId,
        action,
      };
    } else {
      this.confirmDialog = {
        visible: true,
        title: 'Send Test Push Notification',
        message: `This will send a test push notification to the device "${label}". The user may see a notification prompt on their device.`,
        confirmLabel: 'Send Test',
        severity: 'primary',
        tokenId,
        action,
      };
    }
  }

  executeAction(): void {
    this.actionInProgress = true;
    const { tokenId, action } = this.confirmDialog;
    let request$: Observable<ApiResponse<any>>;

    if (action === 'suspend') {
      request$ = this.http.post<ApiResponse<void>>(
        `${API_BASE}/devices/softtoken/${tokenId}/suspend`, {},
      );
    } else if (action === 'revoke') {
      request$ = this.http.delete<ApiResponse<void>>(
        `${API_BASE}/devices/softtoken/${tokenId}`,
      );
    } else {
      request$ = this.http.post<ApiResponse<{ delivered: boolean }>>(
        `${API_BASE}/devices/softtoken/${tokenId}/test-push`, {},
      );
    }

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: ApiResponse<any>) => {
        this.actionInProgress = false;
        this.confirmDialog.visible = false;

        if (action === 'test-push') {
          const delivered = res?.data?.delivered ?? true;
          this.testPushResult = {
            success: delivered,
            message: delivered
              ? 'Test push notification sent successfully.'
              : 'Test push notification could not be delivered.',
          };
          this.autoDismissToast();
        } else {
          this.refreshGrid();
        }
      },
      error: (err: any) => {
        this.actionInProgress = false;
        if (action === 'test-push') {
          this.confirmDialog.visible = false;
          this.testPushResult = {
            success: false,
            message: err?.error?.error?.message || 'Failed to send test push notification.',
          };
          this.autoDismissToast();
        } else {
          this.confirmDialog.message =
            err?.error?.error?.message || `Failed to ${action} token. Please try again.`;
        }
      },
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  private autoDismissToast(): void {
    setTimeout(() => {
      this.testPushResult = null;
    }, 5000);
  }

  private formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
