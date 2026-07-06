import { CommonModule } from '@angular/common';
import { Component, Input, ChangeDetectionStrategy, } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';

@Component({
  selector: 'app-most-viewed-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './most-viewed-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MostViewedSection {
  protected readonly imageVariant = imageVariant;

  private mostViewedArticles: Article[] = [];

  @Input({ required: true })
  set articles(value: Article[]) {

    if (value === this.mostViewedArticles) {
      return;
    }

    this.mostViewedArticles = value ?? [];
  }

  get articles(): Article[] {
    return this.mostViewedArticles;
  }

}
