# Private Special Issue PDFs — implementation and rollout

**Local implementation validated; production rollout not performed.** Existing public originals remain exposed until the approved copy, cutover and purge are complete. This continues the [17 November security audit](production-security-audit-2026-11-17.md).

## Behavior and API contract

**Production follow-up:** the approved migration and separately approved public-original purge completed on 18 November. See the [rollout evidence](production-rollout-2026-11-18.md); the pre-release text above is historical.

- New PDF uploads/replacements use `private-special-issues/<uuid>/<uuid>.pdf` in a separate private bucket. Default bucket: `paragon-pdfs`; override with `SUPABASE_PDF_STORAGE_BUCKET`. It must differ from the public media bucket.
- The existing `pdf_storage_path` column encodes routing through this canonical prefix. No application columns change. Old paths continue to use public storage until migrated. Cleanup routes both prefixes to the correct bucket. Retry workers recheck issue/media references under table locks immediately before storage deletion, and skip files still in use.
- API representations derive a permanent delivery URL from the private path, even if an old public URL remains in `pdf_url`: `GET|HEAD /api/special-issues/pdf/:uuid`.
- Published PDFs are readable without login. Draft/archived PDFs require a currently valid admin session; unauthorized requests return 404. This check happens before HEAD, range or conditional responses. A request already authorized and streaming may finish after a status change; subsequent requests recheck visibility.
- Delivery supports full, suffix and open-ended single ranges; partial responses are 206 and malformed/unsatisfiable/multiple ranges are 416. Responses are `no-store`; conditional requests never bypass authorization or produce cached 304s.
- Files stream through the API. Storage URLs/service credentials are never redirected or returned to clients. Streams have exact-byte accounting, a 100 MiB ceiling, a 60-second deadline and eight concurrent slots per process. The route has a separate IP budget of 180 requests/minute; range reads do not consume the general API budget.
- In development, private files live in `backend/private-pdfs`, outside static uploads. Static delivery explicitly denies private prefixes, including encoded separators and case variants.
- URL-only PDF creation is rejected. Upload the file or use the existing inline-PDF processing path; both persist processed PDFs privately. General media-library assets remain public and must not contain confidential documents.
- Public readers use the normal URL with PDF.js range requests. Existing admin “Open PDF” links navigate to the protected URL and rely on the HttpOnly session cookie, not a token in the URL. Cookie preview authorization is covered by HTTP tests; actual deployed browser behavior remains a staging check.

## Production prerequisites

The later [authentication-version hardening](authentication-version-rollout-2026-11-18.md) also requires the reviewed security SQL before server startup. Follow both sets of prerequisites when releasing these combined workspace changes.

Before deploying the new server, prepare the bucket and browser-denial policy. Production startup deliberately refuses to listen without a private bucket and a matching restrictive policy on `storage.objects`. A private bucket alone does not establish adequate RLS.

Required configuration: matching project database/storage credentials, `SUPABASE_URL`, a credential-free HTTPS `API_BASE_URL`, and a dedicated PDF bucket name. Keep public image configuration unchanged. Use a patched Node 22 runtime, verified database TLS and the existing supported frontend runtime.

The preparation script creates a missing bucket as private, with PDF MIME and configured upload-size restrictions. It installs a restrictive policy for `anon` and `authenticated` that denies all operations on that bucket, even when another permissive policy allows access. It does not make an existing public bucket private. Reusing the policy name for a different bucket is refused. The database role needs permission to create the storage policy; ordinary runtime file reads use the server-side storage service role.

## Staging and approved production sequence

All commands below run from `backend`. Commands with `--apply`, production deployment, operational configuration changes, and original deletion require separate explicit approval under project `AGENTS.md`. They have **not** been run on production.

1. Verify the database URL and Supabase URL identify the same intended project. Take a private backup of PDF objects and database references; verify recovery. Confirm the actual runtime database role works with the earlier table-grant hardening.
2. Inspect preparation and migration dry runs:

   ```powershell
   npm.cmd run prepare:private-pdf-storage
   npm.cmd run migrate:private-special-issue-pdfs -- --limit=25
   ```

3. After approval, prepare storage:

   ```powershell
   npm.cmd run prepare:private-pdf-storage -- --apply
   ```

   Rerun the preparation dry run and require `bucketPrivate=true` and `policyReady=true`. If creation succeeds but policy installation fails, the empty bucket remains private; resolve the policy failure before deployment.

