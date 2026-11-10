import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ViewMemberInfoModalComponent } from './view-member-info-modal';

describe('Member information dialog accessibility', () => {
  let fixture: ComponentFixture<ViewMemberInfoModalComponent>;
  let opener: HTMLButtonElement;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ViewMemberInfoModalComponent] }).compileComponents();
    opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
    fixture = TestBed.createComponent(ViewMemberInfoModalComponent);
    fixture.componentRef.setInput('member', { name: 'Sample Editor', position: 'Editor-in-Chief', initials: 'SE', yearLevel: '3rd_year' });
    fixture.componentRef.setInput('sectionTitle', 'Executive Editors');
    fixture.componentRef.setInput('isOpen', true); fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(async () => { fixture.destroy(); await Promise.resolve(); opener.remove(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('focuses the close control, emits Escape dismissal and restores the opener and scroll state', async () => {
    const close = fixture.nativeElement.querySelector('button[aria-label]') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe('hidden');
    const closed = vi.fn(); fixture.componentInstance.closed.subscribe(closed);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.dispatchEvent(escape);
    expect(closed).toHaveBeenCalledOnce(); expect(escape.defaultPrevented).toBe(true);
    fixture.componentRef.setInput('isOpen', false); fixture.detectChanges(); await fixture.whenStable();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('emits the edit request from the default staff dialog action', () => {
    const edit = vi.fn(); fixture.componentInstance.editRequested.subscribe(edit);
    const editButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => /edit/i.test(button.textContent ?? ''));
    expect(editButton).toBeDefined(); editButton!.click(); expect(edit).toHaveBeenCalledOnce();
  });
});
