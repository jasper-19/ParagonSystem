# Global Settings production-readiness audit

Date: 2026-11-15 (Asia/Manila). Baseline: clean `main` working tree.

Scope: existing General, Publishing & Media, Notifications, Maintenance and User Accounts settings; their frontend state, API validation, persistence, access controls and consumers. Preserve layout, brand and existing workflows. No production resources were changed.

Acceptance criteria: privileged settings stay admin-only; stale responses cannot undo newer state; conflicting saves preserve edits; policy enforcement is consistent; reconnects recover missed updates without request loops; persisted localization preferences have working display consumers. Validate with HTTP boundary tests, service regressions, existing form tests, type-checks and production compilation.

## Findings and changes

| Finding | Resolution |
| --- | --- |
| Generic article status transition could call repository publishing directly, bypassing global publishing/image requirements | Route `Published` through `publishArticle`; regression rejects disabled publishing and missing cover images before mutation |
| Concurrent cold/expired settings reads duplicated database work; an older read could restore an outdated policy after a save | Share the in-flight read and retain the highest version, including the value returned to pending callers |
| Public settings could remain cached in browsers/CDNs for minutes after maintenance changed | Use `Cache-Control: no-store`; retain the 15-second server cache for ordinary visitors, with a version hint to refresh after invalidation |
| Out-of-order frontend reads could replace newer settings and browser identity | Accept full/public snapshots monotonically by version; full reads and saves also synchronize public state |
| Missed socket events and stale API responses could leave clients outdated or cause repeated requests | Refresh loaded state on reconnect; coalesce refreshes; permit one stale-response retry; preserve newer invalidations through failed requests; remove listeners on service destruction |
| A save conflict could leave the UI without a current snapshot to load | Fetch the latest full snapshot after HTTP 409 while preserving dirty form values; retain each form's accepted version until explicitly reset or saved |
| Date/time preferences were stored but unused | Apply them to public/admin header clocks and settings update timestamps through a cached formatter; clarify scope in General settings |
| Duplicate MIME entries were accepted and surrounding email spaces caused avoidable validation failures | Require unique MIME values and trim contact email before validation |
| Socket initialization/transport failure could report a committed settings save as failed | Make the settings invalidation emission best effort, consistent with existing special-issue behavior |

## Existing controls inspected

- Settings reads/writes use authentication plus admin authorization, except the intentionally public allowlisted identity/maintenance DTO.
- The singleton update uses parameterized values and `WHERE version = expectedVersion` with an increment in the same SQL statement. No schema change is needed.
- CSRF and API rate limiting are mounted before settings routes. Maintenance returns HTTP 503, `no-store` and `Retry-After`, while settings/auth routes remain accessible for recovery.
- User account password, role and deactivation changes revoke sessions through `revokeAllOtherSessions(id)` without retaining a session. JWT role revocation is therefore addressed by the existing account update path.
- Article create/edit/publish paths consult publishing policy. Media Library uploads consult configured size/MIME rules and validate content; Sharp has a 40-million-pixel input bound. Notification producers use event-specific settings.
- Existing `backend/src/config/migrate.sql` defines and initializes `system_settings`; no migration was run.

## Validation and release implications

Validation results:

| Command | Result |
| --- | --- |
| Backend `npm.cmd test` | 97 tests passed |
| Backend `node --import tsx --test src/modules/settings/settings.routes.test.ts` | Final HTTP boundary test passed |
| Backend `node node_modules/typescript/bin/tsc --noEmit` | Passed before adding the HTTP test; final compilation below includes all tests |
| Backend `node node_modules/typescript/bin/tsc --outDir .audit-build` | Final compilation passed, including test sources |
| Frontend `npm.cmd test -- --watch=false --include='**/*settings*.spec.ts' --include='**/publication-date.pipe.spec.ts' --include='**/app.spec.ts'` | 28 tests in 7 files passed |
| Frontend `npm.cmd run build -- --output-path=dist-settings-audit` | Production build passed; existing Quill/page-flip CommonJS warnings |
| `git diff --check` | Passed |

The standard backend build could not overwrite existing `dist` files because of EPERM permissions; emitting into a fresh temporary directory succeeded. Temporary audit build output was removed after verification. No lint script is defined in either application package.

HTTP tests run against a loopback Express server with database queries mocked, including optimistic concurrency; they do not substitute for a real PostgreSQL concurrency test. No applicant records or live publication states were modified.

Independent frontend, QA, security and code reviewers analyzed supplied source/patch evidence. Their sessions had no repository tools, so independent source-level inspection and execution were unavailable. Identified cache/error timing gaps were addressed and regression coverage expanded; the coordinator inspected source and ran checks.

Remaining operational limits:

- Separate API instances can apply policy changes up to 15 seconds apart. Socket broadcasting is process-local; existing open clients connected to another instance may need reconnect/reload. Distributed invalidation is needed before promising immediate multi-instance propagation.
- Localization affects header clocks and settings metadata. Existing editorial/content dates and other administration timestamps retain their current formats; the UI explicitly describes this boundary.
- Special-issue PDF processing and applicant attachment limits retain their dedicated policies; global upload settings govern the Media Library.
- Audit logging remains asynchronous/best effort; settings persistence and log insertion are not a single transaction.
- Live browser/device testing and deployed database/socket behavior were not verified. Before release, smoke-test two admin sessions, a public reader, maintenance recovery and an actual upload in a non-production environment.

Deployment requires the normal separate approval. Release frontend and backend together for the version-hint/reconnect behavior; no new secrets or database schema are required.

## Changed file groups

- Backend: `modules/settings` service/controller/schema and regression tests; article status service and policy test; settings socket emission and regression test.
- Frontend: Global Settings service and tests; four versioned forms; General copy and settings metadata; shared publication-date formatter/tests; public/admin header clocks.
- This audit report.
