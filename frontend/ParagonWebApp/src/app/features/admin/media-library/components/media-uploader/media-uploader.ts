import { Component, EventEmitter, Output, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-media-uploader',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './media-uploader.html'
})
export class MediaUploaderComponent {
  @Output() filesSelected = new EventEmitter<File[]>();

  readonly isDragging = signal(false);

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
    const validImages = files.filter(
      file =>
        file.type.startsWith('image/')
    );

    if (!validImages.length) {
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
