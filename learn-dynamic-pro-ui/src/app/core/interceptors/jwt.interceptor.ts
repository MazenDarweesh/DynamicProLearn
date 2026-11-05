import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/platform-core/auth.service';
import { Router } from '@angular/router';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { BehaviorSubject, throwError } from 'rxjs';
import { Dialog } from '../utils/dialog';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router, { optional: true });
  const token = authService.token();

  let modifiedReq = req;
  if (token) {
    modifiedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // 🛡️ Silent Guard: In embedded mode, ERP host, erp-mock, or background copilot requests,
      // NEVER show modal alert dialogs or hijack router navigation to /login!
      const isEmbeddedOrSilent =
        req.headers.has('X-Skip-Auth-Redirect') ||
        req.headers.has('X-Copilot-Silent') ||
        req.url.includes('/api/student/copilot-filters') ||
        (typeof window !== 'undefined' && (
          !!(window as any).__LMS_COPILOT_EMBEDDED__ ||
          !!(window as any).__ERP_HOST__ ||
          !!(window as any).DynamicERP ||
          window.location.pathname.includes('/erp-mock') ||
          (router?.url?.includes('/erp-mock') ?? false)
        ));

      if (error.status === 401) {
        if (isEmbeddedOrSilent) {
          return throwError(() => error);
        }

        // 1. If the failed request was login or refresh-token itself, don't loop; log out
        if (
          req.url.includes('/api/Auth/login') ||
          req.url.includes('/api/Auth/erp-login') ||
          req.url.includes('/api/Auth/refresh-token')
        ) {
          authService.logout();
          router?.navigate(['/login']);
          return throwError(() => error);
        }

        // 2. If no refresh token is stored, session has truly ended
        if (!authService.refreshTokenValue()) {
          if (router) {
            Dialog.alert('انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مجدداً.', 'تنبيه', 'error');
            authService.logout();
            router.navigate(['/login']);
          }
          return throwError(() => error);
        }

        // 3. Coordinate silent refresh
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return authService.refreshToken().pipe(
            switchMap((res: any) => {
              isRefreshing = false;
              const newToken = res?.token;
              refreshTokenSubject.next(newToken);
              return next(
                req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${newToken}`
                  }
                })
              );
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              if (router && !isEmbeddedOrSilent) {
                Dialog.alert('انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مجدداً.', 'تنبيه', 'error');
                authService.logout();
                router.navigate(['/login']);
              }
              return throwError(() => refreshErr);
            })
          );
        } else {
          // Another request is already refreshing the token; wait for it to finish and replay
          return refreshTokenSubject.pipe(
            filter((newToken) => newToken !== null),
            take(1),
            switchMap((newToken) => {
              return next(
                req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${newToken}`
                  }
                })
              );
            })
          );
        }
      } else if (error.status === 403) {
        if (!isEmbeddedOrSilent) {
          Dialog.alert('عذراً، ليس لديك الصلاحية للوصول إلى هذا المورد.', 'تنبيه', 'error');
        }
      }
      return throwError(() => error);
    })
  );
};
