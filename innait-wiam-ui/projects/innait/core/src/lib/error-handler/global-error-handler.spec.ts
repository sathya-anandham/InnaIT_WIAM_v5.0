import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Injector, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { GlobalErrorHandler } from './global-error-handler';
import { ToastService } from '../services/toast.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let mockToast: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    mockToast = jasmine.createSpyObj('ToastService', ['success', 'info', 'warn', 'error']);

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: ToastService, useValue: mockToast },
      ],
    });

    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('should be created', () => {
    expect(handler).toBeTruthy();
  });

  it('should show warning toast for HTTP 400', () => {
    const error = new HttpErrorResponse({ status: 400, error: { error: { message: 'Bad input' } } });
    handler.handleError(error);
    expect(mockToast.warn).toHaveBeenCalledWith('Bad input', 'Validation Error');
  });

  it('should NOT show toast for HTTP 401', () => {
    const error = new HttpErrorResponse({ status: 401 });
    handler.handleError(error);
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(mockToast.warn).not.toHaveBeenCalled();
  });

  it('should show error toast for HTTP 403', () => {
    const error = new HttpErrorResponse({ status: 403 });
    handler.handleError(error);
    expect(mockToast.error).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
      'Access Denied',
    );
  });

  it('should show warning toast for HTTP 404', () => {
    const error = new HttpErrorResponse({ status: 404 });
    handler.handleError(error);
    expect(mockToast.warn).toHaveBeenCalledWith(
      'The requested resource was not found.',
      'Not Found',
    );
  });

  it('should show warning toast for HTTP 429', () => {
    const error = new HttpErrorResponse({ status: 429 });
    handler.handleError(error);
    expect(mockToast.warn).toHaveBeenCalledWith(
      'Too many requests. Please wait a moment and try again.',
      'Rate Limited',
    );
  });

  it('should show error toast for HTTP 500', () => {
    const error = new HttpErrorResponse({ status: 500 });
    handler.handleError(error);
    expect(mockToast.error).toHaveBeenCalledWith(
      'An unexpected server error occurred. Please try again.',
      'Server Error',
    );
  });

  it('should show error toast for HTTP 502', () => {
    const error = new HttpErrorResponse({ status: 502 });
    handler.handleError(error);
    expect(mockToast.error).toHaveBeenCalledWith(
      'An unexpected server error occurred. Please try again.',
      'Server Error',
    );
  });

  it('should show connection error toast for HTTP status 0', () => {
    const error = new HttpErrorResponse({ status: 0 });
    handler.handleError(error);
    expect(mockToast.error).toHaveBeenCalledWith(
      'Unable to connect to server. Please check your network.',
      'Connection Error',
    );
  });

  it('should show error toast for client Error', () => {
    handler.handleError(new Error('Something broke'));
    expect(mockToast.error).toHaveBeenCalledWith('Something broke');
  });

  it('should show generic toast for non-Error client error', () => {
    handler.handleError('string error');
    expect(mockToast.error).toHaveBeenCalledWith('An unexpected error occurred');
  });

  it('should show conflict toast for HTTP 409', () => {
    const error = new HttpErrorResponse({ status: 409, error: { error: { message: 'Duplicate entry' } } });
    handler.handleError(error);
    expect(mockToast.warn).toHaveBeenCalledWith('Duplicate entry', 'Conflict');
  });
});
