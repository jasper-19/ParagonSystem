import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { GlobalSettingsService } from '../../../core/services/global-settings.service';
import { ErrorPage } from './error-page';
import { ErrorRoute } from './error-route';
import { getErrorStatus } from './error-status';

describe('Publication error pages', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [ErrorPage],
    providers: [
      provideRouter([
        { path: 'error/:status', component: ErrorRoute },
        { path: '**', component: ErrorRoute, data: { status: 404 } },
      ]),
      { provide: GlobalSettingsService, useValue: { publicSettings: signal(null) } },
    ],
  }));

  it('provides safe copy for every client and server status', () => {
    for (let code = 400; code <= 599; code++) {
      const error = getErrorStatus(code);
      expect(error.code).toBe(String(code));
      expect(error.title).toBeTruthy();
      expect(error.message).toBeTruthy();
    }
  });

  it('distinguishes connectivity failures from malformed or missing statuses', () => {
    for (const value of [0, '0', 'offline']) expect(getErrorStatus(value).code).toBe('OFFLINE');
    for (const value of [null, undefined, '', 'ERROR', '<script>', '404oops', 399, 600, 404.5, NaN, Infinity]) {
      expect(getErrorStatus(value).code).toBe('ERROR');
    }
  });

  it('updates copy and recovery actions when the status changes', async () => {
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.componentRef.setInput('status', 401);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.primary').getAttribute('href')).toBe('/admin/login');
    fixture.componentRef.setInput('status', 404);
    fixture.componentRef.setInput('embedded', true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('missed the edition');
    expect(fixture.nativeElement.querySelector('.masthead')).toBeNull();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    fixture.componentRef.setInput('status', 503);
    await fixture.whenStable();
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    fixture.nativeElement.querySelector('button').click();
    expect(retries).toBe(1);
  });

  it('renders unknown routes as 404 and handles reused status routes without a retry loop', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/missing-story', ErrorRoute);
    expect(harness.routeNativeElement?.textContent).toContain('404');
    await harness.navigateByUrl('/error/401', ErrorRoute);
    expect(harness.routeNativeElement?.querySelector('.primary')?.getAttribute('href')).toBe('/admin/login');
    await harness.navigateByUrl('/error/503', ErrorRoute);
    expect(harness.routeNativeElement?.textContent).toContain('503');
    expect(harness.routeNativeElement?.querySelector('button')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('.primary')?.getAttribute('href')).toBe('/');
  });
});
