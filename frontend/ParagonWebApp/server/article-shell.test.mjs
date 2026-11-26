import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createArticleShellLoader } from './article-shell.mjs';

const shell = '<html><head><base href="/"><link rel="stylesheet" href="/styles-current.css"></head><body><app-root></app-root><script src="/main-current.js" type="module"></script></body></html>';

test('shell loading shares successful reads but retries rejected reads', async () => {
  let calls = 0;
  const load = createArticleShellLoader(async () => {
    if (++calls === 1) throw Object.assign(new Error('Read failed'), { code: 'ENOENT' });
    return shell;
  });
  await assert.rejects(load(), { code: 'ENOENT' });
  assert.deepEqual(await Promise.all([load(), load()]), [shell, shell]);
  assert.equal(calls, 2);
  assert.equal(await load(), shell);
  assert.equal(calls, 2);
});

test('an invalid build shell is rejected rather than permanently cached', async () => {
  let value = '<html><body>Missing Angular build</body></html>';
  const load = createArticleShellLoader(async () => value);
  await assert.rejects(load(), /Invalid Angular shell/);
  value = shell;
  assert.equal(await load(), shell);
});

test('deployed handler reads a relocated monorepo bundle independently of process.cwd', async () => {
  const tempBase = await realpath(tmpdir());
  const bundleRoot = await realpath(await mkdtemp(join(tempBase, 'paragon-shell-')));
  const project = join(bundleRoot, 'frontend', 'ParagonWebApp');
  try {
    for (const file of ['api/article/[slug].mjs', 'server/article-preview.mjs', 'server/article-shell.mjs']) {
      const target = join(project, file);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(new URL(`../${file}`, import.meta.url), target);
    }
    const index = join(project, 'dist/ParagonWebApp/browser/index.csr.html');
    await mkdir(dirname(index), { recursive: true });
    await writeFile(index, shell);
    // The old cwd-based lookup fails in this exact layout.
    await assert.rejects(access(join(bundleRoot, 'dist/ParagonWebApp/browser/index.csr.html')), { code: 'ENOENT' });
    const script = `
      import assert from 'node:assert/strict';
      globalThis.fetch = async () => Response.json({slug:'campus-news',title:'Campus news',status:'Published'});
      const {GET,HEAD} = await import(${JSON.stringify(pathToFileURL(join(project, 'api/article/[slug].mjs')).href)});
      const request = method => new Request('https://news.example/article/campus-news',{method});
      const response = await GET(request('GET'));
      const html = await response.text();
      assert.equal(response.status,200);
      assert.match(html,/property="og:title" content="Campus news"/);
      assert.match(html,/<app-root/);
      assert.match(html,/main-current.js/);
      assert.match(html,/styles-current.css/);
      const head=await HEAD(request('HEAD'));
      assert.equal(head.status,200); assert.equal(await head.text(),'');
      console.log('Relocated handler GET and HEAD passed');
    `;
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: bundleRoot, env: { ...process.env, PUBLIC_SITE_URL: 'https://news.example', PUBLIC_API_BASE_URL: 'https://api.example/api' },
    });
    assert.match(stdout, /Relocated handler GET and HEAD passed/);
  } finally {
    const relativeTarget = relative(tempBase, resolve(bundleRoot));
    assert.ok(relativeTarget.startsWith('paragon-shell-') && !relativeTarget.includes('..'));
    assert.equal(await realpath(bundleRoot), bundleRoot);
    await rm(bundleRoot, { recursive: true, force: true });
  }
});
