import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, interval, takeUntil, switchMap, startWith } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

interface ActiveSessionsData {
  count: number;
  peak: number;
  limit: number;
}

@Component({
  selector: 'app-active-sessions-gauge',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, TranslatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <h3>{{ 'dashboard.activeSessions.title' | translate }}</h3>
      </div>
      <div class="widget-body">
        <!-- Skeleton Loader -->
        <div *ngIf="loading" class="skeleton-container">
          <div class="skeleton-gauge"></div>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="error-state">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ error }}</span>
          <button class="retry-btn" (click)="loadData()">
            {{ 'common.retry' | translate }}
          </button>
        </div>

        <!-- Gauge -->
        <div *ngIf="!loading && !error" class="gauge-container">
          <div class="gauge-chart-wrapper">
            <canvas
              baseChart
              [data]="chartData"
              [options]="chartOptions"
              [type]="'doughnut'"
            ></canvas>
            <div class="gauge-center-text">
              <span class="gauge-value">{{ sessionData?.count ?? 0 }}</span>
              <span class="gauge-label">{{
                'dashboard.activeSessions.active' | translate
              }}</span>
            </div>
          </div>
          <div class="gauge-footer">
            <span
              >{{ 'dashboard.activeSessions.peak' | translate }}:
              {{ sessionData?.peak ?? 0 }}</span
            >
            <span class="separator">|</span>
            <span
              >{{ 'dashboard.activeSessions.limit' | translate }}:
              {{ sessionData?.limit ?? 0 }}</span
            >
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .widget-card {
        background: var(--innait-surface, #ffffff);
        border: 1px solid var(--innait-border, #DFE0EB);
        border-radius: var(--innait-card-radius, 12px);
        box-shadow: var(--innait-card-shadow, 0 2px 10px rgba(0, 0, 0, 0.06));
        overflow: hidden;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .widget-header {
        padding: 18px 20px;
        border-bottom: 1px solid var(--innait-border, #DFE0EB);
      }
      .widget-header h3 {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--innait-text-secondary, #9FA2B4);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .widget-body {
        padding: 20px;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .gauge-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
      }
      .gauge-chart-wrapper {
        position: relative;
        width: 220px;
        height: 160px;
        overflow: hidden;
      }
      .gauge-center-text {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        display: flex;
        flex-direction: column;
      }
      .gauge-value {
        font-size: 32px;
        font-weight: 700;
        color: var(--text-color, #333);
        line-height: 1;
      }
      .gauge-label {
        font-size: 12px;
        color: var(--text-color-secondary, #6c757d);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .gauge-footer {
        margin-top: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-color-secondary, #6c757d);
      }
      .separator {
        color: var(--surface-border, #dee2e6);
      }
      .skeleton-container {
        width: 100%;
        display: flex;
        justify-content: center;
      }
      .skeleton-gauge {
        width: 220px;
        height: 160px;
        background: linear-gradient(
          90deg,
          var(--surface-200, #e9ecef) 25%,
          var(--surface-100, #f8f9fa) 50%,
          var(--surface-200, #e9ecef) 75%
        );
        background-size: 200% 100%;
        animation: pulse 1.5s ease-in-out infinite;
        border-radius: 110px 110px 0 0;
      }
      @keyframes pulse {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--red-500, #ef4444);
        text-align: center;
      }
      .error-state i {
        font-size: 24px;
      }
      .retry-btn {
        margin-top: 4px;
        padding: 6px 16px;
        border: 1px solid var(--primary-color, #3b82f6);
        background: transparent;
        color: var(--primary-color, #3b82f6);
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
      }
      .retry-btn:hover {
        background: var(--primary-color, #3b82f6);
        color: #fff;
      }
    `,
  ],
})
export class ActiveSessionsGaugeComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() refreshTrigger?: number;

  loading = true;
  error: string | null = null;
  sessionData: ActiveSessionsData | null = null;

  chartData: ChartData<'doughnut'> = {
    datasets: [],
  };

  chartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    rotation: -135,
    circumference: 270,
    cutout: '75%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };

  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/dashboard/active-sessions';
  private readonly AUTO_REFRESH_MS = 30_000;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    interval(this.AUTO_REFRESH_MS)
      .pipe(
        startWith(0),
        takeUntil(this.destroy$),
        switchMap(() => this.http.get<ApiResponse<ActiveSessionsData>>(this.apiUrl))
      )
      .subscribe({
        next: (response) => {
          this.sessionData = response.data;
          this.updateChart(response.data);
          this.loading = false;
          this.error = null;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message || 'Failed to load active sessions';
          this.loading = false;
        },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshTrigger'] && !changes['refreshTrigger'].firstChange) {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    this.http
      .get<ApiResponse<ActiveSessionsData>>(this.apiUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.sessionData = response.data;
          this.updateChart(response.data);
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message || 'Failed to load active sessions';
          this.loading = false;
        },
      });
  }

  private updateChart(data: ActiveSessionsData): void {
    const percentage = data.count / data.limit;
    let color: string;
    if (percentage > 0.9) {
      color = '#ef4444'; // red
    } else if (percentage >= 0.7) {
      color = '#f59e0b'; // yellow
    } else {
      color = '#22c55e'; // green
    }

    const remaining = Math.max(0, data.limit - data.count);

    this.chartData = {
      datasets: [
        {
          data: [data.count, remaining],
          backgroundColor: [color, '#e5e7eb'],
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    };
  }
}
