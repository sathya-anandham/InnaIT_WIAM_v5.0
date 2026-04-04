import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, interval, takeUntil } from 'rxjs';
import { TranslatePipe } from '@innait/i18n';

import { AuthTrendsChartComponent } from './widgets/auth-trends-chart.component';
import { ActiveSessionsGaugeComponent } from './widgets/active-sessions-gauge.component';
import { MfaAdoptionChartComponent } from './widgets/mfa-adoption-chart.component';
import { CredentialEnrollmentBarComponent } from './widgets/credential-enrollment-bar.component';
import { FailedLoginHeatmapComponent } from './widgets/failed-login-heatmap.component';
import { AccountStatusPieComponent } from './widgets/account-status-pie.component';
import { RecentAdminActionsComponent } from './widgets/recent-admin-actions.component';
import { LockoutAlertCardComponent } from './widgets/lockout-alert-card.component';
import { SystemHealthComponent } from './widgets/system-health.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    AuthTrendsChartComponent,
    ActiveSessionsGaugeComponent,
    MfaAdoptionChartComponent,
    CredentialEnrollmentBarComponent,
    FailedLoginHeatmapComponent,
    AccountStatusPieComponent,
    RecentAdminActionsComponent,
    LockoutAlertCardComponent,
    SystemHealthComponent,
  ],
  template: `
    <div class="dashboard-container">
      <!-- Dashboard Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h1>{{ 'dashboard.title' | translate }}</h1>
          <span class="last-refresh" *ngIf="lastRefresh">
            {{ 'dashboard.lastRefresh' | translate }}:
            {{ lastRefresh | date: 'medium' }}
          </span>
        </div>
        <div class="header-actions">
          <button
            class="action-btn refresh-btn"
            (click)="manualRefresh()"
            [title]="'dashboard.refresh' | translate"
          >
            <i class="pi pi-refresh"></i>
            {{ 'dashboard.refresh' | translate }}
          </button>
          <button
            class="action-btn auto-refresh-btn"
            [ngClass]="{ active: autoRefreshEnabled }"
            (click)="toggleAutoRefresh()"
            [title]="'dashboard.autoRefresh' | translate"
          >
            <i
              class="pi"
              [ngClass]="{
                'pi-play': !autoRefreshEnabled,
                'pi-pause': autoRefreshEnabled
              }"
            ></i>
            {{ 'dashboard.autoRefresh' | translate }}
          </button>
        </div>
      </div>

      <!-- Dashboard Grid -->
      <div class="dashboard-grid">
        <!-- Row 1: Auth Trends (2 cols) + Active Sessions Gauge (1 col) -->
        <div class="grid-item span-2">
          <app-auth-trends-chart
            [refreshTrigger]="refreshTrigger"
          ></app-auth-trends-chart>
        </div>
        <div class="grid-item">
          <app-active-sessions-gauge
            [refreshTrigger]="refreshTrigger"
          ></app-active-sessions-gauge>
        </div>

        <!-- Row 2: MFA Adoption + Credential Enrollment + Account Status -->
        <div class="grid-item">
          <app-mfa-adoption-chart
            [refreshTrigger]="refreshTrigger"
          ></app-mfa-adoption-chart>
        </div>
        <div class="grid-item">
          <app-credential-enrollment-bar
            [refreshTrigger]="refreshTrigger"
          ></app-credential-enrollment-bar>
        </div>
        <div class="grid-item">
          <app-account-status-pie
            [refreshTrigger]="refreshTrigger"
          ></app-account-status-pie>
        </div>

        <!-- Row 3: Failed Login Heatmap (2 cols) + System Health (1 col) -->
        <div class="grid-item span-2">
          <app-failed-login-heatmap
            [refreshTrigger]="refreshTrigger"
          ></app-failed-login-heatmap>
        </div>
        <div class="grid-item">
          <app-system-health
            [refreshTrigger]="refreshTrigger"
          ></app-system-health>
        </div>

        <!-- Row 4: Recent Admin Actions + Lockout Alert Card -->
        <div class="grid-item span-half">
          <app-recent-admin-actions
            [refreshTrigger]="refreshTrigger"
          ></app-recent-admin-actions>
        </div>
        <div class="grid-item span-half">
          <app-lockout-alert-card
            [refreshTrigger]="refreshTrigger"
          ></app-lockout-alert-card>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-container {
        max-width: 1400px;
        margin: 0 auto;
      }

      /* Header */
      .dashboard-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 28px;
        flex-wrap: wrap;
        gap: 16px;
      }
      .header-left h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--innait-text, #252733);
        letter-spacing: -0.02em;
      }
      .last-refresh {
        display: block;
        margin-top: 4px;
        font-size: 0.75rem;
        color: var(--innait-text-secondary, #9FA2B4);
      }
      .header-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid var(--innait-border, #DFE0EB);
        background: var(--innait-surface, #ffffff);
        color: var(--innait-text, #252733);
        font-family: inherit;
      }
      .action-btn:hover {
        border-color: var(--innait-primary, #3751FF);
        color: var(--innait-primary, #3751FF);
      }
      .action-btn i {
        font-size: 14px;
      }
      .auto-refresh-btn.active {
        background: var(--innait-primary, #3751FF);
        color: #ffffff;
        border-color: var(--innait-primary, #3751FF);
      }
      .auto-refresh-btn.active:hover {
        background: var(--innait-primary-dark, #2A3FC7);
        color: #ffffff;
      }

      /* Grid */
      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }
      .grid-item {
        min-height: 300px;
      }
      .grid-item.span-2 {
        grid-column: span 2;
      }
      .grid-item.span-half {
        grid-column: span 1;
      }

      /* Row 4: 2 items across 3 columns => each takes 1.5 cols.
         We use a sub-grid approach: make them span correctly */
      .grid-item.span-half:nth-last-child(2) {
        grid-column: 1 / 2;
      }
      .grid-item.span-half:nth-last-child(1) {
        grid-column: 2 / 4;
      }

      /* Responsive: tablet */
      @media (max-width: 1024px) {
        .dashboard-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .grid-item.span-2 {
          grid-column: span 2;
        }
        .grid-item.span-half {
          grid-column: span 1;
        }
        .grid-item.span-half:nth-last-child(2) {
          grid-column: auto;
        }
        .grid-item.span-half:nth-last-child(1) {
          grid-column: auto;
        }
      }

      /* Responsive: mobile */
      @media (max-width: 640px) {
        .dashboard-container {
          padding: 16px;
        }
        .dashboard-header {
          flex-direction: column;
        }
        .dashboard-grid {
          grid-template-columns: 1fr;
        }
        .grid-item.span-2,
        .grid-item.span-half {
          grid-column: span 1;
        }
        .grid-item.span-half:nth-last-child(2),
        .grid-item.span-half:nth-last-child(1) {
          grid-column: span 1;
        }
        .grid-item {
          min-height: 250px;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  refreshTrigger = 0;
  autoRefreshEnabled = true;
  lastRefresh: Date | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly AUTO_REFRESH_MS = 30_000;

  ngOnInit(): void {
    this.lastRefresh = new Date();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  manualRefresh(): void {
    this.refreshTrigger++;
    this.lastRefresh = new Date();
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    } else {
      // Emit to destroy$ would kill everything; instead use a separate subject
      this.stopAutoRefresh();
    }
  }

  private autoRefreshDestroy$ = new Subject<void>();

  private startAutoRefresh(): void {
    this.autoRefreshDestroy$.next(); // cancel any previous auto-refresh
    interval(this.AUTO_REFRESH_MS)
      .pipe(takeUntil(this.autoRefreshDestroy$), takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshTrigger++;
        this.lastRefresh = new Date();
      });
  }

  private stopAutoRefresh(): void {
    this.autoRefreshDestroy$.next();
  }
}
