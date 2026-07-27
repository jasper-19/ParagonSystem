import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input,  } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Article } from './../../../../models/article.model';
import { CategoryFeedSection } from './../../../../models/homepage-feed.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';
import { ImagePlaceholderComponent } from '../../../../shared/components/image-placeholder/image-placeholder';
import { ScrollRevealDirective } from '../../scroll-reveal.directive';

@Component({
  selector: 'app-category-section',
  standalone: true,
  imports: [CommonModule, RouterModule, ImagePlaceholderComponent, ScrollRevealDirective],
  templateUrl: './category-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class CategorySection {
    protected readonly imageVariant = imageVariant;

    private _sections: CategoryFeedSection[] = [];

    private readonly sectionMap = new Map<string, Article[]>();
    visibleSections: Array<{
      title: string;
      category: string;
      articles: Article[];
    }> = [];

    private normalizeCategory(category: string): string {
      return category.trim().toLowerCase();
    }

    @Input({ required: true })
    set sections(value: CategoryFeedSection[]) {

      this._sections = value ?? [];

      this.sectionMap.clear();

      for (const section of this._sections) {
        this.sectionMap.set(
          this.normalizeCategory(section.category),
          section.articles
        );
      }

      this.visibleSections = this.sectionDefinitions
        .map(block => ({
          ...block,
          articles: this.articlesFor(block.category),
        }))
        .filter(block => block.articles.length > 0);
    }

    get sections(): CategoryFeedSection[] {
      return this._sections;
    }

    private readonly sectionDefinitions = [
      { title: 'Sports', category: 'Sports' },
      { title: 'News', category: 'News' },
      { title: 'Feature', category: 'Feature' },
      { title: 'Column', category: 'Column' },
      { title: 'Editorial', category: 'Editorial' },
      { title: 'DevCom', category: 'DevCom' },
      { title: 'Literary', category: 'Literary' },
    ] as const;

    articlesFor(category: string): Article[] {
        return this.sectionMap.get(this.normalizeCategory(category)) ?? [];
    }

    trackByArticle(index: number, article: Article): string {
        return article.id;
    }

    hasAnyArticles(): boolean {
        return this.sections.some(section => section.articles.length > 0);
    }
}
