import { CommonModule, DOCUMENT } from "@angular/common";
import { Component, OnDestroy, effect, inject, input, output } from "@angular/core";

let scrollLockCount = 0;

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-modal.html',
})
export class ConfirmationModal {

  private readonly document = inject(DOCUMENT);
  private locked = false;
  private previousOverflow: string | null = null;

  //Inputs
  title = input<string>('Confirm Action');
  message = input<string>('Are you sure you want to proceed?');
  confirmText = input<string>('Confirm');
  cancelText = input<string>('Cancel');
  isOpen = input<boolean>(false);
  variant = input<'default' | 'danger'>('default');

  //Outputs
  confirmed = output<void>();
  cancelled = output<void>();

  constructor() {
    effect(() => {
      const open = this.isOpen();
      if (open) {
        this.lockScroll();
      } else {
        this.unlockScroll();
      }
    });
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  private lockScroll(): void {
    if (this.locked) return;

    const body = this.document?.body;
    if (!body) return;

    scrollLockCount += 1;
    if (scrollLockCount === 1) {
      this.previousOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
    }

    this.locked = true;
  }

  private unlockScroll(): void {
    if (!this.locked) return;

    const body = this.document?.body;
    if (!body) return;

    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      body.style.overflow = this.previousOverflow ?? '';
      this.previousOverflow = null;
    }

    this.locked = false;
  }

  close() {
    this.cancelled.emit();
  }

  confirm() {
    this.confirmed.emit();
  }
}
