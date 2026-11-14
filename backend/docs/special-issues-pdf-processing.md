# Special Issues PDF processing

## Request contract

The existing JSON create contract remains available during the migration
period. Inline PDF data URLs are decoded into a bounded temporary file and use
the same validation, processing, and storage pipeline as multipart PDFs. Legacy
external HTTPS references are retained without fetching remote content.
New uploads should use `multipart/form-data`:

- File field: `pdf`
- Accepted declared MIME type: `application/pdf`
- Text fields: `title`, `slug`, `type`, `academicYear`, `description`,
  `coverImage`, `publishedAt`, and `status`

Multipart text fields are capped at 1 MiB each. Use an image-library HTTPS URL
for covers that exceed that limit rather than embedding a large data URL.

The server never uses the uploaded filename as a filesystem path or object
key. A normalized filename is retained only as display metadata.

For local development, cover images selected from the media library may use
HTTP at the configured `API_BASE_URL` origin (or `http://localhost:${PORT ||
5000}`), with the exact `/api/media/<UUID>/file` route. Create/update validation
and response mapping share this exception; production still requires HTTPS
or an accepted image data URL. Ensure the configured API URL matches the
running backend. The form displays individual validation fields/reasons rather
than hiding them behind the generic "Validation failed" response message.

## Processing pipeline

1. Authentication and admin authorization run before multipart parsing.
2. Multer writes one bounded file to the operating system temp directory
   under a UUID filename.
3. A bounded queue admits processing. The server checks file size, the PDF
   header and trailer markers. Known encrypted containers are rejected; when
   qpdf is available its encryption inspection provides an additional check.
4. Ghostscript parses the document with `SAFER` and `PDFSTOPONERROR`, using
   exact-file read permission, and reports its page count. After enforcing the
   page limit, `nullpage` interprets every page to catch content/resource errors
   without writing raster images.
5. High Quality avoids Ghostscript rewriting. Other profiles skip compression
   below configurable size/density thresholds; otherwise they produce one
   `pdfwrite` candidate. There is no cascade through progressively lossier tiers.
6. Candidates that cannot meet the size threshold are discarded without a
   second native parse. Candidates selected for publication must preserve the
   original page count, pass whole-document `nullpage` interpretation and match
   normalized extracted searchable text.
7. If explicitly enabled and available, qpdf losslessly recompresses streams
   and can linearize the best selection. Its output must pass `qpdf --check`
   (including linearization checks), Ghostscript page-count parity, and
   whole-document `nullpage` interpretation and normalized extracted text. Optional
   optimizer errors or warnings retain the previous validated selection.
8. The selected file is uploaded to a new UUID object key with `upsert=false`.
9. PostgreSQL is updated only after storage upload succeeds.
10. Storage is compensated if the database insert fails. Temporary files are
    removed when the request completes.

The pipeline uses argument arrays with `shell=false`, limits captured process
output and samples generated output size every 100 ms, enforces command and
whole-processing deadlines, supports request cancellation (including a response
disconnect after multipart parsing), and bounds concurrent Ghostscript
executions. Cancellation before the database mutation compensates any new
storage object. Production uploads stream the final PDF to Supabase instead of
buffering the entire artifact a second time.

The final PDF is never larger than the original. A replacement must save at
least `PDF_COMPRESSION_MIN_SAVINGS_PERCENT` (5% by default). Linearization alone
does not override that rule: if its additional structure increases the selected
file size, the previous selection remains in use. Unselected artifacts are
deleted on success, failure, cancellation, and timeout. SHA-256 is streamed.

## Quality profiles

`PDF_COMPRESSION_PROFILE` accepts the following profiles; the existing `ebook`
default is retained until representative publications have been visually reviewed.
This is server configuration, not an additional request-body field.

Original fallback is available only after the original passes whole-document
interpretation. That validation costs a native pass even for adaptive skips;
the total deadline still applies. `nullpage` detects interpretation failures,
while visual fidelity remains a separate check with representative publications.

| Profile | Behavior |
| --- | --- |
| `high-quality` | Lossless qpdf structure/stream optimization only; otherwise retain the validated original. No image downsampling or `pdfwrite` rewrite. |
| `balanced` | Color/grayscale images target 150 DPI, monochrome 300 DPI; keeps color space and passes through existing JPEG/JPX where no image modification is needed. |
| `maximum` | Color/grayscale images target 96 DPI, monochrome 200 DPI; trades image detail for size. Requires visual review of photographs and small text embedded in images. |
| `screen`, `ebook`, `printer`, `prepress`, `default` | Existing Ghostscript preset names retain their preset mapping. |

