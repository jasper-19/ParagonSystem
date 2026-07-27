# Special Issues Stage 3 deployment

## What this stage changes

- Public and admin list queries are bounded to 100 rows per request and 100
  pages.
- Search, type, status, sort field, and sort direction are validated before
  SQL is built.
- List responses remain arrays. Pagination state is returned in `X-Page`,
  `X-Page-Size`, and `X-Has-More`.
- `special_issues` has RLS enabled and direct `anon` and `authenticated`
  table privileges revoked. The Express API remains the supported access path.
- Migration verification and post-deployment smoke scripts are read-only or
  transactionally rolled back.

## Pre-deployment checks

1. Take a PostgreSQL backup or confirm point-in-time recovery.
2. Confirm the backend uses a direct owner-level PostgreSQL connection. A
   low-privilege role affected by RLS needs an explicit backend-only policy
   before deployment.
3. Confirm the Supabase bucket file-size limit is at least
   `SPECIAL_ISSUE_PDF_MAX_UPLOAD_MB`.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
5. Confirm Render's runtime contains Ghostscript:

   ```sh
   gs --version
   ```

6. Set `PDF_PROCESSOR_REQUIRED=true` in production so readiness fails closed.

Render's current native deploy runtime includes Ghostscript. Pin a Docker base
image and package version if reproducible binary versions are required.

## Disposable migration verification

Create or select an initialized disposable clone of the application database
whose name contains `test`, `ci`, or `tmp`, then set
`MIGRATION_TEST_DB_NAME`. This reuses the local `DB_HOST`, `DB_PORT`,
`DB_USER`, and `DB_PASSWORD` settings without putting the password in shell
history. For a remote disposable database, use
`MIGRATION_TEST_DATABASE_URL` instead. The verifier
refuses other database names, applies the complete migration inside a
transaction, checks the PDF schema, indexes, cleanup table, and RLS, then
rolls the transaction back:

```sh
npm run verify:special-issue-migration
```

This command must not point at production. Docker and `psql` were not
available in the development workspace, so this verification must run in CI
or another disposable PostgreSQL environment.

## Render rollout

Recommended service settings:

- Root directory: `backend`
- Build command: `npm ci && npm run build`
- Pre-deploy command: `npm run migrate`
- Start command: `npm start`
- HTTP health-check path: `/ready`

Deploy the backend before the frontend. The migration is additive, but the
new API relies on its PDF metadata and cleanup objects.

After Render reports the new instance ready, run:

```sh
SMOKE_BASE_URL=https://your-backend.example npm run smoke:special-issues
```

Set `SMOKE_ADMIN_BEARER_TOKEN` only in a protected operator environment to
include the authenticated admin-list check. The script never prints the
token.

## Legacy inventory and conversion

Inventory only:

```sh
npm run migrate:special-issue-pdfs
```

Do not add `--apply` until the inventory, backup, bucket limits, Ghostscript
readiness, and a representative conversion batch have been reviewed.

## Rollback

Application rollback is compatible with the additive PDF columns. Do not
drop metadata columns or cleanup jobs during an incident. If direct
Supabase Data API access to `special_issues` was an undocumented dependency,
restore it only through a reviewed RLS policy and explicit grants; do not
disable RLS broadly.
