# PARAGON orchestration playbook

## Workflow
1. **Discover** — inspect git state, scripts, feature boundaries and existing contracts.
2. **Plan** — write acceptance criteria, affected modules, data flow and risks.
3. **Assign** — one writer per file group; parallelize independent analysis and tests.
4. **Implement** — each writer produces a concise handoff.
5. **Verify** — QA tests + security audit where relevant + independent code review.
6. **Integrate** — coordinator resolves conflicts, runs relevant checks, reports release readiness.
7. **Release** — only after separate explicit approval.

## Agent routing
| Request | Lead | Supporting reviewers |
|---|---|---|
| Angular layout | angular_frontend | ui_ux_designer, accessibility_specialist, qa_test_engineer |
| Article lifecycle | editorial_workflow | backend_api, database_architect, security_auditor |
| Image/PDF handling | media_special_issues | security_auditor, qa_test_engineer |
| Recruitment applications | applications_manager | security_auditor, database_architect, qa_test_engineer |
| Dashboard | analytics_specialist | angular_frontend, performance_optimizer |
| Production release readiness | devops_engineer | security_auditor, code_reviewer |

## Contract-first coordination
For changes crossing UI/API/database, first agree on payload shape, error semantics, permission rules, migration sequence and test fixtures. Do not allow parallel agents to edit the same files. Use serial handoffs for schema -> API -> UI when dependent.

## Approval gates
Explicit user approval is required before: any production deployment, any production migration or data repair, branch push/merge, destructive operations, changing secrets, sending communications, publishing/unpublishing live content, or altering real applications.

## Suggested user prompts
- `Inspect the PARAGON repository and delegate a read-only architecture audit to paragon_orchestrator, security_auditor and code_reviewer. Summarize evidence; do not modify files.`
- `Implement article scheduling. Have editorial_workflow define transitions and backend_api define the contract first. Then delegate nonoverlapping UI and tests. Do not deploy.`
- `Review this branch against main using code_reviewer, security_auditor and qa_test_engineer. Report severity, file locations and commands actually executed.`
- `Prepare a release-readiness report using devops_engineer and security_auditor. Do not push, migrate or deploy.`

## Handoff template
**Scope:** ...
**Files touched:** ...
**Behavior/contracts:** ...
**Validation run:** command -> result ...
**Security/data risks:** ...
**Unresolved items:** ...
**Release impact:** ...
