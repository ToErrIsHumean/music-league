# `architecture-audit`

Load this file together with [../core.md](../core.md).

## Purpose

- Check for missing implicit effects and unsafe architectural gaps.
- Work primarily from the saved spec plus repo evidence, not from an always-hot FSD context.

## Default Lens

- architect

## Review Focus

- upstream and downstream effects
- invariant integrity
- contract completeness
- missing out-of-scope exclusions
- modularization, de-modularization, locality, and sliceability risk in the primary touched files

## Operating Sequence

1. Enumerate the primary touched boundaries and the immediate upstream and downstream effects they imply.
2. Check those boundaries against governing invariants and note any pressure, mismatch, or missing guardrail.
3. Harden `§4` where a required boundary, side effect, or interface contract is still implicit.
4. Add any required `§7 Out of Scope` exclusions, downgrade traces, or `§8 Open Questions` that prevent mistaken implementation.
5. Capture implementation-risk refactors only when they are needed to make the architecture safe or sliceable.
6. Run one final omission pass: verify no major boundary, side effect, invariant guardrail, or implementation-risk refactor remains unstated.

## Allowed

- adding missing boundaries, invariants, OQs, acceptance criteria, or refactor requirements
- restructuring for clarity

## Forbidden

- changing product intent
- opportunistic cleanup unrelated to safe implementation
- cutting major FSD or User Story substance

## Exit Criteria

- no known major omitted boundary or side effect remains
- invariant pressure and contract gaps in the primary touched boundaries are either resolved or explicitly traced
- implementation-risk refactors are captured if needed

## End-Of-Stage Drift Check

- Load the FSD at stage end and confirm added implications, exclusions, or refactors did not distort product intent, silently expand scope, or downgrade scope without required traces.

## Default Repeat Rule

- Repeat only while new major omitted boundaries, side effects, or architectural risks are still being found.

## Anti-Overreach Rule

- Do not reopen `architecture-audit` for speculative side effects, generalized unease, or abstract preferences about modularity.
- Do not relitigate an acceptable architecture merely because another structure could also work.

## Stop Line

- Save the spec, run the drift check, record the outcome, and stop unless the user explicitly asks to continue from the saved checkpoint.
