# SDD Workflow

This repo uses the same disk-backed SDD harness as `projectABE`, with
repo-local prompts under `docs/sdd/` and repo-local wrappers under
`scripts/sdd/`.

## Expected Inputs

- Dispatchable specs should conform to `docs/SPEC_TEMPLATE.md`.
- Plans are disk-backed `PLAN-*.md` files written by the Planner and updated by
  the Orchestrator.
- Repo guidance comes from `AGENTS.md`.

The existing milestone source-of-truth docs under `docs/specs/` are useful
product input, but they are not orchestration-ready until they are rewritten
into the canonical SDD task/contract/acceptance-criteria format.

## Files

- `scripts/sdd/run-role.sh`
  Shared wrapper for Codex, Claude Code, and Cline role execution.
- `scripts/sdd/planner.sh`
  Planner entrypoint for authoring `PLAN-*.md`.
- `scripts/sdd/implementer.sh`
  Implementer entrypoint for task-scoped execution and diff artifact output.
- `scripts/sdd/reviewer.sh`
  Reviewer entrypoint for structured verdict generation.
- `scripts/sdd/orchestrator.sh`
  Disk-backed Orchestrator entrypoint.
- `scripts/sdd/orchestrator/`
  Supporting JS modules for plan parsing, worktree management, gating, and
  promotion.
- `config/project.defaults.env`
  Repo defaults for guidance path, worktree root, branch prefix, and binaries.
- `config/sdd-gates.json`
  Deterministic gate command config. It starts empty by default.

## Deterministic Gate Config

Configure repo-specific deterministic checks in `config/sdd-gates.json`.

Supported shape:

```json
{
  "commands": [
    {
      "label": "lint",
      "command": "npm",
      "args": ["run", "lint"]
    },
    {
      "label": "typecheck",
      "command": "npm",
      "args": ["run", "typecheck"],
      "whenChangedPrefixes": ["src/", "app/"]
    },
    {
      "label": "task-scope-check",
      "command": "node",
      "args": ["scripts/checks/scope.js", "{changed_files}"]
    }
  ]
}
```

Notes:

- `whenChangedPrefixes` is optional. When present, the command runs only if at
  least one changed file starts with one of those prefixes.
- `{changed_files}` expands to the list of changed paths from the Implementer
  diff artifact.

## Dry-Run Examples

Planner:

```bash
scripts/sdd/planner.sh \
  --spec docs/specs/SPEC-001-example.md \
  --dry-run
```

Implementer:

```bash
scripts/sdd/implementer.sh \
  --task TASK-01 \
  --spec docs/specs/SPEC-001-example.md \
  --cycle 1 \
  --dry-run
```

Reviewer:

```bash
scripts/sdd/reviewer.sh \
  --task TASK-01 \
  --spec docs/specs/SPEC-001-example.md \
  --cycle 1 \
  --diff docs/sdd/last-diff-task-01.md \
  --dry-run
```

Orchestrator:

```bash
scripts/sdd/orchestrator.sh \
  --spec docs/specs/SPEC-001-example.md \
  --plan docs/specs/PLAN-001-example.md \
  --dry-run
```
