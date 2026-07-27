import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-article-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './article-skeleton.html'
})
export class ArticleSkeleton {
  readonly lineWidths = ['100%', '92%', '98%', '76%', '94%', '86%', '100%', '68%'];
}
