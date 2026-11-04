import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ArticleService } from '../../../core/services/article.service';
import { Article } from '../../../models/article.model';
import { SearchModal } from './search-modal';

describe('Search modal recovery and request ordering', () => {
  let modal: SearchModal;
  const searchArticles = vi.fn();
  const getArticles = vi.fn();
  const getSearchFeed = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    searchArticles.mockReset().mockReturnValue(of([]));
    getArticles.mockReset().mockReturnValue(of([]));
    getSearchFeed.mockReset().mockReturnValue(of({ recent: [], categories: [] }));
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ArticleService, useValue: {
        searchFeed: signal(null), articlesChanged: signal(0), searchArticles, getArticles, getSearchFeed,
      } },
    ] });
    modal = TestBed.runInInjectionContext(() => new SearchModal());
  });

  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('runs a repeated query after clearing it before the debounce expires', () => {
    modal.onSearchChange('campus');
    vi.advanceTimersByTime(300);
    modal.clearSearch();
    modal.onSearchChange('campus');
    vi.advanceTimersByTime(300);
    expect(searchArticles).toHaveBeenCalledTimes(2);
    expect(modal.isLoading).toBe(false);
    expect(modal.hasSearched).toBe(true);
  });

  it('keeps a late text response from replacing a newly selected category', () => {
    const pending = new Subject<Article[]>();
    searchArticles.mockReturnValue(pending);
    modal.onSearchChange('campus');
    vi.advanceTimersByTime(300);
    modal.selectCategory('Sports');
    pending.next([{ title: 'Old search result' } as Article]);
    expect(modal.results).toEqual([]);
    expect(modal.selectedCategory).toBe('Sports');
    expect(modal.isLoading).toBe(false);
  });

  it('distinguishes request failure from empty results and retries the same query', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    searchArticles.mockReturnValueOnce(throwError(() => new Error('Offline')));
    modal.onSearchChange('campus');
    vi.advanceTimersByTime(300);
    expect(modal.searchError).toBe(true);
    expect(modal.isLoading).toBe(false);
    modal.retrySearch();
    expect(searchArticles.mock.calls.map(([query]) => query)).toEqual(['campus', 'campus']);
    expect(modal.searchError).toBe(false);
  });

  it('allows browsing to recover independently of text search', () => {
    getSearchFeed.mockReturnValueOnce(throwError(() => new Error('Offline')));
    modal.ngOnInit();
    expect(modal.feedError).toBe(true);
    expect(modal.isFeedLoading).toBe(false);
    modal.loadBrowseFeed();
    expect(modal.feedError).toBe(false);
    expect(getSearchFeed).toHaveBeenCalledTimes(2);
  });
});
