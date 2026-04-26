import { HttpInterceptorFn } from '@angular/common/http';
import { from } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return from(authService.getToken()).pipe(
    take(1),
    switchMap(token => {
      if (!token) return next(req);

      const authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
      return next(authReq);
    })
  );
};
