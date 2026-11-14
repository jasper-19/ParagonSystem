import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import WebSocket from 'ws';
import { initializeSocket } from './socket';
import { completeSpecialIssueMutation } from './socket.events';

test('a committed issue save succeeds even before the optional socket transport starts', async () => {
  const saved = { id: 'sample', status: 'published' };
  assert.equal(await completeSpecialIssueMutation(async () => saved), saved);
});

test('anonymous readers receive content-free notifications only after successful saves', async () => {
  const server = createServer();
  const io = initializeSocket(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const socket = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
  const frames: string[] = [];
  const waiters = new Set<() => void>();
  socket.on('message', data => { frames.push(data.toString()); for (const wake of waiters) wake(); });
  const waitFor = (predicate: () => boolean) => new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { waiters.delete(check); reject(new Error('Socket frame timeout')); }, 3000);
    const check = () => { if (predicate()) { clearTimeout(timeout); waiters.delete(check); resolve(); } };
    waiters.add(check); check();
  });
  try {
    await waitFor(() => frames.some(frame => frame.startsWith('0')));
    socket.send('40');
    await waitFor(() => frames.some(frame => frame.startsWith('40')));
    let finish!: (value: { id: string; title: string; status: string }) => void;
    const saved = { id: 'private-id', title: 'Unpublished sample', status: 'draft' };
    const saving = completeSpecialIssueMutation(() => new Promise<typeof saved>(resolve => { finish = resolve; }));
    assert.equal(frames.filter(frame => frame.startsWith('42')).length, 0);
    finish(saved);
    assert.equal(await saving, saved);
    await waitFor(() => frames.some(frame => frame.startsWith('42')));
    assert.deepEqual(frames.filter(frame => frame.startsWith('42')), ['42["special-issues:updated"]']);
    await assert.rejects(completeSpecialIssueMutation(async () => { throw new Error('Save rejected'); }), /Save rejected/);
    // A subsequent successful mutation is an ordering barrier: any erroneous
    // notification from the rejected operation would arrive before this one.
    await completeSpecialIssueMutation(async () => undefined);
    await waitFor(() => frames.filter(frame => frame.startsWith('42')).length >= 2);
    assert.deepEqual(frames.filter(frame => frame.startsWith('42')), ['42["special-issues:updated"]', '42["special-issues:updated"]']);
    assert.equal(Array.from(io.sockets.sockets.values())[0]?.rooms.has('authenticated-admins'), false);
  } finally {
    socket.terminate();
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
