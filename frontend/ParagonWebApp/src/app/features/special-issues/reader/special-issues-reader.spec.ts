import { vi } from 'vitest';
import { ChangeDetectorRef, ElementRef, NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { SpecialIssueService } from '../../../core/services/special-issue.service';
import { SpecialIssueReader } from './special-issues-reader';

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ GlobalWorkerOptions: {} }));

describe('SpecialIssueReader lifecycle and navigation', () => {
  let reader: SpecialIssueReader;
  beforeEach(() => {
    reader = new SpecialIssueReader({} as ActivatedRoute, {} as SpecialIssueService,
      { detectChanges: vi.fn(), markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
      { run: (fn: () => void) => fn(), runOutsideAngular: (fn: () => void) => fn() } as NgZone);
  });
  it('labels the cover alone and disables next on the final spread', () => {
    reader.totalPages = 5;
    expect(reader.pageLabel).toBe('1 / 5');
    reader.currentPage = 4;
    expect(reader.pageLabel).toBe('4 - 5 / 5');
    expect(reader.canGoNext).toBe(false);
  });
  it('ignores fractional page jumps and arrow keys in inputs', () => {
    const flip = vi.fn();
    (reader as any).pageFlip = { flip };
    reader.totalPages = 5;
    reader.jumpToPage(1.5);
    expect(flip).not.toHaveBeenCalled();
    const next = vi.spyOn(reader, 'nextPage');
    reader.onKeyDown({ key: 'ArrowRight', target: document.createElement('input') } as unknown as KeyboardEvent);
    expect(next).not.toHaveBeenCalled();
  });
  it('uses one-based page numbers for valid jumps and rejects out-of-range values', () => {
    const flip = vi.fn();
    (reader as any).pageFlip = { flip };
    reader.totalPages = 5;
    reader.jumpToPage(3);
    expect(flip).toHaveBeenCalledExactlyOnceWith(2);
    flip.mockClear();
    for (const page of [0, -1, 6, Number.NaN, Number.POSITIVE_INFINITY]) reader.jumpToPage(page);
    expect(flip).not.toHaveBeenCalled();
  });
  it('shows single-page labels on narrow screens and handles a final unpaired page', () => {
    reader.totalPages = 6;
    reader.currentPage = 3;
    reader.isSpreadMode = false;
    expect(reader.pageLabel).toBe('3 / 6');
    expect(reader.canGoPrev).toBe(true);
    expect(reader.canGoNext).toBe(true);
    reader.isSpreadMode = true;
    reader.currentPage = 6;
    expect(reader.pageLabel).toBe('6 / 6');
    expect(reader.canGoNext).toBe(false);
    reader.currentPage = 1;
    reader.totalPages = 1;
    expect(reader.canGoPrev).toBe(false);
    expect(reader.canGoNext).toBe(false);
  });
  it('navigates with arrow keys while leaving form controls and loading/error states alone', () => {
    reader.totalPages = 5;
    reader.currentPage = 2;
    const next = vi.spyOn(reader, 'nextPage').mockImplementation(() => {});
    const prev = vi.spyOn(reader, 'prevPage').mockImplementation(() => {});
    // Supply targets explicitly because the event is invoked without DOM dispatch.
    const event = (key: string, target: HTMLElement) => ({ key, target, preventDefault: vi.fn() }) as unknown as KeyboardEvent;
    reader.onKeyDown(event('ArrowRight', document.createElement('div')));
    reader.onKeyDown(event('ArrowLeft', document.createElement('div')));
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).toHaveBeenCalledTimes(1);
    for (const tag of ['input', 'textarea', 'select', 'button', 'a']) {
      reader.onKeyDown(event('ArrowRight', document.createElement(tag)));
      reader.onKeyDown(event('ArrowLeft', document.createElement(tag)));
    }
    reader.isLoading = true;
    reader.onKeyDown(event('ArrowRight', document.createElement('div')));
    reader.isLoading = false;
    reader.errorMessage = 'Unable to load';
    reader.onKeyDown(event('ArrowLeft', document.createElement('div')));
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).toHaveBeenCalledTimes(1);
  });
  it('keeps keyboard navigation within the publication and prevents handled arrow scrolling', () => {
    reader.totalPages = 5;
    const next = vi.spyOn(reader, 'nextPage').mockImplementation(() => {});
    const prev = vi.spyOn(reader, 'prevPage').mockImplementation(() => {});
    const key = (value: string) => ({ key: value, target: document.createElement('div'), preventDefault: vi.fn() }) as unknown as KeyboardEvent;
    const left = key('ArrowLeft');
    reader.onKeyDown(left);
    expect(prev).not.toHaveBeenCalled();
    reader.currentPage = 4;
    reader.onKeyDown(key('ArrowRight'));
    expect(next).not.toHaveBeenCalled();
    reader.currentPage = 2;
    const right = key('ArrowRight');
    reader.onKeyDown(right);
    expect(next).toHaveBeenCalledOnce();
    expect(right.preventDefault).toHaveBeenCalledOnce();
    reader.flipbookAvailable = false;
    reader.onKeyDown(key('ArrowRight'));
    expect(next).toHaveBeenCalledOnce();
  });
  it('releases PDF work, timers, and object URLs on exit', () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const cancel = vi.fn();
    const unsubscribe = vi.fn();
    const revoke = vi.fn();
    vi.stubGlobal('URL', { revokeObjectURL: revoke });
    (reader as any).loadingTask = { destroy };
    (reader as any).loadSubscription = { unsubscribe };
    (reader as any).renderTasks.add({ cancel });
    (reader as any).pageImageUrlCache.set(1, 'blob:page');
    reader.ngOnDestroy();
    expect(cancel).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:page');
    vi.unstubAllGlobals();
  });
  it('deduplicates concurrent requests for the same page', async () => {
    reader.pdfDoc = {} as any;
    reader.totalPages = 1;
    reader.flipbookContainer = new ElementRef(document.createElement('div'));
    let complete!: (url: string) => void;
    const render = vi.spyOn(reader as any, 'renderPdfPageToObjectUrl').mockImplementation(() => new Promise<string>(resolve => { complete = resolve; }));
    const first = (reader as any).ensureFlipbookPagesRendered(1);
    const second = (reader as any).ensureFlipbookPagesRendered(1);
    complete('blob:one');
    await Promise.all([first, second]);
    expect(render).toHaveBeenCalledOnce();
  });
  it('renders the visible spread before deferring neighboring pages', async () => {
    vi.useFakeTimers();
    const render = vi.spyOn(reader as any, 'ensureFlipbookPagesRendered').mockResolvedValue(undefined);
    await (reader as any).renderVisibleAndPrefetch(8);
    expect(render).toHaveBeenCalledExactlyOnceWith(8, true);
    await vi.advanceTimersByTimeAsync(100);
    expect(render).toHaveBeenLastCalledWith(8);
    vi.useRealTimers();
  });
  it('zooms without downloading the document again and clamps the supported range', () => {
    const doc = {} as any;
    reader.pdfDoc = doc;
    reader.readerContainer = new ElementRef(document.createElement('div'));
    const render = vi.spyOn(reader as any, 'tryInitialRender').mockResolvedValue(undefined);
    reader.setZoom(99);
    expect(reader.zoom).toBe(3);
    reader.setZoom(3);
    expect(render).toHaveBeenCalledTimes(1);
    reader.setZoom(0);
    expect(reader.zoom).toBe(1);
    expect(reader.pdfDoc).toBe(doc);
  });
  it.each(['render', 'encode'])('releases canvas backing pixels when %s fails', async (failure) => {
    const canvas = document.createElement('canvas');
    const task = { promise: failure === 'render' ? Promise.reject(new Error('render failed')) : Promise.resolve(), cancel: vi.fn() };
    reader.pdfDoc = { getPage: async () => ({ getViewport: () => ({ width: 200, height: 300 }), render: () => task }) } as any;
    const create = vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    vi.spyOn(canvas, 'getContext').mockReturnValue({} as any);
    vi.spyOn(canvas, 'toBlob').mockImplementation(callback => callback(null));
    await expect((reader as any).rasterizePdfPage(1, 200)).rejects.toThrow();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    create.mockRestore();
    vi.restoreAllMocks();
  });

});

