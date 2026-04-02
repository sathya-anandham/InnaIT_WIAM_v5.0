import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { TranslatePipe } from '@innait/i18n';
import { RecentAdminActionsComponent } from './recent-admin-actions.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('RecentAdminActionsComponent', () => {
  let component: RecentAdminActionsComponent;
  let fixture: ComponentFixture<RecentAdminActionsComponent>;
  let httpMock: HttpTestingController;

  const mockActions = [
    {
      eventType: 'USER_CREATE',
      actorType: 'ADMIN',
      actorId: 'admin@innait.com',
      outcome: 'SUCCESS',
      timestamp: new Date().toISOString(),
    },
    {
      eventType: 'LOGIN',
      actorType: 'SYSTEM',
      actorId: 'system',
      outcome: 'FAILURE',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  const mockResponse = {
    data: mockActions,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentAdminActionsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(RecentAdminActionsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RecentAdminActionsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/v1/admin/dashboard/recent-actions');
    req.flush(mockResponse);
    expect(component).toBeTruthy();
  });

  it('should fetch and display recent actions', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/recent-actions');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    expect(component.actions.length).toBe(2);
    expect(component.actions[0].eventType).toBe('USER_CREATE');
    expect(component.actions[1].eventType).toBe('LOGIN');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const actionItems = compiled.querySelectorAll('.action-item');
    expect(actionItems.length).toBe(2);

    // Verify formatEventType output renders
    const actionType = compiled.querySelector('.action-type');
    expect(actionType!.textContent!.trim()).toBe('User Create');
  });

  it('should show empty state when no actions', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/admin/dashboard/recent-actions');
    req.flush({ data: [] });

    expect(component.actions.length).toBe(0);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();

    const actionItems = compiled.querySelectorAll('.action-item');
    expect(actionItems.length).toBe(0);
  });
});
