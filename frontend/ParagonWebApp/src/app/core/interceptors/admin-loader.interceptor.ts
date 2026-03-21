import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminLoaderService } from '../services/admin-loader.service';

/**
 * Shows the loader only while the user is on an `/admin` route and HTTP requests are in-flight.
 * This is intentionally scoped so public pages don't get the admin loader behavior.
 */
export const adminLoaderInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const loader = inject(AdminLoaderService);

  const isAdminRoute = router.url.startsWith('/admin');
  if (!isAdminRoute) {
    return next(req);
  }

  // Only track API calls; ignore third-party URLs (e.g. weather) and static assets
  // so admin pages don't get stuck behind unrelated long-running requests.
  const isApiRequest = req.url.startsWith('/api/');
  if (!isApiRequest || req.headers.has('x-skip-admin-loader')) {
    return next(req);
  }

  loader.begin();

  return next(req).pipe(
    finalize(() => {
      loader.end();
    })
  );
};
