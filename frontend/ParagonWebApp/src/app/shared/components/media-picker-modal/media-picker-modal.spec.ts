import { Component, EventEmitter, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MediaService } from '../../../core/services/media.service';
import { Media, PaginatedMediaResponse } from '../../../models/media.model';
import { MediaUploaderComponent } from '../../../features/admin/media-library/components/media-uploader/media-uploader';
import { MediaPickerModalComponent } from './media-picker-modal';

@Component({ selector: 'app-media-uploader', standalone: true, template: '' })
class UploaderStub {
  @Output() filesSelected = new EventEmitter<File[]>();
}

const image: Media = {
  id: 'cover-one', fileName: 'Campus cover.jpg', filePath: '/fixtures/cover.jpg',
  fileType: 'image', mimeType: 'image/jpeg', size: 2048,
  width: 800, height: 1200, createdAt: '2026-11-14T00:00:00Z',
};
const response = (data: Media[]): PaginatedMediaResponse => ({ data, total: data.length, page: 1, limit: 50 });

describe('Media picker selection and loading', () => {
  let fixture: ComponentFixture<MediaPickerModalComponent>;
  let modal: MediaPickerModalComponent;
  let previousOverflow: string;
  const getMedia = vi.fn();
  const uploadMedia = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    previousOverflow = document.body.style.overflow;
    getMedia.mockReset().mockReturnValue(of(response([image])));
    uploadMedia.mockReset();
    TestBed.configureTestingModule({
      imports: [MediaPickerModalComponent],
      providers: [provideRouter([]), { provide: MediaService, useValue: { getMedia, uploadMedia } }],
    }).overrideComponent(MediaPickerModalComponent, {
      remove: { imports: [MediaUploaderComponent] },
      add: { imports: [UploaderStub] },
    });
    fixture = TestBed.createComponent(MediaPickerModalComponent);
    modal = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    vi.runOnlyPendingTimers();
    document.body.style.overflow = previousOverflow;
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function open(): void {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  }

  function buttonMatching(pattern: RegExp): HTMLButtonElement {
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(item => pattern.test(item.textContent?.trim() ?? ''));
    expect(button).toBeDefined();
    return button!;
  }

  it('wires keyboard selection, deselection, details and confirmation through the real grid', () => {
    const selected = vi.fn();
    modal.selectMedia.subscribe(selected);
    open();
    const confirm = buttonMatching(/^(Select Media|Use selected image)$/i);
    expect(confirm.disabled).toBe(true);
    const option = fixture.nativeElement.querySelector('[role="option"]') as HTMLElement;
    option.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(confirm.disabled).toBe(false);
    option.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(confirm.disabled).toBe(true);
    option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(modal.selectedMedia()).toEqual(image);
    confirm.click();
    expect(selected).toHaveBeenCalledExactlyOnceWith(image);
    expect(modal.isSubmitting()).toBe(false);
  });

  it('debounces image-only searches and prevents an initial response overwriting newer results', () => {
    const initial = new Subject<PaginatedMediaResponse>();
    const searched = new Subject<PaginatedMediaResponse>();
    const cancelled = vi.fn();
    getMedia.mockReturnValueOnce(new Observable<PaginatedMediaResponse>(subscriber => {
      const subscription = initial.subscribe(subscriber);
      return () => { cancelled(); subscription.unsubscribe(); };
    })).mockReturnValueOnce(searched);
    open();
    modal.onSearchChange('  campus ');
    vi.advanceTimersByTime(299);
    expect(getMedia).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(cancelled).toHaveBeenCalledOnce();
    expect(getMedia).toHaveBeenLastCalledWith({ search: 'campus', type: 'image', page: 1, limit: 50 });
    const fresh = { ...image, id: 'fresh-cover' };
    searched.next(response([fresh]));
    initial.next(response([image]));
    expect(modal.mediaList()).toEqual([fresh]);
    modal.onSearchChange('campus');
    vi.advanceTimersByTime(300);
    expect(getMedia).toHaveBeenCalledTimes(2);
  });

  it('shows a recoverable load error rather than an empty library, then retries', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getMedia.mockReturnValueOnce(throwError(() => new Error('Offline')));
    open();
    expect(modal.loadError()).toBeTruthy();
    expect(modal.isLoading()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    buttonMatching(/retry|try again/i).click();
    fixture.detectChanges();
    expect(getMedia).toHaveBeenCalledTimes(2);
    expect(modal.loadError()).toBeFalsy();
    expect(fixture.nativeElement.querySelector('[role="option"]')).not.toBeNull();
  });

  it('uploads files sequentially, ignores progress and reloads after a failed sibling', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = new Subject<number | Media>();
    const second = new Subject<number | Media>();
    uploadMedia.mockReturnValueOnce(first).mockReturnValueOnce(second);
    open();
    modal.onUploadFiles([new File(['a'], 'first.jpg', { type: 'image/jpeg' }), new File(['b'], 'second.jpg', { type: 'image/jpeg' })]);
    expect(uploadMedia).toHaveBeenCalledTimes(1);
    first.next(50);
    expect(modal.selectedMedia()).toBeNull();
    first.next(image);
    first.complete();
    expect(uploadMedia).toHaveBeenCalledTimes(2);
    expect(modal.selectedMedia()).toEqual(image);
    expect(getMedia).toHaveBeenCalledTimes(1);
    second.error(new Error('Upload failed'));
    expect(getMedia).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Could not upload second.jpg');
  });

  it('cancels pending library requests when the dialog component is destroyed', () => {
    const cancelled = vi.fn();
    getMedia.mockReturnValue(new Observable(() => cancelled));
    open();
    fixture.destroy();
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('focuses search, traps Tab, closes on Escape and restores the trigger and scroll state', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    open();
    vi.runOnlyPendingTimers();
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    expect(document.body.style.overflow).toBe('hidden');
    const container = fixture.nativeElement.querySelector('[tabindex="-1"]') as HTMLElement;
    // jsdom has no layout; make real dialog controls visible for the focus trap.
    const controls = Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'));
    controls.forEach(control => Object.defineProperty(control, 'offsetParent', { configurable: true, value: container }));
    const first = controls[0];
    const last = controls[controls.length - 1];
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);
    modal.close.subscribe(() => fixture.componentRef.setInput('isOpen', false));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    vi.runOnlyPendingTimers();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe(previousOverflow);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
