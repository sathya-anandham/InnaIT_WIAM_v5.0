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

interface MfaAdoptionData {
  totp: number;
  fido: number;
  softtoken: number;
  none: number;
}

@Component({
  selector: 'app-mfa-adoption-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, TranslatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <h3>{{ 'dashboard.mfaAdoption.title' | translate }}</h3>
      </div>
      <div class="widget-body">
        <!-- Skeleton Loader -->
        <div *ngIf="loading" class="skeleton-container">
          <div class="skeleton-donut"></div>
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
          <div class="donut-container">
            <canvas
              baseChart
              [data]="chartData"
              [options]="chartOptions"
              [type]="'doughnut'"
            ></canvas>
            <div class="center-text">
              <span class="total-value">{{ totalCount }}</span>
              <span class="total-label">{{
                'dashboard.mfaAdoption.total' | translate
              }}</span>
            </div>
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
              <span class="legend-pct">{{ item.percentage }}%</span>
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
      .donut-container {
        position: relative;
        width: 200px;
        height: 200px;
      }
      .center-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        display: flex;
        flex-direction: column;
      }
      .total-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--text-color, #333);
        line-height: 1;
      }
      .total-label {
        font-size: 11px;
        color: var(--text-color-secondary, #6c757d);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        justify-content: center;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .legend-label {
        color: var(--text-color, #333);
      }
      .legend-pct {
        color: var(--text-color-secondary, #6c757d);
        font-weight: 600;
      }
      .skeleton-container {
        display: flex;
        justify-content: center;
      }
      .skeleton-donut {
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
export class MfaAdoptionChartComponent implements OnInit, OnDestroy, OnChanges {
  @Input() refreshTrigger?: number;

  loading = true;
  error: string | null = null;
  totalCount = 0;
  legendItems: { label: string; color: string; percentage: string }[] = [];

  chartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '65%',
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/dashboard/mfa-adoption';

  private readonly colors: Record<string, string> = {
    totp: '#3b82f6',
    fido: '#8b5cf6',
    softtoken: '#f59e0b',
    none: '#94a3b8',
  };

  private readonly labels: Record<string, string> = {
    totp: 'TOTP',
    fido: 'FIDO2/WebAuthn',
    softtoken: 'Soft Token',
    none: 'None',
  };

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
      .get<ApiResponse<MfaAdoptionData>>(this.apiUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          const keys: (keyof MfaAdoptionData)[] = [
            'totp',
            'fido',
            'softtoken',
            'none',
          ];
          const values = keys.map((k) => data[k]);
          this.totalCount = values.reduce((a, b) => a + b, 0);

          this.legendItems = keys.map((k) => ({
            label: this.labels[k],
            color: this.colors[k],
            percentage:
              this.totalCount > 0
                ? ((data[k] / this.totalCount) * 100).toFixed(1)
                : '0.0',
          }));

          this.chartData = {
            labels: keys.map((k) => this.labels[k]),
            datasets: [
              {
                data: values,
                backgroundColor: keys.map((k) => this.colors[k]),
                borderWidth: 2,
                borderColor: '#ffffff',
              },
            ],
          };
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message || 'Failed to load MFA adoption data';
          this.loading = false;
        },
      });
  }
}
