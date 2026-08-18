import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Dialog } from '../utils/dialog';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
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
      if (error.status === 401) {
        Dialog.alert('انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مجدداً.', 'تنبيه', 'error');
        authService.logout();
        router.navigate(['/login']);
      } else if (error.status === 403) {
        Dialog.alert('عذراً، ليس لديك الصلاحية للوصول إلى هذا المورد.', 'تنبيه', 'error');
        // Optionally redirect or handle 403 gracefully
      }
      return throwError(() => error);
    })
  );
};
