import { NgIf, NgClass } from '@angular/common';
import {Component, EventEmitter, Input, Output, signal, ElementRef, ViewChild} from '@angular/core';

import { Media } from '../../../../../models/media.model';
import { MediaService } from '../../../../../core/services/media.service';
import { MediaPickerModalComponent } from '../../../../../shared/components/media-picker-modal/media-picker-modal';

@Component({
  selector: 'app-cover-image-selector',
  standalone: true,
  imports: [NgIf, NgClass, MediaPickerModalComponent],
  templateUrl: './cover-image-selector.html',
})

export class CoverImagSelectorComponent {
  @Input() label = 'Cover Image';
  @Input() labelClass = 'text-sm font-medium text-slate-800';
  @Input() selectedMedia: Media | null = null;
  @Input() helperText = "Upload a new image or choose an existing one from the media library.";
  @Input() required = false;
  @Input() aspectClass = 'aspect-square';
  @Input() showFileInfo = true;

  @Output() mediaChange = new EventEmitter<Media | null>();

  @ViewChild('selectorContainer')
  private selectorContainer?: ElementRef<HTMLElement>;

  private readonly maxImageSizeBytes = 2 * 1024 * 1024; // 2MB

  private readonly allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif']);

  private lastUploadedFileFingerprint: string | null = null;

  readonly isPickerOpen = signal(false);
  readonly isUploading = signal(false);
  readonly isDragging = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly uploadProgress = signal(0);
  readonly isPreviewVisible = signal(true);

  private dragDepth = 0;

  constructor(private mediaService: MediaService) {}

  openMediaPicker(): void {
    this.isPickerOpen.set(true);
  }

  openPicker(): void {
    this.openMediaPicker();
  }

  closePicker(): void {
    this.isPickerOpen.set(false);
  }

  onMediaSelected(media: Media): void {
    this.lastUploadedFileFingerprint = null;
    this.uploadError.set(null);
    this.applySelectedMedia(media);
    this.closePicker();
  }

onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  input.value = '';

  if (!file) {
    return;
  }

  this.processImageFile(file);
}

  removeImage(): void {
    this.lastUploadedFileFingerprint = null;
    this.uploadError.set(null);
    this.selectedMedia = null;
    this.mediaChange.emit(null);
    this.restoreSelectorFocus();
  }

  get previewUrl(): string {
    if (!this.selectedMedia) return '';
    return this.selectedMedia.fileUrl || this.selectedMedia.filePath;
  }

  get hasImage(): boolean {
    return !!this.selectedMedia;
  }

  onDragEnter(event: DragEvent): void {
    if (this.isUploading()) {
      return;
    }

    if (!this.containsFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.dragDepth++;
    this.isDragging.set(true);
  }

  onDragOver(event: DragEvent): void {
    if (this.isUploading()) {
      return;
    }

    if (!this.containsFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.isDragging.set(true);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragDepth = Math.max(
      0,
      this.dragDepth - 1
    );

    if (this.dragDepth === 0) {
      this.isDragging.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    if (this.isUploading()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.dragDepth = 0;
    this.isDragging.set(false);

    const files = Array.from(
      event.dataTransfer?.files ?? []
    );

    if (!files.length) {
      return;
    }

    if (files.length > 1) {
      this.uploadError.set(
        'Please drop only one cover image at a time.'
      );
      return;
    }

    this.processImageFile(files[0]);
  }

  private containsFiles(event: DragEvent): boolean {
    return Array.from(
      event.dataTransfer?.types ?? []
    ).includes('Files');
  }

  private processImageFile(
    file: File
  ): void {
    this.dragDepth = 0;
    this.isDragging.set(false);
    this.uploadError.set(null);

    if (this.isUploading()) {
      return;
    }

    if (
      !this.allowedImageTypes.has(
        file.type
      )
    ) {
      this.uploadError.set(
        'Please select a JPEG, PNG, WebP, or AVIF image.'
      );
      return;
    }

    if (
      file.size >
      this.maxImageSizeBytes
    ) {
      this.uploadError.set(
        'The cover image must be 2 MB or smaller.'
      );
      return;
    }

  const fingerprint =
    this.getFileFingerprint(file);

  if (
    fingerprint ===
    this.lastUploadedFileFingerprint
  ) {
    this.uploadError.set(
      'This image is already selected as the article cover.'
    );
    return;
  }

  this.uploadFile(file, fingerprint);

  }

  private uploadFile(
    file: File,
    fingerprint: string
  ): void {
    this.isUploading.set(true);
    this.uploadProgress.set(0);

    this.mediaService
      .uploadMedia(file)
      .subscribe({
        next: result => {
          if (typeof result === 'number') {
            this.uploadProgress.set(result);
            return;
          }

          this.lastUploadedFileFingerprint = fingerprint;

          this.uploadError.set(null);
          this.applySelectedMedia(result);
        },
        error: error => {
          console.error(
            'Error uploading cover image:',
            error
          );

          this.uploadError.set(
            error?.error?.error ??
            'The cover image could not be uploaded. Please try again.'
          );

          this.isUploading.set(false);
          this.uploadProgress.set(0);
        },
        complete: () => {
          this.isUploading.set(false);

          window.setTimeout(() => {
            this.uploadProgress.set(0);
          }, 400);
        },
      });
  }

  private getFileFingerprint(file: File): string {
    return [
      file.name,
      file.size,
      file.type,
      file.lastModified,
    ].join('|');
  }

  private applySelectedMedia(
    media: Media
  ): void {
    if (this.prefersReducedMotion()) {
      this.selectedMedia = media;
      this.mediaChange.emit(media);
      this.isPreviewVisible.set(true);
      this.restoreSelectorFocus();
      return;
    }

    this.isPreviewVisible.set(false);

    window.setTimeout(() => {
      this.selectedMedia = media;
      this.mediaChange.emit(media);

      requestAnimationFrame(() => {
        this.isPreviewVisible.set(true);
        this.restoreSelectorFocus();
      });
    }, 150);
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    );
  }

  private restoreSelectorFocus(): void {
    queueMicrotask(() => {
      this.selectorContainer
        ?.nativeElement
        .focus({
          preventScroll: true
        });
    });
  }

}
