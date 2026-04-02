import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';

import { AuthService, Entitlement, Role, Group } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

interface CatalogItem {
  id: string;
  label: string;
  code: string;
  description?: string;
}

interface AccessRequestResponse {
  id: string;
  requestType: string;
  resourceId: string;
  status: string;
}

type RequestType = 'ROLE' | 'GROUP' | 'ENTITLEMENT';

@Component({
  selector: 'app-access-request',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    DropdownModule,
    CalendarModule,
    InputTextareaModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div class="access-request" role="region" aria-label="Request Access">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>{{ 'access.request.title' | translate }}</h2>
            <p class="card-subtitle">{{ 'access.request.subtitle' | translate }}</p>
          </div>
        </ng-template>

        <!-- Success State -->
        <div *ngIf="submitSuccess" class="success-section" role="status" aria-live="polite">
          <div class="success-content">
            <i class="pi pi-check-circle success-icon" aria-hidden="true"></i>
            <h3>{{ 'access.request.success.title' | translate }}</h3>
            <p>{{ 'access.request.success.message' | translate }}</p>
            <p class="request-id">
              {{ 'access.request.success.requestId' | translate }}: <strong>{{ submittedRequestId }}</strong>
            </p>
            <div class="success-actions">
              <a
                pButton
                [label]="'access.request.success.viewRequests' | translate"
                icon="pi pi-inbox"
                routerLink="/access-requests"
                aria-label="View my access requests">
              </a>
              <button
                pButton
                type="button"
                [label]="'access.request.success.newRequest' | translate"
                icon="pi pi-plus"
                class="p-button-outlined"
                (click)="resetForm()"
                aria-label="Submit another access request">
              </button>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form
          *ngIf="!submitSuccess"
          [formGroup]="requestForm"
          (ngSubmit)="submitRequest()"
          class="request-form"
          role="form"
          aria-label="Access request form">

          <!-- Request Type -->
          <div class="form-field">
            <label for="requestType">{{ 'access.request.form.requestType' | translate }} *</label>
            <p-dropdown
              id="requestType"
              formControlName="requestType"
              [options]="requestTypeOptions"
              optionLabel="label"
              optionValue="value"
              [placeholder]="'access.request.form.selectType' | translate"
              [style]="{ width: '100%' }"
              (onChange)="onRequestTypeChange($event)"
              aria-required="true"
              [attr.aria-invalid]="requestForm.get('requestType')?.invalid && requestForm.get('requestType')?.touched">
            </p-dropdown>
            <small
              *ngIf="requestForm.get('requestType')?.hasError('required') && requestForm.get('requestType')?.touched"
              class="p-error"
              role="alert">
              {{ 'access.request.form.requestTypeRequired' | translate }}
            </small>
          </div>

          <!-- Resource Selection -->
          <div class="form-field" *ngIf="requestForm.get('requestType')?.value">
            <label for="resourceId">{{ getResourceLabel() }} *</label>
            <p-dropdown
              id="resourceId"
              formControlName="resourceId"
              [options]="catalogItems"
              optionLabel="label"
              optionValue="id"
              [placeholder]="'access.request.form.selectResource' | translate"
              [filter]="true"
              [filterPlaceholder]="'common.search' | translate"
              [showClear]="true"
              [loading]="loadingCatalog"
              [style]="{ width: '100%' }"
              aria-required="true"
              [attr.aria-invalid]="requestForm.get('resourceId')?.invalid && requestForm.get('resourceId')?.touched">
              <ng-template let-item pTemplate="item">
                <div class="catalog-item-option">
                  <span class="catalog-item-label">{{ item.label }}</span>
                  <small class="catalog-item-code">{{ item.code }}</small>
                </div>
              </ng-template>
            </p-dropdown>
            <div *ngIf="loadingCatalog" class="catalog-loading" role="status">
              <small>{{ 'access.request.form.loadingCatalog' | translate }}</small>
            </div>
            <small
              *ngIf="requestForm.get('resourceId')?.hasError('required') && requestForm.get('resourceId')?.touched"
              class="p-error"
              role="alert">
              {{ 'access.request.form.resourceRequired' | translate }}
            </small>
          </div>

          <!-- Justification -->
          <div class="form-field">
            <label for="justification">{{ 'access.request.form.justification' | translate }} *</label>
            <textarea
              id="justification"
              pInputTextarea
              formControlName="justification"
              [rows]="4"
              [autoResize]="true"
              [placeholder]="'access.request.form.justificationPlaceholder' | translate"
              aria-required="true"
              [attr.aria-invalid]="requestForm.get('justification')?.invalid && requestForm.get('justification')?.touched"
              class="w-full">
            </textarea>
            <div class="field-hints">
              <small
                *ngIf="requestForm.get('justification')?.hasError('required') && requestForm.get('justification')?.touched"
                class="p-error"
                role="alert">
                {{ 'access.request.form.justificationRequired' | translate }}
              </small>
              <small
                *ngIf="requestForm.get('justification')?.hasError('minlength') && requestForm.get('justification')?.touched"
                class="p-error"
                role="alert">
                {{ 'access.request.form.justificationMinLength' | translate }}
              </small>
              <small class="char-count" [class.p-error]="(requestForm.get('justification')?.value?.length || 0) < 20">
                {{ requestForm.get('justification')?.value?.length || 0 }} / 20 {{ 'common.minChars' | translate }}
              </small>
            </div>
          </div>

          <!-- Date Range -->
          <div class="form-row">
            <div class="form-field">
              <label for="startDate">{{ 'access.request.form.startDate' | translate }}</label>
              <p-calendar
                id="startDate"
                formControlName="startDate"
                [minDate]="today"
                [showIcon]="true"
                dateFormat="yy-mm-dd"
                [placeholder]="'access.request.form.startDatePlaceholder' | translate"
                [style]="{ width: '100%' }"
                aria-label="Access start date">
              </p-calendar>
            </div>

            <div class="form-field">
              <label for="endDate">{{ 'access.request.form.endDate' | translate }}</label>
              <p-calendar
                id="endDate"
                formControlName="endDate"
                [minDate]="requestForm.get('startDate')?.value || today"
                [showIcon]="true"
                dateFormat="yy-mm-dd"
                [placeholder]="'access.request.form.endDatePlaceholder' | translate"
                [style]="{ width: '100%' }"
                aria-label="Access end date">
              </p-calendar>
              <small
                *ngIf="requestForm.hasError('endDateBeforeStartDate')"
                class="p-error"
                role="alert">
                {{ 'access.request.form.endDateAfterStart' | translate }}
              </small>
            </div>
          </div>

          <!-- Error Message -->
          <p-message
            *ngIf="errorMessage"
            severity="error"
            [text]="errorMessage"
            [closable]="true"
            (onClose)="errorMessage = ''"
            role="alert">
          </p-message>

          <!-- Submit -->
          <div class="form-actions">
            <button
              pButton
              type="submit"
              [label]="'access.request.form.submit' | translate"
              icon="pi pi-send"
              [loading]="submitting"
              [disabled]="requestForm.invalid || submitting"
              aria-label="Submit access request">
            </button>
            <button
              pButton
              type="button"
              [label]="'common.cancel' | translate"
              icon="pi pi-times"
              class="p-button-text"
              (click)="resetForm()"
              aria-label="Reset form">
            </button>
          </div>
        </form>
      </p-card>
    </div>
  `,
  styles: [`
    .access-request {
      max-width: 720px;
      margin: 0 auto;
    }

    .card-header {
      padding: 1.25rem 1.5rem 0;
    }

    .card-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--innait-text);
    }

    .card-subtitle {
      margin: 0.375rem 0 0;
      color: var(--innait-text-secondary);
      font-size: 0.875rem;
    }

    .request-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-field label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--innait-text);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 576px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }

    .field-hints {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .char-count {
      font-size: 0.75rem;
      color: var(--innait-text-secondary);
    }

    .catalog-item-option {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .catalog-item-label {
      font-size: 0.875rem;
    }

    .catalog-item-code {
      font-size: 0.75rem;
      color: var(--innait-text-secondary);
    }

    .catalog-loading {
      color: var(--innait-text-secondary);
    }

    .w-full {
      width: 100%;
    }

    .p-error {
      display: block;
    }

    .form-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding-top: 0.5rem;
    }

    .success-section {
      padding: 1rem 0;
    }

    .success-content {
      text-align: center;
    }

    .success-icon {
      font-size: 3.5rem;
      color: #4caf50;
      margin-bottom: 1rem;
    }

    .success-content h3 {
      font-size: 1.25rem;
      color: var(--innait-text);
      margin: 0 0 0.5rem;
    }

    .success-content p {
      color: var(--innait-text-secondary);
      margin: 0 0 0.75rem;
    }

    .request-id {
      font-size: 0.875rem;
      background: var(--innait-bg);
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      margin-bottom: 1.5rem !important;
    }

    .success-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    :host ::ng-deep .p-message {
      width: 100%;
    }
  `],
})
export class AccessRequestComponent implements OnInit, OnDestroy {
  requestForm!: FormGroup;
  today = new Date();

  requestTypeOptions = [
    { label: 'Role', value: 'ROLE' as RequestType },
    { label: 'Group', value: 'GROUP' as RequestType },
    { label: 'Entitlement', value: 'ENTITLEMENT' as RequestType },
  ];

  catalogItems: CatalogItem[] = [];
  loadingCatalog = false;
  submitting = false;
  submitSuccess = false;
  submittedRequestId = '';
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();
  private readonly API_BASE = '/api/v1/self';

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.requestForm = this.fb.group(
      {
        requestType: ['', [Validators.required]],
        resourceId: ['', [Validators.required]],
        justification: ['', [Validators.required, Validators.minLength(20)]],
        startDate: [null],
        endDate: [null],
      },
      {
        validators: [this.endDateAfterStartDateValidator],
      },
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onRequestTypeChange(event: { value: RequestType }): void {
    this.requestForm.get('resourceId')?.reset();
    this.catalogItems = [];

    if (event.value) {
      this.loadCatalog(event.value);
    }
  }

  getResourceLabel(): string {
    const type = this.requestForm.get('requestType')?.value as RequestType;
    switch (type) {
      case 'ROLE':
        return 'Select Role';
      case 'GROUP':
        return 'Select Group';
      case 'ENTITLEMENT':
        return 'Select Entitlement';
      default:
        return 'Select Resource';
    }
  }

  private loadCatalog(type: RequestType): void {
    this.loadingCatalog = true;

    let endpoint: string;
    switch (type) {
      case 'ROLE':
        endpoint = `${this.API_BASE}/catalog/roles`;
        break;
      case 'GROUP':
        endpoint = `${this.API_BASE}/catalog/groups`;
        break;
      case 'ENTITLEMENT':
        endpoint = `${this.API_BASE}/catalog/entitlements`;
        break;
    }

    this.http.get<(Role | Group | Entitlement)[]>(endpoint)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingCatalog = false),
      )
      .subscribe({
        next: (items) => {
          this.catalogItems = this.mapCatalogItems(type, items);
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to load catalog. Please try again.';
        },
      });
  }

  private mapCatalogItems(type: RequestType, items: (Role | Group | Entitlement)[]): CatalogItem[] {
    return items.map((item) => {
      switch (type) {
        case 'ROLE': {
          const role = item as Role;
          return { id: role.id, label: role.roleName, code: role.roleCode, description: role.description };
        }
        case 'GROUP': {
          const group = item as Group;
          return { id: group.id, label: group.groupName, code: group.groupCode, description: group.description };
        }
        case 'ENTITLEMENT': {
          const ent = item as Entitlement;
          return { id: ent.id, label: ent.entitlementName, code: ent.entitlementCode, description: `${ent.resource}:${ent.action}` };
        }
      }
    });
  }

  submitRequest(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    const formValue = this.requestForm.value;
    const payload = {
      requestType: formValue.requestType,
      resourceId: formValue.resourceId,
      justification: formValue.justification,
      startDate: formValue.startDate ? this.formatDate(formValue.startDate) : null,
      endDate: formValue.endDate ? this.formatDate(formValue.endDate) : null,
    };

    this.http.post<AccessRequestResponse>(`${this.API_BASE}/access-requests`, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.submitting = false),
      )
      .subscribe({
        next: (response) => {
          this.submitSuccess = true;
          this.submittedRequestId = response.id;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to submit access request. Please try again.';
        },
      });
  }

  resetForm(): void {
    this.requestForm.reset();
    this.catalogItems = [];
    this.submitSuccess = false;
    this.submittedRequestId = '';
    this.errorMessage = '';
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private endDateAfterStartDateValidator(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;

    if (startDate && endDate && endDate <= startDate) {
      return { endDateBeforeStartDate: true };
    }

    return null;
  }
}
