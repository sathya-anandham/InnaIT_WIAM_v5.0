import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'innait-confirm-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  template: `
    <p-dialog [header]="header" [(visible)]="visible" [modal]="true" [style]="{ width: '400px' }">
      <p>{{ message }}</p>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="onCancel()" />
        <p-button [label]="confirmLabel" [severity]="confirmSeverity" (onClick)="onConfirm()" />
      </ng-template>
    </p-dialog>
  `,
})
export class ConfirmDialogComponent {
  @Input() header = 'Confirm';
  @Input() message = 'Are you sure?';
  @Input() confirmLabel = 'Yes';
  @Input() confirmSeverity: 'danger' | 'warning' | 'success' | 'info' = 'danger';
  @Input() visible = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() visibleChange = new EventEmitter<boolean>();

  onConfirm(): void {
    this.confirmed.emit();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onCancel(): void {
    this.cancelled.emit();
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
