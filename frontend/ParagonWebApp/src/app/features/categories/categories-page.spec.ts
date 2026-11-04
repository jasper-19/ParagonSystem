import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CategoriesPage } from './categories-page';
import { ArticleService } from '../../core/services/article.service';
import { LoaderService } from '../../shared/services/loader.service';

describe('Top-stories filter recovery', () => {
  const queryParams = new BehaviorSubject(convertToParamMap({ sort: 'mostViewed', category: 'News' }));
  let page: CategoriesPage;
  const navigate = vi.fn().mockResolvedValue(true);
  const loadCategoryFeed = vi.fn();

  beforeEach(() => {
    queryParams.next(convertToParamMap({ sort: 'mostViewed', category: 'News' }));
    navigate.mockClear();
    loadCategoryFeed.mockReset().mockReturnValue(of({ articles: [], categories: [], tags: [], hasMore: false }));
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { queryParamMap: queryParams } },
      { provide: Router, useValue: { navigate } },
      { provide: ArticleService, useValue: {
        categoryFeed: signal(null), categoryArticles: signal([]), articlesChanged: signal(0), loadCategoryFeed,
      } },
      { provide: LoaderService, useValue: { hide: vi.fn() } },
    ] });
    page = TestBed.runInInjectionContext(() => new CategoriesPage());
  });

  afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

  it('honors the homepage popular-story link and safely rejects invalid sort parameters', () => {
    expect(page.sort()).toBe('mostViewed');
    expect(page.selectedCategory()).toBe('News');
    queryParams.next(convertToParamMap({ sort: 'invalid' }));
    expect(page.sort()).toBe('latest');
    expect(page.selectedCategory()).toBeUndefined();
  });

  it('clears pending search text and allows repeating a previous search after clearing', () => {
    vi.useFakeTimers();
    page.onSearchInput('campus');
    page.clearFilters();
    vi.advanceTimersByTime(400);
    expect(page.search()).toBe('');
    expect(page.searchQuery()).toBe('');
    page.onSearchInput('campus');
    vi.advanceTimersByTime(400);
    expect(page.search()).toBe('campus');
    page.clearFilters();
    page.onSearchInput('campus');
    vi.advanceTimersByTime(400);
    expect(page.search()).toBe('campus');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { category: null, sort: null } }));
  });

  it('exposes a failed request and retries the same page without advancing pagination', () => {
    loadCategoryFeed.mockReturnValueOnce(throwError(() => new Error('Offline')));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    page.onLoadMore();
    expect(page.loadError()).toContain('try again');
    expect(page.currentPage()).toBe(1);
    page.retryLoad();
    expect(loadCategoryFeed.mock.calls.map(([params]) => params.page)).toEqual([1, 1]);
    expect(page.loadError()).toBeNull();
    expect(page.currentPage()).toBe(2);
    errorLog.mockRestore();
  });
});
