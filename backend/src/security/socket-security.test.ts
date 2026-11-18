import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import test from "node:test";
import WebSocket from "ws";
import { initializeSocket } from "../realtime/socket";
import { emitPrivateAdminEvent } from "../realtime/socket";
import { signAuthToken } from "./auth-token";
import pool from "../config/db";
import { after, mock } from "node:test";

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'socket-security-test-secret-at-least-32-bytes';
after(async () => { mock.restoreAll(); await pool.end(); });

test("WebSocket upgrades reject untrusted origins and originless cookies", async () => {
  const server = createServer();
  const io = initializeSocket(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    for (const headers of [{ Origin: 'https://untrusted.example' }, { Cookie: 'paragon_session=anything' }]) {
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`, { headers, handshakeTimeout: 2000 });
        socket.once('open', () => { socket.terminate(); reject(new Error('Untrusted upgrade accepted')); });
        socket.once('unexpected-response', (_req, response) => {
          response.resume(); socket.terminate();
          try { assert.ok([400, 403].includes(response.statusCode!)); resolve(); }
          catch (error) { reject(error); }
        });
        socket.on('error', () => {});
      });
    }
  } finally { await new Promise<void>(resolve => io.close(() => resolve())); }
});

test("an active admin socket loses private delivery after credentials change", async () => {
  let hash = 'original-hash';
  let version = '0';
  mock.method(pool, 'query', async () => ({ rows: [{ password_hash: hash, auth_version: version }] }));
  const server = createServer();
  const io = initializeSocket(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const token = signAuthToken({ subject: '11111111-1111-4111-8111-111111111111',
    sid: '22222222-2222-4222-8222-222222222222', role: 'admin', passwordHash: hash, authVersion: version });
  const socket = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`, {
    headers: { Origin: 'http://localhost:4200', Cookie: `paragon_session=${token}` },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Handshake timeout')), 3000);
      socket.on('message', data => {
        const frame = data.toString();
        if (frame.startsWith('0')) socket.send('40');
        if (frame.startsWith('40')) { clearTimeout(timeout); resolve(); }
      });
      socket.on('error', reject);
    });
    const admin = [...io.sockets.sockets.values()][0]!;
    assert.equal(admin.data['isAdmin'], true);
    const sent: unknown[][] = [];
    mock.method(admin, 'emit', (...args: unknown[]) => { sent.push(args); return true; });
    await emitPrivateAdminEvent('private:test', { secret: 'test-fixture' });
    assert.equal(sent.length, 1);
    version = '2'; // permissions restored, but the authenticated epoch is stale
    await emitPrivateAdminEvent('private:test', { secret: 'must-not-deliver' });
    assert.equal(sent.length, 1);
    assert.equal(admin.connected, false);
  } finally {
    socket.terminate();
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
