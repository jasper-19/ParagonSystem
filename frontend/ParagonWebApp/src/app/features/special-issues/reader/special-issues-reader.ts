
import { CommonModule } from "@angular/common";
import {
  Component,
  HostListener,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  NgZone
} from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { SpecialIssue } from "../../../models/special-issue.model";
import { SpecialIssueService } from "../../../core/services/special-issue.service";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import { finalize } from "rxjs/operators";

@Component({
  selector: 'app-special-issues-reader',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './special-issues-reader.html',
})
export class SpecialIssueReader implements OnInit, AfterViewInit, OnDestroy {
  /**
   * Container for the PDF reader
   */
  @ViewChild('readerContainer')
  readerContainer!: ElementRef<HTMLDivElement>;

  /**
   * Container for flipbook mode (PageFlip)
   */
  @ViewChild('flipbookContainer')
  flipbookContainer?: ElementRef<HTMLDivElement>;

  /**
   * The special issue being displayed
   */
  issue?: SpecialIssue;

  /**
   * PDF.js document proxy
   */
  pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  currentPage = 1;
  totalPages = 0;

  // Layout
  isSpreadMode = true;
  readonly SPREAD_BREAKPOINT = 1024;

  isLoading = false;
  private viewReady = false;
  private resizeTimeout: any;

  // Flipbook engine (PageFlip / StPageFlip)
  flipbookAvailable = true;
  private pageFlip: any = null;
  private pageFlipPageWidth = 0;
  private pageFlipPageHeight = 0;
  private pageImageUrlCache = new Map<number, string>();

  /**
   * Waits for the next paint frame (double RAF)
   */
  private waitForPaint(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  // Swipe navigation fallback (PageFlip also supports drag/touch)
  private touchStartX = 0;
  private touchStartY = 0;
  private touchDeltaX = 0;
  private isDragging = false;
  private isHorizontalSwipe = false;
  readonly SWIPE_THRESHOLD = 50;


  constructor(
    private route: ActivatedRoute,
    private issueService: SpecialIssueService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}


  /**
   * Initialize the component, load the PDF document
   */
  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) return;

