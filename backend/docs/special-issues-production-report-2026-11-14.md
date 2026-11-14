# Special Issues engineering report — 14 November 2026

The implementation improves upload admission and cancellation, validates PDF
content before storage, adds conservative compression profiles, and reduces
reader work. It is prepared for review; production infrastructure, objects,
database records, secrets and deployments were not changed.

## A. Technical audit

The application uses Angular standalone components, PDF.js and PageFlip in the
frontend, Express 5/Node in the backend, PostgreSQL metadata and a storage
adapter. Production storage uses Supabase; local storage is for development.
Existing multipart creation/replacement, inline-PDF migration, metadata,
optimistic replacement and compensating storage cleanup were retained.

| Finding | Severity / impact | Root cause and resolution |
|---|---|---|
| Uploads can exceed the ordinary request receive budget | High: interrupted legitimate uploads | Separate bounded multipart receive deadline and upload admission; retain ordinary request deadline |
| Cancellation can leave a disk write or storage request running | High: wasted resources and cleanup races | Await pipeline closure before unlink; propagate operation-scoped cancellation to storage fetches |
| Native queue/output limits need stronger bounds | High: resource exhaustion | Finite waiters, queue deadlines, total job deadline, combined stdout/stderr limit and generated-file watchdog |
| Page-count validation alone misses damaged content | High: unreadable saved publication | Interpret every page of the original and selected candidates |
| Sample publication changes extracted ligatures after reconstruction | High: searchable content regression | Streamed normalized-text digest comparison rejects changed candidates and retains the validated original |
| Recompressing small/compact files wastes CPU | Medium: unnecessary latency | Adaptive size/density skip and explicit quality profiles |
| Reader fetch/render work delays visible content | Medium: extra transfer and memory | Range loading, visible pages first, bounded rendering and delayed nearby prefetch |
| PageFlip retains an animation loop after teardown | Medium: ongoing background work | Instance-local lifecycle adapter with installed-engine regression; dependency pinned to 2.0.7 |
| Repeated readiness checks repeat work | Medium: process/DB load | Single-flight native probes and cached/coalesced database probe |
| Admin loader masks real upload stages | Medium: misleading progress | Byte progress followed by processing/saving stages and final persisted result |

## B. Implemented changes

Backend changes are in `src/config/pdf*`, `config/special-issue-upload.ts`,
`middlewares/request-receive-deadline.ts`, `modules/special-issues/`,
`storage/`, `utils/cached-probe*`, `app.ts`, `server.ts` and the two verification
scripts under `src/scripts/`. Tests cover the corresponding boundaries.

Frontend changes are in the Special Issues service/model, admin create/list
components, reader and its render queue/lifecycle helpers. An HttpContext flag
allows upload progress to remain visible without changing request headers.
Save subscriptions cancel on component destruction. Reader zoom is 100–300%,
with bounded raster dimensions, page-image eviction and object URL cleanup.
The Vitest runner uses one worker to avoid exhausting small CI hosts.

No endpoint payload, database schema, migration or new runtime package is
introduced. Optional diagnostic fields are internal processing/log metadata.
Existing authentication, authorization, publication status rules and public
URL storage contracts remain in effect. Public draft file confidentiality
requires a separate private-storage/signed-URL design.

Candidate selection requires a meaningful size reduction, page parity,
whole-document renderability and normalized extracted-text parity. qpdf is
optional and its warning exits discard the candidate. High Quality skips
Ghostscript reconstruction; Balanced uses 150 dpi and Maximum 96 dpi with
bounded JPEG parameters. The legacy ebook default remains compatible.

## C. PDF optimization results

Measurements and methodology are recorded in
[PDF results](special-issues-pdf-results-2026-11-14.json) and
[reader results](special-issues-reader-results-2026-11-14.json).
These are deterministic synthetic text, RGB gradient/noise and mixed fixtures,
plus the repository's 142-page publication. They are not a representative
photographic corpus or a guarantee of font, annotation or color fidelity.
The baseline profile emulates the legacy ebook strategy with current safety
validation; it is not a historical production timing measurement. Native
versions: Ghostscript 10.08.0, qpdf 12.4.2, Node 22.13.0 on this Windows host.

Balanced profile with optional qpdf enabled, one run per fixture:

| PDF type | Original size | Selected size | Reduction | Processing time | First-page RGB RMSE |
|---|---:|---:|---:|---:|---:|
| Text-heavy, 8 pages | 31,880 B | 5,116 B | 83.95% | 3,122.02 ms | 0 |
| Image-heavy, 4 pages | 12,962,183 B | 1,011,536 B | 92.20% | 7,287.16 ms | 4.3438 |
| Mixed-content, 4 pages | 12,966,575 B | 1,012,693 B | 92.19% | 7,044.75 ms | 7.6530 |

The text fixture skipped Ghostscript and used qpdf only. qpdf checks, page
counts and normalized extracted text passed for all selected synthetic
outputs. Image-only text extraction is empty and cannot establish image
fidelity. RMSE is over the first page rendered at 72 dpi; it is a numerical
comparison, not a perceptual quality threshold. Host caches may be warm and
an isolated historical Angular build ran concurrently for part of this run.

