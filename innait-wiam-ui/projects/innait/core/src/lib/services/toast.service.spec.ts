import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  let mockMessageService: jasmine.SpyObj<MessageService>;

  beforeEach(() => {
    mockMessageService = jasmine.createSpyObj('MessageService', ['add', 'clear']);
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
    service.register(mockMessageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show success toast', () => {
    service.success('Operation completed');
    expect(mockMessageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'success',
      summary: 'Success',
      detail: 'Operation completed',
      life: 5000,
    }));
  });

  it('should show info toast', () => {
    service.info('Information message');
    expect(mockMessageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'info',
      detail: 'Information message',
    }));
  });

  it('should show warn toast', () => {
    service.warn('Warning message');
    expect(mockMessageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'warn',
      detail: 'Warning message',
    }));
  });

  it('should show error toast with longer life', () => {
    service.error('Error message');
    expect(mockMessageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'error',
      detail: 'Error message',
      life: 8000,
    }));
  });

  it('should use custom summary', () => {
    service.success('Done', 'Custom Title');
    expect(mockMessageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      summary: 'Custom Title',
    }));
  });

  it('should clear all toasts', () => {
    service.clear();
    expect(mockMessageService.clear).toHaveBeenCalled();
  });

  it('should not throw if MessageService not registered', () => {
    const unregistered = new ToastService();
    expect(() => unregistered.success('test')).not.toThrow();
  });
});
