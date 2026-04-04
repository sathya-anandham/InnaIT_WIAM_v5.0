import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { AuthService, Session } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-my-sessions',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TableModule,
    ButtonModule,
    TagModule,
    DialogModule,
    MessageModule,
    ProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div class="my-sessions" role="region" aria-label="Active Sessions Management">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <div class="header-left">
              <h2>{{ 'sessions.title' | translate }}</h2>
              <span *ngIf="sessions.length > 0" class="session-count" aria-live="polite">
                {{ sessions.length }} {{ 'sessions.activeSessions' | translate }}
              </span>
            </div>
            <div class="header-actions">
              <button
                pButton
                type="button"
                class="p-button-text p-button-sm"
                icon="pi pi-refresh"
                [label]="'common.refresh' | translate"
                (click)="loadSessions()"
                [loading]="loading"
                aria-label="Refresh sessions list">
              </button>
              <button
                *ngIf="otherSessions.length > 0"
                pButton
                type="button"
                class="p-button-outlined p-button-danger p-button-sm"
                icon="pi pi-sign-out"
                [label]="'sessions.revokeAllOther' | translate"
                (click)="confirmRevokeAll()"
                [disabled]="revoking"
                aria-label="Revoke all other sessions">
              </button>
            </div>
          </div>
        </ng-template>

        <!-- Loading state -->
        <div *ngIf="loading" class="loading-container">
          <p-progressSpinner
            strokeWidth="3"
            aria-label="Loading sessions">
          </p-progressSpinner>
          <p>{{ 'sessions.loading' | translate }}</p>
        </div>

        <!-- Error state -->
        <p-message
          *ngIf="errorMessage && !loading"
          severity="error"
          [text]="errorMessage"
          (onClose)="errorMessage = ''"
          role="alert">
        </p-message>

        <!-- Success message -->
        <p-message
          *ngIf="successMessage"
          severity="success"
          [text]="successMessage"
          (onClose)="successMessage = ''"
          role="status">
        </p-message>

        <!-- Sessions table -->
        <p-table
          *ngIf="!loading && sessions.length > 0"
          [value]="sessions"
          [responsive]="true"
          [breakpoint]="'768px'"
          styleClass="p-datatable-sm"
          aria-label="Active sessions table">

          <ng-template pTemplate="header">
            <tr>
              <th scope="col">{{ 'sessions.columns.device' | translate }}</th>
              <th scope="col">{{ 'sessions.columns.ipAddress' | translate }}</th>
              <th scope="col">{{ 'sessions.columns.authMethods' | translate }}</th>
              <th scope="col">{{ 'sessions.columns.createdAt' | translate }}</th>
              <th scope="col">{{ 'sessions.columns.lastActivity' | translate }}</th>
              <th scope="col">{{ 'sessions.columns.status' | translate }}</th>
              <th scope="col">{{ 'sessions.columns.actions' | translate }}</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-session>
            <tr [class.current-session-row]="isCurrentSession(session)">
              <td>
                <div class="device-cell">
                  <i class="pi" [ngClass]="getDeviceIcon(session.userAgent)" aria-hidden="true"></i>
                  <div>
                    <span class="device-name">{{ parseUserAgent(session.userAgent) }}</span>
                    <span class="device-os">{{ parseOS(session.userAgent) }}</span>
                  </div>
                  <p-tag
                    *ngIf="isCurrentSession(session)"
                    value="Current Session"
                    severity="info"
                    class="current-badge"
                    [rounded]="true">
                  </p-tag>
                </div>
              </td>
              <td>
                <code class="ip-address">{{ session.ipAddress }}</code>
              </td>
              <td>
                <span class="auth-methods">{{ session.authMethodsUsed.join(', ') }}</span>
              </td>
              <td>
                {{ session.createdAt | date:'medium' }}
              </td>
              <td>
                <span [title]="session.lastActivityAt | date:'medium'">
                  {{ getRelativeTime(session.lastActivityAt || session.createdAt) }}
                </span>
              </td>
              <td>
                <p-tag
                  [value]="session.active ? ('sessions.status.active' | translate) : ('sessions.status.expired' | translate)"
                  [severity]="session.active ? 'success' : 'danger'"
                  [rounded]="true">
                </p-tag>
              </td>
              <td>
                <button
                  *ngIf="!isCurrentSession(session)"
                  pButton
                  type="button"
                  class="p-button-outlined p-button-danger p-button-sm"
                  icon="pi pi-sign-out"
                  [label]="'sessions.revokeButton' | translate"
                  (click)="confirmRevoke(session)"
                  [disabled]="revoking"
                  [attr.aria-label]="'Revoke session from ' + parseUserAgent(session.userAgent)">
                </button>
                <span *ngIf="isCurrentSession(session)" class="current-label">
                  --
                </span>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="7" class="empty-message">
                {{ 'sessions.noSessions' | translate }}
              </td>
            </tr>
          </ng-template>
        </p-table>

        <!-- No sessions -->
        <div *ngIf="!loading && sessions.length === 0 && !errorMessage" class="empty-state">
          <i class="pi pi-desktop empty-icon" aria-hidden="true"></i>
          <p>{{ 'sessions.noSessions' | translate }}</p>
        </div>
      </p-card>

      <!-- Revoke Single Session Dialog -->
      <p-dialog
        [(visible)]="showRevokeDialog"
        [header]="'sessions.revokeDialog.title' | translate"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '420px' }"
        aria-label="Confirm session revocation">
        <div class="dialog-content">
          <p>{{ 'sessions.revokeDialog.message' | translate }}</p>
          <div *ngIf="sessionToRevoke" class="revoke-details">
            <p><strong>{{ 'sessions.columns.device' | translate }}:</strong> {{ parseUserAgent(sessionToRevoke.userAgent) }}</p>
            <p><strong>{{ 'sessions.columns.ipAddress' | translate }}:</strong> {{ sessionToRevoke.ipAddress }}</p>
          </div>
        </div>
        <div class="dialog-footer">
          <button
            pButton
            type="button"
            class="p-button-text"
            [label]="'common.cancel' | translate"
            (click)="showRevokeDialog = false"
            aria-label="Cancel">
          </button>
          <button
            pButton
            type="button"
            class="p-button-danger"
            [label]="'sessions.revokeDialog.confirmButton' | translate"
            icon="pi pi-sign-out"
            [loading]="revoking"
            [disabled]="revoking"
            (click)="revokeSession()"
            aria-label="Confirm session revocation">
          </button>
        </div>
      </p-dialog>

      <!-- Revoke All Sessions Dialog -->
      <p-dialog
        [(visible)]="showRevokeAllDialog"
        [header]="'sessions.revokeAllDialog.title' | translate"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '420px' }"
        aria-label="Confirm revocation of all other sessions">
        <div class="dialog-content">
          <p-message
            severity="warn"
            [text]="'sessions.revokeAllDialog.warning' | translate"
            role="alert">
          </p-message>
          <p class="revoke-all-message">{{ 'sessions.revokeAllDialog.message' | translate }}</p>
          <p class="revoke-all-count">
            <strong>{{ otherSessions.length }}</strong> {{ 'sessions.revokeAllDialog.sessionsCount' | translate }}
          </p>
        </div>
        <div class="dialog-footer">
          <button
            pButton
            type="button"
            class="p-button-text"
            [label]="'common.cancel' | translate"
            (click)="showRevokeAllDialog = false"
            aria-label="Cancel">
          </button>
          <button
            pButton
            type="button"
            class="p-button-danger"
            [label]="'sessions.revokeAllDialog.confirmButton' | translate"
            icon="pi pi-sign-out"
            [loading]="revoking"
            [disabled]="revoking"
            (click)="revokeAllOtherSessions()"
            aria-label="Confirm revocation of all other sessions">
          </button>
        </div>
      </p-dialog>
    </div>
  `,
  styles: [`
    .my-sessions {
      max-width: 1000px;
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

    .session-count {
      font-size: 0.85rem;
      color: var(--innait-text-secondary);
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 3rem 0;
      color: var(--innait-text-secondary);
    }

    .current-session-row {
      background: rgba(25, 118, 210, 0.04) !important;
    }

    .device-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .device-cell .pi {
      font-size: 1.25rem;
      color: var(--innait-text-secondary);
    }

    .device-name {
      display: block;
      font-weight: 500;
      font-size: 0.9rem;
    }

    .device-os {
      display: block;
      font-size: 0.8rem;
      color: var(--innait-text-secondary);
    }

    .current-badge {
      margin-left: 0.25rem;
    }

    .ip-address {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      background: var(--innait-bg);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
    }

    .auth-methods {
      font-size: 0.85rem;
      color: var(--innait-text-secondary);
    }

    .current-label {
      color: var(--innait-text-secondary);
      font-size: 0.85rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 0;
      color: var(--innait-text-secondary);
    }

    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .empty-message {
      text-align: center;
      padding: 2rem 0 !important;
      color: var(--innait-text-secondary);
    }

    /* Dialog styles */
    .dialog-content {
      padding: 0.5rem 0;
    }

    .dialog-content p {
      color: var(--innait-text-secondary);
      margin: 0 0 0.75rem;
      line-height: 1.5;
    }

    .revoke-details {
      background: var(--innait-bg);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-top: 0.75rem;
    }

    .revoke-details p {
      margin: 0.25rem 0;
      font-size: 0.875rem;
    }

    .revoke-all-message {
      margin-top: 1rem !important;
    }

    .revoke-all-count {
      font-size: 0.95rem;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
      margin-top: 1rem;
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

    @media (max-width: 768px) {
      .card-header {
        flex-direction: column;
      }

      .header-actions {
        width: 100%;
      }
    }
  `],
})
export class MySessionsComponent implements OnInit, OnDestroy {
  sessions: Session[] = [];
  loading = false;
  revoking = false;
  errorMessage = '';
  successMessage = '';

  showRevokeDialog = false;
  showRevokeAllDialog = false;
  sessionToRevoke: Session | null = null;

  private currentSessionId = '';
  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self/sessions';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    const authState = this.authService.currentState;
    this.currentSessionId = authState?.sessionId ?? '';
    this.loadSessions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get otherSessions(): Session[] {
    return this.sessions.filter(s => s.sessionId !== this.currentSessionId);
  }

  isCurrentSession(session: Session): boolean {
    return session.sessionId === this.currentSessionId;
  }

  loadSessions(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<Session[]>(this.API_BASE)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false),
      )
      .subscribe({
        next: (sessions) => {
          this.sessions = sessions.sort((a, b) => {
            if (a.sessionId === this.currentSessionId) return -1;
            if (b.sessionId === this.currentSessionId) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load sessions.';
        },
      });
  }

  confirmRevoke(session: Session): void {
    this.sessionToRevoke = session;
    this.showRevokeDialog = true;
  }

  confirmRevokeAll(): void {
    this.showRevokeAllDialog = true;
  }

  revokeSession(): void {
    if (!this.sessionToRevoke) {
      return;
    }

    this.revoking = true;
    this.errorMessage = '';

    this.http.delete(`${this.API_BASE}/${this.sessionToRevoke.sessionId}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.revoking = false;
          this.showRevokeDialog = false;
          this.sessionToRevoke = null;
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Session revoked successfully.';
          this.loadSessions();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to revoke session.';
        },
      });
  }

  revokeAllOtherSessions(): void {
    this.revoking = true;
    this.errorMessage = '';

    this.http.post(`${this.API_BASE}/revoke-all`, {})
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.revoking = false;
          this.showRevokeAllDialog = false;
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = 'All other sessions have been revoked.';
          this.loadSessions();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to revoke sessions.';
        },
      });
  }

  parseUserAgent(ua: string): string {
    if (!ua) return 'Unknown Browser';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return 'Unknown Browser';
  }

  parseOS(ua: string): string {
    if (!ua) return '';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return '';
  }

  getDeviceIcon(ua: string): string {
    if (!ua) return 'pi-desktop';
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
      return 'pi-mobile';
    }
    if (ua.includes('iPad') || ua.includes('Tablet')) {
      return 'pi-tablet';
    }
    return 'pi-desktop';
  }

  getRelativeTime(dateStr: string): string {
    if (!dateStr) return '--';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  }
}
