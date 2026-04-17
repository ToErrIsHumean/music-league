# Spec-Authoring Workflow

Use this reference for the stage contracts, escalation rules, exploration budget, and final-review policy.

## Core Frame

- Inputs: source FSD, current repo, declared secondary heuristic `X`
- Product truth: the FSD
- Technical grounding: repo evidence
- Checkpoint artifact: the versioned spec file itself
- Resume state: inferred from the current spec on disk

FSD loading rule:

- `bootstrap` actively uses the FSD throughout the stage.
- For every later stage, providing the FSD path in the invocation is sufficient at stage start.
- For stages after `bootstrap`, defer active FSD loading until the end-of-stage drift check unless a true source-of-truth ambiguity forces earlier use.
- This rule exists to preserve analytical headroom and avoid compounding context pressure across later transformations.

Repeat rule:

- A repeated transformation is a new pass from the saved spec on disk.
- By default, each repeat is a fresh context window.
- Record repeats by incrementing the pass number for that stage in the `Author` field.
- Do not repeat a stage because wording could be nicer, structure could be cleaner, or another valid shape exists.
- If the stage exit criteria are already met, advance. Do not linger.

Repeat admission test:

- `New issue:` identify the newly discovered material issue.
- `Why this stage:` explain why it belongs in this stage's scope.
- `Why material:` explain how it affects implementability, correctness, or scope integrity.

If you cannot answer all three clearly, do not repeat the stage.

Use repo evidence for:

- feasibility
- integration and boundary alignment
- existing constraints and conventions
- implementation-risk detection

Do not use repo evidence to invent product requirements or normalize away FSD intent.

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

- do not carry unauthorized drift into the next stage
- do not silently preserve a divergence
- once HITL changes direction and that change is recorded, treat the updated direction as authoritative

Stage-end drift check questions:

1. Did this stage change normative behavior relative to the FSD?
2. Did this stage omit required FSD behavior?
3. Did this stage add scope not justified by the FSD or recorded authority?
4. Did any deferred, backlogged, or dropped item lose its required traceability?

Handling:

- if all answers are no, record `no-drift`
- if the FSD clearly resolves the issue, fix it and record `corrected-unauthorized-drift`
- if the deviation is intentional and explicitly authorized, record `authorized-divergence`
- if the FSD and repo materially disagree, record `source-conflict` and escalate when product behavior is affected
- if multiple plausible product readings remain, record `escalated-ambiguity`

Autonomous correction is allowed only when:

- the FSD clearly resolves the issue
- no new product decision is required
- the fix does not create a new material tradeoff with `X`

Required stage-end record:

`Drift check: no-drift | corrected-unauthorized-drift | authorized-divergence | source-conflict | escalated-ambiguity`

If the result is not `no-drift`, also record:

`Drift issue: [one-sentence description]`

## Transformation Contracts

Lens rule:

- Each transformation has a default lens.
- An explicit lens override is allowed.
- The lens shapes emphasis only; it does not override the FSD as source of truth, the primary heuristic plus `X` policy, or the global guardrails.

### 1. `bootstrap`

Purpose:
- Produce the first full structurally valid draft.
- Use the FSD actively as the working product source of truth throughout this stage.

Default lens:
- architecture-first

Required output:
- all sections present
- `§1`, `§2`, `§3`, `§5`, `§7`, and `§8` drafted from FSD plus repo evidence
- `§4` present across the touched boundaries, even if still broad
- `§6` mostly nailed down
- `§6` may reference `§4` entries that are still broad, provided those `§4` entries already identify the touched boundary clearly enough for task decomposition

Allowed:
- broad `§4` language
- active OQ creation and early OQ resolution inside the same pass
- aggressive restructuring of draft wording where needed

Forbidden:
- missing major sections
- silently inventing product behavior
- locking in implementation-detail commitments not justified by FSD or repo evidence

Exit criteria:
- the spec is structurally valid
- a future window can resume from the saved draft
- meaningful uncertainty is captured in `§8`

End-of-stage drift check:
- before saving, re-check the draft against the FSD for normative behavior drift, omitted required user-story substance, accidental scope expansion, and missing downgrade traceability

Default repeat rule:
- run once
- repeat only if the saved draft is not yet a usable full checkpoint

Anti-overreach rule:
- do not repeat `bootstrap` to make the first draft prettier, broader, or more polished than needed for a resumable checkpoint

### 2. `architecture-audit`

Purpose:
- Check for missing implicit effects and unsafe architectural gaps.
- Work primarily from the saved spec plus repo evidence, not from an always-hot FSD context.

Default lens:
- architect

Review focus:
- upstream and downstream effects
- invariant integrity
- contract completeness
- missing out-of-scope exclusions
- modularization, de-modularization, locality, and sliceability risk in the primary touched files

Allowed:
- adding missing boundaries, invariants, OQs, acceptance criteria, or refactor requirements
- restructuring for clarity

Forbidden:
- changing product intent
- opportunistic cleanup unrelated to safe implementation
- cutting major FSD or User Story substance

Exit criteria:
- no known major omitted boundary or side effect remains
- implementation-risk refactors are captured if needed

End-of-stage drift check:
- load the FSD at stage end and confirm added implications, exclusions, or refactors did not distort product intent, silently expand scope, or downgrade scope without required traces

