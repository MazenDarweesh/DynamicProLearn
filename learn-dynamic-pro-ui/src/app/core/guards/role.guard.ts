import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const currentRole = authService.userRole();
    const isAuth = authService.isAuthenticated();

    // Not authenticated at all or token expired → go to login
    if (!isAuth || !currentRole) {
      return router.parseUrl('/login');
    }

    // Has valid role for this route → allow
    if (allowedRoles.includes(currentRole)) {
      return true;
    }

    // Authenticated but wrong role → redirect to their own home page
    if (currentRole === 'Admin') return router.parseUrl('/admin');
    if (currentRole === 'Student') return router.parseUrl('/student');
    if (currentRole === 'Tester') return router.parseUrl('/tester');

    // Fallback
    return router.parseUrl('/login');
  };
};
