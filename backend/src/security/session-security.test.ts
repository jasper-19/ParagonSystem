import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";
import pool from "../config/db";
import { credentialFingerprint, signAuthToken, verifyAuthToken } from "./auth-token";
import { validateAndTouchSession } from "../modules/auth/session.repository";
import { authorizeLiveAdmin } from "./live-session";
import { updateUser } from "../modules/users/user.repository";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import * as userService from "../modules/users/user.service";

process.env.JWT_SECRET = "security-test-secret-with-at-least-32-bytes";
afterEach(() => mock.restoreAll());
after(async () => pool.end());
const userId = "11111111-1111-4111-8111-111111111111";
const sid = "22222222-2222-4222-8222-222222222222";
const token = () => signAuthToken({ subject: userId, role: "admin", sid, passwordHash: "old-hash", authVersion: "0" });

test("credential binding hides hashes and rejects tokens issued before the fix", () => {
  const identity = verifyAuthToken(token());
  assert.equal(identity.credentials, credentialFingerprint("old-hash"));
  assert.equal(JSON.stringify(identity).includes("old-hash"), false);
  assert.throws(() => verifyAuthToken(signAuthToken({ subject: userId, role: "admin", sid })));
});

test("password reset invalidates a token even when an old-password login completes later", async () => {
  const oldLoginToken = token();
  mock.method(pool, "query", async () => ({ rows: [{ password_hash: "new-hash", auth_version: "0" }] }));
  assert.equal(await authorizeLiveAdmin(oldLoginToken), false);
});

test("disabled, demoted, reassigned and revoked identities fail closed", async () => {
  const query = mock.method(pool, "query", async (sql: string, params: unknown[]) => {
    assert.match(sql, /u\.is_active = TRUE/);
    assert.match(sql, /u\.role = \$3/);
    assert.match(sql, /u\.staff_id IS NOT DISTINCT FROM \$4::uuid/);
    assert.match(sql, /s\.revoked_at IS NULL/);
    assert.deepEqual(params, [userId, sid, "admin", null]);
    return { rows: [] };
  });
  assert.equal(await authorizeLiveAdmin(token()), false);
  assert.equal(query.mock.callCount(), 1);
});

test("passive live authorization checks identity without refreshing inactivity", async () => {
  const query = mock.method(pool, "query", async () => ({ rows: [{ password_hash: "old-hash", auth_version: "0" }] }));
  assert.equal(await authorizeLiveAdmin(token()), true);
  assert.equal(query.mock.callCount(), 1);
});

test("HTTP activity only touches a still-authorized session", async () => {
  let queries = 0;
  mock.method(pool, "query", async (sql: string, params: unknown[]) => {
    if (++queries === 1) return { rows: [{ password_hash: "old-hash", auth_version: "0" }] };
    assert.match(sql, /AND u\.password_hash = \$5/);
    assert.match(sql, /AND u\.auth_version = \$6::bigint/);
    assert.deepEqual(params, [sid, userId, "admin", null, "old-hash", "0"]);
    return { rows: [] }; // revoked between checking and touching
  });
  assert.equal(await validateAndTouchSession(userId, sid, verifyAuthToken(token())), false);
});

test("live delivery fails closed on expiry, non-admin tokens and database errors", async () => {
  mock.method(pool, "query", async () => { throw new Error("Unavailable"); });
  assert.equal(await authorizeLiveAdmin(token()), false);
  assert.equal(await authorizeLiveAdmin("invalid"), false);
  const expired = jwt.sign({ role: 'admin', sid, credentials: credentialFingerprint('old-hash') },
    process.env.JWT_SECRET!, { subject: userId, issuer: 'paragon-api',
      audience: 'paragon-admin', algorithm: 'HS256', expiresIn: -1 });
  assert.equal(await authorizeLiveAdmin(expired), false);
  assert.equal(await authorizeLiveAdmin(signAuthToken({ subject: userId, role: "staff", sid, passwordHash: "old-hash" })), false);
});

test("account security updates atomically revoke sessions", async () => {
  mock.method(pool, "query", async (sql: string, params: unknown[]) => {
    assert.match(sql, /WITH updated AS \(UPDATE users/);
    assert.match(sql, /UPDATE user_sessions SET revoked_at = NOW\(\)/);
    assert.match(sql, /user_id IN \(SELECT id FROM updated\)/);
    assert.match(sql, /AND revoked_at IS NULL AND TRUE/);
    assert.deepEqual(params, [false, userId]);
    return { rows: [] };
  });
  assert.equal(await updateUser(userId, { isActive: false }), undefined);
});

test("restoring the same credentials and permissions cannot revive a stale login", async () => {
  let version = "0";
  mock.method(pool, "query", async () => ({ rows: [{ password_hash: "old-hash", auth_version: version }] }));
  const lateLogin = token();
  assert.equal(await authorizeLiveAdmin(lateLogin), true);
  version = "2"; // disable then enable; old role, staff and password restored
  assert.equal(await authorizeLiveAdmin(lateLogin), false);
  const fresh = signAuthToken({ subject: userId, sid, role: "admin", passwordHash: "old-hash", authVersion: version });
  assert.equal(await authorizeLiveAdmin(fresh), true);
});

test("login keeps the security snapshot from before asynchronous password verification", async () => {
  let version = "9007199254740993";
  mock.method(pool, "query", async (sql: string) => ({ rows: sql.startsWith('SELECT') ? [{
    id: userId, username: 'fixture', password_hash: 'old-hash', auth_version: version,
    role: 'admin', is_active: true,
  }] : [] }));
  mock.method(bcrypt, "compare", async () => { version = "9007199254740995"; return true; });
  const user = await userService.authenticate('fixture', 'fixture-password');
  assert.equal(user?.authVersion, "9007199254740993");
  assert.equal('authVersion' in userService.toPublicUser(user!), false);
  const stale = signAuthToken({ subject: user!.id, role: user!.role, sid,
    passwordHash: user!.passwordHash, authVersion: user!.authVersion });
  assert.equal(await authorizeLiveAdmin(stale), false);
});

test("database user JWTs require a canonical bigint version without numeric rounding", () => {
  for (const version of [undefined, null, 0, -1, '', '-1', '00', '01', '1.0', '1e2',
    ' 1', '1 ', '9223372036854775808', '123456789012345678901234567890']) {
    const value = jwt.sign({ role: 'admin', sid, credentials: credentialFingerprint('old-hash'),
      authVersion: version }, process.env.JWT_SECRET!, { subject: userId,
      issuer: 'paragon-api', audience: 'paragon-admin', algorithm: 'HS256' });
    assert.throws(() => verifyAuthToken(value));
  }
  for (const authVersion of ['0', '1', '9007199254740993', '9223372036854775807']) {
    assert.equal(verifyAuthToken(signAuthToken({ subject: userId, role: 'admin', sid,
      passwordHash: 'old-hash', authVersion })).authVersion, authVersion);
  }
});
