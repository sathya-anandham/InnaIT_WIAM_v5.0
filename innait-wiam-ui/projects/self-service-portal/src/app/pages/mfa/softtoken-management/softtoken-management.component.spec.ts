import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { SoftTokenManagementComponent } from './softtoken-management.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('SoftTokenManagementComponent', () => {
  let component: SoftTokenManagementComponent;
  let fixture: ComponentFixture<SoftTokenManagementComponent>;
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
        SoftTokenManagementComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(SoftTokenManagementComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SoftTokenManagementComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/mfa/softtoken');
    req.flush({ activated: true, activatedAt: '2025-01-15T10:00:00Z', deviceName: 'iPhone 15', lastUsedAt: '2025-03-01T08:30:00Z' });

    expect(component).toBeTruthy();
  });

  it('should load and display soft token status', fakeAsync(() => {
    const mockStatus = {
      activated: true,
      activatedAt: '2025-01-15T10:00:00Z',
      deviceName: 'iPhone 15',
      lastUsedAt: '2025-03-01T08:30:00Z',
    };

    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/mfa/softtoken');
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.tokenStatus).toEqual(mockStatus);
    expect(component.tokenStatus!.activated).toBeTrue();
    expect(component.tokenStatus!.deviceName).toBe('iPhone 15');
  }));

  it('should show not-activated state when not activated', fakeAsync(() => {
    const mockStatus = {
      activated: false,
      activatedAt: '',
      deviceName: '',
      lastUsedAt: '',
    };

    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/mfa/softtoken');
    req.flush(mockStatus);
    tick();
    fixture.detectChanges();

    expect(component.tokenStatus!.activated).toBeFalse();

    const compiled = fixture.nativeElement as HTMLElement;
    const notActivatedSection = compiled.querySelector('.not-activated-section');
    expect(notActivatedSection).toBeTruthy();
  }));

  it('should open deactivate dialog', fakeAsync(() => {
    const mockStatus = {
      activated: true,
      activatedAt: '2025-01-15T10:00:00Z',
      deviceName: 'iPhone 15',
      lastUsedAt: '2025-03-01T08:30:00Z',
    };

    fixture.detectChanges();

    const req = httpMock.expectOne('/api/v1/self/mfa/softtoken');
    req.flush(mockStatus);
    tick();
    fixture.detectChanges();

    expect(component.showDeactivateDialog).toBeFalse();

    // Simulate clicking the deactivate button
    component.showDeactivateDialog = true;
    fixture.detectChanges();

    expect(component.showDeactivateDialog).toBeTrue();

    // Test confirm deactivation with password
    component.deactivateForm.patchValue({ password: 'mypassword123' });
    component.confirmDeactivation();

    const deactivateReq = httpMock.expectOne('/api/v1/self/mfa/softtoken');
    expect(deactivateReq.request.method).toBe('DELETE');
    expect(deactivateReq.request.body).toEqual({ password: 'mypassword123' });
    deactivateReq.flush(null);
    tick();

    // After deactivation, it reloads status
    const reloadReq = httpMock.expectOne('/api/v1/self/mfa/softtoken');
    reloadReq.flush({ activated: false, activatedAt: '', deviceName: '', lastUsedAt: '' });
    tick();

    expect(component.showDeactivateDialog).toBeFalse();
    expect(component.successMessage).toBe('Soft token has been deactivated successfully.');
  }));
});
