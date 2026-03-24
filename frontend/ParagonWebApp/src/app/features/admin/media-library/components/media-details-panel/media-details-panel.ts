import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Media } from '../../../../../models/media.model';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-media-details-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './media-details-panel.html'
})
export class MediaDetailsPanelComponent {
  @Input() media: Media | null = null;
  @Input() isSaving = false;

  @Output() metadataSave = new EventEmitter<void>();

  onSave(): void {
    this.metadataSave.emit();
  }

  onFieldFocus(context?: unknown): void {
    if (!(context instanceof FocusEvent)) return;
    const target = context.target;
    if (!(target instanceof HTMLElement)) return;

    const container = target.closest('.rounded-\\(--border-radius-md\\)') as HTMLElement | null;
    if (!container) return;

    container.style.boxShadow = 'inset 0 0 0 1.5px #f4b400, 0 0 0 3px rgba(244,180,0,0.12)';
  }

  onFieldBlur(context?: unknown): void {
    if (!(context instanceof FocusEvent)) return;
    const target = context.target;
    if (!(target instanceof HTMLElement)) return;

    const container = target.closest('.rounded-\\(--border-radius-md\\)') as HTMLElement | null;
    if (!container) return;

    container.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,53,0.1)';
  }

  getPreviewUrl(): string {
    if (!this.media) return '';
    return this.media.fileUrl || this.media.filePath;
  }

  getReadableSize(size?: number): string {
    if (!size && size !== 0) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  getDimensions(): string {
    if (!this.media?.width || !this.media?.height) return '—';
    return `${this.media.width} × ${this.media.height}`;
  }

  isImage(): boolean {
    return this.media?.fileType === 'image';
  }
}
