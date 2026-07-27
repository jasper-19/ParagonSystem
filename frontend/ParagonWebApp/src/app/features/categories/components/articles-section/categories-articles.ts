import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Article } from '../../../../models/article.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';
import { ImagePlaceholderComponent } from '../../../../shared/components/image-placeholder/image-placeholder';

@Component({
  selector: 'app-categories-articles',
  standalone: true,
  imports: [CommonModule, RouterLink, ImagePlaceholderComponent],
  templateUrl: './categories-articles.html'
})
export class CategoriesArticles
  implements AfterViewInit, OnDestroy {
    protected readonly imageVariant = imageVariant;

  @Input({ required: true }) articles!: Article[];
  @Input({ required: true }) loading!: boolean;
  @Input({ required: true }) hasMore!: boolean;

  @Input() initialLoading: boolean = false;

  @Output() loadMore = new EventEmitter<void>();

  @ViewChild('anchor')
  anchor!: ElementRef<HTMLDivElement>;

  private observer!: IntersectionObserver;

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          this.hasMore &&
          !this.loading &&
          this.articles.length > 0
        ) {
          this.loadMore.emit();
        }
      },
      { rootMargin: '200px' }
    );

    this.observer.observe(this.anchor.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
