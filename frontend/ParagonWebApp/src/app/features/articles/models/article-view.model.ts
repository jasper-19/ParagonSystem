export interface ArticleView {
  sections: ArticleSection[];
}

export  type ArticleSection =
| ParagraphSection
| ImageSection
| QuoteSection
| HeadingSection
| EmbedSection;

export interface ParagraphSection {
  type: 'paragraph';
  content: string;
}

export interface ImageSection {
  type: 'image';
  src: string;
  caption?: string;
}

export interface QuoteSection {
  type: 'quote';
  text: string;
  author?: string;
}

export interface HeadingSection {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface EmbedSection {
  type: 'embed';
  url: string;
}
