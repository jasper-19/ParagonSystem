import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Media, MediaType } from '../../../models/media.model';
import { ConfirmationModal } from '../../../shared/components/confirmation-modal/confirmation-modal';
import { ErrorModal } from '../../../shared/components/feedback-modal/error-modal';
import {
  MediaDetailsPanelComponent,
  MediaMetadataDraft,
} from './components/media-details-panel/media-details-panel';
import { MediaGridComponent } from './components/media-grid/media-grid';
import {
  MediaDeleteFailure,
  MediaLibraryStore,
} from './media-library.store';

@Component({
  selector: 'app-media-library',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MediaGridComponent,
    MediaDetailsPanelComponent,
    ConfirmationModal,
    ErrorModal,
  ],
  providers: [MediaLibraryStore],
  templateUrl: './media-library.html',
})
export class MediaLibraryComponent implements OnInit {
  @ViewChild('mobileDetailsPanel')
  private mobileDetailsPanel?: ElementRef<HTMLElement>;

  @ViewChild('mobileDetailsCloseButton')
  private mobileDetailsCloseButton?: ElementRef<HTMLButtonElement>;

  private readonly store = inject(MediaLibraryStore);
  private readonly destroyRef = inject(DestroyRef);
  private lastFocusedElement: HTMLElement | null = null;

  readonly mediaList = this.store.mediaList;
  readonly filteredMedia = this.store.filteredMedia;
  readonly selectedIds = this.store.selectedIdList;
  readonly selectedMedia = this.store.selectedMedia;
  readonly isLoading = this.store.isLoading;
  readonly metadataSaveVersion = this.store.metadataSaveVersion;
  readonly isSavingMetadata = this.store.isSavingMetadata;
  readonly isDetailsPanelOpen = signal(false);
  readonly usesDetailsOverlay = signal(
    typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 1279px)').matches
  );

  errorDetails: string[] = [];
  showDeleteConfirm = false;
  deleteMessage = '';
  showErrorModal = false;
  errorTitle = '';
  errorMessage = '';

  constructor() {
    effect(() => {
      if (!this.isDetailsPanelOpen()) {
        return;
      }

      queueMicrotask(() => {
        this.mobileDetailsCloseButton?.nativeElement.focus();
        if (!this.mobileDetailsCloseButton) {
          this.mobileDetailsPanel?.nativeElement.focus();
        }
      });
    });

    this.initializeViewportTracking();

    effect(onCleanup => {
      const shouldLock =
        this.isDetailsPanelOpen() && this.usesDetailsOverlay();

      if (typeof document === 'undefined' || !shouldLock) {
        return;
      }

      const html = document.documentElement;
      const body = document.body;
      const previousHtmlOverflow = html.style.overflow;
      const previousBodyOverflow = body.style.overflow;
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';

      onCleanup(() => {
        html.style.overflow = previousHtmlOverflow;
        body.style.overflow = previousBodyOverflow;
      });
    });
  }

  ngOnInit(): void {
    this.store.initialize();
  }

  get searchTerm(): string {
    return this.store.searchTerm();
  }

  get activeType(): 'all' | MediaType {
    return this.store.activeType();
  }

  get hasSelection(): boolean {
    return this.store.hasSelection();
  }

  get isSingleSelection(): boolean {
    return this.store.isSingleSelection();
  }

  get isMultiSelection(): boolean {
    return this.store.isMultiSelection();
  }

  loadMedia(): void {
    this.store.refresh();
  }

  onSearchChange(value: string): void {
    this.store.setSearchTerm(value);
  }

  clearSearch(): void {
    this.store.clearSearch();
  }

  onTypeChange(type: 'all' | MediaType): void {
    this.store.setType(type);
  }

  onToggleMediaSelection(mediaId: string): void {
    this.store.toggleSelection(mediaId);
  }

  onSelectSingleMedia(mediaId: string): void {
    const media = this.store.selectSingle(mediaId);
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
    queueMicrotask(() => this.lastFocusedElement?.focus());
  }

  clearSelection(): void {
    this.store.clearSelection();
  }

  isSelected(mediaId: string): boolean {
    return this.store.isSelected(mediaId);
  }

  requestDeleteSelected(): void {
    const count = this.store.selectedIds().size;
    if (!count) {
      return;
    }

    this.deleteMessage =
      count === 1
        ? 'Are you sure you want to delete this media item?'
        : `Are you sure you want to delete these ${count} media files? This action cannot be undone.`;
    this.showDeleteConfirm = true;
  }

  confirmDeleteSelected(): void {
    this.store
      .deleteSelected()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        this.showDeleteConfirm = false;
        if (result.failures.length) {
          this.showDeleteFailures(result.failures);
        }
      });
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  saveMetadata(metadata: MediaMetadataDraft): void {
    this.store.saveMetadata(metadata);
  }

  trackByMediaId(_index: number, media: Media): string {
    return media.id;
  }

  private showDeleteFailures(failures: MediaDeleteFailure[]): void {
    const blocked = failures.filter(failure => failure.status === 409);
    this.errorTitle =
      blocked.length === failures.length
        ? 'Cannot Delete Media'
        : 'Some Media Could Not Be Deleted';
    this.errorMessage =
      blocked.length === failures.length
        ? 'The selected media is currently in use. Remove or replace it before deleting.'
        : `${failures.length} media item(s) could not be deleted.`;
    this.errorDetails = failures.flatMap(failure =>
      failure.usage.length
        ? failure.usage.map(
            usage => usage.title ?? 'Untitled Article'
          )
        : [failure.message]
    );
    this.showErrorModal = true;
  }

  private initializeViewportTracking(): void {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 1279px)');
    const handleViewportChange = (event: MediaQueryListEvent): void => {
      this.usesDetailsOverlay.set(event.matches);
    };

    mediaQuery.addEventListener('change', handleViewportChange);
    this.destroyRef.onDestroy(() => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    });
  }

  private trapDetailsPanelFocus(event: KeyboardEvent): void {
    const panel = this.mobileDetailsPanel?.nativeElement;
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
    ).filter(
      element =>
        element.offsetParent !== null &&
        element.getAttribute('aria-hidden') !== 'true'
    );

    if (!focusableElements.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (
      event.shiftKey &&
      (activeElement === firstElement || activeElement === panel)
    ) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isDetailsPanelOpen() || !this.usesDetailsOverlay()) {
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
