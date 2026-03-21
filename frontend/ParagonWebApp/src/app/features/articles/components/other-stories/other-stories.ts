import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';

@Component({
  selector: 'app-other-stories',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './other-stories.html'
})
export class OtherStories {
  @Input() articles: Article[] = [];
}
