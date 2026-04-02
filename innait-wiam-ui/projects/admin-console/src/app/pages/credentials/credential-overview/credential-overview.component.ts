import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, interval } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { ApiResponse } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface PasswordAgeBucket {
  label: string;
  count: number;
}

interface PasswordAgeData {
  buckets: PasswordAgeBucket[];
}

interface MfaAdoptionMethod {
  name: string;
  percentage: number;
  count: number;
}

interface MfaAdoptionData {
  methods: MfaAdoptionMethod[];
}

interface EnrollmentData {
  password: number;
  totp: number;
  fido: number;
  softtoken: number;
  total: number;
}

interface TrendsData {
  dates: string[];
  password: number[];
  totp: number[];
  fido: number[];
  softtoken: number[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_BASE = '/api/v1/admin/credentials/stats';
const AUTO_REFRESH_INTERVAL_MS = 30000;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

@Component({
  selector: 'app-credential-overview',
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective,
    TranslatePipe,
  ],
  template: `
    <div class="credential-overview-page">
      <!-- ============================================================ -->
      <!-- Toolbar                                                       -->
      <!-- ============================================================ -->
      <header class="page-toolbar" role="toolbar" aria-label="Credential overview toolbar">
        <div class="toolbar-left">
          <h1 class="page-title">{{ 'credentials.overview.title' | translate }}</h1>
        </div>
        <div class="toolbar-right">
          <!-- Auto-refresh toggle -->
          <label class="auto-refresh-toggle" for="auto-refresh-checkbox">
            <input
              type="checkbox"
              id="auto-refresh-checkbox"
              [checked]="autoRefreshEnabled"
              (change)="toggleAutoRefresh()"
              aria-label="Toggle auto-refresh every 30 seconds" />
            <span class="toggle-slider"></span>
            <span class="toggle-label">{{ 'credentials.overview.autoRefresh' | translate }}</span>
          </label>

          <button
            class="btn btn-icon"
            (click)="refreshAll()"
            [disabled]="allLoading"
            aria-label="Refresh all panels">
            <i class="pi pi-refresh" [class.pi-spin]="allLoading" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- 2x2 Grid of Panels                                           -->
      <!-- ============================================================ -->
      <div class="panels-grid" role="region" aria-label="Credential statistics panels">

        <!-- Panel 1: Password Age Distribution -->
        <div class="panel" role="region" aria-label="Password age distribution chart">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'credentials.overview.passwordAge' | translate }}</h2>
          </div>
          <div class="panel-body">
            <!-- Skeleton -->
            <div *ngIf="passwordAgeLoading" class="skeleton-chart" aria-label="Loading password age data">
              <div class="skeleton-bar" *ngFor="let b of [1,2,3,4,5]" [style.height.%]="b * 15 + 10"></div>
            </div>
            <!-- Error -->
            <div *ngIf="passwordAgeError && !passwordAgeLoading" class="panel-error" role="alert">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              <span>{{ passwordAgeError }}</span>
              <button class="btn btn-sm btn-text" (click)="loadPasswordAge()">{{ 'common.retry' | translate }}</button>
            </div>
            <!-- Chart -->
            <div *ngIf="!passwordAgeLoading && !passwordAgeError" class="chart-container">
              <canvas
                baseChart
                [data]="passwordAgeChartData"
                [options]="passwordAgeChartOptions"
                [type]="'bar'"
                aria-label="Bar chart showing password age distribution">
              </canvas>
            </div>
          </div>
        </div>

        <!-- Panel 2: MFA Adoption Rates -->
        <div class="panel" role="region" aria-label="MFA adoption rates chart">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'credentials.overview.mfaAdoption' | translate }}</h2>
          </div>
          <div class="panel-body">
            <!-- Skeleton -->
            <div *ngIf="mfaAdoptionLoading" class="skeleton-chart skeleton-horizontal" aria-label="Loading MFA adoption data">
              <div class="skeleton-hbar" *ngFor="let b of [1,2,3,4]"></div>
            </div>
            <!-- Error -->
            <div *ngIf="mfaAdoptionError && !mfaAdoptionLoading" class="panel-error" role="alert">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              <span>{{ mfaAdoptionError }}</span>
              <button class="btn btn-sm btn-text" (click)="loadMfaAdoption()">{{ 'common.retry' | translate }}</button>
            </div>
            <!-- Chart -->
            <div *ngIf="!mfaAdoptionLoading && !mfaAdoptionError" class="chart-container">
              <canvas
                baseChart
                [data]="mfaAdoptionChartData"
                [options]="mfaAdoptionChartOptions"
                [type]="'bar'"
                aria-label="Horizontal bar chart showing MFA adoption rates">
              </canvas>
            </div>
          </div>
        </div>

        <!-- Panel 3: Enrollment Counts -->
        <div class="panel" role="region" aria-label="Enrollment counts summary">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'credentials.overview.enrollmentCounts' | translate }}</h2>
          </div>
          <div class="panel-body">
            <!-- Skeleton -->
            <div *ngIf="enrollmentLoading" class="skeleton-cards" aria-label="Loading enrollment data">
              <div class="skeleton-card-item" *ngFor="let c of [1,2,3,4]"></div>
            </div>
            <!-- Error -->
            <div *ngIf="enrollmentError && !enrollmentLoading" class="panel-error" role="alert">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              <span>{{ enrollmentError }}</span>
              <button class="btn btn-sm btn-text" (click)="loadEnrollment()">{{ 'common.retry' | translate }}</button>
            </div>
            <!-- Cards -->
            <div *ngIf="!enrollmentLoading && !enrollmentError" class="enrollment-cards">
              <div class="enrollment-card" *ngFor="let card of enrollmentCards">
                <div class="enrollment-icon-wrapper" [style.background]="card.bgColor">
                  <i class="pi" [ngClass]="card.icon" [style.color]="card.color" aria-hidden="true"></i>
                </div>
                <div class="enrollment-info">
                  <span class="enrollment-count">{{ card.count }}</span>
                  <span class="enrollment-type">{{ card.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel 4: Enrollment Trends (Last 30 Days) -->
        <div class="panel" role="region" aria-label="Enrollment trends over last 30 days">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'credentials.overview.enrollmentTrends' | translate }}</h2>
          </div>
          <div class="panel-body">
            <!-- Skeleton -->
            <div *ngIf="trendsLoading" class="skeleton-chart" aria-label="Loading trend data">
              <div class="skeleton-line"></div>
            </div>
            <!-- Error -->
            <div *ngIf="trendsError && !trendsLoading" class="panel-error" role="alert">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              <span>{{ trendsError }}</span>
              <button class="btn btn-sm btn-text" (click)="loadTrends()">{{ 'common.retry' | translate }}</button>
            </div>
            <!-- Chart -->
            <div *ngIf="!trendsLoading && !trendsError" class="chart-container">
              <canvas
                baseChart
                [data]="trendsChartData"
                [options]="trendsChartOptions"
                [type]="'line'"
                aria-label="Line chart showing enrollment trends over the last 30 days">
              </canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ============================================================ */
    /* Page Layout                                                    */
    /* ============================================================ */
    .credential-overview-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 20px;
      padding: 24px;
      background: var(--surface-ground, #f8f9fa);
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
      gap: 16px;
    }

    /* Auto-refresh Toggle */
    .auto-refresh-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }
    .auto-refresh-toggle input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: relative;
      width: 40px;
      height: 22px;
      background: var(--surface-300, #ced4da);
      border-radius: 11px;
      transition: background 0.2s;
    }
    .toggle-slider::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .auto-refresh-toggle input:checked + .toggle-slider {
      background: var(--primary-color, #3b82f6);
    }
    .auto-refresh-toggle input:checked + .toggle-slider::after {
      transform: translateX(18px);
    }
    .toggle-label {
      font-size: 13px;
      color: var(--text-color-secondary, #6c757d);
      font-weight: 500;
    }

    /* Buttons */
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
    /* 2x2 Grid                                                       */
    /* ============================================================ */
    .panels-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 20px;
      flex: 1;
      min-height: 0;
    }

    /* Panel */
    .panel {
      background: var(--surface-card, #ffffff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-header {
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
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }
    .chart-container {
      width: 100%;
      height: 100%;
      position: relative;
    }

    /* ============================================================ */
    /* Skeleton Loaders                                                */
    /* ============================================================ */
    .skeleton-chart {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      width: 100%;
      height: 100%;
      padding: 20px 0;
    }
    .skeleton-bar {
      flex: 1;
      background: linear-gradient(
        90deg,
        var(--surface-200, #e9ecef) 25%,
        var(--surface-100, #f8f9fa) 50%,
        var(--surface-200, #e9ecef) 75%
      );
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 4px 4px 0 0;
    }
    .skeleton-horizontal {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    .skeleton-hbar {
      height: 28px;
      width: 70%;
      background: linear-gradient(
        90deg,
        var(--surface-200, #e9ecef) 25%,
        var(--surface-100, #f8f9fa) 50%,
        var(--surface-200, #e9ecef) 75%
      );
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 4px;
    }
    .skeleton-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      width: 100%;
    }
    .skeleton-card-item {
      height: 80px;
      background: linear-gradient(
        90deg,
        var(--surface-200, #e9ecef) 25%,
        var(--surface-100, #f8f9fa) 50%,
        var(--surface-200, #e9ecef) 75%
      );
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 10px;
    }
    .skeleton-line {
      width: 100%;
      height: 60%;
      background: linear-gradient(
        90deg,
        var(--surface-200, #e9ecef) 25%,
        var(--surface-100, #f8f9fa) 50%,
        var(--surface-200, #e9ecef) 75%
      );
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 8px;
    }
    @keyframes pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ============================================================ */
    /* Error State                                                    */
    /* ============================================================ */
    .panel-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--red-500, #ef4444);
      text-align: center;
      font-size: 13px;
    }
    .panel-error i { font-size: 24px; }

    /* ============================================================ */
    /* Enrollment Cards                                                */
    /* ============================================================ */
    .enrollment-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      width: 100%;
    }
    .enrollment-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      background: var(--surface-ground, #f8f9fa);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      transition: box-shadow 0.2s;
    }
    .enrollment-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .enrollment-icon-wrapper {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .enrollment-icon-wrapper i {
      font-size: 20px;
    }
    .enrollment-info {
      display: flex;
      flex-direction: column;
    }
    .enrollment-count {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-color, #333);
      line-height: 1.2;
    }
    .enrollment-type {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-color-secondary, #6c757d);
    }
  `],
})
export class CredentialOverviewComponent implements OnInit, OnDestroy {
  /* ---------------------------------------------------------------- */
  /*  State                                                            */
  /* ---------------------------------------------------------------- */
  autoRefreshEnabled = false;

