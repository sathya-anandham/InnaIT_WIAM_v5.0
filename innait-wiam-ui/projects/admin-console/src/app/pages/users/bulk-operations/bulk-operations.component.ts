import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  Subject,
  takeUntil,
  timer,
  switchMap,
  takeWhile,
  finalize,
} from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse, PaginationMeta, Account } from '@innait/core';

import { StepsModule } from 'primeng/steps';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface BulkAction {
  value: string;
  label: string;
  destructive: boolean;
  requiresInput: 'ROLE' | 'GROUP' | null;
}

interface AccountSearchResult {
  id: string;
  loginId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  department: string;
  userType: string;
}

interface CsvAccountRow {
  identifier: string;
  found: boolean;
  account: AccountSearchResult | null;
}

interface BulkOperationJobStatus {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
}

interface BulkOperationResult {
  accountId: string;
  loginId: string;
  outcome: 'SUCCESS' | 'FAILURE';
  errorMessage: string | null;
}

interface RoleOption {
  label: string;
  value: string;
}

interface GroupOption {
  label: string;
  value: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BULK_ACTIONS: BulkAction[] = [
  { value: 'SUSPEND', label: 'Suspend selected accounts', destructive: false, requiresInput: null },
  { value: 'ACTIVATE', label: 'Activate selected accounts', destructive: false, requiresInput: null },
  { value: 'DISABLE', label: 'Disable selected accounts', destructive: true, requiresInput: null },
  { value: 'TERMINATE', label: 'Terminate selected accounts', destructive: true, requiresInput: null },
  { value: 'FORCE_PASSWORD_CHANGE', label: 'Force password change', destructive: false, requiresInput: null },
  { value: 'ASSIGN_ROLE', label: 'Assign role', destructive: false, requiresInput: 'ROLE' },
  { value: 'REMOVE_ROLE', label: 'Remove role', destructive: false, requiresInput: 'ROLE' },
  { value: 'ADD_TO_GROUP', label: 'Add to group', destructive: false, requiresInput: 'GROUP' },
  { value: 'REMOVE_FROM_GROUP', label: 'Remove from group', destructive: false, requiresInput: 'GROUP' },
];

const API_BASE = '/api/v1/admin';
const POLL_INTERVAL_MS = 2000;
const MAX_DISPLAY_ACCOUNTS = 20;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

@Component({
  selector: 'app-bulk-operations',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    StepsModule,
    TableModule,
    ButtonModule,
    ProgressBarModule,
    DropdownModule,
    CardModule,
    MessageModule,
    TagModule,
    DialogModule,
    ProgressSpinnerModule,
  ],
  template: `
    <div class="bulk-ops-container" role="main" aria-label="Bulk operations wizard">
      <!-- Steps navigation -->
      <p-steps
        [model]="steps"
        [activeIndex]="activeStep"
        [readonly]="true"
        styleClass="bulk-ops-steps"
        aria-label="Bulk operation progress steps">
      </p-steps>

      <!-- ============================================================ -->
      <!--  STEP 1 - SELECT ACCOUNTS                                     -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 0" class="step-content" role="region" aria-label="Select accounts step">
        <p-card header="{{ 'bulkOps.select.title' | translate }}">

          <!-- Selection mode toggle -->
          <div class="selection-mode-toggle" role="tablist" aria-label="Account selection method">
            <button
              class="mode-btn"
              [class.active]="selectionMode === 'search'"
              (click)="selectionMode = 'search'"
              role="tab"
              [attr.aria-selected]="selectionMode === 'search'"
              aria-controls="search-panel">
              <i class="pi pi-search" aria-hidden="true"></i>
              {{ 'bulkOps.select.searchAndSelect' | translate }}
            </button>
            <button
              class="mode-btn"
              [class.active]="selectionMode === 'csv'"
              (click)="selectionMode = 'csv'"
              role="tab"
              [attr.aria-selected]="selectionMode === 'csv'"
              aria-controls="csv-panel">
              <i class="pi pi-file" aria-hidden="true"></i>
              {{ 'bulkOps.select.uploadCsv' | translate }}
            </button>
          </div>

          <!-- Option A: Search & Select -->
          <div
            *ngIf="selectionMode === 'search'"
            id="search-panel"
            role="tabpanel"
            class="search-panel">

            <!-- Search filters -->
            <div class="search-filters" role="search" aria-label="Account search filters">
              <div class="filter-row">
                <div class="filter-item">
                  <label for="filter-status">{{ 'bulkOps.select.status' | translate }}</label>
                  <p-dropdown
                    id="filter-status"
                    [options]="statusOptions"
                    [(ngModel)]="searchFilters.status"
                    placeholder="{{ 'bulkOps.select.allStatuses' | translate }}"
                    [showClear]="true"
                    [style]="{ width: '100%' }"
                    aria-label="Filter by status">
                  </p-dropdown>
                </div>
                <div class="filter-item">
                  <label for="filter-department">{{ 'bulkOps.select.department' | translate }}</label>
                  <p-dropdown
                    id="filter-department"
                    [options]="departmentOptions"
                    [(ngModel)]="searchFilters.department"
                    placeholder="{{ 'bulkOps.select.allDepartments' | translate }}"
                    [showClear]="true"
                    [style]="{ width: '100%' }"
                    aria-label="Filter by department">
                  </p-dropdown>
                </div>
                <div class="filter-item">
                  <label for="filter-usertype">{{ 'bulkOps.select.userType' | translate }}</label>
                  <p-dropdown
                    id="filter-usertype"
                    [options]="userTypeOptions"
                    [(ngModel)]="searchFilters.userType"
                    placeholder="{{ 'bulkOps.select.allUserTypes' | translate }}"
                    [showClear]="true"
                    [style]="{ width: '100%' }"
                    aria-label="Filter by user type">
                  </p-dropdown>
                </div>
                <div class="filter-item filter-action">
                  <label>&nbsp;</label>
                  <p-button
                    label="{{ 'bulkOps.select.search' | translate }}"
                    icon="pi pi-search"
                    (onClick)="searchAccounts()"
                    [loading]="isSearching"
                    aria-label="Search accounts">
                  </p-button>
                </div>
              </div>
            </div>

            <!-- Search results table -->
            <p-table
              *ngIf="searchResults.length > 0 || isSearching"
              [value]="searchResults"
              [paginator]="true"
              [rows]="10"
              [totalRecords]="searchTotalRecords"
              [lazy]="true"
              (onLazyLoad)="onSearchPageChange($event)"
              [(selection)]="selectedAccounts"
              dataKey="id"
              [loading]="isSearching"
              styleClass="p-datatable-sm p-datatable-striped"
              [tableStyle]="{ 'min-width': '50rem' }"
              aria-label="Account search results">
              <ng-template pTemplate="header">
                <tr>
                  <th style="width: 3rem">
                    <p-tableHeaderCheckbox aria-label="Select all accounts"></p-tableHeaderCheckbox>
                  </th>
                  <th>{{ 'bulkOps.select.loginId' | translate }}</th>
                  <th>{{ 'bulkOps.select.name' | translate }}</th>
                  <th>{{ 'bulkOps.select.email' | translate }}</th>
                  <th>{{ 'bulkOps.select.status' | translate }}</th>
                  <th>{{ 'bulkOps.select.department' | translate }}</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-account>
                <tr>
                  <td>
                    <p-tableCheckbox
                      [value]="account"
                      [attr.aria-label]="'Select account ' + account.loginId">
                    </p-tableCheckbox>
                  </td>
                  <td>{{ account.loginId }}</td>
                  <td>{{ account.firstName }} {{ account.lastName }}</td>
                  <td>{{ account.email }}</td>
                  <td>
                    <p-tag
                      [value]="account.status"
                      [severity]="getStatusSeverity(account.status)">
                    </p-tag>
                  </td>
                  <td>{{ account.department }}</td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="6" class="text-center">
                    {{ 'bulkOps.select.noResults' | translate }}
                  </td>
                </tr>
              </ng-template>
            </p-table>

            <!-- Selected count -->
            <div *ngIf="selectedAccounts.length > 0" class="selected-count" role="status" aria-live="polite">
              <p-tag
                severity="info"
                [value]="selectedAccounts.length + ' accounts selected'"
                icon="pi pi-check">
              </p-tag>
            </div>
          </div>

          <!-- Option B: Upload CSV -->
          <div
            *ngIf="selectionMode === 'csv'"
            id="csv-panel"
            role="tabpanel"
            class="csv-panel">

            <p class="csv-instructions">
              {{ 'bulkOps.select.csvInstructions' | translate }}
            </p>

            <!-- Drop zone for CSV -->
            <div
              class="drop-zone"
              [class.drag-over]="isCsvDragOver"
              [class.has-file]="!!csvFile"
              (dragover)="onCsvDragOver($event)"
              (dragleave)="onCsvDragLeave($event)"
              (drop)="onCsvDrop($event)"
              role="button"
              tabindex="0"
              (keydown.enter)="csvFileInput.click()"
              (keydown.space)="csvFileInput.click(); $event.preventDefault()"
              [attr.aria-label]="csvFile
                ? 'CSV file selected: ' + csvFile.name
                : 'Drop CSV file here or press Enter to browse'">

              <div *ngIf="!csvFile" class="drop-zone-content">
                <i class="pi pi-file drop-icon-sm" aria-hidden="true"></i>
                <p class="drop-text-sm">{{ 'bulkOps.select.dropCsv' | translate }}</p>
                <p-button
                  label="{{ 'bulkOps.select.browseCsv' | translate }}"
                  icon="pi pi-folder-open"
                  styleClass="p-button-outlined p-button-sm"
                  (onClick)="csvFileInput.click()"
                  aria-label="Browse for CSV file">
                </p-button>
              </div>

              <div *ngIf="csvFile" class="file-info">
                <i class="pi pi-file file-icon-sm" aria-hidden="true"></i>
                <span class="file-name">{{ csvFile.name }}</span>
                <p-button
                  icon="pi pi-times"
                  styleClass="p-button-rounded p-button-text p-button-danger p-button-sm"
                  (onClick)="clearCsvFile(); $event.stopPropagation()"
                  aria-label="Remove CSV file">
                </p-button>
              </div>
            </div>

            <input
              #csvFileInput
              type="file"
              accept=".csv"
              (change)="onCsvFileSelected($event)"
              class="hidden-input"
              aria-hidden="true" />

            <!-- CSV error -->
            <p-message
              *ngIf="csvUploadError"
              severity="error"
              [text]="csvUploadError"
              styleClass="csv-error-msg">
            </p-message>

            <!-- CSV loading -->
            <div *ngIf="isValidatingCsv" class="parsing-indicator" role="status" aria-live="polite">
              <p-progressSpinner
                strokeWidth="4"
                [style]="{ width: '30px', height: '30px' }"
                aria-label="Validating CSV accounts">
              </p-progressSpinner>
              <span>{{ 'bulkOps.select.validatingCsv' | translate }}</span>
            </div>

            <!-- CSV preview -->
            <div *ngIf="csvAccountRows.length > 0 && !isValidatingCsv" class="csv-preview">
              <div class="csv-summary" role="status">
                <p-tag
                  severity="success"
                  [value]="csvFoundCount + ' found'"
                  icon="pi pi-check-circle">
                </p-tag>
                <p-tag
                  *ngIf="csvNotFoundCount > 0"
                  severity="danger"
                  [value]="csvNotFoundCount + ' not found'"
                  icon="pi pi-times-circle">
                </p-tag>
              </div>
              <p-table
                [value]="csvAccountRows"
                [scrollable]="true"
                scrollHeight="300px"
                styleClass="p-datatable-sm p-datatable-striped"
                aria-label="CSV account validation results">
                <ng-template pTemplate="header">
                  <tr>
                    <th style="width: 3rem">Status</th>
                    <th>{{ 'bulkOps.select.identifier' | translate }}</th>
                    <th>{{ 'bulkOps.select.name' | translate }}</th>
                    <th>{{ 'bulkOps.select.email' | translate }}</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-row>
                  <tr [class.not-found-row]="!row.found">
                    <td>
                      <i
                        *ngIf="row.found"
                        class="pi pi-check-circle text-success"
                        aria-label="Account found">
                      </i>
                      <i
                        *ngIf="!row.found"
                        class="pi pi-times-circle text-danger"
                        aria-label="Account not found">
                      </i>
                    </td>
                    <td>{{ row.identifier }}</td>
                    <td>{{ row.account ? row.account.firstName + ' ' + row.account.lastName : '-' }}</td>
                    <td>{{ row.account?.email || '-' }}</td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </div>

          <!-- Step actions -->
          <div class="step-actions">
            <p-button
              label="{{ 'common.next' | translate }}"
              icon="pi pi-arrow-right"
              iconPos="right"
              [disabled]="!canProceedFromSelect"
              (onClick)="goToStep(1)"
              aria-label="Proceed to choose action">
            </p-button>
          </div>
        </p-card>
      </div>

      <!-- ============================================================ -->
      <!--  STEP 2 - CHOOSE ACTION                                      -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 1" class="step-content" role="region" aria-label="Choose action step">
        <p-card header="{{ 'bulkOps.action.title' | translate }}">
          <form [formGroup]="actionForm" class="action-form">

            <!-- Selected accounts count -->
            <div class="selected-info" role="status">
              <i class="pi pi-users" aria-hidden="true"></i>
              <span>{{ effectiveSelectedAccounts.length }} {{ 'bulkOps.action.accountsSelected' | translate }}</span>
            </div>

            <!-- Action dropdown -->
            <div class="form-field">
              <label for="action-select">{{ 'bulkOps.action.chooseAction' | translate }} <span class="required-marker" aria-label="required">*</span></label>
              <p-dropdown
                id="action-select"
                [options]="actionOptions"
                formControlName="action"
                placeholder="{{ 'bulkOps.action.selectAction' | translate }}"
                [style]="{ width: '100%' }"
                (onChange)="onActionChanged()"
                aria-label="Select bulk action">
              </p-dropdown>
            </div>

            <!-- Role selector (for ASSIGN_ROLE / REMOVE_ROLE) -->
            <div *ngIf="selectedActionRequiresInput === 'ROLE'" class="form-field">
              <label for="role-select">{{ 'bulkOps.action.selectRole' | translate }} <span class="required-marker" aria-label="required">*</span></label>
              <p-dropdown
                id="role-select"
                [options]="roleOptions"
                formControlName="targetRole"
                placeholder="{{ 'bulkOps.action.chooseRole' | translate }}"
                [style]="{ width: '100%' }"
                [loading]="isLoadingRoles"
                aria-label="Select role">
              </p-dropdown>
            </div>

            <!-- Group selector (for ADD_TO_GROUP / REMOVE_FROM_GROUP) -->
            <div *ngIf="selectedActionRequiresInput === 'GROUP'" class="form-field">
              <label for="group-select">{{ 'bulkOps.action.selectGroup' | translate }} <span class="required-marker" aria-label="required">*</span></label>
              <p-dropdown
                id="group-select"
                [options]="groupOptions"
                formControlName="targetGroup"
                placeholder="{{ 'bulkOps.action.chooseGroup' | translate }}"
                [style]="{ width: '100%' }"
                [loading]="isLoadingGroups"
                aria-label="Select group">
              </p-dropdown>
            </div>

            <!-- Reason / justification -->
            <div class="form-field">
              <label for="reason-input">
                {{ 'bulkOps.action.reason' | translate }} <span class="required-marker" aria-label="required">*</span>
              </label>
              <textarea
                id="reason-input"
                formControlName="reason"
                rows="4"
                class="reason-textarea"
                placeholder="{{ 'bulkOps.action.reasonPlaceholder' | translate }}"
                aria-label="Reason or justification for this operation">
              </textarea>
              <small
                *ngIf="actionForm.get('reason')?.touched && actionForm.get('reason')?.hasError('required')"
                class="field-error"
                role="alert">
                {{ 'bulkOps.action.reasonRequired' | translate }}
              </small>
              <small
                *ngIf="actionForm.get('reason')?.touched && actionForm.get('reason')?.hasError('minlength')"
                class="field-error"
                role="alert">
                {{ 'bulkOps.action.reasonMinLength' | translate }}
              </small>
            </div>
          </form>

          <div class="step-actions">
            <p-button
              label="{{ 'common.back' | translate }}"
              icon="pi pi-arrow-left"
              styleClass="p-button-outlined"
              (onClick)="goToStep(0)"
              aria-label="Go back to account selection">
            </p-button>
            <p-button
              label="{{ 'common.next' | translate }}"
              icon="pi pi-arrow-right"
              iconPos="right"
              [disabled]="!canProceedFromAction"
              (onClick)="goToStep(2)"
              aria-label="Proceed to confirmation">
            </p-button>
          </div>
        </p-card>
      </div>

      <!-- ============================================================ -->
      <!--  STEP 3 - CONFIRM                                            -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 2" class="step-content" role="region" aria-label="Confirmation step">
        <p-card header="{{ 'bulkOps.confirm.title' | translate }}">

          <!-- Warning for destructive actions -->
          <p-message
            *ngIf="isDestructiveAction"
            severity="warn"
            [text]="'bulkOps.confirm.destructiveWarning' | translate"
            styleClass="destructive-warning">
          </p-message>

          <!-- Summary -->
          <div class="confirm-summary">
            <div class="confirm-detail">
              <span class="confirm-label">{{ 'bulkOps.confirm.action' | translate }}:</span>
              <span class="confirm-value">
                <p-tag
                  [value]="selectedActionLabel"
                  [severity]="isDestructiveAction ? 'danger' : 'info'">
                </p-tag>
              </span>
            </div>

            <div class="confirm-detail">
              <span class="confirm-label">{{ 'bulkOps.confirm.affectedAccounts' | translate }}:</span>
              <span class="confirm-value">{{ effectiveSelectedAccounts.length }}</span>
            </div>

            <div *ngIf="selectedActionRequiresInput === 'ROLE'" class="confirm-detail">
              <span class="confirm-label">{{ 'bulkOps.confirm.role' | translate }}:</span>
              <span class="confirm-value">{{ selectedRoleLabel }}</span>
            </div>

            <div *ngIf="selectedActionRequiresInput === 'GROUP'" class="confirm-detail">
              <span class="confirm-label">{{ 'bulkOps.confirm.group' | translate }}:</span>
              <span class="confirm-value">{{ selectedGroupLabel }}</span>
            </div>

            <div class="confirm-detail">
              <span class="confirm-label">{{ 'bulkOps.confirm.reason' | translate }}:</span>
              <span class="confirm-value reason-text">{{ actionForm.get('reason')?.value }}</span>
            </div>
          </div>

          <!-- Affected accounts list -->
          <div class="affected-accounts" aria-label="Affected accounts list">
            <h4>{{ 'bulkOps.confirm.accountList' | translate }}</h4>
            <div class="account-list" role="list">
              <div
                *ngFor="let account of displayedConfirmAccounts"
                class="account-chip"
                role="listitem">
                {{ account.loginId }}
              </div>
              <div
                *ngIf="effectiveSelectedAccounts.length > MAX_DISPLAY_ACCOUNTS"
                class="more-accounts">
                {{ 'bulkOps.confirm.andMore' | translate: { count: $any(effectiveSelectedAccounts.length - MAX_DISPLAY_ACCOUNTS) } }}
              </div>
            </div>
          </div>

          <div class="step-actions">
            <p-button
              label="{{ 'common.cancel' | translate }}"
              icon="pi pi-times"
              styleClass="p-button-outlined"
              (onClick)="goToStep(1)"
              aria-label="Go back to action selection">
            </p-button>
            <p-button
              label="{{ 'bulkOps.confirm.confirmAndExecute' | translate }}"
              icon="pi pi-check"
              [styleClass]="isDestructiveAction ? 'p-button-danger' : ''"
              (onClick)="executeOperation()"
              [loading]="isExecuting"
              aria-label="Confirm and execute bulk operation">
            </p-button>
          </div>
        </p-card>
      </div>

      <!-- ============================================================ -->
      <!--  STEP 4 - PROGRESS & RESULTS                                 -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 3" class="step-content" role="region" aria-label="Progress and results step">
        <p-card header="{{ 'bulkOps.results.title' | translate }}">

          <!-- Progress section -->
          <div *ngIf="isPolling" class="progress-section" role="status" aria-live="polite">
            <h4>{{ 'bulkOps.results.processing' | translate }}</h4>
            <p-progressBar
              [value]="operationProgress"
              [showValue]="true"
              aria-label="Operation progress">
            </p-progressBar>
            <div class="processing-stats">
              <span>{{ 'bulkOps.results.processed' | translate }}:
                {{ operationStatus?.processed || 0 }} / {{ operationStatus?.total || 0 }}</span>
            </div>
          </div>

          <!-- Results section -->
          <div *ngIf="!isPolling && operationResults.length > 0">

            <!-- Results summary -->
            <div class="results-summary" role="group" aria-label="Operation results summary">
              <div class="summary-card summary-success">
                <i class="pi pi-check-circle" aria-hidden="true"></i>
                <div class="summary-value">{{ operationSucceededCount }}</div>
                <div class="summary-label">{{ 'bulkOps.results.succeeded' | translate }}</div>
              </div>
              <div class="summary-card summary-failed">
                <i class="pi pi-times-circle" aria-hidden="true"></i>
                <div class="summary-value">{{ operationFailedCount }}</div>
                <div class="summary-label">{{ 'bulkOps.results.failed' | translate }}</div>
              </div>
            </div>

            <!-- Results table -->
            <p-table
              [value]="operationResults"
              [paginator]="operationResults.length > 10"
              [rows]="10"
              styleClass="p-datatable-sm p-datatable-striped"
              [tableStyle]="{ 'min-width': '40rem' }"
              aria-label="Operation results per account">
              <ng-template pTemplate="header">
                <tr>
                  <th>{{ 'bulkOps.results.accountId' | translate }}</th>
                  <th>{{ 'bulkOps.results.loginId' | translate }}</th>
                  <th>{{ 'bulkOps.results.outcome' | translate }}</th>
                  <th>{{ 'bulkOps.results.errorMessage' | translate }}</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-result>
                <tr>
                  <td>{{ result.accountId }}</td>
                  <td>{{ result.loginId }}</td>
                  <td>
                    <p-tag
                      [value]="result.outcome"
                      [severity]="result.outcome === 'SUCCESS' ? 'success' : 'danger'">
                    </p-tag>
                  </td>
                  <td class="text-danger">{{ result.errorMessage || '-' }}</td>
                </tr>
              </ng-template>
            </p-table>

            <!-- Actions -->
            <div class="step-actions results-actions">
              <p-button
                label="{{ 'bulkOps.results.downloadResults' | translate }}"
                icon="pi pi-download"
                styleClass="p-button-outlined"
                (onClick)="downloadResults()"
                aria-label="Download results as CSV">
              </p-button>
              <p-button
                label="{{ 'bulkOps.results.newOperation' | translate }}"
                icon="pi pi-refresh"
                (onClick)="resetWizard()"
                aria-label="Start a new bulk operation">
              </p-button>
            </div>
          </div>

          <!-- Error if execution failed before getting results -->
          <div *ngIf="!isPolling && operationResults.length === 0 && executionError" class="execution-error">
            <p-message
              severity="error"
              [text]="executionError">
            </p-message>
            <div class="step-actions">
              <p-button
                label="{{ 'common.back' | translate }}"
                icon="pi pi-arrow-left"
                styleClass="p-button-outlined"
                (onClick)="goToStep(2)"
                aria-label="Go back to confirmation">
              </p-button>
            </div>
          </div>
        </p-card>
      </div>
    </div>
  `,
  styles: [`
    .bulk-ops-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    :host ::ng-deep .bulk-ops-steps {
      margin-bottom: 24px;
    }

    .step-content {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Selection mode toggle */
    .selection-mode-toggle {
      display: flex;
      gap: 0;
      margin-bottom: 24px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      overflow: hidden;
    }

    .mode-btn {
      flex: 1;
      padding: 12px 20px;
      border: none;
      background: var(--surface-ground, #f8f9fa);
      color: var(--text-color, #333);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .mode-btn:hover {
      background: var(--surface-100, #e9ecef);
    }

    .mode-btn.active {
      background: var(--primary-color, #3b82f6);
      color: white;
    }

    .mode-btn:first-child {
      border-right: 1px solid var(--surface-border, #dee2e6);
    }

    /* Search filters */
    .search-filters {
      margin-bottom: 20px;
    }

    .filter-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      align-items: end;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .filter-item label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-color, #333);
    }

    .filter-action {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }

    .selected-count {
      margin-top: 12px;
    }

    .text-center {
      text-align: center;
    }

    /* CSV panel */
    .csv-panel {
      padding: 0;
    }

    .csv-instructions {
      font-size: 13px;
      color: var(--text-color-secondary, #6b7280);
      margin-bottom: 16px;
    }

    .csv-error-msg {
      margin-top: 12px;
      width: 100%;
    }

    .csv-preview {
      margin-top: 16px;
    }

    .csv-summary {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .not-found-row {
      background: var(--red-50, #fef2f2) !important;
    }

    /* Drop zone */
    .drop-zone {
      border: 2px dashed var(--surface-border, #dee2e6);
      border-radius: 12px;
      padding: 32px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--surface-ground, #f8f9fa);
    }

    .drop-zone:hover,
    .drop-zone:focus-visible {
      border-color: var(--primary-color, #3b82f6);
      background: var(--primary-50, #eff6ff);
      outline: none;
    }

    .drop-zone.drag-over {
      border-color: var(--primary-color, #3b82f6);
      background: var(--primary-100, #dbeafe);
      transform: scale(1.01);
    }

    .drop-zone.has-file {
      border-style: solid;
      border-color: var(--green-500, #22c55e);
      background: var(--green-50, #f0fdf4);
      padding: 16px 24px;
    }

    .drop-zone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .drop-icon-sm {
      font-size: 36px;
      color: var(--primary-color, #3b82f6);
    }

    .drop-text-sm {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color, #333);
      margin: 0;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: center;
    }

    .file-icon-sm {
      font-size: 28px;
      color: var(--green-600, #16a34a);
    }

    .file-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-color, #333);
    }

    .hidden-input {
      display: none;
    }

    .parsing-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: center;
      padding: 16px;
      color: var(--text-color-secondary, #6b7280);
    }

    /* Action form */
    .action-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .selected-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--blue-50, #eff6ff);
      border-radius: 8px;
      color: var(--blue-700, #1d4ed8);
      font-size: 14px;
      font-weight: 500;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-field label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-color, #333);
    }

    .required-marker {
      color: var(--red-500, #ef4444);
      margin-left: 2px;
    }

    .reason-textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
      transition: border-color 0.2s ease;
    }

    .reason-textarea:focus {
      outline: none;
      border-color: var(--primary-color, #3b82f6);
      box-shadow: 0 0 0 2px var(--primary-100, #dbeafe);
    }

    .field-error {
      color: var(--red-600, #dc2626);
      font-size: 12px;
    }

    /* Confirmation */
    .destructive-warning {
      margin-bottom: 20px;
      width: 100%;
    }

    .confirm-summary {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px;
      background: var(--surface-ground, #f8f9fa);
      border-radius: 12px;
      margin-bottom: 24px;
    }

    .confirm-detail {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .confirm-label {
      font-weight: 600;
      font-size: 13px;
      color: var(--text-color-secondary, #6b7280);
      min-width: 140px;
      flex-shrink: 0;
    }

    .confirm-value {
      font-size: 14px;
      color: var(--text-color, #333);
    }

    .reason-text {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .affected-accounts h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color, #333);
    }

    .account-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
      padding: 12px;
      background: var(--surface-ground, #f8f9fa);
      border-radius: 8px;
    }

    .account-chip {
      padding: 4px 12px;
      background: var(--surface-card, #ffffff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 16px;
      font-size: 13px;
      font-family: monospace;
    }

    .more-accounts {
      padding: 4px 12px;
      color: var(--text-color-secondary, #6b7280);
      font-size: 13px;
      font-style: italic;
    }

    /* Progress */
    .progress-section {
      text-align: center;
      padding: 24px 0;
      max-width: 600px;
      margin: 0 auto;
    }

    .progress-section h4 {
      margin: 0 0 16px 0;
      color: var(--text-color, #333);
    }

    .processing-stats {
      margin-top: 12px;
      font-size: 13px;
      color: var(--text-color-secondary, #6b7280);
    }

    /* Results */
    .results-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
      border-radius: 12px;
      gap: 8px;
    }

    .summary-card i {
      font-size: 32px;
    }

    .summary-value {
      font-size: 28px;
      font-weight: 700;
    }

    .summary-label {
      font-size: 13px;
      color: var(--text-color-secondary, #6b7280);
    }

    .summary-success {
      background: var(--green-50, #f0fdf4);
    }
    .summary-success i,
    .summary-success .summary-value {
      color: var(--green-600, #16a34a);
    }

    .summary-failed {
      background: var(--red-50, #fef2f2);
    }
    .summary-failed i,
    .summary-failed .summary-value {
      color: var(--red-600, #dc2626);
    }

    .text-success {
      color: var(--green-600, #16a34a);
    }

    .text-danger {
      color: var(--red-600, #dc2626);
    }

    .execution-error {
      text-align: center;
      padding: 24px 0;
    }

    /* Step actions */
    .step-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--surface-border, #dee2e6);
    }

    .results-actions {
      flex-wrap: wrap;
    }
  `],
})
export class BulkOperationsComponent implements OnInit, OnDestroy {
  readonly MAX_DISPLAY_ACCOUNTS = MAX_DISPLAY_ACCOUNTS;

