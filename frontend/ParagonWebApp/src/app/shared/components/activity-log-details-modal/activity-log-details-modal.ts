import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ActivityLog } from '../../../models/activity-log.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-activity-log-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-log-details-modal.html'
})
export class ActivityLogDetailsModalComponent {

  @Input() log!: ActivityLog;
  @Output() close = new EventEmitter<void>();

  constructor() {}

  onClose() {
    this.close.emit();
  }

  // Optional: format JSON nicely for display
  formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }
}
