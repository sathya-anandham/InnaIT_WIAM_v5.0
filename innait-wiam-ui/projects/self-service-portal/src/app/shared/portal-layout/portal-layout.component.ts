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
          <ng-container *ngIf="branding$ | async as branding">
            <img *ngIf="branding.logoUrl" [src]="branding.logoUrl" [alt]="branding.tenantName + ' logo'" class="topbar-logo" />
            <span class="topbar-title">{{ branding.tenantName }}</span>
          </ng-container>
          <span *ngIf="!(branding$ | async)" class="topbar-title">InnaIT WIAM</span>
        </div>
        <div class="topbar-right">
          <span class="user-display-name" *ngIf="displayName">{{ displayName }}</span>
          <button class="logout-btn" (click)="logout()" aria-label="Logout">
            <i class="pi pi-sign-out"></i>
            <span class="logout-text">{{ 'common.logout' | translate }}</span>
          </button>
        </div>
      </header>

      <!-- Sidebar -->
      <nav id="sidebar-nav" class="sidebar" role="navigation" aria-label="Main navigation">
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
      grid-template-rows: 56px 1fr;
      grid-template-areas:
        "topbar topbar"
        "sidebar content";
      height: 100vh;
      overflow: hidden;
    }

    .portal-layout.sidebar-collapsed {
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
    .sidebar-toggle:hover {
      background: var(--innait-bg);
    }

    .topbar-logo {
      height: 32px;
      width: auto;
    }

    .topbar-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--innait-primary);
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

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

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
    .nav-link:hover {
      background: var(--innait-bg);
    }
    .nav-link.active {
      background: rgba(25, 118, 210, 0.08);
      border-left-color: var(--innait-primary);
      color: var(--innait-primary);
      font-weight: 500;
    }
    .nav-link .pi {
      font-size: 1rem;
      width: 1.25rem;
      text-align: center;
    }

    .content {
      grid-area: content;
      overflow-y: auto;
      padding: 1.5rem;
      background: var(--innait-bg);
    }

    @media (max-width: 768px) {
      .portal-layout {
        grid-template-columns: 0 1fr;
      }
      .sidebar {
        position: fixed;
        top: 56px;
        left: 0;
        bottom: 0;
        width: var(--innait-sidebar-width);
        z-index: 99;
        transform: translateX(-100%);
      }
      .portal-layout:not(.sidebar-collapsed) .sidebar {
        transform: translateX(0);
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
      }
      .logout-text { display: none; }
    }
  `],
})
export class PortalLayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  displayName = '';
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
