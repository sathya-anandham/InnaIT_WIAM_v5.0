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

interface AccountSearchResult {
  id: string;
  loginId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  department: string;
}

interface CsvAccountRow {
  loginId: string;
  found: boolean;
  account: AccountSearchResult | null;
}

interface BulkResetJobStatus {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
}

interface BulkResetResult {
  accountId: string;
  loginId: string;
  tempPassword: string | null;
  notificationSent: boolean;
  error: string | null;
}

interface BulkResetPayload {
  accountIds: string[];
  generateTemp: boolean;
  commonPassword: string | null;
  forceChange: boolean;
  sendNotification: boolean;
  expiryHours: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_BASE = '/api/v1/admin';
const POLL_INTERVAL_MS = 2000;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

@Component({
  selector: 'app-bulk-password-reset',
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
    <div class="bulk-reset-container" role="main" aria-label="Bulk password reset wizard">
      <!-- Steps navigation -->
      <p-steps
        [model]="steps"
        [activeIndex]="activeStep"
        [readonly]="true"
        styleClass="bulk-reset-steps"
        aria-label="Bulk password reset progress steps">
      </p-steps>

      <!-- ============================================================ -->
      <!--  STEP 1 - SELECT ACCOUNTS                                     -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 0" class="step-content" role="region" aria-label="Select accounts step">
        <p-card header="{{ 'bulkReset.select.title' | translate }}">

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
              {{ 'bulkReset.select.searchAndSelect' | translate }}
            </button>
            <button
              class="mode-btn"
              [class.active]="selectionMode === 'csv'"
              (click)="selectionMode = 'csv'"
              role="tab"
              [attr.aria-selected]="selectionMode === 'csv'"
              aria-controls="csv-panel">
              <i class="pi pi-file" aria-hidden="true"></i>
              {{ 'bulkReset.select.uploadCsv' | translate }}
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
                  <label for="filter-status">{{ 'bulkReset.select.status' | translate }}</label>
                  <p-dropdown
                    id="filter-status"
                    [options]="statusOptions"
                    [(ngModel)]="searchFilters.status"
                    placeholder="{{ 'bulkReset.select.allStatuses' | translate }}"
                    [showClear]="true"
                    [style]="{ width: '100%' }"
                    aria-label="Filter by status">
                  </p-dropdown>
                </div>
                <div class="filter-item">
                  <label for="filter-department">{{ 'bulkReset.select.department' | translate }}</label>
                  <p-dropdown
                    id="filter-department"
                    [options]="departmentOptions"
                    [(ngModel)]="searchFilters.department"
                    placeholder="{{ 'bulkReset.select.allDepartments' | translate }}"
                    [showClear]="true"
                    [style]="{ width: '100%' }"
                    aria-label="Filter by department">
                  </p-dropdown>
                </div>
                <div class="filter-item filter-action">
                  <label>&nbsp;</label>
                  <p-button
                    label="{{ 'bulkReset.select.search' | translate }}"
                    icon="pi pi-search"
                    (onClick)="searchAccounts()"
                    [loading]="isSearching"
                    aria-label="Search accounts">
                  </p-button>
                </div>
              </div>
            </div>

            <!-- Search results table with checkbox selection -->
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
                  <th>{{ 'bulkReset.select.loginId' | translate }}</th>
                  <th>{{ 'bulkReset.select.name' | translate }}</th>
                  <th>{{ 'bulkReset.select.email' | translate }}</th>
                  <th>{{ 'bulkReset.select.status' | translate }}</th>
                  <th>{{ 'bulkReset.select.department' | translate }}</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-account>
                <tr>
                  <td>
                    <p-tableCheckbox [value]="account" [attr.aria-label]="'Select ' + account.loginId"></p-tableCheckbox>
                  </td>
                  <td>{{ account.loginId }}</td>
                  <td>{{ account.firstName }} {{ account.lastName }}</td>
                  <td>{{ account.email }}</td>
                  <td>
                    <p-tag
                      [value]="account.status"
                      [severity]="account.status === 'ACTIVE' ? 'success' : 'warning'">
                    </p-tag>
                  </td>
                  <td>{{ account.department }}</td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="6" class="empty-message">
                    {{ 'bulkReset.select.noResults' | translate }}
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>

          <!-- Option B: CSV Upload -->
          <div
            *ngIf="selectionMode === 'csv'"
            id="csv-panel"
            role="tabpanel"
            class="csv-panel">

            <div class="csv-upload-zone"
              [class.drag-over]="dragOver"
              (dragover)="onDragOver($event)"
              (dragleave)="dragOver = false"
              (drop)="onFileDrop($event)"
              role="button"
              tabindex="0"
              aria-label="Upload CSV file with loginId column"
              (keydown.enter)="fileInput.click()">
              <i class="pi pi-cloud-upload upload-icon" aria-hidden="true"></i>
              <p class="upload-text">{{ 'bulkReset.csv.dragDrop' | translate }}</p>
              <p class="upload-hint">{{ 'bulkReset.csv.hint' | translate }}</p>
              <button class="btn btn-outline btn-sm" (click)="fileInput.click()">
                {{ 'bulkReset.csv.browse' | translate }}
              </button>
              <input
                #fileInput
                type="file"
                accept=".csv"
                style="display:none"
                (change)="onFileSelected($event)"
                aria-label="Choose CSV file" />
            </div>

            <!-- CSV Parse Error -->
            <p-message
              *ngIf="csvError"
              severity="error"
              [text]="csvError"
              [closable]="true"
              (onClose)="csvError = null"
              styleClass="csv-error-msg">
            </p-message>

            <!-- CSV Preview Table -->
            <div *ngIf="csvRows.length > 0" class="csv-preview">
              <h4>{{ 'bulkReset.csv.preview' | translate }} ({{ csvRows.length }} {{ 'bulkReset.csv.rows' | translate }})</h4>
              <p-table
                [value]="csvRows"
                [paginator]="csvRows.length > 10"
                [rows]="10"
                styleClass="p-datatable-sm p-datatable-striped"
                aria-label="CSV upload preview">
                <ng-template pTemplate="header">
                  <tr>
                    <th>{{ 'bulkReset.csv.loginId' | translate }}</th>
                    <th>{{ 'bulkReset.csv.found' | translate }}</th>
                    <th>{{ 'bulkReset.csv.accountName' | translate }}</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-row>
                  <tr>
                    <td>{{ row.loginId }}</td>
                    <td>
                      <p-tag
                        [value]="row.found ? 'Found' : 'Not Found'"
                        [severity]="row.found ? 'success' : 'danger'">
                      </p-tag>
                    </td>
                    <td>
                      <span *ngIf="row.account">{{ row.account.firstName }} {{ row.account.lastName }}</span>
                      <span *ngIf="!row.account" class="text-muted">-</span>
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </div>

          <!-- Selected Accounts Summary -->
          <div class="selection-summary" role="status" aria-live="polite">
            <span class="selection-badge">
              <i class="pi pi-users" aria-hidden="true"></i>
              {{ getEffectiveSelectedCount() }} {{ 'bulkReset.select.accountsSelected' | translate }}
            </span>
          </div>

        </p-card>

        <!-- Step Navigation -->
        <div class="step-nav">
          <div></div>
          <p-button
            label="{{ 'common.next' | translate }}"
            icon="pi pi-arrow-right"
            iconPos="right"
            (onClick)="goToStep(1)"
            [disabled]="getEffectiveSelectedCount() === 0"
            aria-label="Proceed to configuration step">
          </p-button>
        </div>
      </div>

      <!-- ============================================================ -->
      <!--  STEP 2 - CONFIGURE                                           -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 1" class="step-content" role="region" aria-label="Configure password reset options">
        <p-card header="{{ 'bulkReset.configure.title' | translate }}">
          <form [formGroup]="configForm" class="config-form">

            <!-- Password Generation Mode -->
            <div class="config-section">
              <h3 class="config-section-title">{{ 'bulkReset.configure.passwordGeneration' | translate }}</h3>
              <div class="radio-group" role="radiogroup" aria-label="Password generation method">
                <label class="radio-option" [class.selected]="configForm.get('generateTemp')?.value === true">
                  <input
                    type="radio"
                    formControlName="generateTemp"
                    [value]="true"
                    aria-label="Generate temporary passwords" />
                  <div class="radio-content">
                    <span class="radio-label">{{ 'bulkReset.configure.generateTemp' | translate }}</span>
                    <span class="radio-desc">{{ 'bulkReset.configure.generateTempDesc' | translate }}</span>
                  </div>
                </label>
                <label class="radio-option" [class.selected]="configForm.get('generateTemp')?.value === false">
                  <input
                    type="radio"
                    formControlName="generateTemp"
                    [value]="false"
                    aria-label="Set a common password for all accounts" />
                  <div class="radio-content">
                    <span class="radio-label">{{ 'bulkReset.configure.commonPassword' | translate }}</span>
                    <span class="radio-desc">{{ 'bulkReset.configure.commonPasswordDesc' | translate }}</span>
                  </div>
                </label>
              </div>

              <!-- Common password input -->
              <div *ngIf="configForm.get('generateTemp')?.value === false" class="common-password-input">
                <label for="common-password">{{ 'bulkReset.configure.enterPassword' | translate }}</label>
                <input
                  id="common-password"
                  type="password"
                  formControlName="commonPassword"
                  placeholder="Enter common password"
                  class="form-input"
                  aria-label="Common password for all accounts" />
                <small
                  *ngIf="configForm.get('commonPassword')?.invalid && configForm.get('commonPassword')?.touched"
                  class="field-error">
                  {{ 'bulkReset.configure.passwordRequired' | translate }}
                </small>
              </div>
            </div>

            <!-- Options -->
            <div class="config-section">
              <h3 class="config-section-title">{{ 'bulkReset.configure.options' | translate }}</h3>

              <div class="checkbox-group">
                <label class="checkbox-option">
                  <input
                    type="checkbox"
                    formControlName="forceChange"
                    aria-label="Force password change on next login" />
                  <div class="checkbox-content">
                    <span class="checkbox-label">{{ 'bulkReset.configure.forceChange' | translate }}</span>
                    <span class="checkbox-desc">{{ 'bulkReset.configure.forceChangeDesc' | translate }}</span>
                  </div>
                </label>

                <label class="checkbox-option">
                  <input
                    type="checkbox"
                    formControlName="sendNotification"
                    aria-label="Send notification email to users" />
                  <div class="checkbox-content">
                    <span class="checkbox-label">{{ 'bulkReset.configure.sendNotification' | translate }}</span>
                    <span class="checkbox-desc">{{ 'bulkReset.configure.sendNotificationDesc' | translate }}</span>
                  </div>
                </label>

                <!-- Notification Template Preview (expandable) -->
                <div
                  *ngIf="configForm.get('sendNotification')?.value"
                  class="notification-preview"
                  role="region"
                  aria-label="Notification email template preview">
                  <div class="preview-header" (click)="templatePreviewOpen = !templatePreviewOpen">
                    <i class="pi" [ngClass]="templatePreviewOpen ? 'pi-chevron-down' : 'pi-chevron-right'" aria-hidden="true"></i>
                    <span>{{ 'bulkReset.configure.previewTemplate' | translate }}</span>
                  </div>
                  <div *ngIf="templatePreviewOpen" class="preview-body">
                    <div class="template-preview-card">
                      <p><strong>Subject:</strong> Your password has been reset</p>
                      <p>Dear [User],</p>
                      <p>Your password has been reset by an administrator. Your temporary password is: <code>[TEMP_PASSWORD]</code></p>
                      <p>You will be required to change your password upon next login.</p>
                      <p>This temporary password expires in [EXPIRY_HOURS] hours.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Password Expiry -->
            <div class="config-section">
              <h3 class="config-section-title">{{ 'bulkReset.configure.passwordExpiry' | translate }}</h3>
              <div class="expiry-dropdown">
                <label for="expiry-select">{{ 'bulkReset.configure.expiresIn' | translate }}</label>
                <p-dropdown
                  id="expiry-select"
                  [options]="expiryOptions"
                  formControlName="expiryHours"
                  [style]="{ width: '240px' }"
                  aria-label="Password expiry duration">
                </p-dropdown>
              </div>
            </div>

            <!-- Summary Box -->
            <div class="config-summary" role="region" aria-label="Reset configuration summary">
              <h3 class="config-section-title">{{ 'bulkReset.configure.summary' | translate }}</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">{{ 'bulkReset.configure.accounts' | translate }}</span>
                  <span class="summary-value">{{ getEffectiveSelectedCount() }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">{{ 'bulkReset.configure.passwordMode' | translate }}</span>
                  <span class="summary-value">{{ configForm.get('generateTemp')?.value ? 'Auto-generated' : 'Common password' }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">{{ 'bulkReset.configure.forceChangeLabel' | translate }}</span>
                  <span class="summary-value">{{ configForm.get('forceChange')?.value ? 'Yes' : 'No' }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">{{ 'bulkReset.configure.notificationLabel' | translate }}</span>
                  <span class="summary-value">{{ configForm.get('sendNotification')?.value ? 'Yes' : 'No' }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">{{ 'bulkReset.configure.expiryLabel' | translate }}</span>
                  <span class="summary-value">{{ getExpiryLabel() }}</span>
                </div>
              </div>
            </div>

          </form>
        </p-card>

        <!-- Step Navigation -->
        <div class="step-nav">
          <p-button
            label="{{ 'common.back' | translate }}"
            icon="pi pi-arrow-left"
            (onClick)="goToStep(0)"
            [outlined]="true"
            aria-label="Go back to account selection">
          </p-button>
          <p-button
            label="{{ 'bulkReset.configure.executeReset' | translate }}"
            icon="pi pi-bolt"
            iconPos="right"
            (onClick)="confirmAndExecute()"
            [disabled]="!isConfigValid()"
            severity="danger"
            aria-label="Execute bulk password reset">
          </p-button>
        </div>
      </div>

      <!-- ============================================================ -->
      <!--  STEP 3 - EXECUTE & RESULTS                                   -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 2" class="step-content" role="region" aria-label="Execution and results step">

        <!-- Processing State -->
        <div *ngIf="jobStatus && jobStatus.status === 'PROCESSING'" class="processing-card">
          <p-card>
            <div class="processing-content">
              <p-progressSpinner
                [style]="{ width: '48px', height: '48px' }"
                strokeWidth="4"
                aria-label="Processing bulk reset">
              </p-progressSpinner>
              <h3>{{ 'bulkReset.execute.processing' | translate }}</h3>
              <p>{{ 'bulkReset.execute.processingDesc' | translate }}</p>

              <div class="progress-section">
                <div class="progress-label">
                  <span>{{ jobStatus.processed }} / {{ jobStatus.total }}</span>
                  <span>{{ getProgressPercent() }}%</span>
                </div>
                <p-progressBar
                  [value]="getProgressPercent()"
                  [showValue]="false"
                  [style]="{ height: '12px' }"
                  aria-label="Bulk reset progress">
                </p-progressBar>
              </div>
            </div>
          </p-card>
        </div>

        <!-- Results State -->
        <div *ngIf="jobStatus && (jobStatus.status === 'COMPLETED' || jobStatus.status === 'FAILED')">

          <!-- Summary Cards -->
          <div class="result-summary-cards" role="region" aria-label="Bulk reset results summary">
            <div class="result-card result-total">
              <span class="result-value">{{ jobStatus.total }}</span>
              <span class="result-label">{{ 'bulkReset.results.total' | translate }}</span>
            </div>
            <div class="result-card result-success">
              <span class="result-value">{{ jobStatus.succeeded }}</span>
              <span class="result-label">{{ 'bulkReset.results.succeeded' | translate }}</span>
            </div>
            <div class="result-card result-failed">
              <span class="result-value">{{ jobStatus.failed }}</span>
              <span class="result-label">{{ 'bulkReset.results.failed' | translate }}</span>
            </div>
          </div>

          <!-- Results Table -->
          <p-card>
            <div class="results-toolbar">
              <h3>{{ 'bulkReset.results.details' | translate }}</h3>
              <div class="results-actions">
                <button
                  class="btn btn-outline btn-sm"
                  (click)="showDownloadWarning = true"
                  [disabled]="resetResults.length === 0"
                  aria-label="Download credentials as CSV">
                  <i class="pi pi-download" aria-hidden="true"></i>
                  {{ 'bulkReset.results.downloadCredentials' | translate }}
                </button>
              </div>
            </div>

            <p-table
              [value]="resetResults"
              [paginator]="resetResults.length > 15"
              [rows]="15"
              styleClass="p-datatable-sm p-datatable-striped"
              aria-label="Bulk password reset results">
              <ng-template pTemplate="header">
                <tr>
                  <th>{{ 'bulkReset.results.loginId' | translate }}</th>
                  <th>{{ 'bulkReset.results.tempPassword' | translate }}</th>
                  <th>{{ 'bulkReset.results.notificationSent' | translate }}</th>
                  <th>{{ 'bulkReset.results.error' | translate }}</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-result>
                <tr>
                  <td>{{ result.loginId }}</td>
                  <td>
                    <div *ngIf="result.tempPassword" class="password-cell">
                      <code *ngIf="revealedPasswords[result.accountId]">{{ result.tempPassword }}</code>
                      <code *ngIf="!revealedPasswords[result.accountId]" class="masked-password">********</code>
                      <button
                        class="btn-reveal"
                        (click)="togglePasswordReveal(result.accountId)"
                        [attr.aria-label]="revealedPasswords[result.accountId] ? 'Hide password' : 'Show password'">
                        <i class="pi" [ngClass]="revealedPasswords[result.accountId] ? 'pi-eye-slash' : 'pi-eye'" aria-hidden="true"></i>
                      </button>
                    </div>
                    <span *ngIf="!result.tempPassword" class="text-muted">-</span>
                  </td>
                  <td>
                    <i
                      class="pi"
                      [ngClass]="result.notificationSent ? 'pi-check-circle notification-sent' : 'pi-times-circle notification-failed'"
                      [attr.aria-label]="result.notificationSent ? 'Notification sent' : 'Notification not sent'">
                    </i>
                  </td>
                  <td>
                    <span *ngIf="result.error" class="error-text">{{ result.error }}</span>
                    <span *ngIf="!result.error" class="text-muted">-</span>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="4" class="empty-message">
                    {{ 'bulkReset.results.noResults' | translate }}
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>
        </div>

        <!-- Error State (submission failed) -->
        <div *ngIf="submitError && !jobStatus" class="submit-error" role="alert">
          <p-message severity="error" [text]="submitError"></p-message>
          <div class="step-nav">
            <p-button
              label="{{ 'common.back' | translate }}"
              icon="pi pi-arrow-left"
              (onClick)="goToStep(1)"
              [outlined]="true"
              aria-label="Go back to configuration">
            </p-button>
            <p-button
              label="{{ 'bulkReset.execute.retry' | translate }}"
              icon="pi pi-refresh"
              (onClick)="executeReset()"
              aria-label="Retry bulk password reset">
            </p-button>
          </div>
        </div>

        <!-- Step Navigation (after completion) -->
        <div *ngIf="jobStatus && jobStatus.status !== 'PROCESSING'" class="step-nav">
          <p-button
            label="{{ 'bulkReset.results.startNew' | translate }}"
            icon="pi pi-plus"
            (onClick)="startNewWizard()"
            [outlined]="true"
            aria-label="Start a new bulk password reset">
          </p-button>
        </div>
      </div>

      <!-- ============================================================ -->
      <!--  Confirmation Dialog                                          -->
      <!-- ============================================================ -->
      <p-dialog
        header="{{ 'bulkReset.confirm.title' | translate }}"
        [(visible)]="showConfirmDialog"
        [modal]="true"
        [closable]="true"
        [style]="{ width: '480px' }"
        aria-label="Confirm bulk password reset">
        <div class="confirm-dialog-content">
          <p-message
            severity="warn"
            [text]="'bulkReset.confirm.warning' | translate"
            styleClass="confirm-warning">
          </p-message>
          <p class="confirm-text">
            You are about to reset passwords for <strong>{{ getEffectiveSelectedCount() }}</strong> accounts.
            This action cannot be undone.
          </p>
          <ul class="confirm-details">
            <li>Password mode: <strong>{{ configForm.get('generateTemp')?.value ? 'Auto-generated' : 'Common password' }}</strong></li>
            <li>Force change on next login: <strong>{{ configForm.get('forceChange')?.value ? 'Yes' : 'No' }}</strong></li>
            <li>Send notifications: <strong>{{ configForm.get('sendNotification')?.value ? 'Yes' : 'No' }}</strong></li>
            <li>Password expires in: <strong>{{ getExpiryLabel() }}</strong></li>
          </ul>
        </div>
        <ng-template pTemplate="footer">
          <p-button
            label="{{ 'common.cancel' | translate }}"
            icon="pi pi-times"
            (onClick)="showConfirmDialog = false"
            [outlined]="true"
            aria-label="Cancel">
          </p-button>
          <p-button
            label="{{ 'bulkReset.confirm.execute' | translate }}"
            icon="pi pi-bolt"
            (onClick)="executeReset()"
            severity="danger"
            [loading]="isSubmitting"
            aria-label="Confirm and execute bulk password reset">
          </p-button>
        </ng-template>
      </p-dialog>

      <!-- ============================================================ -->
      <!--  Download Security Warning Dialog                             -->
      <!-- ============================================================ -->
      <p-dialog
        header="{{ 'bulkReset.download.warningTitle' | translate }}"
        [(visible)]="showDownloadWarning"
        [modal]="true"
        [closable]="true"
        [style]="{ width: '480px' }"
        aria-label="Security warning for credential download">
        <div class="download-warning-content">
          <p-message
            severity="warn"
            [text]="'bulkReset.download.securityWarning' | translate"
            styleClass="download-warning-msg">
          </p-message>
          <p class="download-warning-text">
            The downloaded CSV will contain plaintext temporary passwords. Ensure you handle this file
            securely and delete it after distributing credentials to the affected users.
          </p>
        </div>
        <ng-template pTemplate="footer">
          <p-button
            label="{{ 'common.cancel' | translate }}"
            icon="pi pi-times"
            (onClick)="showDownloadWarning = false"
            [outlined]="true"
            aria-label="Cancel download">
          </p-button>
          <p-button
            label="{{ 'bulkReset.download.confirm' | translate }}"
            icon="pi pi-download"
            (onClick)="downloadCredentialsCsv()"
            severity="warning"
            aria-label="I understand, download credentials">
          </p-button>
        </ng-template>
      </p-dialog>
    </div>
  `,
  styles: [`
    /* ============================================================ */
    /* Container                                                      */
    /* ============================================================ */
    .bulk-reset-container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    :host ::ng-deep .bulk-reset-steps .p-steps-item .p-menuitem-link {
      flex-direction: column;
      gap: 4px;
    }

    /* ============================================================ */
    /* Step Content                                                   */
    /* ============================================================ */
    .step-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Step Navigation */
    .step-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
    }

    /* ============================================================ */
    /* Selection Mode Toggle                                          */
    /* ============================================================ */
    .selection-mode-toggle {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      border-bottom: 2px solid var(--surface-border, #dee2e6);
      padding-bottom: 0;
    }
    .mode-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border: none;
      background: none;
      color: var(--text-color-secondary, #6c757d);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
    }
    .mode-btn.active {
      color: var(--primary-color, #3b82f6);
      border-bottom-color: var(--primary-color, #3b82f6);
    }
    .mode-btn:hover:not(.active) {
      color: var(--text-color, #333);
    }

    /* ============================================================ */
    /* Search Filters                                                 */
    /* ============================================================ */
    .search-filters {
      margin-bottom: 16px;
    }
    .filter-row {
      display: flex;
      gap: 16px;
      align-items: flex-end;
      flex-wrap: wrap;
    }
    .filter-item {
      flex: 1;
      min-width: 180px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .filter-item label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-color-secondary, #6c757d);
    }
    .filter-action {
      flex: 0 0 auto;
    }

    /* ============================================================ */
    /* CSV Upload                                                     */
    /* ============================================================ */
    .csv-upload-zone {
      border: 2px dashed var(--surface-border, #dee2e6);
      border-radius: 12px;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: var(--surface-ground, #f8f9fa);
    }
    .csv-upload-zone:hover, .csv-upload-zone.drag-over {
      border-color: var(--primary-color, #3b82f6);
      background: rgba(59, 130, 246, 0.04);
    }
    .upload-icon {
      font-size: 36px;
      color: var(--text-color-secondary, #6c757d);
    }
    .upload-text {
      margin: 0;
      font-size: 15px;
      font-weight: 500;
      color: var(--text-color, #333);
    }
    .upload-hint {
      margin: 0;
      font-size: 13px;
      color: var(--text-color-secondary, #6c757d);
    }
    .csv-preview {
      margin-top: 16px;
    }
    .csv-preview h4 {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color, #333);
    }

    :host ::ng-deep .csv-error-msg {
      margin-top: 12px;
    }

    /* ============================================================ */
    /* Selection Summary                                              */
    /* ============================================================ */
    .selection-summary {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--surface-border, #dee2e6);
    }
    .selection-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: var(--primary-color, #3b82f6);
      color: #fff;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }

    /* ============================================================ */
    /* Config Form (Step 2)                                           */
    /* ============================================================ */
    .config-form {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .config-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .config-section-title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color, #333);
      padding-bottom: 6px;
      border-bottom: 1px solid var(--surface-border, #dee2e6);
    }

    /* Radio Group */
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .radio-option {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .radio-option:hover { background: var(--surface-hover, #f1f5f9); }
    .radio-option.selected {
      border-color: var(--primary-color, #3b82f6);
      background: rgba(59, 130, 246, 0.04);
    }
    .radio-option input[type="radio"] {
      margin-top: 3px;
      flex-shrink: 0;
    }
    .radio-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .radio-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color, #333);
    }
    .radio-desc {
      font-size: 13px;
      color: var(--text-color-secondary, #6c757d);
    }

    /* Common password input */
    .common-password-input {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-left: 36px;
    }
    .common-password-input label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-color, #333);
    }
    .form-input {
      padding: 10px 14px;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      max-width: 360px;
      transition: border-color 0.2s;
    }
    .form-input:focus {
      border-color: var(--primary-color, #3b82f6);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }
    .field-error {
      color: var(--red-500, #ef4444);
      font-size: 12px;
    }

    /* Checkbox Group */
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .checkbox-option {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      cursor: pointer;
    }
    .checkbox-option input[type="checkbox"] {
      margin-top: 3px;
      flex-shrink: 0;
      width: 16px;
      height: 16px;
    }
    .checkbox-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .checkbox-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color, #333);
    }
    .checkbox-desc {
      font-size: 13px;
      color: var(--text-color-secondary, #6c757d);
    }

    /* Notification Template Preview */
    .notification-preview {
      margin-left: 26px;
      margin-top: 4px;
    }
    .preview-header {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--primary-color, #3b82f6);
      font-weight: 500;
    }
    .preview-body {
      margin-top: 8px;
    }
    .template-preview-card {
      background: var(--surface-ground, #f8f9fa);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      padding: 16px;
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-color, #333);
    }
    .template-preview-card p { margin: 0 0 8px; }
    .template-preview-card p:last-child { margin-bottom: 0; }
    .template-preview-card code {
      background: rgba(59, 130, 246, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    /* Expiry Dropdown */
    .expiry-dropdown {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .expiry-dropdown label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-color, #333);
    }

    /* Summary Box */
    .config-summary {
      background: var(--surface-ground, #f8f9fa);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      padding: 16px 20px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    .summary-item {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 4px 0;
    }
    .summary-label {
      color: var(--text-color-secondary, #6c757d);
    }
    .summary-value {
      font-weight: 600;
      color: var(--text-color, #333);
    }

    /* ============================================================ */
    /* Step 3: Processing                                             */
    /* ============================================================ */
    .processing-card {
      text-align: center;
    }
    .processing-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 0;
    }
    .processing-content h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color, #333);
    }
    .processing-content p {
      margin: 0;
      font-size: 14px;
      color: var(--text-color-secondary, #6c757d);
    }
    .progress-section {
      width: 100%;
      max-width: 400px;
    }
    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-color, #333);
      margin-bottom: 6px;
    }

    /* ============================================================ */
    /* Step 3: Results                                                 */
    /* ============================================================ */
    .result-summary-cards {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .result-card {
      flex: 1;
      background: var(--surface-card, #ffffff);
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 10px;
      padding: 18px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }
    .result-card.result-total { border-left: 4px solid var(--primary-color, #3b82f6); }
    .result-card.result-success { border-left: 4px solid var(--green-500, #22c55e); }
    .result-card.result-failed { border-left: 4px solid var(--red-500, #ef4444); }
    .result-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-color, #333);
    }
    .result-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-color-secondary, #6c757d);
    }

    /* Results Toolbar */
    .results-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .results-toolbar h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color, #333);
    }

    /* Password Cell */
    .password-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .password-cell code {
      background: var(--surface-ground, #f8f9fa);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 13px;
      letter-spacing: 0.5px;
    }
    .masked-password {
      letter-spacing: 2px;
      color: var(--text-color-secondary, #6c757d);
    }
    .btn-reveal {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-color-secondary, #6c757d);
      padding: 2px;
      font-size: 14px;
    }
    .btn-reveal:hover { color: var(--primary-color, #3b82f6); }

    /* Notification icons */
    .notification-sent { color: var(--green-500, #22c55e); font-size: 16px; }
    .notification-failed { color: var(--red-400, #f87171); font-size: 16px; }

    /* Submit Error */
    .submit-error {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ============================================================ */
    /* Confirmation Dialog                                            */
    /* ============================================================ */
    .confirm-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .confirm-text {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .confirm-details {
      margin: 0;
      padding-left: 20px;
      font-size: 14px;
      line-height: 1.8;
    }

    /* Download Warning Dialog */
    .download-warning-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .download-warning-text {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
    }

    /* ============================================================ */
    /* Utility                                                        */
    /* ============================================================ */
    .text-muted { color: var(--text-color-secondary, #6c757d); }
    .error-text { color: var(--red-500, #ef4444); font-size: 13px; }
    .empty-message { text-align: center; padding: 24px; color: var(--text-color-secondary, #6c757d); }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline {
      background: var(--surface-card, #ffffff);
      color: var(--text-color, #333);
      border-color: var(--surface-border, #dee2e6);
    }
    .btn-outline:hover:not(:disabled) { background: var(--surface-hover, #f1f5f9); }
    .btn-sm { padding: 4px 10px; font-size: 13px; }
  `],
})
export class BulkPasswordResetComponent implements OnInit, OnDestroy {
  /* ---------------------------------------------------------------- */
  /*  Wizard Steps                                                     */
  /* ---------------------------------------------------------------- */
  steps = [
    { label: 'Select Accounts' },
    { label: 'Configure' },
    { label: 'Execute & Results' },
  ];
  activeStep = 0;

  /* ---------------------------------------------------------------- */
  /*  Step 1: Selection State                                          */
  /* ---------------------------------------------------------------- */
  selectionMode: 'search' | 'csv' = 'search';

  /* Search mode */
  isSearching = false;
  searchResults: AccountSearchResult[] = [];
  searchTotalRecords = 0;
  selectedAccounts: AccountSearchResult[] = [];
  searchFilters = {
    status: null as string | null,
    department: null as string | null,
  };

  statusOptions = [
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Suspended', value: 'SUSPENDED' },
    { label: 'Locked', value: 'LOCKED' },
  ];
  departmentOptions: { label: string; value: string }[] = [];

  /* CSV mode */
  dragOver = false;
  csvError: string | null = null;
  csvRows: CsvAccountRow[] = [];

  /* ---------------------------------------------------------------- */
  /*  Step 2: Configuration                                            */
  /* ---------------------------------------------------------------- */
  configForm!: FormGroup;
  templatePreviewOpen = false;

  expiryOptions = [
    { label: '1 hour', value: 1 },
    { label: '4 hours', value: 4 },
    { label: '24 hours', value: 24 },
    { label: '7 days', value: 168 },
  ];

  /* ---------------------------------------------------------------- */
  /*  Step 3: Execution & Results                                      */
  /* ---------------------------------------------------------------- */
  isSubmitting = false;
  submitError: string | null = null;
  showConfirmDialog = false;
  showDownloadWarning = false;

  jobId: string | null = null;
  jobStatus: BulkResetJobStatus | null = null;
  resetResults: BulkResetResult[] = [];
  revealedPasswords: Record<string, boolean> = {};

  /* ---------------------------------------------------------------- */
  /*  RxJS                                                             */
  /* ---------------------------------------------------------------- */
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  ngOnInit(): void {
    this.initConfigForm();
    this.loadDepartments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ---------------------------------------------------------------- */
  /*  Config Form                                                      */
  /* ---------------------------------------------------------------- */

  private initConfigForm(): void {
    this.configForm = this.fb.group({
      generateTemp: [true],
      commonPassword: [''],
      forceChange: [true],
      sendNotification: [true],
      expiryHours: [24],
    });

    // Dynamically toggle commonPassword validation
    this.configForm.get('generateTemp')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((generateTemp: boolean) => {
        const commonPasswordCtrl = this.configForm.get('commonPassword')!;
        if (!generateTemp) {
          commonPasswordCtrl.setValidators([Validators.required, Validators.minLength(8)]);
        } else {
          commonPasswordCtrl.clearValidators();
          commonPasswordCtrl.setValue('');
        }
        commonPasswordCtrl.updateValueAndValidity();
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Step Navigation                                                  */
  /* ---------------------------------------------------------------- */

  goToStep(step: number): void {
    this.activeStep = step;
  }

  /* ---------------------------------------------------------------- */
  /*  Step 1: Search Accounts                                          */
  /* ---------------------------------------------------------------- */

  searchAccounts(page: number = 0): void {
    this.isSearching = true;
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', '10');

    if (this.searchFilters.status) {
      params = params.set('status', this.searchFilters.status);
    }
    if (this.searchFilters.department) {
      params = params.set('department', this.searchFilters.department);
    }

    this.http
      .get<ApiResponse<{ content: AccountSearchResult[]; meta: PaginationMeta }>>(
        `${API_BASE}/users`, { params },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.searchResults = res.data.content;
          this.searchTotalRecords = res.data.meta.totalElements;
          this.isSearching = false;
        },
        error: (err) => {
          this.isSearching = false;
          this.csvError = err?.error?.error?.message || 'Search failed';
        },
      });
  }

  onSearchPageChange(event: any): void {
    const page = Math.floor((event.first || 0) / (event.rows || 10));
    this.searchAccounts(page);
  }

  /* ---------------------------------------------------------------- */
  /*  Step 1: CSV Upload                                               */
  /* ---------------------------------------------------------------- */

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.parseCsvFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.parseCsvFile(input.files[0]);
    }
    input.value = '';
  }

  private parseCsvFile(file: File): void {
    if (!file.name.endsWith('.csv')) {
      this.csvError = 'Please upload a valid .csv file.';
      return;
    }

    this.csvError = null;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          this.csvError = 'CSV file must have a header row and at least one data row.';
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const loginIdIdx = headers.indexOf('loginid');
        if (loginIdIdx === -1) {
          this.csvError = 'CSV must contain a "loginId" column header.';
          return;
        }

        const loginIds: string[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          const loginId = cols[loginIdIdx]?.trim();
          if (loginId) {
            loginIds.push(loginId);
          }
        }

        if (loginIds.length === 0) {
          this.csvError = 'No valid loginId entries found in the CSV.';
          return;
        }

        this.resolveCsvLoginIds(loginIds);
      } catch {
        this.csvError = 'Failed to parse the CSV file.';
      }
    };
    reader.readAsText(file);
  }

  private resolveCsvLoginIds(loginIds: string[]): void {
    this.isSearching = true;

    this.http
      .post<ApiResponse<{ resolved: { loginId: string; found: boolean; account: AccountSearchResult | null }[] }>>(
        `${API_BASE}/users/resolve`,
        { loginIds },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.csvRows = res.data.resolved.map((r) => ({
            loginId: r.loginId,
            found: r.found,
            account: r.account,
          }));
          this.isSearching = false;
        },
        error: (err) => {
          this.csvError = err?.error?.error?.message || 'Failed to resolve login IDs';
          this.isSearching = false;
          // Fallback: create unresolved rows
          this.csvRows = loginIds.map((id) => ({ loginId: id, found: false, account: null }));
        },
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Step 1: Selection Helpers                                        */
  /* ---------------------------------------------------------------- */

  getEffectiveSelectedCount(): number {
    if (this.selectionMode === 'search') {
      return this.selectedAccounts.length;
    }
    return this.csvRows.filter((r) => r.found && r.account).length;
  }

  private getEffectiveAccountIds(): string[] {
    if (this.selectionMode === 'search') {
      return this.selectedAccounts.map((a) => a.id);
    }
    return this.csvRows
      .filter((r) => r.found && r.account)
      .map((r) => r.account!.id);
  }

  /* ---------------------------------------------------------------- */
  /*  Step 2: Validation                                               */
  /* ---------------------------------------------------------------- */

  isConfigValid(): boolean {
    if (this.configForm.get('generateTemp')?.value === false) {
      return this.configForm.get('commonPassword')?.valid === true;
    }
    return true;
  }

  getExpiryLabel(): string {
    const val = this.configForm.get('expiryHours')?.value;
    const match = this.expiryOptions.find((o) => o.value === val);
    return match ? match.label : `${val} hours`;
  }

  /* ---------------------------------------------------------------- */
  /*  Step 2 → 3: Confirm & Execute                                    */
  /* ---------------------------------------------------------------- */

  confirmAndExecute(): void {
    this.showConfirmDialog = true;
  }

  executeReset(): void {
    this.showConfirmDialog = false;
    this.isSubmitting = true;
    this.submitError = null;
    this.goToStep(2);

    const payload: BulkResetPayload = {
      accountIds: this.getEffectiveAccountIds(),
      generateTemp: this.configForm.get('generateTemp')?.value,
      commonPassword: this.configForm.get('generateTemp')?.value ? null : this.configForm.get('commonPassword')?.value,
      forceChange: this.configForm.get('forceChange')?.value,
      sendNotification: this.configForm.get('sendNotification')?.value,
      expiryHours: this.configForm.get('expiryHours')?.value,
    };

    this.http
      .post<ApiResponse<{ jobId: string }>>(
        `${API_BASE}/credentials/bulk-reset`,
        payload,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.jobId = res.data.jobId;
          this.jobStatus = {
            status: 'PROCESSING',
            processed: 0,
            total: payload.accountIds.length,
            succeeded: 0,
            failed: 0,
          };
          this.pollJobStatus();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.submitError = err?.error?.error?.message || 'Failed to initiate bulk password reset.';
        },
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Step 3: Polling                                                  */
  /* ---------------------------------------------------------------- */

  private pollJobStatus(): void {
    if (!this.jobId) return;

    timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.http.get<ApiResponse<BulkResetJobStatus>>(
            `${API_BASE}/credentials/bulk-reset/${this.jobId}/status`,
          ),
        ),
        takeWhile((res) => res.data.status === 'PROCESSING', true),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res) => {
          this.jobStatus = res.data;
          if (res.data.status !== 'PROCESSING') {
            this.loadResults();
          }
        },
        error: (err) => {
          // If polling fails, mark as unknown state
          if (this.jobStatus) {
            this.jobStatus.status = 'FAILED';
          }
        },
      });
  }

  private loadResults(): void {
    if (!this.jobId) return;

    this.http
      .get<ApiResponse<BulkResetResult[]>>(
        `${API_BASE}/credentials/bulk-reset/${this.jobId}/results`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.resetResults = res.data;
        },
        error: () => {
          this.resetResults = [];
        },
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Step 3: Password Reveal                                          */
  /* ---------------------------------------------------------------- */

  togglePasswordReveal(accountId: string): void {
    this.revealedPasswords[accountId] = !this.revealedPasswords[accountId];
  }

  /* ---------------------------------------------------------------- */
  /*  Step 3: Progress                                                 */
  /* ---------------------------------------------------------------- */

  getProgressPercent(): number {
    if (!this.jobStatus || this.jobStatus.total === 0) return 0;
    return Math.round((this.jobStatus.processed / this.jobStatus.total) * 100);
  }

  /* ---------------------------------------------------------------- */
  /*  Step 3: Download Credentials CSV                                 */
  /* ---------------------------------------------------------------- */

  downloadCredentialsCsv(): void {
    this.showDownloadWarning = false;

    const rows = this.resetResults
      .filter((r) => r.tempPassword)
      .map((r) => `${this.csvEscapeField(r.loginId)},${this.csvEscapeField(r.tempPassword || '')}`);

    const csvContent = 'loginId,tempPassword\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-reset-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private csvEscapeField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /* ---------------------------------------------------------------- */
  /*  Start New Wizard                                                 */
  /* ---------------------------------------------------------------- */

  startNewWizard(): void {
    this.activeStep = 0;
    this.selectionMode = 'search';
    this.selectedAccounts = [];
    this.searchResults = [];
    this.searchTotalRecords = 0;
    this.csvRows = [];
    this.csvError = null;
    this.jobId = null;
    this.jobStatus = null;
    this.resetResults = [];
    this.revealedPasswords = {};
    this.submitError = null;
    this.showConfirmDialog = false;
    this.showDownloadWarning = false;
    this.templatePreviewOpen = false;
    this.initConfigForm();
  }

  /* ---------------------------------------------------------------- */
  /*  Load Departments for Dropdown                                    */
  /* ---------------------------------------------------------------- */

  private loadDepartments(): void {
    this.http
      .get<ApiResponse<{ departments: string[] }>>(`${API_BASE}/departments`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.departmentOptions = res.data.departments.map((d) => ({
            label: d,
            value: d,
          }));
        },
        error: () => {
          this.departmentOptions = [];
        },
      });
  }
}
