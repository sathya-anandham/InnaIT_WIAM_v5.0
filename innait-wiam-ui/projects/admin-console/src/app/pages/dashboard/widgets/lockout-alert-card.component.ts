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

interface LockedAccount {
  accountId: string;
  loginId: string;
  lockedAt: string;
  failedAttempts: number;
}

interface LockedAccountsData {
  accounts: LockedAccount[];
}

@Component({
  selector: 'app-lockout-alert-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <h3>{{ 'dashboard.lockoutAlert.title' | translate }}</h3>
        <span
          *ngIf="lockedAccounts.length > 0"
          class="count-badge"
        >
          {{ lockedAccounts.length }}
        </span>
      </div>
      <div class="widget-body">
        <!-- Skeleton Loader -->
        <div *ngIf="loading" class="skeleton-container">
          <div
            class="skeleton-row"
            *ngFor="let i of [1, 2, 3]"
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

        <!-- Empty State -->
        <div
          *ngIf="!loading && !error && lockedAccounts.length === 0"
          class="empty-state"
        >
          <i class="pi pi-check-circle"></i>
          <span>{{ 'dashboard.lockoutAlert.noLocked' | translate }}</span>
        </div>

        <!-- Locked Accounts List -->
        <div
          *ngIf="!loading && !error && lockedAccounts.length > 0"
          class="lockout-list"
        >
          <div
            *ngFor="let account of lockedAccounts"
            class="lockout-item"
          >
            <div class="lockout-info">
              <div class="lockout-login">
                <i class="pi pi-user"></i>
                {{ account.loginId }}
              </div>
              <div class="lockout-meta">
                <span class="lockout-time">
                  <i class="pi pi-clock"></i>
                  {{ formatLockedTime(account.lockedAt) }}
                </span>
                <span class="lockout-attempts">
                  {{ account.failedAttempts }}
                  {{ 'dashboard.lockoutAlert.failedAttempts' | translate }}
                </span>
              </div>
            </div>
            <button
              class="unlock-btn"
              (click)="unlockAccount(account)"
              [disabled]="unlockingIds.has(account.accountId)"
            >
              <i
                class="pi"
                [ngClass]="{
                  'pi-spin pi-spinner': unlockingIds.has(account.accountId),
                  'pi-lock-open': !unlockingIds.has(account.accountId)
                }"
              ></i>
              {{ 'dashboard.lockoutAlert.unlock' | translate }}
            </button>
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
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .widget-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-color, #333);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .count-badge {
        background: #ef4444;
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 10px;
        min-width: 22px;
        text-align: center;
      }
      .widget-body {
        padding: 0;
        flex: 1;
        overflow: hidden;
      }
      .lockout-list {
        max-height: 400px;
        overflow-y: auto;
      }
      .lockout-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 20px;
        border-bottom: 1px solid var(--surface-border, #dee2e6);
        transition: background 0.15s ease;
      }
      .lockout-item:last-child {
        border-bottom: none;
      }
      .lockout-item:hover {
        background: var(--surface-ground, #f8f9fa);
      }
      .lockout-info {
        flex: 1;
        min-width: 0;
      }
      .lockout-login {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-color, #333);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .lockout-login i {
        font-size: 14px;
        color: var(--text-color-secondary, #6c757d);
      }
      .lockout-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 4px;
        font-size: 12px;
        color: var(--text-color-secondary, #6c757d);
      }
      .lockout-time {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .lockout-time i {
        font-size: 11px;
      }
      .lockout-attempts {
        color: #ef4444;
        font-weight: 600;
      }
      .unlock-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border: 1px solid var(--primary-color, #3b82f6);
        background: transparent;
        color: var(--primary-color, #3b82f6);
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        transition: all 0.15s ease;
        flex-shrink: 0;
      }
      .unlock-btn:hover:not(:disabled) {
        background: var(--primary-color, #3b82f6);
        color: #ffffff;
      }
      .unlock-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        gap: 8px;
        color: #22c55e;
      }
      .empty-state i {
        font-size: 40px;
      }
      .empty-state span {
        font-size: 14px;
        font-weight: 500;
      }
      .skeleton-container {
        padding: 12px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .skeleton-row {
        height: 52px;
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
export class LockoutAlertCardComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() refreshTrigger?: number;

  loading = true;
  error: string | null = null;
  lockedAccounts: LockedAccount[] = [];
  unlockingIds = new Set<string>();

  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/dashboard/locked-accounts';

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
      .get<ApiResponse<LockedAccountsData>>(this.apiUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.lockedAccounts = response.data.accounts;
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message || 'Failed to load locked accounts';
          this.loading = false;
        },
      });
  }

  unlockAccount(account: LockedAccount): void {
    this.unlockingIds.add(account.accountId);

    this.http
      .post<ApiResponse<void>>(
        `/api/v1/admin/accounts/${account.accountId}/unlock`,
        {}
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.unlockingIds.delete(account.accountId);
          this.lockedAccounts = this.lockedAccounts.filter(
            (a) => a.accountId !== account.accountId
          );
        },
        error: () => {
          this.unlockingIds.delete(account.accountId);
        },
      });
  }

  formatLockedTime(lockedAt: string): string {
    const now = Date.now();
    const then = new Date(lockedAt).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return new Date(lockedAt).toLocaleDateString();
  }
}
