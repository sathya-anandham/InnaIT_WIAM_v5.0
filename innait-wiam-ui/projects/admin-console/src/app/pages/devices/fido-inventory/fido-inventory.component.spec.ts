import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslatePipe } from '@innait/i18n';
import { AgGridAngular } from 'ag-grid-angular';
import { AuthService } from '@innait/core';
import { FidoInventoryComponent } from './fido-inventory.component';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Component({ selector: 'ag-grid-angular', standalone: true, template: '' })
class MockAgGrid {
  @Input() rowModelType: any;
  @Input() columnDefs: any;
  @Input() defaultColDef: any;
  @Input() rowSelection: any;
  @Input() gridOptions: any;
  @Input() animateRows: any;
  @Input() overlayLoadingTemplate: any;
  @Input() overlayNoRowsTemplate: any;
}

describe('FidoInventoryComponent', () => {
  let component: FidoInventoryComponent;
  let fixture: ComponentFixture<FidoInventoryComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);
  const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

  const mockStatsResponse = {
    data: {
      total: 120,
      active: 95,
      suspended: 20,
      revoked: 5,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FidoInventoryComponent,
        FormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(FidoInventoryComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .overrideComponent(FidoInventoryComponent, {
        remove: { imports: [AgGridAngular] },
        add: { imports: [MockAgGrid] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(FidoInventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Respond to the initial loadStats() call from ngOnInit
    const statsReq = httpTesting.expectOne((req) => req.url.includes('/devices/fido/stats'));
    statsReq.flush(mockStatsResponse);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should define ag-Grid columns', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);

    const fieldNames = component.columnDefs
      .filter((col) => col.field)
      .map((col) => col.field);

    expect(fieldNames).toContain('deviceLabel');
    expect(fieldNames).toContain('aaguid');
    expect(fieldNames).toContain('accountLoginId');
    expect(fieldNames).toContain('status');
    expect(fieldNames).toContain('registeredAt');
    expect(fieldNames).toContain('lastUsedAt');
  });

  it('should display summary stats', () => {
    expect(component.stats.total).toBe(120);
    expect(component.stats.active).toBe(95);
    expect(component.stats.suspended).toBe(20);
    expect(component.stats.revoked).toBe(5);
  });

  it('should handle device suspend action', () => {
    const mockDevice = {
      credentialId: 'cred-001',
      deviceLabel: 'YubiKey 5',
      nickname: 'My Key',
      aaguid: 'aaguid-abc',
      accountLoginId: 'user@test.com',
      accountDisplayName: 'Test User',
      userId: 'user-001',
      status: 'ACTIVE' as const,
      registeredAt: '2025-01-01T00:00:00Z',
      lastUsedAt: null,
    };

    // Open confirm dialog for suspend
    component.openConfirmDialog('suspend', 'cred-001', mockDevice);

    expect(component.confirmDialog.visible).toBeTrue();
    expect(component.confirmDialog.action).toBe('suspend');
    expect(component.confirmDialog.credentialId).toBe('cred-001');
    expect(component.confirmDialog.title).toContain('Suspend');

    // Execute the action
    component.executeAction();

    const req = httpTesting.expectOne('/api/v1/admin/devices/fido/cred-001/suspend');
    expect(req.request.method).toBe('POST');

    req.flush({ data: null });

    expect(component.confirmDialog.visible).toBeFalse();
    expect(component.actionInProgress).toBeFalse();

    // refreshGrid triggers a stats reload
    const statsReq = httpTesting.expectOne((req) => req.url.includes('/devices/fido/stats'));
    statsReq.flush(mockStatsResponse);
  });
});
