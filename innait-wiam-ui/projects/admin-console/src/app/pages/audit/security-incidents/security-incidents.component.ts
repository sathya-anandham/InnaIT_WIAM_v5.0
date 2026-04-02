import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { ApiResponse, PaginationMeta } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

/** Severity levels for security incidents. */
type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Status values for security incidents. */
type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

/** Shape of a single security incident returned by the API. */
interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reportedAt: string;
  resolvedAt: string | null;
  assignee: string | null;
  relatedEvents: string[];
}

/** Summary statistics for the incidents dashboard. */
interface IncidentSummary {
  openBySeverity: Record<IncidentSeverity, number>;
  avgResolutionTimeHours: number;
}

/** State for the action dialog. */
interface ActionDialogState {
  visible: boolean;
  type: 'investigate' | 'resolve' | 'dismiss' | null;
  incident: SecurityIncident | null;
  notes: string;
  submitting: boolean;
}

@Component({
  selector: 'app-security-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="incidents-page" role="main" aria-label="Security incidents">
      <!-- ============================================================ -->
      <!-- Page Header                                                   -->
      <!-- ============================================================ -->
      <header class="page-header">
        <h1 class="page-title">{{ 'audit.incidents.title' | translate }}</h1>
        <button
          class="btn btn-icon"
          (click)="loadIncidents(); loadSummary()"
          aria-label="Refresh incidents">
          <i class="pi pi-refresh" aria-hidden="true"></i>
        </button>
      </header>

      <!-- ============================================================ -->
      <!-- Summary Stats                                                 -->
      <!-- ============================================================ -->
      <section class="summary-bar" *ngIf="summary" role="region" aria-label="Incident summary statistics">
        <div class="summary-stat">
          <span class="stat-label">{{ 'audit.incidents.openCritical' | translate }}</span>
          <span class="stat-value severity-critical">{{ summary.openBySeverity['CRITICAL'] || 0 }}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">{{ 'audit.incidents.openHigh' | translate }}</span>
          <span class="stat-value severity-high">{{ summary.openBySeverity['HIGH'] || 0 }}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">{{ 'audit.incidents.openMedium' | translate }}</span>
          <span class="stat-value severity-medium">{{ summary.openBySeverity['MEDIUM'] || 0 }}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">{{ 'audit.incidents.openLow' | translate }}</span>
          <span class="stat-value severity-low">{{ summary.openBySeverity['LOW'] || 0 }}</span>
        </div>
        <div class="summary-stat">
          <span class="stat-label">{{ 'audit.incidents.avgResolution' | translate }}</span>
          <span class="stat-value">{{ summary.avgResolutionTimeHours | number:'1.1-1' }}h</span>
        </div>
      </section>

      <!-- Loading summary skeleton -->
      <section class="summary-bar" *ngIf="!summary && !summaryError">
        <div class="summary-stat skeleton-stat" *ngFor="let s of [1,2,3,4,5]">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
        </div>
      </section>

      <!-- ============================================================ -->
      <!-- Filters                                                       -->
      <!-- ============================================================ -->
      <section class="filter-toolbar" role="search" aria-label="Incident filters">
        <div class="filter-group">
          <label for="severityFilter" class="filter-label">{{ 'audit.incidents.severity' | translate }}</label>
          <select
            id="severityFilter"
            class="filter-select"
            [(ngModel)]="filters.severity"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter by severity">
            <option value="">{{ 'common.all' | translate }}</option>
            <option *ngFor="let sev of severities" [value]="sev">{{ sev }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="statusFilter" class="filter-label">{{ 'audit.incidents.status' | translate }}</label>
          <select
            id="statusFilter"
            class="filter-select"
            [(ngModel)]="filters.status"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter by status">
            <option value="">{{ 'common.all' | translate }}</option>
            <option *ngFor="let st of statuses" [value]="st">{{ st }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="incDateFrom" class="filter-label">{{ 'audit.incidents.from' | translate }}</label>
          <input
            id="incDateFrom"
            type="datetime-local"
            class="filter-input"
            [(ngModel)]="filters.from"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter from date" />
        </div>

        <div class="filter-group">
          <label for="incDateTo" class="filter-label">{{ 'audit.incidents.to' | translate }}</label>
          <input
            id="incDateTo"
            type="datetime-local"
            class="filter-input"
            [(ngModel)]="filters.to"
            (ngModelChange)="onFilterChange()"
            aria-label="Filter to date" />
        </div>

        <button class="btn btn-sm btn-outline" (click)="clearFilters()" aria-label="Clear all filters">
          <i class="pi pi-filter-slash" aria-hidden="true"></i>
          {{ 'common.clearFilters' | translate }}
        </button>
      </section>

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
        <button class="btn btn-sm btn-outline" (click)="loadIncidents()">
          {{ 'common.retry' | translate }}
        </button>
      </div>

      <!-- ============================================================ -->
      <!-- Empty State                                                   -->
      <!-- ============================================================ -->
      <div *ngIf="!loading && !error && incidents.length === 0" class="empty-state" role="status">
        <i class="pi pi-check-circle" aria-hidden="true"></i>
        <span>{{ 'audit.incidents.noIncidents' | translate }}</span>
      </div>

      <!-- ============================================================ -->
      <!-- Incident Cards                                                -->
      <!-- ============================================================ -->
      <div *ngIf="!loading && !error && incidents.length > 0" class="incidents-grid" role="list" aria-label="Security incidents list">
        <div
          *ngFor="let incident of incidents; trackBy: trackById"
          class="incident-card"
          [ngClass]="'severity-border-' + incident.severity.toLowerCase()"
          role="listitem"
          [attr.aria-label]="incident.title + ' - severity ' + incident.severity + ' - status ' + incident.status">

          <!-- Card Header -->
          <div class="incident-card-header">
            <div class="incident-badges">
              <span class="severity-badge" [ngClass]="'severity-bg-' + incident.severity.toLowerCase()">
                {{ incident.severity }}
              </span>
              <span class="status-badge" [ngClass]="'status-bg-' + incident.status.toLowerCase()">
                {{ incident.status }}
              </span>
            </div>
            <span class="incident-date">{{ incident.reportedAt | date:'medium' }}</span>
          </div>

          <!-- Card Body -->
          <div class="incident-card-body">
            <h3 class="incident-title">{{ incident.title }}</h3>
            <p class="incident-desc">{{ incident.description }}</p>

            <div *ngIf="incident.assignee" class="incident-assignee">
              <i class="pi pi-user" aria-hidden="true"></i>
              <span>{{ incident.assignee }}</span>
            </div>

            <div *ngIf="incident.resolvedAt" class="incident-resolved">
              <i class="pi pi-check-circle" aria-hidden="true"></i>
              <span>Resolved: {{ incident.resolvedAt | date:'medium' }}</span>
            </div>
          </div>

          <!-- Lifecycle Timeline -->
          <div class="incident-timeline" role="list" aria-label="Incident lifecycle">
            <div class="timeline-event" role="listitem">
              <div class="tl-dot tl-dot-reported"></div>
              <div class="tl-content">
                <span class="tl-label">Reported</span>
                <span class="tl-date">{{ incident.reportedAt | date:'short' }}</span>
              </div>
            </div>
            <div class="tl-connector" *ngIf="incident.status !== 'OPEN'"></div>
            <div class="timeline-event" *ngIf="incident.status === 'INVESTIGATING' || incident.status === 'RESOLVED'" role="listitem">
              <div class="tl-dot tl-dot-investigating"></div>
              <div class="tl-content">
                <span class="tl-label">Investigating</span>
              </div>
            </div>
            <div class="tl-connector" *ngIf="incident.status === 'RESOLVED'"></div>
            <div class="timeline-event" *ngIf="incident.status === 'RESOLVED'" role="listitem">
              <div class="tl-dot tl-dot-resolved"></div>
              <div class="tl-content">
                <span class="tl-label">Resolved</span>
                <span class="tl-date" *ngIf="incident.resolvedAt">{{ incident.resolvedAt | date:'short' }}</span>
              </div>
            </div>
            <div class="tl-connector" *ngIf="incident.status === 'DISMISSED'"></div>
            <div class="timeline-event" *ngIf="incident.status === 'DISMISSED'" role="listitem">
              <div class="tl-dot tl-dot-dismissed"></div>
              <div class="tl-content">
                <span class="tl-label">Dismissed</span>
              </div>
            </div>
          </div>

          <!-- Related Events -->
          <div *ngIf="incident.relatedEvents?.length" class="related-events">
            <span class="related-label">{{ 'audit.incidents.relatedEvents' | translate }}:</span>
            <span class="related-count">{{ incident.relatedEvents.length }} event(s)</span>
          </div>

          <!-- Actions -->
          <div class="incident-actions">
            <button
              *ngIf="incident.status === 'OPEN'"
              class="btn btn-sm btn-primary"
              (click)="openActionDialog('investigate', incident)"
              aria-label="Start investigating incident">
              <i class="pi pi-search" aria-hidden="true"></i>
              {{ 'audit.incidents.investigate' | translate }}
            </button>
            <button
              *ngIf="incident.status === 'OPEN' || incident.status === 'INVESTIGATING'"
              class="btn btn-sm btn-success"
              (click)="openActionDialog('resolve', incident)"
              aria-label="Resolve incident">
              <i class="pi pi-check" aria-hidden="true"></i>
              {{ 'audit.incidents.resolve' | translate }}
            </button>
            <button
              *ngIf="incident.status === 'OPEN' || incident.status === 'INVESTIGATING'"
              class="btn btn-sm btn-outline"
              (click)="openActionDialog('dismiss', incident)"
              aria-label="Dismiss incident">
              <i class="pi pi-times" aria-hidden="true"></i>
              {{ 'audit.incidents.dismiss' | translate }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Pagination                                                    -->
      <!-- ============================================================ -->
      <div *ngIf="totalRecords > 0" class="pagination-bar" role="navigation" aria-label="Pagination">
        <span class="pagination-info">
          Showing {{ (currentPage - 1) * pageSize + 1 }}
          - {{ currentPage * pageSize > totalRecords ? totalRecords : currentPage * pageSize }}
          of {{ totalRecords }}
        </span>
        <div class="pagination-controls">
          <button
            class="btn btn-sm btn-icon"
            [disabled]="currentPage <= 1"
            (click)="goToPage(currentPage - 1)"
            aria-label="Previous page">
            <i class="pi pi-chevron-left" aria-hidden="true"></i>
          </button>
          <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
          <button
            class="btn btn-sm btn-icon"
            [disabled]="currentPage >= totalPages"
            (click)="goToPage(currentPage + 1)"
            aria-label="Next page">
            <i class="pi pi-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Action Dialog (Investigate / Resolve / Dismiss)               -->
      <!-- ============================================================ -->
      <div
        *ngIf="dialog.visible"
        class="dialog-backdrop"
        (click)="closeDialog()"
        role="presentation">
        <div
          class="dialog-panel"
          role="dialog"
          [attr.aria-label]="getDialogTitle()"
          (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h2 class="dialog-title">{{ getDialogTitle() }}</h2>
            <button class="btn btn-icon btn-sm" (click)="closeDialog()" aria-label="Close dialog">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
          <div class="dialog-body">
            <p class="dialog-incident-title" *ngIf="dialog.incident">
              {{ dialog.incident.title }}
            </p>
            <label for="actionNotes" class="filter-label">
              {{ dialog.type === 'dismiss' ? 'Reason' : 'Notes' }}
            </label>
            <textarea
              id="actionNotes"
              class="dialog-textarea"
              [(ngModel)]="dialog.notes"
              rows="4"
              [placeholder]="dialog.type === 'dismiss' ? 'Reason for dismissal...' : 'Enter notes...'"
              aria-label="Action notes"></textarea>
          </div>
          <div class="dialog-footer">
            <button class="btn btn-outline" (click)="closeDialog()" [disabled]="dialog.submitting">
              {{ 'common.cancel' | translate }}
            </button>
            <button
              class="btn"
              [ngClass]="dialog.type === 'dismiss' ? 'btn-warning' : 'btn-primary'"
              (click)="submitAction()"
              [disabled]="dialog.submitting || !dialog.notes.trim()">
              <i *ngIf="dialog.submitting" class="pi pi-spin pi-spinner" aria-hidden="true"></i>
              {{ dialog.type === 'investigate' ? 'Start Investigation' : dialog.type === 'resolve' ? 'Mark Resolved' : 'Dismiss' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .incidents-page {
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
    }
    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
    }

    /* ── Summary ── */
    .summary-bar {
      display: flex;
      gap: 20px;
      padding: 16px 20px;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      flex-wrap: wrap;
    }
    .summary-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 110px;
    }
    .stat-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--text-color-secondary, #64748b);
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-color, #1e293b);
    }
    .severity-critical { color: #991b1b; }
    .severity-high     { color: #dc2626; }
    .severity-medium   { color: #ea580c; }
    .severity-low      { color: #ca8a04; }

    /* Skeleton */
    .skeleton-stat .skeleton-line {
      height: 14px;
      background: linear-gradient(90deg, var(--surface-200, #e9ecef) 25%, var(--surface-100, #f8f9fa) 50%, var(--surface-200, #e9ecef) 75%);
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 4px;
      width: 80px;
    }
    .skeleton-stat .skeleton-line.short { width: 50px; height: 10px; }
    @keyframes pulse {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Filters ── */
    .filter-toolbar {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      flex-wrap: wrap;
      padding: 14px 16px;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
    }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--text-color-secondary, #64748b);
    }
    .filter-select,
    .filter-input {
      padding: 7px 10px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 6px;
      font-size: 13px;
      background: var(--surface-ground, #f8f9fa);
      color: var(--text-color, #333);
      min-width: 140px;
    }
    .filter-select:focus,
    .filter-input:focus {
      outline: 2px solid var(--primary-color, #3b82f6);
      outline-offset: -1px;
    }

    /* ── Loading / Error / Empty ── */
    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 60px 20px;
      color: var(--text-color-secondary, #64748b);
    }
    .loading-spinner { font-size: 24px; }
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
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 60px;
      color: var(--text-color-secondary, #64748b);
    }
    .empty-state i { font-size: 36px; color: #22c55e; }

    /* ── Incident Cards Grid ── */
    .incidents-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      gap: 16px;
    }
    .incident-card {
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .severity-border-critical { border-left: 4px solid #991b1b; }
    .severity-border-high     { border-left: 4px solid #dc2626; }
    .severity-border-medium   { border-left: 4px solid #ea580c; }
    .severity-border-low      { border-left: 4px solid #ca8a04; }

    .incident-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--surface-border, #dee2e6);
      background: var(--surface-ground, #f8f9fa);
      flex-wrap: wrap;
      gap: 8px;
    }
    .incident-badges { display: flex; gap: 6px; }

    /* Severity badges */
    .severity-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .severity-bg-critical { background: #991b1b; color: #fff; }
    .severity-bg-high     { background: #dc2626; color: #fff; }
    .severity-bg-medium   { background: #ea580c; color: #fff; }
    .severity-bg-low      { background: #ca8a04; color: #fff; }

    /* Status badges */
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .status-bg-open          { background: rgba(59,130,246,0.12); color: #2563eb; }
    .status-bg-investigating { background: rgba(139,92,246,0.12); color: #7c3aed; }
    .status-bg-resolved      { background: rgba(34,197,94,0.12); color: #16a34a; }
    .status-bg-dismissed     { background: rgba(100,116,139,0.12); color: #64748b; }

    .incident-date {
      font-size: 12px;
      color: var(--text-color-secondary, #94a3b8);
    }

    .incident-card-body {
      padding: 16px;
      flex: 1;
    }
    .incident-title {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color, #1e293b);
    }
    .incident-desc {
      margin: 0 0 12px;
      font-size: 13px;
      color: var(--text-color-secondary, #64748b);
      line-height: 1.5;
    }
    .incident-assignee,
    .incident-resolved {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-color-secondary, #64748b);
      margin-bottom: 4px;
    }
    .incident-assignee i,
    .incident-resolved i { font-size: 14px; }

    /* ── Mini Timeline ── */
    .incident-timeline {
      display: flex;
      align-items: center;
      gap: 0;
      padding: 12px 16px;
      border-top: 1px solid var(--surface-border, #dee2e6);
      background: var(--surface-ground, #fafbfc);
    }
    .timeline-event {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tl-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .tl-dot-reported      { background: #3b82f6; }
    .tl-dot-investigating { background: #7c3aed; }
    .tl-dot-resolved      { background: #22c55e; }
    .tl-dot-dismissed     { background: #94a3b8; }
    .tl-connector {
      width: 30px;
      height: 2px;
      background: var(--surface-border, #dee2e6);
    }
    .tl-content {
      display: flex;
      flex-direction: column;
    }
    .tl-label { font-size: 11px; font-weight: 600; color: var(--text-color, #333); }
    .tl-date  { font-size: 10px; color: var(--text-color-secondary, #94a3b8); }

    /* ── Related Events ── */
    .related-events {
      padding: 8px 16px;
      border-top: 1px solid var(--surface-border, #dee2e6);
      font-size: 12px;
      color: var(--text-color-secondary, #64748b);
    }
    .related-label { font-weight: 600; margin-right: 4px; }

    /* ── Card Actions ── */
    .incident-actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--surface-border, #dee2e6);
      background: var(--surface-ground, #f8f9fa);
    }

    /* ── Dialog ── */
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .dialog-panel {
      background: var(--surface-card, #fff);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      width: 480px;
      max-width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--surface-border, #dee2e6);
    }
    .dialog-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color, #1e293b);
    }
    .dialog-body { padding: 20px; }
    .dialog-incident-title {
      margin: 0 0 12px;
      font-weight: 600;
      color: var(--text-color, #333);
    }
    .dialog-textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      margin-top: 6px;
    }
    .dialog-textarea:focus {
      outline: 2px solid var(--primary-color, #3b82f6);
      outline-offset: -1px;
    }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid var(--surface-border, #dee2e6);
    }

    /* ── Pagination ── */
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
    }
    .pagination-info { font-size: 13px; color: var(--text-color-secondary, #64748b); }
    .pagination-controls { display: flex; align-items: center; gap: 8px; }
    .page-indicator { font-size: 13px; font-weight: 600; color: var(--text-color, #333); }

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
    .btn-success {
      background: #22c55e;
      color: #fff;
      border-color: #22c55e;
    }
    .btn-success:hover { filter: brightness(1.1); }
    .btn-warning {
      background: #f97316;
      color: #fff;
      border-color: #f97316;
    }
    .btn-warning:hover { filter: brightness(1.1); }
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
export class SecurityIncidentsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/audit/incidents';

  /** Reference data */
  readonly severities: IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  readonly statuses: IncidentStatus[] = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'];

  /** State */
  loading = false;
  error: string | null = null;
  incidents: SecurityIncident[] = [];
  summary: IncidentSummary | null = null;
  summaryError: string | null = null;

  /** Pagination */
  currentPage = 1;
  pageSize = 12;
  totalRecords = 0;
  totalPages = 0;

  /** Filters */
  filters = {
    severity: '' as string,
    status: '' as string,
    from: '' as string,
    to: '' as string,
  };

  /** Dialog state */
  dialog: ActionDialogState = {
    visible: false,
    type: null,
    incident: null,
    notes: '',
    submitting: false,
  };

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadIncidents();
    this.loadSummary();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load incidents from the API. */
  loadIncidents(): void {
    this.loading = true;
    this.error = null;

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('size', this.pageSize.toString());

    if (this.filters.severity) params = params.set('severity', this.filters.severity);
    if (this.filters.status)   params = params.set('status', this.filters.status);
    if (this.filters.from)     params = params.set('from', this.filters.from);
    if (this.filters.to)       params = params.set('to', this.filters.to);

    this.http
      .get<ApiResponse<{ content: SecurityIncident[]; meta: PaginationMeta }>>(this.apiUrl, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.incidents = response.data.content;
          this.totalRecords = response.data.meta.totalElements;
          this.totalPages = response.data.meta.totalPages;
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.error?.message || 'Failed to load security incidents';
          this.loading = false;
        },
      });
  }

  /** Load summary statistics. */
  loadSummary(): void {
    this.summary = null;
    this.summaryError = null;

    this.http
      .get<ApiResponse<IncidentSummary>>(`${this.apiUrl}/summary`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.summary = response.data;
        },
        error: (err) => {
          this.summaryError = err?.error?.error?.message || 'Failed to load summary';
        },
      });
  }

  /** Handle filter change. */
  onFilterChange(): void {
    this.currentPage = 1;
    this.loadIncidents();
  }

  /** Clear all filters. */
  clearFilters(): void {
    this.filters = { severity: '', status: '', from: '', to: '' };
    this.onFilterChange();
  }

  /** Navigate to a page. */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadIncidents();
  }

  /** Track by function. */
  trackById(_index: number, item: SecurityIncident): string {
    return item.id;
  }

  /** Open the action dialog. */
  openActionDialog(type: 'investigate' | 'resolve' | 'dismiss', incident: SecurityIncident): void {
    this.dialog = {
      visible: true,
      type,
      incident,
      notes: '',
      submitting: false,
    };
  }

  /** Close the action dialog. */
  closeDialog(): void {
    this.dialog = {
      visible: false,
      type: null,
      incident: null,
      notes: '',
      submitting: false,
    };
  }

  /** Get dialog title based on type. */
  getDialogTitle(): string {
    switch (this.dialog.type) {
      case 'investigate': return 'Start Investigation';
      case 'resolve':     return 'Resolve Incident';
      case 'dismiss':     return 'Dismiss Incident';
      default:            return '';
    }
  }

  /** Submit the action (investigate/resolve/dismiss). */
  submitAction(): void {
    if (!this.dialog.incident || !this.dialog.type) return;
    this.dialog.submitting = true;

    const statusMap: Record<string, IncidentStatus> = {
      investigate: 'INVESTIGATING',
      resolve: 'RESOLVED',
      dismiss: 'DISMISSED',
    };

    const body: any = {
      status: statusMap[this.dialog.type],
      notes: this.dialog.notes.trim(),
    };

    if (this.dialog.type === 'resolve') {
      body.resolvedAt = new Date().toISOString();
    }

    this.http
      .put<ApiResponse<SecurityIncident>>(
        `${this.apiUrl}/${this.dialog.incident.id}`,
        body,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Update the incident in the local list
          const idx = this.incidents.findIndex(i => i.id === this.dialog.incident!.id);
          if (idx !== -1) {
            this.incidents[idx] = response.data;
          }
          this.closeDialog();
          this.loadSummary();
        },
        error: () => {
          this.dialog.submitting = false;
        },
      });
  }
}
