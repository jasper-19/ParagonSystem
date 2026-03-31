import { NgIf } from '@angular/common';
import {Component, EventEmitter, Input, Output} from '@angular/core';

import { Media } from '../../../../../models/media.model';
import { MediaService } from '../../../../../core/services/media.service';
import { MediaPickerModalComponent } from '../../../../../shared/components/media-picker-modal/media-picker-modal';

@Component({
  selector: 'app-cover-image-selector',
  standalone: true,
  imports: [NgIf, MediaPickerModalComponent],
  templateUrl: './cover-image-selector.html',
})

export class CoverImagSelectorComponent {
  @Input() label = 'Cover Image';
  @Input() labelClass = 'text-sm font-medium text-slate-800';
  @Input() selectedMedia: Media | null = null;
  @Input() helperText = "Upload a a new image or choose an existing one from the media library.";
  @Input() required = false;
  @Input() aspectClass = 'aspect-square';
  @Input() showFileInfo = true;

  @Output() mediaChange = new EventEmitter<Media | null>();

  isPickerOpen = false;
  isUploading = false;

  constructor(private mediaService: MediaService) {}

  openMediaPicker() {
    this.isPickerOpen = true;
  }

  openPicker(): void {
    this.openMediaPicker();
  }

  closePicker() {
    this.isPickerOpen = false;
  }

  onMediaSelected(media: Media): void {
    this.selectedMedia = media;
    this.mediaChange.emit(media);
    this.closePicker();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.isUploading) {
      input.value = '';
      return;
    }

    this.isUploading = true;

    this.mediaService.uploadMedia(file).subscribe({
      next: (result) => {
        if (typeof result !== 'number') {
          this.selectedMedia = result;
          this.mediaChange.emit(result);
          this.isUploading = false;
        }
      },
      error: (err) => {
        console.error('Error uploading media:', err);
        this.isUploading = false;
      },
      complete: () => {
        this.isUploading = false;
      }
    });

    input.value = '';
  }

  removeImage(): void {
    this.selectedMedia = null;
    this.mediaChange.emit(null);
  }

  get previewUrl(): string {
    if (!this.selectedMedia) return '';
    return this.selectedMedia.fileUrl || this.selectedMedia.filePath;
  }

  get hasImage(): boolean {
    return !!this.selectedMedia;
  }
}
