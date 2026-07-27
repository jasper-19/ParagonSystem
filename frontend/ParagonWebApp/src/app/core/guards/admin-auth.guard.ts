// admin-auth.guard.ts (new)
// ===== Admin Route Guards =====
// Lightweight, injectable route match guards for admin area.

import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';

export const adminAuthGuard: CanMatchFn = (
  _route,
  segments
): Observable<boolean | UrlTree> => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  const attemptedUrl = '/' + segments.map(s => s.path).join('/');

  return auth.me().pipe(
    map(response =>
      response.user?.role === 'admin'
        ? true
        : router.createUrlTree(['/admin/login'], {
            queryParams: { returnUrl: attemptedUrl },
          })
    ),
    catchError(() =>
      of(
        router.createUrlTree(['/admin/login'], {
          queryParams: { returnUrl: attemptedUrl },
        })
      )
    )
  );
};
