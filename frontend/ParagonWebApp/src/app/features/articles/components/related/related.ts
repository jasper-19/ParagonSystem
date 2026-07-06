import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';
import { ArticleCarouselComponent } from '../../../../shared/components/article-carousel/article-carousel';

@Component({
  selector: 'app-related',
  standalone: true,
  imports: [CommonModule, RouterModule, ArticleCarouselComponent],
  templateUrl: './related.html'
})
export class Related {
  protected readonly imageVariant = imageVariant;

  @Input() articles: Article[] = [];
}