describe('SpecialIssueReader accessible controls', () => {
  let fixture: ComponentFixture<SpecialIssueReader>;

  beforeEach(() => {
    vi.spyOn(SpecialIssueReader.prototype, 'ngOnInit').mockResolvedValue(undefined);
    vi.spyOn(SpecialIssueReader.prototype, 'ngAfterViewInit').mockImplementation(() => {});
    TestBed.configureTestingModule({ imports: [SpecialIssueReader], providers: [
      provideRouter([]), { provide: SpecialIssueService, useValue: {} },
    ] });
    fixture = TestBed.createComponent(SpecialIssueReader);
    fixture.componentInstance.totalPages = 5;
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });
  const button = (fixture: ComponentFixture<SpecialIssueReader>, label: string) =>
    fixture.nativeElement.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

  it('keeps page controls available in fullscreen and disables them at publication boundaries', () => {
    const previous = button(fixture, 'Previous page');
    const next = button(fixture, 'Next page');
    const input = fixture.nativeElement.querySelector('input[aria-label="Go to page"]') as HTMLInputElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(input.min).toBe('1');
    expect(input.max).toBe('5');
    const shell = fixture.componentInstance.fullscreenContainer.nativeElement;
    expect(shell.contains(previous)).toBe(true);
    expect(shell.contains(next)).toBe(true);
    expect(shell.contains(input)).toBe(true);
    fixture.componentInstance.currentPage = 4;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('4 - 5 / 5');
  });

  it('wires labelled navigation and jump controls to the flipbook engine', () => {
    const engine = { flipPrev: vi.fn(), flipNext: vi.fn(), flip: vi.fn() };
    (fixture.componentInstance as any).pageFlip = engine;
    fixture.componentInstance.currentPage = 2;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    button(fixture, 'Previous page').click();
    button(fixture, 'Next page').click();
    const input = fixture.nativeElement.querySelector('input[aria-label="Go to page"]') as HTMLInputElement;
    input.value = '5'; input.dispatchEvent(new Event('change'));
    expect(engine.flipPrev).toHaveBeenCalledOnce();
    expect(engine.flipNext).toHaveBeenCalledOnce();
    expect(engine.flip).toHaveBeenCalledWith(4);
  });

  it('disables navigation and page entry while loading, failed, or viewer-unavailable', () => {
    for (const state of [{ isLoading: true, errorMessage: '', flipbookAvailable: true },
      { isLoading: false, errorMessage: 'PDF unavailable', flipbookAvailable: true },
      { isLoading: false, errorMessage: '', flipbookAvailable: false }]) {
      Object.assign(fixture.componentInstance, state, { currentPage: 2 });
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(button(fixture, 'Previous page').disabled).toBe(true);
      expect(button(fixture, 'Next page').disabled).toBe(true);
      expect((fixture.nativeElement.querySelector('input[aria-label="Go to page"]') as HTMLInputElement).disabled).toBe(true);
    }
  });

  it('requests fullscreen for the whole reader and reflects browser fullscreen changes in its label', () => {
    const shell = fixture.componentInstance.fullscreenContainer.nativeElement;
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(shell, 'requestFullscreen', { configurable: true, value: requestFullscreen });
    const originalFullscreen = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    const originalExit = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');
    try {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
      Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
      button(fixture, 'Enter fullscreen').click();
      expect(requestFullscreen).toHaveBeenCalledOnce();
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: shell });
      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();
      button(fixture, 'Exit fullscreen').click();
      expect(exitFullscreen).toHaveBeenCalledOnce();
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();
      expect(button(fixture, 'Enter fullscreen')).not.toBeNull();
    } finally {
      if (originalFullscreen) Object.defineProperty(document, 'fullscreenElement', originalFullscreen);
      else delete (document as any).fullscreenElement;
      if (originalExit) Object.defineProperty(document, 'exitFullscreen', originalExit);
      else delete (document as any).exitFullscreen;
    }
  });
});