  /* Step configuration */
  steps = [
    { label: 'Select Accounts' },
    { label: 'Choose Action' },
    { label: 'Confirm' },
    { label: 'Results' },
  ];
  activeStep = 0;

  /* Step 1 - Select Accounts */
  selectionMode: 'search' | 'csv' = 'search';

  // Search & Select
  searchFilters = {
    status: null as string | null,
    department: null as string | null,
    userType: null as string | null,
  };
  statusOptions = [
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Suspended', value: 'SUSPENDED' },
    { label: 'Disabled', value: 'DISABLED' },
    { label: 'Pending', value: 'PENDING' },
  ];
  departmentOptions: Array<{ label: string; value: string }> = [];
  userTypeOptions = [
    { label: 'Employee', value: 'EMPLOYEE' },
    { label: 'Contractor', value: 'CONTRACTOR' },
    { label: 'Service', value: 'SERVICE' },
    { label: 'Admin', value: 'ADMIN' },
  ];
  isSearching = false;
  searchResults: AccountSearchResult[] = [];
  searchTotalRecords = 0;
  selectedAccounts: AccountSearchResult[] = [];
  currentSearchPage = 0;

  // CSV upload
  csvFile: File | null = null;
  isCsvDragOver = false;
  csvUploadError: string | null = null;
  isValidatingCsv = false;
  csvAccountRows: CsvAccountRow[] = [];

