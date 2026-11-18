# PARAGON production security audit — 17 November 2026

**Disposition: not ready for unconditional production sign-off.** Verified repository fixes are complete and locally validated. Private PDF storage, approved database hardening, and deployed verification remain release gates. No production deployment, migration, secret change, push, or publication/applicant mutation was performed.

**18 November follow-up:** private PDF delivery and migration tooling are implemented and locally tested. See the [private PDF rollout handoff](private-pdf-rollout-2026-11-18.md). The earlier grant SQL has now also passed an isolated PostgreSQL-engine fixture twice with backend-owner access preserved. Actual backend-role compatibility and approved production rollout remain unverified.

**Additional 18 November follow-up:** the stale-login/account-restoration race is now addressed locally with a database-managed authentication version. See the [authentication rollout handoff](authentication-version-rollout-2026-11-18.md). This adds a users column and trigger; the security SQL must precede deployment. Production remains unchanged.

## Scope and evidence

Reviewed Angular browser code and Vercel preview handlers; Express route protection, sessions, CSRF, rate limits, HTML handling, uploads, storage, realtime notifications, database queries and startup configuration; package manifests/lockfiles; tracked credential signatures; and read-only production metadata and anonymous HTTP responses.

Acceptance criteria: remediate verified implementation defects without changing editorial permissions; maintain published-only public reads and admin-only private routes; add security regression coverage; pass builds/tests; record dependency findings and unresolved infrastructure requirements. The initial audit made no database column changes; the linked authentication-version follow-up adds one column and a trigger. A grant/RLS hardening script is prepared and included in the existing transactional migration runner, but has not been executed.

This is a source/configuration review with targeted regression tests, not a full authenticated penetration test or a certification. The entire stored-media inventory, privileged live workflows, historical secret contents, backup restoration, cloud-account MFA, and hosting secret/configuration values were not inspected. No private applicant data or file contents were fetched from production.

## Verified findings and changes

| Severity | Finding | Remediation and evidence |
| --- | --- | --- |
| High | Session checks trusted token role/staff claims without checking the current account or password. Existing controller-side revocation did not cover every mutation path atomically. | Session validation now joins the current active user, compares role/staff association, checks revocation/idle age, and verifies an HMAC binding to the bcrypt hash used at login. Tokens issued from old credentials fail after reset, including late completion of an old-password login. User security updates revoke sessions in the same SQL statement. |
| High | WebSocket/SSE authorization occurred at connection setup, allowing private delivery after expiry or revocation. WebSocket CORS alone did not protect upgrades. | Exact allowed Origin enforcement for upgrades; cookie-bearing originless upgrades denied; private delivery revalidates token signature/expiry and current database authorization. Passive checks do not refresh inactivity. Periodic checks close stale connections; private sends check independently of that interval. |
| High | Published dependency advisories affected browser and server dependencies. | Patched Angular runtime/compiler to 21.2.26, CLI/build to 21.2.30; PDF.js to 6.5.438; compatible backend parser, Socket.IO, Sharp and Zod patches; root uuid patch. Targeted development overrides pin patched Hono, MCP SDK, glob and minimatch. Final scans report zero advisories across all three manifests, including development dependencies. |
| Medium | The rich-text editor wrote supplied HTML directly into a DOM element. | Angular HTML sanitization now precedes Quill clipboard conversion; direct HTML insertion was removed. Initial and empty form values also use this path. Existing server-side article allowlist sanitization remains in place. |
| Medium | Image validation accepted formats recognized by Sharp even when different from the declared image type, including SVG disguised as a raster image when optimization was disabled. | Decoded image format must exactly match declared JPEG/PNG/WebP/GIF before storage or optimization. Existing byte and 40-million-pixel bounds remain. Multipart media uploads now reject extra fields/parts. |
| Medium | Database TLS verification could be disabled through configuration or overridden by URL SSL parameters. | Production startup rejects disabled verification and SSL override parameters in the database URL. TLS verifies certificates explicitly; `DB_SSL_CA` supports a trusted PEM CA where required. |
| Medium | Public article invalidations exposed article IDs and old/new slugs, including draft mutation metadata. | Public notifications carry no article payload. Event timing still signals content activity; it does not establish confidentiality of editorial activity itself. |
| Low / defense in depth | API destination matching used a string prefix; embedded frames had broad permissions. | The interceptor now matches parsed origin plus API path boundary. Article iframes have a sandbox without same-origin access, top navigation, forms, or popups, narrower permissions, and no referrer. Actual embed compatibility should be checked in staging. |
| Defense in depth | Password verification work could be repeatedly invoked through password changes. | Added an authenticated account-keyed limit of five password-change attempts per 15 minutes. Compressed JSON/form bodies are rejected to avoid request-inflation work. Existing general, login, application, view and PDF upload limits remain. |

