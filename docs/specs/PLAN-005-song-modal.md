# PLAN: Song Modal and Familiarity Cues — SPEC-005

> **Spec:** docs/specs/SPEC-005-song-modal.md
> **Created:** 2026-04-24
> **Status:** `pending`

| Task | Title | Status | Depends-on |
|------|-------|--------|------------|
| TASK-01 | Add shared song familiarity derivation | `pending` | — |
| TASK-02 | Hydrate round-detail familiarity cues | `pending` | TASK-01 |
| TASK-03 | Build canonical song memory payload | `pending` | TASK-01 |
| TASK-04 | Wire and render canonical song detail | `pending` | TASK-03 |
| TASK-05 | Converge player-history song taps on canonical song detail | `pending` | TASK-04 |
| TASK-06 | Expand M5 fixtures and integrated regressions | `pending` | TASK-01, TASK-02, TASK-03, TASK-04, TASK-05 |

Status values: `pending` | `active` | `done` | `fail` | `blocked` | `skipped`

## Reasoning Effort Overrides

Default wrapper reasoning effort is `high`. List only tasks that need an
elevated override.

| Task | Reasoning-effort | Why |
|------|------------------|-----|
| TASK-03 | `xhigh` | Crosses archive-wide query shaping, deterministic origin anchoring, summary synthesis, grouping, and unavailable-state payload rules in one session. |
| TASK-04 | `xhigh` | Couples route precedence, canonical modal wiring, unavailable-state rendering, provenance links, and close-state behavior across the archive UI. |
| TASK-06 | `xhigh` | Spans fixture expansion and integrated regressions across all prior contracts, including mixed-query precedence and canonical link convergence. |

## Signals Log

<!-- Append signals as tasks complete. -->

| Task | Signal | Discovery | Cycle | Model | Reasoning-Effort | Timestamp |
|------|--------|-----------|-------|-------|------------------|-----------|
| | | | | | | |
