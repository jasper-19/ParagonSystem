# PARAGON production readiness audit

Audit date: 2026-11-23. Repository: `main`, commit `4d0e3f7c942c7f0a913917f4798d8bc756e430dd`, with pre-existing uncommitted changes. This is a scoped, evidence-based repository review, not a certification or proof that every workflow or control was exercised. Existing changes were preserved. Independent security, functional, QA and operations reviews informed this report.

## Executive summary

**Verdict: NOT READY.** Article updates have a code-level partial-update integrity defect and a connection-pool exhaustion scenario that can report failure after a write has committed. The repository's security workflow does not run application build or test gates. Other findings concern publication dates, upload and request memory pressure, database locking, accessibility and incomplete public links. Conditional authentication and media exposure risks require production configuration and policy verification. No critical finding was established by the available evidence.

The review used the existing Graphify index followed by targeted source inspection. The only executed test reported here is `node --test server/article-preview.test.mjs` from `frontend/ParagonWebApp`: 13 passed, 0 failed, 0 skipped. It covers mocked preview cases, not deployed crawler behavior. No production resources, configuration, application code, databases, dependencies, or deployments were changed. Full test suites, dependency vulnerability scanning, live penetration testing, load testing, browser accessibility testing, and production infrastructure inspection were not performed. All modules and integrations were considered as audit scope; this does not mean each was exhaustively examined or functionally verified.

## Weighted assessment

The 12 weights total 100. Points are conservative evidence credits for controls actually observed, not inferred compliance; unassessed criteria earn zero. This incomplete evidence produces **21/100 evidenced points**, not a measured defect rate or an estimate of eventual compliance. A zero does not establish failure, and the score cannot establish conformity to the referenced standards. The verdict also reflects the identified blockers independently of the score.

| Category | Weight | Evidence points | Basis and unassessed elements |
|---|---:|---:|---|
| Architecture and maintainability | 8 | 2 | Separate frontend and backend modules observed; coupling, ownership, and complete architecture quality **NOT ASSESSED**. |
| Identity and access | 12 | 2 | Session-backed authentication paths exist; deployed OAuth, RBAC coverage, MFA enforcement and environment administrator configuration **NOT ASSESSED**. |
| API, validation and uploads | 10 | 1 | Validation and upload limits exist; aggregate resource control has gaps. Full ASVS/API verification **NOT ASSESSED**. |
| Data integrity and workflows | 12 | 1 | Article PATCH and publication issues identified; all remaining workflows and concurrency invariants **NOT ASSESSED**. |
| Frontend accessibility and responsiveness | 8 | 0 | Carousel issue identified; WCAG 2.2 AA and device/browser testing **NOT ASSESSED**. |
| Frontend performance and SEO | 6 | 1 | Preview tests pass; field Core Web Vitals, lab performance and deployed SEO **NOT ASSESSED**. |
| Backend performance and scalability | 8 | 2 | Pool limits/timeouts present; contention risks identified; capacity and load behavior **NOT ASSESSED**. |
| Data platform and recovery | 8 | 1 | Database TLS and pool configuration observed; production indexes, backups, restore and recovery objectives **NOT ASSESSED**. |
| Test and quality assurance | 8 | 2 | Test scripts and 13 passing targeted tests observed; full suite, coverage and end-to-end results **NOT ASSESSED**. |
| CI/CD and supply chain | 8 | 2 | CodeQL and PR dependency review configured; application gates absent from repository workflow; current dependency vulnerabilities and branch protection **NOT ASSESSED**. |
| Resilience and observability | 7 | 3 | Liveness, readiness and termination code exist; SLOs, alerts, logs, incident response and live behavior **NOT ASSESSED**. |
| Configuration and release operations | 5 | 4 | Environment validation and PDF-specific deployment/rollback guidance exist; actual production configuration and full-system rollback **NOT ASSESSED**. |
| **Total** | **100** | **21** | |

References for observed controls: `backend/src/app.ts:109-152`, `backend/src/config/database-tls.ts:9-15`, `backend/src/config/db.ts:11-47`, `backend/src/server.ts:73-97`, `.github/workflows/security.yml:14`, `backend/docs/special-issues-stage-3-deployment.md:16-34`, and the package scripts at `backend/package.json:6-22` and `frontend/ParagonWebApp/package.json:4-10`.

## Findings

Severity reflects impact and realistic preconditions, not proof of exploitation. Verified means the implementation or configuration was observed; runtime impact is separately identified where not tested.

### High

