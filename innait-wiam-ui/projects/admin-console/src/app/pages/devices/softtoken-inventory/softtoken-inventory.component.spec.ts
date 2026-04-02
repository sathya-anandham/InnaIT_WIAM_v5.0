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
import { SoftTokenInventoryComponent } from './softtoken-inventory.component';

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

describe('SoftTokenInventoryComponent', () => {
  let component: SoftTokenInventoryComponent;
  let fixture: ComponentFixture<SoftTokenInventoryComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);
  const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

  const mockStatsResponse = {
    data: {
      total: 250,
      ios: 150,
      android: 100,
      healthyPushPercent: 92.5,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SoftTokenInventoryComponent,
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
      .overrideComponent(SoftTokenInventoryComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .overrideComponent(SoftTokenInventoryComponent, {
        remove: { imports: [AgGridAngular] },
        add: { imports: [MockAgGrid] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(SoftTokenInventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Respond to the initial loadStats() call from ngOnInit
    const statsReq = httpTesting.expectOne((req) => req.url.includes('/devices/softtoken/stats'));
    statsReq.flush(mockStatsResponse);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display summary stats with platform breakdown', () => {
    expect(component.stats.total).toBe(250);
    expect(component.stats.ios).toBe(150);
    expect(component.stats.android).toBe(100);
    expect(component.stats.healthyPushPercent).toBe(92.5);
  });

  it('should handle test push action', fakeAsync(() => {
    const mockToken = {
      tokenId: 'token-001',
      deviceName: 'iPhone 15',
      platform: 'iOS' as const,
      accountLoginId: 'user@test.com',
      accountDisplayName: 'Test User',
      userId: 'user-001',
      status: 'ACTIVE' as const,
      activatedAt: '2025-01-01T00:00:00Z',
      lastUsedAt: null,
      pushHealth: 'GREEN' as const,
    };

    // Open confirm dialog for test push
    component.openConfirmDialog('test-push', 'token-001', mockToken);

    expect(component.confirmDialog.visible).toBeTrue();
    expect(component.confirmDialog.action).toBe('test-push');
    expect(component.confirmDialog.tokenId).toBe('token-001');
    expect(component.confirmDialog.title).toContain('Test Push');

    // Execute the action
    component.executeAction();

    const req = httpTesting.expectOne('/api/v1/admin/devices/softtoken/token-001/test-push');
    expect(req.request.method).toBe('POST');

    req.flush({ data: { delivered: true } });

    expect(component.confirmDialog.visible).toBeFalse();
    expect(component.actionInProgress).toBeFalse();
    expect(component.testPushResult).toBeTruthy();
    expect(component.testPushResult!.success).toBeTrue();
    expect(component.testPushResult!.message).toContain('successfully');

    // Auto-dismiss after 5 seconds
    tick(5000);
    expect(component.testPushResult).toBeNull();
  }));
});
