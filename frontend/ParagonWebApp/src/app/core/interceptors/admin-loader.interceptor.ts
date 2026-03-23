import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminLoaderService } from '../services/admin-loader.service';

// ===== Admin Loader Interceptor =====
// Shows the loader only while the user is on an `/admin` route and
// HTTP requests targeting the application's API are in-flight.
// This interceptor is intentionally scoped to admin routes so public
// pages do not receive the admin loading behavior.
export const adminLoaderInterceptor: HttpInterceptorFn = (req, next) => {
  // Lazily inject framework services using Angular's `inject` helper.
  const router = inject(Router);
  const loader = inject(AdminLoaderService);

  // Quick guard: only enable admin loader when the current URL is under
  // the `/admin` path. If the user is not on an admin route, do nothing
  // and forward the request immediately.
  const isAdminRoute = router.url.startsWith('/admin');
  if (!isAdminRoute) {
    return next(req);
  }

  // Only track API calls; ignore third-party URLs (e.g. weather) and
  // static assets so admin pages don't get stuck behind unrelated
  // long-running requests.
  const isApiRequest = req.url.startsWith('/api/');
  if (!isApiRequest || req.headers.has('x-skip-admin-loader')) {
    return next(req);
  }

  // Begin the loader for eligible admin API requests. `begin` may be a no-op
  // if multiple concurrent requests are already active; the pairing of
  // `begin`/`end` ensures the loader lifecycle is correctly managed.
  loader.begin();

  // Forward the request and ensure `loader.end()` is called regardless of
  // success or failure using `finalize` from RxJS.
  return next(req).pipe(
    finalize(() => {
      loader.end();
    })
  );
};
