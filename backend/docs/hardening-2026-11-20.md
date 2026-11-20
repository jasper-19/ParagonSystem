# Backend hardening handoff — 2026-11-20

## Changes and contracts

- Media uploads persist cleanup intent before writing objects. A transaction locks the jobs against the retry worker, creates metadata, and completes the jobs together. Partial uploads settle before compensation. Cleanup checks the primary database and preserves objects if metadata committed despite a lost acknowledgement. Optimized image deletion queues all three variants atomically with metadata deletion. A cleanup failure after deletion returns success because the deletion committed and recovery is queued.
- Media storage transactions admit at most two uploads per backend process (one for pools of two connections or fewer); excess uploads receive 503 and can be retried. Storage I/O has a 60-second cancellation deadline, with a 120-second transaction idle deadline. Image conversion still occurs before this admission check.
- User role/activity changes lock the users table before checking the active-admin count. Updates and session revocation share the transaction. Concurrent removal of the last two administrators permits one change and rejects the other with 409.
- Application actions lock the target row. Missing targets return 404. Assignment requires acceptance; changing acceptance while assigned returns 409. Interview cancellation clears its date and interviewed flag. Acceptance and completed interviews set the interviewed flag, preserving existing acceptance behavior. Manual admin status changes remain supported, but scheduled status requires a date. Interview input must be a valid ISO date/time; existing local datetime inputs remain accepted.
- Application list queries validate finite integer pagination, page 1–1,000,000, limit 1–50, supported status/sort/order values, and search length up to 255. Invalid input returns 400 before database access.
- Dashboard queries bound timestamp scans to the displayed window. UTC date grouping matches UTC bucket boundaries. Month-end construction avoids overflow, aggregation scans ordered results once, and lifetime metric labels explicitly say “all time.” Response shapes remain unchanged.

## Files

- `src/modules/media/media.service.ts`, `media.repository.ts`, `media-storage-paths.ts`, `media-cleanup.test.ts`
- `src/storage/storage-cleanup.repository.ts`
- `src/modules/users/user.service.ts`, `user.repository.ts`, `user.concurrency.test.ts`
- `src/modules/applications/application.controller.ts`, `application.repository.ts`, `application.routes.ts`, `application.schema.ts`, `application.hardening.test.ts`
- `src/modules/dashboard/dashboard.service.ts`, `dashboard.service.test.ts`
- `src/modules/articles/article.repository.ts` (bounded trend query)
- `src/modules/activity-logs/activity-log.test.ts` (transaction-aware mocks, retryable deletion, remove random UUIDs from the PII assertion)
- `src/security/hardening.integration.test.ts`

## Validation

- Backend: `npm.cmd test` — 193 passed, 3 opt-in integration tests skipped before the final upload admission test was added.
- Final media regression run: `tsx --test src/modules/media/media-cleanup.test.ts` — 7 passed, including admission limits and slot release.
- Backend: `tsc --noEmit --incremental false` — passed after the final implementation change.
- Isolated PostgreSQL: set `HARDENING_LOCAL_DB_TESTS=1`, then `tsx --test src/security/hardening.integration.test.ts` — all 3 scenarios passed (4 test-runner entries including the parent). Covers actual concurrent admin changes, assignment versus rejection, durable media reservations, in-flight claim exclusion, variant reference protection, and atomic deletion jobs. The test permits only a local database, creates a random fixture schema, and drops that schema in `finally`.
- Angular: `ng test --watch=false` with the application service, applications component, and dashboard service specs — 12 passed across 3 files.
- The PostgreSQL test caught an enum parameter-inference conflict that mocks did not catch; the corrected query passed the integration rerun.

## Release and recovery

No schema migration, dependency update, deployment, secret change, or live data repair was performed. This implementation requires the existing `paragon_internal.storage_cleanup_jobs` table and pending-path index from `src/config/migrate.sql`.

The existing `npm run cleanup:special-issue-storage -- --batch-size=25 --max-attempts=10` command drains this shared queue, including media jobs. Its scheduling in production was not changed or verified. It skips active references and locked upload jobs, waits ten minutes between attempts, and retains exhausted jobs. After an outage, an operator can review failures and rerun with a larger `--max-attempts` value to admit exhausted entries. Production execution requires separate approval under project instructions.

The change prevents new lost cleanup paths; it does not discover or repair older orphaned objects. A remote storage operation's outcome after a network timeout remains uncertain; pending jobs provide delayed reconciliation. No live Supabase fault injection was performed.

Independent reviewer, QA, and security agents reviewed the supplied design but could not access files or execute tools. Their outage-recovery and mocked-concurrency concerns were addressed with durable pre-upload reservations and real local PostgreSQL tests. Independent source inspection remains unverified. Existing unrelated documentation and header edits were preserved.