Balanced/Maximum adjust image parameters individually instead of applying a
broad Ghostscript preset. JPEG encodings use bounded distiller `QFactor` controls
(Balanced 0.4, Maximum 0.76; lower values request higher fidelity), with automatic
JPEG-versus-Flate selection. Unmodified JPEG/JPX images can pass through without
another lossy encoding. Text and vector paths use `pdfwrite`, rather than
rasterizing every page. This does not guarantee preservation of all annotations,
forms, tags, or unusual PDF constructs: Ghostscript reconstructs the document.
Use High Quality for fidelity-sensitive publications. Any PDF rewrite can
invalidate an existing digital signature.

Small inputs (under 256 KiB) and compact documents (under 64 KiB per page) skip
Ghostscript compression by default. These are cost-saving heuristics, not proof
that a PDF cannot be compressed. Set either threshold to `0` to disable that
heuristic. qpdf can still run when explicitly enabled. Logs/benchmark callers
can inspect the internal `optimizationReason`, `qpdfStatus`, and
`queueDurationMs`; these do not add database columns or public response fields.

Ghostscript and qpdf are parsers/optimizers, not malware or active-content
sanitizers. Original fallback and qpdf may retain PDF JavaScript, attachments,
or other interactive content. Without qpdf, the bounded trailer encryption
check cannot identify every encrypted incremental-update variant. Continue to
restrict uploads to authorized administrators and keep native tools patched.

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
| `PDF_COMPRESSION_PROFILE` | `ebook` | Named High Quality/Balanced/Maximum profiles or legacy presets, as above |
| `PDF_COMPRESSION_MIN_SAVINGS_PERCENT` | `5` | Minimum reduction required to keep optimized output |
| `PDF_COMPRESSION_FALLBACK` | `original` | `original` or `reject` after validated compression failure |
| `PDF_MAX_PAGE_COUNT` | `1000` | Maximum accepted page count |
| `PDF_PROCESS_TIMEOUT_MS` | `45000` | Timeout for each native command |
| `PDF_PROCESS_TOTAL_TIMEOUT_MS` | `90000` | Total admitted processing deadline, including validation, optional qpdf and hashing; bounded 1-300 seconds |
| `PDF_PROCESSING_MAX_QUEUE` | `8` | Maximum waiting processors, bounded 0-32; overload returns 503 |
| `PDF_PROCESSING_QUEUE_TIMEOUT_MS` | `15000` | Maximum queue wait, bounded 100-60000 ms; timeout returns 503 |
| `PDF_COMPRESSION_MIN_INPUT_KB` | `256` | Skip lossy compression below this size, bounded 0-10240 KiB |
| `PDF_COMPRESSION_MIN_KB_PER_PAGE` | `64` | Skip lossy compression below this byte density, bounded 0-1024 KiB/page |
| `PDF_BALANCED_IMAGE_DPI` | `150` | Balanced color/grayscale target, bounded 120-300 DPI |
| `PDF_MAXIMUM_IMAGE_DPI` | `96` | Maximum color/grayscale target, bounded 72-150 DPI |
| `PDF_BALANCED_JPEG_QFACTOR` | `0.4` | Balanced JPEG quantization factor, bounded 0.05-1; lower means higher fidelity |
| `PDF_MAXIMUM_JPEG_QFACTOR` | `0.76` | Maximum JPEG quantization factor, bounded 0.05-1; affects newly encoded JPEG images |
| `PDF_QPDF_ENABLED` | `false` | Opt in to optional lossless optimization; missing qpdf does not block uploads |
| `PDF_QPDF_PATH` | `qpdf` | Executable name or trusted absolute path |
| `PDF_QPDF_LINEARIZE` | `true` | Request web linearization when qpdf is enabled; accepted only without size regression |
| `PDF_PROCESSING_CONCURRENCY` | `1` | Concurrent processors, bounded to 1–4 |

Only one occupied processing slot is handed to each waiter. Cancelled and
timed-out waiters are removed. Version probes use single-flight caching (30
seconds for success, 5 seconds for failure), so public readiness checks cannot
spawn a native process each time. Cancelling an upload stops waiting for a
shared qpdf probe without cancelling other callers' probe.

The sampled output watchdog can briefly overshoot its byte threshold. Native
heap use is not a hard per-process quota: apply host/container memory and disk
limits for production. Queue admission is process-local, so account for the
number of backend replicas. Heavy work already runs in asynchronous native
children; a durable worker/job architecture would require a separate storage
and job-state design rather than treating an in-memory queue as durable.

## Development

### Upload, cancellation and delivery budgets

`SPECIAL_ISSUE_UPLOAD_CONCURRENCY` defaults to 4 (range 1–16), independently
of native processor concurrency. Admission happens after authentication and
before multipart parsing. `SPECIAL_ISSUE_UPLOAD_TIMEOUT_MS` defaults to
300000 (range 30000–600000). Ordinary requests retain a 30-second receive
budget; PDF uploads have the longer budget. These are receive deadlines, not
promises that a reverse proxy will allow the entire processing request.

