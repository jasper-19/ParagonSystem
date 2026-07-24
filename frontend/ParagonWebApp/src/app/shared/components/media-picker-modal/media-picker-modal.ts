import { Component, EventEmitter, Input, OnInit, Output, HostListener, Inject, OnChanges, OnDestroy, SimpleChanges, inject, DestroyRef, signal, AfterViewInit, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, map, of, switchMap } from 'rxjs';
import { Media } from '../../../models/media.model';
import { MediaService } from '../../../core/services/media.service';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MediaDetailsPanelComponent } from '../../../features/admin/media-library/components/media-details-panel/media-details-panel';
import { MediaGridComponent } from '../../../features/admin/media-library/components/media-grid/media-grid';
import { MediaUploaderComponent } from '../../../features/admin/media-library/components/media-uploader/media-uploader';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

export class MediaPickerModalComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() isOpen= false;
  @Input() title = 'Select Media'

  @Output() close = new EventEmitter<void>();
  @Output() selectMedia = new EventEmitter<Media>();

  @ViewChild('dialogContainer')
  private dialogContainer?: ElementRef<HTMLElement>;

  @ViewChild('searchInput')
  private searchInput?: ElementRef<HTMLInputElement>;

  private previouslyFocusedElement: HTMLElement | null = null;
  private viewInitialized = false;

  readonly mediaList = signal<Media[]>([]);
  readonly selectedMedia = signal<Media | null>(null);

  readonly searchTerm = signal('');
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  private previousBodyOverflow = '';

  constructor(
  private mediaService: MediaService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.setupSearch();
    this.loadMedia();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['isOpen']) return;

    if (this.isOpen) {
      this.previouslyFocusedElement =
        this.document.activeElement instanceof HTMLElement
          ? this.document.activeElement
          : null;

      this.lockBackgroundScroll();

      if (this.viewInitialized) {
        this.focusInitialElement();
      }
    } else {
      this.unlockBackgroundScroll();
      this.restorePreviousFocus();
    }
  }

  ngOnDestroy(): void {
    this.unlockBackgroundScroll();
    this.restorePreviousFocus();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;

    if (this.isOpen) {
      this.focusInitialElement();
    }
  }

  loadMedia(): void {
    this.isLoading.set(true);

    this.mediaService.getMedia({
      search: this.searchTerm().trim() || undefined,
      type: 'image',
      page: 1,
      limit: 50
    })
    .pipe(
      finalize(() => {
        this.isLoading.set(false);
      })
    )
    .subscribe({
      next: response => {
        this.mediaList.set(response.data);
        this.validateSelectedMedia();
      },
      error: error => {
        console.error('Failed to load media:', error);
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.searchSubject.next(value);
  }

  onToggleSelection(mediaId: string): void {
    const currentSelection =
      this.selectedMedia();

    if (
      currentSelection?.id === mediaId
    ) {
      this.selectedMedia.set(null);
      return;
    }

  this.selectMediaById(mediaId);
}

  onOpenDetails(mediaId: string): void {
    this.selectMediaById(mediaId);
  }

  onUploadFiles(files: File[]): void {
    if (!files.length)  return;

    let completed = 0;

    files.forEach(file => {
      this.mediaService.uploadMedia(file).subscribe({
        next: (result) => {
          if (typeof result === 'number') return;

          if (!this.selectedMedia()) {
            this.selectedMedia.set(result);
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
    const selected = this.selectedMedia();
    if (!selected) return;

    this.isSubmitting.set(true);
    this.selectMedia.emit(selected);
    this.isSubmitting.set(false);
  }

  onClose(): void {
    this.close.emit();
  }

isSelected(mediaId: string): boolean {
  return this.selectedMedia()?.id === mediaId;
}

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const container = this.dialogContainer?.nativeElement;
    if (!container) return;

    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          'a[href]',
          '[tabindex]:not([tabindex="-1"])'
        ].join(',')
      )
    ).filter(element => {
      return (
        !element.hasAttribute('hidden') &&
        element.getAttribute('aria-hidden') !== 'true' &&
        element.offsetParent !== null
      );
    });

    if (!focusableElements.length) {
      event.preventDefault();
      container.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = this.document.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  private isScrollLocked = false;

  private lockBackgroundScroll(): void {
    if (this.isScrollLocked) return;

    const body = this.document.body;

    this.previousBodyOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    this.isScrollLocked = true;
  }

  private focusInitialElement(): void {
    setTimeout(() => {
      const target =
        this.searchInput?.nativeElement ??
        this.dialogContainer?.nativeElement;

      target?.focus();
    });
  }

  private restorePreviousFocus(): void {
    const target = this.previouslyFocusedElement;

    this.previouslyFocusedElement = null;

    if (!target || !this.document.contains(target)) {
      return;
    }

    setTimeout(() => {
      target.focus();
    });
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(
        map(value => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(search => {
          this.isLoading.set(true);

          return this.mediaService.getMedia({
            search: search || undefined,
            type: 'image',
            page: 1,
            limit: 50
          }).pipe(
            catchError(error => {
              console.error('Failed to search media:', error);

              return of({
                data: [],
                pagination: {
                  page: 1,
                  limit: 50,
                  total: 0,
                  totalPages: 0
                }
              });
            }),
            finalize(() => {
              this.isLoading.set(false);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.mediaList.set(response.data);
        this.validateSelectedMedia();
      });
  }

  private validateSelectedMedia(): void {
    const selected = this.selectedMedia();

    if (
      selected &&
      !this.mediaList().some(media => media.id === selected.id)
    ) {
      this.selectedMedia.set(null);
    }
  }

  private unlockBackgroundScroll(): void {
    if (!this.isScrollLocked) return;

    this.document.body.style.overflow = this.previousBodyOverflow;
    this.isScrollLocked = false;
  }

  private selectMediaById(mediaId: string): void {
    const media = this.mediaList().find(
      (item: Media) => item.id === mediaId
    );

    if (!media) {
      return;
    }

    this.selectedMedia.set(media);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.onClose();
    }
  }
}
