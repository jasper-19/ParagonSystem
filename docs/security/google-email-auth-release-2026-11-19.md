# Google login and Gmail verification production release

Released on 2026-11-19 following the owner's explicit approval for production
secrets, the authentication migration, the feature push, both deployments, and
one test-code email to the selected sender account.

## Released source and services

- Commit: `a64f9a02c018d9171b4e19b4c2e4a105d002c7d9` on `main`.
- Render: `paragon-api` in My Workspace; deploy `dep-dbvflmgu01pc73dnf8sg`
  reached `live` on the released commit.
- Vercel: `paragon-system-gvlg`; deployment `dpl_GyMDQibn44gWkSwYcKtNNTRdzTwD`
  reached `READY` and was assigned the production aliases.
- Production login: https://paragon-system-gvlg.vercel.app/admin/login
- Supabase: `paragon-db`, project `jymekuhvtvokfimzxjsl`.

## Configuration and schema

Applied the authentication-specific portion of `migrate.security.sql` through
the named migration `paragon_google_email_login`. Existing public-table RLS
configuration was not changed by this release. Verified all four private auth
tables, the authentication-version trigger's 2FA coverage, and the staff-email
identity revocation trigger. Browser database roles cannot access the private
tables. No staff email, account preference, role, or publication status was changed.

Merged the eight Google/challenge/HTTPS-relay settings into Render without
replacing its other configuration. Added the four server-only relay variables to
the Vercel Production environment; the relay secret and Gmail app password use
sensitive storage. Credential values were not displayed or committed. Dedicated
challenge and relay secrets are separate from each other and existing JWT keys.

## Verification evidence

Before release: 165 backend tests passed, one opt-in database test skipped;
the database integration suite was run separately with 12 passes. All 20 Vercel
server tests passed; both production builds passed. Earlier targeted Angular
login/service/security-setting tests passed (16 tests).

Live checks passed:

- Backend health and frontend login returned HTTP 200.
- OAuth startup returned a Google authorization URL with the configured client,
  exact backend redirect and PKCE S256.
- Production pending-login cookies use the `__Host-` prefix, HttpOnly, Secure,
  and SameSite=None. The smoke-test pending challenge was cancelled.
- Untrusted OAuth origins and unsigned relay requests returned HTTP 403.
- The production lazy-loaded login bundle contains Continue with Google and
  excludes Continue with Facebook.
- One test-code email was accepted by Gmail SMTP through the Vercel HTTPS relay.
  It was a delivery test, not an active account's login code. Inbox placement
  was not independently inspected.
- Reusing the same signed delivery returned HTTP 409 and did not send twice.

The smoke-test script initially expected a development cookie name and searched
the main bundle for a lazy-loaded component. Those test assumptions were corrected;
no production code change was needed. Both deployments use the original release
commit above.

Independent reviewers assessed supplied implementation/protocol excerpts; their
sessions lacked repository tools. This was not a full independent repository audit.

## Owner browser check

The owner must complete Google consent and first-time linking in their browser.
Choose the Gmail registered on the staff profile, then confirm the existing
PARAGON username and password. Enable email verification under Profile > Security.
With it enabled, both password and Google login require the emailed six-digit code.
No account preference was mass-enabled during deployment.

The real Google authorization-code exchange, first account link, and browser
third-party-cookie behavior have not been exercised by the deployment smoke test.
The local Google, account-linking and OTP tests cover their server-side behavior.

## Recovery and rollback

Prior Render deployment: `dep-dbvfk6d6e07s73bm94bg` on `923e200`.
Prior Vercel production deployment: `dpl_Ep4Xebuvco37hA9DR8SQoHRu3DXZ`.
Do not roll back to the older API once accounts use real email verification:
that version did not enforce this flow. Prefer fixing forward or restricting
sign-in while repairing the provider. A code rollback does not reverse the
schema or external email sends. Never remove the private tables to bypass an
email delivery problem. The current shared secrets can be rotated through a
coordinated release; the Gmail app password can be revoked and replaced by its
account owner.
