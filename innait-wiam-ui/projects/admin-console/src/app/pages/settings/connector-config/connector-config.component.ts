import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { StepsModule } from 'primeng/steps';
import { InputSwitchModule } from 'primeng/inputswitch';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmationService, MessageService, MenuItem } from 'primeng/api';
import { DividerModule } from 'primeng/divider';

type ConnectorType = 'LDAP' | 'AD' | 'SCIM' | 'EMAIL' | 'SMS';
type ConnectorStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';

interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  lastSyncAt: string | null;
  config: Record<string, any>;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: { usersFound?: number; groupsFound?: number };
}

interface ConnectorTypeOption {
  type: ConnectorType;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-connector-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule,
    DialogModule,
    DropdownModule,
    StepsModule,
    InputSwitchModule,
    PasswordModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
    InputNumberModule,
    DividerModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading connectors">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'settings.connectors.loading' | translate }}</p>
    </div>

    <p-toast></p-toast>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="msg-banner" role="alert"></p-message>

    <div *ngIf="!loading" class="connectors-container">
      <!-- Header -->
      <div class="page-header">
        <h2 class="page-title">{{ 'settings.connectors.title' | translate }}</h2>
        <p-button [label]="'settings.connectors.addConnector' | translate"
                  icon="pi pi-plus"
                  (onClick)="openWizard()"
                  aria-label="Add new connector">
        </p-button>
      </div>

      <!-- Connector Cards Grid -->
      <div class="connectors-grid">
        <div *ngFor="let conn of connectors; trackBy: trackById" class="connector-card"
             (click)="openWizard(conn)" role="button" tabindex="0"
             (keydown.enter)="openWizard(conn)"
             [attr.aria-label]="'Edit connector ' + conn.name">
          <div class="connector-card-header">
            <div class="connector-name-row">
              <i [class]="getTypeIcon(conn.type) + ' connector-type-icon'"></i>
              <div>
                <div class="connector-name">{{ conn.name }}</div>
                <p-tag [value]="conn.type" [rounded]="true" styleClass="type-tag"></p-tag>
              </div>
            </div>
            <div class="status-dot" [class]="'status-dot--' + conn.status.toLowerCase()"
                 [pTooltip]="conn.status" aria-label="Status: {{ conn.status }}">
            </div>
          </div>
          <div class="connector-card-body">
            <div class="connector-sync" *ngIf="conn.lastSyncAt">
              <i class="pi pi-clock"></i>
              {{ 'settings.connectors.lastSync' | translate }}: {{ conn.lastSyncAt | date:'medium' }}
            </div>
            <div class="connector-sync" *ngIf="!conn.lastSyncAt">
              <i class="pi pi-clock"></i>
              {{ 'settings.connectors.neverSynced' | translate }}
            </div>
          </div>
          <div class="connector-card-actions" (click)="$event.stopPropagation()">
            <p-button *ngIf="conn.type === 'LDAP' || conn.type === 'AD' || conn.type === 'SCIM'"
                      icon="pi pi-sync"
                      [pTooltip]="'settings.connectors.syncNow' | translate"
                      styleClass="p-button-outlined p-button-sm"
                      [loading]="syncingId === conn.id"
                      (onClick)="onSyncNow(conn)"
                      aria-label="Sync now">
            </p-button>
            <p-button icon="pi pi-trash"
                      styleClass="p-button-outlined p-button-danger p-button-sm"
                      [pTooltip]="'settings.connectors.delete' | translate"
                      (onClick)="onDelete(conn)"
                      aria-label="Delete connector">
            </p-button>
          </div>
        </div>

        <!-- Empty state -->
        <div *ngIf="connectors.length === 0" class="empty-state">
          <i class="pi pi-link"></i>
          <p>{{ 'settings.connectors.noConnectors' | translate }}</p>
          <p-button [label]="'settings.connectors.addFirst' | translate"
                    icon="pi pi-plus" (onClick)="openWizard()"></p-button>
        </div>
      </div>
    </div>

