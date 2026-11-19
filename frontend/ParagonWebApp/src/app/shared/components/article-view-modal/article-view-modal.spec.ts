import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ArticleViewModal } from './article-view-modal';
import { AdminArticleDetail } from '../../../core/services/article.service';

describe('Admin article preview accessibility', () => {
  let fixture: ComponentFixture<ArticleViewModal>;
  let trigger: HTMLButtonElement;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ArticleViewModal] });
    trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus();
    fixture = TestBed.createComponent(ArticleViewModal); fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); trigger.remove(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });
  function dialog(): HTMLElement { return fixture.nativeElement.querySelector('[role="dialog"]'); }
  function expectNamedDialog() {
    const label = fixture.nativeElement.querySelector(`#${dialog().getAttribute('aria-labelledby')}`);
    expect(label?.textContent?.trim()).toBeTruthy();
  }

  it('names the loading dialog and permits closing while the request is pending', async () => {
    fixture.componentRef.setInput('loading', true); fixture.detectChanges();
    expectNamedDialog(); expect(dialog().textContent).toMatch(/loading article/i);
    const close = vi.fn(); fixture.componentInstance.close.subscribe(close);
    const button = dialog().querySelector('button')!;
    expect(button).not.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(button);
    button.click(); expect(close).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('loading', false); fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('names and announces an error, retaining Escape dismissal', () => {
    fixture.componentRef.setInput('errorMessage', 'Test request failed.'); fixture.detectChanges();
    expectNamedDialog();
    expect(dialog().textContent).toContain('Test request failed.');
    expect(dialog().querySelector('[role="alert"]')).not.toBeNull();
    const close = vi.fn(); fixture.componentInstance.close.subscribe(close);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('displays external photo credits with null staff references as plain text', () => {
    const name = 'Agency, Inc. <img src=x onerror=alert(1)>';
    fixture.componentRef.setInput('article', {
      id: 'external', title: 'External photos', status: 'Draft', featured: false,
      views: 0, excerpt: '', category: 'News', tags: [], createdAt: new Date(),
      credits: [{ id: 'outside', articleId: 'external', staffId: null,
        creditedName: name, creditType: 'photo', createdAt: new Date() }],
    } satisfies AdminArticleDetail);
    fixture.detectChanges();
    expect(dialog().textContent).toContain(name);
    expect(dialog().querySelector('img[src="x"]')).toBeNull();
  });

  it('retains the article metadata and all four structured credit groups', () => {
    const article = {
      id: 'article-test', title: 'Campus test report', status: 'Published', featured: true,
      views: 42, excerpt: 'A test article overview.', category: 'News', tags: ['student-life'],
      createdAt: new Date('2026-11-05T01:00:00Z'), publishedAt: new Date('2026-11-06T01:00:00Z'),
      credits: (['author', 'photo', 'graphic', 'illustration'] as const).map((creditType, index) => ({
        id: `credit-${index}`, articleId: 'article-test', staffId: `staff-${index}`,
        creditedName: `Test ${creditType} contributor`, creditType, createdAt: new Date('2026-11-05'),
      })),
    } as AdminArticleDetail;
    fixture.componentRef.setInput('article', article); fixture.detectChanges();
    expectNamedDialog();
    const text = dialog().textContent!;
    [article.title, article.excerpt, 'Published', '42', 'News', 'Student Life', ...article.credits.map(credit => credit.creditedName)].forEach(value => expect(text).toContain(value));
    expect(dialog().querySelector('[aria-label="Close article details"]')).not.toBeNull();
  });
});
