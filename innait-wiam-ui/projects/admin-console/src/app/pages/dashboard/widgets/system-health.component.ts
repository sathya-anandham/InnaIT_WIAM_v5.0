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
import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

interface ServiceHealth {
  name: string;
  status: 'UP' | 'DEGRADED' | 'DOWN';
  responseTime: number;
  lastCheck: string;
}

interface HealthData {
  services: ServiceHealth[];
}

@Component({
  selector: 'app-system-health',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <h3>{{ 'dashboard.systemHealth.title' | translate }}</h3>
      </div>
      <div class="widget-body">
        <!-- Skeleton Loader -->
        <div *ngIf="loading" class="skeleton-container">
          <div
            class="skeleton-row"
            *ngFor="let i of [1, 2, 3, 4]"
          ></div>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="error-state">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ error }}</span>
          <button class="retry-btn" (click)="loadData()">
            {{ 'common.retry' | translate }}
          </button>
        </div>

        <!-- Health Status -->
        <div *ngIf="!loading && !error" class="health-wrapper">
          <!-- Summary -->
          <div class="health-summary" [ngClass]="overallStatusClass">
            <i class="pi" [ngClass]="overallIcon"></i>
            <span>
              {{ healthyCount }} {{ 'dashboard.systemHealth.of' | translate }}
              {{ services.length }}
              {{ 'dashboard.systemHealth.healthy' | translate }}
            </span>
          </div>

          <!-- Service List -->
          <div class="service-list">
            <div
              *ngFor="let service of services"
              class="service-row"
            >
              <span
                class="status-dot"
                [ngClass]="{
                  'dot-up': service.status === 'UP',
                  'dot-degraded': service.status === 'DEGRADED',
                  'dot-down': service.status === 'DOWN'
                }"
              ></span>
              <span class="service-name">{{ service.name }}</span>
              <span class="response-time">{{ service.responseTime }}ms</span>
              <span class="last-check">{{ formatLastCheck(service.lastCheck) }}</span>
            </div>
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
        padding: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .health-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .health-summary {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 20px;
        font-size: 14px;
        font-weight: 600;
        border-bottom: 1px solid var(--surface-border, #dee2e6);
      }
      .health-summary i {
        font-size: 18px;
      }
      .summary-healthy {
        background: rgba(34, 197, 94, 0.06);
        color: #16a34a;
      }
      .summary-degraded {
        background: rgba(245, 158, 11, 0.06);
        color: #d97706;
      }
      .summary-down {
        background: rgba(239, 68, 68, 0.06);
        color: #dc2626;
      }
      .service-list {
        flex: 1;
        overflow-y: auto;
      }
      .service-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 20px;
        border-bottom: 1px solid var(--surface-border, #dee2e6);
        font-size: 13px;
        transition: background 0.15s ease;
      }
      .service-row:last-child {
        border-bottom: none;
      }
      .service-row:hover {
        background: var(--surface-ground, #f8f9fa);
      }
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dot-up {
        background: #22c55e;
        box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
      }
      .dot-degraded {
        background: #f59e0b;
        box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
      }
      .dot-down {
        background: #ef4444;
        box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
      }
      .service-name {
        flex: 1;
        font-weight: 500;
        color: var(--text-color, #333);
      }
      .response-time {
        color: var(--text-color-secondary, #6c757d);
        font-variant-numeric: tabular-nums;
        min-width: 50px;
        text-align: right;
      }
      .last-check {
        color: var(--text-color-secondary, #6c757d);
        font-size: 12px;
        min-width: 70px;
        text-align: right;
      }
      .skeleton-container {
        padding: 12px 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .skeleton-row {
        height: 36px;
        background: linear-gradient(
          90deg,
          var(--surface-200, #e9ecef) 25%,
          var(--surface-100, #f8f9fa) 50%,
          var(--surface-200, #e9ecef) 75%
        );
        background-size: 200% 100%;
        animation: pulse 1.5s ease-in-out infinite;
        border-radius: 6px;
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
        padding: 40px 20px;
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
export class SystemHealthComponent implements OnInit, OnDestroy, OnChanges {
  @Input() refreshTrigger?: number;

  loading = true;
  error: string | null = null;
  services: ServiceHealth[] = [];
  healthyCount = 0;
  overallStatusClass = 'summary-healthy';
  overallIcon = 'pi-check-circle';

  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/dashboard/health';

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
      .get<ApiResponse<HealthData>>(this.apiUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.services = response.data.services;
          this.healthyCount = this.services.filter(
            (s) => s.status === 'UP'
          ).length;

          const hasDown = this.services.some((s) => s.status === 'DOWN');
          const hasDegraded = this.services.some(
            (s) => s.status === 'DEGRADED'
          );

          if (hasDown) {
            this.overallStatusClass = 'summary-down';
            this.overallIcon = 'pi-times-circle';
          } else if (hasDegraded) {
            this.overallStatusClass = 'summary-degraded';
            this.overallIcon = 'pi-exclamation-circle';
          } else {
            this.overallStatusClass = 'summary-healthy';
            this.overallIcon = 'pi-check-circle';
          }

          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message ||
            'Failed to load system health data';
          this.loading = false;
        },
      });
  }

  formatLastCheck(lastCheck: string): string {
    const now = Date.now();
    const then = new Date(lastCheck).getTime();
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  }
}
