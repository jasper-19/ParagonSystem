import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { Client } from 'pg';
import dotenv from 'dotenv';

// Explicit opt-in: exercises PostgreSQL only on loopback, in a temporary table.
// PHOTO_CREDIT_DB_TEST=1 node --import tsx --test src/modules/articles/article.photo-credits.migration.test.ts
// No hosted database URL is accepted and no permanent tables are modified.
test('photo credit migration is repeatable and permits external photos only', {
  skip: process.env.PHOTO_CREDIT_DB_TEST !== '1',
}, async () => {
  dotenv.config({ quiet: true });
  const client = new Client({ host: '127.0.0.1', port: 5432,
    user: process.env.DB_USER, database: process.env.DB_NAME, password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 30000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE article_credits_integration (staff_id uuid NOT NULL, credit_type varchar(30) NOT NULL, credited_name varchar(255) NOT NULL) ON COMMIT DROP');
    await client.query("INSERT INTO article_credits_integration VALUES ('11111111-1111-4111-8111-111111111111','author','Existing Writer')");
    const source = await readFile(path.resolve(__dirname, '../../config/migrate.sql'), 'utf8');
    const start = source.indexOf('-- Photo credits may name outside');
    assert.ok(start >= 0, 'Photo credit migration must be present');
    const end = source.indexOf('-- End photo credit migration.', start);
    assert.ok(end > start, 'Photo credit migration must have a bounded end');
    const sql = source.slice(start, end).split('public.article_credits').join('pg_temp.article_credits_integration');
    await client.query(sql);
    await client.query(sql);
    await client.query('INSERT INTO article_credits_integration VALUES ($1,$2,$3)', [null, 'photo', 'x'.repeat(2000)]);
    const rows = await client.query('SELECT staff_id, credit_type, length(credited_name) AS name_length FROM article_credits_integration ORDER BY credit_type');
    assert.equal(rows.rowCount, 2);
    assert.equal(rows.rows[0].staff_id, '11111111-1111-4111-8111-111111111111');
    assert.equal(rows.rows[1].staff_id, null);
    assert.equal(rows.rows[1].name_length, 2000);
    for (const type of ['author', 'graphic', 'illustration']) {
      await client.query('SAVEPOINT invalid_credit');
      await assert.rejects(client.query('INSERT INTO article_credits_integration VALUES ($1,$2,$3)', [null, type, 'Invalid']), { code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT invalid_credit');
    }
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
