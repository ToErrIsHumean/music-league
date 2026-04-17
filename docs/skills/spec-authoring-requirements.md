# Spec-Authoring Workflow Requirements

Status: in progress
Purpose: capture the agreed requirements for a future repeatable `spec-authoring` workflow/skill without relying on chat history
Last updated: 2026-04-17

## Scope

This document captures workflow requirements for authoring implementation specs in the Music League SDD workflow.

Out of scope:
- implementing the workflow/skill
- FSD standardization details

## Repo Context

- Music League is an SDD-driven workflow.
- Specs are derived from FSDs.
- The active spec/template path currently present in the repo is `docs/templates/SPEC_TEMPLATE.md`.
- `AGENTS.md` currently refers to `docs/SPEC_TEMPLATE.md`; for this discussion, use the actual template path on disk unless/until repo guidance is updated.

## Current Requirement Model

### 1. Exact Inputs

Required inputs:
- the source FSD
- the current codebase

Notes:
- There is no separate technical-summary artifact today.
- Technical context should be derived directly from repository evidence.
- The FSD is the product/source-of-truth input.
- The codebase is used for feasibility, alignment, constraints, and integration understanding.
- The workflow should not invent product requirements from current code behavior.

### 2. Transformation Policy

Primary heuristic:
- prioritize bug-free code
- prioritize maintainable/mutable code
- prioritize understandability for AI-native coding agents

Secondary heuristic:
- a pre-declared run parameter `X`
- `X` is explicit and predetermined, not inferred
- examples:
  - better user experience / stronger fidelity to the user story
  - developer automation
  - product-management idea quality

Decision rule:
- when the choice is architectural, prefer the primary heuristic
- if preferring the primary heuristic materially worsens `X`, flag the choice for HITL rather than deciding silently

### 3. Process Shape

- Spec authoring is a sequence of transformations, not a single pass.
- In practice, context often gets tight after two or three transformations.
- Preferred workflow is to write the spec to disk, open a new window, and resume.

Therefore:
- the workflow must checkpoint to disk between major transformations
- the workflow must be resumable from disk in a fresh window
- the workflow should optimize for bounded-context passes, not one giant end-to-end generation

### 4. Stage Lenses

- Authoring stages often use different evaluative lenses/prompts.
- Example lenses:
  - `architect`: logic and completeness, upstream/downstream implications
  - `designer`: failure conditions, unhappy paths, friction

Repeatable-workflow rule:
- each stage should have a default lens
- lens override is allowed explicitly
- the lens shapes emphasis, not authority
- a lens does not override source-of-truth rules or the global heuristic policy

### 5. Editing and Transformation Guardrails

Global guardrails:
- Do not change normative behavior.
- Do not remove a detail unless it still has one clear canonical home elsewhere in the spec.
- Keep the spec structurally valid against `docs/templates/SPEC_TEMPLATE.md`.
- At the end of an editing pass, summarize what was excised/merged and any remaining unavoidable duplication.
- Do not modify any spec author discoveries, if any.

Stage-intent nuance:
- early architect-style passes may cut/restructure more aggressively
- final passes cannot cut anything at all
- later/final passes are mostly for concise language and cleanup

Architect-specific note:
- architect passes should not cut major aspects of the User Story / FSD

### 6. Discoveries

- Discoveries live in their own spec section:
  - `Appendix D`
- Later passes must not modify spec-author discoveries.

## Open Areas Not Yet Pinned Down

- the ordered list of authoring stages
- default lens per stage
- which stages are allowed to restructure vs preserve only
- exact resume contract between stages
- required output artifact shape for checkpoints beyond the working spec itself
- how HITL flags should be recorded in the spec or side artifacts

## Continuation Prompt

Use this prompt in a fresh Codex window to continue the requirements discussion:

```text
We are continuing a requirements discussion for a future `spec-authoring` workflow/skill in `/home/zacha/music-league`.

Load and respect:
- `/home/zacha/music-league/AGENTS.md`
- `/home/zacha/music-league/docs/skills/spec-authoring-requirements.md`
- `/home/zacha/music-league/docs/templates/SPEC_TEMPLATE.md`

We are not implementing yet. We are capturing workflow requirements.

Please:
1. Read the requirements doc fully.
2. Briefly restate the current requirement model.
3. Continue the requirements discussion from the "Open Areas Not Yet Pinned Down" section.
4. Do not re-open settled points unless a new conflict or refinement appears.
5. Prefer updating the requirements doc as we go so the discussion remains resumable from disk.
```
