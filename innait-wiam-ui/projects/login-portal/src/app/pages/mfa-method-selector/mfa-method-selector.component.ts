import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

interface MfaOption {
  type: string;
  icon: string;
  label: string;
  description: string;
  route: string;
}

const MFA_OPTIONS: MfaOption[] = [
  { type: 'TOTP', icon: 'pi pi-mobile', label: 'Authenticator App', description: 'Enter a code from your authenticator app', route: '/login/totp' },
  { type: 'FIDO', icon: 'pi pi-key', label: 'Security Key', description: 'Use your hardware security key', route: '/login/fido' },
  { type: 'SOFT_TOKEN', icon: 'pi pi-bell', label: 'Push Notification', description: 'Approve the login on your mobile device', route: '/login/softtoken' },
  { type: 'BACKUP_CODE', icon: 'pi pi-shield', label: 'Backup Code', description: 'Use one of your recovery backup codes', route: '/login/backup-code' },
];

@Component({
  selector: 'app-mfa-method-selector',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout [title]="'auth.selectMfaMethod' | translate" subtitle="Choose how you want to verify your identity">
      <div class="method-list" role="radiogroup" aria-label="MFA method selection">
        <button
          *ngFor="let method of availableMethods"
          class="method-card"
          (click)="selectMethod(method)"
          (keydown.enter)="selectMethod(method)"
          role="radio"
          [attr.aria-checked]="false"
          [attr.aria-label]="method.label + ': ' + method.description"
          tabindex="0"
        >
          <div class="method-icon">
            <i [class]="method.icon" style="font-size: 1.5rem"></i>
          </div>
          <div class="method-info">
            <span class="method-label">{{ method.label }}</span>
            <span class="method-desc">{{ method.description }}</span>
          </div>
          <i class="pi pi-chevron-right method-arrow"></i>
        </button>
      </div>

      <div class="mt-3 text-center" *ngIf="availableMethods.length === 0">
        <p>No authentication methods available.</p>
        <p-button label="Go Back" severity="secondary" (onClick)="goBack()" />
      </div>
    </app-login-layout>
  `,
  styles: [`
    .method-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .method-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border: 2px solid var(--surface-border, #dee2e6);
      border-radius: 8px;
      background: var(--innait-surface, #fff);
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
      text-align: left;
      width: 100%;
    }
    .method-card:hover, .method-card:focus {
      border-color: var(--innait-primary);
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
      outline: none;
    }
    .method-icon {
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(25, 118, 210, 0.1);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      color: var(--innait-primary);
    }
    .method-info { display: flex; flex-direction: column; flex: 1; }
    .method-label { font-weight: 600; font-size: 0.95rem; }
    .method-desc { font-size: 0.8rem; color: var(--innait-text-secondary); margin-top: 0.25rem; }
    .method-arrow { color: var(--innait-text-secondary); }
  `],
})
export class MfaMethodSelectorComponent implements OnInit {
  availableMethods: MfaOption[] = [];

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    if (!this.authService.currentState.txnId) {
      this.router.navigate(['/login']);
      return;
    }

    const available = this.authService.currentState.availableMfaMethods ?? [];
    this.availableMethods = MFA_OPTIONS.filter((opt) => available.includes(opt.type));
  }

  selectMethod(method: MfaOption): void {
    this.router.navigate([method.route]);
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }
}
