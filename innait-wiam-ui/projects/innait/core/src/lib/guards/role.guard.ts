import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredRoles: string[] = route.data['roles'] ?? [];

  return authService.getAuthState().pipe(
    take(1),
    map((state) => {
      if (state.status !== 'AUTHENTICATED') {
        return router.createUrlTree(['/login']);
      }

      const hasRole = requiredRoles.some((role) => state.roles.includes(role));
      if (!hasRole) {
        return router.createUrlTree(['/forbidden']);
      }

      return true;
    })
  );
};
