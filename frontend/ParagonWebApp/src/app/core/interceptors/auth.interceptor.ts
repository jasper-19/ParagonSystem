import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AdminAuthService } from '../services/admin-auth.service';

/**
 * Attaches the JWT Bearer token to every outgoing request that has a token stored.
 * The backend ignores the header on public routes (e.g. POST /api/applications).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AdminAuthService);
  const token = auth.getToken();

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    })
  );
};
