import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '../services/tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantService = inject(TenantService);
  const tenantId = tenantService.currentTenantId;

  if (tenantId) {
    req = req.clone({
      setHeaders: { 'X-Tenant-ID': tenantId },
    });
  }
  return next(req);
};
