import { Article } from "./article.model";

export interface ArticleFeed {
  article: Article;
  related: Article[];
  otherStories: Article[];
}