  /* Password Age */
  passwordAgeLoading = true;
  passwordAgeError: string | null = null;
  passwordAgeChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  passwordAgeChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} accounts`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        title: { display: true, text: 'Accounts' },
      },
      x: {
        title: { display: true, text: 'Password Age' },
      },
    },
  };

  /* MFA Adoption */
  mfaAdoptionLoading = true;
  mfaAdoptionError: string | null = null;
  mfaAdoptionChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  mfaAdoptionChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.x}%`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (value) => `${value}%`,
        },
        title: { display: true, text: 'Adoption %' },
      },
    },
  };

  /* Enrollment Counts */
  enrollmentLoading = true;
  enrollmentError: string | null = null;
  enrollmentCards: { label: string; count: number; icon: string; color: string; bgColor: string }[] = [];

  /* Enrollment Trends */
  trendsLoading = true;
  trendsError: string | null = null;
  trendsChartData: ChartData<'line'> = { labels: [], datasets: [] };
  trendsChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          font: { size: 12 },
        },
      },
      tooltip: { mode: 'index', intersect: false },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        title: { display: true, text: 'New Enrollments' },
      },
      x: {
        ticks: {
          maxTicksLimit: 10,
          font: { size: 11 },
        },
      },
    },
  };

  /* RxJS */
  private readonly destroy$ = new Subject<void>();
  private autoRefreshSub: any = null;

  constructor(private readonly http: HttpClient) {}

  /* ---------------------------------------------------------------- */
  /*  Computed                                                         */
  /* ---------------------------------------------------------------- */

  get allLoading(): boolean {
    return this.passwordAgeLoading || this.mfaAdoptionLoading || this.enrollmentLoading || this.trendsLoading;
  }

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  ngOnInit(): void {
    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
  }

  /* ---------------------------------------------------------------- */
  /*  Refresh                                                          */
  /* ---------------------------------------------------------------- */

  refreshAll(): void {
    this.loadPasswordAge();
    this.loadMfaAdoption();
    this.loadEnrollment();
    this.loadTrends();
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshSub = interval(AUTO_REFRESH_INTERVAL_MS)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refreshAll());
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshSub) {
      this.autoRefreshSub.unsubscribe();
      this.autoRefreshSub = null;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Panel 1: Password Age Distribution                               */
  /* ---------------------------------------------------------------- */

  loadPasswordAge(): void {
    this.passwordAgeLoading = true;
    this.passwordAgeError = null;

    this.http
      .get<ApiResponse<PasswordAgeData>>(`${API_BASE}/password-age`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const buckets = res.data.buckets;
          const colors = ['#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];
          this.passwordAgeChartData = {
            labels: buckets.map((b) => b.label),
            datasets: [
              {
                data: buckets.map((b) => b.count),
                backgroundColor: buckets.map((_, i) => colors[i % colors.length]),
                borderRadius: 4,
                maxBarThickness: 60,
              },
            ],
          };
          this.passwordAgeLoading = false;
        },
        error: (err) => {
          this.passwordAgeError = err?.error?.error?.message || 'Failed to load password age data';
          this.passwordAgeLoading = false;
        },
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Panel 2: MFA Adoption Rates                                      */
  /* ---------------------------------------------------------------- */

  loadMfaAdoption(): void {
    this.mfaAdoptionLoading = true;
    this.mfaAdoptionError = null;

    this.http
      .get<ApiResponse<MfaAdoptionData>>(`${API_BASE}/mfa-adoption`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const methods = res.data.methods;
          const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];
          this.mfaAdoptionChartData = {
            labels: methods.map((m) => m.name),
            datasets: [
              {
                data: methods.map((m) => m.percentage),
                backgroundColor: methods.map((_, i) => colors[i % colors.length]),
                borderRadius: 4,
                maxBarThickness: 36,
              },
            ],
          };
          this.mfaAdoptionLoading = false;
        },
        error: (err) => {
          this.mfaAdoptionError = err?.error?.error?.message || 'Failed to load MFA adoption data';
          this.mfaAdoptionLoading = false;
        },
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Panel 3: Enrollment Counts                                       */
  /* ---------------------------------------------------------------- */

  loadEnrollment(): void {
    this.enrollmentLoading = true;
    this.enrollmentError = null;

    this.http
      .get<ApiResponse<EnrollmentData>>(`${API_BASE}/enrollment`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const d = res.data;
          this.enrollmentCards = [
            {
              label: 'Password',
              count: d.password,
              icon: 'pi-lock',
              color: '#3b82f6',
              bgColor: 'rgba(59, 130, 246, 0.1)',
            },
            {
              label: 'TOTP',
              count: d.totp,
              icon: 'pi-clock',
              color: '#8b5cf6',
              bgColor: 'rgba(139, 92, 246, 0.1)',
            },
            {
              label: 'FIDO',
              count: d.fido,
              icon: 'pi-key',
              color: '#f59e0b',
              bgColor: 'rgba(245, 158, 11, 0.1)',
            },
            {
              label: 'Soft Token',
              count: d.softtoken,
              icon: 'pi-mobile',
              color: '#06b6d4',
              bgColor: 'rgba(6, 182, 212, 0.1)',
            },
          ];
          this.enrollmentLoading = false;
        },
        error: (err) => {
          this.enrollmentError = err?.error?.error?.message || 'Failed to load enrollment data';
          this.enrollmentLoading = false;
        },
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Panel 4: Enrollment Trends                                       */
  /* ---------------------------------------------------------------- */

  loadTrends(): void {
    this.trendsLoading = true;
    this.trendsError = null;

    this.http
      .get<ApiResponse<TrendsData>>(`${API_BASE}/trends`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const d = res.data;
          const shortDates = d.dates.map((dt) => {
            try {
              const date = new Date(dt);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } catch {
              return dt;
            }
          });

          this.trendsChartData = {
            labels: shortDates,
            datasets: [
              {
                label: 'Password',
                data: d.password,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.3,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 5,
              },
              {
                label: 'TOTP',
                data: d.totp,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.3,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 5,
              },
              {
                label: 'FIDO',
                data: d.fido,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.3,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 5,
              },
              {
                label: 'Soft Token',
                data: d.softtoken,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.3,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 5,
              },
            ],
          };
          this.trendsLoading = false;
        },
        error: (err) => {
          this.trendsError = err?.error?.error?.message || 'Failed to load trend data';
          this.trendsLoading = false;
        },
      });
  }
}
