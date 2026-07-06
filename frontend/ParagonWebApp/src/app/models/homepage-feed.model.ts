import { Article } from './article.model';

export interface CategoryFeedSection {
  category: string;
  articles: Article[];
}

export interface HomepageFeed {
  featured: Article[];
  mostViewed: Article[];
  categories: CategoryFeedSection[];
  moreStories: Article[];
}