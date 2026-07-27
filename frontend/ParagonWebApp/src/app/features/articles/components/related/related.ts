import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';
import { ImagePlaceholderComponent } from '../../../../shared/components/image-placeholder/image-placeholder';

@Component({
  selector: 'app-related',
  standalone: true,
  imports: [CommonModule, RouterModule, ImagePlaceholderComponent],
  templateUrl: './related.html'
})
export class Related {
  protected readonly imageVariant = imageVariant;

  @Input() articles: Article[] = [];

  trackByArticle(index: number, article: Article): string {
    return article.id;
  }
}
