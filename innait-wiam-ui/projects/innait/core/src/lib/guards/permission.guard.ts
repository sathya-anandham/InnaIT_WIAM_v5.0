import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredPermission: string = route.data['permission'] ?? '';

  return authService.getAuthState().pipe(
    take(1),
    map((state) => {
      if (state.status !== 'AUTHENTICATED') {
        return router.createUrlTree(['/login']);
      }

      // Permission check can be role-based or entitlement-based.
      // For now, we check if the user has a role that starts with the required permission prefix.
      // This will be enhanced when a permissions API is available.
      const hasPermission = state.roles.some((role) =>
        role.toUpperCase().includes(requiredPermission.toUpperCase())
      );

      if (!hasPermission) {
        return router.createUrlTree(['/forbidden']);
      }

      return true;
    })
  );
};
