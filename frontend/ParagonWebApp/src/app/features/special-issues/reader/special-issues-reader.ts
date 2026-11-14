import { PageLoaderComponent } from '../../../shared/components/page-loader/page-loader';

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
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Subscription } from "rxjs";
import { ownPageFlipAnimation } from "./page-flip-lifecycle";
import { PdfRenderQueue } from "./pdf-render-queue";

@Component({
  selector: 'app-special-issues-reader',
  standalone: true,
  imports: [CommonModule, RouterModule, PageLoaderComponent],
  templateUrl: './special-issues-reader.html',
  styleUrl: './special-issues-reader.scss',
})
export class SpecialIssueReader implements OnInit, AfterViewInit, OnDestroy {
  /**
   * Container for the PDF reader
   */
  @ViewChild('readerContainer')
  readerContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('fullscreenContainer')
  fullscreenContainer!: ElementRef<HTMLDivElement>;
  isFullscreen = false;

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
  zoom = 1;
  private stopBookAnimation?: () => void;
  private prefetchTimer?: ReturnType<typeof setTimeout>;
  private viewReady = false;
  private resizeTimeout?: ReturnType<typeof setTimeout>;
  errorMessage = '';
  private destroyed = false;
  private loadSubscription?: Subscription;
  private loadingTask?: pdfjsLib.PDFDocumentLoadingTask;
  private generation = 0;
  private initialization = 0;
  private readonly renderQueue = new PdfRenderQueue(2);
  private pendingPages = new Map<number, Promise<void>>();
  private renderTasks = new Set<pdfjsLib.RenderTask>();

  // Flipbook engine (PageFlip / StPageFlip)
  flipbookAvailable = true;
  private pageFlip: any = null;
  private pageFlipPageWidth = 0;
  private pageFlipPageHeight = 0;
  private pageImageUrlCache = new Map<number, string>();

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
    if (!slug) { this.errorMessage = 'Publication not found.'; return; }

