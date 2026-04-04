import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface AuthRule {
  id: string;
  name: string;
  rule: string;
  action: 'ALLOW' | 'DENY' | 'REQUIRE_MFA' | 'STEP_UP';
  priority: number;
  enabled: boolean;
}

interface TestContext {
  ipAddress: string;
  userAgent: string;
  timeOfDay: string;
  accountStatus: string;
  roles: string;
}

interface TestResult {
  result: 'PASS' | 'FAIL';
  details: string;
  evaluatedExpression: string;
}

@Component({
  selector: 'app-auth-policy',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    InputTextareaModule,
    InputNumberModule,
    InputSwitchModule,
    DropdownModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    DialogModule
  ],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading authentication policy rules">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'policies.authRules.loading' | translate }}</p>
    </div>

    <!-- Error State -->
    <p-message *ngIf="errorMessage && !loading" severity="error" [text]="errorMessage"
               styleClass="error-banner" role="alert">
    </p-message>

    <!-- Success State -->
    <p-message *ngIf="successMessage && !loading" severity="success" [text]="successMessage"
               styleClass="success-banner" role="status">
    </p-message>

    <!-- Main Content -->
    <div *ngIf="!loading" class="auth-policy-container">

      <!-- Header Toolbar -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">{{ 'policies.authRules.title' | translate }}</h2>
          <span class="rule-count-badge" aria-live="polite">{{ rules.length }} rules</span>
        </div>
        <div class="header-right">
          <p-button [label]="'policies.authRules.createRule' | translate"
                    icon="pi pi-plus"
                    (onClick)="openCreateDialog()"
                    aria-label="Create a new authentication policy rule">
          </p-button>
        </div>
      </div>

      <!-- SpEL Examples Collapsible Panel -->
      <div class="examples-panel">
        <button type="button" class="examples-toggle" (click)="examplesExpanded = !examplesExpanded"
                [attr.aria-expanded]="examplesExpanded"
                aria-controls="spel-examples-content">
          <i class="pi" [ngClass]="examplesExpanded ? 'pi-chevron-down' : 'pi-chevron-right'" aria-hidden="true"></i>
          <span>{{ 'policies.authRules.spelExamples' | translate }}</span>
        </button>
        <div *ngIf="examplesExpanded" id="spel-examples-content" class="examples-content">
          <div *ngFor="let example of spelExamples" class="example-item">
            <div class="example-header">
              <span class="example-label">{{ example.label }}</span>
              <button type="button" class="copy-btn" (click)="copyToClipboard(example.expression)"
                      [attr.aria-label]="'Copy expression: ' + example.label">
                <i class="pi pi-copy" aria-hidden="true"></i>
              </button>
            </div>
            <code class="example-code" [innerHTML]="highlightSpel(example.expression)"></code>
          </div>
        </div>
      </div>

      <!-- Rules Table -->
      <p-card styleClass="rules-table-card">
        <div *ngIf="rules.length === 0" class="empty-state" role="status">
          <i class="pi pi-shield" aria-hidden="true"></i>
          <h3>{{ 'policies.authRules.noRules' | translate }}</h3>
          <p>{{ 'policies.authRules.noRulesDescription' | translate }}</p>
        </div>

        <div *ngIf="rules.length > 0" class="rules-table" role="table" aria-label="Authentication policy rules">
          <div class="table-header" role="row">
            <span class="th th-name" role="columnheader">Name</span>
            <span class="th th-rule" role="columnheader">SpEL Expression</span>
            <span class="th th-action" role="columnheader">Action</span>
            <span class="th th-priority" role="columnheader">Priority</span>
            <span class="th th-enabled" role="columnheader">Enabled</span>
            <span class="th th-actions" role="columnheader">Actions</span>
          </div>
          <div *ngFor="let rule of rules; trackBy: trackByRuleId"
               class="table-row" role="row">
            <span class="td td-name" role="cell">{{ rule.name }}</span>
            <span class="td td-rule" role="cell">
              <code class="rule-expression" [innerHTML]="highlightSpel(rule.rule)"></code>
            </span>
            <span class="td td-action" role="cell">
              <span class="action-badge" [attr.data-action]="rule.action">{{ rule.action }}</span>
            </span>
            <span class="td td-priority" role="cell">
              <span class="priority-badge">{{ rule.priority }}</span>
            </span>
            <span class="td td-enabled" role="cell">
              <p-inputSwitch [(ngModel)]="rule.enabled"
                             [ngModelOptions]="{ standalone: true }"
                             (onChange)="onToggleEnabled(rule)"
                             [attr.aria-label]="'Toggle rule ' + rule.name + ' enabled state'">
              </p-inputSwitch>
            </span>
            <span class="td td-actions" role="cell">
              <button type="button" class="icon-btn" (click)="openTestDialog(rule)"
                      [attr.aria-label]="'Test rule ' + rule.name">
                <i class="pi pi-play" aria-hidden="true"></i>
              </button>
              <button type="button" class="icon-btn" (click)="openEditDialog(rule)"
                      [attr.aria-label]="'Edit rule ' + rule.name">
                <i class="pi pi-pencil" aria-hidden="true"></i>
              </button>
              <button type="button" class="icon-btn icon-btn-danger" (click)="confirmDelete(rule)"
                      [attr.aria-label]="'Delete rule ' + rule.name">
                <i class="pi pi-trash" aria-hidden="true"></i>
              </button>
            </span>
          </div>
        </div>
      </p-card>
    </div>

    <!-- Create / Edit Rule Dialog -->
    <p-dialog [(visible)]="ruleDialogVisible"
              [header]="editingRule ? ('policies.authRules.editRule' | translate) : ('policies.authRules.createRule' | translate)"
              [modal]="true"
              [style]="{ width: '640px' }"
              [contentStyle]="{ 'overflow': 'visible' }"
              aria-label="Rule editor dialog">
      <form *ngIf="ruleForm" [formGroup]="ruleForm" (ngSubmit)="onSaveRule()" aria-label="Authentication rule form">
        <div class="dialog-form">
          <div class="field">
            <label for="ruleName" class="field-label">
              {{ 'policies.authRules.ruleName' | translate }} *
            </label>
            <input pInputText id="ruleName" formControlName="name"
                   class="w-full"
                   [placeholder]="'policies.authRules.ruleNamePlaceholder' | translate"
                   aria-required="true"
                   [attr.aria-invalid]="ruleForm.get('name')?.invalid && ruleForm.get('name')?.touched" />
            <small *ngIf="ruleForm.get('name')?.invalid && ruleForm.get('name')?.touched"
                   class="p-error" role="alert">
              Rule name is required.
            </small>
          </div>

          <div class="field">
            <label for="ruleExpression" class="field-label">
              {{ 'policies.authRules.spelExpression' | translate }} *
            </label>
            <textarea pInputTextarea id="ruleExpression" formControlName="rule"
                      rows="6"
                      class="w-full rule-textarea"
                      [placeholder]="'policies.authRules.spelExpressionPlaceholder' | translate"
                      aria-required="true"
                      [attr.aria-invalid]="ruleForm.get('rule')?.invalid && ruleForm.get('rule')?.touched">
            </textarea>
            <small *ngIf="ruleForm.get('rule')?.invalid && ruleForm.get('rule')?.touched"
                   class="p-error" role="alert">
              SpEL expression is required.
            </small>
          </div>

          <div class="form-row">
            <div class="field">
              <label for="ruleAction" class="field-label">
                {{ 'policies.authRules.ruleAction' | translate }}
              </label>
              <p-dropdown inputId="ruleAction" formControlName="action"
                          [options]="ruleActionOptions"
                          styleClass="w-full"
                          aria-label="Rule action">
              </p-dropdown>
            </div>
            <div class="field">
              <label for="rulePriority" class="field-label">
                {{ 'policies.authRules.rulePriority' | translate }}
              </label>
              <p-inputNumber inputId="rulePriority" formControlName="priority"
                             [min]="1"
                             [showButtons]="true"
                             aria-label="Rule priority">
              </p-inputNumber>
            </div>
          </div>

          <div class="switch-item">
            <label for="ruleEnabled" class="switch-label">
              {{ 'policies.authRules.ruleEnabled' | translate }}
            </label>
            <p-inputSwitch inputId="ruleEnabled" formControlName="enabled"
                           aria-label="Rule enabled state">
            </p-inputSwitch>
          </div>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <div class="dialog-footer">
          <p-button [label]="'common.cancel' | translate"
                    styleClass="p-button-outlined p-button-secondary"
                    (onClick)="ruleDialogVisible = false"
                    aria-label="Cancel">
          </p-button>
          <p-button [label]="'policies.authRules.testRule' | translate"
                    icon="pi pi-play"
                    styleClass="p-button-outlined"
                    (onClick)="openTestDialogFromEditor()"
                    [disabled]="!ruleForm!.get('rule')!.value"
                    aria-label="Test the current rule">
          </p-button>
          <p-button [label]="editingRule ? ('common.update' | translate) : ('common.create' | translate)"
                    icon="pi pi-save"
                    [disabled]="ruleForm!.invalid || savingRule"
                    [loading]="savingRule"
                    (onClick)="onSaveRule()"
                    [attr.aria-label]="editingRule ? 'Update rule' : 'Create rule'">
          </p-button>
        </div>
      </ng-template>
    </p-dialog>

    <!-- Test Rule Dialog -->
    <p-dialog [(visible)]="testDialogVisible"
              [header]="'policies.authRules.testRule' | translate"
              [modal]="true"
              [style]="{ width: '560px' }"
              aria-label="Test rule dialog">
      <div class="test-form">
        <div class="field">
          <label for="testIp" class="field-label">IP Address</label>
          <input pInputText id="testIp" [(ngModel)]="testContext.ipAddress"
                 [ngModelOptions]="{ standalone: true }"
                 placeholder="192.168.1.1"
                 class="w-full"
                 aria-label="Test IP address" />
        </div>
        <div class="field">
          <label for="testUserAgent" class="field-label">User Agent</label>
          <input pInputText id="testUserAgent" [(ngModel)]="testContext.userAgent"
                 [ngModelOptions]="{ standalone: true }"
                 placeholder="Mozilla/5.0..."
                 class="w-full"
                 aria-label="Test user agent" />
        </div>
        <div class="form-row">
          <div class="field">
            <label for="testTime" class="field-label">Time of Day</label>
            <input pInputText id="testTime" type="time"
                   [(ngModel)]="testContext.timeOfDay"
                   [ngModelOptions]="{ standalone: true }"
                   class="w-full"
                   aria-label="Test time of day" />
          </div>
          <div class="field">
            <label for="testAccountStatus" class="field-label">Account Status</label>
            <p-dropdown inputId="testAccountStatus"
                        [(ngModel)]="testContext.accountStatus"
                        [ngModelOptions]="{ standalone: true }"
                        [options]="accountStatusOptions"
                        placeholder="Select status..."
                        styleClass="w-full"
                        aria-label="Test account status">
            </p-dropdown>
          </div>
        </div>
        <div class="field">
          <label for="testRoles" class="field-label">Roles (comma-separated)</label>
          <input pInputText id="testRoles" [(ngModel)]="testContext.roles"
                 [ngModelOptions]="{ standalone: true }"
                 placeholder="ADMIN, USER"
                 class="w-full"
                 aria-label="Test roles, comma separated" />
        </div>

        <!-- Test Result -->
        <div *ngIf="testResult" class="test-result"
             [ngClass]="{ 'test-pass': testResult.result === 'PASS', 'test-fail': testResult.result === 'FAIL' }"
             role="status" [attr.aria-label]="'Test result: ' + testResult.result">
          <div class="test-result-header">
            <i class="pi" [ngClass]="testResult.result === 'PASS' ? 'pi-check-circle' : 'pi-times-circle'"
               aria-hidden="true"></i>
            <span class="test-result-label">{{ testResult.result }}</span>
          </div>
          <p class="test-result-details">{{ testResult.details }}</p>
          <code class="test-result-expression">{{ testResult.evaluatedExpression }}</code>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="dialog-footer">
          <p-button [label]="'common.close' | translate"
                    styleClass="p-button-outlined p-button-secondary"
                    (onClick)="testDialogVisible = false"
                    aria-label="Close test dialog">
          </p-button>
          <p-button [label]="'policies.authRules.runTest' | translate"
                    icon="pi pi-play"
                    [loading]="testingRule"
                    (onClick)="runTest()"
                    aria-label="Run the test">
          </p-button>
        </div>
      </ng-template>
    </p-dialog>

    <!-- Delete Confirmation Dialog -->
    <div *ngIf="deleteConfirmVisible" class="dialog-overlay"
         role="dialog" aria-modal="true" aria-label="Confirm delete rule">
      <div class="confirm-dialog-content" (click)="$event.stopPropagation()">
        <h3 class="dialog-title">{{ 'policies.authRules.deleteConfirmTitle' | translate }}</h3>
        <p class="dialog-message">
          Are you sure you want to delete the rule <strong>{{ deletingRule?.name }}</strong>? This action cannot be undone.
        </p>
        <div class="dialog-footer">
          <p-button [label]="'common.cancel' | translate"
                    styleClass="p-button-outlined p-button-secondary"
                    (onClick)="deleteConfirmVisible = false"
                    aria-label="Cancel delete">
          </p-button>
          <p-button [label]="'common.delete' | translate"
                    icon="pi pi-trash"
                    styleClass="p-button-danger"
                    [loading]="deletingRuleInProgress"
                    (onClick)="executeDelete()"
                    aria-label="Confirm delete rule">
          </p-button>
        </div>
      </div>
    </div>
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

    :host ::ng-deep .error-banner,
    :host ::ng-deep .success-banner {
      width: 100%;
      margin-bottom: 1rem;
    }

    .auth-policy-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Page Header */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .page-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
      color: var(--text-color);
    }

    .rule-count-badge {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      background: var(--surface-ground);
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
    }

    /* SpEL Examples Panel */
    .examples-panel {
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      background: var(--surface-card);
      overflow: hidden;
    }

    .examples-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.75rem 1rem;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
      text-align: left;
    }

    .examples-toggle:hover {
      background: var(--surface-ground);
    }

    .examples-content {
      border-top: 1px solid var(--surface-border);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .example-item {
      background: var(--surface-ground);
      border-radius: 6px;
      padding: 0.75rem;
    }

    .example-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.375rem;
    }

    .example-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .copy-btn {
      background: none;
      border: 1px solid var(--surface-border);
      border-radius: 4px;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      color: var(--text-color-secondary);
      transition: background 0.15s;
    }

    .copy-btn:hover {
      background: var(--surface-200);
    }

    .example-code {
      display: block;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.8125rem;
      padding: 0.5rem;
      background: var(--surface-0);
      border-radius: 4px;
      border: 1px solid var(--surface-border);
      word-break: break-all;
    }

    /* Rules Table */
    :host ::ng-deep .rules-table-card {
      width: 100%;
    }

    .rules-table {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      overflow: hidden;
    }

    .table-header {
      display: flex;
      background: var(--surface-ground);
      border-bottom: 2px solid var(--surface-border);
    }

    .th {
      padding: 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--text-color-secondary);
    }

    .table-row {
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--surface-border);
      transition: background 0.1s;
    }

    .table-row:last-child {
      border-bottom: none;
    }

    .table-row:hover {
      background: var(--surface-ground);
    }

    .td {
      padding: 0.75rem;
      font-size: 0.8125rem;
    }

    .th-name, .td-name { flex: 1.2; font-weight: 600; }
    .th-rule, .td-rule { flex: 2.5; overflow: hidden; }
    .th-action, .td-action { flex: 0.8; }
    .th-priority, .td-priority { flex: 0.5; text-align: center; }
    .th-enabled, .td-enabled { flex: 0.6; text-align: center; }
    .th-actions, .td-actions { flex: 0.9; }

    .rule-expression {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.75rem;
      word-break: break-all;
      display: block;
      max-height: 3rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .action-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      background: #e3f2fd;
      color: #1565c0;
    }

    .action-badge[data-action='DENY'] {
      background: #ffebee;
      color: #c62828;
    }

    .action-badge[data-action='ALLOW'] {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .action-badge[data-action='REQUIRE_MFA'] {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    .action-badge[data-action='STEP_UP'] {
      background: #fff3e0;
      color: #e65100;
    }

    .priority-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--surface-ground);
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-color);
      border: 1px solid var(--surface-border);
    }

    .td-actions {
      display: flex;
      gap: 0.25rem;
    }

    .icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: none;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-color-secondary);
      transition: background 0.15s, color 0.15s;
    }

    .icon-btn:hover {
      background: var(--surface-ground);
      color: var(--text-color);
    }

    .icon-btn-danger:hover {
      background: #ffebee;
      color: #c62828;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 2rem;
      color: var(--text-color-secondary);
      gap: 0.5rem;
    }

    .empty-state i {
      font-size: 2.5rem;
      color: var(--surface-400);
    }

    .empty-state h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--text-color);
    }

    .empty-state p {
      margin: 0;
      font-size: 0.875rem;
    }

    /* SpEL Syntax Highlighting */
    :host ::ng-deep .spel-keyword { color: #7b1fa2; font-weight: 600; }
    :host ::ng-deep .spel-variable { color: #1565c0; font-weight: 600; }
    :host ::ng-deep .spel-boolean { color: #2e7d32; font-weight: 600; }
    :host ::ng-deep .spel-string { color: #e65100; }

    /* Dialog Form */
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .field {
      margin-bottom: 0;
    }

    .field-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
      font-size: 0.875rem;
    }

    .w-full {
      width: 100%;
    }

    .form-row {
      display: flex;
      gap: 1rem;
    }

    .form-row .field {
      flex: 1;
    }

    .rule-textarea {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.8125rem;
    }

    .switch-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: var(--surface-ground);
      border-radius: 6px;
      border: 1px solid var(--surface-border);
    }

    .switch-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .p-error {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    /* Test Result */
    .test-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .test-result {
      margin-top: 0.5rem;
      padding: 1rem;
      border-radius: 8px;
      border: 2px solid;
    }

    .test-pass {
      border-color: #2e7d32;
      background: #e8f5e9;
    }

    .test-fail {
      border-color: #c62828;
      background: #ffebee;
    }

    .test-result-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .test-result-header i {
      font-size: 1.25rem;
    }

    .test-pass .test-result-header i { color: #2e7d32; }
    .test-fail .test-result-header i { color: #c62828; }

    .test-result-label {
      font-size: 1rem;
      font-weight: 700;
    }

    .test-pass .test-result-label { color: #2e7d32; }
    .test-fail .test-result-label { color: #c62828; }

    .test-result-details {
      font-size: 0.8125rem;
      margin: 0 0 0.5rem 0;
      color: var(--text-color);
    }

    .test-result-expression {
      display: block;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.75rem;
      padding: 0.375rem 0.5rem;
      background: rgba(255,255,255,0.7);
      border-radius: 4px;
    }

    /* Delete Confirm Dialog */
    .dialog-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      z-index: 1100;
    }

    .confirm-dialog-content {
      background: var(--surface-card);
      border-radius: 8px;
      padding: 1.5rem;
      width: 420px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    }

    .dialog-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 0.75rem 0;
      color: var(--text-color);
    }

    .dialog-message {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
      margin: 0 0 1.25rem 0;
      line-height: 1.5;
    }

    @media (max-width: 960px) {
      .table-header, .table-row {
        flex-wrap: wrap;
      }

      .th-rule, .td-rule { flex: 1 1 100%; }

      .form-row {
        flex-direction: column;
      }
    }
  `]
})
export class AuthPolicyComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/policies/auth-rules';

  loading = true;
  saving = false;
  savingRule = false;
  testingRule = false;
  deletingRuleInProgress = false;
  errorMessage = '';
  successMessage = '';
  examplesExpanded = false;

  rules: AuthRule[] = [];

  // Rule Dialog
  ruleDialogVisible = false;
  editingRule: AuthRule | null = null;
  ruleForm!: FormGroup;

  // Test Dialog
  testDialogVisible = false;
  testingRuleExpression = '';
  testContext: TestContext = {
    ipAddress: '',
    userAgent: '',
    timeOfDay: '',
    accountStatus: '',
    roles: ''
  };
  testResult: TestResult | null = null;

  // Delete Confirmation
  deleteConfirmVisible = false;
  deletingRule: AuthRule | null = null;

  readonly ruleActionOptions = [
    { label: 'Allow', value: 'ALLOW' },
    { label: 'Deny', value: 'DENY' },
    { label: 'Require MFA', value: 'REQUIRE_MFA' },
    { label: 'Step Up', value: 'STEP_UP' }
  ];

  readonly accountStatusOptions = [
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Suspended', value: 'SUSPENDED' },
    { label: 'Locked', value: 'LOCKED' },
    { label: 'Inactive', value: 'INACTIVE' }
  ];

  readonly spelExamples = [
    {
      label: 'Block specific IP range',
      expression: "#request.ipAddress.startsWith('10.0.')"
    },
    {
      label: 'Require MFA after hours',
      expression: "T(java.time.LocalTime).now().isAfter(T(java.time.LocalTime).of(18,0))"
    },
    {
      label: 'Deny suspended accounts',
      expression: "#user.accountStatus == 'SUSPENDED'"
    }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadRules();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ------------------------------------------------------------------ */
  /*  Data loading                                                       */
  /* ------------------------------------------------------------------ */

  private loadRules(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<AuthRule[]>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.rules = (response.data || []).sort((a, b) => a.priority - b.priority);
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load authentication policy rules. Please try again.';
          this.loading = false;
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  SpEL syntax highlighting                                           */
  /* ------------------------------------------------------------------ */

  highlightSpel(expression: string): string {
    if (!expression) return '';

    let highlighted = this.escapeHtml(expression);

    // Variables: #request, #context, #user, #session
    highlighted = highlighted.replace(
      /(#(?:request|context|user|session))/g,
      '<span class="spel-variable">$1</span>'
    );

    // Keywords: and, or, not, matches, contains
    highlighted = highlighted.replace(
      /\b(and|or|not|matches|contains)\b/g,
      '<span class="spel-keyword">$1</span>'
    );

    // Booleans: true, false
    highlighted = highlighted.replace(
      /\b(true|false)\b/g,
      '<span class="spel-boolean">$1</span>'
    );

    // String literals: '...'
    highlighted = highlighted.replace(
      /&#39;([^&#]*(?:&#[^3]|&#3[^9]|&#39[^;])*)&#39;/g,
      '<span class="spel-string">&#39;$1&#39;</span>'
    );

    return highlighted;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ------------------------------------------------------------------ */
  /*  Create / Edit Rule Dialog                                          */
  /* ------------------------------------------------------------------ */

  openCreateDialog(): void {
    this.editingRule = null;
    this.ruleForm = this.fb.group({
      name: ['', Validators.required],
      rule: ['', Validators.required],
      action: ['ALLOW'],
      priority: [this.rules.length > 0 ? Math.max(...this.rules.map(r => r.priority)) + 1 : 1],
      enabled: [true]
    });
    this.ruleDialogVisible = true;
  }

  openEditDialog(rule: AuthRule): void {
    this.editingRule = rule;
    this.ruleForm = this.fb.group({
      name: [rule.name, Validators.required],
      rule: [rule.rule, Validators.required],
      action: [rule.action],
      priority: [rule.priority],
      enabled: [rule.enabled]
    });
    this.ruleDialogVisible = true;
  }

  onSaveRule(): void {
    if (this.ruleForm.invalid) {
      this.ruleForm.markAllAsTouched();
      return;
    }

    this.savingRule = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = this.ruleForm.value;

    const request$ = this.editingRule
      ? this.http.put<ApiResponse<AuthRule>>(`${this.apiBase}/${this.editingRule.id}`, payload)
      : this.http.post<ApiResponse<AuthRule>>(this.apiBase, payload);

    request$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.savingRule = false)
      )
      .subscribe({
        next: () => {
          this.successMessage = this.editingRule
            ? 'Authentication rule updated successfully.'
            : 'Authentication rule created successfully.';
          this.ruleDialogVisible = false;
          this.loadRules();
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to save authentication rule. Please try again.';
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Enable/Disable toggle                                              */
  /* ------------------------------------------------------------------ */

  onToggleEnabled(rule: AuthRule): void {
    this.http.put<ApiResponse<AuthRule>>(`${this.apiBase}/${rule.id}`, { enabled: rule.enabled })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = `Rule "${rule.name}" ${rule.enabled ? 'enabled' : 'disabled'} successfully.`;
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          rule.enabled = !rule.enabled; // Revert on error
          this.errorMessage = err?.error?.message || 'Failed to update rule status. Please try again.';
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Delete Rule                                                        */
  /* ------------------------------------------------------------------ */

  confirmDelete(rule: AuthRule): void {
    this.deletingRule = rule;
    this.deleteConfirmVisible = true;
  }

  executeDelete(): void {
    if (!this.deletingRule) return;

    this.deletingRuleInProgress = true;

    this.http.delete<ApiResponse<void>>(`${this.apiBase}/${this.deletingRule.id}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.deletingRuleInProgress = false)
      )
      .subscribe({
        next: () => {
          this.successMessage = `Rule "${this.deletingRule!.name}" deleted successfully.`;
          this.deleteConfirmVisible = false;
          this.deletingRule = null;
          this.loadRules();
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to delete rule. Please try again.';
          this.deleteConfirmVisible = false;
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Test Rule                                                          */
  /* ------------------------------------------------------------------ */

  openTestDialog(rule: AuthRule): void {
    this.testingRuleExpression = rule.rule;
    this.testResult = null;
    this.testDialogVisible = true;
  }

  openTestDialogFromEditor(): void {
    if (this.ruleForm?.get('rule')?.value) {
      this.testingRuleExpression = this.ruleForm.get('rule')!.value;
      this.testResult = null;
      this.testDialogVisible = true;
    }
  }

  runTest(): void {
    this.testingRule = true;

    const payload = {
      rule: this.testingRuleExpression,
      context: {
        ipAddress: this.testContext.ipAddress,
        userAgent: this.testContext.userAgent,
        timeOfDay: this.testContext.timeOfDay,
        accountStatus: this.testContext.accountStatus,
        roles: this.testContext.roles ? this.testContext.roles.split(',').map(r => r.trim()) : []
      }
    };

    this.http.post<ApiResponse<TestResult>>(`${this.apiBase}/test`, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.testingRule = false)
      )
      .subscribe({
        next: (response) => {
          this.testResult = response.data || null;
        },
        error: (err) => {
          this.testResult = {
            result: 'FAIL',
            details: err?.error?.message || 'Failed to evaluate expression.',
            evaluatedExpression: this.testingRuleExpression
          };
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Utility                                                            */
  /* ------------------------------------------------------------------ */

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }

  trackByRuleId(index: number, rule: AuthRule): string {
    return rule.id;
  }
}
