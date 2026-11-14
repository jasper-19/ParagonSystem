import { TestBed } from '@angular/core/testing';
import { ConfirmationModal } from './confirmation-modal';
import { SuccessModal } from '../feedback-modal/success-modal';
import { ErrorModal } from '../feedback-modal/error-modal';
import { ConfirmationService } from './confirmation.service';

describe('Shared action dialogs', () => {
  afterEach(() => { TestBed.resetTestingModule(); document.body.style.overflow = ''; });

  it('keeps confirmation safe inside a form, traps focus and restores the trigger', async () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const fixture = TestBed.createComponent(ConfirmationModal);
    const cancelled = vi.fn(), confirmed = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentRef.setInput('variant', 'danger'); fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges(); await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('[role=alertdialog]') as HTMLElement;
    const buttons = Array.from(dialog.querySelectorAll('button'));
    expect(buttons.every(button => button.type === 'button')).toBe(true);
    expect(document.activeElement).toBe(buttons.at(-1));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancelled).toHaveBeenCalledTimes(1); expect(confirmed).not.toHaveBeenCalled();
    buttons[1].click(); expect(confirmed).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('isOpen', false); fixture.detectChanges();
    expect(document.activeElement).toBe(trigger); trigger.remove();
  });

  it('does not unlock scrolling for closed instances or dialogs destroyed out of order', () => {
    document.body.style.overflow = 'clip';
    const lower = TestBed.createComponent(ConfirmationModal);
    lower.componentRef.setInput('isOpen', true); lower.detectChanges();
    const closed = TestBed.createComponent(SuccessModal); closed.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');
    const upper = TestBed.createComponent(ErrorModal);
    upper.componentRef.setInput('isOpen', true); upper.detectChanges();
    lower.destroy(); expect(document.body.style.overflow).toBe('hidden');
    upper.destroy(); expect(document.body.style.overflow).toBe('clip'); closed.destroy();
  });

  it('gives concurrent instances unique accessible names and dismisses only the top dialog', () => {
    const first = TestBed.createComponent(ConfirmationModal), second = TestBed.createComponent(ConfirmationModal);
    const lower = vi.fn(), upper = vi.fn(); first.componentInstance.cancelled.subscribe(lower); second.componentInstance.cancelled.subscribe(upper);
    for (const fixture of [first, second]) { fixture.componentRef.setInput('isOpen', true); fixture.detectChanges(); }
    const a = first.nativeElement.querySelector('[role=alertdialog]'), b = second.nativeElement.querySelector('[role=alertdialog]');
    expect(a.getAttribute('aria-labelledby')).not.toBe(b.getAttribute('aria-labelledby'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(lower).not.toHaveBeenCalled(); expect(upper).toHaveBeenCalledTimes(1);
  });

  it('preserves feedback dismissal and renders error details as plain text', () => {
    const success = TestBed.createComponent(SuccessModal), error = TestBed.createComponent(ErrorModal);
    const closed = vi.fn(); success.componentInstance.closed.subscribe(closed);
    success.componentRef.setInput('isOpen', true); success.detectChanges();
    success.nativeElement.querySelector('.action-dialog-overlay').click(); expect(closed).toHaveBeenCalledTimes(1);
    error.componentRef.setInput('isOpen', true); error.componentRef.setInput('details', ['<script>unsafe</script>']); error.detectChanges();
    expect(error.nativeElement.querySelector('li').textContent).toContain('<script>unsafe</script>');
    expect(error.nativeElement.querySelector('script')).toBeNull();
  });
});

describe('ConfirmationService decisions', () => {
  it('resolves replaced, accepted and cancelled requests with the existing contract', async () => {
    const service = new ConfirmationService();
    const previous = service.confirm({ title: 'First', message: 'First' });
    const accepted = service.confirm({ title: 'Delete', message: 'Delete this item?', variant: 'danger' });
    await expect(previous).resolves.toBe(false);
    service.accept(); await expect(accepted).resolves.toBe(true); expect(service.isOpen()).toBe(false);
    const cancelled = service.confirm({ title: 'Cancel', message: 'Cancel?' });
    service.cancel(); await expect(cancelled).resolves.toBe(false);
  });
});
