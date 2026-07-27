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

    const normalized = content
      .replace(
        /<p>\s*(?:&nbsp;|\u00a0|<br\s*\/?>|\s)*<\/p>/gi,
        ''
      )
      .trim();

    if (!normalized) {
      return [];
    }

    /*
     * Quill stores the full document as one HTML fragment. Keep that
     * fragment together so paragraph spacing is controlled consistently
     * by the article typography rather than source-code line breaks.
     */
    if (/<[a-z][\s\S]*>/i.test(normalized)) {
      return [{
        type: 'paragraph',
        content: normalized,
      }];
    }

    return normalized
      .split(/\r?\n\s*\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map<ParagraphSection>((paragraph) => ({
        type: 'paragraph',
        content: paragraph
      }));
  }
}