  /* Step 2 - Choose Action */
  actionForm!: FormGroup;
  actionOptions = BULK_ACTIONS.map((a) => ({
    label: a.label,
    value: a.value,
  }));
  roleOptions: RoleOption[] = [];
  groupOptions: GroupOption[] = [];
  isLoadingRoles = false;
  isLoadingGroups = false;

  /* Step 3 - Confirm */
  // (computed properties below)

  /* Step 4 - Results */
  isExecuting = false;
  isPolling = false;
  operationJobId: string | null = null;
  operationStatus: BulkOperationJobStatus | null = null;
  operationProgress = 0;
  operationResults: BulkOperationResult[] = [];
  executionError: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.actionForm = this.fb.group({
      action: [null, Validators.required],
      targetRole: [null],
      targetGroup: [null],
      reason: ['', [Validators.required, Validators.minLength(10)]],
    });

    this.loadDepartments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ================================================================ */
  /*  Computed helpers                                                  */
  /* ================================================================ */

  get canProceedFromSelect(): boolean {
    if (this.selectionMode === 'search') {
      return this.selectedAccounts.length > 0;
    }
    return this.csvFoundCount > 0;
  }

  get canProceedFromAction(): boolean {
    if (!this.actionForm.get('action')?.value) return false;
    if (!this.actionForm.get('reason')?.valid) return false;

    const action = this.getSelectedAction();
    if (action?.requiresInput === 'ROLE' && !this.actionForm.get('targetRole')?.value) return false;
    if (action?.requiresInput === 'GROUP' && !this.actionForm.get('targetGroup')?.value) return false;

    return true;
  }

