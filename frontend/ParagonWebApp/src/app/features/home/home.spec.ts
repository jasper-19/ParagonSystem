import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { Home } from './home';
import { ArticleService } from '../../core/services/article.service';

describe('Home loading lifecycle', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps loading until the feed resolves and cancels pending work on navigation away', () => {
    const request = new Subject<unknown>();
    const getHomepageFeed = vi.fn(() => request);
    TestBed.configureTestingModule({ providers: [
      { provide: ArticleService, useValue: { homepageFeed: signal(null), getHomepageFeed } },
    ] });
    const page = TestBed.runInInjectionContext(() => new Home());
    page.ngOnInit();
    expect(page.loading()).toBe(true);
    expect(request.observed).toBe(true);
    TestBed.resetTestingModule();
    expect(request.observed).toBe(false);
    expect(page.loading()).toBe(false);
  });

  it('settles loading after either a successful or failed feed request', () => {
    const request = new Subject<unknown>();
    TestBed.configureTestingModule({ providers: [
      { provide: ArticleService, useValue: { homepageFeed: signal(null), getHomepageFeed: () => request } },
    ] });
    const page = TestBed.runInInjectionContext(() => new Home());
    page.ngOnInit();
    request.next({});
    expect(page.loading()).toBe(false);
    page.ngOnInit();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    request.error(new Error('Offline'));
    expect(page.loading()).toBe(false);
    log.mockRestore();
  });
});
