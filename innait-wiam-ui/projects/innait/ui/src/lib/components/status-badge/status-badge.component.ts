import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'innait-status-badge',
  standalone: true,
  imports: [CommonModule, TagModule],
  template: `<p-tag [value]="label" [severity]="computedSeverity" [rounded]="rounded" />`,
})
export class StatusBadgeComponent {
  @Input() status = '';
  @Input() label = '';
  @Input() rounded = true;

  private readonly statusSeverityMap: Record<string, string> = {
    ACTIVE: 'success',
    ENABLED: 'success',
    ACTIVATED: 'success',
    COMPLETED: 'success',
    INACTIVE: 'warning',
    DISABLED: 'warning',
    PENDING: 'info',
    PENDING_ACTIVATION: 'info',
    LOCKED: 'danger',
    SUSPENDED: 'danger',
    REVOKED: 'danger',
    EXPIRED: 'danger',
    FAILED: 'danger',
  };

  get computedSeverity(): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const severity = this.statusSeverityMap[this.status.toUpperCase()];
    return (severity as 'success' | 'info' | 'warning' | 'danger') ?? 'secondary';
  }
}
