import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ArticlePage } from './article';
import { ArticleService } from '../../core/services/article.service';
import { ArticleFeed } from '../../models/article-feed.model';

describe('Article reading states', () => {
  let fixture: ComponentFixture<ArticlePage>;
  const params = convertToParamMap({ slug: 'reading-example' });
  const feed = signal<ArticleFeed | null>(null);
  const error = signal<string | null>(null);
  const load = vi.fn();
  const example: ArticleFeed = {
    article: {
      id: 'reading-id', title: 'A reading example', slug: 'reading-example', excerpt: 'Article introduction.',
      content: '<h2>A section heading</h2><p>The full story with <strong>emphasis</strong>.</p><ul><li>A preserved list item</li></ul>',
      image: '', author: 'Campus Writer', photoby: 'Photo Contributor', graphicby: '', illusrationby: '',
      category: 'News', tags: ['campus'], status: 'Published', featured: false, views: 42,
      createdAt: new Date('2026-07-12'), publishedAt: new Date('2026-07-12'),
    }, related: [], otherStories: [],
  };

  beforeEach(async () => {
    feed.set(example); error.set(null); load.mockClear();
    await TestBed.configureTestingModule({ imports: [ArticlePage], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(params), snapshot: { paramMap: params } } },
      { provide: ArticleService, useValue: {
        articleFeed: feed.asReadonly(), articleFeedError: error.asReadonly(), slugChanged: signal(null),
        loadArticleFeed: load, incrementViews: vi.fn().mockReturnValue(of(null)), clearSlugChanged: vi.fn(),
      } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(ArticlePage);
    await fixture.whenStable();
  });

  it('preserves rich story content, credits, metadata and navigation without an empty cover tile', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toContain(example.article.title);
    expect(host.querySelector('.article-copy strong')?.textContent).toBe('emphasis');
    expect(host.querySelector('.article-copy li')?.textContent).toBe('A preserved list item');
    expect(host.textContent).toContain('Photo Contributor');
    expect(host.textContent).toContain('42 views');
    expect(host.querySelector('.article-cover')).toBeNull();
    expect(host.querySelector('a[href="/top-stories?category=News"]')).not.toBeNull();
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain('/assets/paragon-social-preview.jpg');
  });

  it('removes the previous story while another article loads', async () => {
    feed.set(null);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-article-skeleton')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('A reading example');
  });

  it('offers retry and an archive link instead of an endless skeleton after a failed request', async () => {
    feed.set(null); error.set('The article could not be loaded. Check your connection and try again.');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('try again');
    expect(fixture.nativeElement.querySelector('app-article-skeleton')).toBeNull();
    fixture.nativeElement.querySelector('.article-error button').click();
    expect(load).toHaveBeenLastCalledWith('reading-example');
    expect(fixture.nativeElement.querySelector('.article-error a')?.getAttribute('href')).toBe('/top-stories');
  });
});
