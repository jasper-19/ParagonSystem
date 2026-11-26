import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors, HttpInterceptorFn } from '@angular/common/http';
const { env } = (globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }).process;
import { timeout } from 'rxjs';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SEO_SITE_ORIGIN } from './core/services/seo.service';
import { API_ENDPOINTS } from './core/config/api.config';

// Never forward visitor credentials to the API during public rendering.
const publicServerRequests: HttpInterceptorFn = (request, next) => {
  let url = request.url;
  if (url === API_ENDPOINTS.base || url.startsWith(API_ENDPOINTS.base + '/')) {
    const configured = env['PUBLIC_API_BASE_URL'] || API_ENDPOINTS.base;
    const target = new URL(configured);
    if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) {
      throw new Error('Invalid public API configuration');
    }
    url = configured.replace(/\/$/, '') + url.slice(API_ENDPOINTS.base.length);
  }
  return next(request.clone({ url, withCredentials: false,
    headers: request.headers.delete('Authorization').delete('Cookie'),
  })).pipe(timeout(8000));
};
const serverConfig: ApplicationConfig = {
  providers: [{ provide: SEO_SITE_ORIGIN, useFactory: () => new URL(env['PUBLIC_SITE_URL'] || 'https://paragon-system-gvlg.vercel.app').origin }, provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withFetch(), withInterceptors([publicServerRequests]))],
};
export const config = mergeApplicationConfig(appConfig, serverConfig);
