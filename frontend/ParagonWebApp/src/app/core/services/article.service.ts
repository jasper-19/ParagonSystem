import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { Article, ArticleCategory, CreateArticleDto } from '../../models/article.model';
import { GetArticlesParams } from '../../models/article-query.model';
import { HomepageFeed } from '../../models/homepage-feed.model';
import { ArticleFeed } from '../../models/article-feed.model';
import { CategoryPageFeed } from '../../models/category-page-feed.model';
import { SearchFeed } from '../../models/search-feed.model';
// API endpoints are defined in a central config for maintainability and environment-based switching
import { API_ENDPOINTS } from '../config/api.config';
import { SocketService } from './socket.service';

// API representation where date fields may be strings (or Date objects)
type ApiArticle = Omit<Article, 'createdAt' | 'publishedAt'> & {
  createdAt?: string | Date;
  publishedAt?: string | Date | null;
};

type ApiHomepageCategorySection = {
  category: string;
  articles: ApiArticle[];
};

type ApiHomepageFeed = {
  featured: ApiArticle[];
  mostViewed: ApiArticle[];
  categories: ApiHomepageCategorySection[];
  moreStories: ApiArticle[];
};

type ApiArticleFeed = {
  article: ApiArticle;
  related: ApiArticle[];
  otherStories: ApiArticle[];
};

type ApiCategoryPageFeed = {
  articles: ApiArticle[];
  categories: string[];
  tags: string[];
  page: number;
  limit: number;
  hasMore: boolean;
};

type ApiSearchFeed = {
  recent: ApiArticle[];
  categories: string[];
};

type ApiAdminArticleSummary =
  Omit<AdminArticleSummary, 'createdAt' | 'publishedAt'> & {
    createdAt?: string | Date;
    publishedAt?: string | Date | null;
  };

type ApiAdminArticlesResponse = {
  items: ApiAdminArticleSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApiAdminArticleCredit =
  Omit<AdminArticleCredit, 'createdAt'> & {
    createdAt?: string | Date;
  };

type ApiAdminArticleDetail =
  Omit<
    AdminArticleDetail,
    'createdAt' | 'publishedAt' | 'credits'
  > & {
    createdAt?: string | Date;
    publishedAt?: string | Date | null;
    credits?: ApiAdminArticleCredit[];
  };

export type AdminArticlesParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort?: 'latest' | 'oldest' | 'mostViewed';
  category?: string;
  featured?: boolean;
  tags?: string[];
};

export type AdminArticleCreditType =
  | 'author'
  | 'photo'
  | 'graphic'
  | 'illustration';

export interface AdminArticleCredit {
  id: string;
  articleId: string;
  staffId: string;
  creditedName: string;
  creditType: AdminArticleCreditType;
  createdAt: Date;
}

export interface AdminArticleDetail {
  id: string;
  title: string;
  status: Article['status'];
  featured: boolean;
  views: number;

  excerpt: string;

  category: ArticleCategory;
  tags: string[];

  createdAt: Date;
  publishedAt?: Date;

  credits: AdminArticleCredit[];
}

export interface AdminArticleSummary {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  status: Article['status'];
  featured: boolean;
  views: number;
  createdAt: Date;
  publishedAt?: Date;
}

export interface AdminArticlesResponse {
  items: AdminArticleSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
@Injectable({ providedIn: 'root' })
export class ArticleService {
  private api = API_ENDPOINTS.articles;
  private featuredCache$?: Observable<Article[]>;
  private categoriesCache$?: Observable<string[]>;
  private tagsCache$?: Observable<string[]>;
  private latestCache$?: Observable<Article[]>;
  private mostViewedCache$?: Observable<Article[]>;
  private categoryCache = new Map<string, Observable<Article[]>>();
  private homepageFeedCache$?: Observable<HomepageFeed>;
  private articleFeedCache = new Map<string, Observable<ArticleFeed>>();
  private categoryFeedCache = new Map<string, Observable<CategoryPageFeed>>();
  private searchFeedCache$?: Observable<SearchFeed>;

