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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Graphify — Token-Efficient Codebase Navigation

- For nontrivial codebase questions, consult the existing Graphify index before broad repository exploration.
- Use graph relationships to identify relevant modules, symbols, callers, and dependencies.
- Read only the source files and sections necessary for the task.
- Do not load graph.json, graph.html, or the entire GRAPH_REPORT.md into context unless explicitly necessary.
- Prefer targeted graph queries and concise results over large graph dumps.
- Reuse existing graph data instead of rebuilding for every question.
- Rebuild the graph only when relevant source changes make its index stale.
- Validate graph findings against current source code before modifying files.
- Avoid unnecessary documentation generation and verbose explanations.
- Report only modified files, important decisions, and verification results.
- Never skip necessary tests, security checks, or correctness verification to save tokens.