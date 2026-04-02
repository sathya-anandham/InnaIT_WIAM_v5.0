import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { AdminActionHistoryComponent } from './admin-action-history.component';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('AdminActionHistoryComponent', () => {
  let component: AdminActionHistoryComponent;
  let fixture: ComponentFixture<AdminActionHistoryComponent>;
  let httpTesting: HttpTestingController;

  const mockActions = {
    data: {
      content: [
        {
          id: 'act-1',
          adminId: 'admin-1',
          adminName: 'Super Admin',
          action: 'UPDATE',
          targetType: 'USER',
          targetId: 'user-42',
          targetName: 'John Doe',
          oldValues: { email: 'old@example.com', role: 'USER' },
          newValues: { email: 'new@example.com', role: 'ADMIN' },
          timestamp: '2025-05-01T10:30:00Z',
          ipAddress: '192.168.1.10'
        },
        {
          id: 'act-2',
          adminId: 'admin-2',
          adminName: 'Ops Admin',
          action: 'CREATE',
          targetType: 'ROLE',
          targetId: 'role-5',
          targetName: 'Auditor',
          oldValues: null,
          newValues: { name: 'Auditor', permissions: ['READ_AUDIT'] },
          timestamp: '2025-05-01T09:15:00Z',
          ipAddress: '10.0.0.5'
        }
      ],
      meta: {
        totalElements: 2,
        totalPages: 1
      }
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminActionHistoryComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .overrideComponent(AdminActionHistoryComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminActionHistoryComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(r => r.url.includes('/api/v1/admin/audit/admin-actions'));
    req.flush(mockActions);
    expect(component).toBeTruthy();
  });

  it('should load admin actions', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(r => r.url.includes('/api/v1/admin/audit/admin-actions'));
    req.flush(mockActions);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.actions.length).toBe(2);
    expect(component.actions[0].id).toBe('act-1');
    expect(component.actions[0].adminName).toBe('Super Admin');
    expect(component.actions[0].action).toBe('UPDATE');
    expect(component.actions[1].action).toBe('CREATE');
    expect(component.totalRecords).toBe(2);
    expect(component.totalPages).toBe(1);
  }));

  it('should compute diff between old and new values', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(r => r.url.includes('/api/v1/admin/audit/admin-actions'));
    req.flush(mockActions);
    tick();

    const oldValues = { email: 'old@example.com', role: 'USER', deleted: 'yes' };
    const newValues = { email: 'new@example.com', role: 'USER', added: 'yes' };

    const diff = component.computeDiff(oldValues, newValues);

    // 'email' changed, 'role' unchanged, 'deleted' removed, 'added' added
    const emailEntry = diff.find(d => d.key === 'email');
    expect(emailEntry).toBeTruthy();
    expect(emailEntry!.status).toBe('changed');
    expect(emailEntry!.oldValue).toBe('old@example.com');
    expect(emailEntry!.newValue).toBe('new@example.com');

    const roleEntry = diff.find(d => d.key === 'role');
    expect(roleEntry).toBeTruthy();
    expect(roleEntry!.status).toBe('unchanged');

    const deletedEntry = diff.find(d => d.key === 'deleted');
    expect(deletedEntry).toBeTruthy();
    expect(deletedEntry!.status).toBe('removed');

    const addedEntry = diff.find(d => d.key === 'added');
    expect(addedEntry).toBeTruthy();
    expect(addedEntry!.status).toBe('added');

    // Verify sorting: added/removed/changed come before unchanged
    const lastEntry = diff[diff.length - 1];
    expect(lastEntry.status).toBe('unchanged');
  }));
});
