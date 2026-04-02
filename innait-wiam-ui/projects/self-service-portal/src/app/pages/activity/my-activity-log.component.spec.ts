import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { TranslatePipe } from '@innait/i18n';

import { MyActivityLogComponent } from './my-activity-log.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('MyActivityLogComponent', () => {
  let component: MyActivityLogComponent;
  let fixture: ComponentFixture<MyActivityLogComponent>;
  let httpMock: HttpTestingController;

  const mockRouter = {
    navigate: jasmine.createSpy('navigate'),
  };

  const mockActivityResponse = {
    data: [
      {
        id: 'evt-1',
        eventType: 'LOGIN_SUCCESS',
        outcome: 'SUCCESS',
        ipAddress: '192.168.1.10',
        timestamp: '2025-04-03T08:00:00Z',
        details: { browser: 'Chrome', os: 'Windows' },
      },
      {
        id: 'evt-2',
        eventType: 'PASSWORD_CHANGE',
        outcome: 'SUCCESS',
        ipAddress: '192.168.1.10',
        timestamp: '2025-04-02T14:00:00Z',
        details: null,
      },
      {
        id: 'evt-3',
        eventType: 'LOGIN_FAILURE',
        outcome: 'FAILURE',
        ipAddress: '10.0.0.25',
        timestamp: '2025-04-01T10:00:00Z',
        details: { reason: 'Invalid password' },
      },
    ],
    meta: {
      page: 0,
      size: 20,
      totalElements: 3,
      totalPages: 1,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MyActivityLogComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(MyActivityLogComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MyActivityLogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(r => r.url === '/api/v1/self/activity');
    req.flush(mockActivityResponse);

    expect(component).toBeTruthy();
  });

  it('should load activity events with pagination', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne(r => r.url === '/api/v1/self/activity');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(mockActivityResponse);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.events.length).toBe(3);
    expect(component.pagination).toBeTruthy();
    expect(component.pagination!.totalElements).toBe(3);
    expect(component.pagination!.page).toBe(0);
  }));

  it('should display events in table with formatted types', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne(r => r.url === '/api/v1/self/activity');
    req.flush(mockActivityResponse);
    tick();

    // Test formatEventType method
    expect(component.formatEventType('LOGIN_SUCCESS')).toBe('Login Success');
    expect(component.formatEventType('PASSWORD_CHANGE')).toBe('Password Change');
    expect(component.formatEventType('LOGIN_FAILURE')).toBe('Login Failure');

    // Test getEventIcon
    expect(component.getEventIcon('LOGIN_SUCCESS')).toBe('pi-sign-in');
    expect(component.getEventIcon('PASSWORD_CHANGE')).toBe('pi-lock');
    expect(component.getEventIcon('LOGIN_FAILURE')).toBe('pi-exclamation-triangle');
  }));

  it('should filter by event type', fakeAsync(() => {
    fixture.detectChanges();

    const initialReq = httpMock.expectOne(r => r.url === '/api/v1/self/activity');
    initialReq.flush(mockActivityResponse);
    tick();

    // Change the event type filter
    component.filterForm.patchValue({ eventType: 'LOGIN_SUCCESS' });
    tick(500); // debounceTime is 400ms

    const filteredReq = httpMock.expectOne(r =>
      r.url === '/api/v1/self/activity' && r.params.get('eventType') === 'LOGIN_SUCCESS'
    );
    expect(filteredReq.request.method).toBe('GET');
    expect(filteredReq.request.params.get('eventType')).toBe('LOGIN_SUCCESS');
    expect(filteredReq.request.params.get('page')).toBe('0');

    filteredReq.flush({
      data: [mockActivityResponse.data[0]],
      meta: { page: 0, size: 20, totalElements: 1, totalPages: 1 },
    });
    tick();

    expect(component.events.length).toBe(1);
    expect(component.events[0].eventType).toBe('LOGIN_SUCCESS');
  }));

  it('should paginate via server-side pagination', fakeAsync(() => {
    fixture.detectChanges();

    const initialReq = httpMock.expectOne(r => r.url === '/api/v1/self/activity');
    initialReq.flush({
      data: mockActivityResponse.data,
      meta: { page: 0, size: 20, totalElements: 50, totalPages: 3 },
    });
    tick();

    expect(component.pagination!.totalElements).toBe(50);

    // Simulate page change
    component.onPageChange({ first: 20, rows: 20, page: 1 });

    const pageReq = httpMock.expectOne(r =>
      r.url === '/api/v1/self/activity' && r.params.get('page') === '1'
    );
    expect(pageReq.request.method).toBe('GET');
    expect(pageReq.request.params.get('page')).toBe('1');
    expect(pageReq.request.params.get('size')).toBe('20');

    pageReq.flush({
      data: [
        { id: 'evt-21', eventType: 'PROFILE_UPDATE', outcome: 'SUCCESS', ipAddress: '192.168.1.10', timestamp: '2025-03-20T10:00:00Z', details: null },
      ],
      meta: { page: 1, size: 20, totalElements: 50, totalPages: 3 },
    });
    tick();

    expect(component.events.length).toBe(1);
    expect(component.pagination!.page).toBe(1);
  }));
});