Relevant implementation:

- `backend/src/security/auth-token.ts`, `live-session.ts`; `middlewares/authenticate.ts`, `maintenance.ts`; `modules/auth/session.repository.ts`, `auth.controller.ts`, `auth.routes.ts`; `modules/users/user.repository.ts`.
- `backend/src/realtime/socket.ts`, `socket.events.ts`; `modules/notifications/notification.controller.ts`, `notification.service.ts`.
- `backend/src/modules/media/media.service.ts`, `media.routes.ts`; `config/db.ts`, `env.ts`; `app.ts`.
- `frontend/ParagonWebApp/src/app/core/interceptors/auth.interceptor.ts`; `shared/components/rich-text-editor/rich-text-editor.ts`; `features/articles/components/section/section.html`.
- Password-change UI/service now invalidates cached identity, clears the displayed sessions and routes to login after success. The success message explicitly states that all devices have been signed out.
- Root/backend/frontend package manifests or lockfiles; `.gitignore` excludes environment variants and temporary audit artifacts while retaining example files.

## Remaining release gates

### High: unpublished and archived PDF objects use public storage

Live metadata confirms `paragon-media` is a public bucket. `special-issue.service.ts` uploads PDFs through the shared storage service and persists `getPublicUrl(objectKey)` regardless of draft/published status. Published-only API queries do not enforce access to the underlying public URL. A known URL can remain usable after archiving/unpublishing, until the object is removed or storage access changes. No unpublished object was downloaded to demonstrate this.

Required remediation before treating unpublished PDFs as confidential:

1. Provision a **separate private PDF bucket**, preserving public image storage.
2. Implement PDF delivery that checks published status for public readers and current admin authorization for private previews. Use a bounded, range-capable proxy for immediate status revocation, or explicitly accept the expiry window of short-lived signed URLs. Do not persist expiring signed URLs as permanent database values.
3. Add bucket identity to object cleanup/migration handling where needed, copy existing PDFs, verify checksums and range reads, then replace stored references and remove public originals only after explicit approval and backup/recovery verification.
4. Verify draft denial, authorized preview, published reading, and old-URL denial after unpublication. Old copies already downloaded or cached by third parties cannot be recalled.

Making the existing shared bucket private would break existing image delivery. This infrastructure/data migration was not performed. Generic media-library PDFs are also public assets; never use this bucket for confidential applicant material.

### Medium: excessive browser database grants

The read-only Supabase security advisor returned 17 informational `rls_enabled_no_policy` notices and no reported warning/error findings. Direct catalog inspection confirmed RLS on all 16 public application tables and the private cleanup table, with no application/storage policies or public functions/views at audit time.

Fifteen public tables still grant `anon` and `authenticated` SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER. RLS with no policies blocks ordinary row access, but TRUNCATE is outside RLS; externally reachable TRUNCATE through ordinary PostgREST was **not** established. These are excessive grants for an application using its own Express authorization and server-side PostgreSQL connection.

Prepared remediation: `backend/src/config/migrate.security.sql` enables RLS and revokes grants from PUBLIC/anon/authenticated on the 16 explicitly named application tables. `src/scripts/migrate.ts` runs it inside the existing migration transaction. It preserves table-owner/service-role privileges, does not change storage policies, and includes a read-only privilege verification query.

**Do not apply blindly.** Verify the actual backend database role, table ownership, and explicit privileges first. A role relying on PUBLIC grants or lacking owner/BYPASSRLS access will need intentionally designed backend grants/policies. Test equivalent permissions in staging. The SQL has passed an isolated PostgreSQL-engine fixture, including idempotence and backend table-owner reads/updates. Actual runtime-role compatibility still requires staging validation. For an approved standalone application, run this file inside an explicit transaction; do not rerun unrelated schema changes just to revoke grants.

The staging project was inactive at audit time. It was not started or modified.

### Other production requirements and limits