Interrupted multipart pipelines close their file handles before deleting
temporary files. Client cancellation propagates through processing and the
Supabase upload transport. Supabase network fetches have a 60-second deadline
per fetch; this is not a single overall SDK retry deadline. Cancellation is
scoped to each operation using AsyncLocalStorage; compensation is allowed to
run after cancellation. This requires Node 20.3+ (`AbortSignal.any`).

Before selecting a beneficial candidate, the processor checks every page's
renderability, page count and extracted searchable text. Text is extracted to
bounded temporary files and hashed as a stream, with whitespace collapsed and
word boundaries preserved. A changed text digest discards the candidate under
the original fallback policy. Extraction failure also discards it. This is
conservative and may reject visually equivalent rewrites; it does not prove
font, color, link, annotation, form or accessibility-tag fidelity. High Quality
avoids Ghostscript reconstruction entirely and permits only optional qpdf
structural optimization.

Development PDF delivery supports ranges, ETag validation and immutable
UUID-object caching. Production uses Supabase delivery directly: confirm its
actual CORS, `Accept-Ranges`, `Content-Range`, `Content-Length`, ETag and cache
headers from the deployed frontend origin. The backend CORS exposure does not
configure the storage origin. Do not use Render's ephemeral filesystem for
permanent production PDFs. Readiness database probes are coalesced and cached
for five seconds; readiness responses remain uncached for clients.

### Reproducible verification

`npm run benchmark:special-issue-pdfs -- --ghostscript=<path> --qpdf=<path>`
creates deterministic text, image and mixed fixtures, runs all named profiles
and the legacy ebook strategy, and writes JSON measurements to
`node_modules/.cache/pdf-benchmark.json`. Add `--include-publication` to inspect
the repository publication. Native tools must already be installed. The
benchmark uses longer diagnostic deadlines than production and retains its
temporary fixtures for visual inspection. It checks qpdf structure, extracted
text and first-page RGB RMSE; a mismatch fails the run.
Use `--publication-only --profiles=balanced --production-budgets` for a
separate sample run using the application's default 45-second command and
90-second job deadlines. This does not override the deployed proxy deadline.

After a production Angular build, run from `backend`:

```sh
node --import tsx src/scripts/verify-special-issue-reader.mjs --build=<browser-build-directory> --pdf=<local-pdf> --output=node_modules/.cache/pdf-browser-verification
```

This Windows harness uses an isolated installed Chrome profile, the actual
reader build and local delivery middleware. It intercepts external API calls
with local fixtures and blocks other external requests. It checks responsive
viewports, real worker rendering, ranges, zoom, navigation, object URL cleanup
and animation-frame cleanup. It does not authenticate against production or
validate Supabase. The PageFlip lifecycle adapter depends on pinned 2.0.7
internals; its installed-engine regression must pass before upgrading.

Install Ghostscript and set `PDF_GHOSTSCRIPT_PATH` if the executable is not on
`PATH`. On Windows this is commonly the full path to `gswin64c.exe`.

If Ghostscript is unavailable, inline JSON and multipart PDF uploads return a
service error. Existing external HTTPS reference requests remain available.
Do not disable content processing in production to accept unvalidated files.

qpdf is optional and is not installed by application startup. Enable it only
after checking `qpdf --version` on the intended host. A missing or unsupported
optional optimizer retains the validated selection. Ghostscript remains the
required parser even in High Quality mode. Native compression, readability,
font fidelity, and image quality need representative PDF checks in addition to
unit tests that exercise routing and failure paths.

## Tool references and licensing

- [Ghostscript pdfwrite and presets](https://ghostscript.readthedocs.io/en/latest/VectorDevices.html)
  documents image controls, JPEG/JPX pass-through, and reconstruction limits.
- [Ghostscript invocation and SAFER](https://ghostscript.readthedocs.io/en/latest/Use.html)
  documents exact path permissions and why raster-buffer tuning does not cap
  vector-device heap use.
- [qpdf CLI](https://qpdf.readthedocs.io/en/stable/cli.html) documents lossless
  stream/object optimization, linearization, encryption inspection, and exit 3
  warnings. No lossy `--optimize-images` or JPEG recompression is requested.
- [qpdf licensing](https://qpdf.readthedocs.io/en/stable/license.html): Apache 2.0.
- [Artifex licensing](https://artifex.com/licensing): Ghostscript is available
  under AGPLv3 or commercial terms. Deployment owners must review the applicable
  license for their distribution/use; invoking the CLI is not a license waiver.

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

The Supabase adapter streams the final bounded artifact from disk using the
installed SDK's Node stream support. Supabase recommends TUS resumable upload
above 6 MB. Moving
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
