// Runs the production Angular reader in isolated Chrome with local fixtures.
// All non-local requests are intercepted; no production API is contacted.
// Run: node --import tsx src/scripts/verify-special-issue-reader.mjs --build=... --pdf=...
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import WebSocket from 'ws';

const require = createRequire(import.meta.url);
const { localUploadsMiddleware } = require('../storage/local-uploads.middleware.ts');
const argument = (name, fallback) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(operation, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < end) {
    try { const value = await operation(); if (value) return value; } catch (error) { lastError = error; }
    await sleep(100);
  }
  throw new Error(`Browser condition timed out${lastError ? `: ${lastError.message}` : ''}`);
}

async function main() {
  const build = path.resolve(argument('build', '../frontend/ParagonWebApp/node_modules/.cache/pdf-production-build/browser'));
  const pdf = path.resolve(argument('pdf', '../frontend/ParagonWebApp/src/assets/pdfs/wanderlust.pdf'));
  const output = path.resolve(argument('output', 'node_modules/.cache/pdf-browser-verification'));
  const chrome = argument('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  const baseline = process.argv.includes('--baseline');
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'paragon-reader-fixture-'));
  await mkdir(path.join(fixtureRoot, 'special-issues', '1234'), { recursive: true });
  await copyFile(pdf, path.join(fixtureRoot, 'special-issues', '1234', '1234.pdf'));
  await mkdir(output, { recursive: true });
  const pdfRequests = [];
  const app = express();
  app.use('/uploads', (req, res, next) => {
    const record = { range: req.headers.range ?? null, writtenBytes: 0, status: null };
    pdfRequests.push(record);
    const write = res.write, end = res.end;
    res.write = function(chunk, ...args) { if (chunk) record.writtenBytes += Buffer.byteLength(chunk); return write.call(this, chunk, ...args); };
    res.end = function(chunk, ...args) { if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) record.writtenBytes += Buffer.byteLength(chunk); return end.call(this, chunk, ...args); };
    res.once('close', () => { record.status = res.statusCode; record.contentRange = res.getHeader('content-range') ?? null; });
    next();
  }, localUploadsMiddleware(fixtureRoot));
  app.use(express.static(build));
  app.use((_req, res) => res.sendFile('index.html', { root: build }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = await mkdtemp(path.join(os.tmpdir(), 'paragon-reader-chrome-'));
  const child = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket, inspectPage;
  const errors = [];
  try {
    const portFile = await waitFor(async () => (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n'));
    const targets = await (await fetch(`http://127.0.0.1:${portFile[0]}/json/list`)).json();
    const target = targets.find(item => item.type === 'page');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    let sequence = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 60_000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    inspectPage = evaluate;
    socket.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.id) {
        const request = pending.get(message.id); if (!request) return;
        pending.delete(message.id); clearTimeout(request.timer);
        if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
      } else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const url = new URL(request.url);
        if (url.origin === origin) void send('Fetch.continueRequest', { requestId }).catch(error => errors.push(error.message));
        else if (url.pathname.includes('/api/')) {
          const issue = { id: 'benchmark', slug: 'benchmark-pdf', title: 'Local PDF benchmark', type: 'Newsletter', academicYear: '2025-2026', status: 'published', coverImage: '', pdfUrl: `${origin}/uploads/special-issues/1234/1234.pdf`, publishedAt: '2026-11-14T00:00:00Z' };
          const body = url.pathname.endsWith('/special-issues/benchmark-pdf') ? issue : url.pathname.endsWith('/special-issues') ? [] : {};
          void send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [
            { name: 'content-type', value: 'application/json' }, { name: 'access-control-allow-origin', value: origin }, { name: 'access-control-allow-credentials', value: 'true' },
          ], body: Buffer.from(JSON.stringify(body)).toString('base64') }).catch(error => errors.push(error.message));
        } else void send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
      } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    });
    await send('Page.enable'); await send('Runtime.enable'); await send('Performance.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const raf = requestAnimationFrame.bind(window), cancel = cancelAnimationFrame.bind(window), frames = new Set();
      const created = URL.createObjectURL.bind(URL), revoked = URL.revokeObjectURL.bind(URL);
      window.__readerMetrics = { created: 0, revoked: 0, frames };
      window.requestAnimationFrame = callback => { let id; id = raf(time => { frames.delete(id); callback(time); }); frames.add(id); return id; };
      window.cancelAnimationFrame = id => { frames.delete(id); cancel(id); };
      URL.createObjectURL = blob => { window.__readerMetrics.created++; return created(blob); };
      URL.revokeObjectURL = url => { window.__readerMetrics.revoked++; return revoked(url); };
    })();` });
    const rows = [];
    for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }]) {
      console.info(`Verifying ${viewport.name} reader`);
      await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'mobile' });
      const firstRequest = pdfRequests.length;
      const start = performance.now();
      await send('Page.navigate', { url: `${origin}/special-issues/benchmark-pdf` });
      await waitFor(() => evaluate(`!!document.querySelector('.reader__book img[data-page="1"]')?.naturalWidth && !document.querySelector('.reader__state')`), 90_000);
      const firstPageMs = Math.round(performance.now() - start);
      const atFirstPage = pdfRequests.slice(firstRequest).map(item => ({ ...item }));
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true, `${viewport.name}: horizontal page overflow`);
      if (!baseline) {
      await evaluate(`document.querySelector('[aria-label="Zoom in"]').click()`);
      await waitFor(() => evaluate(`document.querySelector('[aria-label="Reset zoom"]')?.textContent.trim() === '125%' && !!document.querySelector('.reader__book img[data-page="1"]')?.naturalWidth`));
      await evaluate(`document.querySelector('[aria-label="Reset zoom"]').click()`);
      await waitFor(() => evaluate(`document.querySelector('[aria-label="Reset zoom"]')?.textContent.trim() === '100%' && !!document.querySelector('.reader__book img[data-page="1"]')?.naturalWidth`));
      }
      await evaluate(`(() => { const input = document.querySelector('[aria-label="Go to page"]'); input.value = '2'; input.dispatchEvent(new Event('change')); })()`);
      await waitFor(() => evaluate(`document.querySelector('.reader__page-status')?.textContent.includes('2') && !!document.querySelector('.reader__book img[data-page="2"]')?.naturalWidth`));
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(path.join(output, `${viewport.name}.png`), Buffer.from(screenshot.data, 'base64'));
      const metrics = await send('Performance.getMetrics');
      await evaluate(`document.querySelector('.reader__back').click()`);
      await waitFor(() => evaluate(`!document.querySelector('.reader__book')`));
      await sleep(1000);
      const cleanup = await evaluate(`({ created: __readerMetrics.created, revoked: __readerMetrics.revoked, activeAnimationFrames: __readerMetrics.frames.size })`);
      assert.equal(cleanup.created, cleanup.revoked, `${viewport.name}: object URL leak`);
      if (!baseline) assert.equal(cleanup.activeAnimationFrames, 0, `${viewport.name}: animation loop survived teardown`);
      rows.push({ ...viewport, firstPageMs, rangeRequestsAtFirstPage: atFirstPage.filter(item => item.range).length,
        serverWrittenBytesAtFirstPage: atFirstPage.reduce((sum, item) => sum + item.writtenBytes, 0), cleanup,
        jsHeapUsedBytes: metrics.metrics.find(item => item.name === 'JSHeapUsedSize')?.value,
        pdfRequests: pdfRequests.slice(firstRequest),
      });
    }
    const report = { measuredAt: new Date().toISOString(), baseline, browser: await send('Browser.getVersion'), pdf,
      methodology: 'Actual production Angular/PDF.js/PageFlip in isolated headless Chrome; production API requests fulfilled with local fixture before network. localhost storage delivery, warm host caches; viewport tests are not physical devices. Server-written bytes may include a cancelled initial full-request buffer.', rows, errors };
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.table(rows.map(({ pdfRequests: _requests, ...row }) => row));
    console.info(`Browser report and screenshots: ${output}`);
  } catch (error) {
    let page;
    try { page = await inspectPage?.(`({url:location.href,body:document.body.innerText.slice(0,3000)})`); } catch {}
    await writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.message, page, errors, pdfRequests }, null, 2));
    throw error;
  } finally {
    socket?.close(); child.kill();
    await new Promise(resolve => server.close(resolve));
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
