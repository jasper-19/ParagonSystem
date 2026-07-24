import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Media } from '../../../../../models/media.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MediaCardComponent } from '../media-card/media-card';

@Component({
  selector: 'app-media-grid',
  standalone: true,
  imports: [CommonModule, RouterModule,
    MediaCardComponent
  ],
  templateUrl: './media-grid.html'
})
export class MediaGridComponent implements AfterViewInit, OnChanges {
  @Input() mediaList: Media[] = [];
  @Input() selectedIds: string[] = [];

  private readonly destroyRef = inject(DestroyRef);

  @Output() toggleSelection = new EventEmitter<string>();
  @Output() openDetails = new EventEmitter<string>();

  @ViewChild('gridContainer')
  private gridContainer?: ElementRef<HTMLElement>;

  @ViewChildren('mediaItem')
  private mediaItems?: QueryList<ElementRef<HTMLElement>>;

  activeIndex = 0;

  ngAfterViewInit(): void {
    this.mediaItems?.changes
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe(() => {
        this.ensureValidActiveIndex();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mediaList']) {
      this.ensureValidActiveIndex();
    }

    if (changes['selectedIds']) {
      this.syncActiveIndexWithSelection();
    }
  }

  isSelected(mediaId: string): boolean {
    return this.selectedIds.includes(mediaId);
  }

  trackByMediaId(_: number, media: Media): string {
    return media.id;
  }

  onItemKeydown(event: KeyboardEvent, index: number): void {
    if (!this.mediaList.length) return;

    const columnCount = this.getColumnCount();
    let targetIndex = index;

    switch (event.key) {
      case 'ArrowRight':
        targetIndex = Math.min(index + 1, this.mediaList.length - 1);
        break;

      case 'ArrowLeft':
        targetIndex = Math.max(index - 1, 0);
        break;

      case 'ArrowDown':
        targetIndex = Math.min(index + columnCount, this.mediaList.length - 1);
        break;

      case 'ArrowUp':
        targetIndex = Math.max(index - columnCount, 0);
        break;

      case 'Home':
        targetIndex = 0;
        break;

      case 'End':
        targetIndex = this.mediaList.length - 1;
        break;

      case ' ':
        event.preventDefault();
        this.activeIndex = index;
        this.toggleSelection.emit(
          this.mediaList[index].id
        );
        return;

      case 'Enter':
        event.preventDefault();
        this.activeIndex = index;
        this.openDetails.emit(
          this.mediaList[index].id
        );
        return;

      default:
        return;
    }

    event.preventDefault();
    this.focusItem(targetIndex);
  }

  onItemFocus(index: number): void {
    this.activeIndex = index;
  }

  private getColumnCount(): number {
    if (
      typeof window === 'undefined'
    ) {
      return 1;
    }

    const grid =
      this.gridContainer?.nativeElement;

    if (!grid) {
      return 1;
    }

    const templateColumns =
      window
        .getComputedStyle(grid)
        .gridTemplateColumns;

    if (
      !templateColumns ||
      templateColumns === 'none'
    ) {
      return 1;
    }

    return templateColumns
      .split(' ')
      .filter(Boolean)
      .length;
  }

  private focusItem(index: number): void {
    const items = this.mediaItems?.toArray();

    if (!items?.length) return;

    const safeIndex = Math.max(
      0,
      Math.min(index, items.length - 1)
    );

    this.activeIndex = safeIndex;
    items[safeIndex].nativeElement.focus();
  }

  private ensureValidActiveIndex(): void {
    if (!this.mediaList.length) {
      this.activeIndex = 0;
      return;
    }

    this.activeIndex = Math.min(
      this.activeIndex,
      this.mediaList.length - 1
    );
  }

  private syncActiveIndexWithSelection(): void {
    const selectedId = this.selectedIds[0];

    if (!selectedId) return;

    const selectedIndex = this.mediaList.findIndex(
      media => media.id === selectedId
    );

    if (selectedIndex >= 0) {
      this.activeIndex = selectedIndex;
    }
  }

}
