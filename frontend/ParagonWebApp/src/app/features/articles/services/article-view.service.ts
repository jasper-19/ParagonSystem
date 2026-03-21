import { Injectable } from '@angular/core';
import { Article } from '../../../models/article.model';
import {
  ArticleView,
  ArticleSection,
  ParagraphSection
} from '../models/article-view.model';

@Injectable({
  providedIn: 'root'
})
export class ArticleViewService {

  transform(article: Article): ArticleView {
    return {
      sections: this.parseContent(article.content)
    };
  }

  /**
   * Temporary parser:
   * Converts plain text content into paragraph blocks.
   *
   * Later you can replace this with:
   * - Markdown parser
   * - JSON block structure
   * - CMS structured content
   */
  private parseContent(content: string): ArticleSection[] {

    if (!content || !content.trim()) {
      return [];
    }

    return content
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map<ParagraphSection>((paragraph) => ({
        type: 'paragraph',
        content: paragraph
      }));
  }
}
