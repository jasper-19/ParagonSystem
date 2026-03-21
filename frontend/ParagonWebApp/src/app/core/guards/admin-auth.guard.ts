// admin-auth.guard.ts (new)
import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

export const adminAuthGuard: CanMatchFn = (_route, segments): boolean | UrlTree => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  if (auth.isAdminSession()) return true;

  const attemptedUrl = '/' + segments.map(s => s.path).join('/');
  return router.createUrlTree(['/admin/login'], {
    queryParams: { returnUrl: attemptedUrl }
  });
};

export const adminLoginRedirectGuard: CanMatchFn = (): boolean | UrlTree => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  // If already logged in, keep them out of /admin/login
  if (auth.isAdminSession()) return router.createUrlTree(['/admin']);
  return true;
};
