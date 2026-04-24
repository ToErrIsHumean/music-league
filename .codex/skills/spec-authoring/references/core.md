# Spec-Authoring Core Rules

Use this file as the canonical shared policy for every stage. Load this together with exactly one active stage file.

## Core Frame

- Inputs: source FSD path, current repo, declared secondary heuristic `X`
- Product truth: the FSD
- Technical grounding: repo evidence
- Checkpoint artifact: the versioned spec file itself
- Resume state: inferred from the current spec on disk

Use repo evidence for:

- feasibility
- integration and boundary alignment
- existing constraints and conventions
- implementation-risk detection

Do not use repo evidence to invent product requirements or normalize away FSD intent.

## Non-Negotiables

- Keep the spec structurally valid against `docs/templates/SPEC_TEMPLATE.md`.
- Do not change normative behavior from the FSD.
- Do not let repo or doc inconsistencies silently override FSD intent.
- Do not carry unauthorized drift into the next stage.
- Do not remove a detail unless it still has one clear canonical home elsewhere in the spec.
- Do not modify `Appendix D: Discoveries Log` entries from prior spec-author or implementation work.
- Write the spec back to disk after every major transformation.
- Before closing any stage, run an explicit drift check against the saved draft and the FSD.
- End each editing pass with a short summary of:
  - what was excised or merged
  - any unavoidable duplication that remains

## Provenance And Repeats

- Record only the stage completed in the current invocation in the `Author` field, as `<stage> <pass-number>`, for example `bootstrap 1` or `final-review 2`.
- Do not use the `Author` field or version metadata to imply planned, partial, or future stages.
- If the spec uses a draft-version cadence, preserve it. Otherwise increment the draft patch version only when a stage checkpoint is actually saved.
- Resume from the latest saved spec on disk, not from conversation memory.
- A repeated transformation is a new pass from the saved spec on disk.
- By default, each repeated pass is a fresh context window.
- Do not rely on unsaved conversational state across repeated passes.
- Do not repeat a stage because wording could be nicer, structure could be cleaner, or another valid shape exists.
- If the current draft already satisfies the stage exit criteria, advance instead of lingering.

Repeat admission test:

- `New issue:` identify the newly discovered material issue.
- `Why this stage:` explain why it belongs in this stage's scope.
- `Why material:` explain how it affects implementability, correctness, or scope integrity.

If you cannot answer all three clearly, do not repeat the stage.

## Lens Rule

- Each stage has a default lens in its stage file.
- An explicit lens override is allowed.
- The lens shapes emphasis only. It does not override the FSD as source of truth, the primary heuristic plus `X` policy, or the non-negotiables in this skill.

## Drift Rules

Use only these stage-end outcomes:

- `no-drift`
- `corrected-unauthorized-drift`
- `authorized-divergence`
- `source-conflict`
- `escalated-ambiguity`

Definitions:

- `unauthorized drift`: accidental divergence from the FSD
- `authorized divergence`: intentional deviation with explicit authority and traceability
- `source conflict`: the FSD and current repo materially disagree
- `escalated ambiguity`: multiple plausible product readings remain after analysis

Authority for `authorized-divergence`:

- explicit HITL direction change
- updated FSD
- documented lowest-risk downgrade or sequencing decision with required traces

Hard rules:

- Do not carry unauthorized drift into the next stage.
- Do not silently preserve a divergence.
- Once HITL changes direction and that change is recorded, treat the updated direction as authoritative.

Stage-end drift check questions:

1. Did this stage change normative behavior relative to the FSD?
2. Did this stage omit required FSD behavior?
3. Did this stage add scope not justified by the FSD or recorded authority?
4. Did any deferred, backlogged, or dropped item lose its required traceability?

Handling:

- If all answers are no, record `no-drift`.
- If the FSD clearly resolves the issue, fix it and record `corrected-unauthorized-drift`.
- If the deviation is intentional and explicitly authorized, record `authorized-divergence`.
- If the FSD and repo materially disagree, record `source-conflict` and escalate when product behavior is affected.
- If multiple plausible product readings remain, record `escalated-ambiguity`.

Autonomous correction is allowed only when:

- the FSD clearly resolves the issue
- no new product decision is required
- the fix does not create a new material tradeoff with `X`

