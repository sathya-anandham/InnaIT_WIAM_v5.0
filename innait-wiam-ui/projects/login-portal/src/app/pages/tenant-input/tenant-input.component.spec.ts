import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { TenantInputComponent } from './tenant-input.component';
import { TenantService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('TenantInputComponent', () => {
  let component: TenantInputComponent;
  let fixture: ComponentFixture<TenantInputComponent>;
  let router: Router;
  let httpTesting: HttpTestingController;

  let mockTenantService: {
    currentTenantId: string;
    setTenantId: jasmine.Spy;
    resolveFromUrl: jasmine.Spy;
    tenantId: ReturnType<typeof of>;
    branding: ReturnType<typeof of>;
  };

  beforeEach(async () => {
    mockTenantService = {
      currentTenantId: '',
      setTenantId: jasmine.createSpy('setTenantId'),
      resolveFromUrl: jasmine.createSpy('resolveFromUrl'),
      tenantId: of(''),
      branding: of(null),
    };

    await TestBed.configureTestingModule({
      imports: [TenantInputComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: TenantService, useValue: mockTenantService },
      ],
    })
      .overrideComponent(TenantInputComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(TenantInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create the component', () => {
    createComponent();
    expect(component).toBeTruthy();
    expect(component.form).toBeDefined();
  });

  it('should redirect to /login if tenant already resolved', () => {
    mockTenantService.currentTenantId = 'acme';
    createComponent();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should show validation error when input is empty and submitted', () => {
    createComponent();

    // Touch the field and leave it empty
    const control = component.form.get('emailOrDomain');
    control?.markAsTouched();
    fixture.detectChanges();

    const errorEl = (fixture.nativeElement as HTMLElement).querySelector('.p-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl?.textContent?.trim()).toBe('common.required');
  });

  it('should extract domain from email and set tenant ID', () => {
    createComponent();

    component.form.get('emailOrDomain')?.setValue('user@acme.com');
    component.onSubmit();
    fixture.detectChanges();

    expect(mockTenantService.setTenantId).toHaveBeenCalledWith('acme');
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should use raw input as tenant code when no @ sign', () => {
    createComponent();

    component.form.get('emailOrDomain')?.setValue('acme');
    component.onSubmit();
    fixture.detectChanges();

    expect(mockTenantService.setTenantId).toHaveBeenCalledWith('acme');
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
