import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { TranslatePipe } from '@innait/i18n';
import { AuthService, ApiResponse } from '@innait/core';

import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface PolicyBinding {
  id: string;
  policyType: 'AUTH_TYPE' | 'PASSWORD' | 'MFA' | 'AUTH_RULE';
  policyName: string;
  targetType: 'TENANT' | 'ACCOUNT' | 'GROUP' | 'ROLE' | 'APPLICATION';
  targetName: string;
  priority: number;
  enabled: boolean;
}

interface PolicyOption {
  label: string;
  value: string;
}

interface TargetOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-policy-bindings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    CardModule,
    DropdownModule,
    InputNumberModule,
    InputSwitchModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    DialogModule
  ],
  template: `
    <!-- Loading State -->
    <div *ngIf="loading" class="loading-container" role="status" aria-label="Loading policy bindings">
      <p-progressSpinner strokeWidth="4" animationDuration="1s"></p-progressSpinner>
      <p>{{ 'policies.bindings.loading' | translate }}</p>
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
    <div *ngIf="!loading" class="bindings-container">

      <!-- Header Toolbar -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">{{ 'policies.bindings.title' | translate }}</h2>
          <span class="binding-count-badge" aria-live="polite">{{ filteredBindings.length }} bindings</span>
        </div>
        <div class="header-right">
          <!-- Filter by policy type -->
          <p-dropdown [(ngModel)]="filterPolicyType"
                      [options]="policyTypeFilterOptions"
                      placeholder="All Policy Types"
                      [showClear]="true"
                      (onChange)="applyFilter()"
                      styleClass="filter-dropdown"
                      aria-label="Filter by policy type">
          </p-dropdown>
          <p-button [label]="'policies.bindings.createBinding' | translate"
                    icon="pi pi-plus"
                    (onClick)="openCreateDialog()"
                    aria-label="Create a new policy binding">
          </p-button>
        </div>
      </div>

      <!-- Bindings List with Drag-to-Reorder -->
      <p-card styleClass="bindings-list-card">
        <div *ngIf="filteredBindings.length === 0" class="empty-state" role="status">
          <i class="pi pi-link" aria-hidden="true"></i>
          <h3>{{ 'policies.bindings.noBindings' | translate }}</h3>
          <p>{{ 'policies.bindings.noBindingsDescription' | translate }}</p>
        </div>

        <div *ngIf="filteredBindings.length > 0"
             class="bindings-list"
             role="list"
             aria-label="Policy bindings ordered by priority">

          <div *ngFor="let binding of filteredBindings; let i = index; trackBy: trackByBindingId"
               class="binding-item"
               [ngClass]="{ 'drag-over': dragOverIndex === i, 'dragging': dragIndex === i }"
               draggable="true"
               (dragstart)="onDragStart($event, i)"
               (dragover)="onDragOver($event, i)"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event, i)"
               (dragend)="onDragEnd()"
               role="listitem"
               [attr.aria-label]="'Binding: ' + binding.policyName + ' to ' + binding.targetName + ', priority ' + binding.priority">

            <!-- Drag Handle -->
            <span class="drag-handle" aria-hidden="true" title="Drag to reorder">&#8942;&#8942;</span>

            <!-- Priority Badge -->
            <span class="priority-badge">{{ binding.priority }}</span>

            <!-- Policy Name -->
            <span class="binding-policy-name">{{ binding.policyName }}</span>

            <!-- Policy Type Badge -->
            <span class="type-badge" [attr.data-type]="binding.policyType">
              {{ binding.policyType }}
            </span>

            <!-- Arrow -->
            <i class="pi pi-arrow-right binding-arrow" aria-hidden="true"></i>

            <!-- Target Type Badge -->
            <span class="target-badge" [attr.data-target]="binding.targetType">
              {{ binding.targetType }}
            </span>

            <!-- Target Name -->
            <span class="binding-target-name">{{ binding.targetName }}</span>

            <!-- Enabled Toggle -->
            <p-inputSwitch [(ngModel)]="binding.enabled"
                           [ngModelOptions]="{ standalone: true }"
                           (onChange)="onToggleEnabled(binding)"
                           [attr.aria-label]="'Toggle binding ' + binding.policyName + ' enabled state'">
            </p-inputSwitch>

            <!-- Delete Button -->
            <button type="button" class="icon-btn icon-btn-danger"
                    (click)="confirmDelete(binding)"
                    [attr.aria-label]="'Delete binding ' + binding.policyName">
              <i class="pi pi-trash" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </p-card>
    </div>

    <!-- Create Binding Dialog -->
    <p-dialog [(visible)]="createDialogVisible"
              [header]="'policies.bindings.createBinding' | translate"
              [modal]="true"
              [style]="{ width: '560px' }"
              [contentStyle]="{ 'overflow': 'visible' }"
              aria-label="Create policy binding dialog">
      <form *ngIf="bindingForm" [formGroup]="bindingForm" (ngSubmit)="onSaveBinding()"
            aria-label="Create policy binding form">
        <div class="dialog-form">
          <!-- Policy Type -->
          <div class="field">
            <label for="policyType" class="field-label">
              {{ 'policies.bindings.policyType' | translate }} *
            </label>
            <p-dropdown inputId="policyType" formControlName="policyType"
                        [options]="policyTypeOptions"
                        placeholder="Select policy type..."
                        styleClass="w-full"
                        (onChange)="onPolicyTypeChange()"
                        aria-required="true"
                        aria-label="Select policy type">
            </p-dropdown>
          </div>

          <!-- Policy Selector -->
          <div class="field">
            <label for="policyId" class="field-label">
              {{ 'policies.bindings.policy' | translate }} *
            </label>
            <p-dropdown inputId="policyId" formControlName="policyId"
                        [options]="availablePolicies"
                        [disabled]="!bindingForm.get('policyType')?.value || loadingPolicies"
                        [loading]="loadingPolicies"
                        placeholder="Select policy..."
                        [filter]="true"
                        filterBy="label"
                        styleClass="w-full"
                        aria-required="true"
                        aria-label="Select policy">
            </p-dropdown>
          </div>

          <!-- Target Type -->
          <div class="field">
            <label for="targetType" class="field-label">
              {{ 'policies.bindings.targetType' | translate }} *
            </label>
            <p-dropdown inputId="targetType" formControlName="targetType"
                        [options]="targetTypeOptions"
                        placeholder="Select target type..."
                        styleClass="w-full"
                        (onChange)="onTargetTypeChange()"
                        aria-required="true"
                        aria-label="Select target type">
            </p-dropdown>
          </div>

          <!-- Target Selector -->
          <div class="field">
            <label for="targetId" class="field-label">
              {{ 'policies.bindings.target' | translate }} *
            </label>
            <p-dropdown inputId="targetId" formControlName="targetId"
                        [options]="availableTargets"
                        [disabled]="!bindingForm.get('targetType')?.value || loadingTargets"
                        [loading]="loadingTargets"
                        placeholder="Select target..."
                        [filter]="true"
                        filterBy="label"
                        styleClass="w-full"
                        aria-required="true"
                        aria-label="Select target">
            </p-dropdown>
          </div>

          <!-- Priority -->
          <div class="field">
            <label for="priority" class="field-label">
              {{ 'policies.bindings.priority' | translate }}
            </label>
            <p-inputNumber inputId="priority" formControlName="priority"
                           [min]="1"
                           [showButtons]="true"
                           aria-label="Binding priority">
            </p-inputNumber>
            <small class="hint">{{ 'policies.bindings.priorityHint' | translate }}</small>
          </div>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <div class="dialog-footer">
          <p-button [label]="'common.cancel' | translate"
                    styleClass="p-button-outlined p-button-secondary"
                    (onClick)="createDialogVisible = false"
                    aria-label="Cancel">
          </p-button>
          <p-button [label]="'policies.bindings.create' | translate"
                    icon="pi pi-save"
                    [disabled]="bindingForm!.invalid || savingBinding"
                    [loading]="savingBinding"
                    (onClick)="onSaveBinding()"
                    aria-label="Create binding">
          </p-button>
        </div>
      </ng-template>
    </p-dialog>

    <!-- Delete Confirmation Dialog -->
    <div *ngIf="deleteConfirmVisible" class="dialog-overlay"
         role="dialog" aria-modal="true" aria-label="Confirm delete binding">
      <div class="confirm-dialog-content" (click)="$event.stopPropagation()">
        <h3 class="dialog-title">{{ 'policies.bindings.deleteConfirmTitle' | translate }}</h3>
        <p class="dialog-message">
          Are you sure you want to delete the binding <strong>{{ deletingBinding?.policyName }}</strong>
          to <strong>{{ deletingBinding?.targetName }}</strong>? This action cannot be undone.
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
                    [loading]="deletingInProgress"
                    (onClick)="executeDelete()"
                    aria-label="Confirm delete binding">
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

    .bindings-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
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

    .binding-count-badge {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      background: var(--surface-ground);
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    :host ::ng-deep .filter-dropdown {
      min-width: 180px;
    }

    /* Bindings List */
    :host ::ng-deep .bindings-list-card {
      width: 100%;
    }

    .bindings-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .binding-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border: 1px solid var(--surface-border);
      border-bottom: none;
      background: var(--surface-card);
      cursor: grab;
      transition: background 0.1s, opacity 0.2s, box-shadow 0.2s;
      user-select: none;
    }

    .binding-item:first-child {
      border-radius: 6px 6px 0 0;
    }

    .binding-item:last-child {
      border-bottom: 1px solid var(--surface-border);
      border-radius: 0 0 6px 6px;
    }

    .binding-item:only-child {
      border-radius: 6px;
      border-bottom: 1px solid var(--surface-border);
    }

    .binding-item:hover {
      background: var(--surface-ground);
    }

    .binding-item.dragging {
      opacity: 0.4;
    }

    .binding-item.drag-over {
      border-top: 3px solid var(--primary-color);
      box-shadow: 0 -2px 8px rgba(25, 118, 210, 0.2);
    }

    /* Drag Handle */
    .drag-handle {
      cursor: grab;
      color: var(--text-color-secondary);
      font-size: 1rem;
      letter-spacing: -0.15em;
      min-width: 16px;
      text-align: center;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    /* Priority Badge */
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
      flex-shrink: 0;
    }

    /* Policy Name */
    .binding-policy-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-color);
      min-width: 120px;
    }

    /* Type Badges */
    .type-badge, .target-badge {
      display: inline-block;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .type-badge[data-type='AUTH_TYPE'] { background: #e3f2fd; color: #1565c0; }
    .type-badge[data-type='PASSWORD'] { background: #e8f5e9; color: #2e7d32; }
    .type-badge[data-type='MFA'] { background: #f3e5f5; color: #7b1fa2; }
    .type-badge[data-type='AUTH_RULE'] { background: #fff3e0; color: #e65100; }

    .target-badge[data-target='TENANT'] { background: #e0f7fa; color: #00695c; }
    .target-badge[data-target='ACCOUNT'] { background: #fce4ec; color: #c62828; }
    .target-badge[data-target='GROUP'] { background: #e8eaf6; color: #283593; }
    .target-badge[data-target='ROLE'] { background: #f3e5f5; color: #7b1fa2; }
    .target-badge[data-target='APPLICATION'] { background: #fff8e1; color: #f57f17; }

    .binding-arrow {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .binding-target-name {
      font-size: 0.875rem;
      color: var(--text-color);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      flex-shrink: 0;
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

    .hint {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
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
      .binding-item {
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .binding-target-name {
        flex-basis: 100%;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `]
})
export class PolicyBindingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly apiBase = '/api/v1/admin/policies/bindings';

  loading = true;
  saving = false;
  savingBinding = false;
  deletingInProgress = false;
  errorMessage = '';
  successMessage = '';

  bindings: PolicyBinding[] = [];
  filteredBindings: PolicyBinding[] = [];
  filterPolicyType: string | null = null;

  // Drag and drop
  dragIndex: number | null = null;
  dragOverIndex: number | null = null;

  // Create Dialog
  createDialogVisible = false;
  bindingForm!: FormGroup;
  availablePolicies: PolicyOption[] = [];
  availableTargets: TargetOption[] = [];
  loadingPolicies = false;
  loadingTargets = false;

  // Delete
  deleteConfirmVisible = false;
  deletingBinding: PolicyBinding | null = null;

  readonly policyTypeOptions = [
    { label: 'Auth Type', value: 'AUTH_TYPE' },
    { label: 'Password', value: 'PASSWORD' },
    { label: 'MFA', value: 'MFA' },
    { label: 'Auth Rule', value: 'AUTH_RULE' }
  ];

  readonly policyTypeFilterOptions = [
    { label: 'Auth Type', value: 'AUTH_TYPE' },
    { label: 'Password', value: 'PASSWORD' },
    { label: 'MFA', value: 'MFA' },
    { label: 'Auth Rule', value: 'AUTH_RULE' }
  ];

  readonly targetTypeOptions = [
    { label: 'Tenant', value: 'TENANT' },
    { label: 'Account', value: 'ACCOUNT' },
    { label: 'Group', value: 'GROUP' },
    { label: 'Role', value: 'ROLE' },
    { label: 'Application', value: 'APPLICATION' }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadBindings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ------------------------------------------------------------------ */
  /*  Data loading                                                       */
  /* ------------------------------------------------------------------ */

  private loadBindings(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<ApiResponse<PolicyBinding[]>>(this.apiBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.bindings = (response.data || []).sort((a, b) => a.priority - b.priority);
          this.applyFilter();
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load policy bindings. Please try again.';
          this.loading = false;
        }
      });
  }

  applyFilter(): void {
    if (this.filterPolicyType) {
      this.filteredBindings = this.bindings.filter(b => b.policyType === this.filterPolicyType);
    } else {
      this.filteredBindings = [...this.bindings];
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Drag and Drop Reorder                                              */
  /* ------------------------------------------------------------------ */

  onDragStart(event: DragEvent, index: number): void {
    this.dragIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverIndex = index;
  }

  onDragLeave(): void {
    this.dragOverIndex = null;
  }

  onDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();
    this.dragOverIndex = null;

    if (this.dragIndex === null || this.dragIndex === dropIndex) {
      return;
    }

    // Reorder the list
    const movedItem = this.filteredBindings.splice(this.dragIndex, 1)[0];
    this.filteredBindings.splice(dropIndex, 0, movedItem!);


    // Update priorities based on new order
    this.filteredBindings.forEach((binding, i) => {
      binding.priority = i + 1;
    });

    // Update the main bindings array as well
    if (this.filterPolicyType) {
      // Merge back filtered changes into the main array
      const otherBindings = this.bindings.filter(b => b.policyType !== this.filterPolicyType);
      this.bindings = [...otherBindings, ...this.filteredBindings].sort((a, b) => a.priority - b.priority);
    } else {
      this.bindings = [...this.filteredBindings];
    }

    this.dragIndex = null;
    this.saveReorder();
  }

  onDragEnd(): void {
    this.dragIndex = null;
    this.dragOverIndex = null;
  }

  private saveReorder(): void {
    const orderedIds = this.filteredBindings.map(b => b.id);

    this.http.put<ApiResponse<void>>(`${this.apiBase}/reorder`, { bindingIds: orderedIds })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Binding order updated successfully.';
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to update binding order. Please try again.';
          this.loadBindings(); // Reload on error
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Enable / Disable Toggle                                            */
  /* ------------------------------------------------------------------ */

  onToggleEnabled(binding: PolicyBinding): void {
    this.http.put<ApiResponse<PolicyBinding>>(`${this.apiBase}/${binding.id}`, { enabled: binding.enabled })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = `Binding "${binding.policyName}" ${binding.enabled ? 'enabled' : 'disabled'} successfully.`;
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          binding.enabled = !binding.enabled; // Revert on error
          this.errorMessage = err?.error?.message || 'Failed to update binding status. Please try again.';
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Create Binding Dialog                                              */
  /* ------------------------------------------------------------------ */

  openCreateDialog(): void {
    const maxPriority = this.bindings.length > 0 ? Math.max(...this.bindings.map(b => b.priority)) : 0;

    this.bindingForm = this.fb.group({
      policyType: [null, Validators.required],
      policyId: [null, Validators.required],
      targetType: [null, Validators.required],
      targetId: [null, Validators.required],
      priority: [maxPriority + 1, [Validators.required, Validators.min(1)]]
    });

    this.availablePolicies = [];
    this.availableTargets = [];
    this.createDialogVisible = true;
  }

  onPolicyTypeChange(): void {
    const policyType = this.bindingForm.get('policyType')?.value;
    this.bindingForm.get('policyId')?.setValue(null);
    this.availablePolicies = [];

    if (!policyType) return;

    this.loadingPolicies = true;
    const typePathMap: Record<string, string> = {
      AUTH_TYPE: 'auth-type',
      PASSWORD: 'password',
      MFA: 'mfa',
      AUTH_RULE: 'auth-rules'
    };

    this.http.get<ApiResponse<any[]>>(`/api/v1/admin/policies/${typePathMap[policyType]}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingPolicies = false)
      )
      .subscribe({
        next: (response) => {
          const data = response.data || [];
          if (Array.isArray(data)) {
            this.availablePolicies = data.map((p: any) => ({
              label: p.name || p.policyName || p.id,
              value: p.id
            }));
          } else {
            // Single policy object (e.g., password policy)
            this.availablePolicies = [{ label: 'Default Policy', value: 'default' }];
          }
        },
        error: () => {
          this.availablePolicies = [];
        }
      });
  }

  onTargetTypeChange(): void {
    const targetType = this.bindingForm.get('targetType')?.value;
    this.bindingForm.get('targetId')?.setValue(null);
    this.availableTargets = [];

    if (!targetType) return;

    if (targetType === 'TENANT') {
      this.availableTargets = [{ label: 'Current Tenant', value: 'current' }];
      return;
    }

    this.loadingTargets = true;
    const targetEndpointMap: Record<string, string> = {
      ACCOUNT: '/api/v1/admin/users',
      GROUP: '/api/v1/admin/groups',
      ROLE: '/api/v1/admin/roles',
      APPLICATION: '/api/v1/admin/applications'
    };

    this.http.get<ApiResponse<any[]>>(targetEndpointMap[targetType]!)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingTargets = false)
      )
      .subscribe({
        next: (response) => {
          const data = (response as any).data || [];
          this.availableTargets = data.map((t: any) => ({
            label: t.displayName || t.name || t.roleName || t.groupName || t.appName || t.id,
            value: t.id
          }));
        },
        error: () => {
          this.availableTargets = [];
        }
      });
  }

  onSaveBinding(): void {
    if (this.bindingForm.invalid) {
      this.bindingForm.markAllAsTouched();
      return;
    }

    this.savingBinding = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post<ApiResponse<PolicyBinding>>(this.apiBase, this.bindingForm.value)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.savingBinding = false)
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Policy binding created successfully.';
          this.createDialogVisible = false;
          this.loadBindings();
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to create policy binding. Please try again.';
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Delete Binding                                                     */
  /* ------------------------------------------------------------------ */

  confirmDelete(binding: PolicyBinding): void {
    this.deletingBinding = binding;
    this.deleteConfirmVisible = true;
  }

  executeDelete(): void {
    if (!this.deletingBinding) return;

    this.deletingInProgress = true;

    this.http.delete<ApiResponse<void>>(`${this.apiBase}/${this.deletingBinding.id}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.deletingInProgress = false)
      )
      .subscribe({
        next: () => {
          this.successMessage = `Binding "${this.deletingBinding!.policyName}" deleted successfully.`;
          this.deleteConfirmVisible = false;
          this.deletingBinding = null;
          this.loadBindings();
          setTimeout(() => this.successMessage = '', 5000);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to delete binding. Please try again.';
          this.deleteConfirmVisible = false;
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Utility                                                            */
  /* ------------------------------------------------------------------ */

  trackByBindingId(index: number, binding: PolicyBinding): string {
    return binding.id;
  }
}
