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

interface HeatmapEntry {
  day: number;
  hour: number;
  count: number;
}

interface HeatmapData {
  data: HeatmapEntry[];
}

interface HeatmapCell {
  day: number;
  hour: number;
  count: number;
  color: string;
  dayLabel: string;
}

@Component({
  selector: 'app-failed-login-heatmap',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <h3>{{ 'dashboard.failedLoginHeatmap.title' | translate }}</h3>
      </div>
      <div class="widget-body">
        <!-- Skeleton Loader -->
        <div *ngIf="loading" class="skeleton-container">
          <div class="skeleton-heatmap"></div>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="error-state">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ error }}</span>
          <button class="retry-btn" (click)="loadData()">
            {{ 'common.retry' | translate }}
          </button>
        </div>

        <!-- Heatmap Grid -->
        <div *ngIf="!loading && !error" class="heatmap-wrapper">
          <!-- Hour labels -->
          <div class="hour-labels">
            <div class="day-label-spacer"></div>
            <div
              *ngFor="let h of hours"
              class="hour-label"
            >
              {{ h }}
            </div>
          </div>

          <!-- Grid rows -->
          <div *ngFor="let day of days; let d = index" class="heatmap-row">
            <div class="day-label">{{ day }}</div>
            <div
              *ngFor="let h of hours"
              class="heatmap-cell"
              [style.background]="getCellColor(d, h)"
              [title]="getCellTooltip(d, h)"
            ></div>
          </div>

          <!-- Legend -->
          <div class="legend">
            <span class="legend-label">{{
              'dashboard.failedLoginHeatmap.less' | translate
            }}</span>
            <div class="legend-gradient">
              <div
                *ngFor="let shade of legendShades"
                class="legend-swatch"
                [style.background]="shade"
              ></div>
            </div>
            <span class="legend-label">{{
              'dashboard.failedLoginHeatmap.more' | translate
            }}</span>
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
        padding: 16px 20px;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-x: auto;
      }
      .heatmap-wrapper {
        width: 100%;
        min-width: 500px;
      }
      .hour-labels {
        display: flex;
        align-items: center;
        margin-bottom: 2px;
      }
      .day-label-spacer {
        width: 40px;
        flex-shrink: 0;
      }
      .hour-label {
        flex: 1;
        text-align: center;
        font-size: 10px;
        color: var(--text-color-secondary, #6c757d);
      }
      .heatmap-row {
        display: flex;
        align-items: center;
        margin-bottom: 2px;
      }
      .day-label {
        width: 40px;
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-color-secondary, #6c757d);
        text-align: right;
        padding-right: 6px;
      }
      .heatmap-cell {
        flex: 1;
        aspect-ratio: 1;
        max-height: 22px;
        border-radius: 3px;
        margin: 1px;
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .heatmap-cell:hover {
        transform: scale(1.3);
        z-index: 1;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
      }
      .legend {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 10px;
      }
      .legend-label {
        font-size: 11px;
        color: var(--text-color-secondary, #6c757d);
      }
      .legend-gradient {
        display: flex;
        gap: 2px;
      }
      .legend-swatch {
        width: 14px;
        height: 14px;
        border-radius: 2px;
      }
      .skeleton-container {
        width: 100%;
      }
      .skeleton-heatmap {
        width: 100%;
        height: 180px;
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
export class FailedLoginHeatmapComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() refreshTrigger?: number;

  loading = true;
  error: string | null = null;

  days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  hours = Array.from({ length: 24 }, (_, i) => i);
  legendShades = ['#ffffff', '#fecaca', '#f87171', '#dc2626', '#7f1d1d'];

  private cellMap: Map<string, number> = new Map();
  private maxCount = 0;

  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/dashboard/failed-login-heatmap';

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
      .get<ApiResponse<HeatmapData>>(this.apiUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.cellMap.clear();
          this.maxCount = 0;

          for (const entry of response.data.data) {
            const key = `${entry.day}-${entry.hour}`;
            this.cellMap.set(key, entry.count);
            if (entry.count > this.maxCount) {
              this.maxCount = entry.count;
            }
          }
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message ||
            'Failed to load failed login heatmap data';
          this.loading = false;
        },
      });
  }

  getCellColor(day: number, hour: number): string {
    const count = this.cellMap.get(`${day}-${hour}`) ?? 0;
    if (count === 0 || this.maxCount === 0) {
      return '#f3f4f6';
    }
    const intensity = count / this.maxCount;
    if (intensity <= 0.25) return '#fecaca';
    if (intensity <= 0.5) return '#f87171';
    if (intensity <= 0.75) return '#dc2626';
    return '#7f1d1d';
  }

  getCellTooltip(day: number, hour: number): string {
    const count = this.cellMap.get(`${day}-${hour}`) ?? 0;
    return `${this.days[day]}, ${hour}:00: ${count} failures`;
  }
}
