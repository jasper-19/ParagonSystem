import { HttpInterceptorFn } from '@angular/common/http';
import { API_ENDPOINTS } from '../config/api.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_ENDPOINTS.base)) {
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
