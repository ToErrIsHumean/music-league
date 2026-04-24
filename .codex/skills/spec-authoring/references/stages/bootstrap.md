# `bootstrap`

Load this file together with [../core.md](../core.md).

## Purpose

- Produce the first full structurally valid draft.
- Use the FSD actively as the working product source of truth throughout this stage.

## Default Lens

- architecture-first

## Required Output

- all sections present
- `§1`, `§2`, `§3`, `§5`, `§7`, and `§8` drafted from FSD plus repo evidence
- `§4` present across the touched boundaries, even if still broad
- `§6` mostly nailed down
- `§6` may reference `§4` entries that are still broad, provided those `§4` entries already identify the touched boundary clearly enough for task decomposition

## Allowed

- broad `§4` language
- active OQ creation and early OQ resolution inside the same pass
- aggressive restructuring of draft wording where needed

## Forbidden

- missing major sections
- silently inventing product behavior
- locking in implementation-detail commitments not justified by FSD or repo evidence

## Exit Criteria

- the spec is structurally valid
- a future window can resume from the saved draft
- meaningful uncertainty is captured in `§8`

## End-Of-Stage Drift Check

- Re-check the saved draft against the FSD for normative behavior drift, omitted required user-story substance, accidental scope expansion, and missing downgrade traceability.

## Default Repeat Rule

- Run once.
- Repeat only if the saved draft is not yet a usable full checkpoint.

## Anti-Overreach Rule

- Do not repeat `bootstrap` to make the first draft prettier, broader, or more polished than needed for a resumable checkpoint.

## Stop Line

- Save the spec, run the drift check, record the outcome, and stop unless the user explicitly asks to continue from the saved checkpoint.
