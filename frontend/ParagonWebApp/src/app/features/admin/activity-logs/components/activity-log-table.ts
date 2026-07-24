import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityLog } from '../../../../models/activity-log.model';

@Component({
  standalone: true,
  selector: 'app-activity-log-table',
  imports: [CommonModule],
  templateUrl: './activity-log-table.html',
  host: { class: 'block' },
})
export class ActivityLogTableComponent {
  @Input() logs: ActivityLog[] = [];


  @Output() view = new EventEmitter<ActivityLog>();

  onView(log: ActivityLog) {
    this.view.emit(log);
  }

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
    return (
      log.userName?.trim() ||
      'System activity'
    );
  }

  getActorType(
    log: ActivityLog
  ): string {
    return log.userName
      ? 'Administrator'
      : 'Automated system';
  }

  formatModule(
    module: string | null | undefined
  ): string {
    if (!module) {
      return 'System';
    }

    return module
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map(word =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
      )
      .join(' ');
  }

    formatDescription(log: ActivityLog): string {
    const description = log.description || '';

    if (log.module === 'EDITORIAL_BOARDS' && log.action === 'SATISFY') {
      const satisfied = log.metadata?.['satisfied'];

      if (satisfied === true) return 'Marked the editorial board as satisfied.';
      if (satisfied === false) return 'Marked the editorial board as not satisfied.';

      return 'Updated the editorial board satisfaction status.';
    }

    return description
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'this record')
      .replace(/\btrue\b/g, 'Yes')
      .replace(/\bfalse\b/g, 'No');
  }
}
