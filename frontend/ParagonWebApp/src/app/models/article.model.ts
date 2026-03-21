export type ArticleStatus = 'Draft' | 'Published' | 'Archived';

export type CreateArticle = Omit<
  Article,
  'id' | 'views' | 'createdAt' | 'publishedAt'
>;


export type ArticleCategory =
  | 'News'
  | 'Feature'
  | 'Editorial'
  | 'Sports'
  | 'Column'
  | 'DevCom'
  | 'Literary';

export interface Article {
  id: string;

  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;

  author: string;
  photoby: string;
  graphicby: string;
  illusrationby: string;

  category: ArticleCategory;
  tags: string[];

  status: ArticleStatus;        // NOT optional
  featured: boolean;            // NOT optional
  views: number;                // required

  createdAt: Date;              // always exists
  publishedAt?: Date;           // only if published
}

export interface CreateArticleDto {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;

  author: string;
  photoby: string;
  graphicby: string;
  illusrationby: string;

  category: ArticleCategory;
  tags: string[];

  status: ArticleStatus;
  featured: boolean;
}
