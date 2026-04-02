import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { AuthPolicyComponent } from './auth-policy.component';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('AuthPolicyComponent', () => {
  let component: AuthPolicyComponent;
  let fixture: ComponentFixture<AuthPolicyComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);

  const mockRules = {
    data: [
      {
        id: 'rule-1',
        name: 'Block Suspicious IPs',
        rule: "#request.ipAddress.startsWith('10.0.')",
        action: 'DENY' as const,
        priority: 1,
        enabled: true
      },
      {
        id: 'rule-2',
        name: 'Require MFA After Hours',
        rule: "T(java.time.LocalTime).now().isAfter(T(java.time.LocalTime).of(18,0))",
        action: 'REQUIRE_MFA' as const,
        priority: 2,
        enabled: false
      }
    ]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthPolicyComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .overrideComponent(AuthPolicyComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuthPolicyComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/auth-rules');
    req.flush(mockRules);
    expect(component).toBeTruthy();
  });

  it('should load auth rules', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/auth-rules');
    req.flush(mockRules);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.rules.length).toBe(2);
    // Rules should be sorted by priority
    expect(component.rules[0].name).toBe('Block Suspicious IPs');
    expect(component.rules[0].priority).toBe(1);
    expect(component.rules[1].name).toBe('Require MFA After Hours');
    expect(component.rules[1].priority).toBe(2);
  }));

  it('should apply SpEL syntax highlighting', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/auth-rules');
    req.flush(mockRules);
    tick();

    const highlighted = component.highlightSpel("#request.ipAddress.startsWith('10.0.')");

    // Should contain spel-variable class for #request
    expect(highlighted).toContain('spel-variable');
    expect(highlighted).toContain('#request');
  }));

  it('should test a rule with sample context', fakeAsync(() => {
    fixture.detectChanges();
    const loadReq = httpTesting.expectOne('/api/v1/admin/policies/auth-rules');
    loadReq.flush(mockRules);
    tick();

    // Open test dialog for the first rule
    component.openTestDialog(component.rules[0]);
    expect(component.testDialogVisible).toBeTrue();
    expect(component.testingRuleExpression).toBe("#request.ipAddress.startsWith('10.0.')");

    // Set context and run test
    component.testContext = {
      ipAddress: '10.0.1.50',
      userAgent: 'Mozilla/5.0',
      timeOfDay: '14:00',
      accountStatus: 'ACTIVE',
      roles: 'ADMIN'
    };
    component.runTest();

    const testReq = httpTesting.expectOne(req =>
      req.method === 'POST' && req.url === '/api/v1/admin/policies/auth-rules/test'
    );
    expect(testReq.request.body.rule).toBe("#request.ipAddress.startsWith('10.0.')");
    expect(testReq.request.body.context.ipAddress).toBe('10.0.1.50');
    expect(testReq.request.body.context.roles).toEqual(['ADMIN']);

    testReq.flush({
      data: {
        result: 'PASS',
        details: 'Expression evaluated to true',
        evaluatedExpression: "#request.ipAddress.startsWith('10.0.') => true"
      }
    });
    tick();

    expect(component.testingRule).toBeFalse();
    expect(component.testResult).toBeTruthy();
    expect(component.testResult!.result).toBe('PASS');
  }));
});
