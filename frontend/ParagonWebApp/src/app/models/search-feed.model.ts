import { Article } from './article.model';

export interface SearchFeed {
  recent: Article[];
  categories: string[];
}
