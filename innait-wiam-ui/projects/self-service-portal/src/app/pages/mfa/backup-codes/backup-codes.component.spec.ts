import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { BackupCodesComponent } from './backup-codes.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('BackupCodesComponent', () => {
  let component: BackupCodesComponent;
  let fixture: ComponentFixture<BackupCodesComponent>;
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BackupCodesComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(BackupCodesComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(BackupCodesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/mfa/backup-codes');
    req.flush({ generated: false, generatedAt: '', totalCodes: 0, remainingCodes: 0 });

    expect(component).toBeTruthy();
  });

  it('should load backup codes status on init', fakeAsync(() => {
    const mockStatus = {
      generated: true,
      generatedAt: '2025-02-10T14:00:00Z',
      totalCodes: 10,
      remainingCodes: 8,
    };

    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/mfa/backup-codes');
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.status).toEqual(mockStatus);
    expect(component.status!.generated).toBeTrue();
    expect(component.status!.remainingCodes).toBe(8);
  }));

  it('should show generate button when no codes exist', fakeAsync(() => {
    const mockStatus = {
      generated: false,
      generatedAt: '',
      totalCodes: 0,
      remainingCodes: 0,
    };

    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/mfa/backup-codes');
    req.flush(mockStatus);
    tick();
    fixture.detectChanges();

    expect(component.status!.generated).toBeFalse();

    const compiled = fixture.nativeElement as HTMLElement;
    const noCodesSection = compiled.querySelector('.no-codes-section');
    expect(noCodesSection).toBeTruthy();

    const generateButton = compiled.querySelector('.no-codes-section button');
    expect(generateButton).toBeTruthy();
  }));

  it('should generate codes and display them', fakeAsync(() => {
    const mockStatus = {
      generated: false,
      generatedAt: '',
      totalCodes: 0,
      remainingCodes: 0,
    };

    fixture.detectChanges();

    const statusReq = httpMock.expectOne('/api/v1/self/mfa/backup-codes');
    statusReq.flush(mockStatus);
    tick();

    const mockCodes = {
      codes: ['12345678', '23456789', '34567890', '45678901', '56789012',
              '67890123', '78901234', '89012345', '90123456', '01234567'],
    };

    component.generateCodes();
    expect(component.generating).toBeTrue();

    const generateReq = httpMock.expectOne('/api/v1/self/mfa/backup-codes/generate');
    expect(generateReq.request.method).toBe('POST');
    generateReq.flush(mockCodes);
    tick();

    expect(component.generating).toBeFalse();
    expect(component.revealedCodes).toEqual(mockCodes.codes);
    expect(component.revealedCodes!.length).toBe(10);

    // After generating, it reloads the status
    const reloadReq = httpMock.expectOne('/api/v1/self/mfa/backup-codes');
    reloadReq.flush({
      generated: true,
      generatedAt: '2025-04-03T12:00:00Z',
      totalCodes: 10,
      remainingCodes: 10,
    });
    tick();
  }));

  it('should show warning when remaining codes less than 3', fakeAsync(() => {
    const mockStatus = {
      generated: true,
      generatedAt: '2025-02-10T14:00:00Z',
      totalCodes: 10,
      remainingCodes: 2,
    };

    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/mfa/backup-codes');
    req.flush(mockStatus);
    tick();
    fixture.detectChanges();

    expect(component.status!.remainingCodes).toBe(2);
    expect(component.status!.remainingCodes).toBeLessThan(3);

    const compiled = fixture.nativeElement as HTMLElement;
    // The stat-card should have the stat-warning class
    const warningCard = compiled.querySelector('.stat-card.stat-warning');
    expect(warningCard).toBeTruthy();

    // The warning p-message should be visible
    const warningMessage = compiled.querySelector('.warning-message');
    expect(warningMessage).toBeTruthy();
  }));
});