    <!-- Wizard Dialog -->
    <p-dialog [header]="editingConnector ? ('settings.connectors.editConnector' | translate) : ('settings.connectors.addConnector' | translate)"
              [(visible)]="showWizard"
              [modal]="true"
              [style]="{ width: '720px', minHeight: '520px' }"
              [closable]="true"
              (onHide)="onWizardClose()"
              aria-label="Connector wizard">

      <!-- Steps -->
      <p-steps [model]="wizardSteps" [activeIndex]="activeStep" [readonly]="true" styleClass="wizard-steps"></p-steps>

      <div class="wizard-content">

        <!-- Step 1: Type Selection -->
        <div *ngIf="activeStep === 0" class="step-content">
          <h4>{{ 'settings.connectors.selectType' | translate }}</h4>
          <div class="type-cards">
            <div *ngFor="let opt of connectorTypes"
                 class="type-card"
                 [class.type-card--selected]="selectedType === opt.type"
                 (click)="onSelectType(opt.type)"
                 (keydown.enter)="onSelectType(opt.type)"
                 tabindex="0"
                 [attr.aria-label]="opt.label"
                 [attr.aria-selected]="selectedType === opt.type"
                 role="option">
              <i [class]="opt.icon + ' type-card-icon'"></i>
              <div class="type-card-label">{{ opt.label }}</div>
              <div class="type-card-desc">{{ opt.description }}</div>
            </div>
          </div>
        </div>

        <!-- Step 2: Configuration -->
        <div *ngIf="activeStep === 1" class="step-content">
          <h4>{{ 'settings.connectors.configure' | translate }}</h4>
          <form [formGroup]="configForm" aria-label="Connector configuration form">

            <!-- Connector Name -->
            <div class="field">
              <label for="connName" class="field-label">{{ 'settings.connectors.connectorName' | translate }} *</label>
              <input pInputText id="connName" formControlName="name" class="w-full"
                     placeholder="My LDAP Connector" aria-required="true" />
            </div>

            <!-- LDAP / AD Fields -->
            <ng-container *ngIf="selectedType === 'LDAP' || selectedType === 'AD'">
              <div class="form-row">
                <div class="field flex-1">
                  <label for="host" class="field-label">{{ 'settings.connectors.host' | translate }} *</label>
                  <input pInputText id="host" formControlName="host" class="w-full" placeholder="ldap.example.com" />
                </div>
                <div class="field" style="width: 120px;">
                  <label for="port" class="field-label">{{ 'settings.connectors.port' | translate }} *</label>
                  <p-inputNumber id="port" formControlName="port" [min]="1" [max]="65535"
                                 [useGrouping]="false" styleClass="w-full"></p-inputNumber>
                </div>
              </div>
              <div class="field">
                <label for="baseDN" class="field-label">Base DN *</label>
                <input pInputText id="baseDN" formControlName="baseDN" class="w-full"
                       placeholder="dc=example,dc=com" />
              </div>
              <div class="field">
                <label for="bindDN" class="field-label">Bind DN *</label>
                <input pInputText id="bindDN" formControlName="bindDN" class="w-full"
                       placeholder="cn=admin,dc=example,dc=com" />
              </div>
              <div class="field">
                <label for="bindPassword" class="field-label">Bind Password *</label>
                <p-password id="bindPassword" formControlName="bindPassword" [toggleMask]="true"
                            [feedback]="false" styleClass="w-full" inputStyleClass="w-full"></p-password>
              </div>
              <div class="field">
                <label for="userSearchFilter" class="field-label">{{ 'settings.connectors.userSearchFilter' | translate }}</label>
                <input pInputText id="userSearchFilter" formControlName="userSearchFilter" class="w-full"
                       placeholder="(objectClass=inetOrgPerson)" />
              </div>
              <div class="field">
                <label for="groupSearchFilter" class="field-label">{{ 'settings.connectors.groupSearchFilter' | translate }}</label>
                <input pInputText id="groupSearchFilter" formControlName="groupSearchFilter" class="w-full"
                       placeholder="(objectClass=groupOfNames)" />
              </div>
              <div class="form-row">
                <div class="field switch-field">
                  <label>{{ 'settings.connectors.useSsl' | translate }}</label>
                  <p-inputSwitch formControlName="useSsl" aria-label="Use SSL"></p-inputSwitch>
                </div>
                <div class="field" style="width: 180px;">
                  <label for="connectionTimeout" class="field-label">{{ 'settings.connectors.timeout' | translate }} (ms)</label>
                  <p-inputNumber id="connectionTimeout" formControlName="connectionTimeout"
                                 [min]="1000" [max]="60000" [useGrouping]="false"
                                 styleClass="w-full"></p-inputNumber>
                </div>
              </div>
            </ng-container>