4. Deploy the reviewed backend with the private bucket configured. Verify a new private upload, protected admin preview, anonymous draft denial, published full/range reads and public images in staging. Do not claim existing PDFs are private yet.
5. Enter an approved maintenance window. Pause editorial mutations (including administrative edits/deletes), stop and drain cleanup workers, and retain those restrictions through copy, verification and purge. The confirmation flag acknowledges this operational prerequisite; it does not stop running workers itself.
6. After approval, copy a small batch and switch references:

   ```powershell
   npm.cmd run migrate:private-special-issue-pdfs -- --apply --maintenance-window-confirmed --limit=25
   ```

   Repeat until the default dry run reports zero candidates. Source bytes must match stored SHA-256/length; the immutable destination is independently downloaded and verified before a conditional update compares the old path, URL, hash and size. A retry can reuse only a verified matching destination. Concurrent changes are preserved and reported as conflicts.

   The reference update also cancels pending cleanup jobs for the retained public original in the same SQL statement. Already-running cleanup work must be drained beforehand. The copy step never deletes originals or enqueues them for deletion. Verification/CAS failures may leave an unreferenced private copy; preserve it for investigation and remove only after checking references.

7. Resolve every manual-review row. Inline PDFs with no storage path can use the earlier `migrate:special-issue-pdfs` workflow after separate approval; it now writes private objects. Arbitrary external URLs and noncanonical paths are deliberately not fetched automatically. Inventory duplicate references and legacy files rather than enabling arbitrary server-side URL fetches.
8. Verify all database references are private and all private bytes are recoverable. Obtain **separate deletion approval**, then purge public originals:

   ```powershell
   npm.cmd run migrate:private-special-issue-pdfs -- --apply --purge-public-originals --maintenance-window-confirmed --limit=25
   ```

   Purge refuses to begin while any issue has an unmigrated/null storage path. Each candidate's private copy is verified again. Before deleting its canonical public original, the script locks issue/media/cleanup tables and checks for active references and an unchanged private record. These short metadata locks can delay writes; the lock acquisition timeout is five seconds.

   Purge does not update issue rows, so use the reported `nextAfter` UUID with `--after=<uuid>` for the next batch. Repeating a batch is safe for missing public originals. Do not skip failed/conflicted rows without investigating. The command checks database references, not all possible external copies or links; the inventory and maintenance window remain required.

9. Confirm former public URLs are inaccessible through fresh unauthenticated requests and after relevant CDN invalidation. Confirm direct private Storage access fails under both browser roles, while published API reads and authenticated previews work. Check HEAD/ranges, revoked sessions, archiving and reader navigation. A previously downloaded/browser-cached copy cannot be recalled.
10. Resume cleanup workers and editorial access only after verification, and record migration counts, exceptions and the approved release version.

## Recovery

Before purge, retained originals and database backups permit a reviewed rollback of reference changes. Do not roll back the server to a version that cannot handle private paths while database references still point to them. After public originals are purged, restore only into private storage and use a known working private-delivery release; making the shared bucket public is not a recovery mechanism. Reconcile partial copy/CAS/purge failures before resuming mutations.

## Files and validation

Main implementation: `storage/private-pdf-path.ts`, `private-pdf-storage.ts`, `private-pdf-policy.ts`, `private-pdf-migration.ts`, `pdf-stream.ts`; Special Issue delivery controller/repository/routes/service; storage factory/static middleware/cleanup claiming; environment validation/server startup. Operational tools: `prepare-private-pdf-storage.ts`, `migrate-private-special-issue-pdfs.ts`, `verify-security-policies.ts`.

Validation performed:

- Backend suite: **148 passed**, including cookie/admin and anonymous visibility, HEAD/conditional/range reads, archive denial, URL serialization, canonical paths, local static bypass denial, wrong/public bucket rejection, upstream redirect/ignored-range rejection, exact-byte truncation/overflow, concurrency, disconnect cancellation, deadline expiry, failure recovery, migration checksum/CAS behavior and locked cleanup reference checks.
- Backend production TypeScript build passed using `--outDir ../.tmp/backend-dist` because the existing generated `dist` files are not writable in this session.
- PostgreSQL engine fixture (PGlite 0.5.16): restrictive private-bucket policy denied browser reads/writes despite an allow-all policy; public-image access retained; table hardening applied twice successfully; table-owner backend access retained. No live database was used.
- `npm.cmd run verify:private-pdf-reader` passed: the actual PDF.js 6.5.438 runtime rendered a synthetic document from local private storage through the API, made 10 range reads and produced the expected pixel. This fixture uses no live data or database queries. It requires the frontend dependencies installed in the existing monorepo location.
- No frontend source changes were needed for this step. The earlier 262 frontend tests, 16 preview tests and frontend production build were not repeated for unchanged frontend code.
- Security/QA/code reviewers assessed the supplied contract and results. Their sessions lacked repository tools, so full independent source review and actual Supabase/browser staging tests remain release gates.

The PostgreSQL fixture is reproducible through `npm.cmd run verify:security-policies`. It requires an external installation of `@electric-sql/pglite` (tested 0.5.16); set `SECURITY_PGLITE_MODULE` to that package's absolute directory. This keeps a temporary database runtime out of application dependencies. The fixture creates only an in-memory database and does not load application connection credentials.

References: [Supabase private downloads](https://supabase.com/docs/guides/storage/serving/downloads), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
