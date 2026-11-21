import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import type { Request } from 'express';
import db from '../../config/db';
import { getSettings } from '../settings/settings.service';
import { auditLog, drainAuditLogs } from './activity-log.audit';
import { describeAuditNotification, notificationEnabled } from './activity-notification.policy';

const settings = { inAppEnabled: true, applicationEvents: true, articleCreated: true, articlePublished: true };
const actions: Record<string, string[]> = {
  ARTICLES: ['CREATE', 'UPDATE', 'PUBLISH', 'ARCHIVE', 'DELETE'],
  APPLICATIONS: ['CREATE', 'UPDATE_STATUS', 'SCHEDULE_INTERVIEW', 'MARK_INTERVIEWED', 'ADD_NOTES', 'ACCEPT', 'REJECT', 'DELETE', 'ASSIGN', 'UPDATE'],
  STAFF: ['CREATE', 'UPDATE', 'DELETE'],
  EDITORIAL_BOARDS: ['CREATE', 'ACTIVATE', 'DELETE', 'ADD_MEMBER', 'ASSIGN_APPLICATION', 'UPDATE_MEMBER', 'REMOVE_MEMBER', 'REVOKE_MEMBER', 'SATISFY'],
  MEDIA: ['UPLOAD', 'UPDATE', 'DELETE'],
  SPECIAL_ISSUES: ['CREATE', 'UPDATE', 'REPLACE_PDF', 'UPDATE_STATUS', 'DELETE'],
  SYSTEM_SETTINGS: ['UPDATE'], USERS: ['CREATE', 'UPDATE'],
  AUTH: ['CHANGE_PASSWORD', 'SET_2FA', 'REVOKE_OTHER_SESSIONS', 'LOGOUT_SESSION', 'LINK_GOOGLE'],
};

afterEach(async () => { await drainAuditLogs(); mock.restoreAll(); });
after(async () => { await db.end(); });

test('all supported mutation actions notify, with preference gates and no failure/read noise', () => {
  for (const [module, events] of Object.entries(actions)) for (const action of events) {
    const notice = describeAuditNotification(action, module);
    assert.ok(notice, `${module}/${action} missing notification`);
    assert.ok(notificationEnabled(notice, settings));
    assert.equal(notificationEnabled(notice, { ...settings, inAppEnabled: false }), false);
    if (notice.preference) assert.equal(notificationEnabled(notice, { ...settings, [notice.preference]: false }), false);
    assert.equal(describeAuditNotification(action, module, 'failure'), null);
  }
  for (const module of Object.keys(actions)) for (const action of ['READ', 'LOGIN', 'LOGOUT', 'REQUEST_FAILED', '__proto__', 'constructor']) {
    assert.equal(describeAuditNotification(action, module), null);
  }
  assert.equal(describeAuditNotification('CREATE', '__proto__'), null);
  assert.equal(describeAuditNotification('UPDATE', 'UNKNOWN'), null);
  assert.equal(describeAuditNotification('CREATE', 'APPLICATIONS')!.preference, 'applicationEvents');
  assert.equal(describeAuditNotification('CREATE', 'ARTICLES')!.preference, 'articleCreated');
  assert.equal(describeAuditNotification('PUBLISH', 'ARTICLES')!.preference, 'articlePublished');
});

let settingsVersion = 0;
const entity = '22222222-2222-4222-8222-222222222222';
function request(): Request {
  return { user: { sub: 'env-admin', role: 'admin' }, get: () => 'Synthetic browser' } as unknown as Request;
}
function fixture() {
  const state = { preferences: { ...settings }, failAudit: false, failNotification: false,
    notices: [] as unknown[][], audits: 0 };
  mock.method(db, 'query', async (sql: string, values: unknown[] = []) => {
    if (sql.includes('FROM system_settings')) return { rows: [{ version: ++settingsVersion, updated_at: new Date(), notifications: state.preferences }] };
    if (sql.includes('INSERT INTO activity_logs')) {
      state.audits++;
      if (state.failAudit) throw Object.assign(new Error('private audit SQL'), { code: '08006' });
      return { rows: [{ id: entity, action: values[1], resource_type: values[2], details: values[4], created_at: new Date() }] };
    }
    if (sql.includes('INSERT INTO notifications')) {
      if (state.failNotification) throw Object.assign(new Error('private notification SQL'), { code: '08006' });
      state.notices.push(values);
      return { rows: [{ id: entity, message: values[0], type: values[1], is_read: false, created_at: new Date() }] };
    }
    throw new Error('Unexpected query');
  });
  return state;
}

test('concurrent hooks notify once per request/action/resource and never copy personal details', async () => {
  const state = fixture(); await getSettings(true);
  const req = request();
  await Promise.all([1, 2].map(() => auditLog(req, 'ACCEPT', 'APPLICATIONS', 'private applicant name', {
    resourceId: entity, details: { email: 'private@example.test', notes: 'private notes' },
  })));
  assert.equal(state.audits, 2);
  assert.deepEqual(state.notices, [['An application was accepted.', 'application']]);
  await auditLog(request(), 'ACCEPT', 'APPLICATIONS', 'private applicant name');
  assert.equal(state.notices.length, 2);
});

test('notification and audit failures are isolated and log only bounded codes', async () => {
  const state = fixture(); await getSettings(true);
  const errors: unknown[][] = [];
  mock.method(console, 'error', (...args: unknown[]) => errors.push(args));
  state.failAudit = true;
  await assert.doesNotReject(auditLog(request(), 'UPDATE', 'STAFF', 'private description'));
  assert.equal(state.notices.length, 1);
  state.failAudit = false; state.failNotification = true;
  await assert.doesNotReject(auditLog(request(), 'UPDATE', 'STAFF', 'private description'));
  assert.equal(state.audits, 2);
  assert.match(JSON.stringify(errors), /AUDIT_WRITE_FAILED/);
  assert.match(JSON.stringify(errors), /NOTIFICATION_WRITE_FAILED/);
  assert.doesNotMatch(JSON.stringify(errors), /private/);
});

test('hook honors master and category preferences and excludes failures and notification read actions', async () => {
  const state = fixture(); state.preferences.inAppEnabled = false; await getSettings(true);
  await auditLog(request(), 'UPDATE', 'STAFF', 'Updated');
  state.preferences = { ...settings, applicationEvents: false, articleCreated: false, articlePublished: false };
  await getSettings(true);
  for (const [action, module] of [['CREATE', 'APPLICATIONS'], ['CREATE', 'ARTICLES'], ['PUBLISH', 'ARTICLES'], ['READ_ALL', 'NOTIFICATIONS']]) {
    await auditLog(request(), action!, module!, 'Updated');
  }
  await auditLog(request(), 'UPDATE', 'STAFF', 'Failed', { outcome: 'failure' });
  assert.equal(state.notices.length, 0);
  await auditLog(request(), 'UPDATE', 'STAFF', 'Updated');
  assert.equal(state.notices.length, 1);
});
