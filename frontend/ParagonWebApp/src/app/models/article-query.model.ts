import { Article } from './article.model';

export type ArticleSortOption =
| 'latest'
| 'oldest'
| 'mostViewed';

export interface GetArticlesParams {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  featured?: boolean;
  sort?: 'latest' | 'oldest' | 'mostViewed';
  tags?: string[];
}

export interface PaginatedArticles {
  data: Article[];
  total: number;
  page: number;
  limit: number;
}