            <!-- SCIM Fields -->
            <ng-container *ngIf="selectedType === 'SCIM'">
              <div class="field">
                <label for="endpointUrl" class="field-label">{{ 'settings.connectors.endpointUrl' | translate }} *</label>
                <input pInputText id="endpointUrl" formControlName="endpointUrl" class="w-full"
                       placeholder="https://api.example.com/scim/v2" />
              </div>
              <div class="field">
                <label for="authType" class="field-label">{{ 'settings.connectors.authType' | translate }} *</label>
                <p-dropdown id="authType" formControlName="authType"
                            [options]="[{label:'Bearer Token',value:'BEARER'},{label:'Basic Auth',value:'BASIC'}]"
                            styleClass="w-full" aria-label="Authentication type">
                </p-dropdown>
              </div>
              <div class="field">
                <label for="token" class="field-label">{{ 'settings.connectors.tokenOrCredentials' | translate }} *</label>
                <p-password id="token" formControlName="token" [toggleMask]="true"
                            [feedback]="false" styleClass="w-full" inputStyleClass="w-full"></p-password>
              </div>
              <div class="field">
                <label for="syncInterval" class="field-label">{{ 'settings.connectors.syncInterval' | translate }} (min)</label>
                <p-inputNumber id="syncInterval" formControlName="syncInterval"
                               [min]="5" [max]="1440" [useGrouping]="false"
                               styleClass="w-full"></p-inputNumber>
              </div>
            </ng-container>

            <!-- EMAIL Fields -->
            <ng-container *ngIf="selectedType === 'EMAIL'">
              <div class="form-row">
                <div class="field flex-1">
                  <label for="smtpHost" class="field-label">SMTP Host *</label>
                  <input pInputText id="smtpHost" formControlName="smtpHost" class="w-full"
                         placeholder="smtp.example.com" />
                </div>
                <div class="field" style="width: 120px;">
                  <label for="smtpPort" class="field-label">SMTP Port *</label>
                  <p-inputNumber id="smtpPort" formControlName="smtpPort" [min]="1" [max]="65535"
                                 [useGrouping]="false" styleClass="w-full"></p-inputNumber>
                </div>
              </div>
              <div class="field">
                <label for="fromAddress" class="field-label">From Address *</label>
                <input pInputText id="fromAddress" formControlName="fromAddress" class="w-full"
                       placeholder="noreply@example.com" />
              </div>
              <div class="field">
                <label for="smtpUsername" class="field-label">{{ 'settings.connectors.username' | translate }}</label>
                <input pInputText id="smtpUsername" formControlName="username" class="w-full" />
              </div>
              <div class="field">
                <label for="smtpPassword" class="field-label">{{ 'settings.connectors.password' | translate }}</label>
                <p-password id="smtpPassword" formControlName="password" [toggleMask]="true"
                            [feedback]="false" styleClass="w-full" inputStyleClass="w-full"></p-password>
              </div>
              <div class="form-row">
                <div class="field switch-field">
                  <label>Use TLS</label>
                  <p-inputSwitch formControlName="useTls" aria-label="Use TLS"></p-inputSwitch>
                </div>
                <div class="field switch-field">
                  <label>Use STARTTLS</label>
                  <p-inputSwitch formControlName="useStartTls" aria-label="Use STARTTLS"></p-inputSwitch>
                </div>
              </div>
            </ng-container>

