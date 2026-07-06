import { Article } from './article.model';

export interface CategoryPageFeed {
  articles: Article[];
  categories: string[];
  tags: string[];
  page: number;
  limit: number;
  hasMore: boolean;
}
