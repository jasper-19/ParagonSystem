import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { adminLoaderInterceptor } from './core/interceptors/admin-loader.interceptor';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withHttpTransferCacheOptions({
      filter: request => request.method === 'GET' && !/\/(auth|admin)(\/|$)/.test(request.url),
    })),
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor, adminLoaderInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled'
      })
    )
  ]
};
