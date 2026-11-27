import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import express from 'express';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import pool from '../../config/db';
import authRouter from './auth.routes';
import { authenticate } from '../../middlewares/authenticate';
import { csrfProtection } from '../../middlewares/csrf';
import { getUserById, updateUser } from '../users/user.service';
import { challengeUser } from './login-flow.service';
import * as challenges from './login-challenge.repository';
import { codeHash } from './email-code.service';
import { assertGoogleEmailSchema } from '../../security/google-email-schema';
import { linkGoogleIdentity } from './google-identity.repository';
import { signDelivery } from './mail-relay.service';

after(async () => { mock.restoreAll(); await pool.end(); });

test('local PostgreSQL: Google linking, email verification, replay, limits, and revocation',
  { skip: process.env.AUTH_LOCAL_DB_TESTS !== '1' }, async t => {
    // This suite never touches application tables or remote databases. All DDL
    // and fixture rows live in random schemas inside a rolled-back transaction.
    assert.notEqual(process.env.NODE_ENV, 'production');
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || '127.0.0.1'));
    const client = await pool.connect();
    const schema = `auth_test_${randomBytes(8).toString('hex')}`;
    const internal = `${schema}_internal`;
    const rewrite = (sql: string) => sql.split('paragon_internal').join(internal).split('public.').join(`${schema}.`).replace("n.nspname = 'public'", `n.nspname = '${schema}'`);
    const userId = '11111111-1111-4111-8111-111111111111';
    const staffId = '22222222-2222-4222-8222-222222222222';
    const password = 'Fixture password 29!';
    process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'fixture-jwt-secret-at-least-32-bytes';
    process.env.AUTH_CHALLENGE_SECRET = 'fixture-challenge-secret-at-least-32-bytes';
    process.env.AUTH_COOKIE_SAME_SITE = 'lax';
    process.env.GOOGLE_CLIENT_ID = 'fixture-client'; process.env.GOOGLE_CLIENT_SECRET = 'fixture-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';
    process.env.FRONTEND_URL = 'http://localhost:4200';
    process.env.AUTH_SMTP_HOST = 'smtp.fixture.invalid'; process.env.AUTH_SMTP_PORT = '465';
    process.env.AUTH_SMTP_USER = 'fixture'; process.env.AUTH_SMTP_PASSWORD = 'fixture'; process.env.AUTH_EMAIL_FROM = 'fixture@example.com';
    delete process.env.AUTH_MAIL_RELAY_URL; // Always use the mocked transport.
    let sentCode = ''; let failMail = false;
    mock.method(nodemailer, 'createTransport', () => ({
      sendMail: async (mail: { html: string; text: string; subject: string }) => {
        if (failMail) throw new Error('Synthetic SMTP failure');
        sentCode = mail.text.match(/\b\d{6}\b/)![0];
        assert.equal(mail.subject, 'Your PARAGON sign-in code');
        assert.ok(mail.html.includes('Verify your sign-in.'));
        assert.ok(mail.html.includes(`>${sentCode}</p>`));
        assert.match(mail.text, /This code expires on .+ Philippine time\./);
      }, close: () => {},
    }));
    mock.method(OAuth2Client.prototype, 'getToken', async () => ({ tokens: { id_token: 'fixture-token' } }));
    mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => ({
      sub: 'fixture-google-sub', email: 'fixture@gmail.com', email_verified: true, nonce: googleNonce,
    }) }));
    let googleNonce = '';
    await client.query('BEGIN');
    let server: ReturnType<typeof express.application.listen> | undefined;
    try {
      await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}, pg_catalog;
        CREATE TABLE staff_members (id uuid PRIMARY KEY, email text, full_name text, application_id uuid,
          student_id text, year_level text, college_id uuid, program_id uuid, position_id uuid,
          sub_role text, assigned_section text, assigned_role text, created_at timestamptz DEFAULT NOW());
        CREATE TABLE users (id uuid PRIMARY KEY, username text UNIQUE, password_hash text, role text,
          staff_id uuid REFERENCES staff_members(id), is_active boolean DEFAULT TRUE,
          two_fa_enabled boolean DEFAULT FALSE, last_login_at timestamptz,
          created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW());
        CREATE TABLE user_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id),
          user_agent text, ip_address text, browser_name text, browser_version text, os_name text, os_version text,
          device_type text, revoked_at timestamptz, last_active_at timestamptz DEFAULT NOW(), created_at timestamptz DEFAULT NOW());
        CREATE TABLE activity_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, action text,
          resource_type text, resource_id uuid, details jsonb, ip_address inet, user_agent text, created_at timestamptz DEFAULT NOW());
        CREATE TABLE system_settings (id smallint PRIMARY KEY, general jsonb, publishing_media jsonb,
          notifications jsonb, maintenance jsonb, version bigint, updated_at timestamptz, updated_by uuid);
        CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message text NOT NULL,
          type varchar(50) NOT NULL, is_read boolean NOT NULL DEFAULT FALSE, created_at timestamptz DEFAULT NOW());`);
      await client.query(rewrite(await readFile('src/config/migrate.security.sql', 'utf8')));
      await client.query('INSERT INTO staff_members (id,email,full_name) VALUES ($1,$2,$3)', [staffId, 'fixture@gmail.com', 'Fixture']);
      await client.query('INSERT INTO users (id,username,password_hash,role,staff_id) VALUES ($1,$2,$3,$4,$5)',
        [userId, 'fixture', await bcrypt.hash(password, 12), 'admin', staffId]);
      // This rollback fixture uses one connection; serialize its queries. Live
      // pool requests can run on separate connections, with limits locked by SQL.
      let queued: Promise<unknown> = Promise.resolve();
      mock.method(pool, 'query', (sql: string, params?: unknown[]) => {
        const result = queued.then(() => client.query(rewrite(sql), params));
        queued = result.then(() => undefined, () => undefined);
        return result;
      });
      // Repository transactions must stay in the isolated, rolled-back fixture.
      mock.method(pool, 'connect', async () => ({
        query: (sql: string, params?: unknown[]) => pool.query(
          sql === 'BEGIN' ? 'SAVEPOINT account_update' :
          sql === 'COMMIT' ? 'RELEASE SAVEPOINT account_update' :
          sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT account_update' : sql, params),
        release: () => {},
      }));
      await assertGoogleEmailSchema(pool);
      const app = express(); app.use(express.json(), csrfProtection); app.use('/api/auth', authRouter);
      app.get('/private', authenticate, (_req, res) => res.json({ ok: true }));
      app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(err.statusCode || 500).json({ error: err.message });
      });
      server = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => server!.once('listening', resolve));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const request = (path: string, body?: unknown, cookie = '', origin = 'http://localhost:4200') => fetch(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
        headers: { Origin: origin, 'X-CSRF-Protection': '1', 'Content-Type': 'application/json', Cookie: cookie },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const cookieOf = (response: globalThis.Response, name: string) => response.headers.getSetCookie()
        .filter(value => value.startsWith(`${name}=`)).at(-1)?.split(';')[0] || '';
      let linkedSession = ''; let pendingCookie = ''; let verifiedSession = '';

      await t.test('mail relay claims are authenticated and durably single-use', async () => {
        process.env.AUTH_MAIL_RELAY_SECRET = 'fixture-relay-secret-at-least-32-bytes';
        const body = signDelivery('fixture@gmail.com', '000001');
        const claim = (envelope: unknown) => fetch(`${base}/api/auth/mail-relay/claim`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope),
        });
        assert.equal((await claim({ ...body, signature: '0'.repeat(64) })).status, 403);
        const results = await Promise.all([claim(body), claim(body)]);
        assert.deepEqual(results.map(r => r.status).sort(), [204, 409]);
        assert.equal((await request('/api/auth/mail-relay/claim', signDelivery('fixture@gmail.com', '000001'))).status, 403);
      });

      await t.test('password sign-in remains available before 2FA enrollment', async () => {
        const response = await request('/api/auth/login', { username: 'fixture', password });
        assert.deepEqual(await response.json(), { ok: true });
        assert.equal((await request('/private', undefined, cookieOf(response, 'paragon_session'))).status, 200);
      });

      await t.test('OAuth is browser-bound and first-time linking verifies the existing password', async () => {
        assert.equal((await request('/api/auth/google/start', {}, '', 'https://attacker.example')).status, 403);
        const started = await request('/api/auth/google/start', {});
        const authorization = new URL((await started.json() as { authorizationUrl: string }).authorizationUrl);
        googleNonce = authorization.searchParams.get('nonce')!;
        const oauthCookie = cookieOf(started, 'paragon_login');
        const callbackPath = `/api/auth/google/callback?code=fixture-code&state=${authorization.searchParams.get('state')}`;
        assert.match((await request(callbackPath)).headers.get('location')!, /google=error$/);
        const callback = await request(callbackPath, undefined, oauthCookie);
        assert.match(callback.headers.get('location')!, /google=link$/);
        const linkCookie = cookieOf(callback, 'paragon_login');
        assert.equal((await request('/api/auth/google/link', { username: 'fixture', password: 'wrong' }, linkCookie)).status, 401);
        const linked = await request('/api/auth/google/link', { username: 'fixture', password }, linkCookie);
        assert.deepEqual(await linked.json(), { ok: true });
        linkedSession = cookieOf(linked, 'paragon_session');
        assert.equal((await request('/private', undefined, linkedSession)).status, 200);
        assert.match((await request(callbackPath, undefined, oauthCookie)).headers.get('location')!, /google=error$/);
        const user = (await getUserById(userId))!;
        assert.equal(await linkGoogleIdentity({ userId, subject: 'different-google-sub', email: 'fixture@gmail.com',
          passwordHash: user.passwordHash, authVersion: user.authVersion }), false);
      });

      await t.test('enabling 2FA revokes the existing session and requires an emailed code', async () => {
        const result = await fetch(`${base}/api/auth/2fa`, { method: 'PATCH', headers: {
          Origin: 'http://localhost:4200', 'X-CSRF-Protection': '1', 'Content-Type': 'application/json', Cookie: linkedSession,
        }, body: JSON.stringify({ enabled: true }) });
        assert.equal(result.status, 200); assert.equal((await request('/private', undefined, linkedSession)).status, 401);
        const login = await request('/api/auth/login', { username: 'fixture', password });
        assert.equal((await login.json() as { twoFactorRequired: boolean }).twoFactorRequired, true);
        assert.equal(cookieOf(login, 'paragon_session'), 'paragon_session=');
        pendingCookie = cookieOf(login, 'paragon_login'); assert.match(sentCode, /^\d{6}$/);
        assert.equal((await request('/private', undefined, pendingCookie)).status, 401);
        assert.equal((await request('/api/auth/2fa/resend', {}, pendingCookie)).status, 429);
        assert.equal((await request('/api/auth/2fa/verify', { code: sentCode }, pendingCookie, 'https://attacker.example')).status, 403);
        const verified = await request('/api/auth/2fa/verify', { code: sentCode }, pendingCookie);
        assert.equal(verified.status, 200); verifiedSession = cookieOf(verified, 'paragon_session');
        assert.equal((await request('/private', undefined, verifiedSession)).status, 200);
        assert.equal((await request('/api/auth/2fa/verify', { code: sentCode }, pendingCookie)).status, 401);
      });

      await t.test('disabling 2FA also revokes sessions and restores password-only sign-in', async () => {
        const preference = (cookie: string, enabled: boolean) => fetch(`${base}/api/auth/2fa`, {
          method: 'PATCH', headers: { Origin: 'http://localhost:4200', 'X-CSRF-Protection': '1', 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ enabled }),
        });
        assert.equal((await preference(verifiedSession, false)).status, 200);
        assert.equal((await request('/private', undefined, verifiedSession)).status, 401);
        const response = await request('/api/auth/login', { username: 'fixture', password });
        assert.deepEqual(await response.json(), { ok: true });
        const passwordSession = cookieOf(response, 'paragon_session');
        assert.equal((await request('/private', undefined, passwordSession)).status, 200);
        assert.equal((await preference(passwordSession, true)).status, 200);
        assert.equal((await request('/private', undefined, passwordSession)).status, 401);
      });

      await t.test('Google sign-in obeys the same email challenge policy', async () => {
        await client.query(`UPDATE ${internal}.auth_email_limits SET sent_at = NOW() - INTERVAL '2 minutes'`);
        const started = await request('/api/auth/google/start', {});
        const authorization = new URL((await started.json() as { authorizationUrl: string }).authorizationUrl);
        googleNonce = authorization.searchParams.get('nonce')!;
        const callback = await request(`/api/auth/google/callback?code=fixture-code&state=${authorization.searchParams.get('state')}`,
          undefined, cookieOf(started, 'paragon_login'));
        assert.match(callback.headers.get('location')!, /google=verify$/);
        assert.equal(cookieOf(callback, 'paragon_session'), 'paragon_session=');
        const cookie = cookieOf(callback, 'paragon_login');
        assert.equal((await request('/api/auth/login/challenge', undefined, cookie)).status, 200);
        const verified = await request('/api/auth/2fa/verify', { code: sentCode }, cookie);
        assert.equal(verified.status, 200);
        verifiedSession = cookieOf(verified, 'paragon_session');
        assert.equal((await request('/private', undefined, verifiedSession)).status, 200);
      });

      await t.test('verification has a durable attempt cap, expiry and single-use consumption', async () => {
        const pending = await challenges.createChallenge('email', {}, userId);
        await challenges.setEmailCode(pending.id, codeHash(pending.id, '000001'));
        for (let i = 0; i < 5; i++) assert.equal(await challenges.verifyCode(pending.id, codeHash(pending.id, '000002')), undefined);
        assert.equal(await challenges.verifyCode(pending.id, codeHash(pending.id, '000001')), undefined);
        const expired = await challenges.createChallenge('email', {}, userId);
        await challenges.setEmailCode(expired.id, codeHash(expired.id, '000001'));
        await client.query(`UPDATE ${internal}.login_challenges SET code_expires_at = NOW() - INTERVAL '1 second' WHERE id=$1`, [expired.id]);
        assert.equal(await challenges.verifyCode(expired.id, codeHash(expired.id, '000001')), undefined);
        const once = await challenges.createChallenge('email', {}, userId);
        await challenges.setEmailCode(once.id, codeHash(once.id, '000001'));
        const outcomes = await Promise.all([challenges.verifyCode(once.id, codeHash(once.id, '000001')), challenges.verifyCode(once.id, codeHash(once.id, '000001'))]);
        assert.equal(outcomes.filter(Boolean).length, 1);
      });

      await t.test('resending rotates the code without resetting the attempt budget', async () => {
        const pending = await challenges.createChallenge('email', {}, userId);
        await challenges.setEmailCode(pending.id, codeHash(pending.id, '000001'));
        await challenges.verifyCode(pending.id, codeHash(pending.id, '000003'));
        await challenges.setEmailCode(pending.id, codeHash(pending.id, '000002'));
        assert.equal(await challenges.verifyCode(pending.id, codeHash(pending.id, '000001')), undefined);
        assert.equal((await challenges.getChallenge(pending.id))?.attempts, 2);
        assert.ok(await challenges.verifyCode(pending.id, codeHash(pending.id, '000002')));
      });

      await t.test('fresh challenges cannot reset shared account attempt or delivery limits', async () => {
        const context = 'fixture-shared-account';
        const attempts = await Promise.all(Array.from({ length: 12 }, () => challenges.reserveAttempt(context, 10)));
        assert.equal(attempts.filter(Boolean).length, 10);
        assert.equal(await challenges.reserveAttempt(context, 10), false);
        await client.query(`UPDATE ${internal}.auth_email_limits SET sent_at = NOW() - INTERVAL '2 minutes'`);
        const deliveries = await Promise.all([challenges.reserveDelivery(userId), challenges.reserveDelivery(userId)]);
        assert.equal(deliveries.filter(Boolean).length, 1);
      });

      await t.test('email failures issue no session and do not leave a usable code', async () => {
        await client.query(`UPDATE ${internal}.auth_email_limits SET sent_at = NOW() - INTERVAL '2 minutes'`);
        failMail = true;
        const response = await request('/api/auth/login', { username: 'fixture', password });
        assert.equal(response.status, 503); assert.equal(cookieOf(response, 'paragon_session'), '');
        failMail = false;
      });

      await t.test('staff email changes unlink Google and invalidate active tokens and pending snapshots', async () => {
        const user = (await getUserById(userId))!;
        const pending = await challenges.createChallenge('email', {
          authVersion: user.authVersion, credentials: 'fixture', subject: 'fixture-google-sub', email: 'fixture@gmail.com',
        }, userId);
        const snapshot = (await challenges.getChallenge(pending.id))!;
        await client.query('UPDATE staff_members SET email=$1 WHERE id=$2', ['changed@gmail.com', staffId]);
        assert.equal((await request('/private', undefined, verifiedSession)).status, 401);
        assert.equal((await client.query(`SELECT * FROM ${internal}.google_identities`)).rowCount, 0);
        assert.equal(await challenges.getChallenge(pending.id), undefined);
        await assert.rejects(() => challengeUser(snapshot));
        assert.notEqual((await getUserById(userId))!.authVersion, user.authVersion);
      });
      await t.test('developer Google account has no staff, requires verification, and can be revoked', async () => {
        const developerId = '33333333-3333-4333-8333-333333333333';
        await client.query(`INSERT INTO users (id,username,password_hash,role,two_fa_enabled,developer_email)
          VALUES ($1,'developer-fixture',$2,'admin',TRUE,'fixture@gmail.com')`,
          [developerId, await bcrypt.hash(password, 12)]);
        assert.equal((await request('/api/auth/login', { username: 'developer-fixture', password })).status, 401);
        for (const patch of [{ twoFaEnabled: false }, { staffId }, { role: 'staff' }, { password }]) {
          await assert.rejects(() => updateUser(developerId, patch), /Developer accounts/);
        }
        const started = await request('/api/auth/google/start', {});
        const authorization = new URL((await started.json() as { authorizationUrl: string }).authorizationUrl);
        googleNonce = authorization.searchParams.get('nonce')!;
        const callback = await request(`/api/auth/google/callback?code=fixture-code&state=${authorization.searchParams.get('state')}`,
          undefined, cookieOf(started, 'paragon_login'));
        assert.match(callback.headers.get('location')!, /google=verify$/);
        const pending = cookieOf(callback, 'paragon_login');
        assert.equal((await request('/private', undefined, pending)).status, 401);
        const verified = await request('/api/auth/2fa/verify', { code: sentCode }, pending);
        assert.equal(verified.status, 200);
        const session = cookieOf(verified, 'paragon_session');
        const profile = await (await request('/api/auth/me', undefined, session)).json() as { staff: unknown; user: { role: string } };
        assert.equal(profile.staff, null); assert.equal(profile.user.role, 'admin');
        const factor = await fetch(`${base}/api/auth/2fa`, { method: 'PATCH', headers: {
          Origin: 'http://localhost:4200', 'X-CSRF-Protection': '1', 'Content-Type': 'application/json', Cookie: session,
        }, body: JSON.stringify({ enabled: false }) });
        assert.equal(factor.status, 403);
        await client.query('UPDATE users SET is_active=FALSE WHERE id=$1', [developerId]);
        assert.equal((await request('/private', undefined, session)).status, 401);
      });
    } finally {
      if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
      mock.restoreAll();
      await client.query('ROLLBACK'); client.release();
    }
  });
