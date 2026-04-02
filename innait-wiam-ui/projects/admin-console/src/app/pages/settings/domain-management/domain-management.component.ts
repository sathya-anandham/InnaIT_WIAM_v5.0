import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ClipboardModule, Clipboard } from '@angular/cdk/clipboard';

interface Domain {
  id: string;
  domain: string;
  status: 'VERIFIED' | 'PENDING' | 'FAILED';
  verifiedAt: string | null;
  dnsRecordType: string;
  dnsRecordValue: string;
  createdAt: string;
}

interface DnsRecord {
  recordType: string;
  recordName: string;
  recordValue: string;
}

@Component({
  selector: 'app-domain-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    DialogModule,
    ConfirmDialogModule,
    TooltipModule,
    ToastModule,
    ClipboardModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading domains">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'settings.domains.loading' | translate }}</p>
    </div>

    <p-toast></p-toast>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="msg-banner" role="alert"></p-message>

    <!-- Main Content -->
    <p-card *ngIf="!loading" [header]="'settings.domains.title' | translate"
            [subheader]="'settings.domains.subtitle' | translate">

      <!-- Toolbar -->
      <div class="toolbar">
        <p-button [label]="'settings.domains.addDomain' | translate"
                  icon="pi pi-plus"
                  (onClick)="showAddDialog = true"
                  aria-label="Add new domain">
        </p-button>
      </div>

      <!-- Domains Table -->
      <p-table [value]="domains" [responsive]="true" styleClass="p-datatable-sm"
               aria-label="Domains table" [rowHover]="true">
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'settings.domains.domainName' | translate }}</th>
            <th>{{ 'settings.domains.status' | translate }}</th>
            <th>{{ 'settings.domains.verifiedAt' | translate }}</th>
            <th>{{ 'settings.domains.createdAt' | translate }}</th>
            <th>{{ 'settings.domains.actions' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-domain>
          <tr>
            <td>
              <span class="domain-name">{{ domain.domain }}</span>
            </td>
            <td>
              <p-tag [value]="domain.status"
                     [severity]="getStatusSeverity(domain.status)"
                     [rounded]="true">
              </p-tag>
            </td>
            <td>
              <span *ngIf="domain.verifiedAt">{{ domain.verifiedAt | date:'medium' }}</span>
              <span *ngIf="!domain.verifiedAt" class="text-muted">--</span>
            </td>
            <td>{{ domain.createdAt | date:'medium' }}</td>
            <td>
              <div class="action-buttons">
                <!-- Verify button for PENDING -->
                <p-button *ngIf="domain.status === 'PENDING'"
                          icon="pi pi-check-circle"
                          [label]="'settings.domains.verify' | translate"
                          styleClass="p-button-outlined p-button-success p-button-sm"
                          [loading]="verifyingDomainId === domain.id"
                          (onClick)="onVerify(domain)"
                          [pTooltip]="'settings.domains.verifyTooltip' | translate"
                          aria-label="Verify domain">
                </p-button>

                <!-- Re-verify button for FAILED -->
                <p-button *ngIf="domain.status === 'FAILED'"
                          icon="pi pi-refresh"
                          [label]="'settings.domains.reverify' | translate"
                          styleClass="p-button-outlined p-button-warning p-button-sm"
                          [loading]="verifyingDomainId === domain.id"
                          (onClick)="onVerify(domain)"
                          [pTooltip]="'settings.domains.reverifyTooltip' | translate"
                          aria-label="Re-verify domain">
                </p-button>

                <!-- DNS Info button for PENDING/FAILED -->
                <p-button *ngIf="domain.status !== 'VERIFIED'"
                          icon="pi pi-info-circle"
                          styleClass="p-button-outlined p-button-info p-button-sm"
                          (onClick)="showDnsInfo(domain)"
                          [pTooltip]="'settings.domains.viewDnsInfo' | translate"
                          aria-label="View DNS instructions">
                </p-button>

                <!-- Remove button -->
                <p-button icon="pi pi-trash"
                          styleClass="p-button-outlined p-button-danger p-button-sm"
                          (onClick)="onRemove(domain)"
                          [pTooltip]="'settings.domains.remove' | translate"
                          aria-label="Remove domain">
                </p-button>
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" class="empty-message">
              <i class="pi pi-globe"></i>
              <p>{{ 'settings.domains.noDomains' | translate }}</p>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </p-card>

    <!-- Add Domain Dialog -->
    <p-dialog [header]="'settings.domains.addDomainTitle' | translate"
              [(visible)]="showAddDialog"
              [modal]="true"
              [style]="{ width: '480px' }"
              [closable]="true"
              aria-label="Add domain dialog">
      <form [formGroup]="addDomainForm" (ngSubmit)="onAddDomain()">
        <div class="field">
          <label for="newDomain" class="field-label">{{ 'settings.domains.domainNameLabel' | translate }} *</label>
          <input pInputText id="newDomain" formControlName="domain"
                 placeholder="example.com"
                 class="w-full"
                 aria-required="true"
                 [attr.aria-invalid]="addDomainForm.get('domain')?.invalid && addDomainForm.get('domain')?.touched" />
          <small *ngIf="addDomainForm.get('domain')?.hasError('required') && addDomainForm.get('domain')?.touched"
                 class="p-error" role="alert">
            {{ 'settings.domains.domainRequired' | translate }}
          </small>
          <small *ngIf="addDomainForm.get('domain')?.hasError('pattern') && addDomainForm.get('domain')?.touched"
                 class="p-error" role="alert">
            {{ 'settings.domains.domainInvalid' | translate }}
          </small>
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="'common.cancel' | translate" icon="pi pi-times"
                  styleClass="p-button-text" (onClick)="showAddDialog = false"></p-button>
        <p-button [label]="'settings.domains.add' | translate" icon="pi pi-plus"
                  [loading]="addingDomain" [disabled]="addDomainForm.invalid || addingDomain"
                  (onClick)="onAddDomain()"></p-button>
      </ng-template>
    </p-dialog>

    <!-- DNS Instructions Dialog -->
    <p-dialog [header]="'settings.domains.dnsInstructionsTitle' | translate"
              [(visible)]="showDnsDialog"
              [modal]="true"
              [style]="{ width: '600px' }"
              [closable]="true"
              aria-label="DNS instructions dialog">
      <div *ngIf="dnsRecord" class="dns-instructions">
        <p class="dns-intro">
          {{ 'settings.domains.dnsIntro' | translate }}
        </p>

        <div class="dns-record-row">
          <div class="dns-record-field">
            <label class="dns-label">{{ 'settings.domains.recordType' | translate }}</label>
            <div class="dns-value-row">
              <code class="dns-value">{{ dnsRecord.recordType }}</code>
              <p-button icon="pi pi-copy" styleClass="p-button-text p-button-sm"
                        (onClick)="copyToClipboard(dnsRecord.recordType)"
                        [pTooltip]="'common.copy' | translate"
                        aria-label="Copy record type">
              </p-button>
            </div>
          </div>
        </div>

        <div class="dns-record-row">
          <div class="dns-record-field">
            <label class="dns-label">{{ 'settings.domains.recordName' | translate }}</label>
            <div class="dns-value-row">
              <code class="dns-value">{{ dnsRecord.recordName }}</code>
              <p-button icon="pi pi-copy" styleClass="p-button-text p-button-sm"
                        (onClick)="copyToClipboard(dnsRecord.recordName)"
                        [pTooltip]="'common.copy' | translate"
                        aria-label="Copy record name">
              </p-button>
            </div>
          </div>
        </div>

        <div class="dns-record-row">
          <div class="dns-record-field">
            <label class="dns-label">{{ 'settings.domains.recordValue' | translate }}</label>
            <div class="dns-value-row">
              <code class="dns-value dns-value--wrap">{{ dnsRecord.recordValue }}</code>
              <p-button icon="pi pi-copy" styleClass="p-button-text p-button-sm"
                        (onClick)="copyToClipboard(dnsRecord.recordValue)"
                        [pTooltip]="'common.copy' | translate"
                        aria-label="Copy record value">
              </p-button>
            </div>
          </div>
        </div>

        <div class="dns-steps">
          <h4>{{ 'settings.domains.howToAdd' | translate }}</h4>
          <ol>
            <li>{{ 'settings.domains.step1' | translate }}</li>
            <li>{{ 'settings.domains.step2' | translate }}</li>
            <li>{{ 'settings.domains.step3' | translate }}</li>
            <li>{{ 'settings.domains.step4' | translate }}</li>
          </ol>
          <p class="dns-note">
            <i class="pi pi-info-circle"></i>
            {{ 'settings.domains.propagationNote' | translate }}
          </p>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="'common.close' | translate" icon="pi pi-times"
                  styleClass="p-button-text" (onClick)="showDnsDialog = false"></p-button>
      </ng-template>
    </p-dialog>

    <p-confirmDialog aria-label="Confirmation dialog"></p-confirmDialog>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem;
      max-width: 1100px;
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

    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 1rem;
    }

    .domain-name {
      font-weight: 600;
      font-family: monospace;
      font-size: 0.9rem;
    }

    .text-muted {
      color: var(--text-color-secondary);
    }

    .action-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .empty-message {
      text-align: center;
      padding: 2rem !important;
      color: var(--text-color-secondary);
    }

    .empty-message i {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      display: block;
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

    .p-error {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
    }

    /* DNS Instructions */
    .dns-instructions {
      padding: 0.5rem 0;
    }

    .dns-intro {
      margin-bottom: 1.25rem;
      color: var(--text-color-secondary);
      line-height: 1.5;
    }

    .dns-record-row {
      margin-bottom: 1rem;
    }

    .dns-label {
      display: block;
      font-weight: 600;
      font-size: 0.8rem;
      color: var(--text-color-secondary);
      margin-bottom: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .dns-value-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--surface-ground);
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
    }

    .dns-value {
      flex: 1;
      font-family: monospace;
      font-size: 0.85rem;
      word-break: keep-all;
    }

    .dns-value--wrap {
      word-break: break-all;
    }

    .dns-steps {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    .dns-steps h4 {
      margin: 0 0 0.75rem;
      font-size: 0.9rem;
    }

    .dns-steps ol {
      padding-left: 1.25rem;
      line-height: 1.8;
      font-size: 0.875rem;
    }

    .dns-note {
      margin-top: 1rem;
      padding: 0.75rem;
      background: var(--surface-ground);
      border-radius: 6px;
      font-size: 0.8rem;
      color: var(--text-color-secondary);
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .dns-note i {
      margin-top: 2px;
    }
  `]
})
export class DomainManagementComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/settings/domains';

  domains: Domain[] = [];
  loading = true;
  errorMessage = '';

  // Add domain
  showAddDialog = false;
  addDomainForm!: FormGroup;
  addingDomain = false;

  // DNS dialog
  showDnsDialog = false;
  dnsRecord: DnsRecord | null = null;

  // Verification
  verifyingDomainId: string | null = null;

  private readonly DOMAIN_PATTERN = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private clipboard: Clipboard
  ) {}

  ngOnInit(): void {
    this.addDomainForm = this.fb.group({
      domain: ['', [Validators.required, Validators.pattern(this.DOMAIN_PATTERN)]]
    });
    this.loadDomains();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDomains(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<Domain[]>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.domains = response.data || [];
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load domains.';
          this.loading = false;
        }
      });
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'VERIFIED': return 'success';
      case 'PENDING': return 'warning';
      case 'FAILED': return 'danger';
      default: return 'info';
    }
  }

  onAddDomain(): void {
    if (this.addDomainForm.invalid) {
      this.addDomainForm.markAllAsTouched();
      return;
    }

    this.addingDomain = true;

    this.http.post<ApiResponse<Domain>>(this.apiBase, this.addDomainForm.value)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.addingDomain = false)
      )
      .subscribe({
        next: (response) => {
          const domain = response.data;
          if (domain) {
            this.domains = [...this.domains, domain];
            this.showAddDialog = false;
            this.addDomainForm.reset();

            // Show DNS instructions for the new domain
            this.dnsRecord = {
              recordType: domain.dnsRecordType || 'TXT',
              recordName: `_innait-verify.${domain.domain}`,
              recordValue: domain.dnsRecordValue || ''
            };
            this.showDnsDialog = true;
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Domain Added',
            detail: `${domain?.domain} has been added. Configure DNS to verify.`
          });
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err?.error?.message || 'Failed to add domain.'
          });
        }
      });
  }

  onVerify(domain: Domain): void {
    this.verifyingDomainId = domain.id;

    this.http.post<ApiResponse<Domain>>(`${this.apiBase}/${domain.id}/verify`, {})
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.verifyingDomainId = null)
      )
      .subscribe({
        next: (response) => {
          const updated = response.data;
          if (updated) {
            const idx = this.domains.findIndex(d => d.id === domain.id);
            if (idx >= 0) {
              this.domains[idx] = updated;
              this.domains = [...this.domains];
            }
          }
          this.messageService.add({
            severity: updated?.status === 'VERIFIED' ? 'success' : 'warn',
            summary: updated?.status === 'VERIFIED' ? 'Verified' : 'Verification Pending',
            detail: updated?.status === 'VERIFIED'
              ? `${domain.domain} has been verified successfully.`
              : `${domain.domain} verification is still pending. Please check DNS configuration.`
          });
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Verification Failed',
            detail: err?.error?.message || `Failed to verify ${domain.domain}.`
          });
        }
      });
  }

  onRemove(domain: Domain): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to remove the domain "${domain.domain}"? This action cannot be undone.`,
      header: 'Remove Domain',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.delete<ApiResponse<void>>(`${this.apiBase}/${domain.id}`)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.domains = this.domains.filter(d => d.id !== domain.id);
              this.messageService.add({
                severity: 'success',
                summary: 'Domain Removed',
                detail: `${domain.domain} has been removed.`
              });
            },
            error: (err) => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: err?.error?.message || 'Failed to remove domain.'
              });
            }
          });
      }
    });
  }

  showDnsInfo(domain: Domain): void {
    this.dnsRecord = {
      recordType: domain.dnsRecordType || 'TXT',
      recordName: `_innait-verify.${domain.domain}`,
      recordValue: domain.dnsRecordValue || ''
    };
    this.showDnsDialog = true;
  }

  copyToClipboard(value: string): void {
    this.clipboard.copy(value);
    this.messageService.add({
      severity: 'info',
      summary: 'Copied',
      detail: 'Value copied to clipboard.',
      life: 2000
    });
  }
}
