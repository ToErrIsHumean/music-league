---
name: spec-authoring
description: Author or resume an implementation SPEC in music-league from an FSD plus current repo evidence. Use when drafting, hardening, or reviewing a SPEC against docs/templates/SPEC_TEMPLATE.md with one-stage-per-invocation checkpoints, bounded repo exploration, downgrade traceability, and narrow HITL escalation.
---

# Spec Authoring

Author or resume a project spec from the FSD and the current repo. Treat the FSD as the product source of truth and use repo evidence only for feasibility, integration reality, constraints, and implementation-risk detection.

This skill uses one transformation stage per invocation. Keep the top-level skill thin: load the shared rules, then load only the active stage contract.

## Required Inputs

- Source FSD path
- Current repo
- Secondary heuristic `X`, declared up front for this authoring run
- Current spec file if resuming

There is no separate technical-summary artifact. Derive technical context directly from repo evidence.

## Load Protocol

- `/home/zacha/music-league/AGENTS.md`
- `/home/zacha/music-league/docs/templates/SPEC_TEMPLATE.md`
- [references/workflow.md](references/workflow.md)
- [references/core.md](references/core.md)
- The current spec file if resuming

Then load only the active stage file:

- `bootstrap` -> [references/stages/bootstrap.md](references/stages/bootstrap.md)
- `architecture-audit` -> [references/stages/architecture-audit.md](references/stages/architecture-audit.md)
- `task-shaping` -> [references/stages/task-shaping.md](references/stages/task-shaping.md)
- `final-review` -> [references/stages/final-review.md](references/stages/final-review.md)

Stage-specific loading rules:

- For `bootstrap`, load and use the FSD actively throughout the stage.
- For later stages, providing the FSD path in the invocation is enough at stage start. Defer active FSD loading until the stage-end drift check unless a true source-of-truth ambiguity forces earlier use.
- Do not keep other stage files loaded "just in case."
- Load additional repo files only as needed for the current transformation.
- Load `/home/zacha/music-league/BACKLOG.md` only when recording a `deferred` or `backlogged` scope decision, and update it in the same invocation.

Use [references/core.md](references/core.md) as the canonical source for shared policy:

- non-negotiables
- provenance and repeats
- drift handling
- `X` policy
- reduced-scope governance
- exploration budget
- HITL escalation gates

## Transformation Order

Run these transformations in order unless the current spec clearly resumes inside one of them:

1. `bootstrap`
2. `architecture-audit`
3. `task-shaping`
4. `final-review`

Default to one transformation stage per invocation. Complete one stage, save the checkpoint, run the drift check, record the outcome, and stop. Continue to another stage only when the user explicitly asks to continue from the saved draft.

## Routing Table

- [references/workflow.md](references/workflow.md): load-selection guide and routing index
- [references/core.md](references/core.md): shared rules for every stage
- [references/stages/bootstrap.md](references/stages/bootstrap.md): first full draft contract
- [references/stages/architecture-audit.md](references/stages/architecture-audit.md): architecture hardening contract
- [references/stages/task-shaping.md](references/stages/task-shaping.md): implementability and task decomposition contract
- [references/stages/final-review.md](references/stages/final-review.md): final gate and review taxonomy

## Invocation Closeout

- End each invocation with a short summary of:
  - what changed in the spec
  - what was excised or merged
  - any unavoidable duplication that remains
  - the stage outcome and recommended next stage
