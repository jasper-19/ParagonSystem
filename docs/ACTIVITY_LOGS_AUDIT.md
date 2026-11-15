# Activity logs production-readiness audit

Audit: 2026-11-15–16 (Asia/Manila). Scope: repository audit and local fixes; no production access, deployment, migration, push, secret change or historical-data modification.

## Assessment

The implemented HTTP mutation routes now have audit calls covering the domain actions below. Missing media events, silent production write failures, textual settings IDs, unsafe attribution and applicant metadata were corrected. Local checks pass.

This is **not certification of complete, crash-safe production auditing**. The business write and audit insert remain separate database operations. Live database access controls and operational retention/alerting also require verification before release.

## Coverage

| Domain | Recorded actions / behavior |
| --- | --- |
| Authentication | LOGIN for database and environment administrators; LOGOUT for both; LOGOUT_SESSION; CHANGE_PASSWORD; SET_2FA; REVOKE_OTHER_SESSIONS following password/account changes |
| Accounts | CREATE; UPDATE with changed fields, current role, active state, staff reference and passwordChanged flag; no passwords/hashes |
| Articles | CREATE, UPDATE, PUBLISH, ARCHIVE, DELETE; create/update record current status, update records changed fields (including category/credits/featured edits) |
| Special issues | CREATE, UPDATE, UPDATE_STATUS, REPLACE_PDF, DELETE; create/update include current status; no PDF bytes |
| Media | UPLOAD with ID/type/size; UPDATE with field names; DELETE after row removal and before storage cleanup |
| Applications | CREATE, UPDATE_STATUS, SCHEDULE_INTERVIEW, MARK_INTERVIEWED, ADD_NOTES, ACCEPT, REJECT, ASSIGN, DELETE; open/close/settings UPDATE; ID/status/role and notesChanged flags instead of applicant names/emails/interview text |
| Staff | CREATE from application, UPDATE with field names, DELETE; sensitive metadata values redacted |
| Editorial board | CREATE, ACTIVATE, DELETE, ADD_MEMBER, ASSIGN_APPLICATION, UPDATE_MEMBER, REMOVE_MEMBER, REVOKE_MEMBER, SATISFY; activation retains transition summary |
| Global settings | UPDATE for general, publishing/media, notifications and maintenance, with section/changed fields/version |
| Notifications | READ_ALL |
| Rejected requests | AUTHENTICATION_FAILED (401), ACCESS_DENIED (403), RATE_LIMITED (429), REQUEST_FAILED (other failed POST/PUT/PATCH/DELETE responses) |

Categories are article attributes; there is no separate category mutation API. Colleges and dashboard routes are read-only. No scheduled publication executor or password-recovery/2FA challenge flow was found; future implementations must define their own events. Enabling 2FA is currently rejected by the existing auth controller, and that failure is recorded.

Successful ordinary reads, analytics/view increments, session activity touches, socket reconnects and static delivery are intentionally excluded from the activity stream. Failure responses for those requests still produce security events where applicable. Viewing logs does not create another success event, avoiding a refresh loop. A policy requiring successful PII reads/exports to be audited would need additional events; no export API was found.

## Implemented protections and behavior

- Server-derived actor, role and random request ID; reserved metadata cannot override these. UUID actor identity remains in metadata even if a later user deletion clears the foreign key. Anonymous submissions and environment administrators have distinct frontend labels.
- IP attribution uses Express `req.ip` and validates it as an IP, rather than taking the first raw forwarding-header value. The production proxy configuration still determines trust.
- Bounded recursive metadata sanitization handles sensitive keys, arrays, excessive nesting and cycles. Descriptions explicitly exclude applicant PII; the sanitizer is defense in depth, not a substitute for selecting safe metadata. Original upload filenames and media caption values are excluded.
- Success events are awaited before returning successful responses. Audit persistence failures preserve an already committed business outcome and emit a sanitized `[AUDIT_WRITE_FAILED]` operational error with request ID and database error code. No raw database error is included.
- Failure events include only method/status, a static module mapping and the matched route template when available. Request bodies, raw URLs, query strings and exception messages are excluded. They carry `outcome: failure`; domain success events carry `outcome: success`.
- Failure events run on response completion. Pending writes drain before the database pool closes during normal HTTP shutdown. Pool acquisition, query and statement timeouts are configured in `config/db.ts`; these are not a guarantee against forced process termination.
- Application and board events precede fallible realtime emissions. Media deletion records the completed database removal even if storage cleanup later fails. A failed cleanup can therefore produce both a domain deletion and a failed-request event with the same request ID. An orphaned object still needs operational cleanup.
- Admin-only reads and filter options remain protected; only the backend can create activity records. The unused, forgeable `POST /api/activity-logs` API/controller was removed.
- Non-UUID resource keys such as settings sections are stored as `metadata.resourceKey`, returned as `entityId`, and searchable without changing the existing UUID column. Record UUIDs are also searchable. Date filters use explicit Asia/Manila calendar-day boundaries instead of the database connection timezone. This is a fixed campus timezone, not the configurable general-settings timezone.
- Query validation rejects invalid calendar dates, page/limit values and oversized filter strings before database queries. SQL values remain parameterized; ordering remains timestamp descending, then ID descending.

