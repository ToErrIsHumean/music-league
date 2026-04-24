# PLAN: Song Modal and Familiarity Cues — SPEC-005

> **Spec:** docs/specs/SPEC-005-song-modal.md
> **Created:** 2026-04-24
> **Status:** `pending`

| Task | Title | Status | Depends-on |
| ---- | ----- | ------ | ---------- |
| TASK-01 | Add shared song familiarity derivation | `done` | — |
| TASK-02 | Hydrate round-detail familiarity cues | `done` | TASK-01 |
| TASK-03 | Build canonical song memory payload | `done` | TASK-01 |
| TASK-04 | Wire and render canonical song detail | `done` | TASK-03 |
| TASK-05 | Converge player-history song taps on canonical song detail | `done` | TASK-04 |
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
| ---- | ------ | --------- | ----- | ----- | ---------------- | --------- |
| TASK-01 | pass | null | 1 | gpt-5.5 | high | 2026-04-24T08:20:25.658Z |
| TASK-02 | pass | null | 1 | gpt-5.5 | high | 2026-04-24T08:32:56.833Z |
| TASK-02 | pass | null | 2 | gpt-5.5 | high | 2026-04-24T08:47:12.830Z |
| TASK-02 | pass | null | 3 | gpt-5.5 | high | 2026-04-24T08:53:27.744Z |
| TASK-03 | pass | null | 1 | gpt-5.5 | xhigh | 2026-04-24T09:08:07.381Z |
| TASK-04 | pass | null | 1 | gpt-5.5 | xhigh | 2026-04-24T09:23:24.691Z |
| TASK-05 | pass | null | 1 | gpt-5.5 | high | 2026-04-24T09:28:42.404Z |

## Review Notes

<!-- Orchestrator review notes append below. -->

- TASK-05 cycle 1: `deferred` -> `docs/sdd/reviews/TASK-05-epoch-1-cycle-1.md`

- TASK-04 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-04-epoch-1-cycle-1.md`

- TASK-03 cycle 1: `deferred` -> `docs/sdd/reviews/TASK-03-epoch-1-cycle-1.md`

- TASK-02 cycle 3: `confirmed` -> `docs/sdd/reviews/TASK-02-epoch-1-cycle-3.md`

- TASK-02 cycle 2: `contested` -> `docs/sdd/reviews/TASK-02-epoch-1-cycle-2.md`

- TASK-02 cycle 1: `contested` -> `docs/sdd/reviews/TASK-02-epoch-1-cycle-1.md`

- TASK-01 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-1.md`
