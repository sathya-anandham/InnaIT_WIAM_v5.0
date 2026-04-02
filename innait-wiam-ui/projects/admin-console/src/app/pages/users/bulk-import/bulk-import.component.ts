import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, timer, switchMap, takeWhile } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse } from '@innait/core';

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

interface ColumnMapping {
  expectedField: string;
  label: string;
  required: boolean;
  mappedColumn: string | null;
}

interface RowValidation {
  rowIndex: number;
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
}

interface ImportJobStatus {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
}

interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
    data: Record<string, string>;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EXPECTED_FIELDS: ColumnMapping[] = [
  { expectedField: 'firstName', label: 'First Name', required: true, mappedColumn: null },
  { expectedField: 'lastName', label: 'Last Name', required: true, mappedColumn: null },
  { expectedField: 'email', label: 'Email', required: true, mappedColumn: null },
  { expectedField: 'department', label: 'Department', required: false, mappedColumn: null },
  { expectedField: 'designation', label: 'Designation', required: false, mappedColumn: null },
  { expectedField: 'userType', label: 'User Type', required: false, mappedColumn: null },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PREVIEW_ROW_COUNT = 10;
const POLL_INTERVAL_MS = 2000;
const API_BASE = '/api/v1/admin/users/bulk/import';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

@Component({
  selector: 'app-bulk-import',
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
    <!-- Steps navigation -->
    <div class="bulk-import-container" role="main" aria-label="Bulk user import wizard">
      <p-steps
        [model]="steps"
        [activeIndex]="activeStep"
        [readonly]="true"
        styleClass="bulk-import-steps"
        aria-label="Import progress steps">
      </p-steps>

      <!-- ============================================================ -->
      <!--  STEP 1 - UPLOAD                                              -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 0" class="step-content" role="region" aria-label="File upload step">
        <p-card header="{{ 'bulkImport.upload.title' | translate }}">
          <!-- Error message -->
          <p-message
            *ngIf="uploadError"
            severity="error"
            [text]="uploadError"
            styleClass="upload-error-msg">
          </p-message>

          <!-- Drag & drop zone -->
          <div
            class="drop-zone"
            [class.drag-over]="isDragOver"
            [class.has-file]="!!selectedFile"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onDrop($event)"
            role="button"
            tabindex="0"
            (keydown.enter)="fileInput.click()"
            (keydown.space)="fileInput.click(); $event.preventDefault()"
            [attr.aria-label]="selectedFile
              ? 'File selected: ' + selectedFile.name
              : 'Drop CSV or Excel file here, or press Enter to browse'">

            <div *ngIf="!selectedFile" class="drop-zone-content">
              <i class="pi pi-cloud-upload drop-icon" aria-hidden="true"></i>
              <p class="drop-text">{{ 'bulkImport.upload.dropText' | translate }}</p>
              <p class="drop-hint">{{ 'bulkImport.upload.acceptedFormats' | translate }}</p>
              <p-button
                label="{{ 'bulkImport.upload.browseFiles' | translate }}"
                icon="pi pi-folder-open"
                styleClass="p-button-outlined"
                (onClick)="fileInput.click()"
                aria-label="Browse for files">
              </p-button>
            </div>

            <div *ngIf="selectedFile" class="file-info">
              <i class="pi pi-file file-icon" aria-hidden="true"></i>
              <div class="file-details">
                <span class="file-name">{{ selectedFile.name }}</span>
                <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
              </div>
              <p-button
                icon="pi pi-times"
                styleClass="p-button-rounded p-button-text p-button-danger"
                (onClick)="clearFile(); $event.stopPropagation()"
                aria-label="Remove selected file">
              </p-button>
            </div>
          </div>

          <input
            #fileInput
            type="file"
            [accept]="ACCEPTED_EXTENSIONS.join(',')"
            (change)="onFileSelected($event)"
            class="hidden-input"
            aria-hidden="true" />

          <!-- Parsing indicator -->
          <div *ngIf="isParsing" class="parsing-indicator" role="status" aria-live="polite">
            <p-progressSpinner
              strokeWidth="4"
              [style]="{ width: '30px', height: '30px' }"
              aria-label="Parsing file">
            </p-progressSpinner>
            <span>{{ 'bulkImport.upload.parsing' | translate }}</span>
          </div>

          <!-- Parsed info for Excel files -->
          <div *ngIf="selectedFile && isExcelFile && !isParsing" class="excel-note" role="status">
            <i class="pi pi-info-circle" aria-hidden="true"></i>
            <span>{{ 'bulkImport.upload.excelNote' | translate }}</span>
          </div>

          <!-- Next button -->
          <div class="step-actions">
            <p-button
              label="{{ 'common.next' | translate }}"
              icon="pi pi-arrow-right"
              iconPos="right"
              [disabled]="!canProceedFromUpload"
              (onClick)="goToStep(1)"
              aria-label="Proceed to preview and column mapping">
            </p-button>
          </div>
        </p-card>
      </div>

      <!-- ============================================================ -->
      <!--  STEP 2 - PREVIEW & COLUMN MAPPING                           -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 1" class="step-content" role="region" aria-label="Preview and column mapping step">
        <p-card header="{{ 'bulkImport.preview.title' | translate }}">

          <!-- Column mapping -->
          <div class="mapping-section" role="group" aria-label="Column mapping">
            <h4>{{ 'bulkImport.preview.columnMapping' | translate }}</h4>
            <div class="mapping-grid">
              <div
                *ngFor="let mapping of columnMappings; let i = index"
                class="mapping-item">
                <label [for]="'mapping-' + i" class="mapping-label">
                  {{ mapping.label }}
                  <span *ngIf="mapping.required" class="required-marker" aria-label="required">*</span>
                </label>
                <p-dropdown
                  [id]="'mapping-' + i"
                  [options]="csvColumnOptions"
                  [(ngModel)]="mapping.mappedColumn"
                  placeholder="{{ 'bulkImport.preview.selectColumn' | translate }}"
                  [showClear]="true"
                  (onChange)="onMappingChanged()"
                  [style]="{ width: '100%' }"
                  [attr.aria-label]="'Map ' + mapping.label + ' to CSV column'">
                </p-dropdown>
              </div>
            </div>
          </div>

          <!-- Validation summary -->
          <div class="validation-summary" role="status" aria-live="polite">
            <p-tag
              [severity]="validRowCount === parsedRows.length ? 'success' : 'warning'"
              [value]="validRowCount + ' of ' + parsedRows.length + ' rows valid'"
              icon="pi pi-check-circle">
            </p-tag>
            <p-tag
              *ngIf="invalidRowCount > 0"
              severity="danger"
              [value]="invalidRowCount + ' errors'"
              icon="pi pi-times-circle">
            </p-tag>
          </div>

          <!-- Preview table -->
          <p-table
            [value]="validatedRows.slice(0, PREVIEW_ROW_COUNT)"
            [scrollable]="true"
            scrollHeight="400px"
            styleClass="p-datatable-sm p-datatable-striped"
            [tableStyle]="{ 'min-width': '60rem' }"
            aria-label="Preview of imported data">
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 3rem" aria-label="Row status">Status</th>
                <th style="width: 3rem">Row</th>
                <th *ngFor="let col of csvHeaders">{{ col }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr [class.invalid-row]="!row.valid">
                <td>
                  <i
                    *ngIf="row.valid"
                    class="pi pi-check-circle text-success"
                    aria-label="Valid row">
                  </i>
                  <i
                    *ngIf="!row.valid"
                    class="pi pi-times-circle text-danger"
                    [pTooltip]="row.errors.join('; ')"
                    aria-label="Invalid row: {{ row.errors.join('; ') }}">
                  </i>
                </td>
                <td>{{ row.rowIndex + 1 }}</td>
                <td *ngFor="let col of csvHeaders">{{ row.data[col] || '' }}</td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td [colSpan]="csvHeaders.length + 2" class="text-center">
                  {{ 'bulkImport.preview.noData' | translate }}
                </td>
              </tr>
            </ng-template>
          </p-table>

          <!-- Error details (expandable) -->
          <div *ngIf="invalidRowCount > 0" class="error-details-section">
            <p-button
              [label]="showErrorDetails
                ? ('bulkImport.preview.hideErrors' | translate)
                : ('bulkImport.preview.showErrors' | translate)"
              icon="pi pi-list"
              styleClass="p-button-text p-button-sm"
              (onClick)="showErrorDetails = !showErrorDetails"
              [attr.aria-expanded]="showErrorDetails"
              aria-controls="error-detail-list">
            </p-button>
            <div *ngIf="showErrorDetails" id="error-detail-list" role="list" class="error-list">
              <div
                *ngFor="let row of invalidRows"
                class="error-item"
                role="listitem">
                <strong>Row {{ row.rowIndex + 1 }}:</strong>
                <ul>
                  <li *ngFor="let err of row.errors">{{ err }}</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="step-actions">
            <p-button
              label="{{ 'common.back' | translate }}"
              icon="pi pi-arrow-left"
              styleClass="p-button-outlined"
              (onClick)="goToStep(0)"
              aria-label="Go back to upload step">
            </p-button>
            <p-button
              label="{{ 'bulkImport.preview.startImport' | translate }}"
              icon="pi pi-upload"
              iconPos="right"
              [disabled]="validRowCount === 0"
              (onClick)="startImport()"
              aria-label="Start importing valid rows">
            </p-button>
          </div>
        </p-card>
      </div>

      <!-- ============================================================ -->
      <!--  STEP 3 - IMPORT PROGRESS                                     -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 2" class="step-content" role="region" aria-label="Import progress step">
        <p-card header="{{ 'bulkImport.import.title' | translate }}">
          <div class="import-progress-section" role="status" aria-live="polite">
            <!-- Upload progress -->
            <div *ngIf="isUploading" class="progress-block">
              <h4>{{ 'bulkImport.import.uploading' | translate }}</h4>
              <p-progressBar
                [value]="uploadProgress"
                [showValue]="true"
                aria-label="File upload progress">
              </p-progressBar>
            </div>

            <!-- Processing progress -->
            <div *ngIf="isProcessing" class="progress-block">
              <h4>{{ 'bulkImport.import.processing' | translate }}</h4>
              <p-progressBar
                [value]="processingProgress"
                [showValue]="true"
                aria-label="Import processing progress">
              </p-progressBar>
              <div class="processing-stats">
                <span>{{ 'bulkImport.import.processed' | translate }}:
                  {{ importStatus?.processed || 0 }} / {{ importStatus?.total || 0 }}</span>
                <span class="text-success">
                  {{ 'bulkImport.import.succeeded' | translate }}: {{ importStatus?.succeeded || 0 }}
                </span>
                <span class="text-danger">
                  {{ 'bulkImport.import.failed' | translate }}: {{ importStatus?.failed || 0 }}
                </span>
              </div>
            </div>

            <!-- Waiting spinner if no progress yet -->
            <div *ngIf="!isUploading && !isProcessing && !importResult" class="waiting-section">
              <p-progressSpinner
                strokeWidth="4"
                [style]="{ width: '50px', height: '50px' }"
                aria-label="Preparing import">
              </p-progressSpinner>
              <p>{{ 'bulkImport.import.preparing' | translate }}</p>
            </div>
          </div>
        </p-card>
      </div>

      <!-- ============================================================ -->
      <!--  STEP 4 - RESULTS                                            -->
      <!-- ============================================================ -->
      <div *ngIf="activeStep === 3" class="step-content" role="region" aria-label="Import results step">
        <p-card header="{{ 'bulkImport.results.title' | translate }}">

          <!-- Summary cards -->
          <div class="results-summary" role="group" aria-label="Import results summary">
            <div class="summary-card summary-total">
              <i class="pi pi-users" aria-hidden="true"></i>
              <div class="summary-value">{{ importResult?.total || 0 }}</div>
              <div class="summary-label">{{ 'bulkImport.results.totalProcessed' | translate }}</div>
            </div>
            <div class="summary-card summary-success">
              <i class="pi pi-check-circle" aria-hidden="true"></i>
              <div class="summary-value">{{ importResult?.succeeded || 0 }}</div>
              <div class="summary-label">{{ 'bulkImport.results.succeeded' | translate }}</div>
            </div>
            <div class="summary-card summary-failed">
              <i class="pi pi-times-circle" aria-hidden="true"></i>
              <div class="summary-value">{{ importResult?.failed || 0 }}</div>
              <div class="summary-label">{{ 'bulkImport.results.failed' | translate }}</div>
            </div>
          </div>

          <!-- Error table (if failures) -->
          <div *ngIf="importResult && importResult.errors.length > 0" class="error-results-section">
            <h4>{{ 'bulkImport.results.errorDetails' | translate }}</h4>
            <p-table
              [value]="importResult.errors"
              [paginator]="importResult.errors.length > 10"
              [rows]="10"
              styleClass="p-datatable-sm p-datatable-striped"
              aria-label="Failed import rows">
              <ng-template pTemplate="header">
                <tr>
                  <th style="width: 5rem">{{ 'bulkImport.results.row' | translate }}</th>
                  <th>{{ 'bulkImport.results.errorMessage' | translate }}</th>
                  <th>{{ 'bulkImport.results.originalData' | translate }}</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-err>
                <tr>
                  <td>{{ err.row }}</td>
                  <td class="text-danger">{{ err.message }}</td>
                  <td class="original-data">{{ formatRowData(err.data) }}</td>
                </tr>
              </ng-template>
            </p-table>
          </div>

          <!-- Actions -->
          <div class="step-actions results-actions">
            <p-button
              *ngIf="importResult && importResult.errors.length > 0"
              label="{{ 'bulkImport.results.downloadErrorReport' | translate }}"
              icon="pi pi-download"
              styleClass="p-button-outlined p-button-danger"
              (onClick)="downloadErrorReport()"
              aria-label="Download error report as CSV">
            </p-button>
            <p-button
              label="{{ 'bulkImport.results.importMore' | translate }}"
              icon="pi pi-refresh"
              styleClass="p-button-outlined"
              (onClick)="resetWizard()"
              aria-label="Start a new import">
            </p-button>
            <p-button
              label="{{ 'bulkImport.results.viewUsers' | translate }}"
              icon="pi pi-users"
              (onClick)="navigateToUsers()"
              aria-label="Navigate to user list">
            </p-button>
          </div>
        </p-card>
      </div>
    </div>
  `,
  styles: [`
    .bulk-import-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    :host ::ng-deep .bulk-import-steps {
      margin-bottom: 24px;
    }

    .step-content {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Upload - Drop Zone */
    .drop-zone {
      border: 2px dashed var(--surface-border, #dee2e6);
      border-radius: 12px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--surface-ground, #f8f9fa);
      margin-bottom: 16px;
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
      padding: 24px;
    }

    .drop-zone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .drop-icon {
      font-size: 48px;
      color: var(--primary-color, #3b82f6);
    }

    .drop-text {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color, #333);
      margin: 0;
    }

    .drop-hint {
      font-size: 13px;
      color: var(--text-color-secondary, #6b7280);
      margin: 0;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 16px;
      justify-content: center;
    }

    .file-icon {
      font-size: 36px;
      color: var(--green-600, #16a34a);
    }

    .file-details {
      display: flex;
      flex-direction: column;
      text-align: left;
    }

    .file-name {
      font-weight: 600;
      font-size: 15px;
      color: var(--text-color, #333);
    }

    .file-size {
      font-size: 13px;
      color: var(--text-color-secondary, #6b7280);
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

    .excel-note {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--blue-50, #eff6ff);
      border-radius: 8px;
      color: var(--blue-700, #1d4ed8);
      font-size: 13px;
      margin-bottom: 16px;
    }

    .upload-error-msg {
      margin-bottom: 16px;
      width: 100%;
    }

    /* Mapping Section */
    .mapping-section {
      margin-bottom: 24px;
    }

    .mapping-section h4 {
      margin: 0 0 16px 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color, #333);
    }

    .mapping-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }

    .mapping-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mapping-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-color, #333);
    }

    .required-marker {
      color: var(--red-500, #ef4444);
      margin-left: 2px;
    }

    /* Validation Summary */
    .validation-summary {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    /* Table rows */
    .invalid-row {
      background: var(--red-50, #fef2f2) !important;
    }

    .text-success {
      color: var(--green-600, #16a34a);
    }

    .text-danger {
      color: var(--red-600, #dc2626);
    }

    .text-center {
      text-align: center;
    }

    /* Error details */
    .error-details-section {
      margin-top: 16px;
    }

    .error-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;
    }

    .error-item {
      padding: 8px 0;
      border-bottom: 1px solid var(--surface-100, #f3f4f6);
      font-size: 13px;
    }

    .error-item:last-child {
      border-bottom: none;
    }

    .error-item ul {
      margin: 4px 0 0 0;
      padding-left: 20px;
      color: var(--red-600, #dc2626);
    }

    /* Progress Section */
    .import-progress-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      padding: 24px 0;
    }

    .progress-block {
      width: 100%;
      max-width: 600px;
    }

    .progress-block h4 {
      margin: 0 0 12px 0;
      text-align: center;
      font-size: 15px;
      color: var(--text-color, #333);
    }

    .processing-stats {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 12px;
      font-size: 13px;
      flex-wrap: wrap;
    }

    .waiting-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
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

    .summary-total {
      background: var(--blue-50, #eff6ff);
    }
    .summary-total i,
    .summary-total .summary-value {
      color: var(--blue-600, #2563eb);
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

    .error-results-section {
      margin-bottom: 24px;
    }

    .error-results-section h4 {
      margin: 0 0 12px 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color, #333);
    }

    .original-data {
      font-size: 12px;
      font-family: monospace;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
export class BulkImportComponent implements OnInit, OnDestroy {
  readonly ACCEPTED_EXTENSIONS = ACCEPTED_EXTENSIONS;
  readonly PREVIEW_ROW_COUNT = PREVIEW_ROW_COUNT;

  /* Step configuration */
  steps = [
    { label: 'Upload' },
    { label: 'Preview & Mapping' },
    { label: 'Import' },
    { label: 'Results' },
  ];
  activeStep = 0;

  /* Step 1 - Upload */
  isDragOver = false;
  selectedFile: File | null = null;
  uploadError: string | null = null;
  isParsing = false;
  isExcelFile = false;

  /* Step 2 - Preview & Mapping */
  csvHeaders: string[] = [];
  parsedRows: Record<string, string>[] = [];
  columnMappings: ColumnMapping[] = [];
  csvColumnOptions: Array<{ label: string; value: string }> = [];
  validatedRows: RowValidation[] = [];
  showErrorDetails = false;

  /* Step 3 - Import */
  isUploading = false;
  uploadProgress = 0;
  isProcessing = false;
  processingProgress = 0;
  importJobId: string | null = null;
  importStatus: ImportJobStatus | null = null;

  /* Step 4 - Results */
  importResult: ImportResult | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.resetMappings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ================================================================ */
  /*  Computed helpers                                                  */
  /* ================================================================ */

  get canProceedFromUpload(): boolean {
    if (!this.selectedFile || this.isParsing) {
      return false;
    }
    if (this.isExcelFile) {
      return true;
    }
    return this.csvHeaders.length > 0 && this.parsedRows.length > 0;
  }

  get validRowCount(): number {
    return this.validatedRows.filter((r) => r.valid).length;
  }

  get invalidRowCount(): number {
    return this.validatedRows.filter((r) => !r.valid).length;
  }

  get invalidRows(): RowValidation[] {
    return this.validatedRows.filter((r) => !r.valid);
  }

  /* ================================================================ */
  /*  Step navigation                                                  */
  /* ================================================================ */

  goToStep(step: number): void {
    if (step === 1 && this.activeStep === 0) {
      this.validateAllRows();
    }
    this.activeStep = step;
  }

  /* ================================================================ */
  /*  Step 1 - File upload / drag-and-drop                             */
  /* ================================================================ */

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
      input.value = ''; // allow re-selecting the same file
    }
  }

  clearFile(): void {
    this.selectedFile = null;
    this.uploadError = null;
    this.csvHeaders = [];
    this.parsedRows = [];
    this.validatedRows = [];
    this.isExcelFile = false;
    this.resetMappings();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private processFile(file: File): void {
    this.uploadError = null;

    // Validate file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
      fileName.endsWith(ext),
    );
    if (!hasValidExtension) {
      this.uploadError = 'Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls).';
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      this.uploadError = `File size exceeds the maximum limit of ${this.formatFileSize(MAX_FILE_SIZE)}.`;
      return;
    }

    this.selectedFile = file;
    this.isExcelFile = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!this.isExcelFile) {
      this.parseCSV(file);
    }
  }

  private parseCSV(file: File): void {
    this.isParsing = true;
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result as string;
        const rows = this.parseCSVText(text);

        if (rows.length < 2) {
          this.uploadError = 'CSV file must contain a header row and at least one data row.';
          this.isParsing = false;
          return;
        }

        this.csvHeaders = rows[0];
        this.csvColumnOptions = this.csvHeaders.map((h) => ({
          label: h,
          value: h,
        }));

        this.parsedRows = rows.slice(1).map((row) => {
          const obj: Record<string, string> = {};
          this.csvHeaders.forEach((header, idx) => {
            obj[header] = row[idx] || '';
          });
          return obj;
        });

        // Auto-detect column mappings
        this.autoDetectMappings();
        this.isParsing = false;
      } catch {
        this.uploadError = 'Failed to parse CSV file. Please check the file format.';
        this.isParsing = false;
      }
    };

    reader.onerror = () => {
      this.uploadError = 'Failed to read the file.';
      this.isParsing = false;
    };

    reader.readAsText(file);
  }

  /** Simple CSV parser that handles quoted fields */
  private parseCSVText(text: string): string[][] {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (line.trim() === '') continue;

      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
          if (char === '"') {
            // Check for escaped quote
            if (i + 1 < line.length && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            current += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            fields.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
      }
      fields.push(current.trim());
      rows.push(fields);
    }

    return rows;
  }

  private autoDetectMappings(): void {
    this.resetMappings();
    const headerLower = this.csvHeaders.map((h) => h.toLowerCase().replace(/[\s_-]/g, ''));

    for (const mapping of this.columnMappings) {
      const targetLower = mapping.expectedField.toLowerCase();
      const matchIndex = headerLower.findIndex(
        (h) =>
          h === targetLower ||
          h === targetLower.replace(/([A-Z])/g, '').toLowerCase() ||
          h.includes(targetLower),
      );
      if (matchIndex !== -1) {
        mapping.mappedColumn = this.csvHeaders[matchIndex];
      }
    }
  }

  private resetMappings(): void {
    this.columnMappings = EXPECTED_FIELDS.map((f) => ({ ...f }));
  }

  /* ================================================================ */
  /*  Step 2 - Preview & validation                                    */
  /* ================================================================ */

  onMappingChanged(): void {
    this.validateAllRows();
  }

  private validateAllRows(): void {
    this.validatedRows = this.parsedRows.map((data, index) => {
      const errors: string[] = [];

      for (const mapping of this.columnMappings) {
        if (!mapping.required) continue;

        const col = mapping.mappedColumn;
        if (!col) {
          errors.push(`No column mapped for required field "${mapping.label}".`);
          continue;
        }

        const value = data[col]?.trim() || '';
        if (!value) {
          errors.push(`"${mapping.label}" is empty.`);
        }

        // Email format validation
        if (
          mapping.expectedField === 'email' &&
          value &&
          !EMAIL_REGEX.test(value)
        ) {
          errors.push(`Invalid email format: "${value}".`);
        }
      }

      return {
        rowIndex: index,
        data,
        valid: errors.length === 0,
        errors,
      } as RowValidation;
    });
  }

  /* ================================================================ */
  /*  Step 3 - Import execution                                        */
  /* ================================================================ */

  startImport(): void {
    if (!this.selectedFile) return;

    this.activeStep = 2;
    this.isUploading = true;
    this.uploadProgress = 0;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    const mappingPayload: Record<string, string | null> = {};
    for (const m of this.columnMappings) {
      mappingPayload[m.expectedField] = m.mappedColumn;
    }
    formData.append('mapping', JSON.stringify(mappingPayload));

    this.http
      .post<ApiResponse<{ jobId: string }>>(API_BASE, formData, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            this.uploadProgress = event.total
              ? Math.round((event.loaded / event.total) * 100)
              : 0;
          } else if (event.type === HttpEventType.Response) {
            this.isUploading = false;
            const body = event.body as ApiResponse<{ jobId: string }>;
            this.importJobId = body.data.jobId;
            this.pollImportStatus();
          }
        },
        error: (err) => {
          this.isUploading = false;
          this.uploadError =
            err?.error?.error?.message || 'Failed to upload file. Please try again.';
          this.activeStep = 1;
        },
      });
  }

  private pollImportStatus(): void {
    if (!this.importJobId) return;

    this.isProcessing = true;
    this.processingProgress = 0;

    timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.http.get<ApiResponse<ImportJobStatus>>(
            `${API_BASE}/${this.importJobId}/status`,
          ),
        ),
        takeUntil(this.destroy$),
        takeWhile((response) => {
          const status = response.data;
          this.importStatus = status;
          this.processingProgress =
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
            this.onImportComplete(status);
          }
        },
        error: (err) => {
          this.isProcessing = false;
          this.uploadError =
            err?.error?.error?.message || 'Failed to retrieve import status.';
          this.activeStep = 1;
        },
      });
  }

  private onImportComplete(status: ImportJobStatus): void {
    this.isProcessing = false;

    // Fetch full results including error details
    this.http
      .get<ApiResponse<ImportResult>>(
        `${API_BASE}/${this.importJobId}/results`,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.importResult = response.data;
          this.activeStep = 3;
        },
        error: () => {
          // Fallback: construct result from status
          this.importResult = {
            total: status.total,
            succeeded: status.succeeded,
            failed: status.failed,
            errors: [],
          };
          this.activeStep = 3;
        },
      });
  }

  /* ================================================================ */
  /*  Step 4 - Results                                                 */
  /* ================================================================ */

  formatRowData(data: Record<string, string>): string {
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }

  downloadErrorReport(): void {
    if (!this.importResult || this.importResult.errors.length === 0) return;

    const headers = ['Row', 'Error Message', ...Object.keys(this.importResult.errors[0].data)];
    const csvRows = [headers.join(',')];

    for (const err of this.importResult.errors) {
      const dataValues = Object.values(err.data).map((v) =>
        `"${(v || '').replace(/"/g, '""')}"`,
      );
      csvRows.push(
        [
          err.row.toString(),
          `"${err.message.replace(/"/g, '""')}"`,
          ...dataValues,
        ].join(','),
      );
    }

    const blob = new Blob([csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  resetWizard(): void {
    this.activeStep = 0;
    this.selectedFile = null;
    this.uploadError = null;
    this.isParsing = false;
    this.isExcelFile = false;
    this.csvHeaders = [];
    this.parsedRows = [];
    this.validatedRows = [];
    this.showErrorDetails = false;
    this.isUploading = false;
    this.uploadProgress = 0;
    this.isProcessing = false;
    this.processingProgress = 0;
    this.importJobId = null;
    this.importStatus = null;
    this.importResult = null;
    this.resetMappings();
  }

  navigateToUsers(): void {
    this.router.navigate(['/users']);
  }
}
