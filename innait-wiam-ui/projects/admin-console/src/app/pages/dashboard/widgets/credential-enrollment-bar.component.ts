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

interface CredentialEnrollmentData {
  types: string[];
  counts: number[];
}

@Component({
  selector: 'app-credential-enrollment-bar',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, TranslatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <h3>{{ 'dashboard.credentialEnrollment.title' | translate }}</h3>
      </div>
      <div class="widget-body">
        <!-- Skeleton Loader -->
        <div *ngIf="loading" class="skeleton-container">
          <div class="skeleton-bar" *ngFor="let i of [1, 2, 3, 4]"></div>
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
        <div *ngIf="!loading && !error" class="chart-container">
          <canvas
            baseChart
            [data]="chartData"
            [options]="chartOptions"
            [type]="'bar'"
          ></canvas>
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
      .chart-container {
        width: 100%;
        height: 100%;
        position: relative;
      }
      .skeleton-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .skeleton-bar {
        height: 28px;
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
      .skeleton-bar:nth-child(1) {
        width: 85%;
      }
      .skeleton-bar:nth-child(2) {
        width: 65%;
      }
      .skeleton-bar:nth-child(3) {
        width: 45%;
      }
      .skeleton-bar:nth-child(4) {
        width: 30%;
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
export class CredentialEnrollmentBarComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() refreshTrigger?: number;

  loading = true;
  error: string | null = null;

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          display: true,
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  };

  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/dashboard/credential-enrollment';

  private readonly colorMap: Record<string, string> = {
    password: '#3b82f6',
    totp: '#22c55e',
    fido: '#8b5cf6',
    softtoken: '#f59e0b',
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
      .get<ApiResponse<CredentialEnrollmentData>>(this.apiUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          const backgroundColors = data.types.map(
            (type) =>
              this.colorMap[type.toLowerCase()] || '#6b7280'
          );

          this.chartData = {
            labels: data.types,
            datasets: [
              {
                data: data.counts,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                barThickness: 24,
              },
            ],
          };
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message ||
            'Failed to load credential enrollment data';
          this.loading = false;
        },
      });
  }
}
