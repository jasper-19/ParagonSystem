import { ActivityLog } from './activity-log.model';

const modules = new Map(Object.entries({
  ARTICLES: 'Articles', SPECIAL_ISSUES: 'Special issues', MEDIA: 'Media library',
  APPLICATIONS: 'Staff applications', STAFF: 'Staff directory', STAFF_DIRECTORY: 'Staff directory',
  EDITORIAL_BOARDS: 'Editorial board', SETTINGS: 'System settings', SYSTEM_SETTINGS: 'System settings',
  USERS: 'User accounts', AUTH: 'Authentication', NOTIFICATIONS: 'Notifications',
  ACTIVITY_LOGS: 'Activity logs', COLLEGES: 'Colleges', DASHBOARD: 'Dashboard',
  CATEGORIES: 'Categories', SYSTEM: 'System',
}));

const actions = new Map(Object.entries({
  CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted', UPLOAD: 'Uploaded',
  LOGIN: 'Signed in', LOGOUT: 'Signed out', LOGOUT_SESSION: 'Session signed out',
  CHANGE_PASSWORD: 'Password changed', SET_2FA: 'Two-factor authentication updated',
  REVOKE_OTHER_SESSIONS: 'Other sessions revoked', PUBLISH: 'Published', UNPUBLISH: 'Unpublished',
  ARCHIVE: 'Archived', UPDATE_STATUS: 'Status changed', REPLACE_PDF: 'PDF replaced',
  SCHEDULE_INTERVIEW: 'Interview scheduled', MARK_INTERVIEWED: 'Interview completed',
  ADD_NOTES: 'Interview notes updated', ACCEPT: 'Accepted', REJECT: 'Rejected', ASSIGN: 'Assigned',
  ACTIVATE: 'Activated', ADD_MEMBER: 'Member added', UPDATE_MEMBER: 'Member updated',
  REMOVE_MEMBER: 'Member removed', REVOKE_MEMBER: 'Membership revoked',
  ASSIGN_APPLICATION: 'Applicant assigned to board', SATISFY: 'Board satisfaction updated',
  READ_ALL: 'All notifications marked as read', AUTHENTICATION_FAILED: 'Authentication failed',
  ACCESS_DENIED: 'Access denied', RATE_LIMITED: 'Request limit reached', REQUEST_FAILED: 'Request failed',
  APPROVE: 'Approved', VERIFY: 'Verified',
}));

function code(value?: string | null): string {
  return value?.trim().toUpperCase() ?? '';
}

function readable(value: string): string {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().trim();
  return words.replace(/\b(pdf|api|ip|id|http|2fa)\b/g, word => word.toUpperCase())
    .replace(/^\w/, letter => letter.toUpperCase());
}

export function activityModuleLabel(value?: string | null): string {
  return modules.get(code(value)) ?? (value?.trim() ? readable(value) : 'System');
}

export function activityActionLabel(value?: string | null): string {
  return actions.get(code(value)) ?? (value?.trim() ? readable(value) : 'Unknown action');
}

const settingsSections = new Map(Object.entries({
  general: 'general', publishingMedia: 'publishing and media', notifications: 'notification', maintenance: 'maintenance',
}));

const statuses = new Map(Object.entries({
  PENDING: 'pending', INTERVIEW_SCHEDULED: 'interview scheduled', INTERVIEW_COMPLETED: 'interview completed',
  ACCEPTED: 'accepted', REJECTED: 'rejected', DRAFT: 'draft', PUBLISHED: 'published', ARCHIVED: 'archived',
}));

