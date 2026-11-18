import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { AddressInfo } from "node:net";
import express from "express";
import pool from "../config/db";
import { authenticate } from "../middlewares/authenticate";
import { requireAdmin } from "../middlewares/requireAdmin";
import { csrfProtection } from "../middlewares/csrf";
import { signAuthToken } from "./auth-token";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "http-security-test-secret-at-least-32-bytes";
after(async () => { mock.restoreAll(); await pool.end(); });

test("HTTP rejects stale credentials, disabled identities and hostile cookie mutations", async () => {
  let hash = "original-hash";
  let version = "0";
  let active = true;
  mock.method(pool, "query", async (sql: string) => ({
    rows: !active ? [] : sql.startsWith("SELECT") ? [{ password_hash: hash, auth_version: version }] : [{ id: "session" }],
  }));
  const app = express();
  app.use(csrfProtection);
  app.post('/private', authenticate, requireAdmin, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/private`;
  const mint = () => signAuthToken({ subject: '11111111-1111-4111-8111-111111111111',
    sid: '22222222-2222-4222-8222-222222222222', role: 'admin', passwordHash: hash, authVersion: version });
  const oldToken = mint();
  const post = (token: string, origin = 'http://localhost:4200', csrf = true) => fetch(url, {
    method: 'POST', headers: { Cookie: `paragon_session=${token}`, Origin: origin,
      ...(csrf ? { 'X-CSRF-Protection': '1' } : {}) },
  });
  try {
    assert.equal((await post(oldToken)).status, 200);
    assert.equal((await post(oldToken, 'https://hostile.example')).status, 403);
    assert.equal((await post(oldToken, 'http://localhost:4200.attacker.example')).status, 403);
    assert.equal((await post(oldToken, 'http://localhost:4200', false)).status, 403);
    hash = 'reset-hash';
    assert.equal((await post(oldToken)).status, 401);
    const newToken = mint();
    assert.equal((await post(newToken)).status, 200);
    version = '2'; // account was disabled and re-enabled, credentials unchanged
    assert.equal((await post(newToken)).status, 401);
    assert.equal((await post(mint())).status, 200);
    active = false;
    assert.equal((await post(newToken)).status, 401);
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
