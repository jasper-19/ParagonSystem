import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { EditorialBoardService } from '../../../../core/services/editorial-board.service';
import { EditorialBoardData } from '../../../../models/editorial-board.model';
import { PublicBoardPreviewComponent } from './public-board-preview';

describe('Editorial board preview', () => {
  let fixture: ComponentFixture<PublicBoardPreviewComponent>;
  let board: EditorialBoardData;
  let boardChanges: BehaviorSubject<EditorialBoardData>;
  let loaded: BehaviorSubject<boolean>;
  let active: BehaviorSubject<boolean>;
  let request: Subject<void>;
  let load: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    board = {
      academicYear: '2026-2027',
      sections: [{ title: 'Executive Editors', members: [{ name: 'Sample Editor', staffId: 'sample-editor', position: 'Editor-in-Chief', yearLevel: '3rd_year' }] }],
      adviser: { name: 'Sample Adviser', position: 'Publication Adviser' },
      coAdviser: { name: '', position: 'Co-adviser' },
    };
    boardChanges = new BehaviorSubject(board);
    loaded = new BehaviorSubject(false);
    active = new BehaviorSubject(true);
    request = new Subject<void>();
    load = vi.fn(() => request.asObservable());
    await TestBed.configureTestingModule({
      imports: [PublicBoardPreviewComponent],
      providers: [provideRouter([]), { provide: EditorialBoardService, useValue: {
        board$: boardChanges, boardLoaded$: loaded, hasActiveBoard$: active,
        loadAdminActiveBoard: load,
      } }],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicBoardPreviewComponent);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fixture.destroy();
    request.complete(); boardChanges.complete(); loaded.complete(); active.complete();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function finishLoad(): void {
    fixture.detectChanges();
    loaded.next(true);
    request.complete();
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('counts unique staff across dual roles and normalizes names for legacy members without IDs', () => {
    board.sections.push({ title: 'Staff Writers', members: [
      { name: 'Sample Editor', staffId: 'sample-editor', position: 'News Writer' },
      { name: '  Legacy Writer  ', position: 'Feature Writer' },
      { name: 'legacy writer', position: 'News Writer' },
      { name: 'Sample Editor', staffId: 'another-editor', position: 'Literary Writer' },
    ] });
    expect(fixture.componentInstance.totalMembers(board)).toBe(3);
    expect(fixture.componentInstance.totalMembers({ ...board, sections: [] })).toBe(0);
  });

  it('announces loading and hides records until the admin request finishes', () => {
    fixture.detectChanges();
    expect(load).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('app-page-loader')).not.toBeNull();
    expect(text()).not.toContain('Sample Editor');
    loaded.next(true); request.complete(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-page-loader')).toBeNull();
    expect(text()).toContain('Sample Editor');
  });

  it('retries a failed request and replaces the error with board content', () => {
    fixture.detectChanges();
    request.error(new Error('Synthetic request failure'));
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Unable to load');
    expect(text()).not.toContain('Sample Editor');
    load.mockReturnValue(of(undefined));
    (alert.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(load).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(text()).toContain('Sample Editor');
  });

  it('offers staff-directory navigation and refresh when there is no active board', () => {
    boardChanges.next({ ...board, academicYear: '', sections: [] });
    active.next(false);
    finishLoad();
    expect(text()).toContain('No active editorial board');
    expect(fixture.nativeElement.querySelector('a[href="/admin/staff-directory"]')).not.toBeNull();
    load.mockReturnValue(of(undefined));
    const refresh = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => /refresh/i.test(button.textContent ?? ''));
    expect(refresh).toBeDefined();
    refresh!.click();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps adviser information and management navigation when the active board has no sections', () => {
    boardChanges.next({ ...board, sections: [] });
    finishLoad();
    expect(text()).toContain('No editorial sections yet');
    expect(text()).toContain('Sample Adviser');
    expect(fixture.nativeElement.querySelector('a[href="/admin/staff-directory"]')).not.toBeNull();
  });

  it('retains empty sections and renders their assignment guidance', () => {
    board.sections.push({ title: 'Staff Writers', members: [] });
    finishLoad();
    expect(text()).toContain('Staff Writers');
    expect(text()).toContain('No members assigned');
    expect(text()).toContain('Sample Editor');
    expect(text()).toContain('3rd Year');
  });

  it('renders both adviser profiles only when a co-adviser is provided', () => {
    finishLoad();
    expect(text()).toContain('Sample Adviser');
    expect(text()).not.toContain('Sample Co-adviser');
    boardChanges.next({ ...board, coAdviser: { name: 'Sample Co-adviser', position: 'Co-adviser' } });
    fixture.detectChanges();
    expect(text()).toContain('Sample Co-adviser');
  });

  it('opens the public board in a protected new tab with an accessible destination label', () => {
    finishLoad();
    const link = fixture.nativeElement.querySelector('a[href="/editorial-board"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.target).toBe('_blank');
    expect(link.rel.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    expect(link.getAttribute('aria-label')).toMatch(/public.*new tab/i);
  });
});