  get effectiveSelectedAccounts(): AccountSearchResult[] {
    if (this.selectionMode === 'search') {
      return this.selectedAccounts;
    }
    return this.csvAccountRows
      .filter((r) => r.found && r.account)
      .map((r) => r.account!);
  }

  get displayedConfirmAccounts(): AccountSearchResult[] {
    return this.effectiveSelectedAccounts.slice(0, MAX_DISPLAY_ACCOUNTS);
  }

  get selectedActionRequiresInput(): 'ROLE' | 'GROUP' | null {
    return this.getSelectedAction()?.requiresInput ?? null;
  }

  get selectedActionLabel(): string {
    return this.getSelectedAction()?.label ?? '';
  }

  get isDestructiveAction(): boolean {
    return this.getSelectedAction()?.destructive ?? false;
  }

  get selectedRoleLabel(): string {
    const roleId = this.actionForm.get('targetRole')?.value;
    return this.roleOptions.find((r) => r.value === roleId)?.label ?? '';
  }

  get selectedGroupLabel(): string {
    const groupId = this.actionForm.get('targetGroup')?.value;
    return this.groupOptions.find((g) => g.value === groupId)?.label ?? '';
  }

  get csvFoundCount(): number {
    return this.csvAccountRows.filter((r) => r.found).length;
  }