**H1 — Article writes can exhaust the connection pool and report failure after commit — verified code path; load impact untested.** `backend/src/modules/articles/article.repository.ts:765-839` retains a checked-out client after `COMMIT` while awaiting `findCreditsByArticleId`, which uses another pool connection (`:561`). Featured writes also make pool queries at `:819-824`; create has a similar post-commit featured query at `:718-727`. The production pool defaults to five connections (`backend/src/config/db.ts:11-19`, `:32-34`). Concurrent writes occupying all slots can wait on a second connection until timeout, even though changes have committed; clients may retry a successful operation. Use the same transaction client before commit or release it before subsequent pool work, and make response semantics reflect commit state. Reproduce with a small pool and concurrent writes.

**H2 — CI does not gate application builds or tests — verified repository configuration.** `.github/workflows/security.yml:14-49` configures CodeQL and dependency review; the repository workflow does not run the backend/frontend build, tests, or migration validation despite scripts in both package files. Regressions and non-building changes can pass these repository checks. Add isolated, required build and test jobs and migration verification against disposable PostgreSQL; independently verify branch protection and deployment gating. Live CI settings are **NOT ASSESSED**.

**H3 — Environment administrator can lack MFA and revocation if enabled — conditional risk, configuration unverified.** When `ALLOW_ENV_ADMIN` is enabled, the environment administrator path bypasses the normal session repository (`backend/src/modules/auth/auth.controller.ts:172-196`, `backend/src/middlewares/authenticate.ts:55-65`); MFA/session management is unavailable and logout only revokes database-backed sessions (`auth.controller.ts:285-288`, `:495-496`, `:518-523`). A stolen token can remain usable until expiry or global invalidation. Verify the production setting without exposing secrets; keep this path disabled or implement MFA and revocable server-side sessions. Actual enablement and exploitation are **NOT ASSESSED**.

### Medium

**M1 — Article PATCH does not preserve omitted fields — verified code path.** The partial schema allows omitted fields (`backend/src/modules/articles/article.schema.ts:201-278`; route `article.routes.ts:108-115`), but the update path calls credit preparation without restoring omitted author IDs (`article.service.ts:192-214`, `:642-656`) and the repository writes omitted columns/defaults (`article.repository.ts:768-803`). Partial requests can fail or overwrite existing values. Merge the patch and existing credits transactionally, or enforce full replacement semantics, and add regression tests for omitted and nullable fields.

**M2 — Publishing through PATCH misses the publication timestamp — verified code path.** The update path accepts a Published transition (`backend/src/modules/articles/article.service.ts:615-639`; `article.repository.ts:768-803`) without the timestamp update used by the publish method (`article.repository.ts:843-852`). Published content can have a missing or stale date and sort incorrectly (`article.repository.ts:244`). Unify transitions atomically and test draft-to-published through each supported route. Actual client usage is **NOT ASSESSED**.

**M3 — Uploads are buffered before concurrency admission — verified code path.** Multer memory storage parses uploads before the storage gate (`backend/src/modules/media/media.routes.ts:13`, `:23-29`; `media.service.ts:119-124`, `:184-195`, `:263-270`). The default maximum is 25 MB and configuration permits 100 MB (`settings.defaults.ts:21`; `settings.schema.ts:42`). Concurrent requests by an authorized or compromised administrator can exhaust memory, especially during image processing. Admit requests before parsing and bound aggregate buffered bytes and processing concurrency; load-test limits.

**M4 — Body parsing precedes the API rate limiter — verified ordering; production impact untested.** `backend/src/app.ts:78-108` installs JSON and URL-encoded parsers before the API limiter. Concurrent unauthenticated large bodies can consume resources before request limiting. Enforce early ingress and concurrency limits and use smaller route-specific body limits; validate with realistic load and existing ingress controls.

**M5 — Storage cleanup holds broad table locks over external I/O — verified code path.** `backend/src/storage/storage-cleanup.repository.ts:9-19` takes `SHARE ROW EXCLUSIVE` locks on `special_issues` and `media_files` while performing storage cleanup, with a documented transport bound of 60 seconds. Slow external deletion can block writes and cause timeouts. Avoid network I/O under broad table locks while preserving reference safety; fault-test slow deletion and verify cleanup scheduling and alerting. Production scheduler status is **NOT ASSESSED**.

