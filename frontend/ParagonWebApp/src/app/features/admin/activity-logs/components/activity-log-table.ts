import { activityActionLabel, activityDescription, activityModuleLabel } from '../../../../models/activity-log-presentation';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityLog } from '../../../../models/activity-log.model';
import { activityActorName, activityActorType } from '../../../../models/activity-log-actor';

@Component({
  standalone: true,
  selector: 'app-activity-log-table',
  imports: [CommonModule],
  templateUrl: './activity-log-table.html',
  styleUrl: './activity-log-table.scss',
  host: { class: 'block' },
})
export class ActivityLogTableComponent {
  @Input() logs: ActivityLog[] = [];


  @Output() view = new EventEmitter<ActivityLog>();

  onView(log: ActivityLog) {
    this.view.emit(log);
  }

  readonly formatAction = activityActionLabel;

  getActionClass(
    action: string
  ): string {
    switch (
      String(action ?? '')
        .trim()
        .toUpperCase()
    ) {
      case 'CREATE':
        return `
          border-emerald-200
          bg-emerald-50
          text-emerald-700
        `;

      case 'UPDATE':
        return `
          border-amber-200
          bg-amber-50
          text-amber-700
        `;

      case 'DELETE':
        return `
          border-red-200
          bg-red-50
          text-red-700
        `;

      case 'LOGIN':
        return `
          border-blue-200
          bg-blue-50
          text-blue-700
        `;

      case 'LOGOUT':
        return `
          border-slate-200
          bg-slate-100
          text-slate-600
        `;

      case 'PUBLISH':
        return `
          border-violet-200
          bg-violet-50
          text-violet-700
        `;

      case 'ACTIVATE':
        return `
          border-cyan-200
          bg-cyan-50
          text-cyan-700
        `;

      default:
        return `
          border-slate-200
          bg-slate-50
          text-slate-700
        `;
    }
  }

  getInitial(
    log: ActivityLog
  ): string {
    const name =
      log.userName?.trim();

    return name
      ? name.charAt(0).toUpperCase()
      : 'S';
  }

  getActorLabel(
    log: ActivityLog
  ): string {
    return activityActorName(log);
  }

  getActorType(
    log: ActivityLog
  ): string {
    return activityActorType(log);
  }

  formatModule(module?: string | null): string {
    return activityModuleLabel(module);
  }

  formatDescription(log: ActivityLog): string {
    return activityDescription(log);
  }
}
