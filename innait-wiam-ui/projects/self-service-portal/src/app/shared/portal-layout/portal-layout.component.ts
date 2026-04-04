import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, TenantService, TenantBranding } from '@innait/core';
import { TranslatePipe, I18nService } from '@innait/i18n';
import { Observable, Subject, takeUntil } from 'rxjs';

interface NavItem {
  label: string;
  icon: string;
  routerLink: string;
  section?: string;
}

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <div class="portal-layout" [class.sidebar-collapsed]="sidebarCollapsed">
      <!-- Dark Sidebar -->
      <nav id="sidebar-nav" class="sidebar" role="navigation" aria-label="Main navigation">
        <div class="sidebar-brand">
          <ng-container *ngIf="branding$ | async as branding">
            <img *ngIf="branding.logoUrl" [src]="branding.logoUrl" [alt]="branding.tenantName + ' logo'" class="brand-logo" />
            <span class="brand-name">{{ branding.tenantName }}</span>
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
          <span class="topbar-page-title">Self Service</span>
        </div>
        <div class="topbar-right">
          <div class="user-menu">
            <div class="user-avatar">
              <span>{{ userInitial }}</span>
            </div>
            <div class="user-info" *ngIf="displayName">
              <span class="user-name">{{ displayName }}</span>
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
    .portal-layout {
      display: grid;
      grid-template-columns: var(--innait-sidebar-width) 1fr;
      grid-template-rows: var(--innait-topbar-height) 1fr;
      grid-template-areas:
        "sidebar topbar"
        "sidebar content";
      height: 100vh;
      overflow: hidden;
    }
    .portal-layout.sidebar-collapsed {
      grid-template-columns: 0 1fr;
    }

    /* ── Sidebar (dark charcoal) ── */
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
    .topbar-icon-btn {
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

    .user-menu {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.25rem 0.625rem;
      border-radius: 8px;
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
    .user-info { display: flex; flex-direction: column; }
    .user-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--innait-text);
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
    @media (max-width: 768px) {
      .portal-layout {
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
      .portal-layout:not(.sidebar-collapsed) .sidebar {
        transform: translateX(0);
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
      }
      .user-info { display: none; }
      .content { padding: 1rem; }
    }
  `],
})
export class PortalLayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  displayName = '';
  userInitial = '';
  branding$!: Observable<TenantBranding | null>;

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'pi-home', routerLink: '/dashboard', section: 'Overview' },
    { label: 'My Profile', icon: 'pi-user', routerLink: '/profile', section: 'Account' },
    { label: 'Change Password', icon: 'pi-lock', routerLink: '/password', section: 'Account' },
    { label: 'Forgot Password', icon: 'pi-question-circle', routerLink: '/forgot-password', section: 'Account' },
    { label: 'TOTP Authenticator', icon: 'pi-mobile', routerLink: '/mfa/totp', section: 'Multi-Factor Auth' },
    { label: 'Manage TOTP', icon: 'pi-cog', routerLink: '/mfa/totp/manage', section: 'Multi-Factor Auth' },
    { label: 'FIDO2 Security Key', icon: 'pi-key', routerLink: '/mfa/fido', section: 'Multi-Factor Auth' },
    { label: 'Manage FIDO Keys', icon: 'pi-cog', routerLink: '/mfa/fido/manage', section: 'Multi-Factor Auth' },
    { label: 'Soft Token', icon: 'pi-shield', routerLink: '/mfa/softtoken', section: 'Multi-Factor Auth' },
    { label: 'Manage Soft Token', icon: 'pi-cog', routerLink: '/mfa/softtoken/manage', section: 'Multi-Factor Auth' },
    { label: 'Backup Codes', icon: 'pi-list', routerLink: '/mfa/backup-codes', section: 'Multi-Factor Auth' },
    { label: 'Active Sessions', icon: 'pi-desktop', routerLink: '/sessions', section: 'Security' },
    { label: 'Activity Log', icon: 'pi-history', routerLink: '/activity', section: 'Security' },
    { label: 'Request Access', icon: 'pi-plus-circle', routerLink: '/access-request', section: 'Access' },
    { label: 'My Requests', icon: 'pi-inbox', routerLink: '/access-requests', section: 'Access' },
    { label: 'Account Recovery', icon: 'pi-refresh', routerLink: '/recovery', section: 'Recovery' },
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
      this.userInitial = this.displayName ? this.displayName.charAt(0).toUpperCase() : 'U';
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
