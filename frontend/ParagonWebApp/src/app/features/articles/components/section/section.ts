import { Component, DOCUMENT, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
  templateUrl: './section.html',
  styleUrl: './section.scss',
})
export class ArticleSectionComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private _section!: ArticleSection;

  @Input({ required: true })
  set section(value: ArticleSection) {
    this._section = value;
    this.safeEmbedUrl = this.isEmbed(value)
      ? this.sanitizeEmbedUrl(value.url)
      : undefined;
  }

  get section(): ArticleSection {
    return this._section;
  }

  @Input() isFirst = false;

  safeEmbedUrl?: SafeResourceUrl;

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

  private sanitizeEmbedUrl(value: string): SafeResourceUrl | undefined {
    try {
      const url = new URL(value, this.document.baseURI);
      if (!['http:', 'https:'].includes(url.protocol)) return undefined;

      return this.sanitizer.bypassSecurityTrustResourceUrl(url.toString());
    } catch {
      return undefined;
    }
  }
}
