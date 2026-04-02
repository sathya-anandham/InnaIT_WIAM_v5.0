import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'innait-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <div class="page-header-content">
        <h2 class="page-title">{{ title }}</h2>
        <p class="page-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
      <div class="page-header-actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--surface-border, #dee2e6);
    }
    .page-title { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .page-subtitle { margin: 0.25rem 0 0; color: var(--text-color-secondary); font-size: 0.875rem; }
    .page-header-actions { display: flex; gap: 0.5rem; align-items: center; }
  `],
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
