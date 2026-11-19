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
let statements: Array<{ sql: string; values: any[] }>;

beforeEach(() => {
  row = { id: articleId, title: payload.title, slug: payload.slug, status: 'Draft', photo_by: '', created_at: new Date() };
  creditRows = []; statements = []; failCreditInsert = false;
  const query = async (sql: string, values: any[] = []) => {
    statements.push({ sql, values });
    if (sql.includes('FROM system_settings')) return { rows: [{ general: DEFAULT_GENERAL_SETTINGS,
      maintenance: DEFAULT_MAINTENANCE_SETTINGS, notifications: DEFAULT_NOTIFICATION_SETTINGS,
      publishing_media: DEFAULT_PUBLISHING_MEDIA_SETTINGS, version: 1, updated_at: new Date() }] };
    if (sql.includes('FROM editorial_board_members bm')) return { rows: (values[0] as string[])
      .filter(id => id === authorId || id === photoId)
      .map(id => ({ staff_id: id, full_name: id === authorId ? 'Staff Writer' : 'Staff Photographer' })) };
    if (sql.trim().startsWith('SELECT') && sql.includes('FROM article_credits')) return { rows: creditRows.filter(credit => credit.article_id === values[0]) };
    if (sql.includes('FROM articles')) return { rows: [row] };
    if (/^(INSERT INTO articles|UPDATE articles)/.test(sql.trim())) {
      row = { ...row, title: values[0], slug: values[1], excerpt: values[2], content: values[3], image: values[4],
        author: values[5], photo_by: values[6], graphic_by: values[7], illustration_by: values[8],
        category: values[9], tags: values[10], status: values[11], featured: values[12] };
      return { rows: [row] };
    }
    if (sql.includes('DELETE FROM article_credits')) { creditRows = []; return { rows: [] }; }
    if (sql.includes('INSERT INTO article_credits')) {
      if (failCreditInsert) throw new Error('Synthetic credit insert failure');
      for (let i = 0; i < values.length; i += 4) creditRows.push({ id: 'credit-' + i, article_id: values[i],
        staff_id: values[i + 1], credit_type: values[i + 2], credited_name: values[i + 3], created_at: new Date() });
      return { rows: [] };
    }
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    throw new Error('Unexpected SQL in isolated credit tests');
  };
  mock.method(db, 'query', query);
  mock.method(db, 'connect', async () => ({ query, release() {} }));
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
  creditRows = [
    { id: 'historical', article_id: articleId, staff_id: inactiveId, credit_type: 'photo', credited_name: 'Former Photographer' },
    { id: 'outside', article_id: articleId, staff_id: null, credit_type: 'photo', credited_name: 'Outside Organization' },
  ];
  const { photoByIds, ...unrelatedEdit } = payload;
  const updated = await service.updateArticle(articleId, unrelatedEdit);
  assert.equal(updated.article.photoby, 'Former Photographer, Outside Organization');
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
