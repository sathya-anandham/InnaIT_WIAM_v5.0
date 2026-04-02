import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { LockoutAlertCardComponent } from './lockout-alert-card.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('LockoutAlertCardComponent', () => {
  let component: LockoutAlertCardComponent;
  let fixture: ComponentFixture<LockoutAlertCardComponent>;
  let httpMock: HttpTestingController;

  const mockLockedAccounts = [
    {
      accountId: 'acc-001',
      loginId: 'john.doe@example.com',
      lockedAt: new Date(Date.now() - 600000).toISOString(),
      failedAttempts: 5,
    },
    {
      accountId: 'acc-002',
      loginId: 'jane.smith@example.com',
      lockedAt: new Date(Date.now() - 3600000).toISOString(),
      failedAttempts: 3,
    },
  ];

  const mockResponse = {
    data: {
      accounts: mockLockedAccounts,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LockoutAlertCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(LockoutAlertCardComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LockoutAlertCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/admin/dashboard/locked-accounts');
    req.flush(mockResponse);
    expect(component).toBeTruthy();
  });

  it('should fetch and display locked accounts', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/locked-accounts');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    expect(component.lockedAccounts.length).toBe(2);
    expect(component.lockedAccounts[0].loginId).toBe('john.doe@example.com');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const lockoutItems = compiled.querySelectorAll('.lockout-item');
    expect(lockoutItems.length).toBe(2);

    // Count badge should show 2
    const badge = compiled.querySelector('.count-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent!.trim()).toBe('2');
  });

  it('should unlock an account on button click', () => {
    fixture.detectChanges();

    const loadReq = httpMock.expectOne(
      '/api/v1/admin/dashboard/locked-accounts'
    );
    loadReq.flush(mockResponse);
    fixture.detectChanges();

    expect(component.lockedAccounts.length).toBe(2);

    // Click unlock on the first account
    component.unlockAccount(component.lockedAccounts[0]);

    expect(component.unlockingIds.has('acc-001')).toBe(true);

    const unlockReq = httpMock.expectOne(
      '/api/v1/admin/accounts/acc-001/unlock'
    );
    expect(unlockReq.request.method).toBe('POST');
    unlockReq.flush({ data: null });

    expect(component.unlockingIds.has('acc-001')).toBe(false);
    expect(component.lockedAccounts.length).toBe(1);
    expect(component.lockedAccounts[0].accountId).toBe('acc-002');
  });

  it('should show empty state when no locked accounts', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/locked-accounts');
    req.flush({ data: { accounts: [] } });
    fixture.detectChanges();

    expect(component.lockedAccounts.length).toBe(0);

    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();

    const lockoutItems = compiled.querySelectorAll('.lockout-item');
    expect(lockoutItems.length).toBe(0);

    // Count badge should NOT be shown
    const badge = compiled.querySelector('.count-badge');
    expect(badge).toBeFalsy();
  });
});
