import { Component, EventEmitter, Output, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GlobalSettingsService } from '../../../../../core/services/global-settings.service';
@Component({
  selector: 'app-media-uploader',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './media-uploader.html'
})
export class MediaUploaderComponent {
  private readonly globalSettings = inject(GlobalSettingsService);
  @Output() filesSelected = new EventEmitter<File[]>();

  readonly isDragging = signal(false);
  readonly validationError = signal('');
  readonly policy = computed(() => this.globalSettings.settings()?.publishingMedia);
  readonly acceptedImages = computed(() =>
    (this.policy()?.allowedMimeTypes ?? ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
      .filter(type => type.startsWith('image/')),
  );
  readonly acceptFormats = computed(() => this.acceptedImages().join(','));

  private dragDepth = 0;

  onFileInputChange(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    const files = Array.from(
      input.files ?? []
    );

    this.emitValidFiles(files);

    input.value = '';
  }

  private containsFiles(
    event: DragEvent
  ): boolean {
    return Array.from(
      event.dataTransfer?.types ?? []
    ).includes('Files');
  }

  private emitValidFiles(
    files: File[]
  ): void {
    this.validationError.set('');
    const allowed = new Set(this.acceptedImages());
    const maxBytes = (this.policy()?.maxUploadSizeMb ?? 25) * 1024 * 1024;
    const validImages = files.filter(
      file =>
        allowed.has(file.type) && file.size <= maxBytes
    );

    if (!validImages.length) {
      this.validationError.set(
        `Select an allowed image no larger than ${this.policy()?.maxUploadSizeMb ?? 25} MB.`
      );
      return;
    }

    this.filesSelected.emit(validImages);
  }

  @HostListener('document:dragenter', ['$event'])
  onDocumentDragEnter(event: DragEvent): void {
    if (!this.containsFiles(event)) {
      return;
    }

    event.preventDefault();

    this.dragDepth++;
    this.isDragging.set(true);
  }

  @HostListener('document:dragover', ['$event'])
  onDocumentDragOver(event: DragEvent): void {
    if (!this.containsFiles(event)) {
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  @HostListener('document:dragleave', ['$event'])
  onDocumentDragLeave(event: DragEvent): void {
    if (!this.containsFiles(event)) {
      return;
    }

    event.preventDefault();

    this.dragDepth = Math.max(
      0,
      this.dragDepth - 1
    );

    if (this.dragDepth === 0) {
      this.isDragging.set(false);
    }
  }

  @HostListener('document:drop', ['$event'])
  onDocumentDrop(event: DragEvent): void {
    event.preventDefault();

    this.dragDepth = 0;
    this.isDragging.set(false);

    const files = Array.from(
      event.dataTransfer?.files ?? []
    );

    this.emitValidFiles(files);
  }
}
