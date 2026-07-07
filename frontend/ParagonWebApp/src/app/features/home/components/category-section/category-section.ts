import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input,  } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Article } from './../../../../models/article.model';
import { CategoryFeedSection } from './../../../../models/homepage-feed.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';
import { ImagePlaceholderComponent } from '../../../../shared/components/image-placeholder/image-placeholder';

@Component({
  selector: 'app-category-section',
  standalone: true,
  imports: [CommonModule, RouterModule, ImagePlaceholderComponent],
  templateUrl: './category-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class CategorySection {
    protected readonly imageVariant = imageVariant;

    private _sections: CategoryFeedSection[] = [];

    private readonly sectionMap = new Map<string, Article[]>();

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
    }

    get sections(): CategoryFeedSection[] {
      return this._sections;
    }

    readonly topSections = [
      { title: 'Sports', category: 'Sports' },
      { title: 'News', category: 'News' },
      { title: 'Feature', category: 'Feature' },
    ] as const;

    readonly bottomSections = [
      { title: 'Column', category: 'Column' },
      { title: 'Editorial', category: 'Editorial' },
      { title: 'DevCom', category: 'DevCom' },
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
