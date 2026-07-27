import {
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  effect,
  inject,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { JoinPosition } from '../../../features/join/models/join-position.model';

@Component({
  selector: 'app-position-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './position-info-modal.html',
})
export class PositionInfoModal implements OnDestroy {

  isOpen = input<boolean>(false);
  position = input<JoinPosition | null>(null);

  closed = output<void>();

  private document = inject(DOCUMENT);
  private previouslyFocusedElement: HTMLElement | null = null;
  private wasOpen = false;

  @ViewChild('dialogPanel')
  dialogPanel?: ElementRef<HTMLElement>;

  constructor() {

    effect(() => {
      const open = this.isOpen();

      if (open) {
        if (!this.wasOpen) {
          this.previouslyFocusedElement = this.document.activeElement as HTMLElement | null;
          setTimeout(() => this.dialogPanel?.nativeElement.focus());
        }
        this.document.body.style.overflow = 'hidden';
      } else {
        this.document.body.style.overflow = '';
        if (this.wasOpen) {
          setTimeout(() => this.previouslyFocusedElement?.focus());
        }
      }

      this.wasOpen = open;
    });

  }

  close() {
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = '';
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = this.dialogPanel?.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements?.length) {
      event.preventDefault();
      this.dialogPanel?.nativeElement.focus();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
