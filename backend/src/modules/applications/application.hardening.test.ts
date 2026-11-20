import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import db from '../../config/db';
import * as repository from './application.repository';
import { applicationListQuerySchema, scheduleInterviewSchema } from './application.schema';

afterEach(() => mock.restoreAll());
after(() => db.end());
const statusCode = (code: number) => (error: any) => error.statusCode === code;

test('invalid pagination is rejected before a database query', async () => {
  mock.method(db, 'query', () => { throw new Error('Unexpected database call'); });
  for (const page of [NaN, Infinity, 0, -1, 1.5, 1e20]) {
    await assert.rejects(repository.findAll({ page }), statusCode(400));
  }
  for (const page of ['abc', '', ['1', '2']]) assert.equal(applicationListQuerySchema.safeParse({ page }).success, false);
  assert.equal(scheduleInterviewSchema.safeParse({ interviewDate: 'tomorrow' }).success, false);
  assert.equal(scheduleInterviewSchema.safeParse({ interviewDate: '2026-11-20T10:30' }).success, true);
});

function transaction(current: Record<string, unknown> | undefined) {
  const events: string[] = [];
  const updates: unknown[][] = [];
  mock.method(db, 'connect', async () => ({
    query: async (sql: string, params: unknown[] = []) => {
      events.push(sql);
      if (sql.startsWith('SELECT')) return { rows: current ? [current] : [] };
      if (sql.startsWith('UPDATE')) { updates.push(params); return { rows: [{ id: 'id', ...current }] }; }
      return { rows: [] };
    }, release: () => events.push('release'),
  }));
  return { events, updates };
}

test('all missing transition targets return 404 and release their transaction', async () => {
  const { events } = transaction(undefined);
  for (const action of [() => repository.updateStatus('id', 'pending'),
    () => repository.scheduleInterview('id', '2026-11-20T10:30Z'),
    () => repository.markInterviewed('id'), () => repository.acceptApplication('id'),
    () => repository.rejectApplication('id'), () => repository.assignApplication('id', 'News', 'Writer')]) {
    await assert.rejects(action(), statusCode(404));
    assert.deepEqual(events.slice(-2), ['ROLLBACK', 'release']);
  }
});

test('missing notes and delete targets return 404', async () => {
  mock.method(db, 'query', async () => ({ rows: [] }));
  await assert.rejects(repository.addInterviewNotes('id', 'note'), statusCode(404));
  await assert.rejects(repository.remove('id'), statusCode(404));
});

test('assignment requires acceptance and assigned applicants cannot lose acceptance', async () => {
  const { updates } = transaction({ status: 'pending', assigned: false });
  await assert.rejects(repository.assignApplication('id', 'News', 'Writer'), statusCode(409));
  assert.equal(updates.length, 0);
  mock.restoreAll();
  transaction({ status: 'accepted', assigned: true });
  await assert.rejects(repository.rejectApplication('id'), statusCode(409));
});

test('cancelling an interview resets date and flag; acceptance marks interviewed', async () => {
  const { updates, events } = transaction({ status: 'interview_scheduled', interview_date: '2026-11-20', interviewed: true });
  await repository.updateStatus('id', 'pending');
  assert.deepEqual(updates[0], ['id', 'pending', false, null, null, false]);
  await repository.acceptApplication('id', 'Final notes');
  assert.deepEqual(updates[1], ['id', 'accepted', true, '2026-11-20', 'Final notes', true]);
  assert.ok(events.some(sql => sql.includes('FOR UPDATE')));
  assert.deepEqual(events.slice(-2), ['COMMIT', 'release']);
});

test('scheduled status requires a date', async () => {
  transaction({ status: 'pending', interview_date: null });
  await assert.rejects(repository.updateStatus('id', 'interview_scheduled'), statusCode(409));
});
