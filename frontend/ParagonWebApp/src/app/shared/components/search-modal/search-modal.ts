import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-search-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-modal.html'
})
export class SearchModal {
  @Output() close = new EventEmitter<void>();
}
