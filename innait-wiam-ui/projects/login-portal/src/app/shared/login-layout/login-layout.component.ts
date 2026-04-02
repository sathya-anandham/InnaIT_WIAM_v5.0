import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-login-layout',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <div class="login-layout">
      <p-card [style]="{ width: '100%', maxWidth: '440px' }">
        <ng-template pTemplate="header" *ngIf="title">
          <div class="card-header">
            <h1 class="card-title">{{ title }}</h1>
            <p class="card-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
          </div>
        </ng-template>
        <ng-content />
      </p-card>
    </div>
  `,
  styles: [`
    .login-layout {
      display: flex;
      justify-content: center;
      width: 100%;
      max-width: 480px;
    }
    .card-header {
      padding: 1.5rem 1.5rem 0;
    }
    .card-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--innait-text);
    }
    .card-subtitle {
      margin: 0.5rem 0 0;
      color: var(--innait-text-secondary);
      font-size: 0.875rem;
    }
    @media (max-width: 480px) {
      .login-layout { padding: 0 0.5rem; }
    }
  `],
})
export class LoginLayoutComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
