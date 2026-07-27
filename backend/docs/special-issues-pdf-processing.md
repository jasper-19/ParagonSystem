# Special Issues PDF processing

## Request contract

The existing JSON create contract remains available during the migration
period. New uploads should use `multipart/form-data`:

- File field: `pdf`
- Accepted declared MIME type: `application/pdf`
- Text fields: `title`, `slug`, `type`, `academicYear`, `description`,
  `coverImage`, `publishedAt`, and `status`

The server never uses the uploaded filename as a filesystem path or object
key. A normalized filename is retained only as display metadata.

## Processing pipeline

1. Authentication and admin authorization run before multipart parsing.
2. Multer writes one bounded file to the operating system temp directory
   under a UUID filename.
3. The server checks file size, the PDF header, trailer markers, and rejects
   encrypted documents.
4. Ghostscript parses the document and reports its page count.
5. Ghostscript writes an optimized candidate using the configured profile.
6. The candidate is parsed again and its page count must match the original.
7. The candidate is used only when it meets the minimum savings threshold.
8. The selected file is uploaded to a new UUID object key with `upsert=false`.
9. PostgreSQL is updated only after storage upload succeeds.
10. Storage is compensated if the database insert fails. Temporary files are
    removed when the request completes.

The pipeline uses argument arrays with `shell=false`, limits captured process
output, enforces a timeout, supports request cancellation, and bounds
concurrent Ghostscript executions.

## Read and mutation endpoints

Public reads return published records only:

- `GET /api/special-issues`
- `GET /api/special-issues/:slug`
- `GET /api/special-issues/type/:type`

Authenticated administrators use `GET /api/special-issues/admin` and
`GET /api/special-issues/admin/:slug` to access draft or archived records.
Passing a non-published status to a public list request is rejected.

List endpoints accept `page` (1-100), `limit` (1-100), `search`, `type`,
`status` (admin, or `published` publicly), `sortBy`, and `sortOrder`.
Supported sort fields are `publishedAt`, `createdAt`, `title`, and
`academicYear`. Responses remain arrays and expose `X-Page`, `X-Page-Size`,
and `X-Has-More`; the implementation fetches one extra row and avoids an
additional exact-count query.

`PATCH /api/special-issues/:id/pdf` accepts a multipart `pdf` field. It uploads
to a new immutable object, switches the database pointer with an optimistic
concurrency check, and only then removes the previous object. Metadata updates
cannot write `pdfUrl` directly. Permanent deletion is limited to archived
records.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPECIAL_ISSUE_PDF_MAX_UPLOAD_MB` | `50` | Upload limit, bounded to 1–100 MB |
| `SPECIAL_ISSUE_UPLOAD_RATE_LIMIT` | `10` | Create attempts per IP per 15 minutes |
| `PDF_PROCESSOR_ENABLED` | `true` | Enables Ghostscript processing |
| `PDF_PROCESSOR_REQUIRED` | production: `true` | Makes `/ready` fail if Ghostscript is unavailable |
| `PDF_GHOSTSCRIPT_PATH` | `gs` (`gswin64c` on Windows) | Executable name or trusted absolute path |
| `PDF_COMPRESSION_PROFILE` | `ebook` | `screen`, `ebook`, `printer`, `prepress`, or `default` |
| `PDF_COMPRESSION_MIN_SAVINGS_PERCENT` | `5` | Minimum reduction required to keep optimized output |
| `PDF_COMPRESSION_FALLBACK` | `original` | `original` or `reject` after validated compression failure |
| `PDF_MAX_PAGE_COUNT` | `1000` | Maximum accepted page count |
| `PDF_PROCESS_TIMEOUT_MS` | `45000` | Timeout for each Ghostscript invocation |
| `PDF_PROCESSING_CONCURRENCY` | `1` | Concurrent processors, bounded to 1–4 |

## Development

Install Ghostscript and set `PDF_GHOSTSCRIPT_PATH` if the executable is not on
`PATH`. On Windows this is commonly the full path to `gswin64c.exe`.

If Ghostscript is unavailable, legacy JSON requests still work, but multipart
PDF processing returns a service error. Do not disable content processing in
production to accept unvalidated files.

## Render

Render currently documents Ghostscript as available in native deploy
runtimes. Keep `PDF_PROCESSOR_REQUIRED=true` so `/ready` verifies the actual
runtime instead of assuming that it exists.

For reproducible Ghostscript versions, deploy the backend from a Dockerfile and
pin the base image and Ghostscript package version. The application does not
invoke package managers at runtime.

Run the database migration before deploying code that creates multipart
Special Issues.

## Supabase Storage

The service-role credential remains server-only. Objects use immutable UUID
paths and `upsert=false`, avoiding collisions and stale CDN replacements.

The current Supabase adapter reads only the final bounded artifact into memory
because the standard `supabase-js` upload API does not accept a local file
path. Supabase recommends TUS resumable upload above 6 MB. Moving
`uploadFile()` to TUS or the S3-compatible API is the next storage optimization
and does not require changing the Special Issues domain service.

The existing storage abstraction returns public URLs. Use a dedicated public
publication bucket, or extend the abstraction with short-lived signed URLs
before placing drafts in a private bucket.

## Migration and rollback

`src/config/migrate.sql` creates the previously untracked base table when
needed and adds nullable PDF metadata columns with idempotent constraints.
Existing inline `pdf_url` values are untouched.

Application rollback is therefore safe: older code ignores the nullable
columns. Removing columns or deleting legacy inline data is intentionally not
part of this stage.

After applying the schema migration, inventory legacy inline PDFs without
changing data:

```sh
npm run migrate:special-issue-pdfs
```

Use `-- --limit=10` to scope the report. After reviewing the dry-run output
and confirming storage and Ghostscript readiness, conversion requires the
explicit apply flag:

```sh
npm run migrate:special-issue-pdfs -- --apply --limit=10
```

Each record is re-read immediately before conversion, processed through the
same validated replacement pipeline, and left unchanged when conversion
fails. Re-run the dry report until no candidates remain.

Storage deletion failures are recorded in
`paragon_internal.storage_cleanup_jobs`. A scheduler or operator can process
a bounded batch with:

```sh
npm run cleanup:special-issue-storage -- --batch-size=25 --max-attempts=10
```

Failed jobs observe a ten-minute retry lease. The worker logs aggregate
counts, not storage paths.
