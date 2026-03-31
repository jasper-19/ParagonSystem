import  {Component, EventEmitter, Input, Output} from '@angular/core';
import { Media } from '../../../../../models/media.model';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component ({
  selector: 'app-media-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './media-card.html',
})

export class MediaCardComponent {
  @Input() media!: Media;
  @Input() selected = false;

  @Output() toggleSelection = new EventEmitter<string>();
  @Output() openDetails = new EventEmitter<string>();

  onCardClick(): void {
    this.openDetails.emit(this.media.id);
  }

  onCheckBoxClick(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleSelection.emit(this.media.id);
  }

  get previewUrl(): string {
    return this.media.fileUrl || this.media.filePath;
  }

  get isImage(): boolean {
    return this.media.fileType === 'image';
  }

  get readableSize(): string {
    const size =  this.media.size;

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;

    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  get typeLabel(): string {
    switch (this.media.fileType) {
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'document': return 'Document';
      case 'audio': return 'Audio';
      default: return 'File';
    }
  }
}