const fieldLabels = new Map(Object.entries({
  title: 'title', slug: 'web address', status: 'status', category: 'category', tags: 'tags',
  content: 'article content', excerpt: 'summary', image: 'cover image', featured: 'featured placement',
  authorIds: 'authors', photoByIds: 'photo credits', externalPhotoCredits: 'external photo credits', graphicByIds: 'graphic credits', illustrationByIds: 'illustration credits',
  altText: 'alternative text', caption: 'caption', role: 'role', isActive: 'account access', staffId: 'linked staff member',
  password: 'password', fullName: 'name', email: 'email address', studentId: 'student ID',
  yearLevel: 'year level', collegeId: 'college', programId: 'program', positionId: 'position',
  assignedSection: 'assigned section', assignedRole: 'assigned role', subRole: 'additional role',
  siteName: 'site name', siteDescription: 'site description', contactEmail: 'contact email', logoUrl: 'logo',
  timezone: 'time zone', dateFormat: 'date format', timeFormat: 'time format',
  allowDirectPublishing: 'direct publishing', requireFeaturedImage: 'cover image requirement',
  maxUploadSizeMb: 'upload size limit', allowedMimeTypes: 'allowed file types', optimizeImages: 'image optimization',
  inAppEnabled: 'in-app notifications', applicationEvents: 'application notifications',
  articleCreated: 'article creation notifications', articlePublished: 'publication notifications',
  enabled: 'enabled state', message: 'message', retryAfterSeconds: 'retry interval',
}));

export function activityFieldLabel(value: string): string {
  const label = fieldLabels.get(value);
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : readable(value);
}

function metadataText(log: ActivityLog, key: string): string | undefined {
  const value = log.metadata?.[key];
  return typeof value === 'string' && value.trim() && !/^\[(REDACTED|TRUNCATED)\]$/.test(value)
    ? value.trim().slice(0, 180) : undefined;
}

function changedFields(log: ActivityLog): string {
  const fields = log.metadata?.['fields'];
  if (!Array.isArray(fields)) return '';
  // Only field names are displayed, never arbitrary metadata values or note contents.
  const labels = [...new Set(fields.filter((field): field is string => typeof field === 'string')
    .map(field => fieldLabels.get(field)).filter((label): label is string => !!label))];
  const remaining = labels.length - 4;
  return labels.length ? ` Changed: ${labels.slice(0, 4).join(', ')}${remaining > 0 ? ` and ${remaining} more ${remaining === 1 ? 'field' : 'fields'}` : ''}.` : '';
}