- The public bucket has no configured MIME allowlist or file-size cap. No storage policies were present, so unrestricted anonymous uploads were not established. Configure bucket-level limits after reconciling media/PDF limits, and verify only the server can upload. Inventory stored objects for private material before sign-off.
- Application MFA is unavailable: enabling it returns 501 and login has no TOTP/WebAuthn challenge. Do not represent a stored preference as active MFA. Implement verified enrollment/challenge/recovery or place administrative access behind an approved MFA-capable identity boundary. Check cloud-provider account MFA separately.
- Keep `ALLOW_ENV_ADMIN=false` in production. The optional environment administrator does not have normal database-session revocation; its JWT remains subject to expiry and configuration. No live setting was changed.
- Verify Render/Vercel use patched, supported Node releases. Backend now targets Node 22; frontend requires Node >=22.13 in the supported 22/24 major ranges because of the PDF.js security update. Hosted Node versions were not inspected.
- Before release, remove SSL override query parameters from `DATABASE_URL`, ensure certificate verification works, and supply the trusted CA through `DB_SSL_CA` when necessary. The new startup check intentionally refuses insecure configurations. No secret or environment value was changed.
- Rate limits are process-local. Horizontal scaling requires a shared store or equivalent gateway enforcement. Verify proxy hop configuration, distributed abuse resistance, notification fanout, PDF/image processor concurrency and patched Ghostscript/OS images under realistic load.
- Password changes and security-sensitive account edits require a new sign-in. Old database-backed JWTs lack the new credential binding and are deliberately rejected after deployment. The linked authentication-version follow-up closes the identity-change/login restoration race locally; its column/trigger migration and new backend code must both be released before relying on that guarantee.
- SQL review found parameterized values and allowlisted dynamic columns/order keys in inspected repositories. This does not replace database-role least privilege or an authenticated penetration test.
- Verify backups/restoration, monitoring/alerts, retention/deletion of applicant PII and logs, and secret history with a dedicated scanner. A limited tracked-file signature scan is not proof that no secret has ever been exposed.

## Validation performed

| Check | Result |
| --- | --- |
| `backend: npm.cmd test` | 131 passed, 0 failed. Includes HTTP CSRF/current-credential checks, real WebSocket rejection/revocation, image spoof rejection, production TLS validation, current identity predicates and atomic revocation tests. Database behavior is mocked in these tests. |
| `backend: npm.cmd run build -- --outDir ../.tmp/backend-dist` | Passed. Used an alternate output directory because the pre-existing `dist` files were not writable in this session. |
| `frontend: npm.cmd test -- --watch=false` | 55 files / 262 tests passed. Existing jsdom `scrollTo` warnings remain. |
| `frontend: npm.cmd run build` | Passed. Existing Quill/PageFlip CommonJS optimization warnings remain. |
| `frontend: npm.cmd run test:share-previews` | 16 passed, including metadata injection and unpublished-content checks. |
| Actual PDF.js runtime smoke | PDF.js 6.5.438 parsed and rendered a synthetic one-page PDF through its worker/canvas path; blue pixel output verified and loading task destroyed. Full browser device/range-read coverage still required. |
| `npm.cmd audit --json` in root, backend and frontend | Zero known vulnerabilities, including development dependencies, after final updates. This is advisory-database coverage at audit time, not a guarantee of no vulnerabilities. |
| Tracked-file credential signature scan | 700 tracked files; no matching private-key/AWS/GitHub/Supabase-secret-key signatures. No historical env/key filenames returned by the limited Git filename check. Values were withheld. |
| `git diff --check` | Passed. |
| Read-only production requests | Frontend 200 with CSP/HSTS/nosniff/frame denial; all nine tested private API GETs returned 401: applications/users/staff/activity-logs/settings/media/notifications/articles-admin/special-issues-admin. Health initially timed out, then returned 200 on recheck; cause was not established. |
| Read-only Supabase review | Advisor, RLS/grants, policies, functions/views and bucket configuration inspected; no production writes. |

Independent security, code and QA agents reviewed supplied excerpts/results. Their sessions lacked filesystem/execution tools, so they did **not** independently inspect the repository or execute tests. Their findings about password races, passive-session refresh, permission compatibility and private storage were incorporated or explicitly retained as release gates. Full independent repository review is still recommended before release.

## Release sequence

1. Complete private PDF storage/delivery work and database-backed staging checks; obtain full repository review and authenticated browser verification.
2. Review the scoped SQL and storage migration, actual database role, Node/TLS settings, backups, MFA decision and rollback procedure.
3. Obtain explicit approval before production SQL, object migration, environment changes or deployment, as required by project `AGENTS.md`.
4. Deploy approved artifacts; perform sign-in/password-reset/revocation tests across HTTP/SSE/WebSocket, published/draft/archive file-access tests, upload rejection tests, and headers/rate-limit checks against the deployed configuration.

## Reference controls

- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS-without-policy advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [PDF.js advisory](https://github.com/advisories/GHSA-hq66-cqwq-w95j)
