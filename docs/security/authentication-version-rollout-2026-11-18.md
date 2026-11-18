# Authentication version hardening — 18 November 2026

Local changes only. No production SQL, deployment, environment change or account mutation was performed.

## Problem and behavior

An account update revoked existing sessions, but an asynchronous password check could finish later and create another session. Comparing current role, active status, staff assignment and password denies access while those values differ; restoring the earlier values could make that late session valid again.

The database now maintains `public.users.auth_version`, a nonnegative bigint. A private-schema, invoker-rights trigger advances it whenever password hash, role, staff assignment, active status or username actually changes. Restoring values advances it again. Metadata and no-op updates preserve it. Supplying a different version directly in an UPDATE cannot reset it. Arithmetic overflow rejects the update rather than wrapping.

Login captures the version with the password hash before bcrypt verification and signs it into the JWT as a canonical decimal string. HTTP, SSE, WebSocket and protected PDF authorization share the current-session check. It compares the current database version; HTTP activity repeats the predicate when updating session activity. Existing password binding, revocation and inactivity checks remain. Public user JSON excludes the version.

This prevents stale logins from becoming usable after security values are restored. It does not cancel work already authorized before an account change commits. The optional environment administrator remains outside database-session management; keep `ALLOW_ENV_ADMIN=false` in production. MFA and distributed rate limits remain separate audit requirements.

## Schema and deployment

The version column, function and trigger are included in `backend/src/config/migrate.security.sql`, after the previously prepared table-grant/RLS hardening. The existing migration runner executes it transactionally. Do not rerun the entire general schema migration solely for this change: review and apply the scoped security SQL in an explicit transaction using the approved migration procedure.

Before startup, all environments verify the bigint/non-null column and an enabled, unconditional, unrestricted BEFORE UPDATE row trigger bound to the expected private-schema invoker function with a fixed search path. This is a structural guard, not a substitute for reviewing the function body or controlling database-owner access.

Approved rollout sequence:

1. Review the combined grant/RLS/version SQL and backup/recovery procedure. Verify the actual runtime role can read/write application tables after browser grants are revoked and RLS is enabled.
2. Apply the scoped SQL in staging first, transactionally. Validate the trigger as the actual runtime role, then deploy the reviewed backend. Startup deliberately fails if the migration is missing or the trigger is disabled.
3. Test fresh sign-in, password reset, disable/enable, role restoration and staff reassignment. Tokens from before each change must stay denied after restoring original values, across HTTP and long-lived private delivery.
4. Obtain explicit approval for production SQL and deployment under project AGENTS.md. Apply SQL before the new code; drain all older backend instances before considering the protection active. Earlier instances do not enforce the version claim.
5. Expect existing database-user tokens without the new claim to require sign-in again. Verify fresh sign-in, admin PDF previews, notifications and protected HTTP requests after cutover. Follow the separate private-PDF prerequisites as well.

The schema addition is compatible with older code, but rolling back to older authentication code removes this protection. Keep the column/trigger and use a reviewed forward fix for authentication defects; restoring old versions or deleting the trigger is not a secure rollback.

## Validation and review

Verified locally: **151 backend tests passed**, TypeScript build passed, isolated PostgreSQL policy/version checks passed, and `git diff --check` passed. Independent security, code and QA source reviews found no unresolved issue in this scoped change; reviewers also independently ran the focused suite and PostgreSQL fixture.

The backend regression suite includes an asynchronous bcrypt/login snapshot test, old-version rejection after restored permissions, malformed and bigint-boundary JWT versions, guarded HTTP activity and actual HTTP/WebSocket revocation tests. The isolated PostgreSQL fixture exercises the actual SQL under a distinct backend table-owner role: all five changed-and-restored fields, null staff transitions, attempted direct version reset, metadata/no-op preservation, migration reruns and disabled-trigger startup denial.

Run from `backend`:

```powershell
npm.cmd test
npm.cmd run build -- --outDir ../.tmp/backend-dist
# Point SECURITY_PGLITE_MODULE at an isolated @electric-sql/pglite installation.
npm.cmd run verify:security-policies
```

PGlite is verification tooling only, not a new production dependency. Production-role compatibility, multi-instance cutover and deployed browser flows remain staging/release checks. Independent code/security/QA reviewers have repository and execution access for this follow-up; their conclusions apply to this scoped change, not the entire earlier audit.

References: [OWASP session lifecycle guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [PostgreSQL trigger functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html).
