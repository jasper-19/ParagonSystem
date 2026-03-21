import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';

@Component({
  selector: 'app-related',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './related.html'
})
export class Related {
  @Input() articles: Article[] = [];
}
