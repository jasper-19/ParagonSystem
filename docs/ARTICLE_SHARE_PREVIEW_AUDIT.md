# Article sharing and SSR readiness audit

Audit date: 16 November 2026. Scope: copied/native article links, initial social metadata, public article isolation, and Vercel delivery. Local implementation is ready for deployment verification; production readiness remains unverified. No deployment, database migration, secret change or live article change was performed.

## Findings and changes

| Finding | Change |
| --- | --- |
| Article metadata was populated only after Angular executed; the initial SPA document had a generic title. | Added a Vercel Node function and shared renderer that inject article Open Graph, Twitter card, description and canonical metadata into the built Angular shell before responding. |
| Public slug/detail/feed reads could retrieve unpublished articles; public listing status could select drafts. | Public queries now require Published status. Added a lean published-only preview endpoint and a protected editor slug endpoint. Migrated editor loading and slug checks to the protected endpoint. Admin lists already use the protected admin listing. |
| Copied/shared links could contain tracking parameters or fragments. | Copy and native share use the matching canonical URL and remove query/hash. A stale canonical for another article is ignored. |
| Untrusted article values could damage metadata or URLs. | Escaped HTML attributes/text, stripped markup from text, used callback replacement to preserve literal dollar tokens, constrained public image URLs and provided the existing fallback JPEG. Empty optional excerpts use a useful default description. |
| Upstream failures and removed articles require safe behavior. | Missing/unpublished articles produce generic 404 previews. Upstream errors produce generic 503 responses with Retry-After. Responses use no-store; no article data cache is retained by the renderer. |

This is **server-rendered metadata with a client-rendered Angular body**, not a full Angular SSR migration. The response preserves app-root, stylesheet and module script references. Every user agent receives the same metadata path; there is no bot-only routing.

## API and implementation contracts

- `GET /api/articles/:slug/preview`: unauthenticated, published-only title, slug, excerpt, image, status and publishedAt; excludes body, author and credits. Missing/invalid slug returns 404. Responses use no-store.
- `GET /api/articles/admin/by-slug/:slug`: authenticated admin/editor workflow using the existing requireAdmin policy; can return unpublished content; private, no-store. Existing admin listing and ID lookup remain available.
- Public article detail/feed are published-only and no-store. Public lists force Published; explicitly requesting another status returns 400. Catalog/list caches retain their existing cache policy.
- `frontend/ParagonWebApp/api/article/[slug].mjs` handles GET/HEAD. `server/article-preview.mjs` fetches only the fixed configured API origin, without forwarding credentials/cookies, with a five-second timeout, no redirects and a 64 KiB JSON limit. Images are emitted as URLs, never fetched by the function.
- `vercel.json` routes `/article/:slug` to `/api/article/:slug`, excludes API routes from the SPA fallback and includes the built index in the function bundle.
- Server-only optional settings: `PUBLIC_SITE_URL` (HTTPS site origin) and `PUBLIC_API_BASE_URL` (HTTPS API base including `/api`). Defaults match the existing Vercel and Render origins. This change does not alter live environment settings. A custom domain needs its correct canonical origin configured.
- No schema or dependency changes. Main affected files are the article repository/service/controller/routes, their new public-read regression test, frontend article service/editor/metadata/share components and tests, preview function/renderer/tests, package script and Vercel configuration. Existing unrelated loader/template edits were preserved.

## Local validation

| Check | Result |
| --- | --- |
| Backend `npm.cmd test` | 108 passed |
| Backend `npm.cmd run build -- --outDir .share-build` | Passed; alternate output avoids existing dist permissions |
| Frontend `npm.cmd run test:share-previews` | 9 passed |
| Frontend `npm.cmd test -- --watch=false --include="src/app/features/articles/**/*.spec.ts"` | 8 passed; jsdom scrollTo warnings |
| Frontend `npm.cmd run build -- --output-path=.share-frontend-build` | Passed; existing quill-delta/page-flip CommonJS warnings |
| Renderer using the actual production-built Angular shell and copied fallback image | Passed |
| `git diff --check` | Passed |

Renderer coverage includes raw HTML metadata without JavaScript for representative crawler/browser user-agent strings, escaped hostile content and replacement tokens, canonical host/query isolation, safe fallback image, optional excerpts, unknown/unpublished responses, published-to-unpublished transition, malformed/oversized/error responses, methods/HEAD and configuration contracts. User-agent tests validate response consistency; they do not simulate platform ingestion.

Backend regression checks exercise published-only SQL predicates and public responses with an isolated mocked database, plus anonymous/staff/admin permissions on editor reads. They do not establish the state of production rows or RLS.

Independent code, security and QA reviewers assessed supplied implementation excerpts and results. Their sessions had no repository tools; they did not independently execute tests. A concrete dollar-token HTML replacement issue raised during security review was fixed and covered by regression tests.

## Required release verification

1. Deploy the backend before the frontend so the preview and editor endpoints exist. This requires separate user approval. Review and invalidate any old public API caches that may contain previously accessible unpublished responses; no-store cannot retroactively clear old caches.
2. On an authorized Vercel preview deployment, confirm function recognition, bundling of the built index, rewrite precedence, CSP/security headers and working Angular assets. Local Angular builds and imports do not validate Vercel packaging.
3. Inspect raw GET and HEAD responses for a published slug, unknown slug, unpublished slug and API outage. Expect 200/404/503 respectively, one canonical/title, no-store and appropriate generic failure metadata. Confirm protected editing, admin lists and browser navigation still work.
4. Verify the configured canonical domain and anonymously accessible article/fallback images return successful image responses. The fallback is the existing 1424 x 752 JPEG; URL syntax checks do not guarantee external image availability.
5. Check representative articles with Facebook, LinkedIn, X and WhatsApp platform tools or real messages. Platform caching and user/platform settings can delay or suppress previews; a copied URL cannot force a preview. Existing platform caches need a refresh where supported.
6. Observe Render/Vercel latency, 503 markers and burst behavior. Each uncached article document request calls the backend; the existing global API limiter applies. Validate capacity and rate limits under expected crawler traffic before adding cache policies or stronger edge controls.

Live frontend/backend probes failed from this environment, so deployed responses and actual platform previews are unverified. Production release should wait for these checks.

## Full Angular SSR migration follow-up

Angular currently has no SSR/server build entry. App startup accesses localStorage/document/window and starts sockets; browser-dependent editor, PDF and other integrations also need isolation before server rendering. A full migration needs browser-only initialization guards, per-request public data loading, hydration-compatible state, route-specific rendering modes, protected/admin CSR boundaries, server-safe dependencies and end-to-end hydration/auth tests. Global settings can also race with browser article title updates and should be reviewed as part of broader SEO work. This audit does not certify special-issue/category/home social metadata.

## Reference contracts

- [Open Graph metadata protocol](https://ogp.me/)
- [Angular server and hybrid rendering](https://angular.dev/guide/ssr)
- [Vercel Node.js function handlers](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