## Remaining production risks and release checks

1. **High: delivery is not atomic with business changes.** A crash or failed audit insert can leave a committed mutation without a record. Strict completeness requires an audit insert or durable outbox in the same transaction as each critical business mutation, with replay/monitoring. Awaiting and graceful draining reduce loss windows but do not close them. Multi-step repository operations can also partially change data before returning an error; a generic failure event is not a complete audit of every partial database write.
2. **High: live database permissions unverified.** Neither `config/migrate.sql` nor `config/migrate.activity_logs.sql` establishes activity-log RLS or browser-role restrictions. This does not prove the live table is exposed, but it must be checked. Verify `anon` and `authenticated` cannot read, insert, update, delete or truncate audit data through the Data API; verify the backend role can select/insert, and restrict mutation privileges independently. No permission-changing SQL was applied. Supabase requires RLS on exposed tables; its privileged service roles/owners can bypass RLS, so this alone is not tamper evidence. See [official RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
3. **Operational: retention, alerts and denial volume.** Configure alerting on `[AUDIT_WRITE_FAILED]`, investigate `[AUDIT_BROADCAST_FAILED]`, define approved retention/backups, and monitor table growth/query latency. Repeated denied/rate-limited requests currently generate individual database writes and socket invalidations; ingress protection, capacity or a bounded security-event aggregation design needs load verification. There is no durable retry queue.
4. **Attribution: validate Render ingress topology.** `app.ts` uses a production proxy hop count. Confirm it matches actual trusted ingress and test forged forwarding headers through the deployed ingress; local rejection of raw-header parsing cannot validate production topology.
5. **Privacy: historical records remain unchanged.** Previously persisted names, emails and interview notes are not scrubbed by this patch. Review access/retention and prepare an approved cleanup if required. New-write sanitization does not retroactively change old records.
6. **Semantics: idempotent operations.** Existing article/application deletes and session revocation can accept commands that affect zero rows. Their events represent successful commands, not verified affected-row counts. A requirement to distinguish no-op requests needs repository row-count contracts and corresponding event semantics.

Suggested read-only database review (catalogs only, no applicant rows):

```sql
SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'activity_logs';

SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'activity_logs';

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'activity_logs';
```

These catalog checks do not replace effective-role/Data API denial tests or inspection of privileged RPC functions and role inheritance.

## Validation

| Command | Result |
| --- | --- |
| Backend `npm.cmd test` | 107 passed, zero failed, including 10 new audit regressions |
| Backend `node --import tsx --test src/modules/activity-logs/activity-log.test.ts` | Final focused rerun: 10 passed, including safe fallback for unknown module names |
| Backend `npm.cmd run build -- --outDir .audit-build` | Passed compilation/emission into an isolated output directory |
| Frontend `npm.cmd test -- --watch=false --include="src/app/**/activity-log*.spec.ts"` | 14 passed across five files |
| Frontend `npm.cmd run build -- --output-path=.audit-frontend-build` | Production build passed; CommonJS warnings for quill-delta and page-flip |
| `git diff --check` | Passed |

The standard backend output directory produced filesystem EPERM write errors; using a separate output directory verified the source build without modifying its permissions. Temporary build/test artifacts were removed. Test database/storage operations are mocked; live schema/RLS, real ingress, crash recovery and load behavior were not tested. No live application status or publication changed.

Independent security, code-review and QA agents reviewed supplied implementation excerpts and test evidence. Their sessions could not access filesystem tools, so this was an independent design/excerpt review rather than a second full source inspection or independent test execution. No confirmed defect remained in their excerpts; atomicity, permissions and operational checks remain explicitly open.

## Changed-file groups and release impact

- `backend/src/modules/activity-logs/`: logger, failure middleware, read controller/routes/query schema/repository/service and regression tests.
- Mutation controllers in `applications`, `articles`, `auth`, `editorial-board`, `media`, `notifications`, `settings`, `special-issues`, `staff` and `users`; `media.service.ts` adds the post-delete audit callback.
- `backend/src/app.ts` installs failure auditing; `server.ts` drains pending writes.
- Frontend activity table/details use new `models/activity-log-actor.ts` with actor-attribution tests.

No schema migration is required by these code changes. API impact: manual log creation is removed; invalid list filters now return 400; textual entity IDs and metadata fields are added. Existing frontend list/filter/socket contracts remain compatible. Existing unrelated workspace edits, including global settings work, were preserved. Production configuration and architecture items above remain release decisions; no deployment or database change is authorized by passing local tests.
