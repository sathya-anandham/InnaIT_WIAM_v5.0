import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const mfaGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredAcr: number = route.data['minAcrLevel'] ?? 2;

  return authService.getAuthState().pipe(
    take(1),
    map((state) => {
      if (state.status !== 'AUTHENTICATED') {
        return router.createUrlTree(['/login']);
      }

      const currentAcr = parseInt(state.acr, 10) || 0;
      if (currentAcr < requiredAcr) {
        return router.createUrlTree(['/login/mfa-select'], {
          queryParams: { returnUrl: route.url.toString() },
        });
      }

      return true;
    })
  );
};