    this.isLoading = true;
    this.issueService
      .getIssueBySlug(slug)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: async (issue) => {
          try {
            this.issue = issue;
            if (!this.issue?.pdfUrl) return;

            // Set PDF.js worker
            (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';

            // Load PDF document
            const loadingTask = pdfjsLib.getDocument(this.issue.pdfUrl);
            this.pdfDoc = await loadingTask.promise;

            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            this.tryInitialRender();
          } catch (err) {
            console.error('Failed to load PDF document:', err);
          }
        },
        error: (err) => {
          console.error('Failed to load special issue:', err);
        },
      });
  }


  /**
   * Called after the view is initialized
   */
  ngAfterViewInit(): void {
    this.viewReady = true;
    this.updateLayoutMode();
    this.tryInitialRender();
  }

  ngOnDestroy(): void {
    this.destroyFlipbook();
  }


  /**
   * Update layout mode (spread or single page) based on window width
   */
  private updateLayoutMode() {
    const width = window.innerWidth;
    this.isSpreadMode = width >= this.SPREAD_BREAKPOINT;
  }


  /**
   * Try to render the initial page(s) if ready
   */
  private tryInitialRender() {
    if (this.viewReady && this.pdfDoc) {
      void this.initFlipbook();
    }
  }

  private destroyFlipbook(): void {
    try {
      if (this.pageFlip?.destroy) this.pageFlip.destroy();
    } catch {}
    this.pageFlip = null;

    for (const url of this.pageImageUrlCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.pageImageUrlCache.clear();
  }

  private bookContainerSize(): { width: number; height: number } {
    const el = this.readerContainer?.nativeElement;
    const width = Math.max(1, Math.floor(el?.clientWidth ?? 1));
    const height = Math.max(1, Math.floor(el?.clientHeight ?? 1));
    return { width, height };
  }

  private async initFlipbook(): Promise<void> {
    if (!this.pdfDoc) return;
    if (!this.viewReady) return;
    if (typeof document === 'undefined') return;
    const containerEl = this.flipbookContainer?.nativeElement;
    if (!containerEl) return;

    // Load PageFlip dynamically.
    let PageFlipCtor: any;
    try {
      const mod: any = await import('page-flip');
      PageFlipCtor = mod?.PageFlip ?? mod?.default?.PageFlip ?? mod?.default;
      if (!PageFlipCtor) throw new Error('PageFlip export not found');
    } catch (e) {
      console.warn('Flipbook mode requires the `page-flip` package.', e);
      this.flipbookAvailable = false;
      this.destroyFlipbook();
      this.cdr.detectChanges();
      return;
    }

    this.flipbookAvailable = true;
    this.destroyFlipbook();

    // Compute page size based on the first PDF page aspect ratio and container space.
    const { width: containerWidth, height: containerHeight } = this.bookContainerSize();
    const firstPage = await this.pdfDoc.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1 });
    const pageAspect = firstViewport.width / firstViewport.height;

    const maxBookWidth = containerWidth;
    const targetBookHeight = Math.floor(containerHeight * 0.95);

    const targetPageWidth = Math.floor(maxBookWidth / (this.isSpreadMode ? 2 : 1));
    let pageWidth = targetPageWidth;
    let pageHeight = Math.floor(pageWidth / pageAspect);

    if (pageHeight > targetBookHeight) {
      pageHeight = targetBookHeight;
      pageWidth = Math.floor(pageHeight * pageAspect);
    }

    this.pageFlipPageWidth = Math.max(1, pageWidth);
    this.pageFlipPageHeight = Math.max(1, pageHeight);

    // Build HTML pages (empty placeholders). We'll render PDF pages lazily into <img> tags.
    containerEl.innerHTML = '';
    const pageElements: HTMLElement[] = [];
    for (let p = 1; p <= this.totalPages; p++) {
      const pageEl = document.createElement('div');
      pageEl.style.width = '100%';
      pageEl.style.height = '100%';
      pageEl.style.background = '#ffffff';
      pageEl.style.display = 'flex';
      pageEl.style.alignItems = 'center';
      pageEl.style.justifyContent = 'center';

      const img = document.createElement('img');
      img.setAttribute('data-page', String(p));
      img.alt = `Page ${p}`;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.userSelect = 'none';
      img.style.pointerEvents = 'none';
      pageEl.appendChild(img);

      pageElements.push(pageEl);
    }

    // Init PageFlip outside Angular to reduce change detection churn.
    this.ngZone.runOutsideAngular(() => {
      this.pageFlip = new PageFlipCtor(containerEl, {
        width: this.pageFlipPageWidth,
        height: this.pageFlipPageHeight,
        size: 'stretch',
        autoSize: true,
        showCover: true,
        mobileScrollSupport: false,
        maxShadowOpacity: 0.5,
      });

      if (this.pageFlip?.loadFromHTML) {
        this.pageFlip.loadFromHTML(pageElements);
      }

      if (this.pageFlip?.on) {
        this.pageFlip.on('flip', (e: any) => {
          const pageIndex = e?.data ?? 0; // 0-based
          const pageNumber = Math.max(1, Math.min(this.totalPages, Number(pageIndex) + 1));
          this.ngZone.run(() => {
            // Keep currentPage aligned with spread label logic.
            if (this.isSpreadMode && pageNumber > 1 && pageNumber % 2 !== 0) {
              this.currentPage = pageNumber - 1;
            } else {
              this.currentPage = pageNumber;
            }
            void this.ensureFlipbookPagesRendered(pageNumber);
            this.cdr.detectChanges();
          });
        });
      }
    });

    // Jump to current page and render initial surrounding pages.
    const initialPage = Math.max(1, Math.min(this.totalPages, this.currentPage));
    if (this.pageFlip?.flip) {
      try {
        this.pageFlip.flip(initialPage - 1);
      } catch {}
    }
    await this.ensureFlipbookPagesRendered(initialPage);
    this.cdr.detectChanges();
  }

  private async ensureFlipbookPagesRendered(centerPage: number): Promise<void> {
    if (!this.pdfDoc) return;
    const containerEl = this.flipbookContainer?.nativeElement;
    if (!containerEl) return;

    const radius = 3;
    const start = Math.max(1, centerPage - radius);
    const end = Math.min(this.totalPages, centerPage + radius);

    for (let p = start; p <= end; p++) {
      if (this.pageImageUrlCache.has(p)) continue;
      const url = await this.renderPdfPageToObjectUrl(p, this.pageFlipPageWidth);
      this.pageImageUrlCache.set(p, url);

      const img = containerEl.querySelector(`img[data-page="${p}"]`) as HTMLImageElement | null;
      if (img) img.src = url;
    }
  }

  private async renderPdfPageToObjectUrl(pageNumber: number, targetWidth: number): Promise<string> {
    if (!this.pdfDoc) throw new Error('PDF not loaded');
    if (typeof document === 'undefined') throw new Error('Document not available');

    const page = await this.pdfDoc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    const task = page.render({ canvasContext: ctx as any, viewport });
    await task.promise;

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/jpeg', 0.92);
    });

    return URL.createObjectURL(blob);
  }

  nextPage() {
    if (this.pageFlip?.flipNext) {
      try {
        this.pageFlip.flipNext();
        return;
      } catch {}
    }
    void this.initFlipbook();
  }

  prevPage() {
    if (this.pageFlip?.flipPrev) {
      try {
        this.pageFlip.flipPrev();
        return;
      } catch {}
    }
    void this.initFlipbook();
  }

  jumpToPage(value: number) {
    const page = Number(value);
    if (!page || page < 1 || page > this.totalPages) return;

    if (this.pageFlip?.flip) {
      try {
        this.pageFlip.flip(page - 1);
        return;
      } catch {}
    }

    void this.initFlipbook();
  }

  /**
   * Whether the next page is available
   */
  get canGoNext() {
    return this.currentPage < this.totalPages;
  }

  //Spread Indicator
   get pageLabel(): string {
    if (!this.totalPages) return  '-';

    if (!this.isSpreadMode) {
      return  `${this.currentPage} / ${this.totalPages}`
    }

    //Spread Mode
    let left = this.currentPage;
    let right = this.currentPage + 1;

    if (right > this.totalPages) {
      return `${left} / ${this.totalPages}`;
    }
    return `${left} - ${right} / ${this.totalPages}`;
   }

  /**
   * Whether the previous page is available
   */
  get canGoPrev() {
    return this.currentPage > 1;
  }

  /**
   * Toggle fullscreen mode for the reader
   */
  toggleFullscreen() {
    const el = this.readerContainer.nativeElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }


  /**
   * Keyboard navigation handler
   */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') this.nextPage();
    if (event.key === 'ArrowLeft') this.prevPage();
    //if (event.key === 'ArrowDown') this.zoomOut();
    //if (event.key === 'ArrowUp') this.zoomIn();
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    if (!event.touches || event.touches.length === 0) return;

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchDeltaX = 0;
    this.isDragging = true;
    this.isHorizontalSwipe = false;
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (!this.isDragging || !event.touches || event.touches.length === 0) return;

    const touch = event.touches[0];

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    // Axis lock detection
    if (!this.isHorizontalSwipe) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        this.isHorizontalSwipe = true;
      } else {
        return;  // Vertical swipe, ignore for page navigation
      }
    }
      this.touchDeltaX = deltaX;
  }

  @HostListener('touchend')
  onTouchEnd() {
    if (!this.isDragging) return;

    if (!this.isSpreadMode) {
    if (this.touchDeltaX < 0) {
      this.nextPage();
    } else {
      this.prevPage();
    }
  }

  if (this.isHorizontalSwipe && Math.abs(this.touchDeltaX) > this.SWIPE_THRESHOLD) {

    if (this.touchDeltaX < 0) {
      // Swipe LEFT → Next page
      this.nextPage();
    } else {
      // Swipe RIGHT → Previous page
      this.prevPage();
    }
  }

  this.resetSwipe();
}

private resetSwipe() {
  this.isDragging = false;
  this.touchDeltaX = 0;
  this.isHorizontalSwipe = false;
}

  /**
   * Handle window resize and update layout/render
   */
  @HostListener('window:resize')
  onResize() {
    if (!this.pdfDoc) return;
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.updateLayoutMode();
      void this.initFlipbook();
    }, 200);
  }
}
