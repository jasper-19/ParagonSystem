import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MediaService } from '../../../core/services/media.service';
import { SocketService } from '../../../core/services/socket.service';
import { Media, PaginatedMediaResponse } from '../../../models/media.model';
import { MediaLibraryStore } from './media-library.store';

describe('Media library workspace state', () => {
  const image: Media = { id: 'sample-image', fileName: 'campus.jpg', filePath: '/sample.jpg', fileType: 'image', mimeType: 'image/jpeg', size: 1024, tags: ['campus'], createdAt: '2026-11-07T00:00:00Z' };
  const document: Media = { ...image, id: 'sample-document', fileName: 'issue.pdf', fileType: 'document', mimeType: 'application/pdf' };
  let store: MediaLibraryStore;
  let service: { getMedia: ReturnType<typeof vi.fn>; updateMedia: ReturnType<typeof vi.fn>; deleteMedia: ReturnType<typeof vi.fn> };
  const response = (data: Media[]): PaginatedMediaResponse => ({ data, total: data.length, page: 1, limit: 100 });

  beforeEach(() => {
    service = { getMedia: vi.fn(() => of(response([image, document]))), updateMedia: vi.fn(), deleteMedia: vi.fn() };
    TestBed.configureTestingModule({ providers: [MediaLibraryStore,
      { provide: MediaService, useValue: service },
      { provide: SocketService, useValue: { onMediaUpdated: vi.fn(() => () => {}) } },
    ] });
    store = TestBed.inject(MediaLibraryStore);
    store.initialize();
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('debounces search, retains the file type and removes selections absent from the result', async () => {
    vi.useFakeTimers();
    store.toggleSelection(image.id);
    store.setType('image');
    service.getMedia.mockReturnValue(of(response([])));
    store.setSearchTerm('  campus  ');
    await vi.advanceTimersByTimeAsync(349);
    expect(service.getMedia).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(service.getMedia).toHaveBeenLastCalledWith({ search: 'campus', type: 'image', page: 1, limit: 100 });
    expect(store.selectedIdList()).toEqual([]);
    expect(store.selectedMedia()).toBeNull();
    expect(store.isSelectionMode()).toBe(false);
    store.clearSearch();
    await vi.advanceTimersByTimeAsync(350);
    expect(service.getMedia).toHaveBeenLastCalledWith({ search: undefined, type: 'image', page: 1, limit: 100 });
  });

  it('saves metadata once while pending, preserving tags and acknowledging the returned record', () => {
    const pending = new Subject<Media>();
    service.updateMedia.mockReturnValue(pending);
    store.selectSingle(image.id);
    store.saveMetadata({ altText: 'Campus entrance', caption: 'A sample caption' });
    store.saveMetadata({ altText: 'Duplicate' });
    expect(service.updateMedia).toHaveBeenCalledTimes(1);
    expect(service.updateMedia).toHaveBeenCalledWith(image.id, { altText: 'Campus entrance', caption: 'A sample caption', tags: ['campus'] });
    expect(store.isSavingMetadata()).toBe(true);
    const updated = { ...image, altText: 'Campus entrance', caption: 'A sample caption' };
    pending.next(updated); pending.complete();
    expect(store.isSavingMetadata()).toBe(false);
    expect(store.selectedMedia()).toEqual(updated);
    expect(store.mediaList()[0]).toEqual(updated);
    expect(store.metadataSaveVersion()).toBe(1);
  });

  it('retains in-use files and their selection when a bulk deletion partially fails', () => {
    store.toggleSelection(image.id); store.toggleSelection(document.id);
    service.deleteMedia.mockImplementation((id: string) => id === image.id
      ? throwError(() => ({ status: 409, error: { error: 'Media is in use', usage: [{ title: 'Sample campus report' }] } }))
      : of(undefined));
    let result: unknown;
    store.deleteSelected().subscribe(value => result = value);
    expect(result).toEqual({ deletedIds: [document.id], failures: [{ id: image.id, status: 409, message: 'Media is in use', usage: [{ title: 'Sample campus report' }] }] });
    expect(store.mediaList()).toEqual([image]);
    expect(store.selectedIdList()).toEqual([image.id]);
    expect(store.selectedMedia()).toEqual(image);
    expect(store.isDeleting()).toBe(false);
  });

  it('exposes a load failure and clears it after a successful retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    service.getMedia.mockReturnValueOnce(throwError(() => new Error('Sample offline failure')));
    store.refresh();
    expect(store.status()).toBe('error');
    expect(store.errorMessage()).toContain('Unable to load');
    expect(store.isLoading()).toBe(false);
    store.refresh();
    expect(store.status()).toBe('loaded');
    expect(store.errorMessage()).toBe('');
    expect(store.mediaList()).toEqual([image, document]);
  });
});
