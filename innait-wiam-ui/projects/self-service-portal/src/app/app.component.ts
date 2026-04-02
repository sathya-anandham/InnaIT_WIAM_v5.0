import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TenantService, ToastService, OfflineService, IdleService, ThemingService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ToastModule, TranslatePipe],
  template: `
    <p-toast position="top-right" />
    <div class="offline-banner" *ngIf="isOffline" role="alert">
      <i class="pi pi-wifi"></i>
      {{ 'error.offline' | translate }}
    </div>
    <div class="idle-warning" *ngIf="idleWarning" role="alertdialog" aria-modal="true">
      <div class="idle-dialog">
        <h3>{{ 'idle.warning' | translate }}</h3>
        <p>{{ 'idle.warningMsg' | translate: { seconds: idleRemainingSeconds.toString() } }}</p>
        <div class="idle-actions">
          <button class="btn-primary" (click)="extendSession()">{{ 'idle.stayLoggedIn' | translate }}</button>
          <button class="btn-secondary" (click)="logoutNow()">{{ 'idle.logoutNow' | translate }}</button>
        </div>
      </div>
    </div>
    <router-outlet />
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .offline-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: var(--innait-danger, #f44336); color: #fff;
      text-align: center; padding: 0.5rem; font-size: 0.875rem;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }
    .idle-warning {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center;
    }
    .idle-dialog {
      background: var(--innait-surface, #fff); border-radius: 8px;
      padding: 2rem; max-width: 400px; width: 90%; text-align: center;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    }
    .idle-dialog h3 { margin: 0 0 0.75rem; color: var(--innait-warning, #ff9800); }
    .idle-dialog p { margin: 0 0 1.5rem; color: var(--innait-text-secondary); }
    .idle-actions { display: flex; gap: 0.75rem; justify-content: center; }
    .btn-primary {
      padding: 0.5rem 1.5rem; border-radius: 6px; border: none; cursor: pointer;
      background: var(--innait-primary, #1976d2); color: #fff; font-weight: 600;
    }
    .btn-secondary {
      padding: 0.5rem 1.5rem; border-radius: 6px; border: 1px solid #ccc; cursor: pointer;
      background: transparent; color: var(--innait-text); font-weight: 600;
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  isOffline = false;
  idleWarning = false;
  idleRemainingSeconds = 0;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly tenantService: TenantService,
    private readonly toastService: ToastService,
    private readonly messageService: MessageService,
    private readonly offlineService: OfflineService,
    private readonly idleService: IdleService,
    private readonly themingService: ThemingService,
  ) {}

  ngOnInit(): void {
    this.toastService.register(this.messageService);
    this.tenantService.resolveFromUrl();

    this.offlineService.isOnline
      .pipe(takeUntil(this.destroy$))
      .subscribe((online) => (this.isOffline = !online));

    this.idleService.idleState
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.idleWarning = state.warning;
        this.idleRemainingSeconds = state.remainingSeconds;
      });

    this.idleService.start();
  }

  extendSession(): void {
    this.idleService.extend();
  }

  logoutNow(): void {
    this.idleService.stop();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.idleService.stop();
  }
}
