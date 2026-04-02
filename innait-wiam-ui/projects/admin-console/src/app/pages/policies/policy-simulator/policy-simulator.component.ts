import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse, User } from '@innait/core';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface SimulationContext {
  ipAddress: string;
  userAgent: string;
  timeOverride: string;
}

interface UserSuggestion {
  id: string;
  displayName: string;
  email: string;
}

interface AuthTypeResult {
  primaryFactors: string[];
  secondaryFactors: string[];
  mfaRequired: string;
  sourceHierarchy: string[];
}

interface PasswordPolicyResult {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
  specialCharsAllowed: string;
  maxAge: number;
  historyCount: number;
  maxFailedAttempts: number;
  lockoutDuration: number;
  sourceHierarchy: string[];
}

interface MfaPolicyResult {
  allowedMethods: string[];
  deviceRememberDays: number;
  enrollmentGracePeriodDays: number;
  conditions: { trigger: string; action: string }[];
  sourceHierarchy: string[];
}

interface AuthRuleResult {
  name: string;
  expression: string;
  action: string;
  wouldFire: boolean;
  sourceHierarchy: string[];
}

interface SimulationResult {
  authType: AuthTypeResult;
  passwordPolicy: PasswordPolicyResult;
  mfaPolicy: MfaPolicyResult;
  authRules: AuthRuleResult[];
}