| Profile | Image-heavy selected bytes | Reduction | First-page RMSE |
|---|---:|---:|---:|
| Legacy ebook strategy | 516,734 | 96.01% | 5.2831 |
| High Quality + qpdf | 10,778,873 | 16.84% | 0 |
| Balanced + qpdf | 1,011,536 | 92.20% | 4.3438 |
| Maximum + qpdf | 103,972 | 99.20% | 6.0845 |

Balanced retained more image detail at a larger size than ebook in this
fixture. High Quality had no first-page pixel difference; Maximum traded more
detail for size. These results do not support a general speedup claim.

The 48,216,718-byte repository publication retained all 142 pages and its
original bytes in every profile:

| Profile | Selected bytes | Reduction | Processing time | Result |
|---|---:|---:|---:|---|
| Legacy ebook strategy | 48,216,718 | 0% | 18,947.86 ms | Compression fallback |
| High Quality + qpdf | 48,216,718 | 0% | 28,756.89 ms | Optional qpdf candidate failed checks |
| Balanced + qpdf | 48,216,718 | 0% | 161,172.59 ms | Changed searchable text rejected |
| Maximum + qpdf | 48,216,718 | 0% | 77,124.83 ms | Changed searchable text rejected |

This diagnostic run used 120-second command and 300-second job deadlines.
Balanced exceeds the production default 90-second job budget in this run;
the default 45-second command budget can also stop reconstruction earlier.
Do not extrapolate diagnostic completion to deployed request acceptance.
A separate final Balanced run with the default 45-second command and
90-second job budgets completed in **81,885.62 ms**, retaining the original
after rejecting changed text. That run had no concurrent historical build.
It confirms bounded fallback on this host, with limited deadline headroom;
it does not establish the same outcome on the deployed backend.

A preliminary run found that a smaller reconstructed repository publication
changed ligatures into control characters. Its candidate was rejected after
adding the text-preservation gate. The original also has pre-existing qpdf
hint-table/stream warnings; retaining it is not reported as successful repair.
Byte savings alone do not authorize publishing a rewritten publication.

## D. Upload and reader performance

Real multipart receive, interrupted socket and cleanup behavior were exercised
locally. End-to-end production upload throughput and Supabase upload latency
were not measured; there is no supported before/after upload-speed claim.
Native processing timings include safety validation and optional optimization.

The browser harness served the actual production Angular build and a
12,962,183-byte, four-page synthetic PDF over localhost. Chrome
157.0.8103.52 used an isolated profile. External API calls were fulfilled from
local fixtures before network access; other external requests were blocked.
An archived HEAD frontend build stalled in both restricted and elevated local
attempts and was stopped. A historical browser comparison was therefore not
completed; these measurements establish current behavior, not a measured
before/after reader speedup.

| Viewport | First visible page | Server-written bytes at first page | JS heap snapshot | Object URLs created/revoked | RAFs after exit |
|---|---:|---:|---:|---:|---:|
| Desktop 1440×1000, cold browser cache | 3,266 ms | 5,622,151 | 5,966,020 B | 6 / 6 | 0 |
| Tablet 768×1024, warm cache | 1,252 ms | 391 | 9,490,836 B | 6 / 6 | 0 |
| Mobile 390×844, warm cache | 787 ms | 0 | 9,948,408 B | 5 / 5 | 0 |

These are viewport emulations in one browser, not physical-device/network
benchmarks. Server-written bytes can include buffers from an initial cancelled
200 response. Subsequent page navigation still fetches needed content. Heap
snapshots are not peak native/canvas/worker memory or a long-session leak proof.
The checks verified actual 206 responses and Content-Range, real PDF worker
rendering, page navigation, zoom/reset, no horizontal document overflow and
URL/animation cleanup. Screenshots and detailed request logs are retained in
ignored local verification output.

Local storage survives adapter recreation and refuses overwrite when
`upsert=false`; range, ETag/304 and 416 behavior passed integration tests.
This does not establish persistence through a production restart or Supabase
CDN behavior.

## E. Testing results

| Check | Result |
|---|---|
| Backend full suite after final changes | 77/77 passed; 13.55 seconds |
| Processor after final whitespace-boundary normalization | 23/23 passed within the complete run |
| Backend TypeScript production emit | Passed to an isolated cache output directory |
| Frontend production build | Passed; 1.28 MB initial output, existing PageFlip/quill-delta CommonJS warnings |
| Frontend full suite | 167/170 assertions passed; 36/39 files passed |
| Production-build browser checks | Desktop, tablet and mobile checks passed |
| Native benchmark | All 16 fixture/profile selections passed the final validation; the real publication safely retained its warning-bearing original |
| Default-budget sample check | Balanced completed in 81.89 seconds, with original fallback and preserved text/pages |
| Whitespace check | `git diff --check` passed; repository line-ending notices only |

All Special Issues frontend tests passed in the complete run. The three
failures are untouched scaffold tests: App expects a stale greeting; Home
and Footer omit ActivatedRoute providers. Home also attempts unavailable
localhost API/socket requests. These are reported rather than changing
unrelated features to obtain a green suite.

