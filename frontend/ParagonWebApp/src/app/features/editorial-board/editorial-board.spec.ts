import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { EditorialBoard } from './editorial-board';
import { EditorialBoardData } from '../../models/editorial-board.model';
import { EditorialBoardService } from '../../core/services/editorial-board.service';
import { LoaderService } from '../../shared/services/loader.service';
import { SocketService } from '../../core/services/socket.service';

describe('Public board content and recovery', () => {
  let fixture: ComponentFixture<EditorialBoard>;
  const board: EditorialBoardData = {
    academicYear: '2025–2026',
    sections: [{ title: 'Executive Editors', members: [{ name: 'Test Editor', position: 'Managing Editor', initials: 'TE', image: '/missing-portrait.png' }] }],
    adviser: { name: '', position: 'Publication Adviser' },
    coAdviser: { name: 'Test Co-adviser', position: 'Publication Co-adviser' },
  };
  const subject = new BehaviorSubject(board);
  const loadActiveBoard = vi.fn();
  beforeEach(() => {
    subject.next(board);
    loadActiveBoard.mockReset().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({ imports: [EditorialBoard], providers: [
      { provide: EditorialBoardService, useValue: { board$: subject, getCurrentBoard: () => subject.value, loadActiveBoard } },
      { provide: LoaderService, useValue: { show: vi.fn(), hide: vi.fn() } },
      { provide: SocketService, useValue: { onEditorialBoardUpdated: vi.fn(), off: vi.fn() } },
    ] });
  });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });
  function create() { fixture = TestBed.createComponent(EditorialBoard); fixture.detectChanges(); }

  it('shows a co-adviser when no adviser has been published', () => {
    create();
    expect(fixture.nativeElement.querySelector('#board-co-adviser').textContent).toContain('Test Co-adviser');
    expect(fixture.nativeElement.querySelector('#board-adviser')).toBeNull();
    expect(fixture.componentInstance.hasBoard()).toBe(true);
  });

  it('replaces a failed portrait with initials while retaining the member details', () => {
    create();
    const portrait = fixture.nativeElement.querySelector('.board-member img') as HTMLImageElement;
    portrait.dispatchEvent(new Event('error')); fixture.detectChanges();
    const member = fixture.nativeElement.querySelector('.board-member');
    expect(member.querySelector('img')).toBeNull();
    expect(member.textContent).toContain('TE');
    expect(member.textContent).toContain('Test Editor');
    expect(member.textContent).toContain('Managing Editor');
  });

  it('offers retry after a failed initial request and restores the directory', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loadActiveBoard.mockReturnValueOnce(throwError(() => new Error('Offline')));
    create();
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    fixture.nativeElement.querySelector('[role=alert] button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.board-member').textContent).toContain('Test Editor');
    expect(loadActiveBoard).toHaveBeenCalledTimes(2);
  });
});
