// admin-auth.guard.ts (new)
// ===== Admin Route Guards =====
// Lightweight, injectable route match guards for admin area.

import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

// ===== Guard: Protect admin routes =====
export const adminAuthGuard: CanMatchFn = (_route, segments): boolean | UrlTree => {
  // Obtain the auth service and router via Angular's functional `inject` helper.
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  // If there's an active admin session allow the route to match.
  if (auth.isAdminSession()) return true;

  // Build the attempted URL from the segments so we can redirect back
  // after a successful login. This reproduces the original path.
  const attemptedUrl = '/' + segments.map(s => s.path).join('/');

  // Redirect to the admin login page and include the original URL
  // as a `returnUrl` query param so the user can be returned after login.
  return router.createUrlTree(['/admin/login'], {
    queryParams: { returnUrl: attemptedUrl }
  });
};

// ===== Guard: Prevent access to /admin/login when already logged in =====
export const adminLoginRedirectGuard: CanMatchFn = (): boolean | UrlTree => {
  // Obtain the auth service and router via Angular's functional `inject` helper.
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  // If already logged in, keep them out of /admin/login by redirecting
  // to the admin root. Otherwise allow the route.
  // If logged in, produce the same UrlTree as the original single-line
  // return to avoid changing behavior.
  if (auth.isAdminSession()) return router.createUrlTree(['/admin']);

  return true;
};
