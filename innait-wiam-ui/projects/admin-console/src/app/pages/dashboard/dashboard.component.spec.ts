import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
  discardPeriodicTasks,
} from '@angular/core/testing';
import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { DashboardComponent } from './dashboard.component';

import { AuthTrendsChartComponent } from './widgets/auth-trends-chart.component';
import { ActiveSessionsGaugeComponent } from './widgets/active-sessions-gauge.component';
import { MfaAdoptionChartComponent } from './widgets/mfa-adoption-chart.component';
import { CredentialEnrollmentBarComponent } from './widgets/credential-enrollment-bar.component';
import { FailedLoginHeatmapComponent } from './widgets/failed-login-heatmap.component';
import { AccountStatusPieComponent } from './widgets/account-status-pie.component';
import { RecentAdminActionsComponent } from './widgets/recent-admin-actions.component';
import { LockoutAlertCardComponent } from './widgets/lockout-alert-card.component';
import { SystemHealthComponent } from './widgets/system-health.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

// Stub child components
@Component({
  selector: 'app-auth-trends-chart',
  standalone: true,
  template: '<div class="stub-auth-trends"></div>',
})
class StubAuthTrendsChartComponent {
  @Input() refreshTrigger?: number;
}

@Component({
  selector: 'app-active-sessions-gauge',
  standalone: true,
  template: '<div class="stub-active-sessions"></div>',
})
class StubActiveSessionsGaugeComponent {
  @Input() refreshTrigger?: number;
}

@Component({
  selector: 'app-mfa-adoption-chart',
  standalone: true,
  template: '<div class="stub-mfa-adoption"></div>',
})
class StubMfaAdoptionChartComponent {
  @Input() refreshTrigger?: number;
}

@Component({
  selector: 'app-credential-enrollment-bar',
  standalone: true,
  template: '<div class="stub-credential-enrollment"></div>',
})
class StubCredentialEnrollmentBarComponent {
  @Input() refreshTrigger?: number;
}

@Component({
  selector: 'app-failed-login-heatmap',
  standalone: true,
  template: '<div class="stub-failed-login-heatmap"></div>',
})
class StubFailedLoginHeatmapComponent {
  @Input() refreshTrigger?: number;
}

@Component({
  selector: 'app-account-status-pie',
  standalone: true,
  template: '<div class="stub-account-status"></div>',
})
class StubAccountStatusPieComponent {
  @Input() refreshTrigger?: number;
}

@Component({
  selector: 'app-recent-admin-actions',
  standalone: true,
  template: '<div class="stub-recent-actions"></div>',
})
class StubRecentAdminActionsComponent {
  @Input() refreshTrigger?: number;
}

@Component({
  selector: 'app-lockout-alert-card',
  standalone: true,
  template: '<div class="stub-lockout-alert"></div>',
})
class StubLockoutAlertCardComponent {
  @Input() refreshTrigger?: number;
}

@Component({
  selector: 'app-system-health',
  standalone: true,
  template: '<div class="stub-system-health"></div>',
})
class StubSystemHealthComponent {
  @Input() refreshTrigger?: number;
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    })
      .overrideComponent(DashboardComponent, {
        remove: {
          imports: [
            TranslatePipe,
            AuthTrendsChartComponent,
            ActiveSessionsGaugeComponent,
            MfaAdoptionChartComponent,
            CredentialEnrollmentBarComponent,
            FailedLoginHeatmapComponent,
            AccountStatusPieComponent,
            RecentAdminActionsComponent,
            LockoutAlertCardComponent,
            SystemHealthComponent,
          ],
        },
        add: {
          imports: [
            MockTranslatePipe,
            StubAuthTrendsChartComponent,
            StubActiveSessionsGaugeComponent,
            StubMfaAdoptionChartComponent,
            StubCredentialEnrollmentBarComponent,
            StubFailedLoginHeatmapComponent,
            StubAccountStatusPieComponent,
            StubRecentAdminActionsComponent,
            StubLockoutAlertCardComponent,
            StubSystemHealthComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', fakeAsync(() => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('should render all 9 widget components', fakeAsync(() => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-auth-trends-chart')).toBeTruthy();
    expect(compiled.querySelector('app-active-sessions-gauge')).toBeTruthy();
    expect(compiled.querySelector('app-mfa-adoption-chart')).toBeTruthy();
    expect(
      compiled.querySelector('app-credential-enrollment-bar')
    ).toBeTruthy();
    expect(compiled.querySelector('app-failed-login-heatmap')).toBeTruthy();
    expect(compiled.querySelector('app-account-status-pie')).toBeTruthy();
    expect(compiled.querySelector('app-recent-admin-actions')).toBeTruthy();
    expect(compiled.querySelector('app-lockout-alert-card')).toBeTruthy();
    expect(compiled.querySelector('app-system-health')).toBeTruthy();

    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('should toggle auto-refresh on/off', fakeAsync(() => {
    fixture.detectChanges();

    // Auto-refresh is enabled by default
    expect(component.autoRefreshEnabled).toBe(true);

    // Toggle off
    component.toggleAutoRefresh();
    expect(component.autoRefreshEnabled).toBe(false);

    // Toggle back on
    component.toggleAutoRefresh();
    expect(component.autoRefreshEnabled).toBe(true);

    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('should increment refreshTrigger on manual refresh', fakeAsync(() => {
    fixture.detectChanges();

    const initialTrigger = component.refreshTrigger;

    component.manualRefresh();
    expect(component.refreshTrigger).toBe(initialTrigger + 1);
    expect(component.lastRefresh).toBeTruthy();

    component.manualRefresh();
    expect(component.refreshTrigger).toBe(initialTrigger + 2);

    component.ngOnDestroy();
    discardPeriodicTasks();
  }));
});
