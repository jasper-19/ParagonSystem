import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, inject, output } from '@angular/core';

const stacks = new WeakMap<Document, { dialogs: HTMLElement[]; overflow: string }>();

/** Own focus and scrolling only while the dialog is actually rendered. */
@Directive({ selector: '[appActionDialog]', standalone: true })
export class ActionDialog implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private previousFocus: HTMLElement | null = null;
  dialogDismissed = output<void>();

  ngAfterViewInit(): void {
    this.previousFocus = this.document.activeElement as HTMLElement | null;
    let stack = stacks.get(this.document);
    if (!stack) {
      stack = { dialogs: [], overflow: this.document.body.style.overflow };
      stacks.set(this.document, stack);
    }
    stack.dialogs.push(this.element);
    this.document.body.style.overflow = 'hidden';
    (this.element.querySelector<HTMLElement>('[data-dialog-initial]') ?? this.element).focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (stacks.get(this.document)?.dialogs.at(-1) !== this.element) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.dialogDismissed.emit();
    } else if (event.key === 'Tab') {
      const items = Array.from(this.element.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'));
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); this.element.focus(); }
      else if (event.shiftKey && (this.document.activeElement === first || !this.element.contains(this.document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (this.document.activeElement === last || !this.element.contains(this.document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  }

  ngOnDestroy(): void {
    const stack = stacks.get(this.document);
    if (!stack) return;
    const wasTop = stack.dialogs.at(-1) === this.element;
    stack.dialogs = stack.dialogs.filter(dialog => dialog !== this.element);
    if (!stack.dialogs.length) {
      this.document.body.style.overflow = stack.overflow;
      stacks.delete(this.document);
    }
    if (wasTop) {
      const top = stack.dialogs.at(-1);
      if (this.previousFocus?.isConnected && (!top || top.contains(this.previousFocus))) this.previousFocus.focus();
      else top?.focus();
    }
  }
}
