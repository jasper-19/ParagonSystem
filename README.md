# PARAGON Codex sub-agent pack

Repository-ready starter pack: 16 custom Codex agents, root instructions and orchestration playbook. Built from known PARAGON context; **not yet verified against your actual repository**.

## Installation (Windows PowerShell)
1. Back up any existing `AGENTS.md` and `.codex` files in your PARAGON repository.
2. Copy the contents of this package into your repository root, preserving folders. Do **not** replace existing configuration without reviewing differences.
3. Open the repository as a trusted project in Codex; restart the session if necessary.
4. Ask: `List available PARAGON subagents, inspect repository scripts, and perform a read-only architecture audit. Do not modify files.`
5. Confirm agent names and roles before asking for implementation.

## Important
- Uses current custom agent TOML keys `name`, `description`, `developer_instructions`, plus optional `model_reasoning_effort`. No hardcoded model; inherits your selected model.
- `.codex/config.toml` registers roles and limits concurrency to four.
- Instructions alone do not enforce filesystem sandbox permissions. Set the parent Codex session sandbox/approval mode appropriately.
- No live repository was inspected and no code was modified. Test your installed Codex version's agent discovery.
- Keep `AGENTS.md` concise and put repo-specific commands, paths and conventions into it after inspection.