Required stage-end record:

`Drift check: no-drift | corrected-unauthorized-drift | authorized-divergence | source-conflict | escalated-ambiguity`

If the result is not `no-drift`, also record:

`Drift issue: [one-sentence description]`

## Decision Ladder For `X`

Primary heuristic:

- optimize for bug resistance, maintainability or mutability, and context-locality and readability for AI-native coding agents

When architecture and `X` conflict, use this ladder:

1. preserve both if possible
2. take the minimal safe step that includes some of `X`
3. split the architectural sequence into smaller safer steps
4. defer the fuller realization of `X`
5. escalate only if none of the above is clearly safe

Prefer:

- local, incremental, reversible steps
- smaller sequence steps over big-bang architecture
- partial safe inclusion of `X` now with fuller realization deferred later

Do not use new packages as the low-risk escape hatch unless already allowed by governing package policy.

Autonomous choice is allowed only when the chosen path:

- preserves FSD intent
- preserves normative behavior
- has low risk to the primary heuristic
- is local rather than cross-cutting

If the tradeoff still materially harms the primary heuristic or changes normative behavior, escalate to HITL.

## Reduced-Scope Governance

Use exactly one disposition whenever a feature is reduced from fuller FSD intent:

- `deferred`: a minimal safe version remains in this spec and the fuller version is postponed
- `backlogged`: the feature is not in this spec but is still intended later
- `dropped`: the feature is intentionally no longer pursued

Never leave reduced scope merely absent.

### `deferred`

Required traces:

- current spec contains the minimal included version
- fuller version appears in `§7 Out of Scope`
- `BACKLOG.md` entry exists
- originating FSD contains a downgrade, sequence, or defer note

### `backlogged`

Required traces:

- `BACKLOG.md` entry exists
- `§7 Out of Scope` entry exists when implementers might otherwise assume it belongs in this spec
- originating FSD note exists when needed to show intentional removal from current scope

### `dropped`

Required traces:

- originating FSD or planning artifact records that it was intentionally dropped
- do not keep an active backlog item
- use `§7 Out of Scope` only when needed to prevent mistaken implementation

Whenever scope is reduced, record:

`Disposition: deferred | backlogged | dropped`
`Reason: sequencing | risk reduction | milestone fit | architecture cost | product decision`
`Trace: §7 | BACKLOG.md | FSD note`

When using `deferred` or `backlogged`, open and update `/home/zacha/music-league/BACKLOG.md` in the same invocation.

## Two-Approach Analysis Rule

Before escalating an uncertain item, try two different analyses:

1. repo and invariant analysis
2. alternative-shape analysis for a lower-risk path

If the issue still matters and remains ambiguous, park it in `§8 Open Questions` and escalate when required by the gates below.

## HITL Escalation Gates

Escalate only when:

- a choice would change normative FSD behavior
- multiple plausible product interpretations exist
- the tradeoff with `X` remains materially ambiguous after two analyses
- the choice is cross-cutting across multiple contracts or task boundaries
- repo evidence and FSD materially conflict and the conflict cannot safely be treated as code drift
- the spec would otherwise need invented requirements

Low HITL frequency is expected when the FSD is normatively clear and repo evidence only affects implementation shape.
Treat unusually low HITL as suspicious when multiple plausible product behaviors were resolved without escalation, repeated "lowest-risk" choices silently narrow scope, FSD and repo conflicts are being normalized away, or different runs would likely choose different product outcomes.

## Repo Exploration Budget

### Initial exploration

Explore broadly enough to credibly establish `§2 Prior State`.

### After `§2`

Stay within:

- the directly touched files or boundaries
- `1 boundary hop` upstream or downstream by default
- `2 boundary hops` when needed for contract, side-effect, or risk clarity

Go beyond `2` only by exception, for example when:

- a shared invariant or contract is clearly cross-cutting
- persistence, routing, prompts, or another central boundary is implicated
- conflicting local evidence requires a broader source of truth
- sliceability or modularization risk cannot be understood locally

Stop exploring once you can:

- fill `§2`
- draft the touched `§4`
- shape `§6`
- identify major implementation risks

Remaining meaningful uncertainty belongs in `§8`, not in endless repo archaeology.
