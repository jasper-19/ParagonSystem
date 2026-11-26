import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Article } from '../../models/article.model';
import { SeoService, SEO_SITE_ORIGIN } from './seo.service';

describe('SEO across public navigation', () => {
  it('gives information pages their own metadata and keeps policy drafts out of search results', () => {
    const router = { url: '/our-story', events: new Subject() };
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: router },
      { provide: SEO_SITE_ORIGIN, useValue: 'https://news.example' },
    ] });
    const seo = TestBed.inject(SeoService);
    const pages = [
      ['/our-story', 'Our Story', false],
      ['/ethics-policy', 'Ethics Policy', true],
      ['/contact-us', 'Contact Us', false],
      ['/privacy-policy', 'Privacy Policy', true],
      ['/terms-of-service', 'Terms of Service', true],
    ] as const;

    for (const [path, title, draft] of pages) {
      router.url = path;
      seo.setRoute(path);
      expect(document.title).toContain(`${title} | Paragon`);
      expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'))
        .toBe(`https://news.example${path}`);
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content'))
        .toBe(draft ? 'noindex, follow' : 'index, follow, max-image-preview:large');
      expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
        .not.toBe('Campus news, stories and student publications from Paragon at Cagayan State University Gonzaga.');
      expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null)
        .toBe(draft ? null : `https://news.example${path}`);
    }
  });

  it('replaces article dates and structured data when a reader navigates to the issue library', () => {
    const router = { url: '/article/student-news', events: new Subject() };
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: router },
      { provide: SEO_SITE_ORIGIN, useValue: 'https://news.example' },
    ] });
    const seo = TestBed.inject(SeoService);
    seo.setArticle({ slug: 'student-news', title: 'Campus report', category: 'News', status: 'Published',
      seoDescription: 'Editor description', publishedAt: new Date('2026-11-20T04:00:00Z'), language: 'fil',
    } as Article);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Editor description');
    expect(document.documentElement.lang).toBe('fil');
    expect(document.head.querySelector('meta[property="article:published_time"]')).toBeTruthy();
    router.url = '/special-issues';
    seo.setRoute(router.url);
    expect(document.head.querySelector('meta[property="article:published_time"]')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://news.example/special-issues');
    expect(document.head.querySelector('script#paragon-seo')?.textContent).not.toContain('Campus report');
  });
});