            <!-- SMS Fields -->
            <ng-container *ngIf="selectedType === 'SMS'">
              <div class="field">
                <label for="smsProvider" class="field-label">{{ 'settings.connectors.provider' | translate }} *</label>
                <p-dropdown id="smsProvider" formControlName="provider"
                            [options]="[{label:'Twilio',value:'TWILIO'},{label:'AWS SNS',value:'AWS_SNS'}]"
                            styleClass="w-full" aria-label="SMS provider">
                </p-dropdown>
              </div>
              <div class="field">
                <label for="accountSid" class="field-label">
                  {{ configForm.get('provider')?.value === 'TWILIO' ? 'Account SID' : 'Access Key' }} *
                </label>
                <input pInputText id="accountSid" formControlName="accountSid" class="w-full" />
              </div>
              <div class="field">
                <label for="authToken" class="field-label">
                  {{ configForm.get('provider')?.value === 'TWILIO' ? 'Auth Token' : 'Secret Key' }} *
                </label>
                <p-password id="authToken" formControlName="authToken" [toggleMask]="true"
                            [feedback]="false" styleClass="w-full" inputStyleClass="w-full"></p-password>
              </div>
              <div class="field">
                <label for="fromNumber" class="field-label">{{ 'settings.connectors.fromNumber' | translate }}</label>
                <input pInputText id="fromNumber" formControlName="fromNumber" class="w-full"
                       placeholder="+1234567890" />
              </div>
            </ng-container>
          </form>
        </div>

        <!-- Step 3: Test Connection -->
        <div *ngIf="activeStep === 2" class="step-content">
          <h4>{{ 'settings.connectors.testConnection' | translate }}</h4>
          <p class="test-description">{{ 'settings.connectors.testDescription' | translate }}</p>

          <div class="test-center">
            <p-button [label]="'settings.connectors.runTest' | translate"
                      icon="pi pi-bolt"
                      [loading]="testing"
                      (onClick)="onTestConnection()"
                      styleClass="p-button-lg"
                      aria-label="Test connection">
            </p-button>
          </div>

          <!-- Test Result -->
          <div *ngIf="testResult" class="test-result" [class.test-result--success]="testResult.success"
               [class.test-result--failure]="!testResult.success" role="status">
            <div class="test-result-header">
              <i [class]="testResult.success ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
              <span>{{ testResult.success ? ('settings.connectors.testSuccess' | translate) : ('settings.connectors.testFailed' | translate) }}</span>
            </div>
            <p class="test-result-message">{{ testResult.message }}</p>
            <div *ngIf="testResult.details?.usersFound !== undefined" class="test-result-details">
              <span>{{ 'settings.connectors.usersFound' | translate }}: {{ testResult.details.usersFound }}</span>
              <span *ngIf="testResult.details.groupsFound !== undefined">
                | {{ 'settings.connectors.groupsFound' | translate }}: {{ testResult.details.groupsFound }}
              </span>
            </div>
          </div>
        </div>

        <!-- Step 4: Schedule (for LDAP/AD/SCIM) -->
        <div *ngIf="activeStep === 3" class="step-content">
          <h4>{{ 'settings.connectors.syncSchedule' | translate }}</h4>
          <div class="field">
            <label for="schedule" class="field-label">{{ 'settings.connectors.scheduleLabel' | translate }}</label>
            <p-dropdown id="schedule" [(ngModel)]="selectedSchedule"
                        [options]="scheduleOptions" styleClass="w-full"
                        aria-label="Sync schedule">
            </p-dropdown>
          </div>
          <p class="schedule-hint">{{ 'settings.connectors.scheduleHint' | translate }}</p>
        </div>
      </div>

