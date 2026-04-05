import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-auth-success-redirect',
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout>
      <div class="success-container" role="status" aria-live="polite">
        <div class="success-icon">
          <i class="pi pi-check" style="font-size: 2.5rem; color: white"></i>
        </div>
        <h2 class="mt-3">{{ 'auth.loginSuccess' | translate }}</h2>
        <p class="text-secondary">Redirecting you now...</p>
        <p-progressSpinner [style]="{ width: '30px', height: '30px' }" strokeWidth="4" class="mt-2" />
      </div>
    </app-login-layout>
  `,
  styles: [`
    .success-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 0;
      text-align: center;
    }
    .success-icon {
      width: 72px; height: 72px; border-radius: 50%;
      background: var(--green-500, #22c55e);
      display: flex; align-items: center; justify-content: center;
      animation: scaleIn 0.3s ease-out;
    }
    @keyframes scaleIn {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
    .text-secondary { color: var(--innait-text-secondary); font-size: 0.875rem; }
  `],
})
export class AuthSuccessRedirectComponent implements OnInit, OnDestroy {
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated) {
      this.router.navigate(['/login']);
      return;
    }

    const state = this.authService.currentState;
    const isSuperAdmin = state.roles?.includes('SUPER_ADMIN') || state.roles?.length === 0;
    const defaultUrl = isSuperAdmin ? 'http://localhost:4400' : 'http://localhost:4300';
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? defaultUrl;

    // Redirect after a brief success display (1.5 seconds)
    this.redirectTimer = setTimeout(() => {
      // For cross-app redirect, use window.location for full page navigation
      if (returnUrl.startsWith('http')) {
        window.location.href = returnUrl;
      } else {
        window.location.href = returnUrl;
      }
    }, 1500);
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
  }
}