**M6 — Automatically rotating carousel lacks persistent pause — verified markup and behavior.** `frontend/ParagonWebApp/src/app/features/home/components/featured-section/featured-section.ts:18`, `:138-145` starts seven-second rotation; `featured-section.html:1-42` has navigation controls but no persistent pause. Hover/focus and reduced-motion handling do not provide a persistent stop for every user. Add an accessible pause/resume control and test against WCAG 2.2.2. Overall WCAG conformance is **NOT ASSESSED**.

**M7 — Public footer destinations are placeholders — verified markup.** `frontend/ParagonWebApp/src/app/core/layout/footer/footer.html:74-91` uses `href="#"` for eight advertised destinations including contact, privacy and terms. These links do not deliver the promised content. Connect them to real resources or remove them until available; verify keyboard and mobile navigation.

### Potential risks requiring confirmation

- **Media privacy:** `backend/src/modules/media/media.routes.ts:59`, `media.repository.ts:229-234`, and `media.service.ts:347-354` permit unauthenticated resolution of media URLs without an apparent publication filter. Confirm whether the entire library is intended to be public and test deployed storage access. If unpublished or sensitive assets must be private, separate storage/access policies and authorize retrieval. Exposure of sensitive data is **NOT ASSESSED**.
- **Shutdown drain:** `backend/src/server.ts:73-89` waits for server close before draining resources, while long-lived Socket.IO and notification streams exist (`backend/src/realtime/socket.ts:12-13`, `:65`; `backend/src/modules/notifications/notification.service.ts:81-85`). Test shutdown with active clients against the platform grace period; close streams and bound drain if needed. Runtime failure is **NOT ASSESSED**.
- **Application cutoff:** `backend/src/modules/applications/application.service.ts:25-39` checks whether applications are open separately from insertion (`application.repository.ts:177-214`). An in-flight submission may commit after closure. Confirm whether a strict cutoff is required and, if so, serialize the check and insert with the settings update. Cutoff requirements and runtime behavior are **NOT ASSESSED**.

## Standards and assessment limits

The review used ISO/IEC 25010:2023 quality characteristics, OWASP ASVS 5.0, OWASP Top 10:2025, OWASP API Security Top 10, NIST SSDF, WCAG 2.2 AA, Core Web Vitals, Google SRE and DORA as audit lenses. It is not a control-by-control assessment; compliance with each standard is **NOT ASSESSED**. No points were granted for an unverified requirement. In particular, current dependency advisories, secret exposure, all endpoint authorization, OAuth provider settings, upload exploitability, end-to-end workflows, concurrency under load, SQL plans/index effectiveness, caching, browser usability, field performance, live monitoring, backup restoration, RPO/RTO, incident exercises, and DORA measurements are **NOT ASSESSED**.

The only direct test result is the targeted 13-test preview run above. No full build, full backend/frontend suite, migration test, browser automation, vulnerability scan, production check, or recovery drill was executed. Existing security scans, health endpoints, TLS and rollback documentation are evidence of configured mechanisms, not evidence of their current production effectiveness.

## Prioritized remediation roadmap

1. **Before release:** Resolve H1 and M1 with transactional update semantics and small-pool concurrency/partial-update regression tests. Resolve H2 with required build, unit/integration, and disposable database migration gates; verify actual branch and deployment protection. Verify H3's production setting and eliminate the unrevocable non-MFA administrator path if enabled.
2. **Before release:** Fix M2 and exercise every article publication transition. Establish and test media privacy requirements, and validate production configuration, monitoring, backup restoration, rollback and incident ownership without exposing secrets.
3. **Next:** Bound request and upload resource use (M3–M4), remove cleanup lock contention (M5), and run fault/load tests. Fix carousel controls and placeholder links (M6–M7), then run keyboard, screen-reader, responsive and automated accessibility checks.
4. **Operational baseline:** Run full suites, dependency/security checks, browser and API end-to-end tests, representative query and capacity analysis, field Core Web Vitals, restore drills and deployment rollback exercises. Define SLOs, alerts and incident playbooks; collect actual DORA data and measure trends.

## Mandatory release blockers

- Correct and regression-test article partial updates and publication state; demonstrate safe concurrent article writes without pool starvation or false failure after commit (H1, M1, M2).
- Establish passing, enforced application build/test and migration checks and verify deployment gating (H2).
- Verify environment administrator configuration and ensure privileged access requires MFA and revocable sessions where that path is enabled (H3).
- Verify intended public/private media boundaries and demonstrate recoverable backups and rollback for the actual release environment. These are currently **NOT ASSESSED**, not asserted failures.

**Final verdict: NOT READY.** Reassess after blockers are resolved and the missing release evidence is collected. This audit makes no deployment authorization.
