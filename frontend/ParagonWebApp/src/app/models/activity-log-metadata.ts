import { ActivityLog } from './activity-log.model';
import { activityFieldLabel, activityModuleLabel } from './activity-log-presentation';

export interface ActivityDetail {
  id: string;
  label: string;
  value: string;
  reference: boolean;
}
export interface ActivityDetailGroup { label: string; items: ActivityDetail[]; }

const labels = new Map(Object.entries({
  fields: 'Changed fields', actorType: 'Actor type', actorSubject: 'Actor ID', actorRole: 'Account role',
  requestId: 'Request ID', resourceKey: 'Resource reference', resourceId: 'Record ID',
  applicationId: 'Application ID', staffId: 'Staff ID', boardId: 'Editorial board ID', sessionId: 'Session ID',
  userId: 'User ID', outcome: 'Result', method: 'Request method', route: 'Request route',
  status: 'Status', section: 'Section', role: 'Role', version: 'Settings version',
  mimeType: 'File type', size: 'File size', interviewDate: 'Interview date',
  notesChanged: 'Interview notes changed', passwordChanged: 'Password changed',
  yearLevelTransition: 'Year-level progression', before: 'Previous values', after: 'Updated values',
  isOpen: 'Applications open', isActive: 'Account active', satisfied: 'Board satisfaction',
  enabled: 'Enabled', academicYear: 'Academic year', username: 'Username',
}));
const enums = new Map(Object.entries({
  admin: 'Administrator', staff: 'Staff', user: 'User account', anonymous: 'Unauthenticated visitor',
  environment_admin: 'Environment administrator', success: 'Successful', failure: 'Failed',
  pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', draft: 'Draft',
  published: 'Published', archived: 'Archived', interview_scheduled: 'Interview scheduled',
  interview_completed: 'Interview completed', publishingMedia: 'Publishing and media',
  general: 'General', notifications: 'Notifications', maintenance: 'Maintenance',
}));
const httpStatuses = new Map([[400, 'Bad request'], [401, 'Authentication required'], [403, 'Access denied'],
  [404, 'Not found'], [409, 'Conflict'], [413, 'File too large'], [415, 'Unsupported media type'],
  [422, 'Validation failed'], [429, 'Request limit reached'], [500, 'Internal server error'], [503, 'Service unavailable']]);
const fileTypes = new Map(Object.entries({
  'application/pdf': 'PDF document', 'image/jpeg': 'JPEG image', 'image/png': 'PNG image',
  'image/webp': 'WebP image', 'image/gif': 'GIF image', 'video/mp4': 'MP4 video',
  'video/webm': 'WebM video', 'audio/mpeg': 'MP3 audio', 'audio/ogg': 'Ogg audio', 'audio/wav': 'WAV audio',
}));
const sensitive = /password|secret|token|cookie|authorization|email|(?:full|first|last|applicant).?name|student.?id|notes|phone|address|content|buffer|base64/i;
const referenceKey = /(?:Id|_id)$|^actorSubject$|^resourceKey$/;

function label(key: string): string {
  return labels.get(key) ?? activityFieldLabel(key);
}

function valueText(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') {
    if (key === 'satisfied') return value ? 'Satisfied' : 'Not satisfied';
    return value ? 'Yes' : 'No';
  }
  if (key === 'size' && typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    if (value < 1024) return `${value.toLocaleString('en-US')} bytes`;
    const unit = value >= 1024 ** 3 ? 3 : value >= 1024 ** 2 ? 2 : 1;
    return `${(value / 1024 ** unit).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${['bytes', 'KB', 'MB', 'GB'][unit]}`;
  }
  if (key === 'status' && typeof value === 'number' && httpStatuses.has(value)) {
    return `${value} — ${httpStatuses.get(value)}`;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-US') : 'Not recorded';
  if (typeof value !== 'string') return 'Not recorded';
  if (value === '[REDACTED]') return 'Withheld for privacy';
  if (value === '[TRUNCATED]') return 'Details truncated';
  if (key === 'mimeType' && fileTypes.has(value)) return `${fileTypes.get(value)} (${value})`;
  if (key === 'interviewDate' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return `${date.toLocaleString('en-US', {
      timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    })} (Philippine time)`;
  }
  if (key === 'resourceType' || key === 'module') return activityModuleLabel(value);
  if (['actorType', 'actorRole', 'outcome', 'role', 'status', 'section'].includes(key)) return enums.get(value) ?? activityFieldLabel(value);
  return value.length > 1000 ? `${value.slice(0, 1000)}… (display shortened)` : value;
}

/** Read-only presentation of old and new audit metadata; never render arbitrary metadata as HTML. */
export function activityDetailGroups(log: ActivityLog): ActivityDetailGroup[] {
  const metadata = log.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const groups: ActivityDetailGroup[] = [
    { label: 'Event details', items: [] }, { label: 'Actor details', items: [] },
    { label: 'Request details', items: [] }, { label: 'Reference identifiers', items: [] },
  ];
  let remaining = 59;
  let truncated = false;
  function add(key: string, value: unknown, path: string[] = [], depth = 0): void {
    if (remaining <= 0) { truncated = true; return; }
    const id = [...path, key].join('.');
    const title = [...path.map(label), label(key)].join(' · ');
    const reference = referenceKey.test(key);
    const group = reference ? 3 : /^actor/.test(key) ? 1 : ['method', 'route', 'userAgent', 'ipAddress'].includes(key) ? 2 : 0;
    const push = (text: string) => { remaining--; groups[group]!.items.push({ id, label: title, value: text, reference }); };
    if (sensitive.test(key) && !(/^(passwordChanged|notesChanged)$/i.test(key) && typeof value === 'boolean')) {
      push('Withheld for privacy'); return;
    }
    if (depth >= 4 && value && typeof value === 'object') { push('Further details omitted'); return; }
    if (Array.isArray(value)) {
      if (!value.length) { push('None recorded'); return; }
      if (value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
        const items = value.slice(0, 30).map(item => key === 'fields' && typeof item === 'string' ? activityFieldLabel(item) : valueText(key, item));
        const text = [...new Set(items)].join(', ');
        push(`${text.slice(0, 4000)}${text.length > 4000 ? '… (display shortened)' : ''}${value.length > 30 ? ` (+${value.length - 30} more)` : ''}`);
      } else {
        if (value.length > 10) truncated = true;
        value.slice(0, 10).forEach((item, index) => add(`Item ${index + 1}`, item, [...path, key], depth + 1));
      }
      return;
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      if (!entries.length) { push('None recorded'); return; }
      if (entries.length > 30) truncated = true;
      entries.slice(0, 30).forEach(([nestedKey, item]) => add(nestedKey, item, [...path, key], depth + 1));
      return;
    }
    push(valueText(key, value));
  }
  const entries = Object.entries(metadata).filter(([key]) => key !== 'description');
  if (entries.length > 60) truncated = true;
  entries.slice(0, 60).forEach(([key, value]) => add(key, value));
  if (truncated) groups[0]!.items.push({ id: '__display_limit', label: 'Display limit',
    value: 'Some additional details were omitted from this view.', reference: false });
  return groups.filter(group => group.items.length);
}
