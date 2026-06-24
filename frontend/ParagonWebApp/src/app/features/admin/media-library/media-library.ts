import { Component, OnInit, ChangeDetectorRef } from "@angular/core";
import { Media, PaginatedMediaResponse } from "../../../models/media.model";
import { MediaService } from "../../../core/services/media.service";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { MediaUploaderComponent } from "./components/media-uploader/media-uploader";
import { MediaGridComponent } from "./components/media-grid/media-grid";
import { MediaDetailsPanelComponent } from "./components/media-details-panel/media-details-panel";
import { FormsModule } from "@angular/forms";
import { ConfirmationModal } from "../../../shared/components/confirmation-modal/confirmation-modal";

@Component ({
  selector: 'app-media-library',
  standalone: true,
  imports: [CommonModule,
    RouterModule,
    FormsModule,
    MediaGridComponent,
    MediaDetailsPanelComponent,
    MediaUploaderComponent,
    ConfirmationModal
  ],
  templateUrl: './media-library.html',
})

export class MediaLibraryComponent implements OnInit {

  mediaList: Media[] = [];
  filteredMedia: Media[] = [];

  selectedIds: string[] = [];
  selectedMedia: Media | null = null;

  searchTerm: string = ''
  activeType: 'all' | 'image' | 'video' | 'document' | 'audio' = 'all';

  isLoading = false
  isSavingMetadata = false

  showDeleteConfirm = false;
  deleteMessage = ''

  isSelectionMode = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private mediaService: MediaService
  ) {}

  ngOnInit(): void {
    this.loadMedia();
  }

  loadMedia(): void {
    this.isLoading = true;

    this.mediaService.getMedia({
      search: this.searchTerm || undefined,
      type: this.activeType === 'all' ? undefined : this.activeType,
      page: 1,
      limit: 100
    }).subscribe({
      next: (response: PaginatedMediaResponse) => {
        console.log("Media response:", response.data);
        this.mediaList = response.data;
        this.filteredMedia = response.data;
        this.reconcileSelectionAfterReload();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Error loading media:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.loadMedia();
  }

  onTypeChange(type: 'all' | 'image' | 'video' | 'document' | 'audio'): void {
    this.activeType = type;
    this.loadMedia();
  }

  onToggleMediaSelection(mediaId: string): void {

    this.isSelectionMode = true;

    const alreadySelected = this.selectedIds.includes(mediaId);

    this.selectedIds = alreadySelected
      ? this.selectedIds.filter(id => id !== mediaId)
      : [...this.selectedIds, mediaId];

    this.syncSelectedMedia();

    if (!this.selectedIds.length) {
      this.isSelectionMode = false;
    }
  }

  onSelectSingleMedia(mediaId: string): void {
    this.selectedMedia =
      this.filteredMedia.find(media => media.id === mediaId) || null;

    if (!this.isSelectionMode) {
      this.selectedIds = [mediaId];
    }
  }

  clearSelection(): void {
    this.selectedIds = [];
    this.selectedMedia = null;
    this.isSelectionMode = false;
  }

  isSelected(mediaId: string): boolean {
    return this.selectedIds.includes(mediaId);
  }

  onUploadFiles(files: File[]): void {
    if (!files.length) return;

    let completed = 0;

    files.forEach(file => {
      this.mediaService.uploadMedia(file).subscribe({
        next: (result) => {
          if (typeof result === 'number') return;

          this.mediaList = [result, ...this.mediaList];
          this.filteredMedia = [result, ...this.filteredMedia];

          this.cdr.detectChanges();
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

  confirmDeleteSelected(): void {
    if (!this.selectedIds.length) return;

    const idsToDelete = [...this.selectedIds];
    let completed = 0;

    const finish = () => {
      completed++;

      if (completed === idsToDelete.length) {
        this.showDeleteConfirm = false;
        this.clearSelection();
        this.loadMedia();
      }
    };

    idsToDelete.forEach(id => {
      this.mediaService.deleteMedia(id).subscribe({
        next: finish,
        error: (err) => {
          console.error(`Failed to delete media ${id}:`, err);
          finish();
        }
      });
    });
  }

  requestDeleteSelected(): void {
    if (!this.selectedIds.length) return;

    this.deleteMessage =
      this.selectedIds.length === 1
        ? 'Are you sure you want to delete this media item?'
        : `Are you sure you want to delete these ${this.selectedIds.length} media files? This action cannot be undone.`;

    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  saveMetadata(): void {
    if (!this.selectedMedia) return;

    this.isSavingMetadata = true;

    this.mediaService.updateMedia(this.selectedMedia.id, {
      altText: this.selectedMedia.altText,
      caption: this.selectedMedia.caption,
      tags: this.selectedMedia.tags
    }).subscribe({
      next: (updatedMedia: Media) => {
        this.selectedMedia = updatedMedia;

        this.mediaList = this.mediaList.map((media: Media) =>
          media.id === updatedMedia.id ? updatedMedia : media
        );

        this.filteredMedia = this.filteredMedia.map((media: Media) =>
          media.id === updatedMedia.id ? updatedMedia : media
        );

        this.isSavingMetadata = false;
      },
      error: (_err: unknown) => {
        this.isSavingMetadata = false;
      }
    });
  }

  trackByMediaId(_: number, media: Media): string {
    return media.id;
  }

  get hasSelection(): boolean {
    return this.selectedIds.length > 0;
  }

  get isSingleSelection(): boolean {
    return this.selectedIds.length === 1;
  }

  get isMultiSelection(): boolean {
    return this.selectedIds.length > 1;
  }

  private syncSelectedMedia(): void {
    if (this.selectedIds.length === 1) {
      this.selectedMedia =
        this.filteredMedia.find((media: Media) => media.id === this.selectedIds[0]) || null;
      return;
    }

    this.selectedMedia = null;
  }

  private reconcileSelectionAfterReload(): void {
    const currentIds = new Set(this.filteredMedia.map((media: Media) => media.id));

    this.selectedIds = this.selectedIds.filter((id: string) => currentIds.has(id));
    this.syncSelectedMedia();
  }
}
