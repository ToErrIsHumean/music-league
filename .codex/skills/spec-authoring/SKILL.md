---
name: spec-authoring
description: Author or resume an implementation SPEC in music-league from an FSD plus current repo evidence. Use when drafting, hardening, or reviewing a SPEC against docs/templates/SPEC_TEMPLATE.md with staged checkpoints, bounded repo exploration, downgrade traceability, and narrow HITL escalation.
---

# Spec Authoring

Author or resume a project spec from the FSD and the current repo. Treat the FSD as the product source of truth and use repo evidence only for feasibility, integration reality, constraints, and implementation-risk detection.

Read [references/workflow.md](references/workflow.md) before major work. Keep this file loaded for the high-level workflow and trigger rules.

## Required Inputs

- Source FSD
- Current repo
- Secondary heuristic `X`, declared up front for this authoring run

There is no separate technical-summary artifact. Derive technical context directly from repo evidence.

## Always Load

- `/home/zacha/music-league/AGENTS.md`
- `/home/zacha/music-league/docs/templates/SPEC_TEMPLATE.md`
- The source FSD for `bootstrap`
- The current spec file if resuming

For stages after `bootstrap`, it is enough to provide the FSD path in the invocation. Defer active FSD loading until the end-of-stage drift check unless the stage encounters a true source-of-truth ambiguity.

Load additional repo files only as needed for the current transformation.

## Non-Negotiables

- Keep the spec structurally valid against `docs/templates/SPEC_TEMPLATE.md`.
- Do not change normative behavior from the FSD.
- Do not let repo/doc inconsistencies silently override FSD intent.
- Do not carry unauthorized drift into the next stage.
- Do not remove a detail unless it still has one clear canonical home elsewhere in the spec.
- Do not modify `Appendix D: Discoveries Log` entries from prior spec-author or implementation work.
- Write the spec back to disk after every major transformation.
- Before saving any stage, run an explicit drift check against the FSD.
- End each editing pass with a short summary of:
  - what was excised or merged
  - any unavoidable duplication that remains

## Provenance And Checkpointing

- The spec file itself is the checkpoint artifact.
- Use the `Author` field to record transformation provenance as `<stage> <pass-number>`, for example `bootstrap 1` or `final-review 2`.
- If the spec already uses a draft-version cadence, preserve it. Otherwise increment the draft patch version at each major checkpoint.
- Resume from the latest saved spec on disk, not from conversation memory.

## Transformation Order

Run these transformations in order unless the current spec clearly resumes inside one of them:

1. `bootstrap`
2. `architecture-audit`
3. `task-shaping`
4. `final-review`

Two transformations per context window is normal. When context gets tight, save the spec, stop, and continue in a fresh window from the saved draft.

## Repeats And Fresh Windows

- A repeated transformation is a new pass from the saved spec checkpoint on disk.
- By default, treat each repeated pass as a fresh context window.
- Record the repeated pass in the `Author` field by incrementing the pass number for that stage, for example `architecture-audit 2` or `final-review 3`.
- Do not rely on unsaved conversational state across repeated passes.
- Do not repeat a stage merely because the wording could be nicer, the structure could be cleaner, or another valid shape exists.
- If the current draft already satisfies the stage exit criteria, advance instead of repeating.

## Lenses

- Each transformation has a default lens in `references/workflow.md`.
- An explicit lens override is allowed.
- A lens changes emphasis only. It does not override:
  - the FSD as source of truth
  - the primary heuristic and `X` policy
  - the non-negotiables in this skill

## Transformation Expectations

### `bootstrap`

- Produce the first full draft on disk.
- Load and use the FSD actively throughout this stage.
- Populate the whole document; do not leave major sections absent.
- `§4` may still be broad, but it must be present across the touched boundaries.
- `§6` should already be mostly nailed down.
- `§6` may reference broad `§4` anchors before `§4` is fully hardened.
- Put unresolved uncertainty in `§8 Open Questions`, not in missing sections.
- Default repeat rule: run once. Repeat only if the saved draft is not yet a usable full checkpoint.
- Anti-overreach rule: do not repeat `bootstrap` to make the first draft prettier, broader, or more polished than needed for a usable checkpoint.
- End-of-stage drift check: confirm the saved draft still matches FSD normative behavior and does not omit required user-story substance.

### `architecture-audit`

- Check completeness, upstream and downstream implicit effects, invariant integrity, contract integrity, and primary-file modularization/locality risk.
- Do not actively load the FSD at the start of this stage unless needed to resolve a true source-of-truth ambiguity.
- Add required refactors only when they are needed for safe implementation or task sliceability.
- Default repeat rule: repeat only while new major omitted boundaries, side effects, or architectural risks are still being found.
- Anti-overreach rule: do not reopen `architecture-audit` for speculative side effects, generalized unease, or abstract preferences about modularity.
- End-of-stage drift check: load the FSD and confirm added implications or refactors did not distort product intent or silently expand scope.

