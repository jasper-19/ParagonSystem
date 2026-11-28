import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, mock, test } from 'node:test';
import db from '../../config/db';
import * as service from './article.service';
import * as repository from './article.repository';
import { createArticleSchema, updateArticleSchema } from './article.schema';
import { DEFAULT_GENERAL_SETTINGS, DEFAULT_MAINTENANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_PUBLISHING_MEDIA_SETTINGS } from '../settings/settings.defaults';

const authorId = '11111111-1111-4111-8111-111111111111';
const photoId = '22222222-2222-4222-8222-222222222222';
const inactiveId = '33333333-3333-4333-8333-333333333333';
const articleId = '44444444-4444-4444-8444-444444444444';
const payload = { title: 'Campus story', slug: 'campus-story', excerpt: 'Introduction', content: '<p>Story</p>',
  author: 'Staff Writer', authorIds: [authorId], photoByIds: [] as string[],
  graphicByIds: [], illustrationByIds: [], category: 'News', status: 'Draft', tags: ['campus'] };
let row: Record<string, any>;
let creditRows: Record<string, any>[];
let failCreditInsert = false;
let failFeaturedUpdate = false;
let beforeArticleLock: (() => void) | undefined;
let statements: Array<{ sql: string; values: any[] }>;

beforeEach(() => {
  row = { id: articleId, title: payload.title, slug: payload.slug, status: 'Draft', photo_by: '', created_at: new Date() };
  creditRows = []; statements = []; failCreditInsert = false; failFeaturedUpdate = false;
  beforeArticleLock = undefined;
  let connected = false;
  const query = async (sql: string, values: any[] = []) => {
    statements.push({ sql, values });
    if (sql.includes('FROM system_settings')) return { rows: [{ general: DEFAULT_GENERAL_SETTINGS,
      maintenance: DEFAULT_MAINTENANCE_SETTINGS, notifications: DEFAULT_NOTIFICATION_SETTINGS,
      publishing_media: DEFAULT_PUBLISHING_MEDIA_SETTINGS, version: 1, updated_at: new Date() }] };
    if (sql.includes('FROM editorial_board_members bm')) return { rows: (values[0] as string[])
      .filter(id => id === authorId || id === photoId)
      .map(id => ({ staff_id: id, full_name: id === authorId ? 'Staff Writer' : 'Staff Photographer' })) };
    if (sql.trim().startsWith('SELECT') && sql.includes('FROM article_credits')) return { rows: creditRows.filter(credit => credit.article_id === values[0]) };
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.startsWith('WITH to_unfeature')) {
      if (failFeaturedUpdate) throw new Error('Synthetic featured limit failure');
      return { rows: [] };
    }
    if (sql.includes('FROM articles')) {
      if (sql.includes('FOR UPDATE')) beforeArticleLock?.();
      return { rows: [row] };
    }
    if (/^(INSERT INTO articles|UPDATE articles)/.test(sql.trim())) {
      const keys = ['title', 'slug', 'excerpt', 'content', 'image', 'author', 'photo_by',
        'graphic_by', 'illustration_by', 'category', 'tags', 'status', 'featured'];
      keys.forEach((key, index) => { row[key] = values[index] ?? row[key]; });
      if (row.status === 'Published' && sql.includes('published_at')) {
        row.published_at ??= new Date();
      }
      return { rows: [row] };
    }
    if (sql.includes('DELETE FROM article_credits')) {
      creditRows = creditRows.filter(credit => credit.article_id !== values[0] || !values[1].includes(credit.credit_type));
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO article_credits')) {
      if (failCreditInsert) throw new Error('Synthetic credit insert failure');
      for (let i = 0; i < values.length; i += 4) creditRows.push({ id: 'credit-' + i, article_id: values[i],
        staff_id: values[i + 1], credit_type: values[i + 2], credited_name: values[i + 3], created_at: new Date() });
      return { rows: [] };
    }
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    throw new Error('Unexpected SQL in isolated credit tests');
  };
  mock.method(db, 'query', async (sql: string, values: any[]) => {
    assert.equal(connected, false, 'Article write must not acquire a second connection');
    return query(sql, values);
  });
  mock.method(db, 'connect', async () => {
    assert.equal(connected, false);
    connected = true;
    return { query, release() { connected = false; } };
  });
});
afterEach(() => mock.restoreAll());
after(async () => { await db.end(); });

