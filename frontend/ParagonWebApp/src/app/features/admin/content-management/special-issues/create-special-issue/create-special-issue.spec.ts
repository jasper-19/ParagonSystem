import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SpecialIssueService } from '../../../../../core/services/special-issue.service';
import { CreateSpecialIssueComponent } from './create-special-issue';

describe('Special Issue PDF selection', () => {
  let component: CreateSpecialIssueComponent;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
      { provide: Router, useValue: {} },
      { provide: SpecialIssueService, useValue: { isSlugTaken: () => of(false) } },
    ] });
    component = TestBed.runInInjectionContext(() => new CreateSpecialIssueComponent());
  });
  function select(file: File) {
    component.onPdfSelected({ target: { files: [file], value: file.name } } as unknown as Event);
  }
  it('rejects an invalid or oversized PDF without replacing an existing selection', () => {
    const valid = new File(['%PDF-test'], 'issue.pdf', { type: 'application/pdf' });
    select(valid);
    select(new File(['html'], 'issue.html', { type: 'text/html' }));
    expect(component.selectedPdfFile()).toBe(valid);
    expect(component.pdfError()).toBe('Choose a PDF file.');
    const oversized = new File(['pdf'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversized, 'size', { value: 50 * 1024 * 1024 + 1 });
    select(oversized);
    expect(component.selectedPdfFile()).toBe(valid);
    expect(component.pdfError()).toContain('50 MB');
  });
  it('accepts a PDF with an empty browser MIME type and prevents mutation while saving', () => {
    const file = new File(['%PDF-test'], 'issue.PDF');
    select(file);
    expect(component.selectedPdfFile()).toBe(file);
    component.isSubmitting.set(true);
    component.removePdf();
    select(new File(['pdf'], 'other.pdf'));
    expect(component.selectedPdfFile()).toBe(file);
  });
  it('keeps a successful replacement when metadata saving fails so retry will not reupload', () => {
    const service = TestBed.inject(SpecialIssueService);
    const replacement = { pdfUrl: 'https://example.com/new.pdf' };
    (service as any).getById = () => ({ status: 'draft' });
    (service as any).updateIssue = () => throwError(() => ({
      pdfReplaced: true, replacement, error: { error: 'PDF replaced, metadata failed.' },
    }));
    component.editingId.set('issue-id');
    component.form.controls.slug.clearAsyncValidators();
    component.form.patchValue({ title: 'Issue', slug: 'issue', academicYear: '2025-2026',
      coverImage: 'https://example.com/cover.jpg', pdfUrl: 'pending-upload', publishedAt: '2026-01-01' });
    component.selectedPdfFile.set(new File(['pdf'], 'new.pdf'));
    component.onConfirmSave();
    expect(component.selectedPdfFile()).toBeNull();
    expect(component.form.controls.pdfUrl.value).toBe(replacement.pdfUrl);
    expect(component.saveError()).toBe('PDF replaced, metadata failed.');
    expect(component.isSubmitting()).toBe(false);
  });
});
