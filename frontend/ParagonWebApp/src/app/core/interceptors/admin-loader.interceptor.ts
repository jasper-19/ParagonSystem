import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { defer, finalize } from 'rxjs';
import { API_ENDPOINTS } from '../config/api.config';
import { SKIP_ADMIN_LOADER } from '../config/http-context';
import { AdminLoaderService } from '../services/admin-loader.service';
export const adminLoaderInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const loader = inject(AdminLoaderService);
  const isAdmin = router.url === '/admin' || router.url.startsWith('/admin/');
  const base = API_ENDPOINTS.base.endsWith('/') ? API_ENDPOINTS.base.slice(0, -1) : API_ENDPOINTS.base;
  const path = req.url.split('?')[0];
  const isApi = path === '/api' || path.startsWith('/api/') || path === base || path.startsWith(base + '/');
  if (!isAdmin || !isApi || req.context.get(SKIP_ADMIN_LOADER) || req.headers.has('x-skip-admin-loader')) return next(req);
  return defer(() => {
    const token = loader.begin();
    return defer(() => next(req)).pipe(finalize(() => loader.end(token)));
  });
};
