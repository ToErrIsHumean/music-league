# Spec-Authoring Workflow

Use this file to choose which references to load. Shared policy lives in [core.md](core.md). Canonical stage contracts live in `references/stages/`.

## Always Load

- `/home/zacha/music-league/AGENTS.md`
- `/home/zacha/music-league/docs/templates/SPEC_TEMPLATE.md`
- [core.md](core.md)
- The current spec file if resuming

## Active Stage Loading

- Load exactly one stage file per invocation.
- Do not keep other stage files loaded "just in case."
- For `bootstrap`, load and use the FSD actively throughout the stage.
- For stages after `bootstrap`, providing the FSD path in the invocation is enough at stage start. Defer active FSD loading until the stage-end drift check unless a true source-of-truth ambiguity forces earlier use.

## Stage Order

Run these transformations in order unless the current spec clearly resumes inside one of them:

1. `bootstrap`
2. `architecture-audit`
3. `task-shaping`
4. `final-review`

Default to one transformation stage per invocation. Complete one stage, save the checkpoint, run the drift check, record the outcome, and stop. Continue to another stage only when the user explicitly asks to continue from the saved draft.

## Stage Files

- `bootstrap`: [stages/bootstrap.md](stages/bootstrap.md)
- `architecture-audit`: [stages/architecture-audit.md](stages/architecture-audit.md)
- `task-shaping`: [stages/task-shaping.md](stages/task-shaping.md)
- `final-review`: [stages/final-review.md](stages/final-review.md)

## Ownership

- [core.md](core.md) owns provenance, repeats, drift rules, `X` policy, reduced-scope governance, exploration budget, and escalation gates.
- Each stage file owns only its stage-local contract.
