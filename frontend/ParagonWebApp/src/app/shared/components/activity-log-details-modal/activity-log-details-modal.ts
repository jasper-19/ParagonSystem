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

  onClose() {
    this.close.emit();
  }

 // ==========================
  // Display Formatters
  // ==========================

  formatAction(action?: string): string {
    if (!action) return '-';

    const custom: Record<string, string> = {
      LOGIN: 'Logged In',
      LOGOUT: 'Logged Out',
      CREATE: 'Created',
      UPDATE: 'Updated',
      DELETE: 'Deleted',
      PUBLISH: 'Published',
      UNPUBLISH: 'Unpublished',
      SATISFY: 'Updated Satisfaction Status',
      APPROVE: 'Approved',
      REJECT: 'Rejected',
      VERIFY: 'Verified',
      ARCHIVE: 'Archived',
    };

    return custom[action.toUpperCase()]
      ?? action
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
  }

  formatModule(module?: string): string {
    if (!module) return 'System';

    const modules: Record<string, string> = {
      ARTICLES: 'Articles',
      SPECIAL_ISSUES: 'Special Issues',
      MEDIA: 'Media',
      APPLICATIONS: 'Applications',
      STAFF_DIRECTORY: 'Staff Directory',
      EDITORIAL_BOARDS: 'Editorial Board',
      SETTINGS: 'Settings',
      USERS: 'Users',
      AUTH: 'Authentication',
      SYSTEM: 'System',
    };

    return modules[module.toUpperCase()]
      ?? module
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
  }

  formatDate(date?: string): string {
    if (!date) return '-';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatIp(ip?: string): string {
    if (!ip) return '-';

    return ip.replace(/\/\d+$/, '');
  }

  formatEntity(): string {
    if (!this.log.entityType) return '-';

    return this.formatModule(this.log.entityType);
  }

  hasMetadata(): boolean {
      if (!this.log.metadata) return false;

    return Object.keys(this.log.metadata)
      .filter(key => key !== 'description')
      .length > 0;
  }

  metadataEntries(): Array<{ key: string; value: unknown }> {
  if (!this.log.metadata) return [];

  return Object.entries(this.log.metadata)
    .filter(([key]) => key !== 'description')
    .map(([key, value]) => ({
      key: key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase()),
      value,
    }));
  }

  formatDescription(log: ActivityLog): string {
  const action = log.action?.toUpperCase();
  const module = log.module?.toUpperCase();

  if (module === 'EDITORIAL_BOARDS' && action === 'SATISFY') {
    const satisfied = log.metadata?.['satisfied'];

    if (satisfied === true) {
      return 'Marked the editorial board as satisfied.';
    }

    if (satisfied === false) {
      return 'Marked the editorial board as not satisfied.';
    }

    return 'Updated the editorial board satisfaction status.';
  }

  return log.description
    ?.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'this record')
    ?.replace(/\btrue\b/g, 'Yes')
    ?.replace(/\bfalse\b/g, 'No')
    || 'No description available.';
}

  // Optional: format JSON nicely for display
  formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }
}