/** Shared by desktop/mobile rows and the details dialog; persisted audit data stays intact. */
export function activityDescription(log: ActivityLog): string {
  const action = code(log.action);
  const module = code(log.module);
  const area = activityModuleLabel(log.module);
  const metadata = log.metadata;
  if (action === 'AUTHENTICATION_FAILED') {
    return module === 'AUTH' && metadata?.['route'] === '/login'
      ? 'Sign-in attempt failed.' : `Authentication failed for a request to ${area.toLowerCase()}.`;
  }
  if (action === 'ACCESS_DENIED') return `Access to ${area.toLowerCase()} was denied.`;
  if (action === 'RATE_LIMITED') return `The request limit for ${area.toLowerCase()} was reached.`;
  if (action === 'REQUEST_FAILED') {
    const status = metadata?.['status'];
    const suffix = typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? ` (HTTP ${status})` : '';
    return `A request to ${area.toLowerCase()} failed${suffix}.`;
  }
  if (module === 'EDITORIAL_BOARDS' && action === 'SATISFY') {
    return metadata?.['satisfied'] === true ? 'Marked the editorial board as satisfied.'
      : metadata?.['satisfied'] === false ? 'Marked the editorial board as not satisfied.'
      : 'Updated the editorial board satisfaction status.';
  }
  if ((module === 'SYSTEM_SETTINGS' || module === 'SETTINGS') && action === 'UPDATE') {
    const section = settingsSections.get(metadataText(log, 'section') ?? log.entityId);
    return `Updated ${section ? `${section} settings` : 'system settings'}.${changedFields(log)}`;
  }
  if (action === 'UPDATE_STATUS') {
    const status = statuses.get(code(metadataText(log, 'status')));
    const target = module === 'APPLICATIONS' ? 'application' : module === 'SPECIAL_ISSUES' ? 'special issue' : 'record';
    return status ? `Changed the ${target} status to ${status}.` : `Updated the ${target} status.`;
  }
  if (module === 'AUTH' && action === 'CHANGE_PASSWORD') return 'Changed the account password.';
  if (module === 'AUTH' && action === 'LOGIN') return 'Signed in to PARAGON.';
  if (module === 'AUTH' && action === 'LOGOUT') return 'Signed out of PARAGON.';
  if (module === 'AUTH' && action === 'LOGOUT_SESSION') return 'Signed out a session.';
  if (module === 'AUTH' && action === 'SET_2FA') {
    return metadata?.['enabled'] === false ? 'Disabled two-factor authentication.'
      : metadata?.['enabled'] === true ? 'Enabled two-factor authentication.' : 'Updated two-factor authentication settings.';
  }
  if (module === 'APPLICATIONS') {
    const descriptions = new Map(Object.entries({
      CREATE: 'Received a new staff application.', ACCEPT: 'Accepted the staff application.',
      REJECT: 'Rejected the staff application.', DELETE: 'Deleted the staff application.',
      SCHEDULE_INTERVIEW: 'Scheduled an interview for the application.',
      MARK_INTERVIEWED: 'Marked the application interview as completed.',
      ADD_NOTES: 'Updated interview notes for the application.',
      ASSIGN: 'Assigned the applicant to a publication section and role.',
    }));
    const description = descriptions.get(action);
    if (description) return description;
  }
  if (module === 'STAFF' || module === 'STAFF_DIRECTORY') {
    if (action === 'CREATE') return 'Created a staff profile from an application.';
    if (action === 'DELETE') return 'Deleted the staff profile.';
  }
  if (module === 'MEDIA') {
    if (action === 'UPLOAD') return 'Uploaded a file to the media library.';
    if (action === 'DELETE') return 'Deleted the media library record.';
  }
  if (module === 'EDITORIAL_BOARDS') {
    const descriptions = new Map(Object.entries({
      ACTIVATE: 'Activated the editorial board.', DELETE: 'Deleted the editorial board.',
      ADD_MEMBER: 'Added a staff member to the editorial board.',
      UPDATE_MEMBER: 'Updated an editorial board member’s details.',
      REMOVE_MEMBER: 'Removed a member from the editorial board.',
      REVOKE_MEMBER: 'Revoked an editorial board membership.',
      ASSIGN_APPLICATION: 'Assigned an accepted applicant to the editorial board.',
    }));
    const description = descriptions.get(action);
    if (description) return description;
  }
  const title = ['ARTICLES', 'SPECIAL_ISSUES'].includes(module) ? metadataText(log, 'title') : undefined;
  if (title && ['CREATE', 'PUBLISH', 'ARCHIVE', 'DELETE'].includes(action)) {
    return `${activityActionLabel(action)} the ${module === 'ARTICLES' ? 'article' : 'special issue'} “${title}”.`;
  }
  const fields = changedFields(log);
  if (action === 'UPDATE' && fields && ['ARTICLES', 'SPECIAL_ISSUES', 'MEDIA', 'USERS', 'STAFF', 'STAFF_DIRECTORY'].includes(module)) {
    const noun = module === 'ARTICLES' ? 'article' : module === 'SPECIAL_ISSUES' ? 'special issue'
      : module === 'MEDIA' ? 'media details' : module === 'USERS' ? 'user account' : 'staff member';
    const title = ['ARTICLES', 'SPECIAL_ISSUES'].includes(module) ? metadataText(log, 'title') : undefined;
    return `Updated ${title ? `the ${noun} “${title}”` : noun === 'media details' ? noun : `the ${noun}`}.${fields}`;
  }
  const target = module === 'ARTICLES' ? 'the article' : module === 'SPECIAL_ISSUES' ? 'the special issue'
    : module === 'APPLICATIONS' ? 'the application' : module === 'STAFF' ? 'the staff member'
    : module === 'EDITORIAL_BOARDS' ? 'the board record' : module === 'USERS' ? 'the account' : 'the record';
  const description = log.description?.trim();
  return description
    ? description.replace(/:\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.?$/i, '.')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, target)
    : `${activityActionLabel(log.action)} · ${area}`;
}
