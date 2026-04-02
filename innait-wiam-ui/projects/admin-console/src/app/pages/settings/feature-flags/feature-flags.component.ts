import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DividerModule } from 'primeng/divider';

type FeatureCategory = 'AUTHENTICATION' | 'MFA' | 'IGA' | 'NOTIFICATIONS' | 'ADVANCED';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: FeatureCategory;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

interface CategoryGroup {
  category: FeatureCategory;
  label: string;
  icon: string;
  flags: FeatureFlag[];
}

const CRITICAL_FEATURES = ['mfa.enforcement', 'mfa.required', 'auth.lockout'];

@Component({
  selector: 'app-feature-flags',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    InputSwitchModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    DividerModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading feature flags">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'settings.features.loading' | translate }}</p>
    </div>

    <p-toast></p-toast>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="msg-banner" role="alert"></p-message>

    <div *ngIf="!loading" class="feature-flags-container">
      <!-- Header with summary and search -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">{{ 'settings.features.title' | translate }}</h2>
          <span class="summary-badge" role="status">
            {{ enabledCount }} {{ 'settings.features.of' | translate }} {{ totalCount }} {{ 'settings.features.enabled' | translate }}
          </span>
        </div>
        <div class="header-right">
          <span class="p-input-icon-left search-wrapper">
            <i class="pi pi-search"></i>
            <input pInputText [(ngModel)]="searchQuery" (ngModelChange)="onSearch()"
                   [placeholder]="'settings.features.searchPlaceholder' | translate"
                   class="search-input"
                   aria-label="Search feature flags" />
          </span>
        </div>
      </div>

      <!-- Category Groups -->
      <div *ngFor="let group of filteredGroups; trackBy: trackByCategory" class="category-group">
        <p-card styleClass="category-card">
          <ng-template pTemplate="header">
            <div class="category-header">
              <div class="category-title-row">
                <i [class]="group.icon + ' category-icon'"></i>
                <h3 class="category-title">{{ group.label }}</h3>
                <p-tag [value]="getCategoryEnabledCount(group) + '/' + group.flags.length"
                       [severity]="getCategoryEnabledCount(group) === group.flags.length ? 'success' : 'info'"
                       [rounded]="true">
                </p-tag>
              </div>
            </div>
          </ng-template>

          <div *ngFor="let flag of group.flags; trackBy: trackByKey" class="flag-row"
               [class.flag-disabled]="!flag.enabled">
            <div class="flag-info">
              <div class="flag-name">{{ flag.name }}</div>
              <div class="flag-description">{{ flag.description }}</div>
              <div *ngIf="flag.modifiedAt" class="flag-meta">
                {{ 'settings.features.modifiedBy' | translate }} {{ flag.modifiedBy || 'Unknown' }}
                {{ 'settings.features.at' | translate }} {{ flag.modifiedAt | date:'medium' }}
              </div>
            </div>
            <div class="flag-toggle">
              <p-inputSwitch [(ngModel)]="flag.enabled"
                             (onChange)="onToggle(flag, $event)"
                             [attr.aria-label]="'Toggle ' + flag.name"
                             [disabled]="togglingKey === flag.key">
              </p-inputSwitch>
            </div>
          </div>

          <!-- Empty state for category -->
          <div *ngIf="group.flags.length === 0" class="empty-category">
            {{ 'settings.features.noFlagsInCategory' | translate }}
          </div>
        </p-card>
      </div>

      <!-- No results -->
      <div *ngIf="filteredGroups.length === 0 && searchQuery" class="no-results">
        <i class="pi pi-search"></i>
        <p>{{ 'settings.features.noResults' | translate }} "{{ searchQuery }}"</p>
      </div>
    </div>

    <p-confirmDialog aria-label="Confirmation dialog"></p-confirmDialog>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem;
      max-width: 900px;
      margin: 0 auto;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      gap: 1rem;
      color: var(--text-color-secondary);
    }

    :host ::ng-deep .msg-banner {
      width: 100%;
      margin-bottom: 1rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .summary-badge {
      background: var(--surface-ground);
      border: 1px solid var(--surface-border);
      border-radius: 20px;
      padding: 0.25rem 0.75rem;
      font-size: 0.8rem;
      color: var(--text-color-secondary);
      white-space: nowrap;
    }

    .search-wrapper {
      position: relative;
    }

    .search-wrapper i {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-color-secondary);
    }

    .search-input {
      padding-left: 2.25rem;
      width: 280px;
    }

    .category-group {
      margin-bottom: 1.25rem;
    }

    :host ::ng-deep .category-card .p-card-header {
      padding: 1rem 1.25rem 0;
    }

    .category-header {
      padding: 0.5rem 0;
    }

    .category-title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .category-icon {
      font-size: 1.25rem;
      color: var(--primary-color);
    }

    .category-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      flex: 1;
    }

    .flag-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 0;
      border-bottom: 1px solid var(--surface-border);
      gap: 1rem;
      transition: opacity 0.2s;
    }

    .flag-row:last-child {
      border-bottom: none;
    }

    .flag-disabled {
      opacity: 0.6;
    }

    .flag-info {
      flex: 1;
      min-width: 0;
    }

    .flag-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-color);
      margin-bottom: 0.15rem;
    }

    .flag-description {
      font-size: 0.8rem;
      color: var(--text-color-secondary);
      line-height: 1.4;
    }

    .flag-meta {
      font-size: 0.7rem;
      color: var(--text-color-secondary);
      margin-top: 0.25rem;
      font-style: italic;
    }

    .flag-toggle {
      flex-shrink: 0;
    }

    .empty-category {
      text-align: center;
      padding: 1.5rem;
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }

    .no-results {
      text-align: center;
      padding: 3rem 2rem;
      color: var(--text-color-secondary);
    }

    .no-results i {
      font-size: 2rem;
      margin-bottom: 0.75rem;
      display: block;
    }
  `]
})
export class FeatureFlagsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/settings/features';

  private allFlags: FeatureFlag[] = [];
  filteredGroups: CategoryGroup[] = [];
  loading = true;
  errorMessage = '';
  searchQuery = '';
  togglingKey: string | null = null;

  private readonly categoryMeta: Record<FeatureCategory, { label: string; icon: string; order: number }> = {
    AUTHENTICATION: { label: 'Authentication', icon: 'pi pi-lock', order: 0 },
    MFA: { label: 'Multi-Factor Authentication', icon: 'pi pi-shield', order: 1 },
    IGA: { label: 'Identity Governance', icon: 'pi pi-users', order: 2 },
    NOTIFICATIONS: { label: 'Notifications', icon: 'pi pi-bell', order: 3 },
    ADVANCED: { label: 'Advanced', icon: 'pi pi-cog', order: 4 }
  };

  get enabledCount(): number {
    return this.allFlags.filter(f => f.enabled).length;
  }

  get totalCount(): number {
    return this.allFlags.length;
  }

  constructor(
    private http: HttpClient,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadFlags();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadFlags(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<FeatureFlag[]>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.allFlags = response.data || [];
          this.buildGroups();
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load feature flags.';
          this.loading = false;
        }
      });
  }

  private buildGroups(filter?: string): void {
    const query = (filter || '').toLowerCase().trim();
    const grouped = new Map<FeatureCategory, FeatureFlag[]>();

    for (const flag of this.allFlags) {
      if (query && !flag.name.toLowerCase().includes(query) && !flag.key.toLowerCase().includes(query)) {
        continue;
      }
      if (!grouped.has(flag.category)) {
        grouped.set(flag.category, []);
      }
      grouped.get(flag.category)!.push(flag);
    }

    this.filteredGroups = Array.from(grouped.entries())
      .map(([category, flags]) => ({
        category,
        label: this.categoryMeta[category]?.label || category,
        icon: this.categoryMeta[category]?.icon || 'pi pi-cog',
        flags
      }))
      .sort((a, b) =>
        (this.categoryMeta[a.category]?.order ?? 99) - (this.categoryMeta[b.category]?.order ?? 99)
      );
  }

  onSearch(): void {
    this.buildGroups(this.searchQuery);
  }

  onToggle(flag: FeatureFlag, event: any): void {
    const newEnabled = event.checked;

    // Critical feature confirmation when disabling
    if (!newEnabled && CRITICAL_FEATURES.includes(flag.key)) {
      // Revert toggle immediately, let confirmation decide
      flag.enabled = !newEnabled;
      this.confirmationService.confirm({
        message: `"${flag.name}" is a critical security feature. Disabling it may reduce the security posture of your tenant. Are you sure you want to disable it?`,
        header: 'Disable Critical Feature',
        icon: 'pi pi-exclamation-triangle',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => {
          flag.enabled = newEnabled;
          this.persistToggle(flag, newEnabled);
        },
        reject: () => {
          // Already reverted above
        }
      });
      return;
    }

    this.persistToggle(flag, newEnabled);
  }

  private persistToggle(flag: FeatureFlag, enabled: boolean): void {
    this.togglingKey = flag.key;

    this.http.put<ApiResponse<FeatureFlag>>(`${this.apiBase}/${flag.key}`, { enabled })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.togglingKey = null)
      )
      .subscribe({
        next: (response) => {
          if (response.data) {
            flag.modifiedAt = response.data.modifiedAt;
            flag.modifiedBy = response.data.modifiedBy;
          }
          this.messageService.add({
            severity: 'success',
            summary: enabled ? 'Feature Enabled' : 'Feature Disabled',
            detail: `${flag.name} has been ${enabled ? 'enabled' : 'disabled'}.`,
            life: 3000
          });
        },
        error: (err) => {
          // Revert toggle on error
          flag.enabled = !enabled;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err?.error?.message || `Failed to update ${flag.name}.`
          });
        }
      });
  }

  getCategoryEnabledCount(group: CategoryGroup): number {
    return group.flags.filter(f => f.enabled).length;
  }

  trackByCategory(_index: number, group: CategoryGroup): string {
    return group.category;
  }

  trackByKey(_index: number, flag: FeatureFlag): string {
    return flag.key;
  }
}
