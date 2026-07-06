import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';

@Component({
  selector: 'app-more-stories-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './more-stories-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoreStoriesSection {
  protected readonly imageVariant = imageVariant;

  private _articles: Article[] = [];

  @Input({ required: true })
  set articles(value: Article[]) {
    if (value === this._articles) return;
    this._articles = value ?? [];
  }

  get articles(): Article[] {
    return this._articles;
  }

  trackByArticle(index: number, article: Article): string {
    return article.id;
  }
}
