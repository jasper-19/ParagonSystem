import { Component, OnInit, computed, signal, ViewChild, ElementRef, effect, inject, DestroyRef, HostListener} from "@angular/core";
import { Media, PaginatedMediaResponse } from "../../../models/media.model";
import { MediaService } from "../../../core/services/media.service";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { Subject } from "rxjs";
import { debounceTime, distinctUntilChanged, map } from "rxjs/operators";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MediaGridComponent } from "./components/media-grid/media-grid";
import { MediaDetailsPanelComponent, MediaMetadataDraft } from "./components/media-details-panel/media-details-panel";
import { FormsModule } from "@angular/forms";
import { ConfirmationModal } from "../../../shared/components/confirmation-modal/confirmation-modal";
import { ErrorModal } from "../../../shared/components/feedback-modal/error-modal";
import {SocketService} from "../../../core/services/socket.service";

@Component ({
  selector: 'app-media-library',
  standalone: true,
  imports: [CommonModule,
    RouterModule,
    FormsModule,
    MediaGridComponent,
    MediaDetailsPanelComponent,
    ConfirmationModal,
    ErrorModal
  ],
  templateUrl: './media-library.html',
})

export class MediaLibraryComponent implements OnInit {

  @ViewChild('mobileDetailsPanel')
  private mobileDetailsPanel?: ElementRef<HTMLElement>;

  @ViewChild(
    'mobileDetailsCloseButton'
  )
  private mobileDetailsCloseButton?:
    ElementRef<HTMLButtonElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();

  private lastFocusedElement: HTMLElement | null = null;
  readonly usesDetailsOverlay = signal(
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 1279px)').matches
  );

  readonly mediaList = signal<Media[]>([]);
  readonly selectedIds = signal<string[]>([]);
  readonly selectedMedia = signal<Media | null>(null);
  readonly isLoading = signal(false);
  readonly metadataSaveVersion = signal(0);
  readonly isDetailsPanelOpen = signal(false);

  readonly filteredMedia = computed(
    () => this.mediaList()
  );

  searchTerm: string = ''
  activeType: 'all' | 'image' | 'video' | 'document' | 'audio' = 'all';

  errorDetails: string[]= [];

  isSavingMetadata = false

  showDeleteConfirm = false;
  deleteMessage = ''
  showErrorModal = false;
  errorTitle = '';
  errorMessage = '';

  isSelectionMode = false;

  showBlockedDeleteModal = false;
  blockedDeleteTitle = 'Cannot Delete Media';
  blockedDeleteMessage = '';

  constructor(
    private mediaService: MediaService,
    private socketService: SocketService
  ) {

  this.searchChanges
    .pipe(
      map(value => value.trim()),
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(
        this.destroyRef
      )
    )
    .subscribe(search => {
      this.searchTerm = search;
      this.loadMedia();
    });

  effect(() => {

    if (!this.isDetailsPanelOpen()) {
      return;
    }

  queueMicrotask(() => {
    const closeButton =
      this.mobileDetailsCloseButton
        ?.nativeElement;

    const panel =
      this.mobileDetailsPanel
        ?.nativeElement;

    if (closeButton) {
      closeButton.focus();
      return;
    }

    panel?.focus();
  });

  });

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    const mediaQuery = window.matchMedia(
      '(max-width: 1279px)'
    );

    const handleViewportChange = (
      event: MediaQueryListEvent
    ): void => {
      this.usesDetailsOverlay.set(
        event.matches
      );
    };

    mediaQuery.addEventListener(
      'change',
      handleViewportChange
    );

    this.destroyRef.onDestroy(() => {
      mediaQuery.removeEventListener(
        'change',
        handleViewportChange
      );
    });
  }

  effect(onCleanup => {
    const shouldLock =
      this.isDetailsPanelOpen() &&
      this.usesDetailsOverlay();

    if (
      typeof document === 'undefined' ||
      !shouldLock
    ) {
      return;
    }

    const html = document.documentElement;
    const body = document.body;

    const previousHtmlOverflow =
      html.style.overflow;

    const previousBodyOverflow =
      body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    onCleanup(() => {
      html.style.overflow =
        previousHtmlOverflow;

      body.style.overflow =
        previousBodyOverflow;
    });
  });
  }

