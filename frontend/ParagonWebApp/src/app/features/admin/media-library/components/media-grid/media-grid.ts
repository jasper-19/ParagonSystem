import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Media } from '../../../../../models/media.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-media-grid',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './media-grid.html'
})
export class MediaGridComponent {
  @Input() mediaList: Media[] = [];
  @Input() selectedIds: string[] = [];

  @Output() toggleSelection = new EventEmitter<string>();
  @Output() openDetails = new EventEmitter<string>();

  isSelected(mediaId: string): boolean {
    return this.selectedIds.includes(mediaId);
  }

  onCardClick(mediaId: string): void {
    this.openDetails.emit(mediaId);
  }

  onCheckboxClick(event: MouseEvent, mediaId: string): void {
    event.stopPropagation();
    this.toggleSelection.emit(mediaId);
  }

  trackByMediaId(_: number, media: Media): string {
    return media.id;
  }

  getPreviewUrl(media: Media): string {
    return media.fileUrl || media.filePath;
  }

  getReadableSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  getTypeBadge(media: Media): string {
    switch (media.fileType) {
      case 'image':
        return 'Image';
      case 'video':
        return 'Video';
      case 'document':
        return 'Document';
      case 'audio':
        return 'Audio';
      default:
        return 'File';
    }
  }

  isImage(media: Media): boolean {
    return media.fileType === 'image';
  }
}