  get csvNotFoundCount(): number {
    return this.csvAccountRows.filter((r) => !r.found).length;
  }

  get operationSucceededCount(): number {
    return this.operationResults.filter((r) => r.outcome === 'SUCCESS').length;
  }

  get operationFailedCount(): number {
    return this.operationResults.filter((r) => r.outcome === 'FAILURE').length;
  }

  /* ================================================================ */
  /*  Step navigation                                                  */
  /* ================================================================ */

  goToStep(step: number): void {
    this.activeStep = step;
  }

  /* ================================================================ */
  /*  Step 1 - Search & Select                                         */
  /* ================================================================ */

  searchAccounts(page: number = 0): void {
    this.isSearching = true;
    this.currentSearchPage = page;

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', '10');

    if (this.searchFilters.status) {
      params = params.set('status', this.searchFilters.status);
    }
    if (this.searchFilters.department) {
      params = params.set('department', this.searchFilters.department);
    }
    if (this.searchFilters.userType) {
      params = params.set('userType', this.searchFilters.userType);
    }

    this.http
      .get<ApiResponse<{ content: AccountSearchResult[]; meta: PaginationMeta }>>(
        `${API_BASE}/users`,
        { params },
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isSearching = false)),
      )
      .subscribe({
        next: (response) => {
          this.searchResults = response.data.content;
          this.searchTotalRecords = response.data.meta.totalElements;
        },
        error: (err) => {
          this.searchResults = [];
          this.searchTotalRecords = 0;
        },
      });
  }

  onSearchPageChange(event: any): void {
    const page = event.first / event.rows;
    this.searchAccounts(page);
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'SUSPENDED': return 'warning';
      case 'DISABLED': return 'danger';
      case 'PENDING': return 'info';
      default: return 'info';
    }
  }

  /* ================================================================ */
  /*  Step 1 - CSV Upload                                              */
  /* ================================================================ */

  onCsvDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isCsvDragOver = true;
  }

  onCsvDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isCsvDragOver = false;
  }

  onCsvDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isCsvDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processCsvFile(files[0]!);
    }
  }

  onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processCsvFile(input.files[0]!);
      input.value = '';
    }
  }

  clearCsvFile(): void {
    this.csvFile = null;
    this.csvUploadError = null;
    this.csvAccountRows = [];
  }

  private processCsvFile(file: File): void {
    this.csvUploadError = null;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.csvUploadError = 'Please upload a CSV file.';
      return;
    }

    this.csvFile = file;
    this.parseCsvIdentifiers(file);
  }

  private parseCsvIdentifiers(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result as string;
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          this.csvUploadError = 'CSV file is empty.';
          return;
        }

        // Skip header if it looks like a header
        const firstLine = lines[0]!.toLowerCase();
        const startsAt =
          firstLine === 'loginid' ||
          firstLine === 'email' ||
          firstLine === 'login_id' ||
          firstLine === 'id'
            ? 1
            : 0;

        const identifiers = lines.slice(startsAt).map((l) => l.split(',')[0]!.trim());

        if (identifiers.length === 0) {
          this.csvUploadError = 'No identifiers found in the CSV.';
          return;
        }

        this.validateCsvIdentifiers(identifiers);
      } catch {
        this.csvUploadError = 'Failed to parse CSV file.';
      }
    };

    reader.onerror = () => {
      this.csvUploadError = 'Failed to read CSV file.';
    };

    reader.readAsText(file);
  }

  private validateCsvIdentifiers(identifiers: string[]): void {
    this.isValidatingCsv = true;

    this.http
      .post<ApiResponse<Array<{ identifier: string; found: boolean; account: AccountSearchResult | null }>>>(
        `${API_BASE}/users/bulk/validate`,
        { identifiers },
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isValidatingCsv = false)),
      )
      .subscribe({
        next: (response) => {
          this.csvAccountRows = response.data;
        },
        error: () => {
          // Fallback: create rows without validation, mark all as not-yet-verified
          this.csvAccountRows = identifiers.map((id) => ({
            identifier: id,
            found: false,
            account: null,
          }));
          this.csvUploadError = 'Could not validate identifiers against the server. Please check them manually.';
        },
      });
  }

  /* ================================================================ */
  /*  Step 2 - Action selection                                        */
  /* ================================================================ */

  onActionChanged(): void {
    const action = this.getSelectedAction();

    // Reset conditional fields
    this.actionForm.get('targetRole')?.setValue(null);
    this.actionForm.get('targetGroup')?.setValue(null);
    this.actionForm.get('targetRole')?.clearValidators();
    this.actionForm.get('targetGroup')?.clearValidators();

    if (action?.requiresInput === 'ROLE') {
      this.actionForm.get('targetRole')?.setValidators(Validators.required);
      this.loadRoles();
    } else if (action?.requiresInput === 'GROUP') {
      this.actionForm.get('targetGroup')?.setValidators(Validators.required);
      this.loadGroups();
    }

    this.actionForm.get('targetRole')?.updateValueAndValidity();
    this.actionForm.get('targetGroup')?.updateValueAndValidity();
  }

  private loadRoles(): void {
    this.isLoadingRoles = true;
    this.http
      .get<ApiResponse<Array<{ id: string; name: string }>>>(`${API_BASE}/roles`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingRoles = false)),
      )
      .subscribe({
        next: (response) => {
          this.roleOptions = response.data.map((r) => ({
            label: r.name,
            value: r.id,
          }));
        },
        error: () => {
          this.roleOptions = [];
        },
      });
  }

  private loadGroups(): void {
    this.isLoadingGroups = true;
    this.http
      .get<ApiResponse<Array<{ id: string; name: string }>>>(`${API_BASE}/groups`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingGroups = false)),
      )
      .subscribe({
        next: (response) => {
          this.groupOptions = response.data.map((g) => ({
            label: g.name,
            value: g.id,
          }));
        },
        error: () => {
          this.groupOptions = [];
        },
      });
  }

  private loadDepartments(): void {
    this.http
      .get<ApiResponse<Array<{ id: string; name: string }>>>(`${API_BASE}/departments`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.departmentOptions = response.data.map((d) => ({
            label: d.name,
            value: d.id,
          }));
        },
        error: () => {
          this.departmentOptions = [];
        },
      });
  }

  private getSelectedAction(): BulkAction | undefined {
    const actionValue = this.actionForm?.get('action')?.value;
    return BULK_ACTIONS.find((a) => a.value === actionValue);
  }

  /* ================================================================ */
  /*  Step 4 - Execute & Poll                                          */
  /* ================================================================ */

  executeOperation(): void {
    this.isExecuting = true;
    this.executionError = null;

    const action = this.getSelectedAction();
    const accountIds = this.effectiveSelectedAccounts.map((a) => a.id);

    const payload: Record<string, unknown> = {
      action: action?.value,
      accountIds,
      reason: this.actionForm.get('reason')?.value,
      params: {} as Record<string, string>,
    };

    if (action?.requiresInput === 'ROLE') {
      (payload['params'] as Record<string, string>)['roleId'] = this.actionForm.get('targetRole')?.value;
    } else if (action?.requiresInput === 'GROUP') {
      (payload['params'] as Record<string, string>)['groupId'] = this.actionForm.get('targetGroup')?.value;
    }

    this.http
      .post<ApiResponse<{ jobId: string }>>(`${API_BASE}/users/bulk/operations`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isExecuting = false;
          this.operationJobId = response.data.jobId;
          this.activeStep = 3;
          this.pollOperationStatus();
        },
        error: (err) => {
          this.isExecuting = false;
          this.executionError =
            err?.error?.error?.message || 'Failed to start the bulk operation. Please try again.';
          this.activeStep = 3;
        },
      });
  }

  private pollOperationStatus(): void {
    if (!this.operationJobId) return;

    this.isPolling = true;
    this.operationProgress = 0;

    timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.http.get<ApiResponse<BulkOperationJobStatus>>(
            `${API_BASE}/users/bulk/operations/${this.operationJobId}/status`,
          ),
        ),
        takeUntil(this.destroy$),
        takeWhile((response) => {
          const status = response.data;
          this.operationStatus = status;
          this.operationProgress =
            status.total > 0
              ? Math.round((status.processed / status.total) * 100)
              : 0;

          return status.status === 'PROCESSING';
        }, true),
      )
      .subscribe({
        next: (response) => {
          const status = response.data;
          if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            this.onOperationComplete();
          }
        },
        error: (err) => {
          this.isPolling = false;
          this.executionError =
            err?.error?.error?.message || 'Failed to retrieve operation status.';
        },
      });
  }

  private onOperationComplete(): void {
    this.http
      .get<ApiResponse<BulkOperationResult[]>>(
        `${API_BASE}/users/bulk/operations/${this.operationJobId}/results`,
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isPolling = false)),
      )
      .subscribe({
        next: (response) => {
          this.operationResults = response.data;
        },
        error: () => {
          // Fallback: show empty results with status info
          this.operationResults = [];
          this.executionError = 'Operation completed but failed to load detailed results.';
        },
      });
  }

  /* ================================================================ */
  /*  Results & Download                                               */
  /* ================================================================ */

  downloadResults(): void {
    if (this.operationResults.length === 0) return;

    const headers = ['Account ID', 'Login ID', 'Outcome', 'Error Message'];
    const csvRows = [headers.join(',')];

    for (const result of this.operationResults) {
      csvRows.push(
        [
          `"${result.accountId}"`,
          `"${result.loginId}"`,
          result.outcome,
          `"${(result.errorMessage || '').replace(/"/g, '""')}"`,
        ].join(','),
      );
    }

    const blob = new Blob([csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulk-operation-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  resetWizard(): void {
    this.activeStep = 0;
    this.selectionMode = 'search';
    this.searchResults = [];
    this.searchTotalRecords = 0;
    this.selectedAccounts = [];
    this.csvFile = null;
    this.csvUploadError = null;
    this.csvAccountRows = [];
    this.actionForm.reset();
    this.isExecuting = false;
    this.isPolling = false;
    this.operationJobId = null;
    this.operationStatus = null;
    this.operationProgress = 0;
    this.operationResults = [];
    this.executionError = null;
  }
}
