export type ArticleStatus =
  | 'Draft'
  | 'Published'
  | 'Archived';

export type ArticleCategory =
  | 'News'
  | 'Feature'
  | 'Editorial'
  | 'Sports'
  | 'Column'
  | 'DevCom'
  | 'Literary';

export type ArticleCreditType =
  | 'author'
  | 'photo'
  | 'graphic'
  | 'illustration';

export interface ArticleCredit {
  staffId: string;
  creditedName: string;
  creditType: ArticleCreditType;
}

export interface Article {
  id: string;

  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;

  /**
   * Legacy display-name fields.
   * Keep these while existing public article views
   * still read credits as strings.
   */
  author: string;
  photoby: string;
  graphicby: string;
  illusrationby: string;

  authorIds?: string[];
  photoByIds?: string[];
  graphicByIds?: string[];
  illustrationByIds?: string[];

  /**
   * Structured credits returned by the backend.
   * Optional during migration because older articles
   * may not have article_credits records yet.
   */
  credits?: ArticleCredit[];

  category: ArticleCategory;
  tags: string[];

  status: ArticleStatus;
  featured: boolean;
  views: number;

  createdAt: Date;
  publishedAt?: Date;
}

export type CreateArticle = Omit<
  Article,
  | 'id'
  | 'views'
  | 'createdAt'
  | 'publishedAt'
  | 'credits'
>;

export interface CreateArticleDto extends CreateArticle {
  authorIds: string[];
  photoByIds: string[];
  graphicByIds: string[];
  illustrationByIds: string[];
}
