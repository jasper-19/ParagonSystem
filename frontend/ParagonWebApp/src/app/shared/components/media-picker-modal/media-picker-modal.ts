import { Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import { Media, MediaType } from '../../../models/media.model';
import { MediaService } from '../../../core/services/media.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MediaDetailsPanelComponent } from '../../../features/admin/media-library/components/media-details-panel/media-details-panel';
import { MediaGridComponent } from '../../../features/admin/media-library/components/media-grid/media-grid';
import { MediaUploaderComponent } from '../../../features/admin/media-library/components/media-uploader/media-uploader';

type PickerFilterType = 'all' | MediaType;

@Component({
  selector: 'app-media-picker-modal',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule,
    MediaDetailsPanelComponent,
    MediaUploaderComponent,
    MediaGridComponent,
  ],
  templateUrl: './media-picker-modal.html',
})

export class MediaPickerModalComponent implements OnInit {
  @Input() isOpen= false;
  @Input() title = 'Select Media'
  @Input() allowedType: PickerFilterType = 'image' ;

  @Output() close = new EventEmitter<void>();
  @Output() selectMedia = new EventEmitter<Media>();

  mediaList: Media[] = [];
  selectedMedia: Media | null = null;

  searchTerm = '';
  activeType: PickerFilterType = 'image';

  isLoading = false;
  isSubmitting = false;

  constructor(private mediaService: MediaService) {}

  ngOnInit(): void {
    this.activeType = this.allowedType;
    this.loadMedia();
  }

  loadMedia(): void {
    this.isLoading = true;

    this.mediaService.getMedia({
      search: this.searchTerm || undefined,
      type: this.activeType === 'all' ? undefined : this.activeType,
      page: 1,
      limit: 50
    }).subscribe({
      next: (response) => {
        this.mediaList = response.data;

        if (
          this.selectedMedia &&
          !this.mediaList.some(media => media.id === this.selectedMedia?.id)
        ) {
          this.selectedMedia = null;
        }

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.loadMedia();
  }

  onTypeChange(type: PickerFilterType): void {
    this.activeType = type;
    this.loadMedia();
  }

  onToggleSelection(mediaId: string): void {
    const found = this.mediaList.find(media => media.id === mediaId);
    if (!found) return;

    if (this.selectedMedia?.id === mediaId) {
      this.selectedMedia = null;
      return;
    }

    this.selectedMedia = found;
  }

  onOpenDetails(mediaId: string): void {
    const found = this.mediaList.find(media => media.id === mediaId);
    if (!found) return;

    this.selectedMedia = found;
  }

  onUploadFiles(files: File[]): void {
    if (!files.length)  return;

    let completed = 0;

    files.forEach(file => {
      this.mediaService.uploadMedia(file).subscribe({
        next: (result) => {
          if (typeof result === 'number') return;

          if (!this.selectedMedia) {
            this.selectedMedia = result;
          }
        },
        error: () => {
          completed++;

          if (completed === files.length) {
            this.loadMedia();
          }
        },
        complete: () => {
          completed++;

          if (completed === files.length) {
            this.loadMedia();
          }
        }
      });
    });
  }

  onConfirmSelection(): void {
    if (!this.selectedMedia) return;

    this.isSubmitting = true;
    this.selectMedia.emit(this.selectedMedia);
    this.isSubmitting = false;
  }

  onClose(): void {
    this.close.emit();
  }

  isSelected(mediaId: string): boolean {
    return this.selectedMedia?.id === mediaId;
  }
}
