import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil, interval } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { ApiResponse } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/** Daily login trend data point. */
interface LoginTrendData {
  dates: string[];
  success: number[];
  failure: number[];
}

/** Geo-distribution entry. */
interface GeoEntry {
  country: string;
  region: string;
  loginCount: number;
  failureRate: number;
  lastLogin: string;
}

/** Failed IP entry. */
interface FailedIpEntry {
  ipAddress: string;
  failureCount: number;
  lastAttempt: string;
  blockedStatus: boolean;
}

/** Authentication method distribution entry. */
interface AuthMethodEntry {
  method: string;
  count: number;
}

@Component({
  selector: 'app-login-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective, TranslatePipe],
  template: `
    <div class="login-analytics-page" role="main" aria-label="Login analytics dashboard">
      <!-- ============================================================ -->
      <!-- Page Header                                                   -->
      <!-- ============================================================ -->
      <header class="page-header">
        <h1 class="page-title">{{ 'audit.loginAnalytics.title' | translate }}</h1>
        <div class="header-actions">
          <!-- Date range selector -->
          <div class="filter-group-inline">
            <label for="dateFrom" class="sr-only">From date</label>
            <input
              id="dateFrom"
              type="date"
              class="filter-input"
              [(ngModel)]="dateRange.from"
              (ngModelChange)="onDateRangeChange()"
              aria-label="Date range from" />
          </div>
          <span class="date-separator">to</span>
          <div class="filter-group-inline">
            <label for="dateTo" class="sr-only">To date</label>
            <input
              id="dateTo"
              type="date"
              class="filter-input"
              [(ngModel)]="dateRange.to"
              (ngModelChange)="onDateRangeChange()"
              aria-label="Date range to" />
          </div>

          <!-- Auto-refresh toggle -->
          <button
            class="btn btn-sm"
            [class.btn-primary]="autoRefresh"
            (click)="toggleAutoRefresh()"
            [attr.aria-pressed]="autoRefresh"
            aria-label="Toggle auto-refresh every 30 seconds">
            <i class="pi pi-sync" aria-hidden="true"></i>
            Auto (30s)
          </button>

          <button
            class="btn btn-icon"
            (click)="refreshAll()"
            aria-label="Refresh all analytics data">
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Success/Failure Trends                                        -->
      <!-- ============================================================ -->
      <section class="panel" role="region" aria-label="Login success and failure trends">
        <div class="panel-header">
          <h2 class="panel-title">{{ 'audit.loginAnalytics.trends' | translate }}</h2>
          <div class="period-selector">
            <button
              *ngFor="let p of periodOptions"
              class="btn btn-xs"
              [class.btn-primary]="selectedPeriod === p"
              (click)="selectedPeriod = p; loadTrends()"
              [attr.aria-pressed]="selectedPeriod === p"
              [attr.aria-label]="'Show last ' + p + ' days'">
              {{ p }}d
            </button>
          </div>
        </div>
        <div class="panel-body">
          <!-- Loading -->
          <div *ngIf="trendsLoading" class="chart-loading">
            <div class="skeleton-chart"></div>
          </div>
          <!-- Error -->
          <div *ngIf="trendsError && !trendsLoading" class="panel-error" role="alert">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            <span>{{ trendsError }}</span>
            <button class="btn btn-sm btn-outline" (click)="loadTrends()">{{ 'common.retry' | translate }}</button>
          </div>
          <!-- Chart -->
          <div *ngIf="!trendsLoading && !trendsError" class="chart-container">
            <canvas
              baseChart
              [data]="trendsChartData"
              [options]="trendsChartOptions"
              [type]="'line'"
              aria-label="Login success and failure trend chart">
            </canvas>
          </div>
        </div>
      </section>

      <!-- ============================================================ -->
      <!-- Two-column layout: Geo + Auth Method                          -->
      <!-- ============================================================ -->
      <div class="two-col-row">
        <!-- Geo Distribution Table -->
        <section class="panel" role="region" aria-label="Login geo distribution">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'audit.loginAnalytics.geoDistribution' | translate }}</h2>
          </div>
          <div class="panel-body">
            <div *ngIf="geoLoading" class="table-loading">
              <div class="skeleton-row" *ngFor="let r of [1,2,3,4,5]"></div>
            </div>
            <div *ngIf="geoError && !geoLoading" class="panel-error" role="alert">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              <span>{{ geoError }}</span>
              <button class="btn btn-sm btn-outline" (click)="loadGeo()">{{ 'common.retry' | translate }}</button>
            </div>
            <div *ngIf="!geoLoading && !geoError" class="table-scroll">
              <table class="data-table" role="table" aria-label="Login counts by country and region">
                <thead>
                  <tr>
                    <th scope="col">{{ 'audit.loginAnalytics.country' | translate }}</th>
                    <th scope="col">{{ 'audit.loginAnalytics.region' | translate }}</th>
                    <th scope="col" class="text-right">{{ 'audit.loginAnalytics.logins' | translate }}</th>
                    <th scope="col" class="text-right">{{ 'audit.loginAnalytics.failureRate' | translate }}</th>
                    <th scope="col">{{ 'audit.loginAnalytics.lastLogin' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let entry of geoData; trackBy: trackByCountry">
                    <td>{{ entry.country }}</td>
                    <td>{{ entry.region }}</td>
                    <td class="text-right">{{ entry.loginCount | number }}</td>
                    <td class="text-right">
                      <span [class.text-danger]="entry.failureRate > 20" [class.text-warning]="entry.failureRate > 10 && entry.failureRate <= 20">
                        {{ entry.failureRate | number:'1.1-1' }}%
                      </span>
                    </td>
                    <td>{{ entry.lastLogin | date:'medium' }}</td>
                  </tr>
                  <tr *ngIf="geoData.length === 0">
                    <td colspan="5" class="empty-cell">{{ 'audit.loginAnalytics.noGeoData' | translate }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Auth Method Distribution Donut -->
        <section class="panel" role="region" aria-label="Authentication method distribution">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'audit.loginAnalytics.authMethods' | translate }}</h2>
          </div>
          <div class="panel-body centered">
            <div *ngIf="authMethodLoading" class="chart-loading small">
              <div class="skeleton-chart"></div>
            </div>
            <div *ngIf="authMethodError && !authMethodLoading" class="panel-error" role="alert">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              <span>{{ authMethodError }}</span>
              <button class="btn btn-sm btn-outline" (click)="loadAuthMethods()">{{ 'common.retry' | translate }}</button>
            </div>
            <div *ngIf="!authMethodLoading && !authMethodError" class="donut-container">
              <canvas
                baseChart
                [data]="authMethodChartData"
                [options]="authMethodChartOptions"
                [type]="'doughnut'"
                aria-label="Authentication method distribution chart">
              </canvas>
            </div>
          </div>
        </section>
      </div>

      <!-- ============================================================ -->
      <!-- Top Failed IPs                                                -->
      <!-- ============================================================ -->
      <section class="panel" role="region" aria-label="Top failed login IP addresses">
        <div class="panel-header">
          <h2 class="panel-title">{{ 'audit.loginAnalytics.topFailedIps' | translate }}</h2>
        </div>
        <div class="panel-body">
          <div *ngIf="failedIpsLoading" class="table-loading">
            <div class="skeleton-row" *ngFor="let r of [1,2,3,4,5]"></div>
          </div>
          <div *ngIf="failedIpsError && !failedIpsLoading" class="panel-error" role="alert">
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            <span>{{ failedIpsError }}</span>
            <button class="btn btn-sm btn-outline" (click)="loadFailedIps()">{{ 'common.retry' | translate }}</button>
          </div>
          <div *ngIf="!failedIpsLoading && !failedIpsError" class="table-scroll">
            <table class="data-table" role="table" aria-label="IP addresses with most failed login attempts">
              <thead>
                <tr>
                  <th scope="col">{{ 'audit.loginAnalytics.ipAddress' | translate }}</th>
                  <th scope="col" class="text-right">{{ 'audit.loginAnalytics.failureCount' | translate }}</th>
                  <th scope="col">{{ 'audit.loginAnalytics.lastAttempt' | translate }}</th>
                  <th scope="col">{{ 'audit.loginAnalytics.blockedStatus' | translate }}</th>
                  <th scope="col">{{ 'audit.loginAnalytics.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let ip of failedIps; trackBy: trackByIp">
                  <td class="monospace">{{ ip.ipAddress }}</td>
                  <td class="text-right">
                    <span class="failure-count-badge">{{ ip.failureCount | number }}</span>
                  </td>
                  <td>{{ ip.lastAttempt | date:'medium' }}</td>
                  <td>
                    <span class="blocked-badge" [class.blocked-yes]="ip.blockedStatus" [class.blocked-no]="!ip.blockedStatus">
                      {{ ip.blockedStatus ? 'BLOCKED' : 'ACTIVE' }}
                    </span>
                  </td>
                  <td>
                    <button
                      *ngIf="!ip.blockedStatus"
                      class="btn btn-sm btn-danger"
                      (click)="blockIp(ip)"
                      [disabled]="blockingIps.has(ip.ipAddress)"
                      [attr.aria-label]="'Block IP address ' + ip.ipAddress">
                      <i *ngIf="blockingIps.has(ip.ipAddress)" class="pi pi-spin pi-spinner" aria-hidden="true"></i>
                      <i *ngIf="!blockingIps.has(ip.ipAddress)" class="pi pi-ban" aria-hidden="true"></i>
                      {{ 'audit.loginAnalytics.blockIp' | translate }}
                    </button>
                    <span *ngIf="ip.blockedStatus" class="text-muted">--</span>
                  </td>
                </tr>
                <tr *ngIf="failedIps.length === 0">
                  <td colspan="5" class="empty-cell">{{ 'audit.loginAnalytics.noFailedIps' | translate }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .login-analytics-page {
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
      flex-wrap: wrap;
    }
    .filter-group-inline { display: inline-flex; }
    .date-separator {
      font-size: 13px;
      color: var(--text-color-secondary, #64748b);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }

    /* ── Panels ── */
    .panel {
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--surface-border, #dee2e6);
      background: var(--surface-ground, #f8f9fa);
    }
    .panel-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-color, #333);
    }
    .panel-body {
      padding: 20px;
    }
    .panel-body.centered {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Period selector */
    .period-selector {
      display: flex;
      gap: 4px;
    }

    /* Two column layout */
    .two-col-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 900px) {
      .two-col-row { grid-template-columns: 1fr; }
    }

    /* ── Charts ── */
    .chart-container {
      width: 100%;
      height: 300px;
      position: relative;
    }
    .donut-container {
      width: 100%;
      max-width: 320px;
      height: 300px;
      position: relative;
    }
    .chart-loading {
      width: 100%;
      height: 300px;
    }
    .chart-loading.small { height: 200px; }
    .skeleton-chart {
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, var(--surface-200, #e9ecef) 25%, var(--surface-100, #f8f9fa) 50%, var(--surface-200, #e9ecef) 75%);
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 8px;
    }
    @keyframes pulse {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Panel error */
    .panel-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px;
      color: var(--red-500, #ef4444);
      text-align: center;
    }
    .panel-error i { font-size: 24px; }

    /* ── Tables ── */
    .table-scroll {
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .data-table th {
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: var(--text-color-secondary, #64748b);
      background: var(--surface-ground, #f8f9fa);
      border-bottom: 2px solid var(--surface-border, #dee2e6);
    }
    .data-table td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--surface-border, #dee2e6);
      color: var(--text-color, #333);
    }
    .data-table tbody tr:hover {
      background: var(--surface-hover, #f8fafc);
    }
    .text-right { text-align: right; }
    .text-danger { color: var(--red-500, #ef4444); }
    .text-warning { color: var(--orange-500, #f97316); }
    .text-muted { color: var(--text-color-secondary, #94a3b8); }
    .monospace { font-family: 'Fira Code', 'Consolas', monospace; }
    .empty-cell {
      text-align: center;
      color: var(--text-color-secondary, #94a3b8);
      font-style: italic;
      padding: 20px;
    }

    /* Table loading skeleton */
    .table-loading { display: flex; flex-direction: column; gap: 8px; }
    .skeleton-row {
      height: 36px;
      background: linear-gradient(90deg, var(--surface-200, #e9ecef) 25%, var(--surface-100, #f8f9fa) 50%, var(--surface-200, #e9ecef) 75%);
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 4px;
    }

    /* Badges */
    .failure-count-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(239,68,68,0.1);
      color: #dc2626;
    }
    .blocked-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .blocked-yes {
      background: rgba(239,68,68,0.12);
      color: #dc2626;
    }
    .blocked-no {
      background: rgba(34,197,94,0.12);
      color: #16a34a;
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
    .btn-danger {
      background: #ef4444;
      color: #fff;
      border-color: #ef4444;
    }
    .btn-danger:hover { filter: brightness(1.1); }
    .btn-outline { border-color: var(--surface-border, #dee2e6); }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-xs { padding: 4px 10px; font-size: 11px; }
    .btn-icon {
      padding: 8px;
      border-radius: 8px;
      min-width: 36px;
      justify-content: center;
    }

    .filter-input {
      padding: 7px 10px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 6px;
      font-size: 13px;
      background: var(--surface-ground, #f8f9fa);
      color: var(--text-color, #333);
    }
    .filter-input:focus {
      outline: 2px solid var(--primary-color, #3b82f6);
      outline-offset: -1px;
    }
  `],
})
export class LoginAnalyticsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/audit/login-analytics';
  private autoRefreshSubscription: any = null;

  /** Period selection */
  readonly periodOptions = [7, 14, 30, 90];
  selectedPeriod = 30;

  /** Date range */
  dateRange = { from: '', to: '' };

  /** Auto-refresh */
  autoRefresh = false;

  /** Trends state */
  trendsLoading = false;
  trendsError: string | null = null;
  trendsChartData: ChartData<'line'> = { labels: [], datasets: [] };
  trendsChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' },
    },
    scales: {
      y: { beginAtZero: true },
    },
    elements: {
      line: { tension: 0.3, fill: false },
    },
  };

  /** Geo state */
  geoLoading = false;
  geoError: string | null = null;
  geoData: GeoEntry[] = [];

  /** Failed IPs state */
  failedIpsLoading = false;
  failedIpsError: string | null = null;
  failedIps: FailedIpEntry[] = [];
  blockingIps = new Set<string>();

  /** Auth method state */
  authMethodLoading = false;
  authMethodError: string | null = null;
  authMethodChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  authMethodChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' },
    },
    cutout: '60%',
  };

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
  }

  /** Refresh all data panels. */
  refreshAll(): void {
    this.loadTrends();
    this.loadGeo();
    this.loadFailedIps();
    this.loadAuthMethods();
  }

  /** Handle date range change. */
  onDateRangeChange(): void {
    this.refreshAll();
  }

  /** Toggle auto-refresh (30s interval). */
  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.autoRefreshSubscription = interval(30000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.refreshAll());
    } else {
      this.stopAutoRefresh();
    }
  }

  /** Stops the auto-refresh interval. */
  private stopAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = null;
    }
  }

  /** Builds common date range params. */
  private buildDateParams(): HttpParams {
    let params = new HttpParams();
    if (this.dateRange.from) params = params.set('from', this.dateRange.from);
    if (this.dateRange.to)   params = params.set('to', this.dateRange.to);
    return params;
  }

  /** Load login success/failure trends. */
  loadTrends(): void {
    this.trendsLoading = true;
    this.trendsError = null;

    const params = this.buildDateParams().set('days', this.selectedPeriod.toString());

    this.http
      .get<ApiResponse<LoginTrendData>>(`${this.apiBase}/trends`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          this.trendsChartData = {
            labels: data.dates,
            datasets: [
              {
                label: 'Successful Logins',
                data: data.success,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                pointBackgroundColor: '#22c55e',
                tension: 0.3,
                fill: false,
              },
              {
                label: 'Failed Logins',
                data: data.failure,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                pointBackgroundColor: '#ef4444',
                tension: 0.3,
                fill: false,
              },
            ],
          };
          this.trendsLoading = false;
        },
        error: (err) => {
          this.trendsError = err?.error?.error?.message || 'Failed to load login trends';
          this.trendsLoading = false;
        },
      });
  }

  /** Load geo distribution data. */
  loadGeo(): void {
    this.geoLoading = true;
    this.geoError = null;

    const params = this.buildDateParams();

    this.http
      .get<ApiResponse<GeoEntry[]>>(`${this.apiBase}/geo`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.geoData = (response.data || []).sort((a, b) => b.loginCount - a.loginCount);
          this.geoLoading = false;
        },
        error: (err) => {
          this.geoError = err?.error?.error?.message || 'Failed to load geo distribution';
          this.geoLoading = false;
        },
      });
  }

  /** Load top failed IPs. */
  loadFailedIps(): void {
    this.failedIpsLoading = true;
    this.failedIpsError = null;

    const params = this.buildDateParams().set('limit', '20');

    this.http
      .get<ApiResponse<FailedIpEntry[]>>(`${this.apiBase}/failed-ips`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.failedIps = response.data || [];
          this.failedIpsLoading = false;
        },
        error: (err) => {
          this.failedIpsError = err?.error?.error?.message || 'Failed to load failed IPs';
          this.failedIpsLoading = false;
        },
      });
  }

  /** Load authentication method distribution. */
  loadAuthMethods(): void {
    this.authMethodLoading = true;
    this.authMethodError = null;

    const params = this.buildDateParams();

    this.http
      .get<ApiResponse<AuthMethodEntry[]>>(`${this.apiBase}/auth-methods`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data || [];
          const colors = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#eab308'];
          this.authMethodChartData = {
            labels: data.map(d => d.method),
            datasets: [
              {
                data: data.map(d => d.count),
                backgroundColor: data.map((_, i) => colors[i % colors.length]),
                borderWidth: 2,
                borderColor: '#fff',
              },
            ],
          };
          this.authMethodLoading = false;
        },
        error: (err) => {
          this.authMethodError = err?.error?.error?.message || 'Failed to load auth method distribution';
          this.authMethodLoading = false;
        },
      });
  }

  /** Block an IP address. */
  blockIp(entry: FailedIpEntry): void {
    this.blockingIps.add(entry.ipAddress);

    this.http
      .post<ApiResponse<void>>(`${this.apiBase}/block-ip`, { ipAddress: entry.ipAddress })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          entry.blockedStatus = true;
          this.blockingIps.delete(entry.ipAddress);
        },
        error: () => {
          this.blockingIps.delete(entry.ipAddress);
        },
      });
  }

  /** TrackBy for geo data. */
  trackByCountry(_index: number, item: GeoEntry): string {
    return item.country + item.region;
  }

  /** TrackBy for failed IPs. */
  trackByIp(_index: number, item: FailedIpEntry): string {
    return item.ipAddress;
  }
}
