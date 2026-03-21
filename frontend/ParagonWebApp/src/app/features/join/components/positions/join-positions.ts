import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JoinPosition } from '../../models/join-position.model';
import { RouterModule } from '@angular/router';
import { PositionInfoModal } from '../../../../shared/components/position-info-modal/position-info-modal';

@Component({
  selector: 'app-join-positions',
  standalone: true,
  imports: [CommonModule, RouterModule,
    PositionInfoModal,
  ],
  templateUrl: './join-positions.html',
})
export class JoinPositions {

  // Signal-based input
  positions = input.required<JoinPosition[]>();

  readonly showInfoModal = signal(false);
  readonly selectedPosition = signal<JoinPosition | null>(null);

  openInfo(position: JoinPosition) {
    this.selectedPosition.set(position);
    this.showInfoModal.set(true);
  }

  closeInfo() {
    this.showInfoModal.set(false);
  }
}
