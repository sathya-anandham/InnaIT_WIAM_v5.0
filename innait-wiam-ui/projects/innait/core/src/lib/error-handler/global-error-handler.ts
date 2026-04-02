import { ErrorHandler, Injectable, Injector, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../services/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private readonly injector: Injector,
    private readonly zone: NgZone,
  ) {}

  handleError(error: unknown): void {
    const resolvedError =
      error instanceof Error && 'rejection' in error
        ? (error as Record<string, unknown>)['rejection']
        : error;

    if (resolvedError instanceof HttpErrorResponse) {
      this.handleHttpError(resolvedError);
    } else {
      this.handleClientError(resolvedError);
    }
  }

  private handleHttpError(error: HttpErrorResponse): void {
    const toast = this.injector.get(ToastService);
    const message = error.error?.error?.message ?? error.message ?? 'Server error';

    this.zone.run(() => {
      switch (error.status) {
        case 0:
          toast.error('Unable to connect to server. Please check your network.', 'Connection Error');
          break;
        case 400:
          toast.warn(message, 'Validation Error');
          break;
        case 401:
          // Handled by error interceptor (redirect to login) — no toast
          break;
        case 403:
          toast.error('You do not have permission to perform this action.', 'Access Denied');
          break;
        case 404:
          toast.warn('The requested resource was not found.', 'Not Found');
          break;
        case 409:
          toast.warn(message, 'Conflict');
          break;
        case 429:
          toast.warn('Too many requests. Please wait a moment and try again.', 'Rate Limited');
          break;
        default:
          if (error.status >= 500) {
            toast.error('An unexpected server error occurred. Please try again.', 'Server Error');
          } else {
            toast.error(message, 'Error');
          }
      }
    });

    this.logError('HTTP Error', { status: error.status, message, url: error.url });
  }

  private handleClientError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    this.logError('Client Error', { message, stack: error instanceof Error ? error.stack : undefined });

    const toast = this.injector.get(ToastService);
    this.zone.run(() => toast.error(message));
  }

  private logError(type: string, details: Record<string, unknown>): void {
    console.error(`[${type}]`, details);
  }
}
