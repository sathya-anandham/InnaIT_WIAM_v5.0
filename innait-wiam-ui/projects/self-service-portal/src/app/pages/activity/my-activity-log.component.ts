import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs';

import { ApiResponse, PaginationMeta, AuditEvent } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { PaginatorModule } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';

interface EventTypeOption {
  label: string;
  value: string;
}

interface OutcomeOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-my-activity-log',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    TableModule,
    TagModule,
    DropdownModule,
    CalendarModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    PaginatorModule,
    TooltipModule,
    TranslatePipe,
  ],
  template: `
    <div class="my-activity-log" role="region" aria-label="Personal Activity Log">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <div class="header-left">
              <h2>{{ 'activity.title' | translate }}</h2>
              <span *ngIf="pagination" class="record-count" aria-live="polite">
                {{ pagination.totalElements }} {{ 'activity.totalRecords' | translate }}
              </span>
            </div>
            <div class="header-actions">
              <button
                pButton
                type="button"
                class="p-button-text p-button-sm"
                icon="pi pi-refresh"
                [label]="'common.refresh' | translate"
                (click)="loadActivity()"
                [loading]="loading"
                aria-label="Refresh activity log">
              </button>
              <button
                pButton
                type="button"
                class="p-button-outlined p-button-sm"
                icon="pi pi-download"
                [label]="'activity.exportCsv' | translate"
                (click)="exportCsv()"
                [disabled]="loading || events.length === 0"
                aria-label="Export activity as CSV">
              </button>
            </div>
          </div>
        </ng-template>

        <!-- Filters -->
        <div class="filters-section" role="search" aria-label="Activity log filters">
          <form [formGroup]="filterForm" class="filters-grid">
            <div class="filter-field">
              <label for="filter-event-type">{{ 'activity.filters.eventType' | translate }}</label>
              <p-dropdown
                id="filter-event-type"
                [options]="eventTypeOptions"
                formControlName="eventType"
                [placeholder]="'activity.filters.allEventTypes' | translate"
                [showClear]="true"
                appendTo="body"
                aria-label="Filter by event type">
              </p-dropdown>
            </div>

            <div class="filter-field">
              <label for="filter-outcome">{{ 'activity.filters.outcome' | translate }}</label>
              <p-dropdown
                id="filter-outcome"
                [options]="outcomeOptions"
                formControlName="outcome"
                [placeholder]="'activity.filters.allOutcomes' | translate"
                [showClear]="true"
                appendTo="body"
                aria-label="Filter by outcome">
              </p-dropdown>
            </div>

            <div class="filter-field">
              <label for="filter-from-date">{{ 'activity.filters.fromDate' | translate }}</label>
              <p-calendar
                id="filter-from-date"
                formControlName="fromDate"
                [showIcon]="true"
                [maxDate]="filterForm.get('toDate')?.value || today"
                dateFormat="yy-mm-dd"
                [placeholder]="'activity.filters.selectDate' | translate"
                appendTo="body"
                aria-label="Filter from date">
              </p-calendar>
            </div>

            <div class="filter-field">
              <label for="filter-to-date">{{ 'activity.filters.toDate' | translate }}</label>
              <p-calendar
                id="filter-to-date"
                formControlName="toDate"
                [showIcon]="true"
                [minDate]="filterForm.get('fromDate')?.value"
                [maxDate]="today"
                dateFormat="yy-mm-dd"
                [placeholder]="'activity.filters.selectDate' | translate"
                appendTo="body"
                aria-label="Filter to date">
              </p-calendar>
            </div>

            <div class="filter-actions">
              <button
                pButton
                type="button"
                class="p-button-text p-button-sm"
                icon="pi pi-filter-slash"
                [label]="'activity.filters.clearAll' | translate"
                (click)="clearFilters()"
                aria-label="Clear all filters">
              </button>
            </div>
          </form>
        </div>

        <!-- Loading state -->
        <div *ngIf="loading" class="loading-container">
          <p-progressSpinner
            strokeWidth="3"
            aria-label="Loading activity log">
          </p-progressSpinner>
          <p>{{ 'activity.loading' | translate }}</p>
        </div>

        <!-- Error state -->
        <p-message
          *ngIf="errorMessage && !loading"
          severity="error"
          [text]="errorMessage"
          (onClose)="errorMessage = ''"
          role="alert">
        </p-message>

        <!-- Activity table -->
        <p-table
          *ngIf="!loading"
          [value]="events"
          [responsive]="true"
          [breakpoint]="'768px'"
          styleClass="p-datatable-sm"
          aria-label="Activity log table">

          <ng-template pTemplate="header">
            <tr>
              <th scope="col">{{ 'activity.columns.eventType' | translate }}</th>
              <th scope="col">{{ 'activity.columns.outcome' | translate }}</th>
              <th scope="col">{{ 'activity.columns.ipAddress' | translate }}</th>
              <th scope="col">{{ 'activity.columns.timestamp' | translate }}</th>
              <th scope="col">{{ 'activity.columns.details' | translate }}</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-event>
            <tr>
              <td>
                <div class="event-type-cell">
                  <i class="pi" [ngClass]="getEventIcon(event.eventType)" aria-hidden="true"></i>
                  <span>{{ formatEventType(event.eventType) }}</span>
                </div>
              </td>
              <td>
                <p-tag
                  [value]="event.outcome"
                  [severity]="event.outcome === 'SUCCESS' ? 'success' : 'danger'"
                  [rounded]="true">
                </p-tag>
              </td>
              <td>
                <code class="ip-address">{{ event.ipAddress }}</code>
              </td>
              <td>
                {{ event.timestamp | date:'medium' }}
              </td>
              <td>
                <div *ngIf="event.details && hasDetails(event.details)" class="details-cell">
                  <button
                    pButton
                    type="button"
                    class="p-button-text p-button-sm"
                    icon="pi pi-info-circle"
                    (click)="toggleDetails(event.id)"
                    [attr.aria-expanded]="expandedEventId === event.id"
                    [attr.aria-label]="'Toggle details for event ' + formatEventType(event.eventType)">
                  </button>
                </div>
                <span *ngIf="!event.details || !hasDetails(event.details)" class="no-details">
                  --
                </span>
              </td>
            </tr>
            <!-- Expanded details row -->
            <tr *ngIf="expandedEventId === event.id && event.details" class="details-row">
              <td colspan="5">
                <div class="details-content" role="region" [attr.aria-label]="'Details for ' + formatEventType(event.eventType)">
                  <div *ngFor="let entry of getDetailsEntries(event.details)" class="detail-entry">
                    <span class="detail-key">{{ entry.key }}:</span>
                    <span class="detail-value">{{ entry.value }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="5" class="empty-message">
                {{ 'activity.noRecords' | translate }}
              </td>
            </tr>
          </ng-template>
        </p-table>

        <!-- Paginator -->
        <p-paginator
          *ngIf="pagination && pagination.totalElements > 0"
          [rows]="pagination.size"
          [totalRecords]="pagination.totalElements"
          [first]="pagination.page * pagination.size"
          [rowsPerPageOptions]="[10, 20, 50]"
          (onPageChange)="onPageChange($event)"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} events"
          aria-label="Activity log pagination">
        </p-paginator>
      </p-card>
    </div>
  `,
  styles: [`
    .my-activity-log {
      max-width: 1100px;
      margin: 0 auto;
    }

    .card-header {
      padding: 1.25rem 1.5rem 0;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .card-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--innait-text);
    }

    .record-count {
      font-size: 0.85rem;
      color: var(--innait-text-secondary);
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    /* Filters */
    .filters-section {
      padding: 1rem 0;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
      align-items: end;
    }

    .filter-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .filter-field label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--innait-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .filter-field :host ::ng-deep .p-dropdown,
    .filter-field :host ::ng-deep .p-calendar {
      width: 100%;
    }

    .filter-actions {
      display: flex;
      align-items: flex-end;
    }

    /* Loading */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 3rem 0;
      color: var(--innait-text-secondary);
    }

    /* Table styles */
    .event-type-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .event-type-cell .pi {
      font-size: 1rem;
      color: var(--innait-text-secondary);
    }

    .ip-address {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      background: var(--innait-bg);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
    }

    .details-cell {
      display: flex;
      align-items: center;
    }

    .no-details {
      color: var(--innait-text-secondary);
      font-size: 0.85rem;
    }

    .details-row td {
      background: var(--innait-bg) !important;
      padding: 0 !important;
    }

    .details-content {
      padding: 0.75rem 1rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
    }

    .detail-entry {
      display: flex;
      gap: 0.375rem;
      font-size: 0.85rem;
    }

    .detail-key {
      font-weight: 600;
      color: var(--innait-text-secondary);
      white-space: nowrap;
    }

    .detail-value {
      color: var(--innait-text);
      word-break: break-all;
    }

    .empty-message {
      text-align: center;
      padding: 2rem 0 !important;
      color: var(--innait-text-secondary);
    }

    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--innait-text-secondary);
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      font-size: 0.875rem;
      vertical-align: middle;
    }

    :host ::ng-deep .p-paginator {
      padding: 0.75rem 0;
      border: none;
    }

    @media (max-width: 768px) {
      .card-header {
        flex-direction: column;
      }

      .filters-grid {
        grid-template-columns: 1fr;
      }

      .header-actions {
        width: 100%;
      }
    }
  `],
})
export class MyActivityLogComponent implements OnInit, OnDestroy {
  events: AuditEvent[] = [];
  pagination: PaginationMeta | null = null;
  loading = false;
  errorMessage = '';
  expandedEventId: string | null = null;
  today = new Date();