@Component({
  selector: 'app-policy-simulator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    CardModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule
  ],
  template: `
    <!-- Error State -->
    <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"
               styleClass="error-banner" role="alert">
    </p-message>

    <div class="simulator-container">

      <!-- Input Section (Top Card) -->
      <p-card [header]="'policies.simulator.title' | translate"
              [subheader]="'policies.simulator.subtitle' | translate"
              styleClass="input-card">
        <div class="input-section" role="search" aria-label="Policy simulation input">

          <!-- Account Selector -->
          <div class="field account-field">
            <label for="accountSearch" class="field-label">
              {{ 'policies.simulator.account' | translate }} *
            </label>
            <div class="autocomplete-wrapper">
              <i class="pi pi-search autocomplete-icon" aria-hidden="true"></i>
              <input pInputText id="accountSearch"
                     [(ngModel)]="searchQuery"
                     (ngModelChange)="onSearchChange($event)"
                     (focus)="showSuggestions = true"
                     placeholder="Search by name or email..."
                     class="w-full autocomplete-input"
                     aria-required="true"
                     autocomplete="off"
                     [attr.aria-expanded]="showSuggestions && suggestions.length > 0"
                     aria-haspopup="listbox"
                     aria-label="Search accounts" />
              <div *ngIf="selectedAccount" class="selected-account-badge">
                <span>{{ selectedAccount.displayName }}</span>
                <button type="button" class="clear-account-btn" (click)="clearSelection()"
                        aria-label="Clear selected account">
                  <i class="pi pi-times" aria-hidden="true"></i>
                </button>
              </div>
              <!-- Suggestions Dropdown -->
              <div *ngIf="showSuggestions && suggestions.length > 0 && !selectedAccount"
                   class="suggestions-dropdown" role="listbox" aria-label="Account suggestions">
                <div *ngFor="let user of suggestions; trackBy: trackBySuggestionId"
                     class="suggestion-item"
                     role="option"
                     (click)="selectAccount(user)"
                     [attr.aria-label]="user.displayName + ' - ' + user.email">
                  <span class="suggestion-name">{{ user.displayName }}</span>
                  <span class="suggestion-email">{{ user.email }}</span>
                </div>
              </div>
              <div *ngIf="showSuggestions && searchQuery.length >= 2 && suggestions.length === 0 && !searchingAccounts && !selectedAccount"
                   class="suggestions-dropdown no-results" role="status">
                <span>No accounts found matching "{{ searchQuery }}"</span>
              </div>
              <div *ngIf="searchingAccounts" class="search-loading" role="status">
                <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
              </div>
            </div>
          </div>

          <!-- Optional Context Fields -->
          <div class="context-fields">
            <div class="field">
              <label for="contextIp" class="field-label">
                {{ 'policies.simulator.ipAddress' | translate }}
              </label>
              <input pInputText id="contextIp"
                     [(ngModel)]="simulationContext.ipAddress"
                     placeholder="192.168.1.1"
                     class="w-full"
                     aria-label="IP address context" />
            </div>
            <div class="field">
              <label for="contextUserAgent" class="field-label">
                {{ 'policies.simulator.userAgent' | translate }}
              </label>
              <input pInputText id="contextUserAgent"
                     [(ngModel)]="simulationContext.userAgent"
                     placeholder="Mozilla/5.0..."
                     class="w-full"
                     aria-label="User agent context" />
            </div>
            <div class="field">
              <label for="contextTime" class="field-label">
                {{ 'policies.simulator.timeOverride' | translate }}
              </label>
              <input pInputText id="contextTime"
                     type="datetime-local"
                     [(ngModel)]="simulationContext.timeOverride"
                     class="w-full"
                     aria-label="Time override for simulation" />
            </div>
          </div>

          <!-- Simulate Button -->
          <div class="simulate-action">
            <p-button [label]="'policies.simulator.simulate' | translate"
                      icon="pi pi-play"
                      [disabled]="!selectedAccount || simulating"
                      [loading]="simulating"
                      (onClick)="runSimulation()"
                      aria-label="Run policy simulation">
            </p-button>
          </div>
        </div>
      </p-card>

      <!-- Simulating State -->
      <div *ngIf="simulating" class="loading-container" role="status" aria-label="Running policy simulation">
        <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
        <p>{{ 'policies.simulator.simulating' | translate }}</p>
      </div>

      <!-- Empty State -->
      <div *ngIf="!simulationResult && !simulating" class="empty-state" role="status">
        <i class="pi pi-sliders-h" aria-hidden="true"></i>
        <h3>{{ 'policies.simulator.emptyTitle' | translate }}</h3>
        <p>{{ 'policies.simulator.emptyDescription' | translate }}</p>
      </div>

      <!-- Results Section (2x2 Grid) -->
      <div *ngIf="simulationResult && !simulating" class="results-section">

        <div class="results-header">
          <h3 class="results-title">
            Simulation Results for <strong>{{ selectedAccount?.displayName }}</strong>
          </h3>
          <p-button [label]="'policies.simulator.export' | translate"
                    icon="pi pi-download"
                    styleClass="p-button-outlined p-button-sm"
                    (onClick)="exportResults()"
                    aria-label="Export simulation results as JSON">
          </p-button>
        </div>

        <div class="results-grid">

          <!-- Auth Type Policy Card -->
          <p-card [header]="'policies.simulator.authTypePolicy' | translate"
                  styleClass="result-card auth-type-result">
            <div class="result-content">
              <div class="result-field">
                <span class="result-label">Primary Factors</span>
                <div class="chip-list">
                  <span *ngFor="let factor of simulationResult.authType.primaryFactors" class="chip chip-primary">
                    {{ factor }}
                  </span>
                  <span *ngIf="simulationResult.authType.primaryFactors.length === 0" class="no-value">None configured</span>
                </div>
              </div>
              <div class="result-field">
                <span class="result-label">Secondary Factors</span>
                <div class="chip-list">
                  <span *ngFor="let factor of simulationResult.authType.secondaryFactors" class="chip chip-secondary">
                    {{ factor }}
                  </span>
                  <span *ngIf="simulationResult.authType.secondaryFactors.length === 0" class="no-value">None configured</span>
                </div>
              </div>
              <div class="result-field">
                <span class="result-label">MFA Required</span>
                <span class="status-badge" [attr.data-mfa]="simulationResult.authType.mfaRequired">
                  {{ simulationResult.authType.mfaRequired }}
                </span>
              </div>
              <div class="source-hierarchy" *ngIf="simulationResult.authType.sourceHierarchy?.length">
                <span class="hierarchy-label">Source:</span>
                <span *ngFor="let source of simulationResult.authType.sourceHierarchy; let last = last"
                      class="hierarchy-item">
                  {{ source }}<span *ngIf="!last" class="hierarchy-arrow"> &rarr; </span>
                </span>
              </div>
            </div>
          </p-card>

          <!-- Password Policy Card -->
          <p-card [header]="'policies.simulator.passwordPolicy' | translate"
                  styleClass="result-card password-result">
            <div class="result-content">
              <div class="result-table">
                <div class="result-table-row">
                  <span class="result-table-key">Min Length</span>
                  <span class="result-table-value">{{ simulationResult.passwordPolicy.minLength }}</span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">Max Length</span>
                  <span class="result-table-value">{{ simulationResult.passwordPolicy.maxLength }}</span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">Require Uppercase</span>
                  <span class="result-table-value">
                    <i class="pi" [ngClass]="simulationResult.passwordPolicy.requireUppercase ? 'pi-check text-green' : 'pi-times text-muted'" aria-hidden="true"></i>
                  </span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">Require Lowercase</span>
                  <span class="result-table-value">
                    <i class="pi" [ngClass]="simulationResult.passwordPolicy.requireLowercase ? 'pi-check text-green' : 'pi-times text-muted'" aria-hidden="true"></i>
                  </span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">Require Digit</span>
                  <span class="result-table-value">
                    <i class="pi" [ngClass]="simulationResult.passwordPolicy.requireDigit ? 'pi-check text-green' : 'pi-times text-muted'" aria-hidden="true"></i>
                  </span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">Require Special Char</span>
                  <span class="result-table-value">
                    <i class="pi" [ngClass]="simulationResult.passwordPolicy.requireSpecialChar ? 'pi-check text-green' : 'pi-times text-muted'" aria-hidden="true"></i>
                  </span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">Max Age</span>
                  <span class="result-table-value">{{ simulationResult.passwordPolicy.maxAge }} days</span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">History Count</span>
                  <span class="result-table-value">{{ simulationResult.passwordPolicy.historyCount }}</span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">Max Failed Attempts</span>
                  <span class="result-table-value">{{ simulationResult.passwordPolicy.maxFailedAttempts }}</span>
                </div>
                <div class="result-table-row">
                  <span class="result-table-key">Lockout Duration</span>
                  <span class="result-table-value">{{ simulationResult.passwordPolicy.lockoutDuration }} min</span>
                </div>
              </div>
              <div class="source-hierarchy" *ngIf="simulationResult.passwordPolicy.sourceHierarchy?.length">
                <span class="hierarchy-label">Source:</span>
                <span *ngFor="let source of simulationResult.passwordPolicy.sourceHierarchy; let last = last"
                      class="hierarchy-item">
                  {{ source }}<span *ngIf="!last" class="hierarchy-arrow"> &rarr; </span>
                </span>
              </div>
            </div>
          </p-card>

          <!-- MFA Policy Card -->
          <p-card [header]="'policies.simulator.mfaPolicy' | translate"
                  styleClass="result-card mfa-result">
            <div class="result-content">
              <div class="result-field">
                <span class="result-label">Allowed Methods</span>
                <div class="chip-list">
                  <span *ngFor="let method of simulationResult.mfaPolicy.allowedMethods" class="chip chip-mfa">
                    {{ method }}
                  </span>
                  <span *ngIf="simulationResult.mfaPolicy.allowedMethods.length === 0" class="no-value">None configured</span>
                </div>
              </div>
              <div class="result-field">
                <span class="result-label">Device Remember</span>
                <span class="result-value">{{ simulationResult.mfaPolicy.deviceRememberDays }} days</span>
              </div>
              <div class="result-field">
                <span class="result-label">Enrollment Grace Period</span>
                <span class="result-value">
                  {{ simulationResult.mfaPolicy.enrollmentGracePeriodDays === 0
                    ? 'Immediate'
                    : simulationResult.mfaPolicy.enrollmentGracePeriodDays + ' days' }}
                </span>
              </div>
              <div class="result-field" *ngIf="simulationResult.mfaPolicy.conditions?.length">
                <span class="result-label">Conditions</span>
                <div class="conditions-list">
                  <div *ngFor="let condition of simulationResult.mfaPolicy.conditions" class="condition-item">
                    <span class="condition-trigger">{{ condition.trigger }}</span>
                    <i class="pi pi-arrow-right condition-arrow" aria-hidden="true"></i>
                    <span class="condition-action">{{ condition.action }}</span>
                  </div>
                </div>
              </div>
              <div class="source-hierarchy" *ngIf="simulationResult.mfaPolicy.sourceHierarchy?.length">
                <span class="hierarchy-label">Source:</span>
                <span *ngFor="let source of simulationResult.mfaPolicy.sourceHierarchy; let last = last"
                      class="hierarchy-item">
                  {{ source }}<span *ngIf="!last" class="hierarchy-arrow"> &rarr; </span>
                </span>
              </div>
            </div>
          </p-card>

          <!-- Auth Rules Card -->
          <p-card [header]="'policies.simulator.authRules' | translate"
                  styleClass="result-card auth-rules-result">
            <div class="result-content">
              <div *ngIf="simulationResult.authRules.length === 0" class="no-value">
                No matching rules found for this account.
              </div>
              <div *ngFor="let rule of simulationResult.authRules; trackBy: trackByRuleName"
                   class="auth-rule-item">
                <div class="rule-header">
                  <span class="rule-fire-indicator"
                        [ngClass]="{ 'would-fire': rule.wouldFire, 'would-not-fire': !rule.wouldFire }">
                    <i class="pi" [ngClass]="rule.wouldFire ? 'pi-check' : 'pi-times'" aria-hidden="true"></i>
                  </span>
                  <span class="rule-name">{{ rule.name }}</span>
                  <span class="action-badge" [attr.data-action]="rule.action">{{ rule.action }}</span>
                </div>
                <code class="rule-expression">{{ rule.expression }}</code>
              </div>
            </div>
          </p-card>

        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem;
    }

    :host ::ng-deep .error-banner {
      width: 100%;
      margin-bottom: 1rem;
    }

    .simulator-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    :host ::ng-deep .input-card {
      width: 100%;
    }

    :host ::ng-deep .input-card .p-card-subtitle {
      font-size: 0.8rem;
      color: var(--text-color-secondary);
    }

    /* Input Section */
    .input-section {
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

    /* Autocomplete */
    .account-field {
      max-width: 480px;
    }

    .autocomplete-wrapper {
      position: relative;
    }

    .autocomplete-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-color-secondary);
      z-index: 1;
      pointer-events: none;
    }

    .autocomplete-input {
      padding-left: 2.25rem;
    }

    .search-loading {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--primary-color);
    }

    .selected-account-badge {
      position: absolute;
      left: 2.25rem;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      gap: 0.375rem;
      background: var(--primary-50, #e3f2fd);
      color: var(--primary-color);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .clear-account-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--primary-color);
      padding: 0;
      display: flex;
      align-items: center;
    }

    .clear-account-btn:hover {
      color: var(--primary-900);
    }

    .suggestions-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 0 0 6px 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      z-index: 100;
      max-height: 240px;
      overflow-y: auto;
    }

    .suggestions-dropdown.no-results {
      padding: 1rem;
      text-align: center;
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
    }

    .suggestion-item {
      display: flex;
      flex-direction: column;
      padding: 0.625rem 0.875rem;
      cursor: pointer;
      transition: background 0.1s;
    }

    .suggestion-item:hover {
      background: var(--surface-ground);
    }

    .suggestion-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .suggestion-email {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    /* Context Fields */
    .context-fields {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1rem;
    }

    .simulate-action {
      display: flex;
      justify-content: flex-start;
      padding-top: 0.5rem;
    }

    /* Loading */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      gap: 1rem;
      color: var(--text-color-secondary);
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 2rem;
      color: var(--text-color-secondary);
      gap: 0.5rem;
    }

    .empty-state i {
      font-size: 3rem;
      color: var(--surface-400);
    }

    .empty-state h3 {
      margin: 0;
      font-size: 1.125rem;
      color: var(--text-color);
    }

    .empty-state p {
      margin: 0;
      font-size: 0.875rem;
      text-align: center;
    }

    /* Results Section */
    .results-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .results-title {
      font-size: 1rem;
      font-weight: 500;
      margin: 0;
      color: var(--text-color);
    }

    /* Results Grid (2x2) */
    .results-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    :host ::ng-deep .result-card {
      height: 100%;
    }

    :host ::ng-deep .result-card .p-card-header {
      border-left: 4px solid transparent;
    }

    :host ::ng-deep .auth-type-result .p-card-body { border-left: 4px solid #1565c0; }
    :host ::ng-deep .password-result .p-card-body { border-left: 4px solid #2e7d32; }
    :host ::ng-deep .mfa-result .p-card-body { border-left: 4px solid #7b1fa2; }
    :host ::ng-deep .auth-rules-result .p-card-body { border-left: 4px solid #e65100; }

    .result-content {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }

    .result-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .result-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--text-color-secondary);
    }

    .result-value {
      font-size: 0.875rem;
      color: var(--text-color);
      font-weight: 500;
    }

    .no-value {
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
      font-style: italic;
    }

    /* Chips */
    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .chip {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .chip-primary { background: #e3f2fd; color: #1565c0; }
    .chip-secondary { background: #f3e5f5; color: #7b1fa2; }
    .chip-mfa { background: #ede7f6; color: #4527a0; }

    /* MFA Status Badge */
    .status-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.625rem;
      border-radius: 4px;
      width: fit-content;
    }

    .status-badge[data-mfa='ALWAYS'] { background: #e8f5e9; color: #2e7d32; }
    .status-badge[data-mfa='CONDITIONAL'] { background: #fff3e0; color: #e65100; }
    .status-badge[data-mfa='NEVER'] { background: #f5f5f5; color: #616161; }

    /* Password Policy Table */
    .result-table {
      display: flex;
      flex-direction: column;
    }

    .result-table-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.375rem 0;
      border-bottom: 1px solid var(--surface-border);
      font-size: 0.8125rem;
    }

    .result-table-row:last-child {
      border-bottom: none;
    }

    .result-table-key {
      color: var(--text-color-secondary);
      font-size: 0.8125rem;
    }

    .result-table-value {
      font-weight: 600;
      color: var(--text-color);
    }

    .text-green { color: #2e7d32; }
    .text-muted { color: var(--surface-400); }

    /* MFA Conditions */
    .conditions-list {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .condition-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
    }

    .condition-trigger {
      font-weight: 600;
      color: var(--text-color);
    }

    .condition-arrow {
      color: var(--text-color-secondary);
      font-size: 0.75rem;
    }

    .condition-action {
      color: var(--primary-color);
      font-weight: 500;
    }

    /* Auth Rules Results */
    .auth-rule-item {
      padding: 0.75rem;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      margin-bottom: 0.5rem;
    }

    .auth-rule-item:last-child {
      margin-bottom: 0;
    }

    .rule-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.375rem;
    }

    .rule-fire-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .would-fire {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .would-not-fire {
      background: #f5f5f5;
      color: #9e9e9e;
    }

    .rule-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-color);
      flex: 1;
    }

    .action-badge {
      display: inline-block;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    .action-badge[data-action='ALLOW'] { background: #e8f5e9; color: #2e7d32; }
    .action-badge[data-action='DENY'] { background: #ffebee; color: #c62828; }
    .action-badge[data-action='REQUIRE_MFA'] { background: #f3e5f5; color: #7b1fa2; }
    .action-badge[data-action='STEP_UP'] { background: #fff3e0; color: #e65100; }

    .rule-expression {
      display: block;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.75rem;
      padding: 0.375rem 0.5rem;
      background: var(--surface-ground);
      border-radius: 4px;
      word-break: break-all;
      color: var(--text-color);
    }

    /* Source Hierarchy */
    .source-hierarchy {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.25rem;
      padding-top: 0.625rem;
      border-top: 1px solid var(--surface-border);
      margin-top: 0.25rem;
    }

    .hierarchy-label {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-color-secondary);
      letter-spacing: 0.03em;
    }

    .hierarchy-item {
      font-size: 0.75rem;
      color: var(--text-color);
    }

    .hierarchy-arrow {
      color: var(--text-color-secondary);
    }

    @media (max-width: 960px) {
      .results-grid {
        grid-template-columns: 1fr;
      }

      .context-fields {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      :host {
        padding: 1rem;
      }
    }
  `]
})
export class PolicySimulatorComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();
  private readonly apiBase = '/api/v1/admin/policies';

  errorMessage = '';
  simulating = false;
  searchingAccounts = false;

  // Account search
  searchQuery = '';
  suggestions: UserSuggestion[] = [];
  showSuggestions = false;
  selectedAccount: UserSuggestion | null = null;

  // Context
  simulationContext: SimulationContext = {
    ipAddress: '',
    userAgent: '',
    timeOverride: ''
  };

  // Results
  simulationResult: SimulationResult | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.setupAccountSearch();
    this.setupClickOutside();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.clickOutsideListener) {
      document.removeEventListener('click', this.clickOutsideListener);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Account search autocomplete                                        */
  /* ------------------------------------------------------------------ */

  private clickOutsideListener: ((e: MouseEvent) => void) | null = null;

  private setupClickOutside(): void {
    this.clickOutsideListener = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.autocomplete-wrapper')) {
        this.showSuggestions = false;
      }
    };
    document.addEventListener('click', this.clickOutsideListener);
  }

  private setupAccountSearch(): void {
    this.searchSubject$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => {
          if (query.length < 2) {
            return of([]);
          }
          this.searchingAccounts = true;
          const params = new HttpParams().set('search', query).set('size', '10');
          return this.http.get<ApiResponse<any[]>>('/api/v1/admin/users', { params });
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          if (Array.isArray(response)) {
            this.suggestions = [];
          } else {
            this.suggestions = (response.data || []).map((u: any) => ({
              id: u.id,
              displayName: u.displayName || u.firstName + ' ' + u.lastName || u.username,
              email: u.email || ''
            }));
          }
          this.searchingAccounts = false;
        },
        error: () => {
          this.suggestions = [];
          this.searchingAccounts = false;
        }
      });
  }

  onSearchChange(query: string): void {
    this.selectedAccount = null;
    this.searchSubject$.next(query);
  }

  selectAccount(user: UserSuggestion): void {
    this.selectedAccount = user;
    this.searchQuery = '';
    this.suggestions = [];
    this.showSuggestions = false;
  }

  clearSelection(): void {
    this.selectedAccount = null;
    this.searchQuery = '';
    this.simulationResult = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Simulation                                                         */
  /* ------------------------------------------------------------------ */

  runSimulation(): void {
    if (!this.selectedAccount) return;

    this.simulating = true;
    this.errorMessage = '';

    const payload: Record<string, any> = {
      accountId: this.selectedAccount.id,
      context: {}
    };

    if (this.simulationContext.ipAddress) {
      payload['context']['ipAddress'] = this.simulationContext.ipAddress;
    }
    if (this.simulationContext.userAgent) {
      payload['context']['userAgent'] = this.simulationContext.userAgent;
    }
    if (this.simulationContext.timeOverride) {
      payload['context']['timeOverride'] = this.simulationContext.timeOverride;
    }

    this.http.post<ApiResponse<SimulationResult>>(`${this.apiBase}/simulate`, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.simulating = false)
      )
      .subscribe({
        next: (response) => {
          this.simulationResult = response.data || null;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to run policy simulation. Please try again.';
          this.simulationResult = null;
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                              */
  /* ------------------------------------------------------------------ */

  exportResults(): void {
    if (!this.simulationResult) return;

    const exportData = {
      account: this.selectedAccount,
      context: this.simulationContext,
      timestamp: new Date().toISOString(),
      results: this.simulationResult
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `policy-simulation-${this.selectedAccount?.id || 'unknown'}-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------ */
  /*  Utility                                                            */
  /* ------------------------------------------------------------------ */

  trackBySuggestionId(index: number, user: UserSuggestion): string {
    return user.id;
  }

  trackByRuleName(index: number, rule: AuthRuleResult): string {
    return rule.name;
  }
}
