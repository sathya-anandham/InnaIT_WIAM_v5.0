import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AccordionModule } from 'primeng/accordion';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

type DataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DURATION';

interface SystemSetting {
  key: string;
  value: string;
  description: string;
  category: string;
  dataType: DataType;
  defaultValue: string;
  modifiedAt: string | null;
  // Local UI state
  editing?: boolean;
  editValue?: any;
  saving?: boolean;
}

interface CategoryGroup {
  category: string;
  label: string;
  icon: string;
  settings: SystemSetting[];
}

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    InputNumberModule,
    InputSwitchModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    AccordionModule,
    TagModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading system settings">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'settings.system.loading' | translate }}</p>
    </div>

    <p-toast></p-toast>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="msg-banner" role="alert"></p-message>

    <div *ngIf="!loading" class="system-settings-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">{{ 'settings.system.title' | translate }}</h2>
        </div>
        <div class="header-right">
          <span class="p-input-icon-left search-wrapper">
            <i class="pi pi-search"></i>
            <input pInputText [(ngModel)]="searchQuery" (ngModelChange)="filterSettings()"
                   [placeholder]="'settings.system.search' | translate"
                   class="search-input" aria-label="Search settings" />
          </span>
          <p-button [label]="'settings.system.resetAll' | translate"
                    icon="pi pi-refresh"
                    styleClass="p-button-outlined p-button-danger"
                    (onClick)="onResetAll()"
                    aria-label="Reset all settings to defaults">
          </p-button>
        </div>
      </div>

      <!-- Category Accordion -->
      <p-accordion [multiple]="true" styleClass="settings-accordion">
        <p-accordionTab *ngFor="let group of filteredGroups; trackBy: trackByCategory"
                        [header]="group.label"
                        [selected]="true">
          <ng-template pTemplate="header">
            <div class="accordion-header-content">
              <i [class]="group.icon + ' accordion-icon'"></i>
              <span class="accordion-label">{{ group.label }}</span>
              <p-tag *ngIf="getModifiedCount(group) > 0"
                     [value]="getModifiedCount(group) + ' modified'"
                     severity="warning" [rounded]="true" styleClass="modified-tag">
              </p-tag>
            </div>
          </ng-template>

          <div class="settings-table" role="table" [attr.aria-label]="group.label + ' settings'">
            <!-- Table Header -->
            <div class="settings-row settings-row--header" role="row">
              <div class="col-key" role="columnheader">{{ 'settings.system.key' | translate }}</div>
              <div class="col-value" role="columnheader">{{ 'settings.system.value' | translate }}</div>
              <div class="col-description" role="columnheader">{{ 'settings.system.description' | translate }}</div>
              <div class="col-actions" role="columnheader">{{ 'settings.system.actions' | translate }}</div>
            </div>

            <!-- Setting Rows -->
            <div *ngFor="let setting of group.settings; trackBy: trackByKey"
                 class="settings-row" role="row"
                 [class.settings-row--modified]="isModified(setting)">

              <!-- Key -->
              <div class="col-key" role="cell">
                <code class="setting-key">{{ setting.key }}</code>
                <span *ngIf="isModified(setting)" class="modified-indicator"
                      [pTooltip]="'Modified at ' + (setting.modifiedAt | date:'medium')"
                      aria-label="Modified setting">
                  <i class="pi pi-circle-fill"></i>
                </span>
              </div>

              <!-- Value -->
              <div class="col-value" role="cell">
                <!-- Display Mode -->
                <ng-container *ngIf="!setting.editing">
                  <span *ngIf="setting.dataType === 'BOOLEAN'" class="value-display">
                    <p-tag [value]="setting.value === 'true' ? 'Enabled' : 'Disabled'"
                           [severity]="setting.value === 'true' ? 'success' : 'danger'"
                           [rounded]="true">
                    </p-tag>
                  </span>
                  <span *ngIf="setting.dataType === 'DURATION'" class="value-display value-clickable"
                        (click)="startEdit(setting)" (keydown.enter)="startEdit(setting)"
                        tabindex="0" role="button" [attr.aria-label]="'Edit ' + setting.key">
                    {{ formatDuration(setting.value) }}
                    <i class="pi pi-pencil edit-icon"></i>
                  </span>
                  <span *ngIf="setting.dataType === 'NUMBER'" class="value-display value-clickable"
                        (click)="startEdit(setting)" (keydown.enter)="startEdit(setting)"
                        tabindex="0" role="button" [attr.aria-label]="'Edit ' + setting.key">
                    {{ setting.value }}
                    <i class="pi pi-pencil edit-icon"></i>
                  </span>
                  <span *ngIf="setting.dataType === 'STRING'" class="value-display value-clickable"
                        (click)="startEdit(setting)" (keydown.enter)="startEdit(setting)"
                        tabindex="0" role="button" [attr.aria-label]="'Edit ' + setting.key">
                    {{ setting.value || '(empty)' }}
                    <i class="pi pi-pencil edit-icon"></i>
                  </span>
                </ng-container>

                <!-- Edit Mode -->
                <ng-container *ngIf="setting.editing">
                  <!-- Boolean: inline switch -->
                  <div *ngIf="setting.dataType === 'BOOLEAN'" class="inline-edit">
                    <p-inputSwitch [(ngModel)]="setting.editValue"
                                   (onChange)="onBooleanToggle(setting)"
                                   [attr.aria-label]="setting.key + ' toggle'">
                    </p-inputSwitch>
                  </div>

                  <!-- Number -->
                  <div *ngIf="setting.dataType === 'NUMBER'" class="inline-edit">
                    <p-inputNumber [(ngModel)]="setting.editValue" [useGrouping]="false"
                                   [min]="0" styleClass="inline-input"
                                   [attr.aria-label]="setting.key + ' value'">
                    </p-inputNumber>
                    <p-button icon="pi pi-check" styleClass="p-button-text p-button-success p-button-sm"
                              (onClick)="saveEdit(setting)" [loading]="setting.saving"
                              aria-label="Save"></p-button>
                    <p-button icon="pi pi-times" styleClass="p-button-text p-button-secondary p-button-sm"
                              (onClick)="cancelEdit(setting)" aria-label="Cancel"></p-button>
                  </div>

                  <!-- Duration (input in seconds) -->
                  <div *ngIf="setting.dataType === 'DURATION'" class="inline-edit">
                    <p-inputNumber [(ngModel)]="setting.editValue" [useGrouping]="false"
                                   [min]="0" styleClass="inline-input"
                                   [attr.aria-label]="setting.key + ' value in seconds'"
                                   suffix=" seconds">
                    </p-inputNumber>
                    <span class="duration-preview">= {{ formatDuration(setting.editValue?.toString()) }}</span>
                    <p-button icon="pi pi-check" styleClass="p-button-text p-button-success p-button-sm"
                              (onClick)="saveEdit(setting)" [loading]="setting.saving"
                              aria-label="Save"></p-button>
                    <p-button icon="pi pi-times" styleClass="p-button-text p-button-secondary p-button-sm"
                              (onClick)="cancelEdit(setting)" aria-label="Cancel"></p-button>
                  </div>

                  <!-- String -->
                  <div *ngIf="setting.dataType === 'STRING'" class="inline-edit">
                    <input pInputText [(ngModel)]="setting.editValue" class="inline-input-text"
                           [attr.aria-label]="setting.key + ' value'" />
                    <p-button icon="pi pi-check" styleClass="p-button-text p-button-success p-button-sm"
                              (onClick)="saveEdit(setting)" [loading]="setting.saving"
                              aria-label="Save"></p-button>
                    <p-button icon="pi pi-times" styleClass="p-button-text p-button-secondary p-button-sm"
                              (onClick)="cancelEdit(setting)" aria-label="Cancel"></p-button>
                  </div>
                </ng-container>
              </div>

              <!-- Description -->
              <div class="col-description" role="cell">
                <span class="setting-description">{{ setting.description }}</span>
                <span *ngIf="setting.defaultValue" class="setting-default">
                  {{ 'settings.system.default' | translate }}:
                  <code>{{ setting.dataType === 'DURATION' ? formatDuration(setting.defaultValue) : setting.defaultValue }}</code>
                </span>
              </div>

              <!-- Actions -->
              <div class="col-actions" role="cell">
                <p-button *ngIf="isModified(setting)"
                          icon="pi pi-undo"
                          styleClass="p-button-text p-button-warning p-button-sm"
                          [pTooltip]="'settings.system.resetToDefault' | translate"
                          (onClick)="onResetSetting(setting)"
                          [loading]="setting.saving"
                          [attr.aria-label]="'Reset ' + setting.key + ' to default'">
                </p-button>
              </div>
            </div>
          </div>

          <!-- Empty within category (after search) -->
          <div *ngIf="group.settings.length === 0" class="empty-category">
            {{ 'settings.system.noSettingsMatch' | translate }}
          </div>
        </p-accordionTab>
      </p-accordion>

      <!-- No results at all -->
      <div *ngIf="filteredGroups.length === 0 && searchQuery" class="no-results">
        <i class="pi pi-search"></i>
        <p>{{ 'settings.system.noResults' | translate }} "{{ searchQuery }}"</p>
      </div>
    </div>

    <p-confirmDialog aria-label="Confirmation dialog"></p-confirmDialog>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem;
      max-width: 1200px;
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

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
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
      width: 260px;
    }

    /* Accordion */
    :host ::ng-deep .settings-accordion .p-accordion-header-link {
      padding: 0.875rem 1.25rem;
    }

    .accordion-header-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
    }

    .accordion-icon {
      font-size: 1.1rem;
      color: var(--primary-color);
    }

    .accordion-label {
      font-weight: 600;
      flex: 1;
    }

    :host ::ng-deep .modified-tag {
      font-size: 0.65rem;
    }

    /* Settings Table */
    .settings-table {
      width: 100%;
    }

    .settings-row {
      display: grid;
      grid-template-columns: 280px 1fr 1fr 60px;
      gap: 0.75rem;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--surface-border);
    }

    @media (max-width: 960px) {
      .settings-row {
        grid-template-columns: 1fr;
        gap: 0.25rem;
      }
    }

    .settings-row--header {
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-color-secondary);
      border-bottom: 2px solid var(--surface-border);
    }

    .settings-row--modified {
      background: rgba(234, 179, 8, 0.04);
    }

    .settings-row:last-child {
      border-bottom: none;
    }

    .setting-key {
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 0.8rem;
      color: var(--text-color);
      background: var(--surface-ground);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }

    .modified-indicator {
      margin-left: 0.375rem;
      color: #eab308;
      font-size: 0.5rem;
      vertical-align: middle;
    }

    /* Value display */
    .value-display {
      font-size: 0.875rem;
    }

    .value-clickable {
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      transition: background 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .value-clickable:hover {
      background: var(--surface-hover);
    }

    .edit-icon {
      font-size: 0.7rem;
      color: var(--text-color-secondary);
      opacity: 0;
      transition: opacity 0.15s;
    }

    .value-clickable:hover .edit-icon {
      opacity: 1;
    }

    /* Inline Edit */
    .inline-edit {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    :host ::ng-deep .inline-input {
      width: 140px;
    }

    .inline-input-text {
      width: 200px;
      font-size: 0.85rem;
    }

    .duration-preview {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      white-space: nowrap;
    }

    /* Description */
    .col-description {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .setting-description {
      font-size: 0.8rem;
      color: var(--text-color-secondary);
      line-height: 1.4;
    }

    .setting-default {
      font-size: 0.7rem;
      color: var(--text-color-secondary);
    }

    .setting-default code {
      font-family: monospace;
      background: var(--surface-ground);
      padding: 0.05rem 0.3rem;
      border-radius: 3px;
    }

    /* Empty / No results */
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
      display: block;
      margin-bottom: 0.75rem;
    }
  `]
})
export class SystemSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/settings/system';

  private allSettings: SystemSetting[] = [];
  filteredGroups: CategoryGroup[] = [];
  loading = true;
  errorMessage = '';
  searchQuery = '';

  private readonly categoryMeta: Record<string, { label: string; icon: string; order: number }> = {
    'Session': { label: 'Session Management', icon: 'pi pi-clock', order: 0 },
    'OTP': { label: 'OTP Configuration', icon: 'pi pi-key', order: 1 },
    'Rate Limits': { label: 'Rate Limits', icon: 'pi pi-shield', order: 2 },
    'Token': { label: 'Token Configuration', icon: 'pi pi-ticket', order: 3 },
    'Security': { label: 'Security', icon: 'pi pi-lock', order: 4 }
  };

  constructor(
    private http: HttpClient,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSettings(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<SystemSetting[]>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.allSettings = (response.data || []).map(s => ({
            ...s,
            editing: false,
            editValue: undefined,
            saving: false
          }));
          this.buildGroups();
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load system settings.';
          this.loading = false;
        }
      });
  }

  private buildGroups(filter?: string): void {
    const query = (filter || '').toLowerCase().trim();
    const grouped = new Map<string, SystemSetting[]>();

    for (const setting of this.allSettings) {
      if (query && !setting.key.toLowerCase().includes(query) && !setting.description.toLowerCase().includes(query)) {
        continue;
      }
      const cat = setting.category;
      if (!grouped.has(cat)) {
        grouped.set(cat, []);
      }
      grouped.get(cat)!.push(setting);
    }

    this.filteredGroups = Array.from(grouped.entries())
      .map(([category, settings]) => ({
        category,
        label: this.categoryMeta[category]?.label || category,
        icon: this.categoryMeta[category]?.icon || 'pi pi-cog',
        settings
      }))
      .sort((a, b) =>
        (this.categoryMeta[a.category]?.order ?? 99) - (this.categoryMeta[b.category]?.order ?? 99)
      );
  }

  filterSettings(): void {
    this.buildGroups(this.searchQuery);
  }

  isModified(setting: SystemSetting): boolean {
    return setting.value !== setting.defaultValue;
  }

  getModifiedCount(group: CategoryGroup): number {
    return group.settings.filter(s => this.isModified(s)).length;
  }

  formatDuration(seconds: string | undefined | null): string {
    if (!seconds) return '--';
    const num = parseInt(seconds, 10);
    if (isNaN(num)) return seconds;

    if (num >= 86400 && num % 86400 === 0) {
      const days = num / 86400;
      return days === 1 ? '1 day' : `${days} days`;
    }
    if (num >= 3600 && num % 3600 === 0) {
      const hours = num / 3600;
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    if (num >= 60 && num % 60 === 0) {
      const minutes = num / 60;
      return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    }
    return num === 1 ? '1 second' : `${num} seconds`;
  }

  startEdit(setting: SystemSetting): void {
    // Close any other edits first
    this.allSettings.forEach(s => {
      if (s.key !== setting.key) {
        s.editing = false;
      }
    });

    setting.editing = true;

    switch (setting.dataType) {
      case 'BOOLEAN':
        setting.editValue = setting.value === 'true';
        break;
      case 'NUMBER':
      case 'DURATION':
        setting.editValue = parseInt(setting.value, 10) || 0;
        break;
      default:
        setting.editValue = setting.value;
    }
  }

  cancelEdit(setting: SystemSetting): void {
    setting.editing = false;
    setting.editValue = undefined;
  }

  onBooleanToggle(setting: SystemSetting): void {
    // For booleans, save immediately on toggle
    setting.editValue = !setting.editValue; // Toggle happened via ngModel, this is already updated
    // Actually the ngModel already updated editValue, so we save the new value
    const newValue = setting.editValue.toString();
    this.saveSetting(setting, newValue);
  }

  saveEdit(setting: SystemSetting): void {
    const newValue = setting.editValue?.toString() || '';
    this.saveSetting(setting, newValue);
  }

  private saveSetting(setting: SystemSetting, newValue: string): void {
    setting.saving = true;

    this.http.put<ApiResponse<SystemSetting>>(`${this.apiBase}/${setting.key}`, { value: newValue })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => setting.saving = false)
      )
      .subscribe({
        next: (response) => {
          setting.value = newValue;
          setting.editing = false;
          setting.editValue = undefined;
          if (response.data?.modifiedAt) {
            setting.modifiedAt = response.data.modifiedAt;
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Setting Updated',
            detail: `${setting.key} has been updated.`,
            life: 3000
          });
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err?.error?.message || `Failed to update ${setting.key}.`
          });
        }
      });
  }

  onResetSetting(setting: SystemSetting): void {
    this.confirmationService.confirm({
      message: `Reset "${setting.key}" to its default value (${setting.dataType === 'DURATION' ? this.formatDuration(setting.defaultValue) : setting.defaultValue})?`,
      header: 'Reset to Default',
      icon: 'pi pi-undo',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.saveSetting(setting, setting.defaultValue);
      }
    });
  }

  onResetAll(): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to reset ALL system settings to their default values? This cannot be undone.',
      header: 'Reset All Settings',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const modifiedSettings = this.allSettings.filter(s => this.isModified(s));
        if (modifiedSettings.length === 0) {
          this.messageService.add({
            severity: 'info',
            summary: 'No Changes',
            detail: 'All settings are already at default values.',
            life: 3000
          });
          return;
        }

        let completed = 0;
        let errors = 0;

        modifiedSettings.forEach(setting => {
          setting.saving = true;
          this.http.put<ApiResponse<SystemSetting>>(`${this.apiBase}/${setting.key}`, { value: setting.defaultValue })
            .pipe(
              takeUntil(this.destroy$),
              finalize(() => {
                setting.saving = false;
                completed++;
                if (completed === modifiedSettings.length) {
                  this.messageService.add({
                    severity: errors > 0 ? 'warn' : 'success',
                    summary: 'Reset Complete',
                    detail: errors > 0
                      ? `Reset completed with ${errors} error(s).`
                      : `All ${completed} settings have been reset to defaults.`
                  });
                }
              })
            )
            .subscribe({
              next: (response) => {
                setting.value = setting.defaultValue;
                setting.editing = false;
                if (response.data?.modifiedAt) {
                  setting.modifiedAt = response.data.modifiedAt;
                }
              },
              error: () => {
                errors++;
              }
            });
        });
      }
    });
  }

  trackByCategory(_index: number, group: CategoryGroup): string {
    return group.category;
  }

  trackByKey(_index: number, setting: SystemSetting): string {
    return setting.key;
  }
}