  private lastCategoryFeedParams: GetArticlesParams | null = null;
  private currentArticleFeedSlug: string | null = null;

  private readonly homepageFeedState =
  signal<HomepageFeed | null>(null);

  readonly homepageFeed =
    this.homepageFeedState.asReadonly();

   private readonly articleFeedState =
    signal<ArticleFeed | null>(null);

  readonly articleFeed =
    this.articleFeedState.asReadonly();

  private readonly categoryFeedState =
    signal<CategoryPageFeed | null>(null);

  readonly categoryFeed =
    this.categoryFeedState.asReadonly();

  private readonly categoryArticlesState =
    signal<Article[]>([]);

  readonly categoryArticles =
    this.categoryArticlesState.asReadonly();

  private readonly searchFeedState =
    signal<SearchFeed | null>(null);

  readonly searchFeed =
    this.searchFeedState.asReadonly();

    private readonly articlesChangedState = signal(0);

    readonly articlesChanged = this.articlesChangedState.asReadonly();

    private readonly slugChangedState = signal<{
      previousSlug: string;
      currentSlug: string;
    } | null>(null);

    readonly slugChanged =
      this.slugChangedState.asReadonly();

  constructor(
    private http: HttpClient,
    private socketService: SocketService
  ) {
    this.initializeRealtime();
  }

  private initializeRealtime(): void {
    this.socketService.onArticlesUpdated(
      payload => {

        console.log(
          '📡 Realtime article update',
          payload
        );

        const slugChanged =
          payload.previousSlug &&
          payload.currentSlug &&
          payload.previousSlug !==
            payload.currentSlug;

        const isCurrentArticle =
          slugChanged &&
          this.currentArticleFeedSlug ===
            payload.previousSlug;

        if (isCurrentArticle) {

          this.currentArticleFeedSlug =
            payload.currentSlug!;

          this.slugChangedState.set({
            previousSlug:
              payload.previousSlug!,
            currentSlug:
              payload.currentSlug!,
          });

          this.handleArticlesChanged(false);

        } else {

          this.handleArticlesChanged(true);

        }

      }
    );
  }

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

  private normalizeAdminArticles(
    response: ApiAdminArticlesResponse
  ): AdminArticlesResponse {
    return {
      items: (response.items ?? []).map(article => ({
        id: String(article.id),
        title: article.title,
        slug: article.slug,
        category: article.category,
        status: article.status,
        featured: Boolean(article.featured),
        views: Number(article.views ?? 0),
        createdAt: article.createdAt
          ? new Date(article.createdAt)
          : new Date(),
        publishedAt: article.publishedAt
          ? new Date(article.publishedAt)
          : undefined,
      })),
      page: response.page,
      limit: response.limit,
      total: response.total,
      totalPages: response.totalPages,
    };

  }

private normalizeAdminArticleDetail(
  article: ApiAdminArticleDetail
): AdminArticleDetail {
  return {
    id: String(article.id),
    title: article.title,
    status: article.status,
    featured: article.featured,
    views: Number(article.views ?? 0),

    excerpt: article.excerpt ?? '',

    category: article.category,
    tags: article.tags ?? [],

    createdAt: article.createdAt
      ? new Date(article.createdAt)
      : new Date(),

    publishedAt: article.publishedAt
      ? new Date(article.publishedAt)
      : undefined,

    credits: (article.credits ?? []).map(
      credit => ({
        id: String(credit.id),
        articleId: String(credit.articleId),
        staffId: String(credit.staffId),
        creditedName:
          credit.creditedName ?? '',
        creditType: credit.creditType,
        createdAt: credit.createdAt
          ? new Date(credit.createdAt)
          : new Date(),
      })
    ),
  };
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
    this.homepageFeedCache$ = undefined;
    this.searchFeedCache$ = undefined;

    this.articleFeedCache.clear();
    this.categoryFeedCache.clear();


    this.latestCache$ = undefined;
    this.mostViewedCache$ = undefined;

    this.categoriesCache$ = undefined;
    this.tagsCache$ = undefined;

    this.categoryCache.clear();
  }

