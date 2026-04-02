import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { ErrorPageComponent } from './error-page.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

function createComponent(queryParams: Record<string, string> = {}): {
  fixture: ComponentFixture<ErrorPageComponent>;
  component: ErrorPageComponent;
  routerSpy: jasmine.SpyObj<Router>;
} {
  const routerSpy = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']);

  TestBed.configureTestingModule({
    imports: [ErrorPageComponent, NoopAnimationsModule],
    providers: [
      { provide: Router, useValue: routerSpy },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(queryParams),
          },
        },
      },
    ],
  }).overrideComponent(ErrorPageComponent, {
    remove: { imports: ['TranslatePipe'] as any },
    add: { imports: [MockTranslatePipe] },
  });

  const fixture = TestBed.createComponent(ErrorPageComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, routerSpy };
}

describe('ErrorPageComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create the component', () => {
    const { component } = createComponent();
    expect(component).toBeTruthy();
  });

  it('should display default error message when no code', () => {
    const { component, fixture } = createComponent();

    expect(component.displayMessage).toBe(
      'An unexpected error occurred during authentication. Please try again.'
    );

    const compiled = fixture.nativeElement as HTMLElement;
    const messageEl = compiled.querySelector('.error-message');
    expect(messageEl).toBeTruthy();
    expect(messageEl!.textContent).toContain('An unexpected error occurred');
  });

  it('should display contextual message for known error code', () => {
    const { component, fixture } = createComponent({ code: 'session_expired' });

    expect(component.displayMessage).toBe('Your session has expired. Please sign in again.');

    const compiled = fixture.nativeElement as HTMLElement;
    const messageEl = compiled.querySelector('.error-message');
    expect(messageEl!.textContent).toContain('Your session has expired');
  });

  it('should display contextual message for auth_failed code', () => {
    const { component } = createComponent({ code: 'auth_failed' });

    expect(component.displayMessage).toBe(
      'Authentication could not be completed. Please try again.'
    );
  });

  it('should not display raw error details', () => {
    const { fixture } = createComponent({
      code: 'auth_failed',
      error: 'password=secret123&user=admin',
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const fullText = compiled.textContent ?? '';

    // Ensure no credential-like data appears in the rendered output
    expect(fullText).not.toContain('secret123');
    expect(fullText).not.toContain('password=');
    expect(fullText).not.toContain('user=admin');
  });

  it('should navigate to login on retry when no returnUrl', () => {
    const { component, routerSpy } = createComponent({ code: 'auth_failed' });

    component.retry();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should navigate to returnUrl on retry when provided', () => {
    const { component, routerSpy } = createComponent({
      code: 'session_expired',
      returnUrl: '/dashboard/overview',
    });

    component.retry();

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/dashboard/overview');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
