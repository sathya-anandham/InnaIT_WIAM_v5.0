import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { PolicySimulatorComponent } from './policy-simulator.component';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('PolicySimulatorComponent', () => {
  let component: PolicySimulatorComponent;
  let fixture: ComponentFixture<PolicySimulatorComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);

  const mockSimulationResult = {
    data: {
      authType: {
        primaryFactors: ['PASSWORD'],
        secondaryFactors: ['TOTP'],
        mfaRequired: 'CONDITIONAL',
        sourceHierarchy: ['Tenant', 'Group: Admins']
      },
      passwordPolicy: {
        minLength: 12,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireDigit: true,
        requireSpecialChar: true,
        specialCharsAllowed: '!@#$%^&*',
        maxAge: 90,
        historyCount: 5,
        maxFailedAttempts: 5,
        lockoutDuration: 30,
        sourceHierarchy: ['Tenant']
      },
      mfaPolicy: {
        allowedMethods: ['TOTP', 'FIDO2'],
        deviceRememberDays: 30,
        enrollmentGracePeriodDays: 7,
        conditions: [{ trigger: 'IP_CHANGE', action: 'REQUIRE_MFA' }],
        sourceHierarchy: ['Tenant']
      },
      authRules: [
        {
          name: 'Block Suspicious IPs',
          expression: "#request.ipAddress.startsWith('10.0.')",
          action: 'DENY',
          wouldFire: false,
          sourceHierarchy: ['Tenant']
        }
      ]
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PolicySimulatorComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .overrideComponent(PolicySimulatorComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PolicySimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.simulationResult).toBeNull();
  });

  it('should search for accounts', fakeAsync(() => {
    const mockUsers = {
      data: [
        { id: 'u1', displayName: 'John Doe', email: 'john@example.com' },
        { id: 'u2', displayName: 'Jane Smith', email: 'jane@example.com' }
      ]
    };

    component.onSearchChange('John');
    tick(350); // debounceTime(300) + buffer

    const searchReq = httpTesting.expectOne(req =>
      req.url === '/api/v1/admin/users' && req.params.get('search') === 'John'
    );
    searchReq.flush(mockUsers);
    tick();

    expect(component.suggestions.length).toBe(2);
    expect(component.suggestions[0].displayName).toBe('John Doe');

    // Select an account
    component.selectAccount(component.suggestions[0]);
    expect(component.selectedAccount).toBeTruthy();
    expect(component.selectedAccount!.id).toBe('u1');
    expect(component.showSuggestions).toBeFalse();
  }));

  it('should simulate policies and display 4 result cards', fakeAsync(() => {
    // Select an account first
    component.selectedAccount = { id: 'u1', displayName: 'John Doe', email: 'john@example.com' };
    component.simulationContext = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      timeOverride: ''
    };

    component.runSimulation();
    expect(component.simulating).toBeTrue();

    const simReq = httpTesting.expectOne(req =>
      req.method === 'POST' && req.url === '/api/v1/admin/policies/simulate'
    );
    expect(simReq.request.body.accountId).toBe('u1');
    expect(simReq.request.body.context.ipAddress).toBe('192.168.1.100');

    simReq.flush(mockSimulationResult);
    tick();

    expect(component.simulating).toBeFalse();
    expect(component.simulationResult).toBeTruthy();
    // Verify all 4 policy sections are populated
    expect(component.simulationResult!.authType.primaryFactors).toContain('PASSWORD');
    expect(component.simulationResult!.passwordPolicy.minLength).toBe(12);
    expect(component.simulationResult!.mfaPolicy.allowedMethods).toContain('TOTP');
    expect(component.simulationResult!.authRules.length).toBe(1);
    expect(component.simulationResult!.authRules[0].wouldFire).toBeFalse();
  }));

  it('should export results as JSON', fakeAsync(() => {
    component.selectedAccount = { id: 'u1', displayName: 'John Doe', email: 'john@example.com' };
    component.simulationResult = mockSimulationResult.data as any;

    // Spy on URL and anchor creation
    const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
    const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
    const anchorElement = document.createElement('a');
    spyOn(anchorElement, 'click');
    spyOn(document, 'createElement').and.returnValue(anchorElement);

    component.exportResults();

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchorElement.download).toContain('policy-simulation-u1');
    expect(anchorElement.download).toContain('.json');
    expect(anchorElement.click).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  }));
});
