import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ActivityLog } from '../../../models/activity-log.model';
import { ActivityLogDetailsModalComponent } from './activity-log-details-modal';

describe('Activity log details dialog', () => {
  const log: ActivityLog = { id: 'sample-log', userId: 'sample-admin', userName: 'Sample Editor', action: 'UPDATE', module: 'ARTICLES', description: '<img src=x onerror="alert(1)">', entityId: 'sample-article', entityType: 'ARTICLES', ipAddress: '192.0.2.1/32', createdAt: '2026-11-10T00:00:00Z', metadata: { description: 'Excluded duplicate description', before: { title: '<script>sample</script>' }, enabled: false, missing: null } };
  let fixture: ComponentFixture<ActivityLogDetailsModalComponent>;
  let opener: HTMLButtonElement;
  let previousOverflow: string;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ActivityLogDetailsModalComponent] }).compileComponents();
    previousOverflow = document.body.style.overflow; document.body.style.overflow = 'auto';
    opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
    fixture = TestBed.createComponent(ActivityLogDetailsModalComponent); fixture.componentRef.setInput('log', log);
    fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); opener.remove(); document.body.style.overflow = previousOverflow; TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('focuses the close button, wraps Tab, and restores focus and scroll after dismissal', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    const buttons = Array.from(dialog.querySelectorAll('button'));
    expect(document.activeElement).toBe(buttons[0]); expect(document.body.style.overflow).toBe('hidden');
    const backwards = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    buttons[0].dispatchEvent(backwards); expect(backwards.defaultPrevented).toBe(true); expect(document.activeElement).toBe(buttons.at(-1));
    const forwards = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    buttons.at(-1)!.dispatchEvent(forwards); expect(forwards.defaultPrevented).toBe(true); expect(document.activeElement).toBe(buttons[0]);
    fixture.destroy(); expect(document.activeElement).toBe(opener); expect(document.body.style.overflow).toBe('auto');
  });

  it('supports Escape and backdrop dismissal without closing on dialog content clicks', () => {
    const close = vi.fn(); fixture.componentInstance.close.subscribe(close);
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    dialog.click(); expect(close).not.toHaveBeenCalled();
    dialog.parentElement!.click(); expect(close).toHaveBeenCalledOnce();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.dispatchEvent(escape);
    expect(close).toHaveBeenCalledTimes(2); expect(escape.defaultPrevented).toBe(true);
  });

  it('renders descriptions and structured metadata as escaped text with readable missing values', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(root.textContent).toContain('<script>sample</script>');
    expect(root.querySelector('img, script')).toBeNull();
    expect(root.textContent).not.toContain('Excluded duplicate description');
    expect(root.textContent).toContain('Not recorded'); expect(root.textContent).toContain('No');
    expect(fixture.componentInstance.formatIp(log.ipAddress)).toBe('192.0.2.1');
  });
});
