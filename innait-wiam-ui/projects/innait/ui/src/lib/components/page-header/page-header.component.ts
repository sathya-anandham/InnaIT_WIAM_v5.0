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
      margin-bottom: 1.75rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--innait-border, #DFE0EB);
    }
    .page-title {
      margin: 0;
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--innait-text, #252733);
      letter-spacing: -0.02em;
    }
    .page-subtitle {
      margin: 0.375rem 0 0;
      color: var(--innait-text-secondary, #9FA2B4);
      font-size: 0.8125rem;
      line-height: 1.4;
    }
    .page-header-actions { display: flex; gap: 0.5rem; align-items: center; }
  `],
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
