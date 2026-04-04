import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-login-layout',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <div class="login-page">
      <!-- Left Branding Panel -->
      <div class="login-brand-panel">
        <div class="brand-content">
          <div class="brand-logo-area">
            <div class="brand-icon">
              <i class="pi pi-shield"></i>
            </div>
            <span class="brand-name">InnaIT WIAM</span>
          </div>
          <h2 class="brand-headline">Enterprise Identity &amp; Access Management</h2>
          <p class="brand-description">
            Secure, unified identity governance for your entire organization.
            Manage users, credentials, and access policies from one platform.
          </p>
          <div class="brand-features">
            <div class="feature-item">
              <i class="pi pi-check-circle"></i>
              <span>FIDO2 Passwordless Authentication</span>
            </div>
            <div class="feature-item">
              <i class="pi pi-check-circle"></i>
              <span>Multi-Factor Security</span>
            </div>
            <div class="feature-item">
              <i class="pi pi-check-circle"></i>
              <span>Zero Trust Access Control</span>
            </div>
          </div>
        </div>
        <div class="brand-footer">
          <span>&copy; {{ currentYear }} InnaIT Technologies</span>
        </div>
      </div>

      <!-- Right Form Panel -->
      <div class="login-form-panel">
        <div class="form-container">
          <div class="form-card">
            <div class="card-header" *ngIf="title">
              <h1 class="card-title">{{ title }}</h1>
              <p class="card-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
            </div>
            <div class="card-body">
              <ng-content />
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Left Branding Panel ── */
    .login-brand-panel {
      flex: 0 0 480px;
      background: var(--innait-login-panel-bg, #262731);
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 3rem;
      position: relative;
      overflow: hidden;
    }
    .login-brand-panel::before {
      content: '';
      position: absolute;
      top: -120px; right: -120px;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(55, 81, 255, 0.15) 0%, transparent 70%);
      border-radius: 50%;
    }
    .login-brand-panel::after {
      content: '';
      position: absolute;
      bottom: -80px; left: -80px;
      width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(0, 184, 132, 0.1) 0%, transparent 70%);
      border-radius: 50%;
    }

    .brand-content {
      position: relative;
      z-index: 1;
      margin-top: 2rem;
    }
    .brand-logo-area {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 3rem;
    }
    .brand-icon {
      width: 44px; height: 44px;
      background: var(--innait-primary);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem;
      color: #fff;
    }
    .brand-name {
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .brand-headline {
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.3;
      margin: 0 0 1rem;
      letter-spacing: -0.02em;
    }
    .brand-description {
      font-size: 0.9375rem;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.7);
      margin: 0 0 2.5rem;
      max-width: 380px;
    }
    .brand-features {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.85);
    }
    .feature-item i {
      color: var(--innait-accent, #00B884);
      font-size: 1rem;
    }

    .brand-footer {
      position: relative;
      z-index: 1;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.4);
    }

    /* ── Right Form Panel ── */
    .login-form-panel {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--innait-bg);
      padding: 2rem;
    }
    .form-container {
      width: 100%;
      max-width: 440px;
    }
    .form-card {
      background: var(--innait-surface);
      border-radius: var(--innait-card-radius, 12px);
      box-shadow: var(--innait-card-shadow, 0 2px 10px rgba(0, 0, 0, 0.06));
      border: 1px solid var(--innait-border, #DFE0EB);
      overflow: hidden;
    }
    .card-header {
      padding: 2rem 2rem 0;
    }
    .card-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--innait-text);
      letter-spacing: -0.02em;
    }
    .card-subtitle {
      margin: 0.5rem 0 0;
      color: var(--innait-text-secondary);
      font-size: 0.875rem;
      line-height: 1.4;
    }
    .card-body {
      padding: 1.5rem 2rem 2rem;
    }

    /* ── Responsive ── */
    @media (max-width: 960px) {
      .login-brand-panel { display: none; }
      .login-form-panel { padding: 1.5rem; }
    }
    @media (max-width: 480px) {
      .form-container { max-width: 100%; }
      .form-card {
        box-shadow: none;
        border: none;
        background: transparent;
      }
      .card-header { padding: 1rem 0 0; }
      .card-body { padding: 1rem 0; }
    }
  `],
})
export class LoginLayoutComponent {
  @Input() title = '';
  @Input() subtitle = '';

  get currentYear(): number {
    return new Date().getFullYear();
  }
}
