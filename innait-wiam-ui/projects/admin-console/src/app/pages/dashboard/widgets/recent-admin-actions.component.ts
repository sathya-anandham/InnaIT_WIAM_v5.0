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
import { ApiResponse, AuditEvent } from '@innait/core';

@Component({
  selector: 'app-recent-admin-actions',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <h3>{{ 'dashboard.recentActions.title' | translate }}</h3>
      </div>
      <div class="widget-body">
        <!-- Skeleton Loader -->
        <div *ngIf="loading" class="skeleton-container">
          <div
            class="skeleton-row"
            *ngFor="let i of [1, 2, 3, 4, 5]"
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

        <!-- Actions List -->
        <div
          *ngIf="!loading && !error"
          class="actions-list"
        >
          <div
            *ngIf="actions.length === 0"
            class="empty-state"
          >
            <i class="pi pi-inbox"></i>
            <span>{{ 'dashboard.recentActions.empty' | translate }}</span>
          </div>

          <div
            *ngFor="let action of actions"
            class="action-item"
          >
            <div class="action-icon" [ngClass]="getIconClass(action.eventType)">
              <i [class]="getIcon(action.eventType)"></i>
            </div>
            <div class="action-details">
              <div class="action-type">{{ formatEventType(action.eventType) }}</div>
              <div class="action-actor">
                {{ action.actorType === 'SYSTEM' ? 'System' : action.actorId }}
              </div>
            </div>
            <div class="action-meta">
              <span
                class="outcome-badge"
                [ngClass]="{
                  'badge-success': action.outcome === 'SUCCESS',
                  'badge-failure': action.outcome === 'FAILURE'
                }"
              >
                {{ action.outcome }}
              </span>
              <span class="action-time">{{ getRelativeTime(action.timestamp) }}</span>
            </div>
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
        padding: 0;
        flex: 1;
        overflow: hidden;
      }
      .actions-list {
        max-height: 400px;
        overflow-y: auto;
      }
      .action-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        border-bottom: 1px solid var(--surface-border, #dee2e6);
        transition: background 0.15s ease;
      }
      .action-item:last-child {
        border-bottom: none;
      }
      .action-item:hover {
        background: var(--surface-ground, #f8f9fa);
      }
      .action-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 16px;
      }
      .icon-auth {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }
      .icon-user {
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
      }
      .icon-config {
        background: rgba(139, 92, 246, 0.1);
        color: #8b5cf6;
      }
      .icon-security {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }
      .icon-default {
        background: rgba(107, 114, 128, 0.1);
        color: #6b7280;
      }
      .action-details {
        flex: 1;
        min-width: 0;
      }
      .action-type {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-color, #333);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .action-actor {
        font-size: 12px;
        color: var(--text-color-secondary, #6c757d);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .action-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        flex-shrink: 0;
      }
      .outcome-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 10px;
        letter-spacing: 0.5px;
      }
      .badge-success {
        background: rgba(34, 197, 94, 0.1);
        color: #16a34a;
      }
      .badge-failure {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
      }
      .action-time {
        font-size: 11px;
        color: var(--text-color-secondary, #6c757d);
        white-space: nowrap;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        gap: 8px;
        color: var(--text-color-secondary, #6c757d);
      }
      .empty-state i {
        font-size: 32px;
        opacity: 0.5;
      }
      .skeleton-container {
        padding: 12px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .skeleton-row {
        height: 48px;
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
export class RecentAdminActionsComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() refreshTrigger?: number;

  loading = true;
  error: string | null = null;
  actions: AuditEvent[] = [];

  private readonly destroy$ = new Subject<void>();
  private readonly apiUrl = '/api/v1/admin/dashboard/recent-actions';

  private readonly eventIconMap: Record<string, { icon: string; class: string }> = {
    LOGIN: { icon: 'pi pi-sign-in', class: 'icon-auth' },
    LOGOUT: { icon: 'pi pi-sign-out', class: 'icon-auth' },
    AUTH: { icon: 'pi pi-lock', class: 'icon-auth' },
    USER_CREATE: { icon: 'pi pi-user-plus', class: 'icon-user' },
    USER_UPDATE: { icon: 'pi pi-user-edit', class: 'icon-user' },
    USER_DELETE: { icon: 'pi pi-user-minus', class: 'icon-user' },
    ACCOUNT: { icon: 'pi pi-users', class: 'icon-user' },
    CONFIG: { icon: 'pi pi-cog', class: 'icon-config' },
    POLICY: { icon: 'pi pi-shield', class: 'icon-security' },
    ROLE: { icon: 'pi pi-id-card', class: 'icon-config' },
    UNLOCK: { icon: 'pi pi-lock-open', class: 'icon-security' },
    LOCK: { icon: 'pi pi-lock', class: 'icon-security' },
    MFA: { icon: 'pi pi-key', class: 'icon-security' },
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
      .get<ApiResponse<AuditEvent[]>>(this.apiUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.actions = response.data;
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.error?.message ||
            'Failed to load recent admin actions';
          this.loading = false;
        },
      });
  }

  getIcon(eventType: string): string {
    const match = this.findEventConfig(eventType);
    return match?.icon ?? 'pi pi-circle';
  }

  getIconClass(eventType: string): string {
    const match = this.findEventConfig(eventType);
    return match?.class ?? 'icon-default';
  }

  formatEventType(eventType: string): string {
    return eventType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  getRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  }

  private findEventConfig(
    eventType: string
  ): { icon: string; class: string } | undefined {
    // Exact match first
    if (this.eventIconMap[eventType]) {
      return this.eventIconMap[eventType];
    }
    // Prefix match
    const upperType = eventType.toUpperCase();
    for (const key of Object.keys(this.eventIconMap)) {
      if (upperType.startsWith(key)) {
        return this.eventIconMap[key];
      }
    }
    return undefined;
  }
}
