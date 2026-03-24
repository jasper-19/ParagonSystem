import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { Media, MediaQuery, PaginatedMediaResponse } from '../../models/media.model';
@Injectable({
  providedIn: 'root'
})
export class MediaService {

  // 🔹 TEMP STORAGE (replace later with API)
  private mediaList: Media[] = this.generateMockData();

  // ===============================
  // GET MEDIA
  // ===============================
  getMedia(query?: MediaQuery): Observable<PaginatedMediaResponse> {
    let data = [...this.mediaList];

    // 🔍 Search
    if (query?.search) {
      data = data.filter(m =>
        m.fileName.toLowerCase().includes(query.search!.toLowerCase())
      );
    }

    // 🗂 Filter by type
    if (query?.type) {
      data = data.filter(m => m.fileType === query.type);
    }

    // 📄 Pagination
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const start = (page - 1) * limit;
    const paginated = data.slice(start, start + limit);

    return of({
      data: paginated,
      total: data.length,
      page,
      limit
    });
  }

  // ===============================
  // UPLOAD MEDIA (FAKE BUT REALISTIC)
  // ===============================
  uploadMedia(file: File): Observable<Media> {
    const newMedia: Media = {
      id: uuidv4(),
      fileName: file.name,
      filePath: URL.createObjectURL(file),
      fileUrl: URL.createObjectURL(file),

      fileType: this.detectType(file.type),
      mimeType: file.type,
      size: file.size,

      createdAt: new Date().toISOString()
    };

    this.mediaList.unshift(newMedia);

    return of(newMedia);
  }

  // ===============================
  // DELETE
  // ===============================
  deleteMedia(id: string): Observable<void> {
    this.mediaList = this.mediaList.filter(m => m.id !== id);
    return of(void 0);
  }

  // ===============================
  // UPDATE (metadata only)
  // ===============================
  updateMedia(id: string, data: Partial<Media>): Observable<Media> {
    const index = this.mediaList.findIndex(m => m.id === id);

    if (index !== -1) {
      this.mediaList[index] = {
        ...this.mediaList[index],
        ...data,
        updatedAt: new Date().toISOString()
      };
    }

    return of(this.mediaList[index]);
  }

  // ===============================
  // HELPERS
  // ===============================

  private detectType(mime: string): Media['fileType'] {
    if (mime.startsWith('image')) return 'image';
    if (mime.startsWith('video')) return 'video';
    if (mime.startsWith('audio')) return 'audio';
    return 'document';
  }

  private generateMockData(): Media[] {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: uuidv4(),
      fileName: `image_${i}.jpg`,
      filePath: `https://picsum.photos/300/200?random=${i}`,
      fileUrl: `https://picsum.photos/300/200?random=${i}`,
      fileType: 'image',
      mimeType: 'image/jpeg',
      size: 200000,
      createdAt: new Date().toISOString()
    }));
  }
}