ngOnInit(): void {
  this.loadMedia();

  const removeMediaUpdatedListener =
    this.socketService.onMediaUpdated(
      () => {
        this.loadMedia();
      }
    );

  this.destroyRef.onDestroy(() => {
    removeMediaUpdatedListener();
  });
}

  loadMedia(): void {
    this.isLoading.set(true);

    this.mediaService.getMedia({
      search: this.searchTerm || undefined,
      type: this.activeType === 'all' ? undefined : this.activeType,
      page: 1,
      limit: 100,
    }).subscribe({
      next: (response: PaginatedMediaResponse) => {
        this.mediaList.set(response.data);
        this.reconcileSelectionAfterReload();
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        console.error('Error loading media:', err);
        this.isLoading.set(false);
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchChanges.next(value);
  }

  clearSearch(): void {
    if (!this.searchTerm) {
      return;
    }

  this.searchTerm = '';
  this.searchChanges.next('');
}

  onTypeChange(type: 'all' | 'image' | 'video' | 'document' | 'audio'): void {
    this.activeType = type;
    this.loadMedia();
  }

  onToggleMediaSelection(mediaId: string): void {

    this.isSelectionMode = true;

    const alreadySelected = this.selectedIds().includes(mediaId);

    this.selectedIds.set(alreadySelected
      ? this.selectedIds().filter(id => id !== mediaId)
      : [...this.selectedIds(), mediaId]);

    this.syncSelectedMedia();

    if (!this.selectedIds().length) {
      this.isSelectionMode = false;
    }
  }

  onSelectSingleMedia(mediaId: string): void {
    const media =
      this.filteredMedia().find(
        item => item.id === mediaId
      ) ?? null;

    this.selectedMedia.set(media);

    if (!this.isSelectionMode) {
      this.selectedIds.set(
        media ? [mediaId] : []
      );
    }

  this.lastFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    if (media) {
      this.isDetailsPanelOpen.set(true);
    }
  }

  closeDetailsPanel(): void {

    this.isDetailsPanelOpen.set(false);

    queueMicrotask(() => {
      this.lastFocusedElement?.focus();
    });

  }

  clearSelection(): void {
    this.selectedIds.set([]);
    this.selectedMedia.set(null);
    this.isSelectionMode = false;
  }

  isSelected(mediaId: string): boolean {
    return this.selectedIds().includes(mediaId);
  }

  confirmDeleteSelected(): void {
    if (!this.selectedIds().length) return;

    const idsToDelete = [...this.selectedIds()];
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
            if (err.status === 409) {
              this.showMediaInUseError(
                err.error?.usage ?? []
              );
            } else {
              console.error(`Failed to delete media ${id}:`, err);
              this.errorTitle = 'Delete Failed';
              this.errorMessage =
                err.error?.error ??
                'An unexpected error occurred while deleting the media.';
              this.showErrorModal = true;
            }
            finish();
          }
      });
    });
  }

  requestDeleteSelected(): void {
    if (!this.selectedIds().length) return;

    this.deleteMessage =
      this.selectedIds().length === 1
        ? 'Are you sure you want to delete this media item?'
        : `Are you sure you want to delete these ${this.selectedIds().length} media files? This action cannot be undone.`;

    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  saveMetadata(
    metadata: MediaMetadataDraft
  ): void {
    const selectedMedia = this.selectedMedia();

    if (!selectedMedia) return;

    this.isSavingMetadata = true;

    this.mediaService.updateMedia(selectedMedia.id, {
      altText: metadata.altText,
      caption: metadata.caption,
      tags: selectedMedia.tags,
    }).subscribe({
        next: (updatedMedia: Media) => {
          this.selectedMedia.set(updatedMedia);

          this.mediaList.update(list =>
            list.map(media =>
              media.id === updatedMedia.id
                ? updatedMedia
                : media
            )
          );

          this.metadataSaveVersion.update(
            version => version + 1
          );

          this.isSavingMetadata = false;
        },
      error: () => {
        this.isSavingMetadata = false;
      }
    });
  }

  trackByMediaId(_: number, media: Media): string {
    return media.id;
  }

  get hasSelection(): boolean {
    return this.selectedIds().length > 0;
  }

  get isSingleSelection(): boolean {
    return this.selectedIds().length === 1;
  }

  get isMultiSelection(): boolean {
    return this.selectedIds().length > 1;
  }

  private syncSelectedMedia(): void {
    if (this.selectedIds().length === 1) {
      this.selectedMedia.set(
        this.filteredMedia().find(media => media.id === this.selectedIds()[0]) ?? null
      );
      return;
    }

    this.selectedMedia.set(null);
  }

  private reconcileSelectionAfterReload(): void {
    const currentIds = new Set(
      this.filteredMedia().map(media => media.id)
    );

    this.selectedIds.update(ids =>
      ids.filter(id => currentIds.has(id))
    );

    this.syncSelectedMedia();
  }

  private showBlockedDeleteMessage(usage: Array<{ title?: string }> = []): void {
    const articleList = usage
      .map(article => `• ${article.title ?? 'Untitled article'}`)
      .join('\n');

    this.blockedDeleteMessage = articleList
      ? `This media is currently used by published articles:\n\n${articleList}\n\nRemove or replace it from these articles before deleting.`
      : 'This media is currently used by one or more published articles. Remove or replace it before deleting.';

    this.showBlockedDeleteModal = true;
  }

  private showMediaInUseError(
    usage: Array<{ title?: string }>
  ): void {
    this.errorTitle = 'Cannot Delete Media';

    this.errorMessage =
      'This media is currently used by the following published article(s). Remove or replace it before deleting.';

    this.errorDetails = usage.map(
      article => article.title ?? 'Untitled Article'
    );

    this.showErrorModal = true;
  }

  private trapDetailsPanelFocus(
    event: KeyboardEvent
  ): void {
    const panel =
      this.mobileDetailsPanel?.nativeElement;

    if (!panel) {
      return;
    }

    const focusableElements = Array.from(
      panel.querySelectorAll<HTMLElement>(`
        button:not([disabled]),
        a[href],
        input:not([disabled]),
        textarea:not([disabled]),
        select:not([disabled]),
        [tabindex]:not([tabindex="-1"])
      `)
    ).filter(element => {
      return (
        element.offsetParent !== null &&
        element.getAttribute(
          'aria-hidden'
        ) !== 'true'
      );
    });

    if (!focusableElements.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const firstElement =
      focusableElements[0];

    const lastElement =
      focusableElements[
        focusableElements.length - 1
      ];

    const activeElement =
      document.activeElement;

    if (
      event.shiftKey &&
      (
        activeElement === firstElement ||
        activeElement === panel
      )
    ) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (
      !event.shiftKey &&
      activeElement === lastElement
    ) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  @HostListener(
    'document:keydown',
    ['$event']
  )
  onDocumentKeydown(
    event: KeyboardEvent
  ): void {
    if (
      !this.isDetailsPanelOpen() ||
      !this.usesDetailsOverlay()
    ) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDetailsPanel();
      return;
    }

    if (event.key === 'Tab') {
      this.trapDetailsPanelFocus(event);
    }
  }

}
