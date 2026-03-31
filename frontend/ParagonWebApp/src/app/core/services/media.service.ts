import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { Media, MediaQuery, PaginatedMediaResponse } from '../../models/media.model';

type ApiMedia = Omit<Media, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
};

type UploadProgressOrMedia = number | Media;

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private readonly api = '/api/media';

  constructor(private http: HttpClient) {}

  private normalizeMedia(media: ApiMedia): Media {
    return {
      ...media,
      createdAt: media.createdAt || new Date().toISOString(),
      updatedAt: media.updatedAt || undefined,
    };
  }

  getMedia(query?: MediaQuery): Observable<PaginatedMediaResponse> {
    const params: Record<string, string> = {};

    if (query?.search) params['search'] = query.search;
    if (query?.type) params['type'] = query.type;
    if (query?.page) params['page'] = String(query.page);
    if (query?.limit) params['limit'] = String(query.limit);

    return this.http.get<PaginatedMediaResponse & { data: ApiMedia[] }>(this.api, { params }).pipe(
      map((response) => ({
        ...response,
        data: (response.data || []).map((item) => this.normalizeMedia(item)),
      }))
    );
  }

  uploadMedia(file: File): Observable<UploadProgressOrMedia> {
    const body = new FormData();
    body.append('file', file);

    return this.http.post<ApiMedia>(`${this.api}/upload`, body, {
      observe: 'events',
      reportProgress: true,
    }).pipe(
      map((event): UploadProgressOrMedia | null => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total ?? file.size;
          const progress = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
          return progress;
        }

        if (event.type === HttpEventType.Response && event.body) {
          return this.normalizeMedia(event.body);
        }

        return null;
      }),
      filter((event): event is UploadProgressOrMedia => event !== null)
    );
  }

  deleteMedia(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  updateMedia(id: string, data: Partial<Media>): Observable<Media> {
    const payload = {
      altText: data.altText,
      caption: data.caption,
      tags: data.tags,
    };

    return this.http.patch<ApiMedia>(`${this.api}/${id}`, payload).pipe(
      map((response) => this.normalizeMedia(response))
    );
  }
}

