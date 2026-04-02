import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform, ElementRef } from '@angular/core';

import { NotificationTemplatesComponent } from './notification-templates.component';
import { TranslatePipe } from '@innait/i18n';
import { MessageService } from 'primeng/api';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('NotificationTemplatesComponent', () => {
  let component: NotificationTemplatesComponent;
  let fixture: ComponentFixture<NotificationTemplatesComponent>;
  let httpTesting: HttpTestingController;

  const mockTemplates = [
    {
      id: 'tmpl-1',
      templateKey: 'password.reset',
      name: 'Password Reset',
      channel: 'EMAIL' as const,
      subject: 'Reset your password',
      body: 'Hello {{userName}}, click {{resetLink}} to reset your password.',
      variables: ['userName', 'resetLink', 'expiryTime'],
      lastModified: '2026-01-15T10:00:00Z'
    },
    {
      id: 'tmpl-2',
      templateKey: 'otp.verification',
      name: 'OTP Verification',
      channel: 'SMS' as const,
      subject: '',
      body: 'Your OTP code is {{otpCode}}. It expires in {{expiryTime}}.',
      variables: ['otpCode', 'expiryTime'],
      lastModified: '2026-02-20T14:00:00Z'
    },
    {
      id: 'tmpl-3',
      templateKey: 'login.alert',
      name: 'Login Alert',
      channel: 'PUSH' as const,
      subject: '',
      body: 'New login detected for {{userName}} at {{appName}}.',
      variables: ['userName', 'appName'],
      lastModified: '2026-03-05T09:00:00Z'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NotificationTemplatesComponent,
        ReactiveFormsModule,
        FormsModule,
        NoopAnimationsModule
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService
      ]
    })
    .overrideComponent(NotificationTemplatesComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationTemplatesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/notification-templates');
    req.flush({ data: mockTemplates });

    expect(component).toBeTruthy();
  });

  it('should load templates on init', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/notification-templates');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockTemplates });

    expect(component.loading).toBeFalse();
    expect(component.templates.length).toBe(3);
    expect(component.filteredTemplates.length).toBe(3);
    expect(component.templates[0].name).toBe('Password Reset');
    expect(component.templates[0].channel).toBe('EMAIL');
    expect(component.templates[1].name).toBe('OTP Verification');
    expect(component.templates[1].channel).toBe('SMS');
    expect(component.templates[2].channel).toBe('PUSH');
  });

  it('should select a template and show editor', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/notification-templates');
    req.flush({ data: mockTemplates });

    // Initially no template selected
    expect(component.selectedTemplate).toBeNull();

    // Select the first template
    component.selectTemplate(mockTemplates[0]);
    fixture.detectChanges();

    expect(component.selectedTemplate).toBeTruthy();
    expect(component.selectedTemplate!.id).toBe('tmpl-1');
    expect(component.selectedTemplate!.name).toBe('Password Reset');

    // Verify form is populated with template data
    expect(component.templateForm.get('subject')?.value).toBe('Reset your password');
    expect(component.templateForm.get('body')?.value).toBe(
      'Hello {{userName}}, click {{resetLink}} to reset your password.'
    );
    expect(component.templateForm.pristine).toBeTrue();

    // Preview should be reset when selecting a new template
    expect(component.previewHtml).toBe('');
    expect(component.previewSubject).toBe('');
  });

  it('should insert variable at cursor position', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/notification-templates');
    req.flush({ data: mockTemplates });

    // Select a template first
    component.selectTemplate(mockTemplates[0]);
    fixture.detectChanges();

    // Mock the textarea element with a cursor position
    const mockTextarea = document.createElement('textarea');
    mockTextarea.value = 'Hello , welcome!';
    mockTextarea.selectionStart = 6; // cursor after "Hello "
    mockTextarea.selectionEnd = 6;
    component.bodyTextarea = new ElementRef(mockTextarea);

    // Set the body value to match the textarea
    component.templateForm.patchValue({ body: 'Hello , welcome!' });

    // Insert a variable
    component.insertVariable('userName');

    // Verify the variable was inserted at cursor position
    const newBody = component.templateForm.get('body')?.value;
    expect(newBody).toBe('Hello {{userName}}, welcome!');
    expect(component.templateForm.dirty).toBeTrue();
  });
});
