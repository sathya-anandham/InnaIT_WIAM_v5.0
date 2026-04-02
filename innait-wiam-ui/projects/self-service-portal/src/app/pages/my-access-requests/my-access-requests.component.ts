import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { AuthService, ApiResponse, PaginationMeta } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { PaginatorModule } from 'primeng/paginator';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

interface AccessRequest {
  id: string;
  requestType: 'ROLE' | 'GROUP' | 'ENTITLEMENT';
  resourceName: string;
  status: RequestStatus;
  justification: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface PaginatedAccessRequests {
  content: AccessRequest[];
  meta: PaginationMeta;
}

interface StatusOption {
  label: string;
  value: RequestStatus | '';
}

@Component({
  selector: 'app-my-access-requests',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    TableModule,
    TagModule,
    DropdownModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    PaginatorModule,
    TranslatePipe,
  ],
  template: `
    <div class="my-access-requests" role="region" aria-label="My Access Requests">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <div class="header-row">
              <h2>{{ 'access.myRequests.title' | translate }}</h2>
              <a
                pButton
                [label]="'access.myRequests.newRequest' | translate"
                icon="pi pi-plus"
                class="p-button-sm"
                routerLink="/access-request"
                aria-label="Submit new access request">
              </a>
            </div>
          </div>
        </ng-template>

        <!-- Filter Bar -->
        <div class="filter-bar" role="search" aria-label="Filter access requests">
          <div class="filter-field">
            <label for="statusFilter" class="sr-only">{{ 'access.myRequests.filterByStatus' | translate }}</label>
            <p-dropdown
              id="statusFilter"
              [options]="statusOptions"
              [(ngModel)]="selectedStatus"
              optionLabel="label"
              optionValue="value"
              [placeholder]="'access.myRequests.filterByStatus' | translate"
              [showClear]="true"
              (onChange)="onStatusFilterChange()"
              [style]="{ minWidth: '200px' }"
              aria-label="Filter by request status">
            </p-dropdown>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading requests">
          <p-progressSpinner strokeWidth="3" aria-label="Loading"></p-progressSpinner>
          <p>{{ 'common.loading' | translate }}</p>
        </div>

        <!-- Error State -->
        <p-message
          *ngIf="errorMessage && !loading"
          severity="error"
          [text]="errorMessage"
          [closable]="true"
          (onClose)="errorMessage = ''"
          role="alert">
        </p-message>

        <!-- Empty State -->
        <div *ngIf="!loading && !errorMessage && requests.length === 0" class="empty-state" role="status">
          <i class="pi pi-inbox empty-icon" aria-hidden="true"></i>
          <h3>{{ 'access.myRequests.empty.title' | translate }}</h3>
          <p>{{ 'access.myRequests.empty.message' | translate }}</p>
          <a
            pButton
            [label]="'access.myRequests.empty.createRequest' | translate"
            icon="pi pi-plus"
            routerLink="/access-request"
            aria-label="Submit new access request">
          </a>
        </div>

        <!-- Table -->
        <p-table
          *ngIf="!loading && !errorMessage && requests.length > 0"
          [value]="requests"
          [rowHover]="true"
          dataKey="id"
          [expandedRowKeys]="expandedRows"
          aria-label="Access requests table"
          styleClass="p-datatable-sm">

          <ng-template pTemplate="header">
            <tr>
              <th style="width: 3rem" aria-label="Expand row"></th>
              <th>{{ 'access.myRequests.table.requestType' | translate }}</th>
              <th>{{ 'access.myRequests.table.resourceName' | translate }}</th>
              <th>{{ 'access.myRequests.table.status' | translate }}</th>
              <th>{{ 'access.myRequests.table.submittedAt' | translate }}</th>
              <th style="width: 10rem">{{ 'access.myRequests.table.actions' | translate }}</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-request let-expanded="expanded">
            <tr>
              <td>
                <button
                  pButton
                  type="button"
                  [icon]="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                  class="p-button-text p-button-rounded p-button-sm"
                  [pRowToggler]="request"
                  [attr.aria-expanded]="expanded"
                  [attr.aria-label]="expanded ? 'Collapse details' : 'Expand details'">
                </button>
              </td>
              <td>
                <p-tag
                  [value]="request.requestType"
                  [severity]="getTypeSeverity(request.requestType)"
                  [rounded]="true">
                </p-tag>
              </td>
              <td>{{ request.resourceName }}</td>
              <td>
                <p-tag
                  [value]="request.status"
                  [severity]="getStatusSeverity(request.status)"
                  [rounded]="true">
                </p-tag>
              </td>
              <td>{{ request.submittedAt | date:'medium' }}</td>
              <td>
                <button
                  *ngIf="request.status === 'PENDING'"
                  pButton
                  type="button"
                  [label]="'access.myRequests.table.cancel' | translate"
                  icon="pi pi-times"
                  class="p-button-danger p-button-text p-button-sm"
                  (click)="cancelRequest(request)"
                  [loading]="cancellingId === request.id"
                  [disabled]="cancellingId === request.id"
                  [attr.aria-label]="'Cancel request ' + request.id">
                </button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="rowexpansion" let-request>
            <tr>
              <td colspan="6">
                <div class="request-details" role="region" [attr.aria-label]="'Details for request ' + request.id">
                  <div class="details-grid">
                    <div class="detail-item">
                      <span class="detail-label">{{ 'access.myRequests.details.justification' | translate }}</span>
                      <p class="detail-value">{{ request.justification }}</p>
                    </div>

                    <div class="detail-item" *ngIf="request.reviewerNotes">
                      <span class="detail-label">{{ 'access.myRequests.details.reviewerNotes' | translate }}</span>
                      <p class="detail-value">{{ request.reviewerNotes }}</p>
                    </div>

                    <div class="detail-item" *ngIf="request.reviewedAt">
                      <span class="detail-label">{{ 'access.myRequests.details.reviewedAt' | translate }}</span>
                      <p class="detail-value">{{ request.reviewedAt | date:'medium' }}</p>
                    </div>

                    <div class="detail-item" *ngIf="request.startDate">
                      <span class="detail-label">{{ 'access.myRequests.details.startDate' | translate }}</span>
                      <p class="detail-value">{{ request.startDate | date:'mediumDate' }}</p>
                    </div>

                    <div class="detail-item" *ngIf="request.endDate">
                      <span class="detail-label">{{ 'access.myRequests.details.endDate' | translate }}</span>
                      <p class="detail-value">{{ request.endDate | date:'mediumDate' }}</p>
                    </div>

                    <div class="detail-item">
                      <span class="detail-label">{{ 'access.myRequests.details.requestId' | translate }}</span>
                      <p class="detail-value detail-id">{{ request.id }}</p>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>

        <!-- Paginator -->
        <p-paginator
          *ngIf="!loading && totalRecords > pageSize"
          [rows]="pageSize"
          [totalRecords]="totalRecords"
          [first]="currentPage * pageSize"
          [rowsPerPageOptions]="[10, 20, 50]"
          (onPageChange)="onPageChange($event)"
          aria-label="Access requests pagination">
        </p-paginator>

        <!-- Cancel Success -->
        <p-message
          *ngIf="successMessage"
          severity="success"
          [text]="successMessage"
          [closable]="true"
          (onClose)="successMessage = ''"
          role="alert">
        </p-message>
      </p-card>
    </div>
  `,
  styles: [`
    .my-access-requests {
      max-width: 960px;
      margin: 0 auto;
    }

    .card-header {
      padding: 1.25rem 1.5rem 0;
    }

    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .header-row h2 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--innait-text);
    }

    .filter-bar {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .filter-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2rem 0;
      color: var(--innait-text-secondary);
    }

    .empty-state {
      text-align: center;
      padding: 2rem 0;
    }

    .empty-icon {
      font-size: 3rem;
      color: var(--innait-text-secondary);
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      font-size: 1.25rem;
      color: var(--innait-text);
      margin: 0 0 0.5rem;
    }

    .empty-state p {
      color: var(--innait-text-secondary);
      margin: 0 0 1.5rem;
    }

    .request-details {
      padding: 1rem 1.5rem;
      background: var(--innait-bg);
      border-radius: 6px;
      margin: 0.5rem 0;
    }

    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 768px) {
      .details-grid {
        grid-template-columns: 1fr;
      }
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .detail-item:first-child {
      grid-column: 1 / -1;
    }

    .detail-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--innait-text-secondary);
    }

    .detail-value {
      font-size: 0.875rem;
      color: var(--innait-text);
      margin: 0;
      line-height: 1.5;
    }

    .detail-id {
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      vertical-align: middle;
    }

    :host ::ng-deep .p-message {
      width: 100%;
      margin-top: 1rem;
    }

    :host ::ng-deep .p-paginator {
      border: none;
      padding: 1rem 0 0;
    }
  `],
})
export class MyAccessRequestsComponent implements OnInit, OnDestroy {
  requests: AccessRequest[] = [];
  expandedRows: { [key: string]: boolean } = {};
  loading = false;
  errorMessage = '';
  successMessage = '';

