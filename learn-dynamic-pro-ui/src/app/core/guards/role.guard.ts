import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const currentRole = authService.userRole();

    if (currentRole && allowedRoles.includes(currentRole)) {
      return true;
    }

    // Redirect to unauthorized or login
    return router.parseUrl('/login');
  };
};
