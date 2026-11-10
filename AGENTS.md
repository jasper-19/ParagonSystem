# PARAGON — Codex project instructions

## Mission
Maintain the PARAGON campus publication web application with safe, reviewed, testable changes. Do not redesign or rewrite working features unless requested.

## Known stack (verify against repo)
- Frontend: Angular 21 standalone, TypeScript, Tailwind CSS; signals, interceptors, reactive forms and responsive layouts.
- Backend: Node.js on Render; inspect the actual framework, packages, routes and service patterns.
- Data: PostgreSQL, Supabase in production.
- Deployment: Vercel frontend; Render backend.
- Brand: Navy `#000035`, honey `#F4B400`; preserve existing tokens.
- Domains: articles, categories, special issues (PDF), image media library, staff applications, editorial board, admin dashboard, activity logs, settings.

## Required start-of-task checks
1. Check `git status --short`, current branch and relevant `package.json` scripts.
2. Inspect affected code paths and nearby tests; identify unknowns instead of guessing.
3. State intended scope, acceptance criteria, API/schema impact and validation plan.
4. For multi-domain tasks, delegate only independent scopes to named agents.

## Delegation policy
- Main Codex thread is the final coordinator; `paragon_orchestrator` can plan but must not create an uncontrolled delegation chain.
- Use `angular_frontend` for UI; `backend_api` for APIs; `database_architect` for migrations; `ui_ux_designer` for design; domain agents for domain invariants.
- For nontrivial changes, independently invoke `qa_test_engineer` and `code_reviewer`; invoke `security_auditor` for auth, uploads, PII, public endpoints or permissions.
- Max four concurrent spawned agents. Do not parallelize overlapping writes. Assign explicit file ownership and shared API contracts before implementation.
- Collect all handoffs, reconcile conflicts, run integration checks, and report any unverified behavior.

## Safety and approval gates
- No production deployments, secret changes, pushes, merges, production migrations, destructive SQL, or live publication/applicant status changes without explicit user approval.
- Never print `.env` values, credentials, access tokens or applicant PII.
- Treat uploads, HTML content, authentication, RBAC, and database queries as security-sensitive.
- Never force-push or overwrite another agent's changes.
- A passing local test does not authorize production release.

## Definition of done
- Requested acceptance criteria addressed; interfaces and schemas consistent; relevant tests/build/lint/typecheck run where available.
- Independent review findings resolved or explicitly reported.
- Handoff contains changed files, commands/results, migration/deploy implications, remaining risks and next steps.

See `docs/agent-workflows/ORCHESTRATION.md` for routing and examples.
