import {
  Component,
  input,
  output,
  effect,
  inject
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './success-modal.html',
})
export class SuccessModal {

  isOpen = input<boolean>(false);
  title = input<string>('Success');
  message = input<string>('Operation completed successfully.');
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
