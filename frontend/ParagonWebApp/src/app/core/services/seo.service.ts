import { DOCUMENT, DestroyRef, Injectable, InjectionToken, RESPONSE_INIT, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Article } from '../../models/article.model';
import { SpecialIssue } from '../../models/special-issue.model';

export const SITE_NAME = 'Paragon - Cagayan State University Gonzaga';
export const SEO_SITE_ORIGIN = new InjectionToken<string>('SEO_SITE_ORIGIN', {
  providedIn: 'root', factory: () => {
    const origin = inject(DOCUMENT).head.querySelector<HTMLMetaElement>('meta[name="paragon-site-origin"]')?.content;
    return origin && /^https:\/\/[\w.-]+(?::\d+)?$/.test(origin) ? origin : 'https://paragon-system-gvlg.vercel.app';
  },
});
const DESCRIPTION = 'Campus news, stories and student publications from Paragon at Cagayan State University Gonzaga.';
const FALLBACK_IMAGE = '/assets/paragon-social-preview.jpg';
const PAGES: Record<string, { title: string; description: string }> = {
  '/': { title: SITE_NAME, description: DESCRIPTION },
  '/top-stories': { title: 'Latest stories', description: 'Read the latest campus news, features, editorials, sports and literary works from CSU Gonzaga.' },
  '/special-issues': { title: 'Special issues', description: 'Explore Paragon tabloids, newsletters and literary folios from Cagayan State University Gonzaga.' },
  '/editorial-board': { title: 'Editorial board', description: 'Meet the student journalists and editorial board behind Paragon at CSU Gonzaga.' },
  '/join': { title: 'Join Paragon', description: 'Discover opportunities to join the Paragon student publication at Cagayan State University Gonzaga.' },
};
interface PageMetadata {
  title: string;
  description: string;
  image?: string;
  language?: string | null;
  article?: Article;
  noindex?: boolean;
}

