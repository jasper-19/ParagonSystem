import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import db from '../../config/db';
import { updateUser } from './user.repository';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('concurrent deactivation/demotion rechecks membership after acquiring the shared lock', async () => {
  const users = new Map(['a', 'b'].map(id => [id, { id, role: 'admin', is_active: true }]));
  let queue = Promise.resolve();
  let released = 0;
  mock.method(db, 'query', () => { throw new Error('Must use the transaction connection'); });
  mock.method(db, 'connect', async () => {
    let unlock: (() => void) | undefined;
    let locked = false;
    return {
      query: async (sql: string, params: unknown[] = []) => {
        if (sql.startsWith('LOCK TABLE')) {
          const prior = queue;
          queue = new Promise<void>(resolve => { unlock = resolve; });
          await prior;
          locked = true;
        } else if (sql.startsWith('SELECT role')) {
          assert.ok(locked);
          return { rows: [users.get(String(params[0]))] };
        } else if (sql.startsWith('SELECT COUNT')) {
          assert.ok(locked);
          return { rows: [{ count: [...users.values()].filter(user => user.role === 'admin' && user.is_active).length }] };
        } else if (sql.startsWith('WITH updated')) {
          assert.ok(locked);
          assert.match(sql, /UPDATE user_sessions SET revoked_at/);
          const user = users.get(String(params.at(-1)))!;
          if (sql.includes('is_active =')) user.is_active = Boolean(params[0]);
          else user.role = String(params[0]);
          return { rows: [user] };
        } else if (sql === 'COMMIT' || sql === 'ROLLBACK') {
          unlock?.();
        }
        return { rows: [] };
      }, release: () => { released++; },
    };
  });
  const results = await Promise.allSettled([updateUser('a', { isActive: false }), updateUser('b', { role: 'staff' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
  assert.equal(failure.reason.statusCode, 409);
  assert.equal([...users.values()].filter(user => user.role === 'admin' && user.is_active).length, 1);
  assert.equal(released, 2);
});

test('database update failures roll back and release the connection', async () => {
  const events: string[] = [];
  mock.method(db, 'connect', async () => ({
    query: async (sql: string) => {
      events.push(sql);
      if (sql.startsWith('WITH updated')) throw new Error('write failed');
      return { rows: [] };
    }, release: () => events.push('release'),
  }));
  await assert.rejects(updateUser('id', { passwordHash: 'fixture-hash' }), /write failed/);
  assert.deepEqual(events.slice(-2), ['ROLLBACK', 'release']);
});
