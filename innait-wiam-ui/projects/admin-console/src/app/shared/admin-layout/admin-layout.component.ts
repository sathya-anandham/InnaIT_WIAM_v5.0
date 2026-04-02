import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, TenantService, TenantBranding } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';
import { Observable, Subject, takeUntil } from 'rxjs';

interface NavItem {
  label: string;
  icon: string;
  routerLink: string;
  section?: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <div class="admin-layout" [class.sidebar-collapsed]="sidebarCollapsed">
      <header class="topbar" role="banner">
        <div class="topbar-left">
          <button
            class="sidebar-toggle"
            (click)="toggleSidebar()"
            [attr.aria-label]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            aria-controls="sidebar-nav">
            <i class="pi" [class.pi-bars]="sidebarCollapsed" [class.pi-times]="!sidebarCollapsed"></i>
          </button>
          <ng-container *ngIf="branding$ | async as branding">
            <img *ngIf="branding.logoUrl" [src]="branding.logoUrl" [alt]="branding.tenantName + ' logo'" class="topbar-logo" />
            <span class="topbar-title">{{ branding.tenantName }}</span>
          </ng-container>
          <span *ngIf="!(branding$ | async)" class="topbar-title">InnaIT WIAM</span>
          <span class="topbar-badge">Admin</span>
        </div>
        <div class="topbar-right">
          <span class="user-display-name" *ngIf="displayName">{{ displayName }}</span>
          <button class="logout-btn" (click)="logout()" aria-label="Logout">
            <i class="pi pi-sign-out"></i>
            <span class="logout-text">{{ 'common.logout' | translate }}</span>
          </button>
        </div>
      </header>

      <nav id="sidebar-nav" class="sidebar" role="navigation" aria-label="Admin navigation">
        <ul class="nav-list" role="list">
          <ng-container *ngFor="let item of navItems; let i = index">
            <li *ngIf="item.section && (i === 0 || navItems[i - 1].section !== item.section)"
                class="nav-section" role="presentation">
              {{ item.section }}
            </li>
            <li role="listitem">
              <a [routerLink]="item.routerLink"
                 routerLinkActive="active"
                 [routerLinkActiveOptions]="{ exact: item.routerLink === '/dashboard' }"
                 class="nav-link"
                 [attr.aria-label]="item.label">
                <i class="pi" [ngClass]="item.icon"></i>
                <span class="nav-label">{{ item.label }}</span>
              </a>
            </li>
          </ng-container>
        </ul>
      </nav>