Default repeat rule:
- repeat only while new major omitted boundaries, side effects, or architectural risks are still being found

Anti-overreach rule:
- do not reopen `architecture-audit` for speculative side effects, generalized unease, or abstract preferences about modularity
- do not relitigate an acceptable architecture merely because another structure could also work

### 3. `task-shaping`

Purpose:
- Reduce entropy and make the spec executable for implementers.
- Work primarily from the saved spec plus repo evidence, not from an always-hot FSD context.

Default lens:
- architect with decomposition bias

Review focus:
- `§4`/`§5`/`§6` alignment
- task completeness
- whether tasks should be split
- whether a task depends on undeclared contracts

Allowed:
- tightening language
- splitting or resequencing tasks
- hardening broad `§4` entries into concrete contracts

Forbidden:
- adding speculative complexity without implementation benefit
- changing normative behavior

Exit criteria:
- every task is executable from the contracts it cites
- `§5` acceptance criteria are covered
- `§6` dependency graph is coherent

End-of-stage drift check:
- load the FSD at stage end and confirm task decomposition and contract hardening did not introduce new behavior, drop required behavior, or lose downgrade traceability

Default repeat rule:
- repeat only while task splits, dependency fixes, or contract-task alignment changes are still materially improving implementability

Anti-overreach rule:
- do not reopen `task-shaping` merely because tasks could be split differently, resequenced differently, or described more elegantly
- once tasks are executable, contract-backed, and dependency-coherent, move on

### 4. `final-review`

Purpose:
- Gate the spec for implementation readiness.
- Work primarily from the saved spec plus repo evidence until the explicit stage-end drift gate.

Default lens:
- skeptical reviewer with anti-overreach rules

Use these checks:

- What are the top 3 ways this system could fail?
- Does this specification contain any contradictions?
- Can a developer implement this without asking clarifying questions?

Allowed:

- concision cleanup that does not remove normative detail
- contradiction cleanup
- task dependency cleanup
- missing-reference cleanup

Forbidden:

- cutting spec detail
- deleting content merely because it feels redundant
- changing normative behavior
- restructuring that risks losing canonical detail ownership

Exit criteria:
- no new blocking findings remain

End-of-stage drift check:
- load the FSD at stage end and run an explicit spec-versus-FSD gate covering normative behavior drift, omitted required behavior, accidental scope expansion, and untracked deferred, backlogged, or dropped scope

Default repeat rule:
- repeat while new `blocking-finding` items are being discovered

## Decision Ladder For `X`

When architecture and `X` conflict, use this ladder:

1. preserve both if possible
2. take the minimal safe step that includes some of `X`
3. split the architectural sequence into smaller safer steps
4. defer the fuller realization of `X`
5. escalate only if none of the above is clearly safe

Autonomous choice is allowed only when the chosen path:

- preserves FSD intent
- preserves normative behavior
- has low risk to the primary heuristic
- is local rather than cross-cutting

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
- `@backlog.md` entry exists
- originating FSD contains a downgrade, sequence, or defer note

### `backlogged`

Required traces:

- `@backlog.md` entry exists
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
`Trace: §7 | @backlog.md | FSD note`

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

## Final-Review Outcome Classes

Classify every final-review item as exactly one of:

- `blocking-finding`
- `non-blocking-note`
- `non-finding`

### `blocking-finding`

Raise only when the issue materially impairs at least one of:

- implementability without clarifying questions
- internal consistency of normative behavior
- correctness of task ordering or dependency structure in `§6`
- fidelity to the FSD
- preservation of stated invariants
- integrity and sufficiency of referenced contracts for task execution

Typical blocking cases:

- contradiction between sections
- missing normative detail that would cause divergent implementations
- broken or incomplete dependency chain in `§6`
- task cannot be executed from the contracts it references
- spec content silently changes FSD behavior

### `non-blocking-note`

Use when the observation is true but does not prevent safe implementation, for example:

- wording could be clearer
- the decomposition is slightly awkward but still workable
- a bounded risk exists but the spec already constrains it enough
- an alternative structure might be nicer, but the current one works

### `non-finding`

Use when the inspected area is sufficiently specified and should remain unchanged, including:

- coherent sections
- healthy seams worth preserving
- acceptable compromises
- correctly parked OQs or exclusions

## Anti-Overreach Rules

Final review is a gate, not a quota-driven audit.

There is no minimum number of findings required for a valid review.

It is valid to return:

- zero findings
- a few strong blocking findings
- several non-findings
- areas that are already coherent and should remain unchanged

Do not raise findings merely because:

- another structure could also work
- the reviewer prefers a different decomposition
- wording could be more elegant
- the reviewer would choose more abstraction, less abstraction, or a different sequencing
- a speculative failure is imaginable without a concrete implementation-risk path

Do not reopen coherent sections just to chase reviewer preference.

## Final-Review Stop Rule

Continue final-review loops only while new `blocking-finding` items are being discovered.

Stop when the latest pass yields only:

- `non-blocking-note`
- `non-finding`
- repeated versions of already-known non-blocking concerns

Repeated stylistic concerns, alternative structures, or increasingly speculative risks are not grounds to continue the loop.
