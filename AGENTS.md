# AGENTS.md — Music League Repo Conventions

Music League uses the same disk-backed SDD workflow as `projectABE`, but this
repo is the canonical home for its own specs, plans, prompts, and utility
scripts.

## Context Loading

If you are asked to work on a `TASK-NN`, load:

1. this file
2. the active spec
3. the matching task entry from the active plan

The plan is dispatch-only. Contracts, invariants, and acceptance criteria live
in the spec.

## Dispatchable Specs

Dispatchable implementation specs in this repo should conform to
`docs/SPEC_TEMPLATE.md`.

The existing milestone source-of-truth docs under `docs/specs/` can be used as
product input, but they are not orchestration-ready until they are rewritten
into the task/contract/acceptance-criteria format expected by the SDD pipeline.

## Worktree Conventions

- Branch: `music-league/MN-task-NN`
- Path: `../music-league-worktrees/MN-task-NN`

Implementers work inside the assigned worktree. The orchestrator owns the
promotion path.

## Repo Invariants

- `AGENTS.md` is the canonical repo guidance. `CLAUDE.md` may mirror or point
  to it for tool compatibility.
- `docs/sdd/` contains the tracked Planner, Implementer, Reviewer, and
  Orchestrator prompts.
- `scripts/sdd/` contains the tracked wrapper and orchestration scripts.
- Only the Orchestrator writes `PLAN-*.md` files during execution.
- Do not change active spec contracts or acceptance criteria implicitly in code.
- New dependencies must be explicitly allowed by the active spec or already
  present in `package.json` when one exists.

## Config Notes

- Machine-local overrides belong in `config/project.local.env`.
- Deterministic gate commands are configured in `config/sdd-gates.json`.
