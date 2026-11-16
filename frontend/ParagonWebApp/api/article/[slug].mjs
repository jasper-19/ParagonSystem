import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createArticlePreviewHandler, DEFAULT_API_BASE, DEFAULT_SITE_ORIGIN } from '../../server/article-preview.mjs';

let index;
const handler = createArticlePreviewHandler({
  readIndex: () => index ??= readFile(join(process.cwd(), 'dist/ParagonWebApp/browser/index.html'), 'utf8'),
  apiBase: process.env.PUBLIC_API_BASE_URL || DEFAULT_API_BASE,
  siteOrigin: process.env.PUBLIC_SITE_URL || DEFAULT_SITE_ORIGIN,
});

export const GET = handler;
export const HEAD = handler;
