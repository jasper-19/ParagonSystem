import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, defer, EMPTY, Observable, of, throwError } from 'rxjs';
import { catchError, expand, filter, map, reduce, switchMap, tap } from 'rxjs/operators';

import { SpecialIssue, SpecialIssueType, SpecialIssueSaveProgress } from '../../models/special-issue.model';

import { API_ENDPOINTS } from '../config/api.config';
import { SKIP_ADMIN_LOADER } from '../config/http-context';

// API payload type: matches server shape but keeps flexibility for date fields
type ApiSpecialIssue = Omit<SpecialIssue, 'publishedAt'> & {
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

// Shorthand for status and upsert DTO shape used for create/update requests
type IssueStatus = SpecialIssue['status'];
type IssueMetadataDto = {
  title: string;
  slug: string;
  type: string;
  academicYear: string;
  description?: string;
  coverImage: string;
  publishedAt?: string;
  status: IssueStatus;
};

type LegacyCreateIssueDto = IssueMetadataDto & {
  pdfUrl: string;
};

// =====================================================
// SpecialIssueService
// - Responsible for fetching, caching and transforming special issues
// - Exposes an observable `issues$` for UI consumption
// =====================================================
@Injectable({ providedIn: 'root' })
export class SpecialIssueService {
  private readonly api = API_ENDPOINTS.specialIssues;

  // ----- In-memory subject + public observable -----
  private readonly issuesSubject = new BehaviorSubject<SpecialIssue[]>([]);
  readonly issues$ = this.issuesSubject.asObservable();

  constructor(private http: HttpClient) {}

  // =====================================================
  // Remote API actions
  // - refresh: loads list (optionally filtered by status)
  // - getIssueBySlug / getIssuesByType: single endpoints
  // - create/update/delete: CRUD operations that update in-memory cache
  // =====================================================
  refresh(status?: IssueStatus): Observable<SpecialIssue[]> {
    return this.loadList(this.api, { status }).pipe(
      tap((issues) => {
        if (!status) this.issuesSubject.next(issues);
      })
    );
  }

  refreshAdmin(status?: IssueStatus): Observable<SpecialIssue[]> {
    return this.loadList(`${this.api}/admin`, { status }).pipe(
      tap((issues) => this.issuesSubject.next(issues))
    );
  }

  getIssueBySlug(slug: string): Observable<SpecialIssue> {
    return this.http.get<ApiSpecialIssue>(`${this.api}/${encodeURIComponent(slug)}`).pipe(
      map((a) => this.normalizeIssue(a)),
      tap((issue) => {
        this.issuesSubject.next([issue, ...this.issuesSubject.value.filter((i) => i.id !== issue.id)]);
      })
    );
  }

  getAdminIssueBySlug(slug: string): Observable<SpecialIssue> {
    return this.http.get<ApiSpecialIssue>(`${this.api}/admin/${encodeURIComponent(slug)}`).pipe(
      map((issue) => this.normalizeIssue(issue)),
      tap((issue) => {
        this.issuesSubject.next([issue, ...this.issuesSubject.value.filter((item) => item.id !== issue.id)]);
      })
    );
  }

  getIssuesByType(type: SpecialIssueType): Observable<SpecialIssue[]> {
    return this.loadList(`${this.api}/type/${encodeURIComponent(type)}`, {});
  }

  /** For async validators. */
  isSlugTaken(slug: string, ignoreId?: string): Observable<boolean> {
    const normalized = (slug ?? '').trim().toLowerCase();
    if (!normalized) return of(false);

    return this.http.get<ApiSpecialIssue>(`${this.api}/admin/${encodeURIComponent(normalized)}`).pipe(
      map((issue) => (ignoreId ? issue.id !== ignoreId : true)),
      catchError((err) => {
        if (err?.status === 404) return of(false);
        return throwError(() => err);
      })
    );
  }

  createIssue(payload: Omit<SpecialIssue, 'id'>, pdfFile?: File,
    onProgress?: (progress: SpecialIssueSaveProgress) => void): Observable<SpecialIssue> {
    const body: FormData | LegacyCreateIssueDto = pdfFile
      ? this.toMultipartCreatePayload(payload, pdfFile)
      : { ...this.toMetadataDto(payload), pdfUrl: payload.pdfUrl };

    return this.saveRequest('POST', this.api, body, onProgress).pipe(
      map((a) => this.normalizeIssue(a)),
      tap((created) => {
        this.issuesSubject.next([created, ...this.issuesSubject.value.filter((i) => i.id !== created.id)]);
        onProgress?.({ phase: 'ready', loaded: 0 });
      })
    );
  }

  updateIssue(
    id: string,
    patch: Omit<SpecialIssue, 'id'>,
    pdfFile?: File,
    onProgress?: (progress: SpecialIssueSaveProgress) => void
  ): Observable<SpecialIssue> {
    const replace$: Observable<SpecialIssue | null> = pdfFile
      ? this.replaceIssuePdf(id, pdfFile, progress => {
          if (progress.phase !== 'ready') onProgress?.(progress);
        })
      : of(null);

    return replace$.pipe(
      switchMap((replacement) =>
        this.saveRequest('PATCH',
          `${this.api}/${id}`,
          this.toMetadataDto(patch), onProgress
        ).pipe(catchError(error => {
          if (!replacement) return throwError(() => error);
          const message = 'The PDF was replaced, but issue details could not be saved. Retry saving the details.';
          return throwError(() => Object.assign(new Error(message), {
            error: { error: message }, pdfReplaced: true, replacement, cause: error,
          }));
        }))
      ),
      map((a) => this.normalizeIssue(a)),
      tap((updated) => {
        this.issuesSubject.next(this.issuesSubject.value.map((i) => (i.id === updated.id ? updated : i)));
        onProgress?.({ phase: 'ready', loaded: 0 });
      })
    );
  }

  replaceIssuePdf(id: string, pdfFile: File,
    onProgress?: (progress: SpecialIssueSaveProgress) => void): Observable<SpecialIssue> {
    const form = new FormData();
    form.append('pdf', pdfFile, pdfFile.name);
    return this.saveRequest('PATCH', `${this.api}/${id}/pdf`, form, onProgress).pipe(
      map((issue) => this.normalizeIssue(issue)),
      tap((updated) => {
        this.issuesSubject.next(
          this.issuesSubject.value.map((item) =>
            item.id === updated.id ? updated : item
          )
        );
        onProgress?.({ phase: 'ready', loaded: 0 });
      })
    );
  }

  updateIssueStatus(id: string, status: IssueStatus): Observable<SpecialIssue> {
    return this.http.patch<ApiSpecialIssue>(`${this.api}/${id}/status`, { status }).pipe(
      map((a) => this.normalizeIssue(a)),
      tap((updated) => {
        this.issuesSubject.next(this.issuesSubject.value.map((i) => (i.id === updated.id ? updated : i)));
      })
    );
  }

  deleteIssue(id: string): Observable<unknown> {
    return this.http.delete(`${this.api}/${id}`).pipe(
      tap(() => {
        this.issuesSubject.next(this.issuesSubject.value.filter((i) => i.id !== id));
      })
    );
  }

  // ====================================
  // Sync helpers (for existing UI code)
  // ====================================

  getAll(): SpecialIssue[] {
    return this.getAllIncludingDrafts()
      .filter((i) => i.status === 'published')
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  /** Admin listing: includes draft + archived. */
  getAllIncludingDrafts(): SpecialIssue[] {
    return [...this.issuesSubject.value].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  getByType(type: SpecialIssueType): SpecialIssue[] {
    return this.getAll().filter((i) => i.type === type);
  }

  getBySlug(slug: string): SpecialIssue | undefined {
    const s = (slug ?? '').trim().toLowerCase();
    return this.issuesSubject.value.find((i) => i.slug.trim().toLowerCase() === s);
  }

  getById(id: string): SpecialIssue | undefined {
    return this.issuesSubject.value.find((i) => i.id === id);
  }

  getLatest(): SpecialIssue | undefined {
    return this.getAll()[0];
  }

  getGroupedByType(): Record<SpecialIssueType, SpecialIssue[]> {
    const published = this.getAll();
    return {
      Tabloid: published.filter((i) => i.type === 'Tabloid'),
      Newsletter: published.filter((i) => i.type === 'Newsletter'),
      'Literary Folio': published.filter((i) => i.type === 'Literary Folio'),
    };
  }

  // ====================================
  // Internals
  // ====================================

  private buildParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return params;
  }

  private normalizeIssue(a: ApiSpecialIssue): SpecialIssue {
    const publishedAt = a.publishedAt ?? (a as any).createdAt ?? null;
    return {
      ...(a as any),
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(0),
    } as SpecialIssue;
  }

  private normalizeIssues(list: ApiSpecialIssue[]): SpecialIssue[] {
    return (list ?? []).map((a) => this.normalizeIssue(a));
  }

  private toMetadataDto(payload: Omit<SpecialIssue, 'id'>): IssueMetadataDto {
    return {
      title: payload.title,
      slug: payload.slug,
      type: payload.type,
      academicYear: payload.academicYear,
      description: payload.description ?? undefined,
      coverImage: payload.coverImage,
      publishedAt: payload.publishedAt ? payload.publishedAt.toISOString() : undefined,
      status: payload.status,
    };
  }

  private toMultipartCreatePayload(
    payload: Omit<SpecialIssue, 'id'>,
    pdfFile: File
  ): FormData {
    const form = new FormData();
    const metadata = this.toMetadataDto(payload);
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) {
        form.append(key, String(value));
      }
    }
    form.append('pdf', pdfFile, pdfFile.name);
    return form;
  }
  private loadList(url: string, filters: Record<string, unknown>): Observable<SpecialIssue[]> {
    const fetchPage = (page: number) => this.http.get<ApiSpecialIssue[]>(url, {
      params: this.buildParams({ ...filters, limit: 100, ...(page > 1 ? { page } : {}) }),
      observe: 'response',
    }).pipe(map(response => ({ response, page })));

    return fetchPage(1).pipe(
      expand(({ response, page }) => {
        if (response.headers.get('X-Has-More') !== 'true') return EMPTY;
        if (page >= 100) return throwError(() => new Error('Too many issues to load. Narrow the listing filters.'));
        return fetchPage(page + 1);
      }),
      reduce((items, { response }) => items.concat(response.body ?? []), [] as ApiSpecialIssue[]),
      map(items => this.normalizeIssues(items))
    );
  }
  private saveRequest(method: 'POST' | 'PATCH', url: string, body: unknown,
    onProgress?: (progress: SpecialIssueSaveProgress) => void): Observable<ApiSpecialIssue> {
    return defer(() => {
      const uploading = body instanceof FormData;
      let last: SpecialIssueSaveProgress = { phase: uploading ? 'uploading' : 'saving', loaded: 0 };
      onProgress?.(last);
      return this.http.request<ApiSpecialIssue>(method, url, {
        body, observe: 'events', reportProgress: !!onProgress,
        // The form provides its own progress; an admin overlay would hide it.
        context: new HttpContext().set(SKIP_ADMIN_LOADER, !!onProgress),
      }).pipe(
        tap(event => {
          if (!uploading) return;
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total && event.total > 0 ? event.total : undefined;
            const transferred = total !== undefined && event.loaded >= total;
            last = {
              phase: transferred ? 'processing' : 'uploading', loaded: event.loaded, total,
              percent: total === undefined ? undefined : Math.min(100, Math.floor(event.loaded / total * 100)),
            };
            onProgress?.(last);
          } else if (event.type === HttpEventType.ResponseHeader) {
            onProgress?.({ ...last, phase: 'processing' });
          }
        }),
        filter((event): event is HttpResponse<ApiSpecialIssue> => event.type === HttpEventType.Response),
        map(response => {
          if (!response.body) throw new Error('The server returned an empty save response.');
          return response.body;
        })
      );
    });
  }
}
