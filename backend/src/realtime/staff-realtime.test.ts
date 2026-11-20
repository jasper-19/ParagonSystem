import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, mock, test } from 'node:test';
import type { Socket } from 'socket.io';
import pool from '../config/db';
import { updateStaffMember } from '../modules/staff/staff.service';
import { signAuthToken } from '../security/auth-token';
import { initializeSocket } from './socket';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'staff-realtime-test-secret-at-least-32-bytes';
after(async () => { mock.restoreAll(); await pool.end(); });

test('staff saves notify only live admins after success and survive transport failures', async () => {
  const io = initializeSocket(createServer());
  const row = { id: 'sample', full_name: 'Updated Editor', email: 'sample@example.test' };
  let completeSave!: (value: { rows: typeof row[] }) => void;
  let save: () => Promise<{ rows: typeof row[] }> = () => new Promise(resolve => { completeSave = resolve; });
  let authVersion = '0';
  const query = mock.method(pool, 'query', async (sql: string) => {
    if (sql.startsWith('UPDATE staff_members')) return save();
    assert.ok(sql.includes('FROM users u JOIN user_sessions'));
    return { rows: [{ password_hash: 'test-hash', auth_version: authVersion }] };
  });
  const token = signAuthToken({
    subject: '11111111-1111-4111-8111-111111111111',
    sid: '22222222-2222-4222-8222-222222222222',
    role: 'admin', passwordHash: 'test-hash', authVersion: '0',
  });
  const notifications: unknown[][] = [];
  const admin = {
    data: { isAdmin: true, authToken: token }, connected: true,
    emit: (...args: unknown[]) => { notifications.push(args); return true; },
    disconnect: () => { admin.connected = false; },
  };
  const publicNotifications: unknown[][] = [];
  io.sockets.sockets.set('admin', admin as unknown as Socket);
  io.sockets.sockets.set('public', {
    data: {}, connected: true,
    emit: (...args: unknown[]) => { publicNotifications.push(args); return true; },
  } as unknown as Socket);

  try {
    const pending = updateStaffMember('sample', { fullName: row.full_name });
    assert.deepEqual(notifications, []);
    completeSave({ rows: [row] });
    assert.equal((await pending).fullName, row.full_name);
    assert.deepEqual(notifications, [['staff:updated', undefined]]);
    assert.deepEqual(publicNotifications, []);

    save = async () => { throw new Error('Save failed'); };
    await assert.rejects(updateStaffMember('sample', { fullName: 'Rejected' }), /Save failed/);
    save = async () => ({ rows: [] });
    await assert.rejects(updateStaffMember('missing', { fullName: 'Missing' }), { statusCode: 404 });
    assert.equal(notifications.length, 1);

    save = async () => ({ rows: [row] });
    const emit = mock.method(admin, 'emit', () => { throw new Error('Transport unavailable'); });
    assert.equal((await updateStaffMember('sample', { fullName: row.full_name })).fullName, row.full_name);
    emit.mock.restore();

    authVersion = '1';
    await updateStaffMember('sample', { fullName: row.full_name });
    assert.equal(notifications.length, 1);
    assert.equal(admin.connected, false);
    assert.deepEqual(publicNotifications, []);
  } finally {
    query.mock.restore();
    io.sockets.sockets.clear();
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