  filterForm!: FormGroup;

  eventTypeOptions: EventTypeOption[] = [
    { label: 'Login Success', value: 'LOGIN_SUCCESS' },
    { label: 'Login Failure', value: 'LOGIN_FAILURE' },
    { label: 'Password Change', value: 'PASSWORD_CHANGE' },
    { label: 'MFA Enroll', value: 'MFA_ENROLL' },
    { label: 'Session Revoke', value: 'SESSION_REVOKE' },
    { label: 'Profile Update', value: 'PROFILE_UPDATE' },
  ];

  outcomeOptions: OutcomeOption[] = [
    { label: 'Success', value: 'SUCCESS' },
    { label: 'Failure', value: 'FAILURE' },
  ];

  private currentPage = 0;
  private currentSize = 20;
  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/activity';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      eventType: [null],
      outcome: [null],
      fromDate: [null],
      toDate: [null],
    });

    this.filterForm.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(400),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadActivity();
    });

    this.loadActivity();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadActivity(): void {
    this.loading = true;
    this.errorMessage = '';

    const params = this.buildParams();

    this.http.get<ApiResponse<AuditEvent[]>>(this.API_BASE, { params })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false),
      )
      .subscribe({
        next: (response) => {
          this.events = response.data;
          this.pagination = response.meta ?? null;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load activity log.';
        },
      });
  }

  onPageChange(event: { first?: number; rows?: number; page?: number }): void {
    this.currentPage = event.page ?? 0;
    this.currentSize = event.rows ?? 20;
    this.loadActivity();
  }

  clearFilters(): void {
    this.filterForm.reset();
  }

  toggleDetails(eventId: string): void {
    this.expandedEventId = this.expandedEventId === eventId ? null : eventId;
  }

  hasDetails(details: Record<string, string>): boolean {
    return details != null && Object.keys(details).length > 0;
  }

  getDetailsEntries(details: Record<string, string>): { key: string; value: string }[] {
    if (!details) return [];
    return Object.entries(details).map(([key, value]) => ({ key, value }));
  }

  formatEventType(type: string): string {
    if (!type) return '';
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  getEventIcon(eventType: string): string {
    if (!eventType) return 'pi-circle';
    const iconMap: Record<string, string> = {
      LOGIN_SUCCESS: 'pi-sign-in',
      LOGIN_FAILURE: 'pi-exclamation-triangle',
      PASSWORD_CHANGE: 'pi-lock',
      MFA_ENROLL: 'pi-shield',
      SESSION_REVOKE: 'pi-sign-out',
      PROFILE_UPDATE: 'pi-user-edit',
    };
    return iconMap[eventType] ?? 'pi-circle';
  }

  exportCsv(): void {
    const headers = ['Event Type', 'Outcome', 'IP Address', 'Timestamp', 'Details'];
    const rows = this.events.map(event => [
      this.formatEventType(event.eventType),
      event.outcome,
      event.ipAddress,
      event.timestamp,
      event.details ? JSON.stringify(event.details) : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `innait-wiam-activity-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private buildParams(): HttpParams {
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('size', this.currentSize.toString());

    const filters = this.filterForm.value;

    if (filters.eventType) {
      params = params.set('eventType', filters.eventType);
    }

    if (filters.outcome) {
      params = params.set('outcome', filters.outcome);
    }

    if (filters.fromDate) {
      const fromDate = filters.fromDate as Date;
      params = params.set('from', fromDate.toISOString());
    }

    if (filters.toDate) {
      const toDate = filters.toDate as Date;
      params = params.set('to', toDate.toISOString());
    }

    return params;
  }
}