    this.isLoading = true;
    this.loadSubscription = this.issueService
      .getIssueBySlug(slug)
      .subscribe({
        next: async (issue) => {
          try {
            if (this.destroyed) return;
            this.issue = issue;
            if (!this.issue?.pdfUrl) throw new Error('PDF unavailable');

            // Set PDF.js worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';

            // Load PDF document
            const loadingTask = this.loadingTask = pdfjsLib.getDocument({
              url: this.issue.pdfUrl,
              // PDF.js 5.7 requires disabling streaming for disableAutoFetch to work.
              // Range-capable stores fetch only needed chunks; others fall back to a full request.
              disableRange: false,
              disableStream: true,
              disableAutoFetch: true,
              rangeChunkSize: 256 * 1024,
              maxImageSize: 40_000_000,
              stopAtErrors: true,
            });
            const doc = await loadingTask.promise;
            if (this.destroyed) return;
            this.pdfDoc = doc;

            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            await this.tryInitialRender();
          } catch (err) {
            if (!this.destroyed) this.errorMessage = 'Unable to load this PDF. Please try again later.';
          } finally {
            if (!this.destroyed) { this.isLoading = false; this.cdr.markForCheck(); }
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = 'This publication could not be loaded.';
          this.cdr.markForCheck();
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
    this.destroyed = true;
    this.initialization++;
    clearTimeout(this.resizeTimeout);
    this.loadSubscription?.unsubscribe();
    this.destroyFlipbook();
    void this.loadingTask?.destroy().catch(() => {});
    this.pdfDoc = null;
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
  private async tryInitialRender(): Promise<void> {
    if (this.viewReady && this.pdfDoc && !this.destroyed) {
      const initialization = this.initialization + 1;
      try { await this.initFlipbook(); }
      catch { if (!this.destroyed && initialization === this.initialization) this.errorMessage = 'Unable to render this PDF. Please reload the publication.'; }
    }
  }

  private destroyFlipbook(): void {
    this.generation++;
    clearTimeout(this.prefetchTimer);
    this.stopBookAnimation?.();
    this.stopBookAnimation = undefined;
    for (const task of this.renderTasks) task.cancel();
    this.renderTasks.clear();
    this.pendingPages.clear();
    this.renderQueue.cancelPending();
    try {
      this.pageFlip?.off?.('flip');
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
    const style = el ? getComputedStyle(el) : null;
    const horizontalPadding = style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 0;
    const verticalPadding = style ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) : 0;
    const width = Math.max(1, Math.floor((el?.clientWidth ?? 1) - horizontalPadding));
    const height = Math.max(1, Math.floor((el?.clientHeight ?? 1) - verticalPadding));
    return { width, height };
  }

  private async initFlipbook(): Promise<void> {
    if (!this.pdfDoc || this.destroyed) return;
    const initialization = ++this.initialization;
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
      if (this.destroyed || initialization !== this.initialization) return;
      this.flipbookAvailable = false;
      this.destroyFlipbook();
      this.cdr.detectChanges();
      return;
    }

    if (this.destroyed || initialization !== this.initialization) return;
    this.flipbookAvailable = true;
    this.destroyFlipbook();

    // Compute page size based on the first PDF page aspect ratio and container space.
    const { width: containerWidth, height: containerHeight } = this.bookContainerSize();
    const firstPage = await this.pdfDoc.getPage(1);
    if (this.destroyed || initialization !== this.initialization) return;
    const generation = this.generation;
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

    this.pageFlipPageWidth = Math.max(1, Math.floor(pageWidth * this.zoom));
    this.pageFlipPageHeight = Math.max(1, Math.floor(pageHeight * this.zoom));

    // Constrain the measured book, not its centering wrapper. PageFlip otherwise
    // chooses a spread on wide, short screens even when single-page mode is set.
    containerEl.style.width = `${this.pageFlipPageWidth * (this.isSpreadMode ? 2 : 1)}px`;
    containerEl.style.height = `${this.pageFlipPageHeight}px`;

    // Build HTML pages (empty placeholders). We'll render PDF pages lazily into <img> tags.
    containerEl.replaceChildren();
    // PageFlip.destroy removes its root; retain the Angular-owned container.
    const bookRoot = document.createElement('div');
    // Let touch/mouse scroll the enlarged pages; controls still turn pages.
    bookRoot.style.pointerEvents = this.zoom > 1 ? 'none' : '';
    containerEl.appendChild(bookRoot);
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
      this.pageFlip = new PageFlipCtor(bookRoot, {
        width: this.pageFlipPageWidth,
        height: this.pageFlipPageHeight,
        size: 'fixed',
        usePortrait: !this.isSpreadMode,
        useMouseEvents: true,
        startPage: Math.max(0, this.currentPage - 1),
        autoSize: true,
        showCover: true,
        mobileScrollSupport: true,
        maxShadowOpacity: 0.5,
      });

      this.stopBookAnimation = ownPageFlipAnimation(this.pageFlip);
      if (this.pageFlip?.loadFromHTML) {
        this.pageFlip.loadFromHTML(pageElements);
      }

      if (this.pageFlip?.on) {
        this.pageFlip.on('flip', (e: any) => {
          if (this.destroyed || generation !== this.generation) return;
          const pageIndex = e?.data ?? 0; // 0-based
          const pageNumber = Math.max(1, Math.min(this.totalPages, Number(pageIndex) + 1));
          this.ngZone.run(() => {
            // Keep currentPage aligned with spread label logic.
            if (this.isSpreadMode && pageNumber > 1 && pageNumber % 2 !== 0) {
              this.currentPage = pageNumber - 1;
            } else {
              this.currentPage = pageNumber;
            }
            void this.renderVisibleAndPrefetch(pageNumber).catch(() => {
              if (!this.destroyed && generation === this.generation) {
                this.errorMessage = 'Unable to render this page. Please reload the publication.';
                this.cdr.markForCheck();
              }
            });
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
    await this.renderVisibleAndPrefetch(initialPage);
    if (!this.destroyed && generation === this.generation) this.cdr.detectChanges();
  }

  private async renderVisibleAndPrefetch(page: number): Promise<void> {
    const generation = this.generation;
    // Display the requested page/spread before spending CPU on neighboring pages.
    await this.ensureFlipbookPagesRendered(page, true);
    if (this.destroyed || generation !== this.generation) return;
    if (this.zoom > 1) {
      // PageFlip places the standalone cover in the right-hand half of a spread.
      // Start panning at that page rather than an enlarged empty left cover slot.
      const stage = this.readerContainer?.nativeElement;
      if (stage) {
        stage.scrollLeft = this.isSpreadMode && this.currentPage === 1 ? this.pageFlipPageWidth : 0;
        stage.scrollTop = 0;
      }
    }
    clearTimeout(this.prefetchTimer);
    this.prefetchTimer = setTimeout(() => {
      if (this.destroyed || generation !== this.generation) return;
      // Prefetch failures must not hide already readable pages; navigation retries them.
      void this.ensureFlipbookPagesRendered(page).catch(() => {});
    }, 100);
  }

  private async ensureFlipbookPagesRendered(centerPage: number, visibleOnly = false): Promise<void> {
    if (!this.pdfDoc) return;
    const containerEl = this.flipbookContainer?.nativeElement;
    if (!containerEl) return;

    const radius = 2;
    const firstVisible = this.isSpreadMode && centerPage > 1 && centerPage % 2 !== 0 ? centerPage - 1 : centerPage;
    const lastVisible = this.isSpreadMode && firstVisible > 1 ? firstVisible + 1 : firstVisible;
    const start = Math.max(1, visibleOnly ? firstVisible : centerPage - radius);
    const end = Math.min(this.totalPages, visibleOnly ? lastVisible : centerPage + radius);

    const generation = this.generation;
    for (let p = start; p <= end; p++) {
      if (this.destroyed || generation !== this.generation) return;
      if (this.pageImageUrlCache.has(p)) continue;
      let pending = this.pendingPages.get(p);
      if (!pending) {
        pending = this.renderPdfPageToObjectUrl(p, this.pageFlipPageWidth).then(url => {
          if (!url) return;
          if (this.destroyed || generation !== this.generation) { URL.revokeObjectURL(url); return; }
          this.pageImageUrlCache.set(p, url);
          const img = containerEl.querySelector('img[data-page="' + p + '"]') as HTMLImageElement | null;
          if (img) img.src = url;
        }).finally(() => { if (generation === this.generation) this.pendingPages.delete(p); });
        this.pendingPages.set(p, pending);
      }
      await pending;
    }
    if (generation !== this.generation) return;
    for (const [page, url] of this.pageImageUrlCache) {
      if (Math.abs(page - this.currentPage) <= 6) continue;
      URL.revokeObjectURL(url);
      this.pageImageUrlCache.delete(page);
      containerEl.querySelector('img[data-page="' + page + '"]')?.removeAttribute('src');
    }
  }

  private renderPdfPageToObjectUrl(pageNumber: number, targetWidth: number): Promise<string> {
    const generation = this.generation;
    return this.renderQueue.run(() => {
      if (this.destroyed || generation !== this.generation || Math.abs(pageNumber - this.currentPage) > 4) return Promise.resolve('');
      return this.rasterizePdfPage(pageNumber, targetWidth);
    });
  }

  private async rasterizePdfPage(pageNumber: number, targetWidth: number): Promise<string> {
    if (!this.pdfDoc) throw new Error('PDF not loaded');
    if (typeof document === 'undefined') throw new Error('Document not available');

    const generation = this.generation;
    const page = await this.pdfDoc.getPage(pageNumber);
    if (this.destroyed || generation !== this.generation) throw new Error('Render cancelled');
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(targetWidth / baseViewport.width, 4096 / baseViewport.width, 4096 / baseViewport.height, Math.sqrt(8_000_000 / (baseViewport.width * baseViewport.height)));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      const task = page.render({ canvas, canvasContext: ctx, viewport });
      this.renderTasks.add(task);
      try { await task.promise; } finally { this.renderTasks.delete(task); }
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/jpeg', 0.92);
      });
      return URL.createObjectURL(blob);
    } finally {
      // Also release backing pixels when rendering, cancellation, or encoding fails.
      canvas.width = canvas.height = 0;
    }
  }

  setZoom(value: number): void {
    if (!this.pdfDoc || this.isLoading || !Number.isFinite(value)) return;
    const zoom = Math.max(1, Math.min(3, Math.round(value * 4) / 4));
    if (zoom === this.zoom) return;
    this.zoom = zoom;
    this.readerContainer.nativeElement.scrollTo?.({ left: 0, top: 0 });
    void this.tryInitialRender();
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
    if (!Number.isInteger(page) || page < 1 || page > this.totalPages) return;

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
    return !this.isLoading && (this.isSpreadMode && this.currentPage > 1 ? this.currentPage + 1 < this.totalPages : this.currentPage < this.totalPages);
  }

  //Spread Indicator
   get pageLabel(): string {
    if (!this.totalPages) return  '-';

    if (!this.isSpreadMode || this.currentPage === 1) {
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
    const el = this.fullscreenContainer?.nativeElement ?? this.readerContainer.nativeElement;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  }


  /**
   * Keyboard navigation handler
   */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.isLoading || this.errorMessage || !this.flipbookAvailable || (event.target instanceof HTMLElement && (event.target.isContentEditable || !!event.target.closest('input, textarea, select, button, a')))) return;
    if (event.key === 'ArrowRight' && this.canGoNext) {
      event.preventDefault();
      this.nextPage();
    }
    if (event.key === 'ArrowLeft' && this.canGoPrev) {
      event.preventDefault();
      this.prevPage();
    }
  }

  /**
   * Handle window resize and update layout/render
   */
  @HostListener('document:fullscreenchange')
  @HostListener('window:resize')
  onResize() {
    this.isFullscreen = !!this.fullscreenContainer && document.fullscreenElement === this.fullscreenContainer.nativeElement;
    if (!this.pdfDoc) return;
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.updateLayoutMode();
      void this.tryInitialRender();
    }, 200);
  }
}
