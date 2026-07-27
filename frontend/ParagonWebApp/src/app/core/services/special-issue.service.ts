import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { SpecialIssue, SpecialIssueType } from '../../models/special-issue.model';

import { API_ENDPOINTS } from '../config/api.config';

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
    const params = this.buildParams({ status });
    return this.http.get<ApiSpecialIssue[]>(this.api, { params }).pipe(
      map((list) => this.normalizeIssues(list)),
      tap((issues) => {
        if (!status) this.issuesSubject.next(issues);
      }),
      catchError((err) => {
        console.error('Failed to load special issues:', err);
        if (!status) this.issuesSubject.next([]);
        return of([]);
      })
    );
  }

  refreshAdmin(status?: IssueStatus): Observable<SpecialIssue[]> {
    const params = this.buildParams({ status, limit: 100 });
    return this.http.get<ApiSpecialIssue[]>(`${this.api}/admin`, { params }).pipe(
      map((list) => this.normalizeIssues(list)),
      tap((issues) => this.issuesSubject.next(issues))
    );
  }

  getIssueBySlug(slug: string): Observable<SpecialIssue> {
    return this.http.get<ApiSpecialIssue>(`${this.api}/${slug}`).pipe(
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
    return this.http.get<ApiSpecialIssue[]>(`${this.api}/type/${encodeURIComponent(type)}`).pipe(
      map((a) => this.normalizeIssues(a))
    );
  }

  /** For async validators. */
  isSlugTaken(slug: string, ignoreId?: string): Observable<boolean> {
    const normalized = (slug ?? '').trim().toLowerCase();
    if (!normalized) return of(false);

    return this.getAdminIssueBySlug(normalized).pipe(
      map((issue) => (ignoreId ? issue.id !== ignoreId : true)),
      catchError((err) => {
        if (err?.status === 404) return of(false);
        return of(false);
      })
    );
  }

  createIssue(payload: Omit<SpecialIssue, 'id'>, pdfFile?: File): Observable<SpecialIssue> {
    const body: FormData | LegacyCreateIssueDto = pdfFile
      ? this.toMultipartCreatePayload(payload, pdfFile)
      : { ...this.toMetadataDto(payload), pdfUrl: payload.pdfUrl };

    return this.http.post<ApiSpecialIssue>(this.api, body).pipe(
      map((a) => this.normalizeIssue(a)),
      tap((created) => {
        this.issuesSubject.next([created, ...this.issuesSubject.value.filter((i) => i.id !== created.id)]);
      })
    );
  }

  updateIssue(
    id: string,
    patch: Omit<SpecialIssue, 'id'>,
    pdfFile?: File
  ): Observable<SpecialIssue> {
    const replace$: Observable<SpecialIssue | null> = pdfFile
      ? this.replaceIssuePdf(id, pdfFile)
      : of(null);

    return replace$.pipe(
      switchMap(() =>
        this.http.patch<ApiSpecialIssue>(
          `${this.api}/${id}`,
          this.toMetadataDto(patch)
        )
      ),
      map((a) => this.normalizeIssue(a)),
      tap((updated) => {
        this.issuesSubject.next(this.issuesSubject.value.map((i) => (i.id === updated.id ? updated : i)));
      })
    );
  }

  replaceIssuePdf(id: string, pdfFile: File): Observable<SpecialIssue> {
    const form = new FormData();
    form.append('pdf', pdfFile, pdfFile.name);
    return this.http.patch<ApiSpecialIssue>(`${this.api}/${id}/pdf`, form).pipe(
      map((issue) => this.normalizeIssue(issue)),
      tap((updated) => {
        this.issuesSubject.next(
          this.issuesSubject.value.map((item) =>
            item.id === updated.id ? updated : item
          )
        );
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
}
