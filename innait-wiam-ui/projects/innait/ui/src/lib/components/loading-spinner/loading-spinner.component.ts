import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'innait-loading-spinner',
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule],
  template: `
    <div class="loading-overlay" *ngIf="visible">
      <p-progressSpinner [style]="{ width: size, height: size }" strokeWidth="4" />
      <span class="loading-text" *ngIf="message">{{ message }}</span>
    </div>
  `,
  styles: [`
    .loading-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .loading-text {
      margin-top: 1rem;
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }
  `],
})
export class LoadingSpinnerComponent {
  @Input() visible = true;
  @Input() message = '';
  @Input() size = '50px';
}
