# Google sign-in and Gmail verification

PARAGON retains its Express authentication and HttpOnly session cookies. Google
sign-in is an additional way for an existing staff account to sign in. It never
creates users or grants roles. Email verification can be enabled in Profile →
Security settings after Google linking.

## Configuration

Before enabling this feature in a deployment:

1. Apply the updated `backend/src/config/migrate.security.sql` using the existing
   migration runner in staging first. It adds server-only Google identities,
   expiring login challenges and delivery/attempt limits in `paragon_internal`, updates
   the account-version trigger, and adds a staff email-change trigger. The API
   database role must own/access these objects and execute their invoker triggers.
   No browser Supabase grants or RLS policies are needed for these private tables.
   Startup checks require these tables and the updated triggers before serving traffic.
2. Create a Google OAuth **Web application** client. Register the exact backend
   callback `https://<api-host>/api/auth/google/callback` as an authorized redirect
   URI. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`
   on the backend. `FRONTEND_URL` must be the fixed frontend origin. The callback
   always returns to that origin's `/admin/login`; it does not accept a user-supplied
   redirect destination. Local development may use HTTP on localhost.
3. Configure a separate random `AUTH_CHALLENGE_SECRET` of at least 32 bytes.
   On hosts that allow SMTP, configure `AUTH_SMTP_HOST`, `AUTH_SMTP_PORT`, `AUTH_SMTP_USER`,
   `AUTH_SMTP_PASSWORD`, and `AUTH_EMAIL_FROM`. SMTP requires TLS: port 465 or
   STARTTLS on 587. Use an authorized sender at your SMTP provider. A Gmail sender
   may require an app password according to the Google account's policy; do not
   use the sender's normal account password. Delivery can use any SMTP provider;
   recipients in this flow are linked Gmail addresses.
   **Render free blocks SMTP ports.** Use the HTTPS Gmail relay described below
   for the existing production service; do not configure direct SMTP there.
4. For the Vercel/Render cross-site setup, session and pending-login cookies need
   `AUTH_COOKIE_SAME_SITE=none` and HTTPS. Local localhost development can use
   `lax`. `strict` prevents the OAuth browser return from carrying its state cookie.
   Browsers that block third-party cookies may require frontend/API custom domains
   under the same site, as with the existing session-cookie flow.
5. Keep `ALLOW_ENV_ADMIN=false` in production. The existing explicitly enabled
   environment administrator is a separate recovery account with no DB-backed
   Google identity or email 2FA preference. It is not covered by this feature.

No production migration, environment changes, or deployment is authorized by a
local test. Obtain the project's required approval before those release actions.
Never put the Google client secret, SMTP credentials or challenge secret in the
Angular environment files or browser storage.

## Staff flow

1. Choose **Continue with Google** at login and choose the Gmail address registered
   on the staff profile. Only verified `@gmail.com` accounts are accepted by this
   Gmail-specific feature. Workspace and third-party Google-account email domains
   are not accepted.
2. On first use, confirm the existing PARAGON username and password. Both accounts
   must have the exact same normalized Gmail address. Google `sub`, rather than
   email, becomes the persisted identity. Existing links cannot be silently replaced.
3. Enable email verification under Profile → Security within five minutes of signing
   in. Changing the setting signs out existing sessions and requires a new login.
4. With verification enabled, both password and Google sign-in send a six-digit
   code to the linked Gmail mailbox. No session is created until the code succeeds.
   Codes expire after five minutes. Pending login expires after ten minutes.
   Five wrong attempts exhaust the pending challenge; resending does not reset that
   budget. Resends replace the previous code and are limited to one email per minute
   and five emails per account per fifteen minutes, enforced in PostgreSQL.
   Password login and Google linking share a ten-attempt account budget per fifteen
   minutes, plus a fifty-attempt network budget. Code verification has an aggregate
   ten-attempt account budget per fifteen minutes across fresh challenges.

Changing the staff email unlinks Google, revokes sessions, advances the account
version, and invalidates pending challenges. The user must link the new registered
Gmail through Google plus their PARAGON password. Email delivery failures do not
issue a session. An unavailable mail provider prevents email-protected logins;
restore provider access before attempting recovery. Email verification after Google
sign-in uses the same Google mailbox and does not establish independent Google MFA.

## API contract

- `POST /api/auth/login {username,password}` → `{ok:true}` or
  `{twoFactorRequired:true,maskedEmail}`.
- `POST /api/auth/google/start {}` → `{authorizationUrl}`; the browser follows it.
- `GET /api/auth/google/callback` → fixed frontend status redirect after OAuth.
- `POST /api/auth/google/link {username,password}` → normal login result.
- `GET /api/auth/login/challenge` → `{kind:'email'|'google-link',maskedEmail}`, or 404.
- `POST /api/auth/2fa/verify {code}` → `{ok:true}` after one-time consumption.
- `POST /api/auth/2fa/resend {}` → `{maskedEmail}`; 429 on delivery limits.
- `POST /api/auth/login/cancel {}` → `{ok:true}`; deletes browser's pending challenge.
- `PATCH /api/auth/2fa {enabled}` → `{twoFaEnabled,reauthenticationRequired:true}`.

Mutation endpoints require the existing trusted Origin and CSRF header. Pending
OAuth/link/code credentials are held in a random HttpOnly cookie whose hash is the
database key. Codes are HMACed with the separate server secret and challenge ID.
OAuth uses state, nonce, PKCE and the Google library's ID-token verification.

## Verification

Run from `backend`:

```powershell
npx.cmd tsc --noEmit
node --import tsx --test src/modules/auth/google-email-login.test.ts src/security/session-security.test.ts src/security/http-security.test.ts
$env:AUTH_LOCAL_DB_TESTS='1'
node --import tsx --test src/modules/auth/email-login.integration.test.ts
```

The integration suite refuses production or non-loopback DB hosts. It uses random
schemas in one rolled-back local transaction and mocks Google and SMTP, so it
does not send real email or change application tables. It verifies the migration,
HTTP flow, cookie boundaries, challenge expiry/replay/limits, and revocation.
Google unit tests validate real signed JWTs against a local fixture certificate.

Run the login/service/profile tests and production build from `frontend/ParagonWebApp`.
Before release, use test staff accounts in staging to verify the real consent screen,
Gmail delivery, resend, expired/wrong codes, account linking, email changes, and
session invalidation. Those live-provider checks require configured credentials and
have not been replaced by the mocked local tests.

Protocol references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[Google server verification](https://developers.google.com/identity/sign-in/web/backend-auth),
and [Nodemailer SMTP](https://nodemailer.com/smtp).

## Existing free Render/Vercel setup

Confirmed target: Render `paragon-api` (`srv-d8p5uqernols73f6oa30`) in My Workspace;
Supabase `paragon-db` (`jymekuhvtvokfimzxjsl`); Vercel `paragon-system-gvlg`.
The sender selected by the owner is `jarez1912@gmail.com`. No purchased domain
is required for Gmail SMTP from Vercel. Gmail account sending limits still apply.

Owner steps in [Google Cloud](https://console.cloud.google.com/auth/clients):

1. Select or create a project named PARAGON. Open Google Auth Platform and configure
   Branding with the PARAGON name and your support/developer email.
2. Set Audience to External. While Testing, add the Gmail addresses that need to
   test sign-in as test users. Request only `openid` and `email` under Data Access.
3. Under Clients, create a **Web application** client named PARAGON Web.
   JavaScript origin: `https://paragon-system-gvlg.vercel.app`.
   Authorized redirect URI (exact):
   `https://paragon-api-4zfk.onrender.com/api/auth/google/callback`.
