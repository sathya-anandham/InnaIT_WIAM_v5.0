import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TenantService, TenantBranding, ToastService, OfflineService, ThemingService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';
import { Observable, Subject, takeUntil } from 'rxjs';

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
    <div class="login-app" role="main">
      <div class="branding-header" *ngIf="branding$ | async as branding">
        <img *ngIf="branding.logoUrl" [src]="branding.logoUrl" [alt]="branding.tenantName + ' logo'" class="tenant-logo" />
        <span class="tenant-name">{{ branding.tenantName }}</span>
      </div>
      <router-outlet />
    </div>
  `,
  styles: [`
    .login-app {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 2rem 1rem;
    }
    .branding-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .tenant-logo { height: 40px; width: auto; }
    .tenant-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--innait-primary);
    }
    .offline-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: var(--innait-danger, #f44336);
      color: #fff;
      text-align: center;
      padding: 0.5rem;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  branding$!: Observable<TenantBranding | null>;
  isOffline = false;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly tenantService: TenantService,
    private readonly toastService: ToastService,
    private readonly messageService: MessageService,
    private readonly offlineService: OfflineService,
    private readonly themingService: ThemingService,
  ) {}

  ngOnInit(): void {
    this.toastService.register(this.messageService);
    this.tenantService.resolveFromUrl();
    this.branding$ = this.tenantService.branding;

    this.offlineService.isOnline
      .pipe(takeUntil(this.destroy$))
      .subscribe((online) => (this.isOffline = !online));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
