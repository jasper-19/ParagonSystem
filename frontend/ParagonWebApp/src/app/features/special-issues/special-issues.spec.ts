import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { SpecialIssues } from './special-issues';
import { SpecialIssueService } from '../../core/services/special-issue.service';
import { LoaderService } from '../../shared/services/loader.service';
import { SpecialIssue } from '../../models/special-issue.model';

describe('Special Issues public grouping', () => {
  it('omits empty years belonging only to the featured issue and preserves the active type', () => {
    const issue = (id: string, type: string, academicYear: string, date: string) => ({
      id, type, academicYear, publishedAt: new Date(date),
    });
    const issues = [issue('one', 'Newsletter', '2026-2027', '2026-10-01'),
      issue('two', 'Newsletter', '2025-2026', '2026-01-01'),
      issue('three', 'Tabloid', '2024-2025', '2025-01-01')];
    const component = new SpecialIssues({ refresh: () => of(issues), getAll: () => issues } as unknown as SpecialIssueService,
      { show: () => {}, hide: () => {} } as LoaderService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef);
    component.activeType = 'Newsletter';
    component.ngOnInit();
    expect(component.latestIssue?.id).toBe('one');
    expect(component.years).toEqual(['2025-2026']);
    expect(component.filtered.map(item => item.id)).toEqual(['two']);
  });
});

describe('Special Issues library interactions', () => {
  const issue = (id: string, type: SpecialIssue['type'], academicYear: string, date: string): SpecialIssue => ({
    id, slug: id, title: `Publication ${id}`, type, academicYear, publishedAt: new Date(date),
    coverImage: `/covers/${id}.jpg`, pdfUrl: `/issues/${id}.pdf`, status: 'published',
  });
  let items: SpecialIssue[];
  let request: Subject<SpecialIssue[]>;
  const refresh = vi.fn();
  const show = vi.fn();
  const hide = vi.fn();

  beforeEach(() => {
    items = [];
    request = new Subject<SpecialIssue[]>();
    refresh.mockReset().mockImplementation(() => request);
    show.mockClear(); hide.mockClear();
    TestBed.configureTestingModule({ imports: [SpecialIssues], providers: [
      provideRouter([]),
      { provide: SpecialIssueService, useValue: { refresh, getAll: () => items } },
      { provide: LoaderService, useValue: { show, hide } },
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('does not announce an empty library during loading or when only the featured issue exists', () => {
    const fixture = TestBed.createComponent(SpecialIssues);
    fixture.detectChanges();
    expect(fixture.componentInstance.loading).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('No issues');
    items = [issue('single', 'Newsletter', '2026-2027', '2026-10-01')];
    request.next(items);
    fixture.detectChanges();
    expect(fixture.componentInstance.totalIssues).toBe(1);
    expect(fixture.componentInstance.years).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Publication single');
    expect(fixture.nativeElement.textContent).not.toMatch(/No (issues|publications)/i);
    expect(fixture.nativeElement.querySelector('a[href="/special-issues/single"]')).not.toBeNull();
    fixture.destroy();
  });

  it('recomputes the featured issue, archive years, count, and selected filter together', () => {
    const fixture = TestBed.createComponent(SpecialIssues);
    fixture.detectChanges();
    items = [issue('old', 'Newsletter', '2024-2025', '2025-01-01'),
      issue('latest', 'Tabloid', '2026-2027', '2026-10-01'),
      issue('newsletter', 'Newsletter', '2025-2026', '2026-01-01')];
    request.next(items);
    fixture.detectChanges();
    const newsletter = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Newsletter'))!;
    newsletter.click(); fixture.detectChanges();
    expect(newsletter.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.latestIssue?.id).toBe('newsletter');
    expect(fixture.componentInstance.totalIssues).toBe(2);
    expect(fixture.componentInstance.years).toEqual(['2024-2025']);
    expect(fixture.componentInstance.getIssuesByYear('2024-2025').map(item => item.id)).toEqual(['old']);
    const folio = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Literary Folio'))!;
    folio.click(); fixture.detectChanges();
    expect(fixture.componentInstance.totalIssues).toBe(0);
    expect(fixture.componentInstance.latestIssue).toBeUndefined();
    expect(fixture.nativeElement.textContent).toMatch(/No (issues|publications)/i);
    fixture.destroy();
  });

  it('distinguishes a failed request from an empty library and retries the active type', () => {
    const fixture = TestBed.createComponent(SpecialIssues);
    fixture.componentInstance.activeType = 'Newsletter';
    fixture.detectChanges();
    request.error(new Error('offline'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toMatch(/No (issues|publications)/i);
    request = new Subject<SpecialIssue[]>();
    const retry = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => /try again|retry/i.test(button.textContent ?? ''))!;
    expect(retry).toBeDefined();
    retry.click(); fixture.detectChanges();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.loadError).toBeFalsy();
    items = [issue('retry', 'Newsletter', '2026-2027', '2026-10-01')];
    request.next(items); fixture.detectChanges();
    expect(fixture.componentInstance.activeType).toBe('Newsletter');
    expect(fixture.componentInstance.latestIssue?.id).toBe('retry');
    expect(fixture.componentInstance.loading).toBe(false);
    expect(hide).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });
});
