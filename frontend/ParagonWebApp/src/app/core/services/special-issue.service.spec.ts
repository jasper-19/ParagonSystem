import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { SpecialIssue } from '../../models/special-issue.model';
import { API_ENDPOINTS } from '../config/api.config';
import { SpecialIssueService } from './special-issue.service';

describe('SpecialIssueService', () => {
  let service: SpecialIssueService;
  let http: HttpTestingController;

  const issue: SpecialIssue = {
    id: 'issue-id',
    title: 'Integration Issue',
    slug: 'integration-issue',
    type: 'Newsletter',
    academicYear: '2025-2026',
    description: 'Test publication',
    coverImage: 'https://example.com/cover.webp',
    pdfUrl: 'https://example.com/issue.pdf',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'draft',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SpecialIssueService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SpecialIssueService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a Special Issue with multipart data instead of base64', () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'issue.pdf', {
      type: 'application/pdf',
    });
    let created: SpecialIssue | undefined;
    const { id: _id, ...payload } = issue;

    service
      .createIssue(payload, file)
      .subscribe(value => {
        created = value;
      });

    const request = http.expectOne(API_ENDPOINTS.specialIssues);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    const form = request.request.body as FormData;
    const uploadedFile = form.get('pdf') as File;
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.name).toBe(file.name);
    expect(uploadedFile.type).toBe(file.type);
    expect(uploadedFile.size).toBe(file.size);
    expect(form.get('title')).toBe(issue.title);
    expect(form.has('pdfUrl')).toBe(false);

    request.flush({
      ...issue,
      publishedAt: issue.publishedAt.toISOString(),
    });
    expect(created?.id).toBe(issue.id);
  });

  it('uses the authenticated admin listing with an explicit bound', () => {
    service.refreshAdmin().subscribe();

    const request = http.expectOne(
      req =>
        req.url === `${API_ENDPOINTS.specialIssues}/admin` &&
        req.params.get('limit') === '100'
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('loads subsequent API pages before updating the list', () => {
    let result: SpecialIssue[] = [];
    service.refreshAdmin().subscribe(items => result = items);
    http.expectOne(req => req.url.endsWith('/admin') && !req.params.has('page'))
      .flush([issue], { headers: { 'X-Has-More': 'true' } });
    expect(service.getAllIncludingDrafts()).toEqual([]);
    http.expectOne(req => req.url.endsWith('/admin') && req.params.get('page') === '2')
      .flush([{ ...issue, id: 'second' }], { headers: { 'X-Has-More': 'false' } });
    expect(result.map(item => item.id)).toEqual(['issue-id', 'second']);
    expect(service.getAllIncludingDrafts()).toHaveLength(2);
  });

  it('does not add slug validation results to the displayed list', () => {
    let taken = false;
    service.isSlugTaken(issue.slug).subscribe(value => taken = value);
    http.expectOne(`${API_ENDPOINTS.specialIssues}/admin/${issue.slug}`).flush(issue);
    expect(taken).toBe(true);
    expect(service.getAllIncludingDrafts()).toEqual([]);
  });

  it('reports slug lookup and list failures instead of false success', () => {
    let failures = 0;
    service.isSlugTaken('test').subscribe({ error: () => failures++ });
    http.expectOne(`${API_ENDPOINTS.specialIssues}/admin/test`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    service.refresh().subscribe({ error: () => failures++ });
    http.expectOne(req => req.url === API_ENDPOINTS.specialIssues)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(failures).toBe(2);
  });

  it('reports partial success when metadata fails after PDF replacement', () => {
    let failure: { pdfReplaced?: boolean; replacement?: SpecialIssue } | undefined;
    const { id, ...payload } = issue;
    service.updateIssue(id, payload, new File(['%PDF-1.7'], 'new.pdf', { type: 'application/pdf' }))
      .subscribe({ error: error => failure = error });
    http.expectOne(`${API_ENDPOINTS.specialIssues}/${id}/pdf`)
      .flush({ ...issue, pdfUrl: 'https://example.com/new.pdf' });
    http.expectOne(`${API_ENDPOINTS.specialIssues}/${id}`)
      .flush({}, { status: 409, statusText: 'Conflict' });
    expect(failure?.pdfReplaced).toBe(true);
    expect(failure?.replacement?.pdfUrl).toBe('https://example.com/new.pdf');
  });
});
