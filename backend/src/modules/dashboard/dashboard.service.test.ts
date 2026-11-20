import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import db from '../../config/db';
import { buildBuckets, buildTrend } from './dashboard.service';
import { getCreatedCountsByDate } from '../applications/application.repository';
import { getPublishedCountsByDate } from '../articles/article.repository';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('month-end and leap-year buckets are consecutive without overflow', () => {
  for (const date of ['2026-03-31T12:00:00Z', '2024-02-29T12:00:00Z', '2026-12-31T12:00:00Z']) {
    const buckets = buildBuckets('monthly', new Date(date));
    assert.equal(buckets.length, 12);
    assert.equal(new Set(buckets.map(b => b.label)).size, 12);
    for (let i = 0; i < buckets.length; i++) {
      assert.equal(buckets[i]!.start.getUTCDate(), 1);
      if (i > 0) assert.equal(+buckets[i - 1]!.end, +buckets[i]!.start);
    }
    assert.equal(buckets.at(-1)!.start.getUTCMonth(), new Date(date).getUTCMonth());
  }
});

test('trend counts inclusive starts, exclusive ends, empty series and out-of-range rows', () => {
  const buckets = buildBuckets('daily', new Date('2026-11-19T23:00:00Z')).slice(-2);
  const trend = buildTrend(buckets, [
    { date: '2026-11-17', count: 99 }, { date: '2026-11-18', count: 2 },
    { date: '2026-11-19', count: 3 }, { date: '2026-11-20', count: 99 },
  ], []);
  assert.deepEqual(trend.articles, [2, 3]);
  assert.deepEqual(trend.applications, [0, 0]);
});

test('all trend modes have contiguous UTC buckets', () => {
  for (const mode of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
    const buckets = buildBuckets(mode, new Date('2024-02-29T23:59:00Z'));
    for (let i = 1; i < buckets.length; i++) assert.equal(+buckets[i - 1]!.end, +buckets[i]!.start);
  }
});

test('trend repositories bound timestamp scans and group dates in UTC', async () => {
  const start = new Date('2026-11-01Z'), end = new Date('2026-12-01Z');
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    assert.match(sql, />= \$1 AND \w+ < \$2/);
    assert.match(sql, /AT TIME ZONE 'UTC'/);
    assert.deepEqual(params, [start.toISOString(), end.toISOString()]);
    return { rows: [{ date: '2026-11-19', count: '4' }] };
  });
  assert.deepEqual(await getCreatedCountsByDate(start, end), [{ date: '2026-11-19', count: 4 }]);
  assert.deepEqual(await getPublishedCountsByDate(start, end), [{ date: '2026-11-19', count: 4 }]);
});