4. Copy the client ID and client secret to the private setup file described below;
   never paste the secret into chat. Do not enable the Gmail API or request Gmail
   mailbox scopes for this basic sign-in flow.
5. Sign in to the sender Gmail account, enable Google 2-Step Verification, and
   create an app password named PARAGON mail at
   [App Passwords](https://myaccount.google.com/apppasswords). This option may be
   unavailable under some account security or organization policies. Copy that
   app password, without display spaces, to the private setup file.

Local private handoff: `.tmp/paragon-auth-setup.json` is ignored by Git. Fill
`googleClientId`, `googleClientSecret`, and `gmailAppPassword`, preserving valid JSON.
It contains no generated production secrets initially. Tell the coordinator when
it is ready; never print its contents. Delete the local credential copy after
the approved live configuration is verified. Treat a downloaded Google client
JSON with the same care.

After credentials are ready, obtain explicit approval for the production migration,
secret changes, push and deployments. Configure these **server-only** values:

| Environment | Variable | Value |
| --- | --- | --- |
| Render | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Owner's web client |
| Render | `GOOGLE_CALLBACK_URL` | `https://paragon-api-4zfk.onrender.com/api/auth/google/callback` |
| Render | `FRONTEND_URL` | `https://paragon-system-gvlg.vercel.app` |
| Render | `AUTH_COOKIE_SAME_SITE` | `none` |
| Render | `AUTH_CHALLENGE_SECRET` | New random secret, at least 32 bytes |
| Render | `AUTH_MAIL_RELAY_URL` | `https://paragon-system-gvlg.vercel.app/api/auth-mail` |
| Both | `AUTH_MAIL_RELAY_SECRET` | Separate new random secret, at least 32 bytes |
| Vercel | `AUTH_MAIL_CLAIM_URL` | `https://paragon-api-4zfk.onrender.com/api/auth/mail-relay/claim` |
| Vercel | `AUTH_GMAIL_USER` | `jarez1912@gmail.com` |
| Vercel | `AUTH_GMAIL_APP_PASSWORD` | Owner's Gmail app password |

Merge Render environment keys without replacing existing configuration. Scope
Vercel credentials to this project's Production environment. Use secret/sensitive
storage and do not expose them through Angular environment files. Ensure request
body capture is disabled in any external tracing or error-reporting integration.

The relay accepts only server-signed Gmail code deliveries. Its HMAC is bound to
the exact base64url payload with a dedicated protocol prefix. Envelopes expire
after 60 seconds (five seconds of future clock skew allowed). It rejects browser
Origin/Cookie headers and reads at most 2 KiB. Before sending, it calls
`POST /api/auth/mail-relay/claim` with the signed envelope. This endpoint atomically
reserves the nonce once in the private PostgreSQL attempt-limit table, preventing
concurrent/replayed sends across serverless instances. It accepts no session
credentials and exposes no browser CORS workflow. No additional schema is needed
beyond this feature's existing security migration. A claimed nonce stays consumed
if SMTP fails; a later login/resend generates a fresh nonce under the account's
existing email limits. Never retry the same envelope automatically.

Deploy the schema and compatible backend before the relay, then verify delivery
with a test staff account before enabling that account's email verification.
Do not mass-enable 2FA preferences. The feature is not live until both services
and credentials are deployed and the actual Google/Gmail browser flow passes.

To rotate, replace the shared relay secret on both services during a coordinated
release; pending requests fail closed. Rotate the separate challenge secret only
with awareness that pending codes become invalid. Revoke the Gmail app password
when replacing it. Never reuse a JWT or Google client secret as either HMAC key.

References: [Render free restrictions](https://render.com/docs/free),
[Vercel SMTP support](https://vercel.com/kb/guide/serverless-functions-and-smtp),
[Google app passwords](https://support.google.com/accounts/answer/185833).

## Local handoff — 2026-11-18

Free-hosting setup follow-up: added the signed Vercel Gmail relay, HTTPS backend
transport, durable one-use delivery claim endpoint, a 2 KiB request parser limit,
and server-only environment examples. The relay adds no further database objects.
The local PostgreSQL suite now passes 12 tests (including concurrent authenticated
relay claims); backend relay unit tests pass 3; Vercel server tests pass 20,
including 4 relay tests. Both production builds pass. The Google signature-negative
fixture was corrected to change decoded signature bytes instead of potentially
unused base64url padding bits; its 5-test suite passes. The final backend suite
passed 165 tests with one opt-in database test skipped (run separately above),
using `tsx --test --test-concurrency=1 src/**/*.test.ts`. The concurrent default
run was stopped when local resource contention made progress slow. Backend build
and `git diff --check` passed after the final changes.

Code, security and QA reviewers assessed the supplied relay protocol without
repository access. No concrete unresolved defect was reported. Real Gmail
authentication, delivery, Google consent and browser cookie behavior remain
unverified until owner credentials and an approved deployment are available.
The following counts describe the earlier implementation baseline.

- Backend `npm.cmd test`: 162 passed, one skipped (the opt-in local DB suite).
- Opt-in local PostgreSQL integration suite: 11 passed, including its ten workflow
  subtests. Fixture schemas and data were rolled back. Queries in this fixture are
  serialized on one connection; a multi-instance load test has not been performed.
- Frontend targeted login, auth-service, and profile-security tests: 16 passed.
- Frontend production build and backend TypeScript build passed. The backend build
  used `--outDir dist/auth-feature-check` because existing generated output files
  denied overwrite. Frontend retains existing Quill/page-flip CommonJS warnings.
- `verify:security-policies` passed using an isolated PGlite 0.5.16 runtime in the
  ignored `.tmp/auth-security-validation` directory. It verifies migration
  idempotence, browser grants, backend-owner updates and version invalidation
  including 2FA preference changes. `git diff --check` passed.
- Independent code/security/QA agents reviewed supplied implementation excerpts and
  coverage reports because their sessions lacked repository tools. Their shared
  rate-limit concerns were addressed and locally tested. This was not a full
  independent repository inspection. Real-provider staging verification and a
  browser check on the actual frontend/API domains remain release requirements.

Changed areas: Angular login/service/security settings; Express auth controllers,
routes, session-completion and challenge/identity services; user authentication and
session revocation; security migration and startup readiness; pinned Google/SMTP
dependencies; authentication tests and this setup guide. Existing unrelated
security rollout documentation edits were preserved. No production migration,
secret change, push, or deployment was performed.
