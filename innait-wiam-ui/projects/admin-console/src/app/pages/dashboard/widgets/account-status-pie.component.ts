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
import { Subject, takeUntil } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

interface AccountStatusData {
  active: number;
  suspended: number;
  locked: number;
  disabled: number;
  pendingActivation: number;
}

@Component({
  selector: 'app-account-status-pie',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, TranslatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <h3>{{ 'dashboard.accountStatus.title' | translate }}</h3>
      </div>
      <div class="widget-body">
        <!-- Skeleton Loader -->
        <div *ngIf="loading" class="skeleton-container">
          <div class="skeleton-pie"></div>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="error-state">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ error }}</span>
          <button class="retry-btn" (click)="loadData()">
            {{ 'common.retry' | translate }}
          </button>
        </div>

        <!-- Chart -->
        <div *ngIf="!loading && !error" class="chart-wrapper">
          <div class="pie-container">
            <canvas
              baseChart
              [data]="chartData"
              [options]="chartOptions"
              [type]="'pie'"
            ></canvas>
          </div>
          <div class="legend">
            <div
              *ngFor="let item of legendItems"
              class="legend-item"
            >
              <span
                class="legend-dot"
                [style.background]="item.color"
              ></span>
              <span class="legend-label">{{ item.label }}</span>
              <span class="legend-count">{{ item.count | number }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .widget-card {
        background: var(--surface-card, #ffffff);
        border: 1px solid var(--surface-border, #dee2e6);
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .widget-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--surface-border, #dee2e6);
        background: var(--surface-ground, #f8f9fa);
      }
      .widget-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-color, #333);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .widget-body {
        padding: 20px;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .chart-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        gap: 16px;
      }
      .pie-container {
        width: 200px;
        height: 200px;
      }
      .legend {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        padding: 4px 0;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .legend-label {
        color: var(--text-color, #333);
        flex: 1;
      }
      .legend-count {
        font-weight: 600;
        color: var(--text-color, #333);
        font-variant-numeric: tabular-nums;
      }
      .skeleton-container {
        display: flex;
        justify-content: center;
      }
      .skeleton-pie {
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: linear-gradient(
          90deg,
          var(--surface-200, #e9ecef) 25%,
          var(--surface-100, #f8f9fa) 50%,
          var(--surface-200, #e9ecef) 75%
        );
        background-size: 200% 100%;
        animation: pulse 1.5s ease-in-out infinite;
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
export class AccountStatusPieComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() refreshTrigger?: number;

  loading = true;
  error: string | null = null;
  legendItems: { label: string; color: string; count: number }[] = [];

  chartData: ChartData<'pie'> = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/dashboard/account-status';

  private readonly statusConfig: {
    key: keyof AccountStatusData;
    label: string;
    color: string;
  }[] = [
    { key: 'active', label: 'Active', color: '#22c55e' },
    { key: 'suspended', label: 'Suspended', color: '#f59e0b' },
    { key: 'locked', label: 'Locked', color: '#ef4444' },
    { key: 'disabled', label: 'Disabled', color: '#94a3b8' },
    { key: 'pendingActivation', label: 'Pending Activation', color: '#3b82f6' },
  ];

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
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
      .get<ApiResponse<AccountStatusData>>(this.apiUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          const values = this.statusConfig.map((cfg) => data[cfg.key]);
          const labels = this.statusConfig.map((cfg) => cfg.label);
          const colors = this.statusConfig.map((cfg) => cfg.color);

          this.legendItems = this.statusConfig.map((cfg) => ({
            label: cfg.label,
            color: cfg.color,
            count: data[cfg.key],
          }));

          this.chartData = {
            labels,
            datasets: [
              {
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#ffffff',
              },
            ],
          };
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message ||
            'Failed to load account status data';
          this.loading = false;
        },
      });
  }
}
