import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';
import { ImagePlaceholderComponent } from '../../../../shared/components/image-placeholder/image-placeholder';

@Component({
  selector: 'app-other-stories',
  standalone: true,
  imports: [CommonModule, RouterModule, ImagePlaceholderComponent],
  templateUrl: './other-stories.html'
})
export class OtherStories {
  protected readonly imageVariant = imageVariant;

  @Input() articles: Article[] = [];
}
