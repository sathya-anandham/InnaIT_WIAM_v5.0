import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { BrandingEditorComponent } from './branding-editor.component';
import { TranslatePipe } from '@innait/i18n';
import { ConfirmationService } from 'primeng/api';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('BrandingEditorComponent', () => {
  let component: BrandingEditorComponent;
  let fixture: ComponentFixture<BrandingEditorComponent>;
  let httpTesting: HttpTestingController;

  const mockBrandingData = {
    logoUrl: 'https://example.com/logo.png',
    faviconUrl: 'https://example.com/favicon.ico',
    primaryColor: '#3B82F6',
    accentColor: '#10B981',
    loginBackgroundUrl: '',
    loginTitle: 'Welcome to InnaIT WIAM',
    loginSubtitle: 'Sign in to your account',
    footerText: '(c) 2026 Acme Corp'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BrandingEditorComponent,
        ReactiveFormsModule,
        NoopAnimationsModule
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService
      ]
    })
    .overrideComponent(BrandingEditorComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BrandingEditorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/branding');
    req.flush({ data: mockBrandingData });

    expect(component).toBeTruthy();
  });

  it('should load branding data on init', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/branding');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockBrandingData });

    expect(component.loading).toBeFalse();
    expect(component.brandingForm.get('primaryColor')?.value).toBe('#3B82F6');
    expect(component.brandingForm.get('accentColor')?.value).toBe('#10B981');
    expect(component.brandingForm.get('loginTitle')?.value).toBe('Welcome to InnaIT WIAM');
    expect(component.brandingForm.get('footerText')?.value).toBe('(c) 2026 Acme Corp');
    expect(component.logoPreview).toBe('https://example.com/logo.png');
    expect(component.faviconPreview).toBe('https://example.com/favicon.ico');
  });

  it('should update live preview when color changes', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/branding');
    req.flush({ data: mockBrandingData });

    // Change primary color
    component.brandingForm.patchValue({ primaryColor: '#FF0000' });
    fixture.detectChanges();

    expect(component.brandingForm.get('primaryColor')?.value).toBe('#FF0000');

    // Change accent color
    component.brandingForm.patchValue({ accentColor: '#00FF00' });
    fixture.detectChanges();

    expect(component.brandingForm.get('accentColor')?.value).toBe('#00FF00');

    // Verify login title updates in form (used by template for live preview)
    component.brandingForm.patchValue({ loginTitle: 'New Title' });
    fixture.detectChanges();

    expect(component.brandingForm.get('loginTitle')?.value).toBe('New Title');

    // Verify loginBackgroundUrl changes update previewBgUrl via watcher
    component.brandingForm.patchValue({ loginBackgroundUrl: 'https://example.com/bg.jpg' });
    fixture.detectChanges();

    expect(component.previewBgUrl).toBe('https://example.com/bg.jpg');
  });

  it('should validate logo file size (max 2MB)', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/branding');
    req.flush({ data: mockBrandingData });

    // Create a mock file event with a file exceeding 2MB
    const oversizedFile = new File(['x'.repeat(100)], 'big-logo.png', { type: 'image/png' });
    Object.defineProperty(oversizedFile, 'size', { value: 3 * 1024 * 1024 }); // 3MB

    const oversizedEvent = {
      target: { files: [oversizedFile] }
    } as unknown as Event;

    component.onLogoSelected(oversizedEvent);

    expect(component.errorMessage).toBe('Logo file size must be less than 2MB.');
    expect(component.uploadingLogo).toBeFalse();

    // Create a valid file under 2MB
    const validFile = new File(['x'.repeat(100)], 'small-logo.png', { type: 'image/png' });
    Object.defineProperty(validFile, 'size', { value: 1 * 1024 * 1024 }); // 1MB

    const validEvent = {
      target: { files: [validFile] }
    } as unknown as Event;

    component.onLogoSelected(validEvent);

    // Should start upload -- error message should be cleared
    expect(component.errorMessage).toBe('');

    const uploadReq = httpTesting.expectOne('/api/v1/admin/settings/branding/logo');
    expect(uploadReq.request.method).toBe('POST');
    uploadReq.flush({ data: { url: 'https://example.com/new-logo.png' } });

    expect(component.uploadingLogo).toBeFalse();
    expect(component.brandingForm.get('logoUrl')?.value).toBe('https://example.com/new-logo.png');
  });
});
