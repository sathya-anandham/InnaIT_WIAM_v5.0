import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { MySessionsComponent } from './my-sessions.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('MySessionsComponent', () => {
  let component: MySessionsComponent;
  let fixture: ComponentFixture<MySessionsComponent>;
  let httpMock: HttpTestingController;

  const mockAuthState = {
    status: 'AUTHENTICATED',
    roles: [],
    groups: [],
    amr: ['PASSWORD'],
    acr: 'urn:innait:acr:basic',
    userId: 'user-1',
    accountId: 'acc-1',
    displayName: 'Test User',
    sessionId: 'sess-1',
  };

  const mockAuthService = {
    getAuthState: jasmine.createSpy('getAuthState').and.returnValue(of(mockAuthState)),
    get currentState() {
      return mockAuthState;
    },
  };

  const mockRouter = {
    navigate: jasmine.createSpy('navigate'),
  };

  const mockSessions = [
    {
      sessionId: 'sess-1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      ipAddress: '192.168.1.10',
      authMethodsUsed: ['PASSWORD', 'MFA'],
      createdAt: '2025-04-03T08:00:00Z',
      lastActivityAt: '2025-04-03T09:30:00Z',
      active: true,
    },
    {
      sessionId: 'sess-2',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Firefox/121.0',
      ipAddress: '10.0.0.25',
      authMethodsUsed: ['PASSWORD'],
      createdAt: '2025-04-02T14:00:00Z',
      lastActivityAt: '2025-04-02T16:00:00Z',
      active: true,
    },
    {
      sessionId: 'sess-3',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS) Safari/17.0',
      ipAddress: '172.16.0.5',
      authMethodsUsed: ['PASSWORD'],
      createdAt: '2025-04-01T10:00:00Z',
      lastActivityAt: '2025-04-01T11:00:00Z',
      active: false,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MySessionsComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(MySessionsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MySessionsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/sessions');
    req.flush(mockSessions);

    expect(component).toBeTruthy();
  });

  it('should load and display sessions in table', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/sessions');
    expect(req.request.method).toBe('GET');
    req.flush(mockSessions);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.sessions.length).toBe(3);
    // Current session should be sorted first
    expect(component.sessions[0].sessionId).toBe('sess-1');
  }));

  it('should highlight current session', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/sessions');
    req.flush(mockSessions);
    tick();
    fixture.detectChanges();

    // The current session should be identified correctly
    expect(component.isCurrentSession(component.sessions[0])).toBeTrue();
    expect(component.isCurrentSession(component.sessions[1])).toBeFalse();
    expect(component.isCurrentSession(component.sessions[2])).toBeFalse();

    const compiled = fixture.nativeElement as HTMLElement;
    const currentSessionRow = compiled.querySelector('.current-session-row');
    expect(currentSessionRow).toBeTruthy();
  }));

  it('should revoke a non-current session', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/sessions');
    req.flush(mockSessions);
    tick();

    // Confirm revoke for session 2
    const sessionToRevoke = component.sessions.find(s => s.sessionId === 'sess-2')!;
    component.confirmRevoke(sessionToRevoke);
    expect(component.showRevokeDialog).toBeTrue();
    expect(component.sessionToRevoke).toBe(sessionToRevoke);

    // Execute revoke
    component.revokeSession();

    const revokeReq = httpMock.expectOne('/api/v1/self/sessions/sess-2');
    expect(revokeReq.request.method).toBe('DELETE');
    revokeReq.flush(null);
    tick();

    expect(component.successMessage).toBe('Session revoked successfully.');
    expect(component.showRevokeDialog).toBeFalse();

    // After revocation, sessions are reloaded
    const reloadReq = httpMock.expectOne('/api/v1/self/sessions');
    reloadReq.flush([mockSessions[0], mockSessions[2]]);
    tick();

    expect(component.sessions.length).toBe(2);
  }));

  it('should revoke all other sessions', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/sessions');
    req.flush(mockSessions);
    tick();

    expect(component.otherSessions.length).toBe(2);

    // Confirm revoke all
    component.confirmRevokeAll();
    expect(component.showRevokeAllDialog).toBeTrue();

    // Execute revoke all
    component.revokeAllOtherSessions();

    const revokeAllReq = httpMock.expectOne('/api/v1/self/sessions/revoke-all');
    expect(revokeAllReq.request.method).toBe('POST');
    revokeAllReq.flush(null);
    tick();

    expect(component.successMessage).toBe('All other sessions have been revoked.');
    expect(component.showRevokeAllDialog).toBeFalse();

    // After revocation, sessions are reloaded
    const reloadReq = httpMock.expectOne('/api/v1/self/sessions');
    reloadReq.flush([mockSessions[0]]);
    tick();

    expect(component.sessions.length).toBe(1);
    expect(component.otherSessions.length).toBe(0);
  }));
});
