import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'innait-form-field',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="form-field" [class.has-error]="!!error">
      <label *ngIf="label" [attr.for]="fieldId" class="form-label">
        {{ label }}<span *ngIf="required" class="required-mark">*</span>
      </label>
      <ng-content />
      <small *ngIf="hint && !error" class="form-hint">{{ hint }}</small>
      <small *ngIf="error" class="form-error">{{ error }}</small>
    </div>
  `,
  styles: [`
    .form-field { margin-bottom: 1rem; }
    .form-label { display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem; }
    .required-mark { color: var(--red-500, #ef4444); margin-left: 2px; }
    .form-hint { display: block; margin-top: 0.25rem; color: var(--text-color-secondary); font-size: 0.75rem; }
    .form-error { display: block; margin-top: 0.25rem; color: var(--red-500, #ef4444); font-size: 0.75rem; }
    .has-error ::ng-deep input,
    .has-error ::ng-deep .p-inputtext { border-color: var(--red-500, #ef4444); }
  `],
})
export class FormFieldComponent {
  @Input() label = '';
  @Input() fieldId = '';
  @Input() required = false;
  @Input() hint = '';
  @Input() error = '';
}
