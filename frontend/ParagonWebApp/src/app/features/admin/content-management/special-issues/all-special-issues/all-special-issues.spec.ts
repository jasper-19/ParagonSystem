import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AllSpecialIssuesComponent } from './all-special-issues';
import { SpecialIssueService } from '../../../../../core/services/special-issue.service';
import { ConfirmationService } from '../../../../../shared/components/confirmation-modal/confirmation.service';
import { SpecialIssue } from '../../../../../models/special-issue.model';

describe('Special Issues list state', () => {
  const issue = { id: 'issue', title: 'Issue', slug: 'issue', type: 'Newsletter', academicYear: '2025-2026', status: 'archived', coverImage: '', pdfUrl: '', publishedAt: new Date(0) } as SpecialIssue;
  let items: BehaviorSubject<SpecialIssue[]>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let deletion: Subject<void>;
  const confirm = vi.fn(async () => true);
  const remove = vi.fn();

  beforeEach(() => {
    items = new BehaviorSubject<SpecialIssue[]>([issue]);
    params = new BehaviorSubject(convertToParamMap({}));
    deletion = new Subject<void>();
    confirm.mockClear(); remove.mockReset().mockReturnValue(deletion);
    TestBed.configureTestingModule({ imports: [AllSpecialIssuesComponent], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
      { provide: ConfirmationService, useValue: { confirm } },
      { provide: SpecialIssueService, useValue: { issues$: items, refreshAdmin: () => of(items.value), deleteIssue: remove } },
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('responds to browser query changes and clamps pages after deletion', () => {
    items.next(Array.from({ length: 6 }, (_, index) => ({ ...issue, id: String(index) })));
    const fixture = TestBed.createComponent(AllSpecialIssuesComponent);
    fixture.detectChanges(); TestBed.tick();
    const component = fixture.componentInstance;
    component.currentPage.set(2); TestBed.tick();
    items.next([issue]); TestBed.tick();
    expect(component.currentPage()).toBe(1);
    params.next(convertToParamMap({ status: 'draft' })); TestBed.tick();
    expect(component.statusFilter()).toBe('draft');
    expect(component.totalResults()).toBe(0);
    fixture.destroy();
  });

  it('prevents repeated deletion and reports failures while releasing the guard', async () => {
    const fixture = TestBed.createComponent(AllSpecialIssuesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const first = component.requestDelete(issue);
    await component.requestDelete(issue);
    await Promise.resolve();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    deletion.error(new Error('offline'));
    await first;
    expect(component.pendingIds().size).toBe(0);
    expect(component.feedback()).toContain('Could not delete');
    fixture.destroy();
  });
});
