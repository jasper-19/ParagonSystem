import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AdminAuthService } from '../services/admin-auth.service';

// ===== Auth Interceptor =====
// Attaches the JWT Bearer token to outgoing requests when available.
// The backend ignores the header on public routes (e.g. POST /api/applications).
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Lazily inject the admin auth service using Angular's functional `inject`.
  const auth = inject(AdminAuthService);

  // Retrieve the stored token (if any). If no token exists, forward
  // the request unchanged so public endpoints remain accessible.
  const token = auth.getToken();

  if (!token) {
    return next(req);
  }

  // Clone the request and set the Authorization header with the Bearer token.
  // Returning `next` with the cloned request keeps behavior identical.
  return next(
    req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    })
  );
};
