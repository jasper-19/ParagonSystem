import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-article-meta',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './meta.html',
})
export class ArticleMeta {

  @Input() title!: string;
  @Input() excerpt?: string;

  @Input() author!: string;
  @Input() publishedAt?: Date;
  @Input() category!: string;
  @Input() views!: number;

  @Input() photoby?: string;
  @Input() graphicby?: string;
  @Input() illusrationby?: string;

  @Input() readingTime?: string; // optional (e.g. "1 min read")
}
