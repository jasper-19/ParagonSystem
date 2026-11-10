---
version: 1
slug: "admin-profile"
primary_target: "frontend/ParagonWebApp/src/app/features/admin/profile/admin-profile.html"
related_targets: ["frontend/ParagonWebApp/src/app/features/admin/profile/_profile-foundation.scss", "frontend/ParagonWebApp/src/app/features/admin/profile/components"]
---

# Admin Profile

Mode: Operate. Administrators inspect their staff identity, preview a profile image, review personal/academic assignments, change their password, manage two-factor settings and inspect signed-in devices. Preserve profile refresh/error/stale-data and unlinked-staff recovery, read-only personal details/directory navigation, college-name retry/fallback, local-only avatar preview with PNG/JPEG/WebP and 5 MB checks, password validation/visibility/strength/pending/reset feedback, two-factor status/rollback and session current-device/pending/error/retry safeguards.

Use Segoe UI/Helvetica Neue/Arial with 28px desktop and 25px phone page title, restrained borders/corners, readable controls, compact identity/assignment metadata, flat personal records and consistent security/session sections. Keep navy #000035, honey #F4B400 and existing semantic states. Remove decorative gradients, redundant eyebrows and nested elevated cards. The unused personal edit modal remains unwired and unchanged; staff edits continue through Staff Directory.

No API, schema, auth-service, backend or shared feedback component changes. Avatar FileReader callbacks notify the OnPush view so the existing preview renders immediately. Password strength minimum/copy now match the existing 12-character validator; reused-password and complexity messages have valid descriptive associations and readable checklist contrast. Browser tests use synthetic staff/session data and intercepted account requests only; real credentials, 2FA and sessions are outside this pass.

Validation: 16 focused tests passed across four specs covering profile loading/refresh/error/unlinked/stale-data recovery, avatar MIME/5 MB checks and asynchronous DOM rendering, education mapping/fallback/retry, unused edit-dialog emission contract, password validation/visibility/pending/reset/error behavior, two-factor rollback and session current-device/pending/retry safeguards. Two fixture issues (router provider and OnPush event activation) were corrected; the affected ten-test rerun passed. Final production build passed with existing Quill-delta/page-flip CommonJS warnings. Independent code and security reviews found no introduced actionable issues; scoped diff check passed.

Synthetic browser checks passed at 320, 390, 768, 1024, 1280 and 1440px. Inspected overview/personal/password/two-factor/session sections at phone and desktop widths with long values. Exercised password validation and visibility, rejected avatar MIME and rendered a valid local preview, simulated two-factor success/failure rollback, simulated other-device sign-out success/failure, retained profile on failed refresh, academic/session load retry, loading and unlinked-staff recovery with security controls retained. No horizontal page overflow or runtime exceptions occurred. All four account-action requests were fulfilled by local synthetic fixtures; no real password, two-factor, session, profile or upload changes occurred. Backend authorization, production account state and full screen-reader/forced-contrast behavior were not exercised.
