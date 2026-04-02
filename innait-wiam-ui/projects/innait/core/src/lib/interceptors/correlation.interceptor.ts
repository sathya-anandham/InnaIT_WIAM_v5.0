import { HttpInterceptorFn } from '@angular/common/http';

export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  const correlationId = crypto.randomUUID();
  req = req.clone({
    setHeaders: { 'X-Correlation-ID': correlationId },
  });
  return next(req);
};