test('external-only credits persist names with commas and are returned to public and admin readers', async () => {
  const names = ['Rivera, Alex', 'Campus News Agency, Inc.'];
  const created = await service.createArticle(createArticleSchema.parse({ ...payload, externalPhotoCredits: names }));
  assert.equal(created.photoby, names.join(', '));
  const reloaded = await repository.findByIdWithCredits(articleId);
  assert.deepEqual(reloaded!.credits.filter(c => c.creditType === 'photo').map(c => [c.staffId, c.creditedName]),
    names.map(name => [null, name]));
  const admin = await service.getAdminArticleDetail(articleId);
  assert.equal(admin.credits.filter(c => c.creditType === 'photo').length, 2);
  assert.ok(statements.some(s => s.sql.includes('INSERT INTO article_credits') && s.values.includes(null)));
});

test('mixed credits trim and deduplicate names without trusting display-name input', async () => {
  const result = await service.createArticle(createArticleSchema.parse({ ...payload, photoByIds: [photoId],
    photoby: 'Untrusted display name', externalPhotoCredits: [' Agency ', 'agency', 'Staff Photographer', 'Other Person'] }));
  assert.equal(result.photoby, 'Staff Photographer, Agency, Other Person');
  assert.deepEqual(result.credits.filter(c => c.creditType === 'photo').map(c => c.staffId), [photoId, null, null]);
});

test('editing preserves external credits when omitted, and an explicit empty array clears them', async () => {
  await service.createArticle({ ...payload, photoByIds: [photoId], externalPhotoCredits: ['Agency, Inc.'] });
  const updated = await service.updateArticle(articleId, { ...payload, photoByIds: [photoId] });
  assert.equal(updated.article.photoby, 'Staff Photographer, Agency, Inc.');
  const cleared = await service.updateArticle(articleId, { ...payload, photoByIds: [], externalPhotoCredits: [] });
  assert.equal(cleared.article.photoby, '');
  assert.equal(creditRows.filter(c => c.credit_type === 'photo').length, 0);
});

test('legacy text is preserved as one credit even with commas and more than 255 characters', async () => {
  const legacy = 'Archive, Organization ' + 'x'.repeat(300);
  row.photo_by = legacy;
  const result = await service.updateArticle(articleId, payload);
  assert.equal(result.article.photoby, legacy);
  assert.deepEqual(creditRows.filter(c => c.credit_type === 'photo').map(c => c.credited_name), [legacy]);
});

test('existing staff photo snapshots survive a board change while new inactive references are rejected', async () => {
  creditRows = [{ id: 'historical', article_id: articleId, staff_id: inactiveId, credit_type: 'photo',
    credited_name: 'Former Photographer', created_at: new Date() }];
  const updated = await service.updateArticle(articleId, { ...payload, photoByIds: [inactiveId], externalPhotoCredits: [] });
  assert.equal(updated.article.photoby, 'Former Photographer');
  await assert.rejects(service.createArticle({ ...payload, photoByIds: [inactiveId] }), { statusCode: 400 });
  await assert.rejects(service.createArticle({ ...payload, authorIds: [], externalPhotoCredits: ['Outside Writer'] }), { statusCode: 400 });
});

test('photo names are bounded and malformed input is rejected in create and update contracts', () => {
  for (const externalPhotoCredits of [[' '], [null], 'Agency', [{ staffId: authorId }], ['x'.repeat(2001)], Array(21).fill('Agency')]) {
    assert.equal(createArticleSchema.safeParse({ ...payload, externalPhotoCredits }).success, false);
    assert.equal(updateArticleSchema.safeParse({ externalPhotoCredits }).success, false);
  }
});

test('combined staff and external display length is bounded before any write', async () => {
  await assert.rejects(service.createArticle({ ...payload, photoByIds: [photoId], externalPhotoCredits: ['x'.repeat(2000)] }),
    { statusCode: 400 });
  assert.equal(statements.some(s => s.sql.includes('INSERT INTO articles')), false);
});

test('unrelated edits preserve historical and external photos when both photo fields are omitted', async () => {
  row.photo_by = 'Former Photographer, Outside Organization';
  creditRows = [
    { id: 'historical', article_id: articleId, staff_id: inactiveId, credit_type: 'photo', credited_name: 'Former Photographer' },
    { id: 'outside', article_id: articleId, staff_id: null, credit_type: 'photo', credited_name: 'Outside Organization' },
  ];
  const { photoByIds, ...unrelatedEdit } = payload;
  const updated = await service.updateArticle(articleId, unrelatedEdit);
  assert.equal(updated.article.photoby, 'Former Photographer, Outside Organization');
  assert.deepEqual(updated.article.credits.filter(credit => credit.creditType === 'photo').map(credit => credit.id),
    ['historical', 'outside']);
});

