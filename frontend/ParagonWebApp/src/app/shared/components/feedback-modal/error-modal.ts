import {
  Component,
  input,
  output,
  effect,
  inject
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-error-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-modal.html',
})
export class ErrorModal {

  isOpen = input<boolean>(false);
  title = input<string>('Something went wrong');
  message = input<string>('Please try again.');
  buttonText = input<string>('Close');

  closed = output<void>();

  private document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.document.body.style.overflow = 'hidden';
      } else {
        this.document.body.style.overflow = '';
      }
    });
  }

  close() {
    this.closed.emit();
  }
}
