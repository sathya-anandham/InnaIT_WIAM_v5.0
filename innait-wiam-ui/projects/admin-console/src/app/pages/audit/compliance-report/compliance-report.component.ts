import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { ApiResponse } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/** MFA compliance data. */
interface MfaCompliance {
  totalUsers: number;
  mfaEnrolled: number;
  percentage: number;
  byMethod: {
    totp: number;
    fido: number;
    softtoken: number;
  };
}

/** Password age compliance data. */
interface PasswordAgeCompliance {
  totalUsers: number;
  compliant: number;
  percentage: number;
  expired: number;
  nearExpiry: number;
}

/** Access review status data. */
interface AccessReviewStatus {
  totalReviews: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  overdueReviews?: { id: string; name: string; dueDate: string; assignee: string }[];
}

/** Password policy compliance data. */
interface PasswordPolicyCompliance {
  totalUsers: number;
  compliant: number;
  percentage: number;
  nonCompliantReasons?: { reason: string; count: number }[];
}

@Component({
  selector: 'app-compliance-report',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="compliance-page" role="main" aria-label="Compliance reporting dashboard">
      <!-- ============================================================ -->
      <!-- Page Header                                                   -->
      <!-- ============================================================ -->
      <header class="page-header">
        <div class="header-left">
          <h1 class="page-title">{{ 'audit.compliance.title' | translate }}</h1>
          <span *ngIf="lastRefresh" class="last-refresh">
            {{ 'audit.compliance.lastRefresh' | translate }}: {{ lastRefresh | date:'medium' }}
          </span>
        </div>
        <div class="header-actions">
          <button
            class="btn btn-outline"
            (click)="exportCsv()"
            [disabled]="exporting"
            aria-label="Export compliance metrics as CSV">
            <i class="pi pi-file" aria-hidden="true"></i>
            {{ 'audit.compliance.exportCsv' | translate }}
          </button>
          <button
            class="btn btn-primary"
            (click)="generateReport()"
            [disabled]="generating"
            aria-label="Generate compliance report as PDF">
            <i *ngIf="generating" class="pi pi-spin pi-spinner" aria-hidden="true"></i>
            <i *ngIf="!generating" class="pi pi-file-pdf" aria-hidden="true"></i>
            {{ 'audit.compliance.generateReport' | translate }}
          </button>
          <button
            class="btn btn-icon"
            (click)="loadAll()"
            aria-label="Refresh compliance data">
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <!-- ============================================================ -->
      <!-- Loading State                                                 -->
      <!-- ============================================================ -->
      <div *ngIf="loading" class="loading-container" aria-live="polite">
        <i class="pi pi-spin pi-spinner loading-spinner" aria-hidden="true"></i>
        <span>{{ 'common.loading' | translate }}</span>
      </div>

      <!-- ============================================================ -->
      <!-- Error State                                                   -->
      <!-- ============================================================ -->
      <div *ngIf="error && !loading" class="error-state" role="alert">
        <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
        <span>{{ error }}</span>
        <button class="btn btn-sm btn-outline" (click)="loadAll()">
          {{ 'common.retry' | translate }}
        </button>
      </div>

      <!-- ============================================================ -->
      <!-- Compliance Panels (2x2 grid)                                  -->
      <!-- ============================================================ -->
      <div *ngIf="!loading && !error" class="compliance-grid">
        <!-- MFA Compliance -->
        <section class="panel" role="region" aria-label="MFA compliance">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'audit.compliance.mfaCompliance' | translate }}</h2>
          </div>
          <div class="panel-body" *ngIf="mfaData">
            <div class="metric-row">
              <div class="circular-progress-container">
                <svg class="circular-progress" viewBox="0 0 120 120" aria-label="MFA compliance percentage">
                  <circle class="cp-bg" cx="60" cy="60" r="52" />
                  <circle
                    class="cp-fill"
                    [ngClass]="getProgressColor(mfaData.percentage)"
                    cx="60" cy="60" r="52"
                    [attr.stroke-dasharray]="getStrokeDasharray(mfaData.percentage)"
                    stroke-dashoffset="0"
                    transform="rotate(-90 60 60)" />
                  <text class="cp-text" x="60" y="56" text-anchor="middle">
                    {{ mfaData.percentage | number:'1.0-0' }}%
                  </text>
                  <text class="cp-subtext" x="60" y="72" text-anchor="middle">
                    enrolled
                  </text>
                </svg>
              </div>
              <div class="metric-details">
                <div class="metric-line">
                  <span class="metric-label">Total Users</span>
                  <span class="metric-value">{{ mfaData.totalUsers | number }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-label">MFA Enrolled</span>
                  <span class="metric-value text-success">{{ mfaData.mfaEnrolled | number }}</span>
                </div>
              </div>
            </div>
            <!-- Method breakdown bars -->
            <div class="method-breakdown">
              <h4 class="breakdown-title">{{ 'audit.compliance.byMethod' | translate }}</h4>
              <div class="bar-item">
                <div class="bar-label">TOTP</div>
                <div class="bar-track">
                  <div class="bar-fill bar-totp" [style.width.%]="getMethodPercent(mfaData.byMethod.totp, mfaData.mfaEnrolled)"></div>
                </div>
                <div class="bar-count">{{ mfaData.byMethod.totp | number }}</div>
              </div>
              <div class="bar-item">
                <div class="bar-label">FIDO2</div>
                <div class="bar-track">
                  <div class="bar-fill bar-fido" [style.width.%]="getMethodPercent(mfaData.byMethod.fido, mfaData.mfaEnrolled)"></div>
                </div>
                <div class="bar-count">{{ mfaData.byMethod.fido | number }}</div>
              </div>
              <div class="bar-item">
                <div class="bar-label">Soft Token</div>
                <div class="bar-track">
                  <div class="bar-fill bar-softtoken" [style.width.%]="getMethodPercent(mfaData.byMethod.softtoken, mfaData.mfaEnrolled)"></div>
                </div>
                <div class="bar-count">{{ mfaData.byMethod.softtoken | number }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Password Age Compliance -->
        <section class="panel" role="region" aria-label="Password age compliance">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'audit.compliance.passwordAge' | translate }}</h2>
          </div>
          <div class="panel-body" *ngIf="passwordAgeData">
            <div class="metric-row">
              <div class="circular-progress-container">
                <svg class="circular-progress" viewBox="0 0 120 120" aria-label="Password age compliance percentage">
                  <circle class="cp-bg" cx="60" cy="60" r="52" />
                  <circle
                    class="cp-fill"
                    [ngClass]="getProgressColor(passwordAgeData.percentage)"
                    cx="60" cy="60" r="52"
                    [attr.stroke-dasharray]="getStrokeDasharray(passwordAgeData.percentage)"
                    stroke-dashoffset="0"
                    transform="rotate(-90 60 60)" />
                  <text class="cp-text" x="60" y="56" text-anchor="middle">
                    {{ passwordAgeData.percentage | number:'1.0-0' }}%
                  </text>
                  <text class="cp-subtext" x="60" y="72" text-anchor="middle">
                    compliant
                  </text>
                </svg>
              </div>
              <div class="metric-details">
                <div class="metric-line">
                  <span class="metric-label">Total Users</span>
                  <span class="metric-value">{{ passwordAgeData.totalUsers | number }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-label">Compliant</span>
                  <span class="metric-value text-success">{{ passwordAgeData.compliant | number }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-label">Expired</span>
                  <span class="metric-value text-danger">{{ passwordAgeData.expired | number }}</span>
                </div>
              </div>
            </div>
            <!-- Near-expiry warning -->
            <div *ngIf="passwordAgeData.nearExpiry > 0" class="warning-box" role="alert">
              <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              <span>
                <strong>{{ passwordAgeData.nearExpiry }}</strong> user(s) have passwords expiring within the next 7 days.
              </span>
            </div>
          </div>
        </section>

        <!-- Access Review Status -->
        <section class="panel" role="region" aria-label="Access review status">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'audit.compliance.accessReview' | translate }}</h2>
          </div>
          <div class="panel-body" *ngIf="accessReviewData">
            <div class="metric-row">
              <div class="metric-details wide">
                <div class="metric-line">
                  <span class="metric-label">Total Reviews</span>
                  <span class="metric-value">{{ accessReviewData.totalReviews | number }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-label">Completed</span>
                  <span class="metric-value text-success">{{ accessReviewData.completed | number }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-label">Pending</span>
                  <span class="metric-value text-warning">{{ accessReviewData.pending | number }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-label">Overdue</span>
                  <span class="metric-value text-danger">{{ accessReviewData.overdue | number }}</span>
                </div>
              </div>
            </div>
            <!-- Completion rate progress bar -->
            <div class="progress-section">
              <div class="progress-header">
                <span class="progress-label">{{ 'audit.compliance.completionRate' | translate }}</span>
                <span class="progress-value">{{ accessReviewData.completionRate | number:'1.0-0' }}%</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-fill"
                  [ngClass]="getProgressColor(accessReviewData.completionRate)"
                  [style.width.%]="accessReviewData.completionRate">
                </div>
              </div>
            </div>
            <!-- Overdue reviews list -->
            <div *ngIf="accessReviewData.overdueReviews?.length" class="overdue-list">
              <h4 class="overdue-title">{{ 'audit.compliance.overdueReviews' | translate }}</h4>
              <div class="overdue-item" *ngFor="let review of accessReviewData.overdueReviews">
                <div class="overdue-info">
                  <span class="overdue-name">{{ review.name }}</span>
                  <span class="overdue-assignee">
                    <i class="pi pi-user" aria-hidden="true"></i> {{ review.assignee }}
                  </span>
                </div>
                <span class="overdue-date text-danger">Due: {{ review.dueDate | date:'mediumDate' }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Password Policy Compliance -->
        <section class="panel" role="region" aria-label="Password policy compliance">
          <div class="panel-header">
            <h2 class="panel-title">{{ 'audit.compliance.passwordPolicy' | translate }}</h2>
          </div>
          <div class="panel-body" *ngIf="passwordPolicyData">
            <div class="metric-row">
              <div class="circular-progress-container">
                <svg class="circular-progress" viewBox="0 0 120 120" aria-label="Password policy compliance percentage">
                  <circle class="cp-bg" cx="60" cy="60" r="52" />
                  <circle
                    class="cp-fill"
                    [ngClass]="getProgressColor(passwordPolicyData.percentage)"
                    cx="60" cy="60" r="52"
                    [attr.stroke-dasharray]="getStrokeDasharray(passwordPolicyData.percentage)"
                    stroke-dashoffset="0"
                    transform="rotate(-90 60 60)" />
                  <text class="cp-text" x="60" y="56" text-anchor="middle">
                    {{ passwordPolicyData.percentage | number:'1.0-0' }}%
                  </text>
                  <text class="cp-subtext" x="60" y="72" text-anchor="middle">
                    compliant
                  </text>
                </svg>
              </div>
              <div class="metric-details">
                <div class="metric-line">
                  <span class="metric-label">Total Users</span>
                  <span class="metric-value">{{ passwordPolicyData.totalUsers | number }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-label">Compliant</span>
                  <span class="metric-value text-success">{{ passwordPolicyData.compliant | number }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-label">Non-Compliant</span>
                  <span class="metric-value text-danger">{{ passwordPolicyData.totalUsers - passwordPolicyData.compliant | number }}</span>
                </div>
              </div>
            </div>
            <!-- Non-compliant reasons -->
            <div *ngIf="passwordPolicyData.nonCompliantReasons?.length" class="reasons-list">
              <h4 class="reasons-title">{{ 'audit.compliance.nonCompliantReasons' | translate }}</h4>
              <div class="reason-item" *ngFor="let reason of passwordPolicyData.nonCompliantReasons">
                <span class="reason-label">{{ reason.reason }}</span>
                <span class="reason-count">{{ reason.count | number }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .compliance-page {
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
    .header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
    }
    .last-refresh {
      font-size: 12px;
      color: var(--text-color-secondary, #94a3b8);
    }
    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    /* ── Loading / Error ── */
    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 80px 20px;
      color: var(--text-color-secondary, #64748b);
    }
    .loading-spinner { font-size: 28px; }
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px;
      color: var(--red-500, #ef4444);
      text-align: center;
    }
    .error-state i { font-size: 28px; }

    /* ── Grid Layout ── */
    .compliance-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 900px) {
      .compliance-grid { grid-template-columns: 1fr; }
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
    .panel-body { padding: 20px; }

    /* ── Metric Row ── */
    .metric-row {
      display: flex;
      gap: 24px;
      align-items: center;
      margin-bottom: 16px;
    }
    .metric-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }
    .metric-details.wide { flex: 1; }
    .metric-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .metric-label {
      font-size: 13px;
      color: var(--text-color-secondary, #64748b);
    }
    .metric-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
    }
    .text-success { color: #22c55e !important; }
    .text-warning { color: #f97316 !important; }
    .text-danger  { color: #ef4444 !important; }

    /* ── Circular Progress ── */
    .circular-progress-container {
      width: 120px;
      height: 120px;
      flex-shrink: 0;
    }
    .circular-progress {
      width: 100%;
      height: 100%;
    }
    .cp-bg {
      fill: none;
      stroke: var(--surface-200, #e9ecef);
      stroke-width: 8;
    }
    .cp-fill {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dasharray 0.6s ease;
    }
    .cp-fill.progress-green  { stroke: #22c55e; }
    .cp-fill.progress-yellow { stroke: #f97316; }
    .cp-fill.progress-red    { stroke: #ef4444; }
    .cp-text {
      font-size: 22px;
      font-weight: 700;
      fill: var(--text-color, #1e293b);
    }
    .cp-subtext {
      font-size: 11px;
      fill: var(--text-color-secondary, #94a3b8);
    }

    /* ── Method Breakdown Bars ── */
    .method-breakdown {
      border-top: 1px solid var(--surface-border, #dee2e6);
      padding-top: 12px;
    }
    .breakdown-title {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--text-color-secondary, #64748b);
    }
    .bar-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .bar-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-color, #333);
      min-width: 70px;
    }
    .bar-track {
      flex: 1;
      height: 8px;
      background: var(--surface-200, #e9ecef);
      border-radius: 4px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    .bar-totp      { background: #3b82f6; }
    .bar-fido      { background: #22c55e; }
    .bar-softtoken { background: #f97316; }
    .bar-count {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-color, #333);
      min-width: 40px;
      text-align: right;
    }

    /* ── Warning Box ── */
    .warning-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: rgba(249,115,22,0.08);
      border: 1px solid rgba(249,115,22,0.3);
      border-radius: 8px;
      font-size: 13px;
      color: #ea580c;
      margin-top: 12px;
    }
    .warning-box i { font-size: 18px; flex-shrink: 0; }

    /* ── Progress Bar ── */
    .progress-section { margin-bottom: 16px; }
    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .progress-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-color-secondary, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .progress-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
    }
    .progress-track {
      width: 100%;
      height: 10px;
      background: var(--surface-200, #e9ecef);
      border-radius: 5px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.5s ease;
    }
    .progress-fill.progress-green  { background: #22c55e; }
    .progress-fill.progress-yellow { background: #f97316; }
    .progress-fill.progress-red    { background: #ef4444; }

    /* ── Overdue List ── */
    .overdue-list {
      border-top: 1px solid var(--surface-border, #dee2e6);
      padding-top: 12px;
    }
    .overdue-title {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--text-color-secondary, #64748b);
    }
    .overdue-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--surface-100, #f1f5f9);
    }
    .overdue-info { display: flex; flex-direction: column; gap: 2px; }
    .overdue-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-color, #333);
    }
    .overdue-assignee {
      font-size: 12px;
      color: var(--text-color-secondary, #94a3b8);
    }
    .overdue-assignee i { margin-right: 2px; }
    .overdue-date {
      font-size: 12px;
      font-weight: 600;
    }

    /* ── Reasons List ── */
    .reasons-list {
      border-top: 1px solid var(--surface-border, #dee2e6);
      padding-top: 12px;
    }
    .reasons-title {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--text-color-secondary, #64748b);
    }
    .reason-item {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid var(--surface-100, #f1f5f9);
      font-size: 13px;
    }
    .reason-label { color: var(--text-color, #333); }
    .reason-count { font-weight: 600; color: var(--red-500, #ef4444); }

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
    .btn-outline { border-color: var(--surface-border, #dee2e6); }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-icon {
      padding: 8px;
      border-radius: 8px;
      min-width: 36px;
      justify-content: center;
    }
  `],
})
export class ComplianceReportComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/audit/compliance';

  /** State */
  loading = false;
  error: string | null = null;
  exporting = false;
  generating = false;
  lastRefresh: Date | null = null;

  /** Data */
  mfaData: MfaCompliance | null = null;
  passwordAgeData: PasswordAgeCompliance | null = null;
  accessReviewData: AccessReviewStatus | null = null;
  passwordPolicyData: PasswordPolicyCompliance | null = null;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load all compliance data in parallel. */
  loadAll(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      mfa: this.http.get<ApiResponse<MfaCompliance>>(`${this.apiBase}/mfa`),
      passwordAge: this.http.get<ApiResponse<PasswordAgeCompliance>>(`${this.apiBase}/password-age`),
      accessReview: this.http.get<ApiResponse<AccessReviewStatus>>(`${this.apiBase}/access-review`),
      passwordPolicy: this.http.get<ApiResponse<PasswordPolicyCompliance>>(`${this.apiBase}/password-policy`),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (responses) => {
          this.mfaData = responses.mfa.data;
          this.passwordAgeData = responses.passwordAge.data;
          this.accessReviewData = responses.accessReview.data;
          this.passwordPolicyData = responses.passwordPolicy.data;
          this.lastRefresh = new Date();
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.error?.message || 'Failed to load compliance data';
          this.loading = false;
        },
      });
  }

  /** Generates a PDF compliance report. */
  generateReport(): void {
    this.generating = true;

    this.http
      .post(`${this.apiBase}/report`, null, {
        params: { format: 'pdf' },
        responseType: 'blob',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.downloadBlob(blob, 'compliance-report.pdf');
          this.generating = false;
        },
        error: () => {
          this.generating = false;
        },
      });
  }

  /** Exports all metrics as CSV. */
  exportCsv(): void {
    this.exporting = true;

    this.http
      .get(`${this.apiBase}/export`, {
        params: { format: 'csv' },
        responseType: 'blob',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.downloadBlob(blob, 'compliance-metrics.csv');
          this.exporting = false;
        },
        error: () => {
          this.exporting = false;
        },
      });
  }

  /** Download a blob as a file. */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Calculates the SVG stroke-dasharray value for a circular progress indicator.
   * The circumference of the circle with r=52 is 2 * PI * 52 = ~326.73.
   */
  getStrokeDasharray(percentage: number): string {
    const circumference = 2 * Math.PI * 52;
    const filled = (percentage / 100) * circumference;
    return `${filled} ${circumference - filled}`;
  }

  /** Returns a CSS class based on the percentage value for color coding. */
  getProgressColor(percentage: number): string {
    if (percentage >= 80) return 'progress-green';
    if (percentage >= 50) return 'progress-yellow';
    return 'progress-red';
  }

  /** Calculates the percentage of a method relative to total enrolled. */
  getMethodPercent(methodCount: number, total: number): number {
    if (!total) return 0;
    return (methodCount / total) * 100;
  }
}
