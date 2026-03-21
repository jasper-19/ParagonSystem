import {
  Component,
  input,
  output,
  effect,
  inject
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { JoinPosition } from '../../../features/join/models/join-position.model';

@Component({
  selector: 'app-position-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './position-info-modal.html',
})
export class PositionInfoModal {

  isOpen = input<boolean>(false);
  position = input<JoinPosition | null>(null);

  closed = output<void>();

  private document = inject(DOCUMENT);

  constructor() {

    effect(() => {
      const open = this.isOpen();

      if (open) {
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
