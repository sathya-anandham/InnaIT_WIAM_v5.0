import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, finalize } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly activeRequests$ = new BehaviorSubject<number>(0);

  get loading$(): Observable<boolean> {
    return new Observable<boolean>((subscriber) => {
      this.activeRequests$.subscribe((count) => subscriber.next(count > 0));
    });
  }

  get isLoading(): boolean {
    return this.activeRequests$.getValue() > 0;
  }

  increment(): void {
    this.activeRequests$.next(this.activeRequests$.getValue() + 1);
  }

  decrement(): void {
    const current = this.activeRequests$.getValue();
    this.activeRequests$.next(Math.max(0, current - 1));
  }
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip loading indicator for background requests
  if (req.headers.has('X-Skip-Loading')) {
    return next(req);
  }

  // We use a simple global counter approach via LoadingService
  // The service is injected in the interceptor function
  const loadingService = (globalThis as Record<string, unknown>)['__innaitLoadingService'] as LoadingService | undefined;
  if (loadingService) {
    loadingService.increment();
    return next(req).pipe(finalize(() => loadingService.decrement()));
  }
  return next(req);
};
