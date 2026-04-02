import { ErrorHandler, Injectable, Injector, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private readonly injector: Injector,
    private readonly zone: NgZone
  ) {}

  handleError(error: unknown): void {
    // Unwrap promise rejections
    const resolvedError = error instanceof Error && 'rejection' in error
      ? (error as Record<string, unknown>)['rejection']
      : error;

    if (resolvedError instanceof HttpErrorResponse) {
      this.handleHttpError(resolvedError);
    } else {
      this.handleClientError(resolvedError);
    }
  }

  private handleHttpError(error: HttpErrorResponse): void {
    const message = error.error?.error?.message ?? error.message ?? 'Server error';
    this.logError('HTTP Error', { status: error.status, message, url: error.url });
    this.showToast(message);
  }

  private handleClientError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    this.logError('Client Error', { message, stack: error instanceof Error ? error.stack : undefined });
    this.showToast(message);
  }

  private logError(type: string, details: Record<string, unknown>): void {
    // In development, log to console
    console.error(`[${type}]`, details);
    // In production, this would send to a remote logging endpoint
  }

  private showToast(message: string): void {
    // Use NgZone to ensure change detection picks up the toast
    this.zone.run(() => {
      // Toast notification will be handled by a ToastService in @innait/ui
      // For now, we use a simple console warning
      console.warn('[Toast]', message);
    });
  }
}
