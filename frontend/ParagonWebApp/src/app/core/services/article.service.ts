/*
  ArticleService
  - Purpose: encapsulate API interactions for articles (admin and public).
  - Notes: only formatting, spacing, and explanatory comments were added.
*/

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Article, ArticleCategory, CreateArticleDto } from '../../models/article.model';
import { GetArticlesParams } from '../../models/article-query.model';

// API representation where date fields may be strings (or Date objects)
type ApiArticle = Omit<Article, 'createdAt' | 'publishedAt'> & {
  createdAt?: string | Date;
  publishedAt?: string | Date | null;
};

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private api = '/api/articles';

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

  /** Admin: list all articles across statuses. */
  getAdminArticles(): Observable<Article[]> {
    const params = this.buildParams({ page: 1, limit: 100, sort: 'latest' });
    return this.http.get<ApiArticle[]>(this.api, { params }).pipe(map((a) => this.normalizeArticles(a)));
  }

  /** Public: list published articles with filters/paging. */
  getArticles(params: GetArticlesParams): Observable<Article[]> {
    const httpParams = this.buildParams({
      status: 'Published',
      page: params.page,
      limit: params.limit,
      search: params.search,
      category: params.category,
      featured: params.featured,
      sort: params.sort,
      tags: params.tags,
    });

    return this.http
      .get<ApiArticle[]>(this.api, { params: httpParams })
      .pipe(map((a) => this.normalizeArticles(a)));
  }

  /** Public: featured + published. */
  getFeaturedArticles(): Observable<Article[]> {
    const params = this.buildParams({
      status: 'Published',
      featured: true,
      page: 1,
      limit: 50,
    });

    return this.http.get<ApiArticle[]>(this.api, { params }).pipe(map((a) => this.normalizeArticles(a)));
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
    const params = this.buildParams({ status: 'Published', page: 1, limit: 100 });
    return this.http.get<ApiArticle[]>(this.api, { params }).pipe(
      map((articles) => {
        const categories = [...new Set((articles ?? []).map((a) => a.category))].sort();
        return categories;
      }),
      catchError(() => of([]))
    );
  }

  getTags(): Observable<string[]> {
    const params = this.buildParams({ status: 'Published', page: 1, limit: 100 });
    return this.http.get<ApiArticle[]>(this.api, { params }).pipe(
      map((articles) => {
        const tags = (articles ?? []).flatMap((a) => (a.tags ?? []) as string[]);
        return [...new Set(tags)].sort();
      }),
      catchError(() => of([]))
    );
  }

  createArticle(article: CreateArticleDto): Observable<Article> {
    return this.http.post<ApiArticle>(this.api, article).pipe(map((a) => this.normalizeArticle(a)));
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

    return this.http.patch<ApiArticle>(`${this.api}/${id}`, dto).pipe(map((a) => this.normalizeArticle(a)));
  }

  publishArticle(id: string): Observable<Article> {
    return this.http
      .patch<ApiArticle>(`${this.api}/${id}/publish`, { status: 'Published' })
      .pipe(map((a) => this.normalizeArticle(a)));
  }

  archiveArticle(id: string): Observable<Article> {
    return this.http.patch<ApiArticle>(`${this.api}/${id}/archive`, {}).pipe(map((a) => this.normalizeArticle(a)));
  }

  deleteArticle(id: string): Observable<unknown> {
    return this.http.delete(`${this.api}/${id}`);
  }

  getRelatedArticles(slug: string, category: string, limit = 3): Observable<Article[]> {
    const params = this.buildParams({ status: 'Published', category, page: 1, limit: 50 });
    return this.http.get<ApiArticle[]>(this.api, { params }).pipe(
      map((articles) =>
        this.normalizeArticles(articles)
          .filter((a) => a.slug !== slug && a.category === (category as any))
          .slice(0, limit)
      ),
      catchError(() => of([]))
    );
  }

  getOtherStories(slug: string, limit = 8): Observable<Article[]> {
    const params = this.buildParams({ status: 'Published', page: 1, limit: 100, sort: 'latest' });
    return this.http.get<ApiArticle[]>(this.api, { params }).pipe(
      map((articles) => this.normalizeArticles(articles).filter((a) => a.slug !== slug).slice(0, limit)),
      catchError(() => of([]))
    );
  }
}
