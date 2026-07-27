import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  finalize,
  forkJoin,
  map,
  Observable,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { MediaService } from '../../../core/services/media.service';
import { SocketService } from '../../../core/services/socket.service';
import {
  Media,
  MediaQuery,
  MediaType,
} from '../../../models/media.model';
import { MediaMetadataDraft } from './components/media-details-panel/media-details-panel';

export type MediaLibraryLoadStatus =
  | 'idle'
  | 'loading'
  | 'refreshing'
  | 'loaded'
  | 'error';

export interface MediaDeleteFailure {
  id: string;
  status?: number;
  message: string;
  usage: Array<{ title?: string }>;
}

export interface MediaDeleteResult {
  deletedIds: string[];
  failures: MediaDeleteFailure[];
}

@Injectable()
export class MediaLibraryStore {
  private readonly mediaService = inject(MediaService);
  private readonly socketService = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();
  private readonly searchChanges$ = new Subject<string>();
  private readonly realtimeRefresh$ = new Subject<void>();

  readonly mediaList = signal<Media[]>([]);
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedMedia = signal<Media | null>(null);
  readonly status = signal<MediaLibraryLoadStatus>('idle');
  readonly errorMessage = signal('');
  readonly searchTerm = signal('');
  readonly activeType = signal<'all' | MediaType>('all');
  readonly metadataSaveVersion = signal(0);
  readonly isSavingMetadata = signal(false);
  readonly isDeleting = signal(false);
  readonly isSelectionMode = signal(false);

  readonly filteredMedia = computed(() => this.mediaList());
  readonly selectedIdList = computed(() => [...this.selectedIds()]);
  readonly isLoading = computed(
    () => this.status() === 'loading' || this.status() === 'refreshing'
  );
  readonly hasSelection = computed(() => this.selectedIds().size > 0);
  readonly isSingleSelection = computed(() => this.selectedIds().size === 1);
  readonly isMultiSelection = computed(() => this.selectedIds().size > 1);

  constructor() {
    this.initializeLoading();
    this.initializeSearch();
    this.initializeRealtime();
  }

  initialize(): void {
    this.refresh();
  }

  refresh(): void {
    this.reload$.next();
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
    this.searchChanges$.next(value.trim());
  }

  clearSearch(): void {
    if (!this.searchTerm()) {
      return;
    }

    this.searchTerm.set('');
    this.searchChanges$.next('');
  }

  setType(type: 'all' | MediaType): void {
    if (type === this.activeType()) {
      return;
    }

    this.activeType.set(type);
    this.refresh();
  }

  toggleSelection(mediaId: string): void {
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
    this.isSelectionMode.set(this.selectedIds().size > 0);
    this.syncSelectedMedia();
  }

  selectSingle(mediaId: string): Media | null {
    const media = this.mediaList().find(item => item.id === mediaId) ?? null;

    if (!this.isSelectionMode()) {
      this.selectedIds.set(media ? new Set([media.id]) : new Set());
    }

    this.selectedMedia.set(media);
    return media;
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectedMedia.set(null);
    this.isSelectionMode.set(false);
  }

  saveMetadata(metadata: MediaMetadataDraft): void {
    const selected = this.selectedMedia();
    if (!selected || this.isSavingMetadata()) {
      return;
    }

    this.isSavingMetadata.set(true);
    this.mediaService
      .updateMedia(selected.id, {
        altText: metadata.altText,
        caption: metadata.caption,
        tags: selected.tags,
      })
      .pipe(
        finalize(() => this.isSavingMetadata.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: updatedMedia => {
          this.mediaList.update(list =>
            list.map(media =>
              media.id === updatedMedia.id ? updatedMedia : media
            )
          );
          this.selectedMedia.set(updatedMedia);
          this.metadataSaveVersion.update(version => version + 1);
        },
        error: error => {
          console.error('Unable to save media metadata:', error);
        },
      });
  }

  deleteSelected(): Observable<MediaDeleteResult> {
    const ids = this.selectedIdList();
    if (!ids.length || this.isDeleting()) {
      return of({ deletedIds: [], failures: [] });
    }

    this.isDeleting.set(true);

    return forkJoin(
      ids.map(id =>
        this.mediaService.deleteMedia(id).pipe(
          map(() => ({ id, failure: null as MediaDeleteFailure | null })),
          catchError(error =>
            of({
              id,
              failure: {
                id,
                status: typeof error?.status === 'number' ? error.status : undefined,
                message:
                  error?.error?.error ??
                  'An unexpected error occurred while deleting the media.',
                usage: Array.isArray(error?.error?.usage)
                  ? error.error.usage
                  : [],
              } satisfies MediaDeleteFailure,
            })
          )
        )
      )
    ).pipe(
      map(outcomes => ({
        deletedIds: outcomes
          .filter(outcome => !outcome.failure)
          .map(outcome => outcome.id),
        failures: outcomes
          .map(outcome => outcome.failure)
          .filter((failure): failure is MediaDeleteFailure => failure !== null),
      })),
      map(result => {
        if (result.deletedIds.length) {
          const deleted = new Set(result.deletedIds);
          this.mediaList.update(list =>
            list.filter(media => !deleted.has(media.id))
          );
        }

        const failedIds = new Set(result.failures.map(failure => failure.id));
        this.selectedIds.set(failedIds);
        this.isSelectionMode.set(failedIds.size > 0);
        this.syncSelectedMedia();
        return result;
      }),
      finalize(() => this.isDeleting.set(false))
    );
  }

  isSelected(mediaId: string): boolean {
    return this.selectedIds().has(mediaId);
  }

  private initializeLoading(): void {
    this.reload$
      .pipe(
        switchMap(() => {
          this.status.set(this.mediaList().length ? 'refreshing' : 'loading');
          this.errorMessage.set('');

          const activeType = this.activeType();
          const query: MediaQuery = {
            search: this.searchTerm().trim() || undefined,
            type: activeType === 'all' ? undefined : activeType,
            page: 1,
            limit: 100,
          };

          return this.mediaService.getMedia(query).pipe(
            catchError(error => {
              console.error('Unable to load media library:', error);
              this.status.set('error');
              this.errorMessage.set(
                'Unable to load the media library. Please try again.'
              );
              return of(null);
            }),
            finalize(() => {
              if (this.status() !== 'error') {
                this.status.set('loaded');
              }
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        if (!response) {
          return;
        }

        this.mediaList.set(response.data);
        this.reconcileSelection();
      });
  }

  private initializeSearch(): void {
    this.searchChanges$
      .pipe(
        debounceTime(350),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.refresh());
  }

  private initializeRealtime(): void {
    this.realtimeRefresh$
      .pipe(
        debounceTime(250),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.refresh());

    const removeListener = this.socketService.onMediaUpdated(() => {
      this.realtimeRefresh$.next();
    });

    this.destroyRef.onDestroy(removeListener);
  }

  private reconcileSelection(): void {
    const availableIds = new Set(this.mediaList().map(media => media.id));
    this.selectedIds.update(
      ids => new Set([...ids].filter(id => availableIds.has(id)))
    );
    this.isSelectionMode.set(this.selectedIds().size > 0);
    this.syncSelectedMedia();
  }

  private syncSelectedMedia(): void {
    if (this.selectedIds().size !== 1) {
      this.selectedMedia.set(null);
      return;
    }

    const [selectedId] = this.selectedIds();
    this.selectedMedia.set(
      this.mediaList().find(media => media.id === selectedId) ?? null
    );
  }
}
