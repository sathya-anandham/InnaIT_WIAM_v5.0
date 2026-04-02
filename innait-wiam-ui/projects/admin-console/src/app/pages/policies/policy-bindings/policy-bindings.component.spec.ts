import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { PolicyBindingsComponent } from './policy-bindings.component';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('PolicyBindingsComponent', () => {
  let component: PolicyBindingsComponent;
  let fixture: ComponentFixture<PolicyBindingsComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);

  const mockBindings = {
    data: [
      {
        id: 'b3',
        policyType: 'MFA' as const,
        policyName: 'MFA Policy',
        targetType: 'TENANT' as const,
        targetName: 'Default Tenant',
        priority: 3,
        enabled: true
      },
      {
        id: 'b1',
        policyType: 'AUTH_TYPE' as const,
        policyName: 'Auth Type Policy',
        targetType: 'TENANT' as const,
        targetName: 'Default Tenant',
        priority: 1,
        enabled: true
      },
      {
        id: 'b2',
        policyType: 'PASSWORD' as const,
        policyName: 'Password Policy',
        targetType: 'GROUP' as const,
        targetName: 'Admins',
        priority: 2,
        enabled: false
      }
    ]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PolicyBindingsComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .overrideComponent(PolicyBindingsComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PolicyBindingsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/bindings');
    req.flush(mockBindings);
    expect(component).toBeTruthy();
  });

  it('should load and display bindings sorted by priority', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/bindings');
    req.flush(mockBindings);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.bindings.length).toBe(3);
    // Bindings sorted by priority
    expect(component.bindings[0].id).toBe('b1');
    expect(component.bindings[0].priority).toBe(1);
    expect(component.bindings[1].id).toBe('b2');
    expect(component.bindings[1].priority).toBe(2);
    expect(component.bindings[2].id).toBe('b3');
    expect(component.bindings[2].priority).toBe(3);
    expect(component.filteredBindings.length).toBe(3);
  }));

  it('should handle drag-and-drop reorder', fakeAsync(() => {
    fixture.detectChanges();
    const loadReq = httpTesting.expectOne('/api/v1/admin/policies/bindings');
    loadReq.flush(mockBindings);
    tick();

    // Simulate drag start at index 2 (priority 3) and drop at index 0 (priority 1)
    const dragEvent = new DragEvent('dragstart', { dataTransfer: new DataTransfer() });
    component.onDragStart(dragEvent, 2);
    expect(component.dragIndex).toBe(2);

    const dropEvent = new DragEvent('drop', { dataTransfer: new DataTransfer() });
    Object.defineProperty(dropEvent, 'preventDefault', { value: jasmine.createSpy('preventDefault') });
    component.onDrop(dropEvent, 0);

    // After reorder, priorities should be updated
    expect(component.filteredBindings[0].priority).toBe(1);
    expect(component.filteredBindings[1].priority).toBe(2);
    expect(component.filteredBindings[2].priority).toBe(3);

    // A reorder API call should have been made
    const reorderReq = httpTesting.expectOne(req =>
      req.method === 'PUT' && req.url === '/api/v1/admin/policies/bindings/reorder'
    );
    expect(reorderReq.request.body.bindingIds).toBeTruthy();
    expect(reorderReq.request.body.bindingIds.length).toBe(3);
    reorderReq.flush({ data: null });
    tick();

    expect(component.dragIndex).toBeNull();
  }));

  it('should toggle binding enabled state', fakeAsync(() => {
    fixture.detectChanges();
    const loadReq = httpTesting.expectOne('/api/v1/admin/policies/bindings');
    loadReq.flush(mockBindings);
    tick();

    const binding = component.filteredBindings.find(b => b.id === 'b2')!;
    expect(binding.enabled).toBeFalse();

    // Toggle enabled
    binding.enabled = true;
    component.onToggleEnabled(binding);

    const toggleReq = httpTesting.expectOne(req =>
      req.method === 'PUT' && req.url === '/api/v1/admin/policies/bindings/b2'
    );
    expect(toggleReq.request.body.enabled).toBeTrue();
    toggleReq.flush({ data: {} });
    tick();

    expect(component.successMessage).toContain('enabled');
  }));
});
