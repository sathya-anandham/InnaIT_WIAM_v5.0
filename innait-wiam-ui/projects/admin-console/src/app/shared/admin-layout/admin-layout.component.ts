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
      <!-- Dark Sidebar -->
      <nav id="sidebar-nav" class="sidebar" role="navigation" aria-label="Admin navigation">
        <div class="sidebar-brand">
          <ng-container *ngIf="branding$ | async as branding">
            <img *ngIf="branding.logoUrl" [src]="branding.logoUrl" [alt]="branding.tenantName + ' logo'" class="brand-logo" />
            <span class="brand-name" *ngIf="!sidebarCollapsed">{{ branding.tenantName }}</span>
          </ng-container>
          <ng-container *ngIf="!(branding$ | async)">
            <div class="brand-icon">
              <i class="pi pi-shield"></i>
            </div>
            <span class="brand-name">InnaIT WIAM</span>
          </ng-container>
        </div>

        <div class="sidebar-scroll">
          <ul class="nav-list" role="list">
            <ng-container *ngFor="let item of navItems; let i = index">
              <li *ngIf="item.section && (i === 0 || navItems[i - 1]?.section !== item.section)"
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
        </div>
      </nav>

      <!-- Top Bar -->
      <header class="topbar" role="banner">
        <div class="topbar-left">
          <button
            class="sidebar-toggle"
            (click)="toggleSidebar()"
            [attr.aria-label]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            aria-controls="sidebar-nav">
            <i class="pi" [class.pi-bars]="sidebarCollapsed" [class.pi-times]="!sidebarCollapsed"></i>
          </button>
          <span class="topbar-page-title">Admin Console</span>
        </div>
        <div class="topbar-right">
          <div class="topbar-search">
            <i class="pi pi-search"></i>
            <input type="text" placeholder="Search..." class="search-input" />
          </div>
          <button class="topbar-icon-btn" aria-label="Notifications">
            <i class="pi pi-bell"></i>
            <span class="notification-dot"></span>
          </button>
          <div class="user-menu">
            <div class="user-avatar">
              <span>{{ userInitial }}</span>
            </div>
            <div class="user-info" *ngIf="displayName">
              <span class="user-name">{{ displayName }}</span>
              <span class="user-role">Administrator</span>
            </div>
          </div>
          <button class="topbar-icon-btn" (click)="logout()" aria-label="Logout">
            <i class="pi pi-sign-out"></i>
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="content" role="main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .admin-layout {
      display: grid;
      grid-template-columns: var(--innait-sidebar-width) 1fr;
      grid-template-rows: var(--innait-topbar-height) 1fr;
      grid-template-areas:
        "sidebar topbar"
        "sidebar content";
      height: 100vh;
      overflow: hidden;
    }
    .admin-layout.sidebar-collapsed {
      grid-template-columns: 0 1fr;
    }

    /* ── Sidebar (Saviynt dark charcoal) ── */
    .sidebar {
      grid-area: sidebar;
      background: var(--innait-sidebar-bg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 101;
    }
    .sidebar-collapsed .sidebar {
      transform: translateX(-100%);
      position: absolute;
      height: 100%;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0 1.5rem;
      height: var(--innait-topbar-height);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      flex-shrink: 0;
    }
    .brand-logo { height: 32px; width: auto; filter: brightness(0) invert(1); }
    .brand-icon {
      width: 36px; height: 36px;
      background: var(--innait-primary);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 1rem;
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 1.0625rem;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }

    .sidebar-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem 0;
    }
    .sidebar-scroll::-webkit-scrollbar { width: 4px; }
    .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
    .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }

    .nav-list { list-style: none; margin: 0; padding: 0; }
    .nav-section {
      padding: 1.25rem 1.5rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--innait-sidebar-section);
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1.5rem;
      color: var(--innait-sidebar-text);
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 400;
      border-left: 3px solid transparent;
      transition: all 0.15s ease;
      margin: 1px 0;
    }
    .nav-link:hover {
      background: var(--innait-sidebar-hover);
      color: #ffffff;
    }
    .nav-link.active {
      background: var(--innait-sidebar-active-bg);
      border-left-color: var(--innait-primary);
      color: var(--innait-sidebar-active-text);
      font-weight: 500;
    }
    .nav-link .pi {
      font-size: 1rem;
      width: 1.25rem;
      text-align: center;
      opacity: 0.75;
    }
    .nav-link:hover .pi,
    .nav-link.active .pi { opacity: 1; }

    /* ── Top Bar ── */
    .topbar {
      grid-area: topbar;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      background: var(--innait-topbar-bg);
      border-bottom: 1px solid var(--innait-topbar-border);
      z-index: 100;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .sidebar-toggle {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 8px;
      color: var(--innait-text-secondary);
      font-size: 1.125rem;
      transition: all 0.15s;
    }
    .sidebar-toggle:hover {
      background: var(--innait-bg);
      color: var(--innait-text);
    }
    .topbar-page-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--innait-text);
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .topbar-search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--innait-bg);
      border: 1px solid var(--innait-border);
      border-radius: 8px;
      padding: 0.4375rem 0.75rem;
      margin-right: 0.5rem;
    }
    .topbar-search i {
      color: var(--innait-text-secondary);
      font-size: 0.8125rem;
    }
    .search-input {
      border: none;
      background: transparent;
      outline: none;
      font-family: inherit;
      font-size: 0.8125rem;
      color: var(--innait-text);
      width: 180px;
    }
    .search-input::placeholder { color: var(--innait-text-secondary); }

    .topbar-icon-btn {
      position: relative;
      background: none;
      border: 1px solid transparent;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 8px;
      color: var(--innait-text-secondary);
      font-size: 1.125rem;
      transition: all 0.15s;
    }
    .topbar-icon-btn:hover {
      background: var(--innait-bg);
      color: var(--innait-text);
    }
    .notification-dot {
      position: absolute;
      top: 6px; right: 6px;
      width: 8px; height: 8px;
      background: var(--innait-danger);
      border-radius: 50%;
      border: 2px solid var(--innait-topbar-bg);
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.25rem 0.625rem;
      border-radius: 8px;
      cursor: default;
    }
    .user-avatar {
      width: 34px; height: 34px;
      background: var(--innait-primary);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      flex-shrink: 0;
    }
    .user-info {
      display: flex;
      flex-direction: column;
    }
    .user-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--innait-text);
      line-height: 1.2;
    }
    .user-role {
      font-size: 0.6875rem;
      color: var(--innait-text-secondary);
      line-height: 1.2;
    }

    /* ── Content Area ── */
    .content {
      grid-area: content;
      overflow-y: auto;
      padding: 1.75rem 2rem;
      background: var(--innait-bg);
    }

    /* ── Responsive ── */
    @media (max-width: 1024px) {
      .topbar-search { display: none; }
      .user-info { display: none; }
    }
    @media (max-width: 768px) {
      .admin-layout {
        grid-template-columns: 0 1fr;
        grid-template-areas:
          "topbar topbar"
          "content content";
      }
      .sidebar {
        position: fixed;
        top: 0; left: 0; bottom: 0;
        width: var(--innait-sidebar-width);
        z-index: 200;
        transform: translateX(-100%);
      }
      .admin-layout:not(.sidebar-collapsed) .sidebar {
        transform: translateX(0);
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
      }
      .content { padding: 1rem; }
    }
  `],
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  displayName = '';
  userInitial = '';
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
      this.userInitial = this.displayName ? this.displayName.charAt(0).toUpperCase() : 'A';
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
