import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AllArticlesComponent } from './all-articles';
import { ArticleService, AdminArticleDetail, AdminArticlesParams, AdminArticlesResponse, AdminArticleSummary } from '../../../../../core/services/article.service';
import { ConfirmationService } from '../../../../../shared/components/confirmation-modal/confirmation.service';

describe('Admin article list interactions', () => {
  let fixture: ComponentFixture<AllArticlesComponent>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let requests: { params: AdminArticlesParams; result: Subject<AdminArticlesResponse> }[];
  let details: Subject<AdminArticleDetail>[];
  const article = { id: 'test-article', title: 'Test campus report', slug: 'test-campus-report', category: 'News', status: 'Draft', featured: false, views: 12, createdAt: new Date('2026-11-06') } as AdminArticleSummary;
  const response = (page = 1, limit = 10): AdminArticlesResponse => ({ items: [article], page, limit, total: 80, totalPages: 8 });

  beforeEach(() => {
    requests = []; details = []; params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({ imports: [AllArticlesComponent], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      { provide: ConfirmationService, useValue: { confirm: vi.fn(async () => false) } },
      { provide: ArticleService, useValue: {
        articlesChanged: signal(0),
        getAdminArticles: vi.fn((params: AdminArticlesParams) => { const result = new Subject<AdminArticlesResponse>(); requests.push({ params, result }); return result; }),
        getAdminArticleDetail: vi.fn(() => { const result = new Subject<AdminArticleDetail>(); details.push(result); return result; }),
        archiveArticle: vi.fn(() => of(undefined)), deleteArticle: vi.fn(() => of(undefined)),
      } },
    ] });
    fixture = TestBed.createComponent(AllArticlesComponent); fixture.detectChanges(); TestBed.tick();
  });
  afterEach(() => { fixture.destroy(); params.complete(); TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers(); });
  function finish(index = requests.length - 1) { const request = requests[index]; request.result.next(response(request.params.page, request.params.limit)); request.result.complete(); fixture.detectChanges(); }

  it('preserves debounced search, sort, page size and merged URL status filtering', async () => {
    finish();
    const component = fixture.componentInstance;
    vi.useFakeTimers();
    component.onSearch({ target: { value: '  campus  ' } } as unknown as Event);
    await vi.advanceTimersByTimeAsync(300); TestBed.tick();
    expect(requests.at(-1)!.params.search).toBe('campus'); finish();
    component.goToPage(3); TestBed.tick();
    expect(requests.at(-1)!.params.page).toBe(3); finish();
    component.onSortChange('mostViewed'); TestBed.tick();
    expect(requests.at(-1)!.params).toMatchObject({ page: 1, sort: 'mostViewed', search: 'campus' }); finish();
    component.onPageSizeChange(20); TestBed.tick();
    expect(requests.at(-1)!.params.limit).toBe(20); finish();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.setStatus('Published');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { status: 'Published' }, queryParamsHandling: 'merge' }));
    params.next(convertToParamMap({ status: 'Published' })); TestBed.tick();
    expect(requests.at(-1)!.params).toMatchObject({ page: 1, limit: 20, status: 'Published', search: 'campus', sort: 'mostViewed' });
  });

  it('offers retry after a list error with the same request parameters', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requests[0].result.error(new Error('Test offline')); fixture.detectChanges();
    expect(fixture.componentInstance.loadError()).toContain('Unable to load');
    const retry = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => /retry|try again/i.test(button.textContent ?? ''))!;
    expect(retry).toBeDefined(); retry.click();
    expect(requests[1].params).toEqual(requests[0].params);
    finish(); expect(fixture.componentInstance.loadError()).toBe('');
    expect(fixture.nativeElement.textContent).toContain(article.title);
  });

  it('does not reopen a dismissed preview when an older request completes', () => {
    finish(); const component = fixture.componentInstance;
    component.openArticle(article); component.closeArticleModal();
    component.openArticle({ ...article, id: 'second-article' });
    details[0].next({ ...article, excerpt: '', tags: [], credits: [] } as AdminArticleDetail);
    expect(component.selectedArticle()).toBeNull();
    expect(component.modalLoading()).toBe(true);
    details[1].next({ ...article, id: 'second-article', excerpt: '', tags: [], credits: [] } as AdminArticleDetail);
    expect(component.selectedArticle()!.id).toBe('second-article');
  });

  it('does not open the row preview when keyboard events come from action controls', () => {
    finish(); const open = vi.spyOn(fixture.componentInstance, 'openArticle');
    const controls = fixture.nativeElement.querySelectorAll('tr button, tr a, article button, article a') as NodeListOf<HTMLElement>;
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach(control => ['Enter', ' '].forEach(key => control.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))));
    expect(open).not.toHaveBeenCalled();
  });
});
