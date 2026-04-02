import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform, Component, Input } from '@angular/core';
import { of } from 'rxjs';
import { AccountLockedComponent } from './account-locked.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

@Component({ selector: 'app-login-layout', standalone: true, template: '<ng-content />' })
class MockLoginLayoutComponent {
  @Input() title = '';
  @Input() subtitle = '';
}

describe('AccountLockedComponent', () => {
  let component: AccountLockedComponent;
  let fixture: ComponentFixture<AccountLockedComponent>;
  let router: Router;

  beforeEach(async () => {
    jasmine.clock().install();

    await TestBed.configureTestingModule({
      imports: [AccountLockedComponent],
    })
      .overrideComponent(AccountLockedComponent, {
        set: {
          imports: [
            (await import('@angular/common')).CommonModule,
            (await import('primeng/button')).ButtonModule,
            MockLoginLayoutComponent,
            MockTranslatePipe,
          ],
        },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(AccountLockedComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    component.ngOnDestroy();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display countdown timer', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const countdown = compiled.querySelector('.countdown');
    expect(countdown).toBeTruthy();
    // Default lockout is 1800 seconds = 30:00
    expect(countdown!.textContent).toContain('30:00');
  });

  it('should format time correctly', () => {
    fixture.detectChanges();

    // 90 seconds = 1 minute and 30 seconds
    expect(component.formatTime(90)).toBe('1:30');

    // 3600 seconds = 60 minutes and 0 seconds
    expect(component.formatTime(3600)).toBe('60:00');

    // Edge cases
    expect(component.formatTime(0)).toBe('0:00');
    expect(component.formatTime(59)).toBe('0:59');
    expect(component.formatTime(60)).toBe('1:00');
  });

  it('should disable try again button while locked', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // PrimeNG p-button renders a <button> element inside
    const tryAgainBtn = compiled.querySelector('.button-group p-button button') as HTMLButtonElement
      ?? compiled.querySelector('.button-group p-button[ng-reflect-disabled="true"]')
      ?? compiled.querySelector('p-button[ng-reflect-disabled="true"]');

    // The component sets [disabled]="lockoutRemaining > 0" and lockoutRemaining starts at 1800
    expect(component.lockoutRemaining).toBeGreaterThan(0);

    // Verify the disabled attribute is reflected on the p-button
    const pButton = compiled.querySelector('p-button[ng-reflect-disabled="true"]');
    expect(pButton).toBeTruthy();
  });

  it('should decrement timer every second', () => {
    fixture.detectChanges();
    const initialRemaining = component.lockoutRemaining;

    jasmine.clock().tick(1000);
    expect(component.lockoutRemaining).toBe(initialRemaining - 1);

    jasmine.clock().tick(1000);
    expect(component.lockoutRemaining).toBe(initialRemaining - 2);

    jasmine.clock().tick(5000);
    expect(component.lockoutRemaining).toBe(initialRemaining - 7);
  });

  it('should enable try again button when lockout expires', () => {
    fixture.detectChanges();

    // Fast-forward past the entire lockout period (1800 seconds)
    jasmine.clock().tick(1800 * 1000);
    fixture.detectChanges();

    expect(component.lockoutRemaining).toBe(0);

    // After lockout expires, the button should no longer be disabled
    const compiled = fixture.nativeElement as HTMLElement;
    // Check that the disabled binding is now false
    const enabledButton = compiled.querySelector('p-button[ng-reflect-disabled="false"]');
    expect(enabledButton).toBeTruthy();

    // Should also show the "You can try logging in again" message
    expect(compiled.textContent).toContain('You can try logging in again');
  });
});
