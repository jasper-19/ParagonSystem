# Special Issues audit — 2026-11-11

## Scope and acceptance

Audit the existing Angular administration/library/reader and Express PDF pipeline.
Preserve route shapes, publication statuses, storage metadata, existing brand tokens,
and database compatibility. Acceptance requires concrete fixes, targeted regression
coverage, both builds, independent QA and security/correctness review.

No deployment, push, migration, live content mutation, or credential change is part
of this work. The initial working tree was clean on `main`.

## Verification boundaries

The backend chooses Supabase object storage in production and local filesystem
storage in development. Production PDFs therefore do not depend on Render's
ephemeral filesystem. This is a code-path finding, not a verified production
restart/persistence test.

Ghostscript, PostgreSQL CLI, and Docker were not available on PATH in this
workspace. Automated processor tests use a command-runner substitute, service
tests substitute storage/repository dependencies, and HTTP tests exercise local
Express servers. These do not establish production bucket configuration,
database migration state, native Ghostscript compatibility, or browser rendering.

## Remaining architectural limits

- Public storage URLs are independent of publication status. Unpublishing hides
  API records but does not revoke a known PDF URL or cached copies. Confidential
  drafts need a private bucket plus authorized or short-lived signed delivery;
  changing this requires a reviewed storage/API transition.
- Legacy HTTPS PDF references remain supported. The server does not fetch and
  validate arbitrary remote URLs; adding that behavior requires SSRF controls.
- Standard uploads remain non-resumable. Interrupted uploads must be retried;
  resumable delivery would require a separate upload protocol and lifecycle.
- Metadata editing and PDF replacement use separate existing requests. They
  cannot provide a single database transaction across both operations.
- Object deletion and database mutation are coordinated through compensation
  and queued cleanup, not a distributed transaction. Existing cleanup jobs need
  an operator or scheduler; a process crash between steps can still leave an
  orphan object. Reconciliation/outbox work is a separate design change.
- PageFlip 2.0.7's installed renderer schedules an internal animation loop that
  its public `destroy()` does not cancel. Application-owned resources are
  released, but fully stopping that loop requires a maintained dependency patch
  or replacement. No dependency changes were made in this audit.
- PDF uploads show an indeterminate saving state through server processing.
  Browser transport completion alone cannot represent server validation and
  storage completion. The client limit matches the server's 50 MiB default;
  deployments with an overridden limit need matching client configuration.

## Implemented fixes

- Backend controller/service: response disconnect cancellation, checks before
  database commits, compensation after cancelled storage uploads, cleanup on
  early replacement failures, and legacy inline PDF processing through the
  validated persistent upload pipeline.
- Processor/runner/semaphore: reject pre-aborted work, preserve cancellation
  through compression fallback, wait for child shutdown, and transfer queued
  semaphore slots without exceeding concurrency.
- Storage/repository: stream final artifacts rather than buffering another
  complete PDF, close stream handles, allow only the configured development
  storage HTTP prefix, and initialize missing publication timestamps.
- Angular service/admin list: load all bounded API pages before updating the
  list, avoid slug-validator cache writes, propagate lookup/list errors,
  explain partial PDF/metadata success, guard duplicate actions, react to query
  changes, clamp pages after deletion, and expose loading/action feedback.
- Reader/form/library: cancel owned work, deduplicate page rendering, bound
  raster cache/canvas allocation, retain the Angular container across resizes,
  remove duplicate touch handlers, correct cover/spread navigation, improve
  loading/errors/keyboard controls, validate PDF selection, block pending saves,
  recover partial replacements without uploading twice, and remove empty year
  groups.

Existing API route/payload shapes and database schema remain unchanged. The
legacy JSON inline-PDF payload is still accepted but now requires the same
processor availability as multipart PDF uploads. No dependencies were added.

## Validation record

- Initial backend baseline: `npm.cmd test` — 39 passed, 0 failed.
- Final complete backend suite:
  `node node_modules/tsx/dist/cli.mjs --test src/**/*.test.ts` — 50 passed,
  0 failed (65.620 seconds).
- Backend typecheck: `node node_modules/typescript/bin/tsc --noEmit` — passed.
- Backend emit: `node node_modules/typescript/bin/tsc --outDir
  node_modules/.cache/special-issues-audit-build-20261111` — passed. The normal
  `npm.cmd run build` could not overwrite existing `dist` files (EPERM).
- Independent security/correctness review: no remaining source blockers;
  independent processor/runner/semaphore/schema checks — 18 passed.
- Frontend targeted test compilation passed. Initial test workers crashed or
  timed out before yielding a complete assertion result; final verification
  used one worker and the threads pool. That final full run also timed out
  waiting for its worker after 61.94 seconds: 0 test files and 0 tests executed,
  exit 1. Frontend assertions remain unverified. The temporary runner config was
  removed; no test-runner configuration change is included in this patch.
- Frontend production build:
  `node node_modules/@angular/cli/bin/ng.js build --output-path
  node_modules/.cache/special-issues-audit-web-20261111` with
  `NG_BUILD_MAX_WORKERS=2` — passed in 332.462 seconds. Initial bundle 1.28 MB;
  CommonJS warnings for the existing `page-flip` and `quill-delta` dependencies.
- Final `git diff --check` — passed (Git reports line-ending conversion notices
  for existing frontend files).

## Follow-up before release

Run the frontend suite on a runner that can start Vitest workers. Then exercise
a representative real PDF through create, publish, public read, replacement,
unpublish/archive, and delete against a disposable database and storage bucket.
Include invalid/encrypted/oversized PDFs, disconnects, concurrent replacements,
and storage failures. Restart the backend and confirm the stored PDF still loads.
Use desktop, tablet, and mobile browsers to verify PDF.js worker loading,
PageFlip sizing/touch behavior, keyboard navigation, fullscreen, and cleanup.
Review the public-storage and PageFlip limits above before claiming release
readiness. No production deployment or migration was performed.