  currentPage = 0;
  pageSize = 20;
  totalRecords = 0;

  selectedStatus: RequestStatus | '' = '';
  cancellingId: string | null = null;

  statusOptions: StatusOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'Expired', value: 'EXPIRED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];

  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/access-requests';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRequests(): void {
    this.loading = true;
    this.errorMessage = '';

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('size', this.pageSize.toString());

    if (this.selectedStatus) {
      params = params.set('status', this.selectedStatus);
    }

    this.http.get<PaginatedAccessRequests>(this.API_BASE, { params })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false),
      )
      .subscribe({
        next: (response) => {
          this.requests = response.content;
          this.totalRecords = response.meta.totalElements;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load access requests. Please try again.';
        },
      });
  }

  onPageChange(event: { page: number; rows: number; first: number }): void {
    this.currentPage = event.page;
    this.pageSize = event.rows;
    this.loadRequests();
  }

  onStatusFilterChange(): void {
    this.currentPage = 0;
    this.loadRequests();
  }

  cancelRequest(request: AccessRequest): void {
    this.cancellingId = request.id;
    this.successMessage = '';

    this.http.post<void>(`${this.API_BASE}/${request.id}/cancel`, {})
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cancellingId = null),
      )
      .subscribe({
        next: () => {
          this.successMessage = `Request ${request.id} has been cancelled successfully.`;
          this.loadRequests();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to cancel request. Please try again.';
        },
      });
  }

  getStatusSeverity(status: RequestStatus): string {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      case 'EXPIRED':
      case 'CANCELLED':
        return 'secondary';
      default:
        return 'info';
    }
  }

  getTypeSeverity(type: string): string {
    switch (type) {
      case 'ROLE':
        return 'info';
      case 'GROUP':
        return 'success';
      case 'ENTITLEMENT':
        return 'warning';
      default:
        return 'info';
    }
  }
}
