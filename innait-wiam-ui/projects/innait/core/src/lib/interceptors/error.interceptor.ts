import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    retry({
      count: 2,
      delay: (error, retryCount) => {
        // Only retry on 5xx server errors and network errors
        if (error instanceof HttpErrorResponse && error.status >= 500) {
          return timer(retryCount * 1000);
        }
        return throwError(() => error);
      },
    }),
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          authService.clearState();
          router.navigate(['/login']);
          break;
        case 403:
          router.navigate(['/forbidden']);
          break;
      }
      return throwError(() => error);
    })
  );
};
