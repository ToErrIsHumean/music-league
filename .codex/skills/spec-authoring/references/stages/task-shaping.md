# `task-shaping`

Load this file together with [../core.md](../core.md).

## Purpose

- Reduce entropy and make the spec executable for implementers.
- Work primarily from the saved spec plus repo evidence, not from an always-hot FSD context.

## Default Lens

- architect with decomposition bias

## Review Focus

- `§4` / `§5` / `§6` alignment
- task completeness
- whether tasks should be split
- whether a task depends on undeclared contracts
- whether any `§2 Prior State` artifact needs a `TASK-00` conformance pass before feature work

## Operating Sequence

1. Map each touched `§4` contract to a task owner in `§6`.
2. Check whether each candidate task is executable from the contracts it cites; if not, harden `§4` or reassign ownership before shaping further.
3. Split tasks that mix materially different validation seams, review questions, or failure modes.
4. Split tasks that mix substrate creation with nontrivial policy, session, or mutation semantics on that substrate.
5. Resequence tasks so foundational seams land before their semantic consumers; do not let an earlier plumbing task partially implement behavior that a later task nominally owns.
6. Decide whether `TASK-00` is required for any nonconformant touched `§2` artifact.
7. Verify `§5` acceptance-criteria coverage and `§6` dependency coherence.

## Decomposition Rules

- Prefer tasks with one dominant review question and one dominant validation seam.
- Split a task when one part could reasonably be `confirmed` while another part would still be `contested` or `deferred`.
- Split a task when it depends on undeclared downstream behavior that belongs in a later task's contracts.
- Keep transport, facade, schema, or bootstrap establishment separate from stateful policy and mutation semantics unless the semantic layer is trivial or the change must be atomic for correctness.
- Consolidate adjacent tasks when they share one dominant validation seam, would normally be reviewed as a unit, and separating them would add ceremony without improving correctness or sliceability.
- Do not force a split when the substrate and semantics would always rise and fall together and separating them would add ceremony without reducing risk.

## Allowed

- tightening language
- splitting or resequencing tasks
- hardening broad `§4` entries into concrete contracts

## Forbidden

- adding speculative complexity without implementation benefit
- changing normative behavior

## Exit Criteria

- every task is executable from the contracts it cites
- every task has one dominant validation seam and no avoidable overlap with later task ownership
- `§5` acceptance criteria are covered
- `§6` dependency graph is coherent
- `TASK-00` is present first when any `§2` artifact is nonconformant, otherwise omitted

## End-Of-Stage Drift Check

- Load the FSD at stage end and confirm task decomposition and contract hardening did not introduce new behavior, drop required behavior, or lose downgrade traceability.

## Default Repeat Rule

- Repeat only while task splits, dependency fixes, or contract-task alignment changes are still materially improving implementability.

## Anti-Overreach Rule

- Do not reopen `task-shaping` merely because tasks could be split differently, resequenced differently, or described more elegantly.
- Once tasks are executable, contract-backed, and dependency-coherent, move on.

## Stop Line

- Save the spec, run the drift check, record the outcome, and stop unless the user explicitly asks to continue from the saved checkpoint.