### `task-shaping`

- Reduce entropy.
- Do not actively load the FSD at the start of this stage unless needed to resolve a true source-of-truth ambiguity.
- Tighten `§4`, `§5`, and `§6` alignment.
- Check each task for completeness.
- Split tasks when safe implementation or cross-task clarity requires it.
- Default repeat rule: repeat only while task splits, dependency fixes, or contract-task alignment changes are still materially improving implementability.
- Anti-overreach rule: do not reopen `task-shaping` merely because tasks could be split differently or described more elegantly.
- End-of-stage drift check: load the FSD and confirm task decomposition and contract hardening did not introduce new behavior, drop required behavior, or lose downgrade traceability.

### `final-review`

- Check contradictions, implementation readiness, task dependency integrity, and missing references.
- Do not actively load the FSD at the start of this stage unless needed to resolve a true source-of-truth ambiguity.
- Use the anti-overreach review policy in `references/workflow.md`.
- Do not cut spec detail during final-review. Final passes are for concision, contradiction cleanup, dependency cleanup, and missing-reference cleanup only.
- Stop iterating when there are no new blocking findings.
- Default repeat rule: repeat while new `blocking-finding` items are being discovered.
- End-of-stage drift check: load the FSD and run an explicit spec-versus-FSD gate before saving.

## Decision Policy

- Primary heuristic: optimize for bug resistance, maintainability or mutability, and context-locality and readability for AI-native coding agents.
- Secondary heuristic `X`: declared up front for the run.
- When architecture and `X` conflict, prefer the lowest-risk path to include `X`.
- Prefer:
  - local, incremental, reversible steps
  - smaller sequence steps over big-bang architecture
  - partial safe inclusion of `X` now with fuller realization deferred later
- Do not use new packages as the low-risk escape hatch unless already allowed by governing package policy.

If the tradeoff still materially harms the primary heuristic or changes normative behavior, escalate to HITL.

## Deferrals And Downgrades

Every feature reduced from fuller FSD intent must end the pass in exactly one of these states:

- `deferred`: smaller safe version now, fuller version later
- `backlogged`: not in this spec, still intended later
- `dropped`: intentionally not pursuing

Never let reduced scope become "just absent".

When you choose a minimal safe version of `X` instead of the full version:

- make the included step normative in the spec
- place the fuller version in `§7 Out of Scope`
- add a backlog entry in `@backlog.md`
- note in the originating FSD that the feature was intentionally downgraded, sequenced, or deferred

Do not allow deferred scope to disappear silently.

When scope is reduced, record this decision line:

`Disposition: deferred | backlogged | dropped`
`Reason: sequencing | risk reduction | milestone fit | architecture cost | product decision`
`Trace: §7 | @backlog.md | FSD note`

## Drift Handling

Use these categories only:

- `no-drift`
- `corrected-unauthorized-drift`
- `authorized-divergence`
- `source-conflict`
- `escalated-ambiguity`

Definitions:

- `unauthorized drift`: accidental divergence from the FSD
- `authorized divergence`: intentional deviation that is explicitly authorized and traced
- `source conflict`: FSD and repo materially disagree
- `escalated ambiguity`: multiple plausible product readings remain after analysis

Allowed authority for `authorized-divergence`:

- explicit HITL direction change
- updated FSD
- documented lowest-risk downgrade or sequencing decision with full traceability

Hard rules:

- unauthorized drift must be corrected before save or escalated
- authorized divergence may remain only if explicitly traced
- once HITL changes direction and that change is recorded, treat the updated direction as authoritative

## Repo Exploration Budget

- Explore broadly enough at the start to establish `§2 Prior State`.
- After that, stay within the directly touched area plus `1 boundary hop` upstream or downstream by default.
- Expand to `2 boundary hops` when needed for boundary clarity, side effects, or implementation risk.
- Go beyond `2` only by exception.

Canonical definition: one degree equals one boundary hop. If the code is too messy to map boundaries cleanly, approximate with directly related file clusters.

## Escalate Only Unusual Flags

Escalate to HITL only when one of these is true:

- resolving the issue would change normative FSD behavior
- the tradeoff between architecture and `X` is still materially ambiguous after multiple analyses
- there are multiple plausible product interpretations
- the choice is cross-cutting enough that it cannot be localized safely
- repo evidence and FSD materially conflict and the conflict cannot safely be treated as code drift
- you would otherwise need to invent requirements

Everything else should be handled inside the skill.
