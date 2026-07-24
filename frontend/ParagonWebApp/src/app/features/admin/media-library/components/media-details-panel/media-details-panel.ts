import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, signal } from '@angular/core';
import { Media } from '../../../../../models/media.model';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface MediaMetadataDraft {
  altText?: string;
  caption?: string;
}

@Component({
  selector: 'app-media-details-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './media-details-panel.html'
})
export class MediaDetailsPanelComponent implements OnChanges {
  @Input() media: Media | null = null;
  @Input() isSaving = false;
  @Input() editable = true;
  @Input() saveVersion = 0;

  @Output() metadataSave =
    new EventEmitter<MediaMetadataDraft>();

  private lastSaveVersion = 0;

  readonly altTextDraft = signal('');
  readonly captionDraft = signal('');

  private readonly savedAltText = signal('');
  private readonly savedCaption = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['media']) {
      this.syncDraftFromMedia();
    }

    if (
      changes['saveVersion'] &&
      this.saveVersion !== this.lastSaveVersion
    ) {
      this.lastSaveVersion = this.saveVersion;
      this.markCurrentDraftAsSaved();
    }
  }

  private syncDraftFromMedia(): void {
    const altText =
      this.media?.altText ?? '';

    const caption =
      this.media?.caption ?? '';

    this.altTextDraft.set(altText);
    this.captionDraft.set(caption);

    this.savedAltText.set(altText);
    this.savedCaption.set(caption);
  }

  hasMetadataChanges(): boolean {
    return (
      this.altTextDraft().trim() !==
        this.savedAltText().trim() ||
      this.captionDraft().trim() !==
        this.savedCaption().trim()
    );
  }

  private normalizeOptionalText(
    value: string
  ): string | undefined {
    const normalized = value.trim();

    return normalized || undefined;
  }

  private markCurrentDraftAsSaved(): void {
    this.savedAltText.set(
      this.altTextDraft().trim()
    );

    this.savedCaption.set(
      this.captionDraft().trim()
    );
  }

  onSave(): void {
    if (
      !this.media ||
      this.isSaving ||
      !this.hasMetadataChanges()
    ) {
      return;
    }

    this.metadataSave.emit({
      altText: this.normalizeOptionalText(
        this.altTextDraft()
      ),
      caption: this.normalizeOptionalText(
        this.captionDraft()
      ),
    });
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

  markSaveSuccessful(
    metadata: MediaMetadataDraft
  ): void {
    const altText =
      metadata.altText ?? '';

    const caption =
      metadata.caption ?? '';

    this.altTextDraft.set(altText);
    this.captionDraft.set(caption);

    this.savedAltText.set(altText);
    this.savedCaption.set(caption);
  }

  markSaveFailed(): void {
    // Keep the current drafts unchanged.
    // Because saved values were not advanced,
    // the component remains dirty and can retry.
  }

}