      <main class="content" role="main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .admin-layout {
      display: grid;
      grid-template-columns: var(--innait-sidebar-width) 1fr;
      grid-template-rows: 56px 1fr;
      grid-template-areas:
        "topbar topbar"
        "sidebar content";
      height: 100vh;
      overflow: hidden;
    }
    .admin-layout.sidebar-collapsed {
      grid-template-columns: 0 1fr;
    }

    .topbar {
      grid-area: topbar;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      background: var(--innait-surface);
      border-bottom: 1px solid #e0e0e0;
      z-index: 100;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .sidebar-toggle {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 4px;
      color: var(--innait-text);
      font-size: 1.25rem;
    }
    .sidebar-toggle:hover { background: var(--innait-bg); }
    .topbar-logo { height: 32px; width: auto; }
    .topbar-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--innait-primary);
    }
    .topbar-badge {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      background: var(--innait-accent);
      color: #fff;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .user-display-name {
      font-size: 0.875rem;
      color: var(--innait-text-secondary);
    }
    .logout-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: none;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 0.375rem 0.75rem;
      cursor: pointer;
      color: var(--innait-text);
      font-size: 0.875rem;
    }
    .logout-btn:hover {
      background: var(--innait-bg);
      border-color: var(--innait-primary);
      color: var(--innait-primary);
    }

    .sidebar {
      grid-area: sidebar;
      background: var(--innait-surface);
      border-right: 1px solid #e0e0e0;
      overflow-y: auto;
      padding: 0.5rem 0;
      transition: transform 0.2s ease;
    }
    .sidebar-collapsed .sidebar {
      transform: translateX(-100%);
      position: absolute;
    }

    .nav-list { list-style: none; margin: 0; padding: 0; }
    .nav-section {
      padding: 1rem 1.25rem 0.375rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--innait-text-secondary);
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1.25rem;
      color: var(--innait-text);
      text-decoration: none;
      font-size: 0.875rem;
      border-left: 3px solid transparent;
      transition: background 0.15s, border-color 0.15s;
    }
    .nav-link:hover { background: var(--innait-bg); }
    .nav-link.active {
      background: rgba(25, 118, 210, 0.08);
      border-left-color: var(--innait-primary);
      color: var(--innait-primary);
      font-weight: 500;
    }
    .nav-link .pi { font-size: 1rem; width: 1.25rem; text-align: center; }

    .content {
      grid-area: content;
      overflow-y: auto;
      padding: 1.5rem;
      background: var(--innait-bg);
    }

    @media (max-width: 768px) {
      .admin-layout { grid-template-columns: 0 1fr; }
      .sidebar {
        position: fixed;
        top: 56px;
        left: 0;
        bottom: 0;
        width: var(--innait-sidebar-width);
        z-index: 99;
        transform: translateX(-100%);
      }
      .admin-layout:not(.sidebar-collapsed) .sidebar {
        transform: translateX(0);
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
      }
      .logout-text { display: none; }
    }
  `],
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  displayName = '';
  branding$!: Observable<TenantBranding | null>;

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'pi-chart-bar', routerLink: '/dashboard', section: 'Overview' },
    { label: 'Users', icon: 'pi-users', routerLink: '/users', section: 'Identity Management' },
    { label: 'Roles', icon: 'pi-id-card', routerLink: '/roles', section: 'Identity Management' },
    { label: 'Groups', icon: 'pi-sitemap', routerLink: '/groups', section: 'Identity Management' },
    { label: 'Entitlements', icon: 'pi-check-square', routerLink: '/entitlements', section: 'Identity Management' },
    { label: 'FIDO Devices', icon: 'pi-key', routerLink: '/devices/fido', section: 'Devices & Credentials' },
    { label: 'Soft Tokens', icon: 'pi-shield', routerLink: '/devices/softtoken', section: 'Devices & Credentials' },
    { label: 'Credential Overview', icon: 'pi-chart-pie', routerLink: '/credentials/overview', section: 'Devices & Credentials' },
    { label: 'Bulk Password Reset', icon: 'pi-refresh', routerLink: '/credentials/bulk-reset', section: 'Devices & Credentials' },
    { label: 'Auth Type Config', icon: 'pi-sliders-h', routerLink: '/policies/auth-type', section: 'Policies' },
    { label: 'Password Policy', icon: 'pi-lock', routerLink: '/policies/password', section: 'Policies' },
    { label: 'MFA Policy', icon: 'pi-mobile', routerLink: '/policies/mfa', section: 'Policies' },
    { label: 'Auth Rules', icon: 'pi-code', routerLink: '/policies/auth-rules', section: 'Policies' },
    { label: 'Policy Bindings', icon: 'pi-link', routerLink: '/policies/bindings', section: 'Policies' },
    { label: 'Policy Simulator', icon: 'pi-play', routerLink: '/policies/simulator', section: 'Policies' },
    { label: 'Audit Logs', icon: 'pi-list', routerLink: '/audit/logs', section: 'Audit & Analytics' },
    { label: 'Admin History', icon: 'pi-history', routerLink: '/audit/admin-history', section: 'Audit & Analytics' },
    { label: 'Security Incidents', icon: 'pi-exclamation-triangle', routerLink: '/audit/incidents', section: 'Audit & Analytics' },
    { label: 'Login Analytics', icon: 'pi-chart-line', routerLink: '/audit/login-analytics', section: 'Audit & Analytics' },
    { label: 'Compliance', icon: 'pi-verified', routerLink: '/audit/compliance', section: 'Audit & Analytics' },
    { label: 'Active Sessions', icon: 'pi-desktop', routerLink: '/sessions', section: 'Audit & Analytics' },
    { label: 'Tenant Settings', icon: 'pi-building', routerLink: '/settings/tenant', section: 'Settings' },
    { label: 'Branding', icon: 'pi-palette', routerLink: '/settings/branding', section: 'Settings' },
    { label: 'Domains', icon: 'pi-globe', routerLink: '/settings/domains', section: 'Settings' },
    { label: 'Feature Flags', icon: 'pi-flag', routerLink: '/settings/features', section: 'Settings' },
    { label: 'Notifications', icon: 'pi-envelope', routerLink: '/settings/notifications', section: 'Settings' },
    { label: 'Connectors', icon: 'pi-arrows-h', routerLink: '/settings/connectors', section: 'Settings' },
    { label: 'System Settings', icon: 'pi-wrench', routerLink: '/settings/system', section: 'Settings' },
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
  ) {}

  ngOnInit(): void {
    this.branding$ = this.tenantService.branding;
    this.authService.getAuthState().pipe(takeUntil(this.destroy$)).subscribe((state) => {
      this.displayName = state.displayName ?? '';
    });
    if (window.innerWidth <= 768) {
      this.sidebarCollapsed = true;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  logout(): void {
    this.authService.logout().subscribe();
  }
}
