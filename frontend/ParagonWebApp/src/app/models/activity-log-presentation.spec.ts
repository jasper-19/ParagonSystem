import { ActivityLog } from './activity-log.model';
import { activityActionLabel, activityDescription, activityModuleLabel } from './activity-log-presentation';

describe('Activity log presentation', () => {
  const log = (changes: Partial<ActivityLog>): ActivityLog => ({
    id: 'event', userId: 'user', action: 'UPDATE', module: 'ARTICLES', description: '',
    entityId: 'record', entityType: 'ARTICLES', ipAddress: '', createdAt: '', ...changes,
  });

  it('labels current and legacy modules, acronyms and unknown event codes consistently', () => {
    expect(activityModuleLabel('SYSTEM_SETTINGS')).toBe('System settings');
    expect(activityModuleLabel('SETTINGS')).toBe('System settings');
    expect(activityModuleLabel('STAFF')).toBe('Staff directory');
    expect(activityActionLabel('REVOKE_OTHER_SESSIONS')).toBe('Other sessions revoked');
    expect(activityActionLabel('SET_2FA')).toBe('Two-factor authentication updated');
    expect(activityActionLabel('new_pdf_action')).toBe('New PDF action');
    expect(activityModuleLabel('constructor')).toBe('Constructor');
    expect(activityModuleLabel(null)).toBe('System');
  });

  it('summarizes settings and changed fields without displaying their values', () => {
    expect(activityDescription(log({ module: 'SYSTEM_SETTINGS', entityId: 'publishingMedia',
      metadata: { section: 'publishingMedia', fields: ['maxUploadSizeMb', 'allowedMimeTypes'], maxUploadSizeMb: 999 },
    }))).toBe('Updated publishing and media settings. Changed: upload size limit, allowed file types.');
    expect(activityDescription(log({ metadata: { title: 'Campus news', fields: ['title', 'content', 'category'], content: 'private' } })))
      .toBe('Updated the article “Campus news”. Changed: title, article content, category.');
    expect(activityDescription(log({ module: 'MEDIA', metadata: {
      fields: ['title', 'title', 'caption', 'altText', 'tags', 'status', 'unknownSecret'], unknownSecret: 'private',
    } }))).toBe('Updated media details. Changed: title, caption, alternative text, tags and 1 more field.');
  });

  it('describes application outcomes without exposing legacy applicant details or IDs', () => {
    expect(activityDescription(log({ module: 'APPLICATIONS', action: 'ACCEPT', description: 'Accepted application: Private Name', metadata: { fullName: 'Private Name' } })))
      .toBe('Accepted the staff application.');
    expect(activityDescription(log({ module: 'APPLICATIONS', action: 'UPDATE_STATUS', metadata: { status: 'interview_scheduled' } })))
      .toBe('Changed the application status to interview scheduled.');
    expect(activityDescription(log({ module: 'MEDIA', action: 'DELETE' }))).toBe('Deleted the media library record.');
    expect(activityDescription(log({ module: 'APPLICATIONS', action: 'UPDATE_STATUS', metadata: { status: { private: true } } })))
      .toBe('Updated the application status.');
  });

  it('distinguishes failed sign-ins, expired authentication and failed operations', () => {
    expect(activityDescription(log({ module: 'AUTH', action: 'AUTHENTICATION_FAILED', metadata: { route: '/login' } })))
      .toBe('Sign-in attempt failed.');
    expect(activityDescription(log({ module: 'MEDIA', action: 'AUTHENTICATION_FAILED' })))
      .toBe('Authentication failed for a request to media library.');
    expect(activityDescription(log({ module: 'MEDIA', action: 'REQUEST_FAILED', metadata: { status: 415, route: '/upload' } })))
      .toBe('A request to media library failed (HTTP 415).');
  });

  it('keeps historical text and title words intact and supplies missing descriptions', () => {
    expect(activityDescription(log({ description: 'Updated the true story about false alarms.' })))
      .toBe('Updated the true story about false alarms.');
    expect(activityDescription(log({ action: 'CUSTOM_EVENT', module: 'SYSTEM' }))).toBe('Custom event · System');
    expect(activityDescription(log({ action: 'DELETE', description: 'Deleted article: 11111111-1111-4111-8111-111111111111' })))
      .toBe('Deleted article.');
    expect(activityDescription(log({ module: 'EDITORIAL_BOARDS', action: 'SATISFY', metadata: { satisfied: false } })))
      .toBe('Marked the editorial board as not satisfied.');
    const title = 'A true story: 11111111-1111-4111-8111-111111111111 <news>';
    expect(activityDescription(log({ action: 'PUBLISH', metadata: { title } })))
      .toBe(`Published the article “${title}”.`);
  });
});
