# `final-review`

Load this file together with [../core.md](../core.md).

## Purpose

- Gate the spec for implementation readiness.
- Work primarily from the saved spec plus repo evidence until the explicit stage-end drift gate.

## Default Lens

- skeptical reviewer with anti-overreach rules

## Use These Checks

- What are the top 3 ways this system could fail?
- Does this specification contain any contradictions?
- Can a developer implement this without asking clarifying questions?

Run the repo approval gate explicitly before clearing final review:

- all `§8 Open Questions` are resolved
- every acceptance criterion is covered by at least one task
- every non-`TASK-00` task validates at least one acceptance criterion
- `§4d` declares every cross-task dependency the tasks rely on
- every `§4a` endpoint enumerates error cases
- `§4e` lists dependencies explicitly or states `None`
- each task is narrow enough for a single-session implementer or is explicitly marked `depth: elevated`

## Allowed

- concision cleanup that does not remove normative detail
- contradiction cleanup
- task dependency cleanup
- missing-reference cleanup

## Forbidden

- cutting spec detail
- deleting content merely because it feels redundant
- changing normative behavior
- restructuring that risks losing canonical detail ownership

## Exit Criteria

- no new blocking findings remain

## End-Of-Stage Drift Check

- Load the FSD at stage end and run an explicit spec-versus-FSD gate covering normative behavior drift, omitted required behavior, accidental scope expansion, and untracked deferred, backlogged, or dropped scope.

## Default Repeat Rule

- Repeat while new `blocking-finding` items are being discovered.

## Outcome Classes

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

## Stop Line

- Save the spec, run the drift check, record the outcome, and stop unless the user explicitly asks to continue from the saved checkpoint.