/** One owner for route metadata in both SSR and browser navigation. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly response = inject(RESPONSE_INIT, { optional: true });
  readonly origin = new URL(inject(SEO_SITE_ORIGIN)).origin;
  private filtered = false;
  private detail?: { path: string; metadata: PageMetadata };

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) this.setRoute(event.urlAfterRedirects);
    });
  }

  setRoute(url: string): void {
    const parsed = new URL(url, this.origin);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (this.detail?.path !== path) this.detail = undefined;
    const page: PageMetadata | undefined = this.detail?.metadata ?? PAGES[path];
    this.filtered = [...parsed.searchParams.keys()].some(key => !/^(utm_.+|fbclid|gclid)$/i.test(key));
    this.render(path, page ? { ...page, noindex: page.noindex || this.filtered } : {
      title: path.startsWith('/admin') ? 'Administration' : 'Page unavailable',
      description: DESCRIPTION, noindex: true,
    });
  }

  setArticle(article: Article): void {
    const path = `/article/${article.slug}`;
    const metadata: PageMetadata = {
      title: article.title,
      description: this.text(article.seoDescription || article.excerpt || article.content, 300),
      image: article.socialImage || article.image, language: article.language, article,
      noindex: article.status !== 'Published',
    };
    this.detail = { path, metadata };
    this.render(path, { ...metadata, noindex: metadata.noindex || this.filtered });
  }

  setIssue(issue: SpecialIssue): void {
    const path = `/special-issues/${issue.slug}`;
    const metadata: PageMetadata = { title: issue.title,
      description: this.text(issue.description || `${issue.type}, ${issue.academicYear}. Read this special issue from ${SITE_NAME}.`, 300),
      image: issue.coverImage, language: 'mul', noindex: issue.status !== 'published' };
    this.detail = { path, metadata };
    this.render(path, { ...metadata, noindex: metadata.noindex || this.filtered });
  }

  setUnavailable(path: string, status: number): void {
    const metadata = { title: status === 404 ? 'Page not found' : 'Page temporarily unavailable', description: DESCRIPTION, noindex: true };
    this.detail = { path, metadata };
    this.render(path, { ...metadata, noindex: metadata.noindex || this.filtered });
    if (this.response) this.response.status = status === 404 ? 404 : 503;
  }

  private render(path: string, page: PageMetadata): void {
    const current = new URL(this.router.url, this.origin);
    if (current.pathname === path && [...current.searchParams.keys()].some(key => !/^(utm_.+|fbclid|gclid)$/i.test(key))) {
      page = { ...page, noindex: true };
    }
    const canonical = new URL(path, this.origin).href;
    const image = this.imageUrl(page.image);
    const title = page.title === SITE_NAME ? SITE_NAME : `${page.title} | ${SITE_NAME}`;
    // Remove server metadata too, so stale article dates/images never survive a route change.
    this.document.head.querySelectorAll('meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[property^="article:"], meta[name^="twitter:"], link[rel="canonical"], script[data-paragon-seo], script#paragon-seo').forEach(node => node.remove());
    this.meta.updateTag({name: 'paragon-site-origin', content: this.origin});
    this.title.setTitle(title);
    this.document.documentElement.lang = page.language === 'fil' ? 'fil' : 'en';
    this.meta.addTags([
      { name: 'description', content: page.description },
      { name: 'robots', content: page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large' },
      { property: 'og:type', content: page.article ? 'article' : 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: page.title },
      { property: 'og:description', content: page.description },
      { property: 'og:url', content: canonical },
      { property: 'og:image', content: image },
      { property: 'og:image:secure_url', content: image },
      { property: 'og:image:alt', content: page.title },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: page.title },
      { name: 'twitter:description', content: page.description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: page.title },
    ]);
    if (image === new URL(FALLBACK_IMAGE, this.origin).href) {
      this.meta.addTags([{ property: 'og:image:width', content: '1424' }, { property: 'og:image:height', content: '752' }, { property: 'og:image:type', content: 'image/jpeg' }]);
    }
    const a = page.article;
    if (a?.socialImage && image === a.socialImage && a.imageWidth && a.imageHeight &&
        Number.isInteger(a.imageWidth) && Number.isInteger(a.imageHeight) &&
        a.imageWidth > 0 && a.imageHeight > 0 && a.imageWidth * a.imageHeight <= 40_000_000 &&
        ['image/jpeg','image/png','image/webp','image/gif'].includes(a.imageType || '')) {
      this.meta.addTags([{ property: 'og:image:width', content: String(a.imageWidth) }, { property: 'og:image:height', content: String(a.imageHeight) }, { property: 'og:image:type', content: a.imageType! }]);
    }
    if (!page.noindex) {
      const link = this.document.createElement('link');
      link.rel = 'canonical'; link.href = canonical; this.document.head.appendChild(link);
    }
    const published = this.date(page.article?.publishedAt);
    const modified = this.date(page.article?.modifiedAt);
    if (published) this.meta.addTag({ property: 'article:published_time', content: published });
    if (modified) this.meta.addTag({ property: 'article:modified_time', content: modified });
    if (page.noindex) return;
    const publisher = { '@type': 'Organization', '@id': `${this.origin}/#organization`, name: SITE_NAME, url: `${this.origin}/` };
    const graph: object[] = [publisher, { '@type': 'WebSite', '@id': `${this.origin}/#website`, name: SITE_NAME, url: `${this.origin}/`, publisher: { '@id': publisher['@id'] } }];
    if (page.article) {
      const authors = page.article.credits?.filter(credit => credit.creditType === 'author').map(credit => credit.creditedName).filter(Boolean);
      graph.push({ '@type': page.article.category === 'News' ? 'NewsArticle' : 'Article',
        '@id': `${canonical}#article`, mainEntityOfPage: canonical, headline: page.article.title,
        description: page.description, image: [image],
        ...(published ? { datePublished: published } : {}), ...(modified ? { dateModified: modified } : {}),
        ...(page.language === 'en' || page.language === 'fil' ? { inLanguage: page.language } : { inLanguage: ['en', 'fil'] }),
        author: (authors?.length ? authors : page.article.author ? [page.article.author] : []).map(name => ({ '@type': 'Person', name })),
        publisher: { '@id': publisher['@id'] },
      });
    }
    if (path !== '/') graph.push({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${this.origin}/` },
      { '@type': 'ListItem', position: 2, name: page.title, item: canonical },
    ] });
    const script = this.document.createElement('script');
    script.type = 'application/ld+json'; script.id = 'paragon-seo';
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }

  private text(value: string, limit: number): string {
    return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim().slice(0, limit) || DESCRIPTION;
  }

  private imageUrl(value?: string): string {
    try {
      const url = new URL(value || FALLBACK_IMAGE, this.origin);
      const host = url.hostname.toLowerCase();
      const privateHost = !host.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
        || host.startsWith('[') || host.endsWith('.local') || host.endsWith('.internal');
      if (url.protocol === 'https:' && !url.username && !url.password && !privateHost) return url.href;
    } catch { /* Use the publication image for malformed URLs. */ }
    return new URL(FALLBACK_IMAGE, this.origin).href;
  }

  private date(value?: Date | null): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}