      <!-- Wizard Footer -->
      <ng-template pTemplate="footer">
        <div class="wizard-footer">
          <p-button *ngIf="activeStep > 0"
                    [label]="'common.back' | translate"
                    icon="pi pi-arrow-left"
                    styleClass="p-button-outlined"
                    (onClick)="prevStep()"
                    aria-label="Previous step">
          </p-button>
          <div class="wizard-footer-spacer"></div>
          <p-button *ngIf="activeStep < maxStep"
                    [label]="'common.next' | translate"
                    icon="pi pi-arrow-right" iconPos="right"
                    [disabled]="!canProceed()"
                    (onClick)="nextStep()"
                    aria-label="Next step">
          </p-button>
          <p-button *ngIf="activeStep === maxStep"
                    [label]="'settings.connectors.saveActivate' | translate"
                    icon="pi pi-check"
                    [loading]="savingConnector"
                    [disabled]="savingConnector"
                    (onClick)="onSaveConnector()"
                    aria-label="Save and activate connector">
          </p-button>
        </div>
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

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }

    /* Connector Cards Grid */
    .connectors-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .connector-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 1.25rem;
      cursor: pointer;
      transition: box-shadow 0.2s, border-color 0.2s;
    }

    .connector-card:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      border-color: var(--primary-color);
    }

    .connector-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .connector-name-row {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }

    .connector-type-icon {
      font-size: 1.5rem;
      color: var(--primary-color);
      margin-top: 2px;
    }

    .connector-name {
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    :host ::ng-deep .type-tag {
      font-size: 0.65rem;
    }

    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .status-dot--active { background: #22c55e; }
    .status-dot--inactive { background: #94a3b8; }
    .status-dot--error { background: #ef4444; }

    .connector-card-body {
      margin-top: 0.75rem;
    }

    .connector-sync {
      font-size: 0.8rem;
      color: var(--text-color-secondary);
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .connector-card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--surface-border);
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-color-secondary);
    }

    .empty-state i {
      font-size: 3rem;
      display: block;
      margin-bottom: 1rem;
    }

    /* Wizard */
    :host ::ng-deep .wizard-steps {
      margin-bottom: 1.5rem;
    }

    .wizard-content {
      min-height: 320px;
    }

    .step-content h4 {
      margin: 0 0 1rem;
      font-size: 1.1rem;
    }

    /* Type Selection Cards */
    .type-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
    }

    .type-card {
      border: 2px solid var(--surface-border);
      border-radius: 8px;
      padding: 1.25rem;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }

    .type-card:hover {
      border-color: var(--primary-color);
      background: var(--surface-hover);
    }

    .type-card--selected {
      border-color: var(--primary-color);
      background: rgba(59, 130, 246, 0.06);
    }

    .type-card-icon {
      font-size: 2rem;
      color: var(--primary-color);
      display: block;
      margin-bottom: 0.5rem;
    }

    .type-card-label {
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .type-card-desc {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      line-height: 1.4;
    }

    /* Config form fields */
    .field {
      margin-bottom: 1rem;
    }

    .field-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.35rem;
      font-size: 0.85rem;
    }

    .w-full { width: 100%; }
    .flex-1 { flex: 1; }

    .form-row {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .switch-field {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .switch-field label {
      font-weight: 600;
      font-size: 0.85rem;
    }

    /* Test Connection */
    .test-description {
      color: var(--text-color-secondary);
      margin-bottom: 1.5rem;
    }

    .test-center {
      display: flex;
      justify-content: center;
      margin-bottom: 1.5rem;
    }

    .test-result {
      border-radius: 8px;
      padding: 1.25rem;
      margin-top: 1rem;
    }

    .test-result--success {
      background: #f0fdf4;
      border: 1px solid #86efac;
    }

    .test-result--failure {
      background: #fef2f2;
      border: 1px solid #fca5a5;
    }

    .test-result-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 0.5rem;
    }

    .test-result--success .test-result-header { color: #16a34a; }
    .test-result--failure .test-result-header { color: #dc2626; }

    .test-result-message {
      margin: 0;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .test-result-details {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
    }

    /* Schedule */
    .schedule-hint {
      margin-top: 0.75rem;
      font-size: 0.8rem;
      color: var(--text-color-secondary);
    }

    /* Wizard Footer */
    .wizard-footer {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .wizard-footer-spacer {
      flex: 1;
    }
  `]
})
export class ConnectorConfigComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/settings/connectors';

  connectors: Connector[] = [];
  loading = true;
  errorMessage = '';

  // Wizard state
  showWizard = false;
  activeStep = 0;
  editingConnector: Connector | null = null;
  selectedType: ConnectorType | null = null;
  configForm!: FormGroup;
  testing = false;
  testResult: TestResult | null = null;
  savingConnector = false;
  syncingId: string | null = null;
  selectedSchedule = 'MANUAL';

  wizardSteps: MenuItem[] = [
    { label: 'Type' },
    { label: 'Configuration' },
    { label: 'Test' },
    { label: 'Schedule' }
  ];

  connectorTypes: ConnectorTypeOption[] = [
    { type: 'LDAP', label: 'LDAP', description: 'Lightweight Directory Access Protocol', icon: 'pi pi-server' },
    { type: 'AD', label: 'Active Directory', description: 'Microsoft Active Directory', icon: 'pi pi-microsoft' },
    { type: 'SCIM', label: 'SCIM', description: 'System for Cross-domain Identity Management', icon: 'pi pi-cloud' },
    { type: 'EMAIL', label: 'Email (SMTP)', description: 'SMTP email sending connector', icon: 'pi pi-envelope' },
    { type: 'SMS', label: 'SMS', description: 'SMS notification gateway', icon: 'pi pi-mobile' }
  ];

  scheduleOptions = [
    { label: 'Manual Only', value: 'MANUAL' },
    { label: 'Every 15 Minutes', value: 'EVERY_15_MIN' },
    { label: 'Every Hour', value: 'EVERY_HOUR' },
    { label: 'Every 6 Hours', value: 'EVERY_6_HOURS' },
    { label: 'Daily', value: 'DAILY' }
  ];

  get maxStep(): number {
    // EMAIL and SMS don't have schedule step
    if (this.selectedType === 'EMAIL' || this.selectedType === 'SMS') {
      return 2;
    }
    return 3;
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.configForm = this.fb.group({ name: [''] });
    this.loadConnectors();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadConnectors(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<Connector[]>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.connectors = response.data || [];
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load connectors.';
          this.loading = false;
        }
      });
  }

  getTypeIcon(type: ConnectorType): string {
    return this.connectorTypes.find(t => t.type === type)?.icon || 'pi pi-cog';
  }

  openWizard(connector?: Connector): void {
    this.editingConnector = connector || null;
    this.activeStep = 0;
    this.testResult = null;
    this.selectedSchedule = 'MANUAL';

    if (connector) {
      this.selectedType = connector.type;
      this.buildConfigForm(connector.type, connector);
      this.activeStep = 1; // Skip type selection for editing
    } else {
      this.selectedType = null;
      this.configForm = this.fb.group({ name: [''] });
    }

    this.showWizard = true;
  }

  onWizardClose(): void {
    this.editingConnector = null;
    this.selectedType = null;
    this.testResult = null;
    this.activeStep = 0;
  }

  onSelectType(type: ConnectorType): void {
    this.selectedType = type;
  }

  private buildConfigForm(type: ConnectorType, existing?: Connector): void {
    const config = existing?.config || {};
    const name = existing?.name || '';

    const baseControls: Record<string, any> = {
      name: [name, [Validators.required]]
    };

    switch (type) {
      case 'LDAP':
      case 'AD':
        Object.assign(baseControls, {
          host: [config['host'] || '', [Validators.required]],
          port: [config['port'] || (type === 'LDAP' ? 389 : 389), [Validators.required]],
          baseDN: [config['baseDN'] || '', [Validators.required]],
          bindDN: [config['bindDN'] || '', [Validators.required]],
          bindPassword: [config['bindPassword'] || '', [Validators.required]],
          userSearchFilter: [config['userSearchFilter'] || ''],
          groupSearchFilter: [config['groupSearchFilter'] || ''],
          useSsl: [config['useSsl'] || false],
          connectionTimeout: [config['connectionTimeout'] || 5000]
        });
        break;

      case 'SCIM':
        Object.assign(baseControls, {
          endpointUrl: [config['endpointUrl'] || '', [Validators.required]],
          authType: [config['authType'] || 'BEARER', [Validators.required]],
          token: [config['token'] || '', [Validators.required]],
          syncInterval: [config['syncInterval'] || 60]
        });
        break;

      case 'EMAIL':
        Object.assign(baseControls, {
          smtpHost: [config['smtpHost'] || '', [Validators.required]],
          smtpPort: [config['smtpPort'] || 587, [Validators.required]],
          fromAddress: [config['fromAddress'] || '', [Validators.required, Validators.email]],
          username: [config['username'] || ''],
          password: [config['password'] || ''],
          useTls: [config['useTls'] || true],
          useStartTls: [config['useStartTls'] || false]
        });
        break;

      case 'SMS':
        Object.assign(baseControls, {
          provider: [config['provider'] || 'TWILIO', [Validators.required]],
          accountSid: [config['accountSid'] || '', [Validators.required]],
          authToken: [config['authToken'] || '', [Validators.required]],
          fromNumber: [config['fromNumber'] || '']
        });
        break;
    }

    this.configForm = this.fb.group(baseControls);
  }

  canProceed(): boolean {
    switch (this.activeStep) {
      case 0: return this.selectedType !== null;
      case 1: return this.configForm.valid;
      case 2: return true; // Test is optional but recommended
      case 3: return true;
      default: return false;
    }
  }

  nextStep(): void {
    if (this.activeStep === 0 && this.selectedType) {
      this.buildConfigForm(this.selectedType, this.editingConnector || undefined);
    }
    if (this.activeStep < this.maxStep) {
      this.activeStep++;
    }
  }

  prevStep(): void {
    if (this.activeStep > 0) {
      this.activeStep--;
    }
  }

  onTestConnection(): void {
    this.testing = true;
    this.testResult = null;

    const payload = {
      type: this.selectedType,
      config: this.getConfigPayload()
    };

    this.http.post<ApiResponse<TestResult>>(`${this.apiBase}/test`, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.testing = false)
      )
      .subscribe({
        next: (response) => {
          this.testResult = response.data || { success: false, message: 'No response received.' };
        },
        error: (err) => {
          this.testResult = {
            success: false,
            message: err?.error?.message || 'Connection test failed. Please check your configuration.'
          };
        }
      });
  }

  private getConfigPayload(): Record<string, any> {
    const formValue = { ...this.configForm.value };
    const name = formValue.name;
    delete formValue.name;
    return formValue;
  }

  onSaveConnector(): void {
    this.savingConnector = true;

    const payload = {
      name: this.configForm.get('name')?.value,
      type: this.selectedType,
      config: this.getConfigPayload(),
      schedule: this.selectedSchedule
    };

    const request$ = this.editingConnector
      ? this.http.put<ApiResponse<Connector>>(`${this.apiBase}/${this.editingConnector.id}`, payload)
      : this.http.post<ApiResponse<Connector>>(this.apiBase, payload);

    request$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.savingConnector = false)
      )
      .subscribe({
        next: (response) => {
          if (this.editingConnector && response.data) {
            const idx = this.connectors.findIndex(c => c.id === this.editingConnector!.id);
            if (idx >= 0) {
              this.connectors[idx] = response.data;
              this.connectors = [...this.connectors];
            }
          } else if (response.data) {
            this.connectors = [...this.connectors, response.data];
          }
          this.showWizard = false;
          this.messageService.add({
            severity: 'success',
            summary: this.editingConnector ? 'Connector Updated' : 'Connector Created',
            detail: `${payload.name} has been ${this.editingConnector ? 'updated' : 'created and activated'}.`
          });
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err?.error?.message || 'Failed to save connector.'
          });
        }
      });
  }

  onSyncNow(connector: Connector): void {
    this.syncingId = connector.id;

    this.http.post<ApiResponse<{ lastSyncAt: string }>>(`${this.apiBase}/${connector.id}/sync`, {})
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.syncingId = null)
      )
      .subscribe({
        next: (response) => {
          connector.lastSyncAt = response.data?.lastSyncAt || new Date().toISOString();
          this.messageService.add({
            severity: 'success',
            summary: 'Sync Complete',
            detail: `${connector.name} synchronization completed.`
          });
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Sync Failed',
            detail: err?.error?.message || `Sync failed for ${connector.name}.`
          });
        }
      });
  }

  onDelete(connector: Connector): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the connector "${connector.name}"? This action cannot be undone.`,
      header: 'Delete Connector',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.http.delete<ApiResponse<void>>(`${this.apiBase}/${connector.id}`)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.connectors = this.connectors.filter(c => c.id !== connector.id);
              this.messageService.add({
                severity: 'success',
                summary: 'Connector Deleted',
                detail: `${connector.name} has been removed.`
              });
            },
            error: (err) => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: err?.error?.message || 'Failed to delete connector.'
              });
            }
          });
      }
    });
  }

  trackById(_index: number, conn: Connector): string {
    return conn.id;
  }
}
