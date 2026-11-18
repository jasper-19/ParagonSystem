import { HttpInterceptorFn } from '@angular/common/http';
import { API_ENDPOINTS } from '../config/api.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = new URL(API_ENDPOINTS.base, 'http://localhost');
  const target = new URL(req.url, 'http://localhost');
  const basePath = base.pathname.replace(/\/$/, '');
  if (target.origin !== base.origin ||
      !(target.pathname === basePath || target.pathname.startsWith(`${basePath}/`))) {
    return next(req);
  }

  const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(
    req.method.toUpperCase()
  );

  return next(
    req.clone({
      withCredentials: true,
      headers: unsafeMethod
        ? req.headers.set('X-CSRF-Protection', '1')
        : req.headers,
    })
  );
};
