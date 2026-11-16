# Article sharing and SSR readiness audit

Audit date: 16 November 2026. Scope: copied/native article links, initial social metadata, public article isolation, and Vercel delivery. The initial audit made local changes only. After explicit user approval, the backend was deployed and the live article metadata flow was verified as recorded below. Actual Messenger preview ingestion and broader production readiness remain separate checks.

## First-share image metadata follow-up

The user reported that each article image appeared only after running Meta's debugger. The initial response lacked image dimensions. [Meta's first-party guidance](https://developers.facebook.com/documentation/sharing/best-practices) states that `og:image:width` and `og:image:height` permit immediate rendering instead of requiring asynchronous image downloading/processing. This is a documented contributor that the implementation now addresses; it does not prove that dimensions explain every platform failure.

Changes:

- New backend `article-image-preview.ts` enriches the published-only preview response with the exact public storage URL, `imageWidth`, `imageHeight`, and detected `imageType`. It supports existing API media UUID URLs and direct public storage media URLs. No uploaded images or database rows are changed.
- URL resolution requires the configured API origin or configured Supabase origin, public bucket and `media/` path. It rejects credentials, query/hash, foreign origins, traversal and redirects. The existing `media_files` lookup and existing public file lookup both use ID-only visibility; this change introduces no access to applicant attachments or private buckets.
- Image inspection uses the existing Sharp dependency, orientation-aware dimensions and raster MIME detection. Limits: two seconds for fetch/body, 2 MiB streamed bytes, 40 million pixels, four pending probes with no queue, same-image deduplication, 128 cached entries, 15-minute successful TTL, 30-second failure TTL, and object update version in cache identity. Sharp metadata processing itself is not covered by the network deadline; bounded input/pixels/concurrency limit its resource exposure.
- Unsupported/external/oversized/unavailable images retain the original article image without invented dimensions. Optional inspection failures do not turn published previews into errors. This fallback means not every possible image obtains dimensions.
- Initial HTML emits the paired dimensions, MIME type and `og:image:secure_url`. The existing fallback JPEG declares its measured 1424 x 752 dimensions. Browser navigation clears dimensions/type when the image URL changes, preventing stale structured metadata.
- Existing `API_BASE_URL`, `SUPABASE_URL` and `SUPABASE_STORAGE_BUCKET` settings are used; no new environment variables, dependencies or schema changes.

Validation: backend suite **114 passed**, followed by the expanded focused image suite **10 passed**; renderer **16 passed**; article browser tests **9 passed**; backend and frontend production builds passed (existing frontend CommonJS warnings). Tests cover real JPEG/PNG/WebP bytes, EXIF rotation, actual fallback bytes, excessive declared pixels, hostile URLs/paths, response errors, stream cancellation despite false Content-Length, stalled-body timeout, cache expiry/eviction/version changes and concurrency limits. Independent QA, security and code reviewers assessed supplied excerpts/results; they did not independently execute checks.

A read-only real-image smoke check resolved a public article WebP as **1600 x 1600**, reused its cache without a second request, and rendered matching metadata using the actual frontend production-built shell. Total image inspection plus local rendering took about **758 ms** in this environment. This is not a cold-start latency guarantee for Render.

Release process: the user approved committing, pushing and deploying this backend and frontend follow-up after local verification. Deploy the backend and frontend, then verify raw production HTML and exact image accessibility and share a previously unshared article without using the debugger. Earlier failed URLs may retain Meta's cached result; no server change can force refresh of every existing platform cache. Render cold-start latency and the renderer's five-second upstream timeout also remain relevant to first-crawl success. The final handoff records the deployed revision and live verification results.

## Authorized backend release and live verification

The user approved using Render's "My Workspace" and deploying the production backend. Verified target: `paragon-api` (`srv-d8p5uqernols73f6oa30`), `backend` root, `main` branch, `npm ci --include=dev && npm run build`, and `npm start`. Auto-deploy was disabled and remained disabled. The previous live release was commit `1302751` from July; later attempted releases had failed.

Deployed remote main commit `bb8fa9c6c931f3c88b22bdeb5463d3cc64b2b586` as Render deployment `dep-dbthn661egvs73amaoeg`. Build completed and deployment reached **live** at 2026-11-16 15:05:48 UTC (23:05:48 Manila). No database migrations, secret changes, publications or applicant changes were performed. No local source was pushed.

Live checks after release:

- `/ready`: HTTP 200, database and PDF processor ready.
- Published article preview endpoint: HTTP 200, no-store, lean article payload.
- Both previously checked article documents: HTTP 200 for `facebookexternalhit/1.1`, article-specific title/description/canonical/Open Graph/Twitter image metadata in the initial HTML; no unavailable/noindex response.
- Article HEAD: HTTP 200, HTML content type and no-store.
- Both article images: final HTTP 200, `image/webp`, one public redirect.
- Unknown preview slug: HTTP 404, no-store, `Article not found`.
- Protected editor slug lookup without credentials: HTTP 401.
- No error-level runtime logs returned for the new instance during the immediate post-release window.

This resolves the observed missing-route blocker and verifies production metadata delivery. Actual Messenger display and refresh of previously failed platform previews remain to be checked by a fresh share. Build output also reported nine dependency audit advisories (two moderate, six high, one critical); these were not investigated or changed as part of this deployment and prevent treating this focused check as a full security certification.

## Deployment follow-up: article opens the minimal error document

After the user deployed the initial changes, opening an article from Messenger showed "Please try again shortly." Read-only Vercel runtime logs for deployment `dpl_EdBUVBaanRobZxxW9VSrBBtVhn1U` confirmed repeated `ARTICLE_PREVIEW_UNAVAILABLE` markers on the reported article URL. Those original logs did not record the failure stage, so the exact live exception remains unconfirmed.

The handler used `process.cwd()` to locate the built index. This fails when a monorepo function runs with its working directory outside the frontend project. The corrected `server/article-shell.mjs` resolves the fixed index path relative to its own module, validates the Angular shell and clears rejected read promises so subsequent requests can retry. The existing Vercel includeFiles rule remains necessary.

The renderer now loads the shell before validating metadata configuration, preserves the original shell if metadata insertion fails, and logs only fixed failure stages and allowlisted error codes. API/configuration failures retain the application root and scripts while returning generic 503 metadata, no-store, noindex and Retry-After. Shell-loading failures still cannot bootstrap Angular; their diagnostic stage/code will identify that condition without exposing filesystem paths or credentials.

Follow-up validation: `npm.cmd run test:share-previews` passed **14 tests**; `npm.cmd run build` passed with the existing CommonJS warnings. A child-process regression recreated a relocated monorepo layout where the old cwd-based path returned ENOENT and the corrected handler returned GET/HEAD 200. An additional smoke check used the actual production-built shell from the repository-root working directory and validated GET/HEAD plus all 12 referenced JavaScript/CSS assets. These checks mock the metadata API. `git diff --check` passed.

Only frontend handler/helper/tests and the test script changed in this follow-up. No backend or schema changes are required. Reviewers assessed the supplied implementation and evidence without independently executing commands. A fresh frontend deployment is required to apply this correction; Vercel's actual packaged module layout and live metadata/image fetching still need verification. No deployment was performed by the agent.

## Findings and changes

Production follow-up, 16 November 2026: after the frontend shell fix was deployed, direct public GET checks found the remaining preview blocker. Both checked article documents returned HTTP 404 with generic "Article unavailable" metadata. The Render request to `/api/articles/cics-gears-up-112-4th-year-studes-for-it-industry-with-500-hour-internship/preview` returned HTTP 404 and `{"error":"Not found"}` (the application-level missing-route response), while the same article's existing detail endpoint returned its title, Published status and image URL. The preview route is present in source since commit `c5bc41a`; the running API does not expose it. Verify Render's source commit and build/start commands, then deploy the backend with that route. Do not work around the missing route by weakening published-only checks.

Image checks succeeded anonymously using `facebookexternalhit/1.1`: the article media URL redirected to a public image with final HTTP 200 and `image/webp`; the site fallback returned HTTP 200 and `image/jpeg`. These probes establish image accessibility from this environment, not successful Messenger ingestion. Restore a 200 article-specific document response before treating platform caches or optional image metadata as the cause.

Render account inspection could not continue because no workspace is selected. The connector lists one workspace, "My Workspace", and requires user confirmation before using it. No Render configuration or deployment was changed.

Release preparation for this follow-up passed: `node --import tsx --test src/modules/articles/article.public.test.ts` (published-only preview/public reads and protected editor regression) and `npm.cmd run build -- --outDir .share-deploy-check`. Temporary build output was removed. No application code change was needed to diagnose the missing deployed route.

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
