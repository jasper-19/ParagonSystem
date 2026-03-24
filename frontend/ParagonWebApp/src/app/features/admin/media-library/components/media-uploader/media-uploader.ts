import { Component, EventEmitter, Output } from '@angular/core';
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

  isDragging = false;

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.filesSelected.emit(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    this.filesSelected.emit(Array.from(files));
  }
}
