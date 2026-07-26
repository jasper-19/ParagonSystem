# Security Policy

## Deployment requirements

- Run the backend with Node.js 20 and `NODE_ENV=production`.
- Use unique HTTPS origins for the frontend and API. Prefer sibling custom domains and set `AUTH_COOKIE_SAME_SITE=lax`; use `none` only while the frontend and API remain cross-site.
- Generate `JWT_SECRET` from at least 32 cryptographically random bytes and rotate it after any suspected exposure.
- Keep `ALLOW_ENV_ADMIN=false` in production. Provision database-backed administrators instead.
- Keep PostgreSQL certificate verification enabled. Set `DB_SSL_REJECT_UNAUTHORIZED=false` only for a documented private CA exception.
- Store database and Supabase credentials only in the hosting provider's encrypted secret manager.
- Restrict the Supabase service-role key to the backend. Never expose it through Angular environment files.
- Enable a managed WAF, DDoS protection, centralized rate limiting, alerting, encrypted backups, and point-in-time database recovery.

## Authentication

Browser sessions use Secure, HttpOnly cookies. Unsafe cookie-authenticated requests require an exact allowed origin and the `X-CSRF-Protection` header. Administrative APIs enforce the `admin` role server-side.

The existing two-factor preference is intentionally prevented from being enabled because it did not perform a real second-factor challenge. Do not advertise 2FA until TOTP or WebAuthn enrollment, recovery codes, and login verification are implemented.

## File handling

Uploads use MIME allowlists, generated object names, size limits, image re-encoding, pixel limits, and file-signature checks. Production deployments should additionally scan PDFs, audio, and video with malware scanning or content-disarm-and-reconstruct before publication.

## Continuous assurance

- CodeQL runs on pushes, pull requests, and weekly.
- Dependency Review blocks vulnerable dependency additions in pull requests.
- Dependabot monitors backend, frontend, and GitHub Actions dependencies.
- Run current dependency audits and application penetration tests before each production release.

## Reporting

Report suspected vulnerabilities privately to the repository owner. Include affected endpoints, reproduction steps, impact, and any relevant logs without including credentials or personal data.
