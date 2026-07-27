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
});
