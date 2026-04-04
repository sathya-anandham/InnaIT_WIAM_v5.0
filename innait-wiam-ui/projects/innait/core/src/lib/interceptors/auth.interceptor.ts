import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Read XSRF-TOKEN from cookie and add as header
  // The server sets XSRF-TOKEN cookie; Angular's withXsrfConfiguration handles this,
  // but we add it explicitly for non-standard cookie names
  const xsrfToken = getCookie('XSRF-TOKEN');
  if (xsrfToken) {
    req = req.clone({
      setHeaders: { 'X-XSRF-TOKEN': xsrfToken },
    });
  }
  return next(req);
};

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]!) : null;
}
