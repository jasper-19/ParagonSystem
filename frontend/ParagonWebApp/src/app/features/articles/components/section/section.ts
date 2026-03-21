import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ArticleSection,
  ParagraphSection,
  ImageSection,
  QuoteSection,
  HeadingSection,
  EmbedSection
} from '../../models/article-view.model';

@Component({
  selector: 'app-article-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section.html'
})
export class ArticleSectionComponent {

  @Input() section!: ArticleSection;

  // ===== TYPE GUARDS =====

  isParagraph(section: ArticleSection): section is ParagraphSection {
    return section.type === 'paragraph';
  }

  isImage(section: ArticleSection): section is ImageSection {
    return section.type === 'image';
  }

  isQuote(section: ArticleSection): section is QuoteSection {
    return section.type === 'quote';
  }

  isHeading(section: ArticleSection): section is HeadingSection {
    return section.type === 'heading';
  }

  isEmbed(section: ArticleSection): section is EmbedSection {
    return section.type === 'embed';
  }
}
