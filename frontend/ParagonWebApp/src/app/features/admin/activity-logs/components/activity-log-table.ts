import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityLog } from '../../../../models/activity-log.model';

@Component({
  standalone: true,
  selector: 'app-activity-log-table',
  imports: [CommonModule],
  templateUrl: './activity-log-table.html',
  styles: [
    `
    :host table tr.log-row:hover { background: rgba(244,180,0,0.06); }
    :host table tr.log-row { transition: background 0.15s ease; }
    :host button.action-button {
      display:inline-flex; align-items:center; gap:5px; padding:5px 12px;
      border-radius:8px; font-size:12px; font-weight:500;
      background:#000035; color:#f4b400; border:0.5px solid rgba(244,180,0,0.35);
      cursor:pointer; transition: background .15s, color .15s, border-color .15s;
    }
    :host button.action-button:hover { background:#f4b400; color:#000035; border-color:#f4b400; }
    :host button.action-button:focus { outline: 2px solid #f4b400; outline-offset: 2px; }
    `
  ]
})
export class ActivityLogTableComponent {
  @Input() logs: ActivityLog[] = [];
  @Output() view = new EventEmitter<ActivityLog>();

  constructor() {}

  onView(log: ActivityLog) {
    this.view.emit(log);
  }

  getActionClass(action: string): string {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-600';
      case 'UPDATE': return 'bg-yellow-100 text-yellow-600';
      case 'DELETE': return 'bg-red-100 text-red-600';
      case 'LOGIN': return 'bg-blue-100 text-blue-600';
      case 'LOGOUT': return 'bg-gray-200 text-gray-600';
      case 'PUBLISH': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

    getInitial(log: ActivityLog): string {
    return log.userName ? log.userName.charAt(0).toUpperCase() : '';
  }
}
