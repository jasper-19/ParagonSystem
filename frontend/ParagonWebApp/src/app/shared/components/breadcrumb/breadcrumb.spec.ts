import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Route, Router, RouterOutlet, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../../app.routes';
import { Breadcrumbs } from './breadcrumb';

@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
class EmptyPage {}

@Component({
  standalone: true,
  imports: [Breadcrumbs, RouterOutlet],
  template: '<app-breadcrumb /><router-outlet /><router-outlet name="aside" />',
})
class AdminTestShell {}

// Retain the application's route paths and breadcrumb data. Only remove page/guard
// dependencies so navigation exercises the real metadata without auth or HTTP.
function isolatedRoutes(source: Routes): Routes {
  return source.map(route => {
    const { component, loadComponent, canMatch, canActivate, canActivateChild, resolve, children, ...rest } = route;
    const isolated: Route = { ...rest };
    if (component || loadComponent) isolated.component = route.path === 'admin' ? AdminTestShell : EmptyPage;
    if (children) isolated.children = isolatedRoutes(children);
    return isolated;
  });
}

describe('Admin breadcrumb route integration', () => {
  let harness: RouterTestingHarness;

  async function start(url: string, extraChildren: Routes = []): Promise<void> {
    const testRoutes = isolatedRoutes(routes);
    testRoutes.find(route => route.path === 'admin')!.children!.unshift(...extraChildren);
    await TestBed.configureTestingModule({
      providers: [provideRouter(testRoutes), provideLocationMocks()],
    }).compileComponents();
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
  }

  function labels(): string[] {
    const nav = harness.fixture.nativeElement.querySelector('nav[aria-label="Breadcrumb"]') as HTMLElement;
    return Array.from(nav.querySelectorAll('a, [aria-current="page"]'), element => element.textContent!.trim());
  }

  function links(): [string, string | null][] {
    return Array.from(harness.fixture.nativeElement.querySelectorAll('nav[aria-label="Breadcrumb"] a') as NodeListOf<HTMLAnchorElement>,
      element => [element.textContent!.trim(), element.getAttribute('href')]);
  }

  afterEach(() => TestBed.resetTestingModule());

  it.each([
    ['/admin', ['Admin', 'Dashboard']],
    ['/admin/all-articles', ['Admin', 'All Articles']],
    ['/admin/create-article', ['Admin', 'All Articles', 'Create Article']],
    ['/admin/edit-article/a-campus-story', ['Admin', 'All Articles', 'Edit Article']],
    ['/admin/create-special-issue', ['Admin', 'Special Issues', 'Create Special Issue']],
    ['/admin/edit-special-issue/anniversary-edition', ['Admin', 'Special Issues', 'Edit Special Issue']],
    ['/admin/profile', ['Admin', 'Profile']],
    ['/admin/public-board-preview', ['Admin', 'Public Board Preview']],
  ] as const)('renders the complete initial trail at %s', async (url, expected) => {
    await start(url);
    expect(labels()).toEqual(expected);
    const current = harness.fixture.nativeElement.querySelector('[aria-current="page"]') as HTMLElement;
    expect(current.tagName).not.toBe('A');
    expect(current.closest('a')).toBeNull();
    expect(harness.fixture.nativeElement.querySelectorAll('[aria-current="page"]').length).toBe(1);
  });

  it('updates after navigation while reusing the existing admin shell and breadcrumb', async () => {
    await start('/admin/all-articles');
    const original = harness.fixture.nativeElement.querySelector('app-breadcrumb');
    await harness.navigateByUrl('/admin/create-article');
    expect(harness.fixture.nativeElement.querySelector('app-breadcrumb')).toBe(original);
    expect(labels()).toEqual(['Admin', 'All Articles', 'Create Article']);
    await harness.navigateByUrl('/admin/edit-article/another-story');
    expect(labels()).toEqual(['Admin', 'All Articles', 'Edit Article']);
    await harness.navigateByUrl('/admin/media-library');
    expect(labels()).toEqual(['Admin', 'Media Library']);
  });

  it('links logical ancestors to real list routes and navigates through the parent link', async () => {
    await start('/admin/create-article?draft=1#editor');
    expect(links()).toEqual([['Admin', '/admin'], ['All Articles', '/admin/all-articles']]);
    const navigated = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof NavigationEnd)));
    (harness.fixture.nativeElement.querySelector('a[href="/admin/all-articles"]') as HTMLAnchorElement).click();
    await navigated;
    harness.detectChanges();
    expect(labels()).toEqual(['Admin', 'All Articles']);
    expect(TestBed.inject(Router).url).toBe('/admin/all-articles');
    await harness.navigateByUrl('/admin/edit-special-issue/issue-one');
    expect(links()).toEqual([['Admin', '/admin'], ['Special Issues', '/admin/all-special-issues']]);
  });

  it.each([
    ['general', 'General'],
    ['publishing-media', 'Publishing & Media'],
    ['notifications', 'Notifications'],
    ['maintenance', 'Maintenance'],
    ['users', 'User Accounts'],
    ['unrecognized', 'General'],
  ])('matches the active Settings tab for %s', async (tab, label) => {
    await start(`/admin/settings/${tab}`);
    expect(labels()).toEqual(['Admin', 'Settings', label]);
    expect(links()).toEqual([['Admin', '/admin'], ['Settings', '/admin/settings']]);
  });

  it('keeps the Settings landing page trail concise and updates on same-route tab changes', async () => {
    await start('/admin/settings');
    expect(labels()).toEqual(['Admin', 'Settings']);
    await harness.navigateByUrl('/admin/settings/users');
    expect(labels()).toEqual(['Admin', 'Settings', 'User Accounts']);
    await harness.navigateByUrl('/admin/settings/maintenance');
    expect(labels()).toEqual(['Admin', 'Settings', 'Maintenance']);
  });

  it('walks unlabeled primary route levels without duplicating inherited labels', async () => {
    await start('/admin/nested/wrapper/leaf', [{
      path: 'nested', data: { breadcrumb: 'Nested' }, children: [{
        path: 'wrapper', children: [{ path: 'leaf', component: EmptyPage, data: { breadcrumb: 'Leaf' } }],
      }],
    }]);
    expect(labels()).toEqual(['Admin', 'Nested', 'Leaf']);
    expect(links()).toEqual([['Admin', '/admin'], ['Nested', '/admin/nested']]);
  });

  it('does not append auxiliary outlet content to the primary page trail', async () => {
    await start('/admin/(all-articles//aside:notes)', [{
      path: 'notes', outlet: 'aside', component: EmptyPage, data: { breadcrumb: 'Notes' },
    }]);
    expect(labels()).toEqual(['Admin', 'All Articles']);
  });

  it('preserves route context across query, fragment, back and forward navigation', async () => {
    await start('/admin/all-articles');
    await harness.navigateByUrl('/admin/create-article?draft=1#editor');
    await harness.navigateByUrl('/admin/create-article?draft=2#details');
    expect(labels()).toEqual(['Admin', 'All Articles', 'Create Article']);
    expect(links()).toEqual([['Admin', '/admin'], ['All Articles', '/admin/all-articles']]);
    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);
    // The harness navigates imperatively without the application's bootstrap
    // listener. Register location changes after navigation has already started.
    router.initialNavigation();
    let navigated = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd)));
    location.back();
    await navigated;
    harness.detectChanges();
    expect(router.url).toBe('/admin/create-article?draft=1#editor');
    expect(labels()).toEqual(['Admin', 'All Articles', 'Create Article']);
    navigated = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd)));
    location.forward();
    await navigated;
    harness.detectChanges();
    expect(router.url).toBe('/admin/create-article?draft=2#details');
    expect(labels()).toEqual(['Admin', 'All Articles', 'Create Article']);
  });
});
