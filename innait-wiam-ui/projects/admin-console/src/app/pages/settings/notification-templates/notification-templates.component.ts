import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { TabViewModule } from 'primeng/tabview';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

type Channel = 'EMAIL' | 'SMS' | 'PUSH';

interface NotificationTemplate {
  id: string;
  templateKey: string;
  name: string;
  channel: Channel;
  subject: string;
  body: string;
  variables: string[];
  lastModified: string;
}

@Component({
  selector: 'app-notification-templates',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    InputTextareaModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule,
    DialogModule,
    DropdownModule,
    TabViewModule,
    ToastModule,
    TooltipModule,
    DividerModule
  ],
  providers: [MessageService],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading notification templates">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'settings.templates.loading' | translate }}</p>
    </div>

    <p-toast></p-toast>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="msg-banner" role="alert"></p-message>

    <div *ngIf="!loading" class="templates-layout">
      <!-- Left Panel: Template List -->
      <div class="list-panel">
        <p-card [header]="'settings.templates.title' | translate" styleClass="list-card">
          <!-- Search & Filter -->
          <div class="list-toolbar">
            <span class="p-input-icon-left search-wrapper">
              <i class="pi pi-search"></i>
              <input pInputText [(ngModel)]="searchQuery" (ngModelChange)="filterTemplates()"
                     [placeholder]="'settings.templates.search' | translate"
                     class="search-input" aria-label="Search templates" />
            </span>
            <p-dropdown [options]="channelFilterOptions"
                        [(ngModel)]="channelFilter"
                        (ngModelChange)="filterTemplates()"
                        [placeholder]="'settings.templates.allChannels' | translate"
                        [showClear]="true"
                        styleClass="channel-filter"
                        aria-label="Filter by channel">
            </p-dropdown>
          </div>

          <!-- Template List -->
          <div class="template-list" role="listbox" aria-label="Notification templates">
            <div *ngFor="let tmpl of filteredTemplates; trackBy: trackById"
                 class="template-item"
                 [class.template-item--selected]="selectedTemplate?.id === tmpl.id"
                 (click)="selectTemplate(tmpl)"
                 (keydown.enter)="selectTemplate(tmpl)"
                 [attr.role]="'option'"
                 [attr.aria-selected]="selectedTemplate?.id === tmpl.id"
                 tabindex="0">
              <div class="template-item-header">
                <span class="template-name">{{ tmpl.name }}</span>
                <p-tag [value]="tmpl.channel"
                       [severity]="getChannelSeverity(tmpl.channel)"
                       [rounded]="true"
                       styleClass="channel-tag">
                </p-tag>
              </div>
              <div class="template-key">{{ tmpl.templateKey }}</div>
              <div class="template-modified">{{ tmpl.lastModified | date:'short' }}</div>
            </div>

            <!-- Empty state -->
            <div *ngIf="filteredTemplates.length === 0" class="empty-list">
              <i class="pi pi-inbox"></i>
              <p>{{ 'settings.templates.noTemplates' | translate }}</p>
            </div>
          </div>
        </p-card>
      </div>

      <!-- Right Panel: Editor -->
      <div class="editor-panel">
        <!-- No selection -->
        <div *ngIf="!selectedTemplate" class="no-selection">
          <i class="pi pi-file-edit"></i>
          <p>{{ 'settings.templates.selectTemplate' | translate }}</p>
        </div>

        <!-- Template Editor -->
        <p-card *ngIf="selectedTemplate" [header]="selectedTemplate.name" styleClass="editor-card">
          <ng-template pTemplate="subtitle">
            <p-tag [value]="selectedTemplate.channel"
                   [severity]="getChannelSeverity(selectedTemplate.channel)"
                   [rounded]="true">
            </p-tag>
            <span class="editor-subtitle-key">{{ selectedTemplate.templateKey }}</span>
          </ng-template>

          <p-tabView>
            <!-- Edit Tab -->
            <p-tabPanel [header]="'settings.templates.edit' | translate" leftIcon="pi pi-pencil">
              <form [formGroup]="templateForm" aria-label="Template editor form">
                <!-- Subject (EMAIL only) -->
                <div *ngIf="selectedTemplate.channel === 'EMAIL'" class="field">
                  <label for="subject" class="field-label">{{ 'settings.templates.subject' | translate }}</label>
                  <input pInputText id="subject" formControlName="subject" class="w-full"
                         aria-label="Email subject" />
                </div>

                <!-- Variable Insertion Toolbar -->
                <div class="field">
                  <label class="field-label">{{ 'settings.templates.insertVariable' | translate }}</label>
                  <div class="variable-toolbar">
                    <p-button *ngFor="let variable of selectedTemplate.variables"
                              [label]="'{{' + variable + '}}'"
                              styleClass="p-button-outlined p-button-sm p-button-secondary"
                              (onClick)="insertVariable(variable)"
                              [pTooltip]="'Insert ' + variable"
                              [attr.aria-label]="'Insert variable ' + variable">
                    </p-button>
                  </div>
                </div>

                <!-- Body -->
                <div class="field">
                  <label for="body" class="field-label">{{ 'settings.templates.body' | translate }}</label>
                  <textarea #bodyTextarea pInputTextarea id="body" formControlName="body"
                            rows="14" class="w-full body-textarea"
                            aria-label="Template body">
                  </textarea>
                </div>

                <!-- Actions -->
                <div class="editor-actions">
                  <p-button [label]="'settings.templates.save' | translate"
                            icon="pi pi-save"
                            [loading]="saving"
                            [disabled]="templateForm.invalid || templateForm.pristine || saving"
                            (onClick)="onSave()"
                            aria-label="Save template">
                  </p-button>
                  <p-button [label]="'settings.templates.sendTest' | translate"
                            icon="pi pi-send"
                            styleClass="p-button-outlined"
                            (onClick)="showTestDialog = true"
                            [disabled]="saving"
                            aria-label="Send test notification">
                  </p-button>
                </div>
              </form>
            </p-tabPanel>

            <!-- Preview Tab -->
            <p-tabPanel [header]="'settings.templates.preview' | translate" leftIcon="pi pi-eye">
              <div class="preview-container">
                <div class="preview-toolbar">
                  <p-button [label]="'settings.templates.refreshPreview' | translate"
                            icon="pi pi-refresh"
                            styleClass="p-button-outlined p-button-sm"
                            [loading]="loadingPreview"
                            (onClick)="loadPreview()"
                            aria-label="Refresh preview">
                  </p-button>
                </div>

                <div *ngIf="loadingPreview" class="preview-loading">
                  <p-progressSpinner strokeWidth="4" animationDuration="1s"
                                     [style]="{width: '32px', height: '32px'}">
                  </p-progressSpinner>
                </div>

                <div *ngIf="!loadingPreview && previewHtml" class="preview-content">
                  <!-- Preview Subject -->
                  <div *ngIf="selectedTemplate.channel === 'EMAIL' && previewSubject" class="preview-subject">
                    <strong>{{ 'settings.templates.subject' | translate }}:</strong> {{ previewSubject }}
                  </div>
                  <p-divider></p-divider>
                  <div class="preview-body" [innerHTML]="previewHtml"></div>
                </div>

                <div *ngIf="!loadingPreview && !previewHtml" class="preview-empty">
                  <i class="pi pi-eye"></i>
                  <p>{{ 'settings.templates.clickRefresh' | translate }}</p>
                </div>
              </div>
            </p-tabPanel>
          </p-tabView>
        </p-card>
      </div>
    </div>

    <!-- Send Test Dialog -->
    <p-dialog [header]="'settings.templates.sendTestTitle' | translate"
              [(visible)]="showTestDialog"
              [modal]="true"
              [style]="{ width: '440px' }"
              aria-label="Send test notification dialog">
      <div class="field">
        <label for="testRecipient" class="field-label">
          {{ selectedTemplate?.channel === 'EMAIL' ? ('settings.templates.recipientEmail' | translate) :
             selectedTemplate?.channel === 'SMS' ? ('settings.templates.recipientPhone' | translate) :
             ('settings.templates.recipientDevice' | translate) }}
        </label>
        <input pInputText id="testRecipient" [(ngModel)]="testRecipient" class="w-full"
               [placeholder]="selectedTemplate?.channel === 'EMAIL' ? 'user@example.com' :
                              selectedTemplate?.channel === 'SMS' ? '+1234567890' : 'Device token'"
               aria-label="Test recipient" />
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times"
                  styleClass="p-button-text" (onClick)="showTestDialog = false"></p-button>
        <p-button [label]="'settings.templates.send' | translate" icon="pi pi-send"
                  [loading]="sendingTest" [disabled]="!testRecipient || sendingTest"
                  (onClick)="onSendTest()"></p-button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem;
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

    .templates-layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 1.5rem;
      align-items: start;
      min-height: 600px;
    }

    @media (max-width: 960px) {
      .templates-layout {
        grid-template-columns: 1fr;
      }
    }

    /* List Panel */
    :host ::ng-deep .list-card .p-card-body {
      padding: 0;
    }

    :host ::ng-deep .list-card .p-card-header {
      padding: 1rem 1rem 0;
    }

    :host ::ng-deep .list-card .p-card-content {
      padding: 0;
    }

    .list-toolbar {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--surface-border);
    }

    .search-wrapper {
      flex: 1;
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
      width: 100%;
      padding-left: 2.25rem;
    }

    :host ::ng-deep .channel-filter {
      width: 120px;
    }

    .template-list {
      max-height: 520px;
      overflow-y: auto;
    }

    .template-item {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--surface-border);
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .template-item:hover {
      background: var(--surface-hover);
    }

    .template-item--selected {
      background: var(--primary-color) !important;
      color: white;
    }

    .template-item--selected .template-key,
    .template-item--selected .template-modified {
      color: rgba(255,255,255,0.8);
    }

    .template-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .template-name {
      font-weight: 600;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :host ::ng-deep .channel-tag {
      font-size: 0.65rem;
    }

    .template-key {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      font-family: monospace;
      margin-top: 0.15rem;
    }

    .template-modified {
      font-size: 0.7rem;
      color: var(--text-color-secondary);
      margin-top: 0.1rem;
    }

    .empty-list {
      text-align: center;
      padding: 2rem;
      color: var(--text-color-secondary);
    }

    .empty-list i {
      font-size: 2rem;
      display: block;
      margin-bottom: 0.5rem;
    }

    /* Editor Panel */
    .no-selection {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 400px;
      color: var(--text-color-secondary);
      border: 2px dashed var(--surface-border);
      border-radius: 8px;
    }

    .no-selection i {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    :host ::ng-deep .editor-card .p-card-subtitle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .editor-subtitle-key {
      font-family: monospace;
      font-size: 0.8rem;
      color: var(--text-color-secondary);
    }

    .field {
      margin-bottom: 1.25rem;
    }

    .field-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    .w-full { width: 100%; }

    .variable-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    :host ::ng-deep .variable-toolbar .p-button {
      font-family: monospace;
      font-size: 0.75rem;
    }

    .body-textarea {
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 0.85rem;
      line-height: 1.6;
      resize: vertical;
    }

    .editor-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    /* Preview */
    .preview-container {
      min-height: 300px;
    }

    .preview-toolbar {
      margin-bottom: 1rem;
    }

    .preview-loading {
      display: flex;
      justify-content: center;
      padding: 2rem;
    }

    .preview-subject {
      padding: 0.75rem;
      background: var(--surface-ground);
      border-radius: 6px;
      font-size: 0.9rem;
    }

    .preview-body {
      padding: 1rem;
      background: white;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      font-size: 0.875rem;
      line-height: 1.6;
      min-height: 200px;
    }

    .preview-empty {
      text-align: center;
      padding: 3rem 2rem;
      color: var(--text-color-secondary);
    }

    .preview-empty i {
      font-size: 2rem;
      display: block;
      margin-bottom: 0.75rem;
    }
  `]
})
export class NotificationTemplatesComponent implements OnInit, OnDestroy {
  @ViewChild('bodyTextarea') bodyTextarea!: ElementRef<HTMLTextAreaElement>;

  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/settings/notification-templates';

  templates: NotificationTemplate[] = [];
  filteredTemplates: NotificationTemplate[] = [];
  selectedTemplate: NotificationTemplate | null = null;
  templateForm!: FormGroup;

  loading = true;
  saving = false;
  loadingPreview = false;
  sendingTest = false;
  errorMessage = '';

  searchQuery = '';
  channelFilter: Channel | null = null;

  // Preview
  previewHtml = '';
  previewSubject = '';

  // Test dialog
  showTestDialog = false;
  testRecipient = '';

  channelFilterOptions = [
    { label: 'Email', value: 'EMAIL' },
    { label: 'SMS', value: 'SMS' },
    { label: 'Push', value: 'PUSH' }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.templateForm = this.fb.group({
      subject: [''],
      body: ['', [Validators.required]]
    });
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTemplates(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<NotificationTemplate[]>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.templates = response.data || [];
          this.filterTemplates();
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load notification templates.';
          this.loading = false;
        }
      });
  }

  filterTemplates(): void {
    const query = this.searchQuery.toLowerCase().trim();
    this.filteredTemplates = this.templates.filter(t => {
      const matchesSearch = !query ||
        t.name.toLowerCase().includes(query) ||
        t.templateKey.toLowerCase().includes(query);
      const matchesChannel = !this.channelFilter || t.channel === this.channelFilter;
      return matchesSearch && matchesChannel;
    });
  }

  selectTemplate(template: NotificationTemplate): void {
    this.selectedTemplate = template;
    this.previewHtml = '';
    this.previewSubject = '';
    this.templateForm.patchValue({
      subject: template.subject || '',
      body: template.body || ''
    });
    this.templateForm.markAsPristine();
  }

  getChannelSeverity(channel: Channel): 'success' | 'info' | 'secondary' | 'contrast' | 'warning' | 'danger' {
    switch (channel) {
      case 'EMAIL': return 'info';
      case 'SMS': return 'success';
      case 'PUSH': return 'secondary';
      default: return 'info';
    }
  }

  insertVariable(variable: string): void {
    const insertion = `{{${variable}}}`;
    const textarea = this.bodyTextarea?.nativeElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentBody = this.templateForm.get('body')?.value || '';
      const newBody = currentBody.substring(0, start) + insertion + currentBody.substring(end);
      this.templateForm.patchValue({ body: newBody });
      this.templateForm.markAsDirty();

      // Restore cursor position after insertion
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
      });
    } else {
      // Fallback: append at end
      const currentBody = this.templateForm.get('body')?.value || '';
      this.templateForm.patchValue({ body: currentBody + insertion });
      this.templateForm.markAsDirty();
    }
  }

  onSave(): void {
    if (!this.selectedTemplate || this.templateForm.invalid) return;

    this.saving = true;
    const payload = {
      subject: this.templateForm.get('subject')?.value,
      body: this.templateForm.get('body')?.value
    };

    this.http.put<ApiResponse<NotificationTemplate>>(`${this.apiBase}/${this.selectedTemplate.id}`, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: (response) => {
          if (response.data && this.selectedTemplate) {
            this.selectedTemplate.subject = response.data.subject;
            this.selectedTemplate.body = response.data.body;
            this.selectedTemplate.lastModified = response.data.lastModified;
          }
          this.templateForm.markAsPristine();
          this.messageService.add({
            severity: 'success',
            summary: 'Template Saved',
            detail: `${this.selectedTemplate?.name} has been updated.`,
            life: 3000
          });
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err?.error?.message || 'Failed to save template.'
          });
        }
      });
  }

  loadPreview(): void {
    if (!this.selectedTemplate) return;

    this.loadingPreview = true;
    const payload = {
      templateKey: this.selectedTemplate.templateKey,
      subject: this.templateForm.get('subject')?.value,
      body: this.templateForm.get('body')?.value,
      sampleData: this.getSampleData()
    };

    this.http.post<ApiResponse<{ subject: string; body: string }>>(`${this.apiBase}/preview`, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingPreview = false)
      )
      .subscribe({
        next: (response) => {
          this.previewSubject = response.data?.subject || '';
          this.previewHtml = response.data?.body || '';
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Preview Error',
            detail: err?.error?.message || 'Failed to generate preview.'
          });
        }
      });
  }

  private getSampleData(): Record<string, string> {
    return {
      userName: 'John Doe',
      resetLink: 'https://example.com/reset?token=abc123',
      otpCode: '847291',
      tenantName: 'Acme Corporation',
      email: 'john.doe@example.com',
      expiryTime: '30 minutes',
      appName: 'InnaIT WIAM'
    };
  }

  onSendTest(): void {
    if (!this.selectedTemplate || !this.testRecipient) return;

    this.sendingTest = true;
    const payload = {
      templateKey: this.selectedTemplate.templateKey,
      recipient: this.testRecipient,
      subject: this.templateForm.get('subject')?.value,
      body: this.templateForm.get('body')?.value
    };

    this.http.post<ApiResponse<void>>(`${this.apiBase}/test`, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.sendingTest = false)
      )
      .subscribe({
        next: () => {
          this.showTestDialog = false;
          this.testRecipient = '';
          this.messageService.add({
            severity: 'success',
            summary: 'Test Sent',
            detail: `Test notification sent to ${payload.recipient}.`,
            life: 4000
          });
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Send Failed',
            detail: err?.error?.message || 'Failed to send test notification.'
          });
        }
      });
  }

  trackById(_index: number, tmpl: NotificationTemplate): string {
    return tmpl.id;
  }
}
