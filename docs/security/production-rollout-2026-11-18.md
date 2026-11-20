# Security production rollout — 18 November 2026

The reviewed security fixes are deployed. The user explicitly approved production rollout, selected the Render workspace, and separately approved deletion of the verified public PDF original. Broader security sign-off remains subject to the follow-ups below.

## Deployment record

| Component | Result |
| --- | --- |
| Source | `main`, commit `923e200a10747ce7080fc8700b7b85f67ab1fd1e` |
| Frontend | [Production website](https://paragon-system-gvlg.vercel.app), Angular, Vercel production deployment `dpl_Ep4Xebuvco37hA9DR8SQoHRu3DXZ`, READY; build approximately 61 seconds |
| Backend | [Production API](https://paragon-api-4zfk.onrender.com), Render service `paragon-api`; release deployment `dep-dbuq2mm6711c73atu7gg` live after approximately 86 seconds |
| Final backend configuration | `dep-dbuq52hsrm7s73flbhm0` live after approximately 63 seconds; same source commit; `SPECIAL_ISSUE_MUTATIONS_PAUSED=false`; editorial updates resumed |
| Runtime | Render build logs confirm Node 22.23.5; Vercel project uses Node 24.x |
| Database | Production `paragon-db`; migration `production_security_grants_auth_version` applied successfully through Supabase migration tooling |

Production release completed around 21:06 Asia/Manila. The prior backend instance was confirmed deactivated before copying objects. No live article/publication or applicant status was changed.

## Applied controls

- Revoked browser-role application table privileges; verification found zero public application tables granting the tested privileges to `anon` or `authenticated`. Existing table-owner/backend access remains operational.
- Added the authentication-version column and private-schema trigger. Startup verifies the schema; unversioned database-user tokens require a fresh sign-in. The installed trigger also passed a temporary-table canary inside a rolled-back transaction, with no persistent account changes.
- Configured production database TLS with the Supabase root CA and strict certificate/hostname verification. A direct read-only connection authenticated as `postgres` with BYPASSRLS before migration. The CA was obtained over HTTPS from the established Supabase certificate endpoint; fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
- Merged required API/private-bucket/TLS/runtime configuration into the existing Render environment, preserving unrelated values. Environment-admin authentication is disabled. Credentials were not rotated, printed, or committed.
- Created `paragon-pdfs` as private with a PDF MIME allowlist and 50 MiB bucket cap, plus the restrictive browser-denial policy. Public image storage remains separate.
- Paused all Special Issue admin mutation routes, including admin bypass, during the migration. No worker services or pending cleanup jobs were present in the inspected production deployment. The earlier backend instance was drained/deactivated.
- Copied one existing published PDF, verified its immutable private bytes against stored SHA-256, and switched its reference. Migration reported one success, zero conflicts and zero failures.
- After separate explicit approval, reverified the private copy and removed one public original under reference-table locks. Purge reported one success, zero conflicts and zero failures. The private copy remains retained. Final metadata: one private record, zero legacy records, zero public `special-issues/` objects, zero pending cleanup jobs.

The release also includes the earlier session/realtime revocation, image validation, HTML sanitization, interceptor/frame restrictions and dependency fixes described in the [audit](production-security-audit-2026-11-17.md).

## Validation evidence

| Check | Result |
| --- | --- |
| Backend suite and TypeScript build | 156 tests passed, build passed |
| Frontend suite and production build | 262 tests / 55 files passed, build passed |
| Sharing-preview suite | 16 passed |
| Independent review | Full source access for security review of PDF/session/TLS/cleanup/mutation pause; both newly found TLS/transaction-lifetime defects resolved before release; relevant focused suites independently passed |
| Production API | `/health` and `/ready` returned 200, including the final resumed instance |
| Private API access | All nine inspected unauthenticated GET endpoints returned 401 |
| Frontend headers | Production 200; CSP, HSTS and nosniff present |
| PDF full delivery | 48,216,753 streamed bytes; SHA-256 matches persisted digest; no redirect; no-store response |
| PDF protocol | Range 206 with exact 1,024 bytes and Content-Range; HEAD 200 with exact size; multiple ranges 416; allowed-origin CORS preflight 204 |
| Storage confidentiality | Anonymous public-object URL for private bucket denied with 400; original public URL denied with 400 after deletion |
| Final resumed delivery | Health 200, readiness 200, PDF range 206 |
| Database advisor | No warning/error security findings returned; 17 informational RLS-without-policy notices remain consistent with server-only application access |
| Runtime error scan | No error-level Render log entries returned in the inspected post-release window |

The [RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is intentionally retained for application tables served only through Express; browser privileges are now revoked as well.

## Remaining verification and operational limits

- An authenticated production browser sign-in, password change, session revocation, draft preview and realtime flow was not exercised with a real account. Do not synthesize production account sessions or mutate publication status to simulate this. Users must sign in again after this release.
- MFA is still unavailable in the application. An MFA-capable administrative identity boundary or verified enrollment/challenge/recovery implementation remains an outstanding production control; cloud-account MFA is also unverified.
- Rate limits remain process-local. Shared enforcement is required before horizontal scaling. Backup restoration, external alerting/retention, historical secret scanning and full stored-media privacy inventory remain separate controls.
- The public image bucket still has no bucket-level MIME/size restrictions; application upload validation is deployed. Reconcile intended public media limits before changing that bucket.
- Removed originals are denied in the tested origin response. Already downloaded files and third-party/browser caches cannot be recalled. Authenticated third-party-cookie behavior remains browser-specific verification.
- Supabase staging remained inactive. Isolated PostgreSQL tests, direct production role/TLS verification and a rolled-back production temporary-table canary were used; this is not a complete authenticated staging penetration test.

## Recovery and follow-up

Keep the private bucket, restrictive policy and authentication trigger. The public original was removed only after private checksum verification. If recovery is needed, inspect and verify the retained private object before a separately reviewed restoration; never make the shared bucket private or restore browser grants as a routine rollback.

Prefer a reviewed forward fix. Rolling back to old authentication code removes version enforcement; older database-user tokens must remain invalid under the deployed code. The private-reference migration also requires a private-capable backend. See the [PDF runbook](private-pdf-rollout-2026-11-18.md) and [authentication runbook](authentication-version-rollout-2026-11-18.md).

This report is saved locally as the rollout handoff; the deployed source commit above contains the reviewed implementation and pre-release runbooks. No extra deployment is required for this report.