Independent QA and security review were invoked during implementation.
The final independent code review covered supplied source excerpts, without
repository execution. Its receive-timeout socket finding was fixed and
covered by a real incomplete chunked-upload 408 test. Its text-normalization
observation was addressed by preserving word boundaries across stream chunks.
No unresolved blocker was identified within that review scope.

No live database, account, storage or deployment lifecycle was exercised.
Production upload/create/replace/delete/restart smoke checks, cross-origin
Supabase ranges, deployed proxy deadlines and a broad visual publication
review remain release prerequisites. The native diagnostic benchmark uses
longer deadlines than production; its largest fixture does not establish
that the production 90-second budget suffices on a Render instance.

Reproduction commands (run within the corresponding package directory):

```sh
# backend
node node_modules/tsx/dist/cli.mjs --test src/**/*.test.ts
node node_modules/typescript/bin/tsc --outDir node_modules/.cache/pdf-production-build
npm run benchmark:special-issue-pdfs -- --ghostscript=<path> --qpdf=<path> --include-publication
# frontend; NG_BUILD_MAX_WORKERS=2 was set for local builds
node node_modules/@angular/cli/bin/ng.js test --watch=false
node node_modules/@angular/cli/bin/ng.js build --output-path node_modules/.cache/pdf-production-build
```

The packages expose no separate lint script. The default backend `dist` output
was not usable in this workspace, so compilation emitted to the isolated path
shown above; no existing build output was deleted to bypass permissions.

## F. Deployment considerations

See `special-issues-pdf-processing.md` for the complete configuration table
and run commands. New settings include `PDF_PROCESS_TOTAL_TIMEOUT_MS`,
`PDF_PROCESSING_MAX_QUEUE`, `PDF_PROCESSING_QUEUE_TIMEOUT_MS`,
`PDF_COMPRESSION_MIN_INPUT_KB`, `PDF_COMPRESSION_MIN_KB_PER_PAGE`,
`PDF_BALANCED_IMAGE_DPI`, `PDF_MAXIMUM_IMAGE_DPI`,
`PDF_BALANCED_JPEG_QFACTOR`, `PDF_MAXIMUM_JPEG_QFACTOR`,
`PDF_QPDF_ENABLED`, `PDF_QPDF_PATH`, `PDF_QPDF_LINEARIZE`,
`SPECIAL_ISSUE_UPLOAD_CONCURRENCY` and `SPECIAL_ISSUE_UPLOAD_TIMEOUT_MS`.
Defaults preserve ebook compatibility and leave optional qpdf disabled.

Use a supported patched Node runtime compatible with the project; the code
requires Node 20.3+ for AbortSignal.any. Verify the release runtime separately:
the backend currently declares Node 20.x, whereas local measurements and tests
used Node 22.13.0. Keep Ghostscript patched and verify
its actual executable/readiness on the target host. qpdf is optional. Native
tools downloaded for testing were checksum-verified, extracted locally and
not installed system-wide. No startup package manager or shell interpolation
is used. Review Ghostscript AGPL/commercial licensing and qpdf Apache 2.0
before distribution; official references are in the processing guide.

Store production artifacts in persistent object storage, not ephemeral
backend disk. Allocate bounded temporary disk and host/container memory:
the sampled generated-file limit can overshoot briefly and native heap has no
hard per-process quota. Concurrency/queue limits are per backend process.
The 60-second storage timeout applies per fetch rather than across SDK retries.
Ensure ingress deadlines accommodate receive, queue, processing and storage.

Safe release sequence, requiring separate approval: review this diff; run
the listed checks in the release environment; verify existing metadata schema;
verify native tools and storage readiness; deploy a preview/staging backend
and frontend; test authenticated create/replacement/cancellation/deletion and
storage persistence with disposable data; inspect representative publications
at zoom and printing; then approve production release. This change adds no
migration; the older multipart feature's existing migration must already be
present. Do not run legacy conversion or cleanup apply modes implicitly.

Rollback uses the prior frontend/backend revision and previous environment
settings. Existing metadata and immutable URLs are compatible. Rollback does
not reverse publication mutations or remove stored artifacts; do not delete
objects or schema as part of an application rollback.

## G. Remaining recommendations

1. Validate a representative publication corpus, including embedded fonts,
   photographs, thin vectors, small text, color, links, tags and annotations.
   Text/render checks cannot prove all of these properties.
2. Measure real Supabase delivery, upload time, proxy limits and restart
   persistence in staging before changing the default compression profile.
3. Evaluate TUS/S3 multipart for larger storage transfers. No resumable
   upload dependency or new service was added to this bounded request flow.
4. Introduce durable jobs only with a reviewed job-state/storage contract if
   real workloads exceed request deadlines. The current queue is bounded and
   process-local; a crash requires retry. Storage compensation cannot make a
   process crash between object upload and metadata commit atomic.
5. Address unrelated scaffold failures separately, keep the PageFlip adapter
   regression when upgrading, and monitor processing reason, queue delay,
   storage latency, failures and cleanup retries without logging PDF content.
