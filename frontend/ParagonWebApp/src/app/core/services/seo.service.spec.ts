import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Article } from '../../models/article.model';
import { SeoService, SEO_SITE_ORIGIN } from './seo.service';

describe('SEO across public navigation', () => {
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