  private handleArticlesChanged(
    refreshCurrentArticle = true
  ): void {
    this.clearCache();

    this.articlesChangedState.update(
      value => value + 1
    );

    this.refreshHomepageFeed();

    if (refreshCurrentArticle) {
      this.refreshArticleFeed();
    }

    this.refreshSearchFeed();
  }

  private buildCategoryFeedCacheKey(params: GetArticlesParams): string {
    return JSON.stringify({
      page: params.page ?? 1,
      limit: params.limit ?? 6,
      search: params.search ?? '',
      category: params.category ?? '',
      sort: params.sort ?? 'latest',
      tags: params.tags ?? [],
    });
  }

  /** Admin: list all articles across statuses. */
  getAdminArticles(
    params: AdminArticlesParams
  ): Observable<AdminArticlesResponse> {
    return this.fetchAdminArticles(params);
  }

  /**
   * Admin: retrieve the lightweight detail payload
   * required by the Article View Modal.
   */
  getAdminArticleDetail(
    articleId: string
  ): Observable<AdminArticleDetail> {
    const id = String(articleId ?? '').trim();

    if (!id) {
      throw new Error(
        'Article ID is required'
      );
    }

    return this.http
      .get<ApiAdminArticleDetail>(
        `${this.api}/admin/${encodeURIComponent(id)}`
      )
      .pipe(
        map(article =>
          this.normalizeAdminArticleDetail(
            article
          )
        )
      );
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

private fetchHomepageFeed(
  forceRefresh = false
): Observable<HomepageFeed> {
  const params = forceRefresh
    ? new HttpParams().set(
        '_refresh',
        Date.now().toString()
      )
    : undefined;

  return this.http
    .get<ApiHomepageFeed>(
      `${this.api}/homepage-feed`,
      { params }
    )
    .pipe(
      map(feed =>
        this.normalizeHomepageFeed(feed)
      ),
      tap(feed =>
        this.homepageFeedState.set(feed)
      )
    );
}

  private fetchAdminArticles(
    params: AdminArticlesParams
  ): Observable<AdminArticlesResponse> {
    return this.http
      .get<ApiAdminArticlesResponse>(
        `${this.api}/admin`,
        {
          params: this.buildParams({
            page: params.page ?? 1,
            limit: params.limit ?? 20,
            status: params.status,
            search: params.search,
            sort: params.sort ?? 'latest',
            category: params.category,
            featured: params.featured,
            tags: params.tags,
          }),
        }
      )
      .pipe(
        map(response =>
          this.normalizeAdminArticles(response)
        )
      );
  }

  getHomepageFeed(): Observable<HomepageFeed> {
    if (!this.homepageFeedCache$) {
      this.homepageFeedCache$ = this.fetchHomepageFeed().pipe(
        shareReplay(1)
      );
    }

    return this.homepageFeedCache$;
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

private fetchArticleFeed(
  slug: string,
  forceRefresh = false
): Observable<ArticleFeed> {
  const params = forceRefresh
    ? new HttpParams().set(
        '_refresh',
        Date.now().toString()
      )
    : undefined;

  return this.http
    .get<ApiArticleFeed>(
      `${this.api}/${slug}/feed`,
      { params }
    )
    .pipe(
      map(feed =>
        this.normalizeArticleFeed(feed)
      )
    );
}

  getArticleFeed(slug: string): Observable<ArticleFeed> {
    const cached = this.articleFeedCache.get(slug);

    if (cached) {
      return cached;
    }

    const request = this.fetchArticleFeed(slug).pipe(
      shareReplay(1)
    );

    this.articleFeedCache.set(slug, request);

    return request;
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
    return this.http.get<string[]>(`${this.api}/categories`);
  }

  getTags(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api}/tags`);
  }

  createArticle(article: CreateArticleDto): Observable<Article> {
    return this.http.post<ApiArticle>(this.api, article).pipe(
      map((a) => this.normalizeArticle(a)),
      tap(() => this.clearCache())
    );
  }

  updateArticle(id: string, updated: Partial<Article>): Observable<Article> {
    const dto = {
      title: updated.title,
      slug: updated.slug,
      excerpt: updated.excerpt,
      content: updated.content,
      image: updated.image,

      // Legacy display fields
      author: updated.author,
      photoby: updated.photoby,
      graphicby: updated.graphicby,
      illusrationby: updated.illusrationby,

      // Structured active-board credit IDs
      authorIds: updated.authorIds,
      photoByIds: updated.photoByIds,
      graphicByIds: updated.graphicByIds,
      illustrationByIds: updated.illustrationByIds,

      category: updated.category as
        | ArticleCategory
        | undefined,

      tags: updated.tags,
      status: updated.status,
      featured: updated.featured,
    };

    return this.http.patch<ApiArticle>(`${this.api}/${id}`, dto).pipe(
      map((a) => this.normalizeArticle(a)),
      tap(() => this.handleArticlesChanged())
    );
  }

  publishArticle(id: string): Observable<Article> {
    return this.http
      .patch<ApiArticle>(`${this.api}/${id}/publish`, { status: 'Published' })
      .pipe(
        map((a) => this.normalizeArticle(a)),
        tap(() => this.handleArticlesChanged())
      );
  }

  archiveArticle(id: string): Observable<Article> {
    return this.http
      .patch<ApiArticle>(`${this.api}/${id}/archive`, {})
      .pipe(
        map((a) => this.normalizeArticle(a)),
        tap(() => this.handleArticlesChanged())
      );
  }

  deleteArticle(id: string): Observable<unknown> {
    return this.http.delete(`${this.api}/${id}`).pipe(
      tap(() => this.handleArticlesChanged())
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
    limit = 6
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

  getOtherStories(
    slug: string,
    limit = 8): Observable<Article[]> {
    return this.getArticleList({
      status: 'Published',
      page: 1,
      limit: limit + 1,
      sort: 'latest',
    }).pipe(
      map(articles => {
        return articles
          .filter(a => a.slug !== slug)
          .slice(0, limit)
    }),
      catchError(() => of([]))
    );
  }

  private normalizeHomepageFeed(feed: ApiHomepageFeed): HomepageFeed {
    return {
      featured: this.normalizeArticles(feed.featured),
      mostViewed: this.normalizeArticles(feed.mostViewed),
      categories: feed.categories.map((section) => ({
        category: section.category,
        articles: this.normalizeArticles(section.articles),
      })),
      moreStories: this.normalizeArticles(feed.moreStories),
    };
  }

  private normalizeArticleFeed(
    feed: ApiArticleFeed
  ): ArticleFeed {
    return {
      article: this.normalizeArticle(feed.article),
      related: this.normalizeArticles(feed.related),
      otherStories: this.normalizeArticles(feed.otherStories),
    };
  }

  private normalizeCategoryPageFeed(
    feed: ApiCategoryPageFeed
  ): CategoryPageFeed {
    return {
      articles: this.normalizeArticles(feed.articles),
      categories: feed.categories ?? [],
      tags: feed.tags ?? [],
      page: feed.page,
      limit: feed.limit,
      hasMore: feed.hasMore,
    };
  }

  private normalizeSearchFeed(
    feed: ApiSearchFeed
  ): SearchFeed {
    return {
      recent: this.normalizeArticles(feed.recent),
      categories: feed.categories ?? [],
    };
  }

refreshHomepageFeed(): void {
  this.homepageFeedCache$ = undefined;

  this.fetchHomepageFeed(true)
    .subscribe({
      error: err => {
        console.error(
          'Failed to refresh homepage feed',
          err
        );
      },
    });
}

  refreshArticleFeed(slug?: string): void {
    const targetSlug =
      slug ?? this.currentArticleFeedSlug;

    if (!targetSlug) {
      return;
    }

    this.articleFeedCache.delete(targetSlug);

    this.fetchArticleFeed(
      targetSlug,
      true
    ).subscribe({
      next: feed => {
        this.articleFeedState.set(feed);
      },

      error: err => {
        console.error(
          'Failed to refresh article feed',
          err
        );
      },
    });
  }

  loadArticleFeed(slug: string): void {
    this.currentArticleFeedSlug = slug;
    this.articleFeedState.set(null);

    this.getArticleFeed(slug)
      .subscribe({
        next: feed => {
          this.articleFeedState.set(feed);
        },

        error: err => {
          console.error(
            'Failed to load article feed',
            err
          );
        },
      });
  }

  private fetchCategoryFeed(
    params: GetArticlesParams
  ): Observable<CategoryPageFeed> {
    this.lastCategoryFeedParams = {
      ...params,
      tags: [...(params.tags ?? [])],
    };

    return this.http
      .get<ApiCategoryPageFeed>(`${this.api}/category-feed`, {
        params: this.buildParams({ ...params }),
      })
      .pipe(
        map(feed => this.normalizeCategoryPageFeed(feed))
      );
}

  private fetchSearchFeed(): Observable<SearchFeed> {
    return this.http
      .get<ApiSearchFeed>(`${this.api}/search-feed`)
      .pipe(
        map(feed => this.normalizeSearchFeed(feed)),
        tap(feed => this.searchFeedState.set(feed))
      );
  }

  getCategoryFeed(
    params: GetArticlesParams
  ): Observable<CategoryPageFeed> {
    const key = this.buildCategoryFeedCacheKey(params);
    const cached = this.categoryFeedCache.get(key);

    if (cached) return cached;

    const request = this.fetchCategoryFeed(params).pipe(
      shareReplay(1)
    );

    this.categoryFeedCache.set(key, request);

    return request;
  }

  loadCategoryFeed(params: GetArticlesParams): Observable<CategoryPageFeed> {
    return this.getCategoryFeed(params).pipe(
      tap(feed => {
        this.categoryFeedState.set(feed);

        if ((params.page ?? 1) === 1) {
          this.categoryArticlesState.set(feed.articles);
        } else {
          this.categoryArticlesState.update(current => [
            ...current,
            ...feed.articles,
          ]);
        }
      })
    );
  }

refreshCategoryFeed(): void {
  if (!this.lastCategoryFeedParams) return;

  const params: GetArticlesParams = {
    ...this.lastCategoryFeedParams,
    tags: [...(this.lastCategoryFeedParams.tags ?? [])],
    page: 1,
  };

  this.categoryFeedCache.clear();

  this.loadCategoryFeed(params).subscribe({
    error: err => {
      console.error('Failed to refresh category feed', err);
    },
  });
}

  getSearchFeed(): Observable<SearchFeed> {
    if (!this.searchFeedCache$) {
      this.searchFeedCache$ = this.fetchSearchFeed().pipe(
        shareReplay(1)
      );
    }

    return this.searchFeedCache$;
  }

  loadSearchFeed(): void {
    this.getSearchFeed().subscribe({
      error: err => {
        console.error('Failed to load search feed', err);
      },
    });
  }

  refreshSearchFeed(): void {
    this.searchFeedCache$ = undefined;

    this.fetchSearchFeed().subscribe({
      error: err => {
        console.error('Failed to refresh search feed', err);
      },
    });
  }

  clearSlugChanged(): void {
    this.slugChangedState.set(null);
  }
}
