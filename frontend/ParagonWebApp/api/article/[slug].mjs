import { createArticleShellLoader } from '../../server/article-shell.mjs';
import { createArticlePreviewHandler, DEFAULT_API_BASE, DEFAULT_SITE_ORIGIN } from '../../server/article-preview.mjs';

const handler = createArticlePreviewHandler({
  readIndex: createArticleShellLoader(),
  apiBase: process.env.PUBLIC_API_BASE_URL || DEFAULT_API_BASE,
  siteOrigin: process.env.PUBLIC_SITE_URL || DEFAULT_SITE_ORIGIN,
});

export const GET = handler;
export const HEAD = handler;
