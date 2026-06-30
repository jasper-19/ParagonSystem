/*
  ArticleService
  - Purpose: encapsulate API interactions for articles (admin and public).
  - Notes: only formatting, spacing, and explanatory comments were added.
*/

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { Article, ArticleCategory, CreateArticleDto } from '../../models/article.model';
import { GetArticlesParams } from '../../models/article-query.model';

// API endpoints are defined in a central config for maintainability and environment-based switching
import { API_ENDPOINTS } from '../config/api.config';

// API representation where date fields may be strings (or Date objects)
type ApiArticle = Omit<Article, 'createdAt' | 'publishedAt'> & {
  createdAt?: string | Date;
  publishedAt?: string | Date | null;
};

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private api = API_ENDPOINTS.articles;
  private featuredCache$?: Observable<Article[]>;
  private categoriesCache$?: Observable<string[]>;
  private tagsCache$?: Observable<string[]>;
  private latestCache$?: Observable<Article[]>;
  private mostViewedCache$?: Observable<Article[]>;
  private categoryCache = new Map<string, Observable<Article[]>>();

  constructor(private http: HttpClient) {}

  // Convert API article into client-side Article with proper Date objects
  private normalizeArticle(a: ApiArticle): Article {
    return {
      ...a,
      createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined,
    } as Article;
  }

  private normalizeArticles(list: ApiArticle[]): Article[] {
    return (list ?? []).map((a) => this.normalizeArticle(a));
  }

  // Build HttpParams from a plain object, handling arrays and skipping empty values
  private buildParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const v of value) params = params.append(key, String(v));
        continue;
      }
      params = params.set(key, String(value));
    }
    return params;
  }

  private getArticleList(params: Record<string, unknown>): Observable<Article[]> {
    return this.http
      .get<ApiArticle[]>(this.api, {
        params: this.buildParams(params),
      })
      .pipe(map((a) => this.normalizeArticles(a)));
  }

  private clearCache(): void {

    this.featuredCache$ = undefined;
    this.categoriesCache$ = undefined;
    this.tagsCache$ = undefined;

    //Future caches
    this.latestCache$ = undefined;
    this.mostViewedCache$ = undefined;
    this.categoryCache.clear();
  }

  /** Admin: list all articles across statuses. */
  getAdminArticles(): Observable<Article[]> {
    return this.getArticleList({
      page: 1,
      limit: 100,
      sort: 'latest',
    });
  }

  /** Public: list published articles with filters/paging. */
  getArticles(params: GetArticlesParams): Observable<Article[]> {
    return this.getArticleList({
      status: 'Published',
      page: params.page,
      limit: params.limit,
      search: params.search,
      category: params.category,
      featured: params.featured,
      sort: params.sort,
      tags: params.tags,
    });
  }

  searchArticles(query: string): Observable<Article[]> {
    return this.getArticles({
      page: 1,
      limit: 8,
      search: query,
      sort:  'latest',
    });
  }

  /** Public: featured + published. */
  getFeaturedArticles(limit = 5): Observable<Article[]> {

    if (!this.featuredCache$) {

      this.featuredCache$ = this.getArticleList({
        status: 'Published',
        featured: true,
        page: 1,
        limit,
      }).pipe(
        shareReplay(1)
      );

    }

    return this.featuredCache$;

  }

  getBySlug(slug: string): Observable<Article> {
    return this.http.get<ApiArticle>(`${this.api}/${slug}`).pipe(map((a) => this.normalizeArticle(a)));
  }

  incrementViews(slug: string): Observable<unknown> {
    return this.http.patch(`${this.api}/${slug}/views`, {});
  }

  /** Slug availability check for async validators. */
  isSlugTaken(slug: string, ignoreId?: string): Observable<boolean> {
    return this.getBySlug(slug).pipe(
      map((a) => (ignoreId ? a.id !== ignoreId : true)),
      catchError((err) => {
        // If 404, slug is not taken; otherwise conservatively return false
        if (err?.status === 404) return of(false);
        return of(false);
      })
    );
  }

  /** Derived metadata for filters UI (from published articles). */
  getCategories(): Observable<string[]> {

    if (!this.categoriesCache$) {

      this.categoriesCache$ = this.getArticleList({
        status: 'Published',
        page: 1,
        limit: 100,
      }).pipe(

        map(articles =>
          [...new Set(articles.map(a => a.category))].sort()
        ),

        shareReplay(1)

      );

    }

    return this.categoriesCache$;

  }

  getTags(): Observable<string[]> {

    if (!this.tagsCache$) {

      this.tagsCache$ = this.getArticleList({
        status: 'Published',
        page: 1,
        limit: 100,
      }).pipe(

        map(articles => {

          const tags = articles.flatMap(a => a.tags ?? []);

          return [...new Set(tags)].sort();

        }),

        shareReplay(1)

      );

    }

    return this.tagsCache$;

  }

  createArticle(article: CreateArticleDto): Observable<Article> {
    return this.http.post<ApiArticle>(this.api, article).pipe(
      map((a) => this.normalizeArticle(a)),
      tap(() => this.clearCache())
    );
  }

  updateArticle(id: string, updated: Partial<Article>): Observable<Article> {
    const dto: any = {
      title: updated.title,
      slug: updated.slug,
      excerpt: updated.excerpt,
      content: updated.content,
      image: updated.image,
      author: updated.author,
      photoby: updated.photoby,
      graphicby: updated.graphicby,
      illusrationby: (updated as any).illusrationby,
      category: updated.category as ArticleCategory | undefined,
      tags: updated.tags,
      status: updated.status,
      featured: updated.featured,
    };

    return this.http.patch<ApiArticle>(`${this.api}/${id}`, dto).pipe(
      map((a) => this.normalizeArticle(a)),
      tap(() => this.clearCache())
    );
  }

  publishArticle(id: string): Observable<Article> {
    return this.http
      .patch<ApiArticle>(`${this.api}/${id}/publish`, { status: 'Published' })
      .pipe(
        map((a) => this.normalizeArticle(a)),
        tap(() => this.clearCache())
      );
  }

  archiveArticle(id: string): Observable<Article> {
    return this.http
      .patch<ApiArticle>(`${this.api}/${id}/archive`, {})
      .pipe(
        map((a) => this.normalizeArticle(a)),
        tap(() => this.clearCache())
      );
  }

  deleteArticle(id: string): Observable<unknown> {
    return this.http.delete(`${this.api}/${id}`).pipe(
      tap(() => this.clearCache())
    );
  }


  getLatestArticles(limit = 8): Observable<Article[]> {

    if (!this.latestCache$) {

      this.latestCache$ = this.getArticleList({
        status: 'Published',
        featured: false,
        page: 1,
        limit,
        sort: 'latest',
      }).pipe(
        shareReplay(1)
      );

    }

    return this.latestCache$;

  }

  getMostViewedArticles(limit = 6): Observable<Article[]> {

    if (!this.mostViewedCache$) {

      this.mostViewedCache$ = this.getArticleList({
        status: 'Published',
        featured: false,
        page: 1,
        limit,
        sort: 'mostViewed',
      }).pipe(
        shareReplay(1)
      );

    }

    return this.mostViewedCache$;

  }
  getCategoryArticles(
    category: ArticleCategory,
    limit = 4
  ): Observable<Article[]> {

    const cached = this.categoryCache.get(category);

    if (cached) {
      return cached;
    }

    const request = this.getArticleList({
      status: 'Published',
      category,
      page: 1,
      limit,
      featured: false,
      sort: 'latest',
    }).pipe(
      shareReplay(1)
    );

    this.categoryCache.set(category, request);

    return request;

  }

  getRelatedArticles(
    slug: string,
    category: string,
    limit = 3
  ): Observable<Article[]> {
    return this.getArticleList({
      status: 'Published',
      category,
      page: 1,
      limit: limit + 1,
    }).pipe(
      map((articles) =>
        articles
          .filter((a) => a.slug !== slug)
          .slice(0, limit)
        ),
      catchError(() => of([]))
    );
  }

  getOtherStories(slug: string, limit = 8): Observable<Article[]> {
    return this.getArticleList({
      status: 'Published',
      page: 1,
      limit: limit + 1,
      sort: 'latest',
    }).pipe(
      map(articles =>
        articles
          .filter(a => a.slug !== slug)
          .slice(0, limit)
      ),
      catchError(() => of([]))
    );
  }
}
