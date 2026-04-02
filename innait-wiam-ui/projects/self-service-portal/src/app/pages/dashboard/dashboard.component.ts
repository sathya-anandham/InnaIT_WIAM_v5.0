import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { AuthService, User, AuditEvent, ApiResponse } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

interface DashboardData {
  user: User;
  lastLogin: string;
  mfaMethods: string[];
  activeSessions: number;
  recentActivity: AuditEvent[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
    TranslatePipe,
  ],
  template: `
    <!-- Loading State -->
    <div class="loading-container" *ngIf="loading" role="status" aria-label="Loading dashboard">
      <p-progressSpinner strokeWidth="3" animationDuration="1s" />
      <p class="loading-text">{{ 'dashboard.loading' | translate }}</p>
    </div>

    <!-- Error State -->
    <p-message
      *ngIf="errorMessage && !loading"
      severity="error"
      [text]="errorMessage"
      styleClass="mb-3 w-full"
      role="alert"
    />

    <!-- Dashboard Content -->
    <div class="dashboard-grid" *ngIf="!loading && dashboardData" role="main">

      <!-- Welcome Card -->
      <p-card styleClass="welcome-card" [style]="{ gridColumn: '1 / -1' }">
        <div class="welcome-content">
          <div class="welcome-text">
            <h1 class="welcome-heading" aria-label="Welcome message">
              {{ 'dashboard.welcome' | translate }}, {{ dashboardData.user.displayName }}
            </h1>
            <p class="last-login-text" *ngIf="dashboardData.lastLogin">
              <i class="pi pi-clock"></i>
              {{ 'dashboard.lastLogin' | translate }}: {{ dashboardData.lastLogin | date:'medium' }}
            </p>
          </div>
          <div class="welcome-icon">
            <i class="pi pi-shield"></i>
          </div>
        </div>
      </p-card>

      <!-- Quick Action Cards -->
      <p-card
        styleClass="action-card"
        [routerLink]="['/password']"
        role="link"
        [attr.aria-label]="'dashboard.changePassword' | translate"
      >
        <div class="action-content">
          <div class="action-icon action-icon--password">
            <i class="pi pi-lock"></i>
          </div>
          <h3 class="action-title">{{ 'dashboard.changePassword' | translate }}</h3>
          <p class="action-desc">{{ 'dashboard.changePasswordDesc' | translate }}</p>
        </div>
      </p-card>

      <p-card
        styleClass="action-card"
        [routerLink]="['/mfa/totp']"
        role="link"
        [attr.aria-label]="'dashboard.manageMfa' | translate"
      >
        <div class="action-content">
          <div class="action-icon action-icon--mfa">
            <i class="pi pi-mobile"></i>
          </div>
          <h3 class="action-title">{{ 'dashboard.manageMfa' | translate }}</h3>
          <p class="action-desc">{{ 'dashboard.manageMfaDesc' | translate }}</p>
        </div>
      </p-card>

      <p-card
        styleClass="action-card"
        [routerLink]="['/sessions']"
        role="link"
        [attr.aria-label]="'dashboard.viewSessions' | translate"
      >
        <div class="action-content">
          <div class="action-icon action-icon--sessions">
            <i class="pi pi-desktop"></i>
          </div>
          <h3 class="action-title">{{ 'dashboard.viewSessions' | translate }}</h3>
          <p class="action-desc">{{ 'dashboard.viewSessionsDesc' | translate }}</p>
        </div>
      </p-card>

      <p-card
        styleClass="action-card"
        [routerLink]="['/access-request']"
        role="link"
        [attr.aria-label]="'dashboard.requestAccess' | translate"
      >
        <div class="action-content">
          <div class="action-icon action-icon--access">
            <i class="pi pi-plus-circle"></i>
          </div>
          <h3 class="action-title">{{ 'dashboard.requestAccess' | translate }}</h3>
          <p class="action-desc">{{ 'dashboard.requestAccessDesc' | translate }}</p>
        </div>
      </p-card>

      <!-- Security Summary Panel -->
      <p-card
        styleClass="security-card"
        [style]="{ gridColumn: '1 / -1' }"
        [header]="'dashboard.securitySummary' | translate"
      >
        <div class="security-grid">
          <!-- MFA Status -->
          <div class="security-section" role="region" aria-label="MFA enrollment status">
            <h4 class="security-section-title">
              <i class="pi pi-shield"></i>
              {{ 'dashboard.mfaStatus' | translate }}
            </h4>
            <div class="mfa-methods" *ngIf="dashboardData.mfaMethods.length > 0; else noMfa">
              <span
                class="mfa-badge"
                *ngFor="let method of dashboardData.mfaMethods"
                [attr.aria-label]="method + ' enrolled'"
              >
                <i class="pi pi-check-circle"></i>
                {{ method }}
              </span>
            </div>
            <ng-template #noMfa>
              <p class="no-data-text">
                <i class="pi pi-exclamation-triangle warning-icon"></i>
                {{ 'dashboard.noMfaEnrolled' | translate }}
              </p>
            </ng-template>
          </div>

          <!-- Active Sessions -->
          <div class="security-section" role="region" aria-label="Active sessions count">
            <h4 class="security-section-title">
              <i class="pi pi-desktop"></i>
              {{ 'dashboard.activeSessions' | translate }}
            </h4>
            <div class="session-count">
              <span class="count-value">{{ dashboardData.activeSessions }}</span>
              <span class="count-label">{{ 'dashboard.activeSessionsLabel' | translate }}</span>
            </div>
          </div>

          <!-- Recent Activity -->
          <div
            class="security-section security-section--activity"
            role="region"
            aria-label="Recent account activity"
          >
            <h4 class="security-section-title">
              <i class="pi pi-history"></i>
              {{ 'dashboard.recentActivity' | translate }}
            </h4>
            <div
              class="activity-list"
              *ngIf="dashboardData.recentActivity.length > 0; else noActivity"
            >
              <div
                class="activity-item"
                *ngFor="let event of dashboardData.recentActivity"
                [class.activity-item--failure]="event.outcome === 'FAILURE'"
              >
                <div class="activity-icon">
                  <i
                    class="pi"
                    [ngClass]="event.outcome === 'SUCCESS' ? 'pi-check-circle' : 'pi-times-circle'"
                  ></i>
                </div>
                <div class="activity-details">
                  <span class="activity-type">{{ event.eventType }}</span>
                  <span class="activity-meta">
                    {{ event.timestamp | date:'short' }} &middot; {{ event.ipAddress }}
                  </span>
                </div>
                <span
                  class="activity-outcome"
                  [class.outcome-success]="event.outcome === 'SUCCESS'"
                  [class.outcome-failure]="event.outcome === 'FAILURE'"
                >
                  {{ event.outcome }}
                </span>
              </div>
            </div>
            <ng-template #noActivity>
              <p class="no-data-text">{{ 'dashboard.noRecentActivity' | translate }}</p>
            </ng-template>
          </div>
        </div>
      </p-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      gap: 1rem;
    }

    .loading-text {
      color: var(--innait-text-secondary, #6b7280);
      font-size: 0.875rem;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    /* Welcome Card */
    .welcome-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .welcome-heading {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--innait-text, #1f2937);
    }

    .last-login-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 0.875rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    .welcome-icon {
      font-size: 3rem;
      color: var(--innait-primary, #1976d2);
      opacity: 0.15;
    }

    /* Action Cards */
    :host ::ng-deep .action-card {
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    :host ::ng-deep .action-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .action-content {
      text-align: center;
    }

    .action-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }

    .action-icon--password {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .action-icon--mfa {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
    }

    .action-icon--sessions {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    .action-icon--access {
      background: rgba(168, 85, 247, 0.1);
      color: #a855f7;
    }

    .action-title {
      margin: 0 0 0.25rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--innait-text, #1f2937);
    }

    .action-desc {
      margin: 0;
      font-size: 0.8rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    /* Security Summary */
    .security-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .security-section {
      padding: 1rem;
      border-radius: 8px;
      background: var(--innait-bg, #f9fafb);
    }

    .security-section--activity {
      grid-column: 1 / -1;
    }

    .security-section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.75rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--innait-text, #1f2937);
    }

    .mfa-methods {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .mfa-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      background: rgba(34, 197, 94, 0.1);
      color: #15803d;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .no-data-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 0.85rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    .warning-icon {
      color: #f59e0b;
    }

    .session-count {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    .count-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--innait-primary, #1976d2);
    }

    .count-label {
      font-size: 0.85rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    /* Activity List */
    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      background: var(--innait-surface, #ffffff);
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .activity-item--failure {
      border-left: 3px solid #ef4444;
    }

    .activity-icon .pi-check-circle {
      color: #22c55e;
    }

    .activity-icon .pi-times-circle {
      color: #ef4444;
    }

    .activity-details {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .activity-type {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--innait-text, #1f2937);
    }

    .activity-meta {
      font-size: 0.75rem;
      color: var(--innait-text-secondary, #6b7280);
    }

    .activity-outcome {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .outcome-success {
      background: rgba(34, 197, 94, 0.1);
      color: #15803d;
    }

    .outcome-failure {
      background: rgba(239, 68, 68, 0.1);
      color: #dc2626;
    }

    @media (max-width: 1024px) {
      .dashboard-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .welcome-heading {
        font-size: 1.25rem;
      }

      .security-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  loading = true;
  errorMessage = '';
  dashboardData: DashboardData | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/self';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<ApiResponse<DashboardData>>(`${this.apiBase}/dashboard`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.dashboardData = response.data;
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage =
            err?.error?.error?.message ?? 'Failed to load dashboard data. Please try again.';
          this.loading = false;
        },
      });
  }
}
