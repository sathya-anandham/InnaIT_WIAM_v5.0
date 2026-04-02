import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getAuthState().pipe(
    take(1),
    map((state) => {
      if (state.status === 'AUTHENTICATED') {
        return true;
      }
      return router.createUrlTree(['/login']);
    })
  );
};