test('a photo credited on another article does not bypass active-board validation', async () => {
  creditRows = [{ id: 'foreign', article_id: 'other-article', staff_id: inactiveId,
    credit_type: 'photo', credited_name: 'Other Article Photographer' }];
  await assert.rejects(service.updateArticle(articleId, { ...payload, photoByIds: [inactiveId] }), { statusCode: 400 });
  assert.equal(statements.some(s => s.sql.trim().startsWith('UPDATE')), false);
});

test('a failed credit insertion rolls back the article and credit replacement transaction', async () => {
  failCreditInsert = true;
  mock.method(console, 'error', () => {});
  await assert.rejects(service.updateArticle(articleId, { ...payload, externalPhotoCredits: ['Agency'] }), /Synthetic credit insert failure/);
  assert.ok(statements.some(s => s.sql.includes('DELETE FROM article_credits')));
  assert.equal(statements.at(-1)!.sql, 'ROLLBACK');
  assert.equal(statements.some(s => s.sql === 'COMMIT'), false);
});

test('partial edits preserve legacy author, fields and historical structured credits', async () => {
  row.author = 'Former Writer';
  row.graphic_by = 'Former Artist';
  row.tags = ['campus'];
  row.featured = true;
  creditRows = [{ id: 'historical', article_id: articleId, staff_id: inactiveId, credit_type: 'graphic', credited_name: 'Former Artist' }];

  const { article } = await service.updateArticle(articleId, { title: 'Revised title' });
  assert.equal(article.title, 'Revised title');
  assert.equal(article.author, 'Former Writer');
  assert.equal(article.graphicby, 'Former Artist');
  assert.equal(article.featured, true);
  assert.deepEqual(article.tags, ['campus']);
  assert.equal(article.credits[0]?.id, 'historical');
  assert.equal(statements.some(s => s.sql.includes('DELETE FROM article_credits')), false);
});

test('an editor revision rejects conflicting edits and ignores view count changes', async () => {
  const original = await service.getEditorArticleBySlug(payload.slug);
  assert.ok(original);
  row.views = 44;
  const { article } = await service.updateArticle(articleId, { title: 'Saved title', expectedRevision: original.revision });
  assert.notEqual(article.revision, original.revision);
  await assert.rejects(service.updateArticle(articleId, { title: 'Out of date', expectedRevision: original.revision }), { statusCode: 409 });
  assert.equal(row.title, 'Saved title');
});

test('changing author credits leaves omitted photo groups untouched', async () => {
  row.photo_by = 'Legacy Organization';
  creditRows = [{ id: 'existing-photo', article_id: articleId, staff_id: inactiveId, credit_type: 'photo', credited_name: 'Former Photographer' }];
  const { article } = await service.updateArticle(articleId, { authorIds: [authorId] });
  assert.equal(article.author, 'Staff Writer');
  assert.equal(article.photoby, 'Legacy Organization');
  assert.equal(article.credits.find(credit => credit.creditType === 'photo')?.id, 'existing-photo');
  const deleteStatement = statements.find(statement => statement.sql.includes('DELETE FROM article_credits'));
  assert.deepEqual(deleteStatement?.values[1], ['author']);
});

test('a write racing the locked snapshot is rejected even without a client revision', async () => {
  beforeArticleLock = () => { row.title = 'Concurrent title'; };
  mock.method(console, 'error', () => {});
  await assert.rejects(service.updateArticle(articleId, { title: 'Earlier title' }), { statusCode: 409 });
  assert.equal(row.title, 'Concurrent title');
  assert.equal(statements.at(-1)?.sql, 'ROLLBACK');
  assert.equal(statements.some(statement => statement.sql.startsWith('UPDATE articles')), false);
});

test('publish routes share timestamp handling and retain the first published date', async () => {
  row.image = 'https://example.com/cover.png';
  const { article } = await service.updateArticle(articleId, { status: 'Published' });
  assert.ok(article.publishedAt);
  assert.equal((await service.publishArticle(articleId)).publishedAt, article.publishedAt);
  await service.archiveArticle(articleId);
  assert.equal((await service.publishArticle(articleId)).publishedAt, article.publishedAt);
});

test('featured maintenance uses the write transaction and failure precedes commit', async () => {
  failFeaturedUpdate = true;
  mock.method(console, 'error', () => {});
  await assert.rejects(service.createArticle({ ...payload, status: 'Published',
    image: 'https://example.com/cover.png', featured: true }), /Synthetic featured limit failure/);
  const transaction = statements.map(s => s.sql);
  assert.ok(transaction.some(sql => sql.includes('pg_advisory_xact_lock')));
  assert.ok(transaction.some(sql => sql.startsWith('WITH to_unfeature')));
  assert.equal(transaction.at(-1), 'ROLLBACK');
  assert.equal(transaction.includes('COMMIT'), false);
});
