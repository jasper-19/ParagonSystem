import { readFile } from 'node:fs/promises';

// Resolve from this bundled module, not Vercel's process working directory.
const shellUrl = new URL('../dist/ParagonWebApp/browser/index.csr.html', import.meta.url);

export function createArticleShellLoader(readShell = () => readFile(shellUrl, 'utf8')) {
  let pending;
  return () => pending ??= Promise.resolve().then(readShell).then(shell => {
    if (typeof shell !== 'string' || !/<head\b[^>]*>[\s\S]*?<\/head>/i.test(shell)
      || !/<app-root\b/i.test(shell)) throw new Error('Invalid Angular shell');
    return shell;
  }).catch(error => {
    // A transient read error must not poison every request on a warm instance.
    pending = undefined;
    throw error;
  });
}
