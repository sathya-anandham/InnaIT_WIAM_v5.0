import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { AccessRequestComponent } from './access-request.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('AccessRequestComponent', () => {
  let component: AccessRequestComponent;
  let fixture: ComponentFixture<AccessRequestComponent>;
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

  const mockRoleCatalog = [
    { id: 'role-1', roleName: 'Admin', roleCode: 'ADMIN', description: 'Administrator role' },
    { id: 'role-2', roleName: 'Editor', roleCode: 'EDITOR', description: 'Content editor role' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AccessRequestComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(AccessRequestComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AccessRequestComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component.requestForm).toBeTruthy();
  });

  it('should require request type and resource selection', () => {
    fixture.detectChanges();

    const form = component.requestForm;

    // Form should be invalid initially
    expect(form.valid).toBeFalse();

    // Mark all as touched to trigger validation
    form.markAllAsTouched();

    // requestType should be required
    expect(form.get('requestType')!.hasError('required')).toBeTrue();

    // resourceId should be required
    expect(form.get('resourceId')!.hasError('required')).toBeTrue();

    // justification should be required
    expect(form.get('justification')!.hasError('required')).toBeTrue();
  });

  it('should load catalog items when request type changes', fakeAsync(() => {
    fixture.detectChanges();

    // Simulate changing request type to ROLE
    component.onRequestTypeChange({ value: 'ROLE' as any });
    expect(component.loadingCatalog).toBeTrue();

    const catalogReq = httpMock.expectOne('/api/v1/self/catalog/roles');
    expect(catalogReq.request.method).toBe('GET');
    catalogReq.flush(mockRoleCatalog);
    tick();

    expect(component.loadingCatalog).toBeFalse();
    expect(component.catalogItems.length).toBe(2);
    expect(component.catalogItems[0].label).toBe('Admin');
    expect(component.catalogItems[0].code).toBe('ADMIN');
    expect(component.catalogItems[1].label).toBe('Editor');
  }));

  it('should validate justification minLength(20)', () => {
    fixture.detectChanges();

    const justificationCtrl = component.requestForm.get('justification')!;

    // Set a short justification
    justificationCtrl.setValue('Too short');
    justificationCtrl.markAsTouched();

    expect(justificationCtrl.hasError('minlength')).toBeTrue();

    // Set a valid justification (>= 20 chars)
    justificationCtrl.setValue('This is a valid justification that meets the minimum length requirement.');
    expect(justificationCtrl.hasError('minlength')).toBeFalse();
    expect(justificationCtrl.valid).toBeTrue();
  });

  it('should submit access request and show success', fakeAsync(() => {
    fixture.detectChanges();

    // Fill in the form with valid data
    component.requestForm.patchValue({
      requestType: 'ROLE',
      resourceId: 'role-1',
      justification: 'I need admin access for project management and deployment tasks.',
    });

    expect(component.requestForm.valid).toBeTrue();

    component.submitRequest();
    expect(component.submitting).toBeTrue();

    const submitReq = httpMock.expectOne('/api/v1/self/access-requests');
    expect(submitReq.request.method).toBe('POST');
    expect(submitReq.request.body.requestType).toBe('ROLE');
    expect(submitReq.request.body.resourceId).toBe('role-1');
    expect(submitReq.request.body.justification).toBe('I need admin access for project management and deployment tasks.');

    submitReq.flush({
      id: 'req-abc-123',
      requestType: 'ROLE',
      resourceId: 'role-1',
      status: 'PENDING',
    });
    tick();

    expect(component.submitting).toBeFalse();
    expect(component.submitSuccess).toBeTrue();
    expect(component.submittedRequestId).toBe('req-abc-123');
  }));
});
