# PLAN: Pre-M6 Corrective Game-Semantics Cleanup — SPEC-PRE-M6

> **Spec:** docs/specs/SPEC-PRE-M6-corrective-game-semantics-cleanup.md
> **Created:** 2026-04-24
> **Status:** `pending`

| Task | Title | Status | Depends-on |
| ---- | ----- | ------ | ---------- |
| TASK-01 | Patch snapshot, game, and standings source contracts | `done` | — |
| TASK-02 | Patch player-metric, source-setting, and vote-evidence source contracts | `done` | TASK-01 |
| TASK-03 | Patch song, artist, and M6 insight source contracts | `done` | TASK-01, TASK-02 |
| TASK-04 | Add semantic fixture bundles and manifest | `done` | TASK-01, TASK-02, TASK-03 |
| TASK-05 | Harden import and identity tests for game semantics | `pending` | TASK-04 |
| TASK-06 | Implement round vote breakdown evidence | `pending` | TASK-04, TASK-05 |
| TASK-07 | Add derived standings read model | `pending` | TASK-04, TASK-05 |
| TASK-08 | Normalize player, artist, and song-memory guardrails | `pending` | TASK-04, TASK-06, TASK-07 |

Status values: `pending` | `active` | `done` | `fail` | `blocked` | `skipped`

## Signals Log

<!-- Append signals as tasks complete. -->

| Task | Signal | Discovery | Cycle | Model | Reasoning-Effort | Timestamp |
| ---- | ------ | --------- | ----- | ----- | ---------------- | --------- |
| TASK-01 | fail | null | 1 | gpt-5.5 | high | 2026-04-24T23:08:02.323Z |
| TASK-01 | pass | null | 2 | gpt-5.5 | high | 2026-04-24T23:20:02.086Z |
| TASK-01 | pass | null | 3 | gpt-5.5 | high | 2026-04-24T23:26:18.665Z |
| TASK-02 | pass | null | 1 | gpt-5.5 | high | 2026-04-24T23:33:49.380Z |
| TASK-03 | pass | null | 1 | gpt-5.5 | high | 2026-04-24T23:41:18.580Z |
| TASK-03 | pass | null | 2 | gpt-5.5 | high | 2026-04-24T23:45:59.383Z |
| TASK-04 | pass | null | 1 | gpt-5.5 | high | 2026-04-24T23:52:15.303Z |
| TASK-04 | pass | null | 2 | gpt-5.5 | high | 2026-04-25T00:01:08.580Z |

## Review Notes

<!-- Orchestrator review notes append below. -->

- TASK-04 cycle 2: `confirmed` -> `docs/sdd/reviews/TASK-04-epoch-1-cycle-2.md`

- TASK-04 cycle 1: `contested` -> `docs/sdd/reviews/TASK-04-epoch-1-cycle-1.md`

- TASK-03 cycle 2: `confirmed` -> `docs/sdd/reviews/TASK-03-epoch-1-cycle-2.md`

- TASK-03 cycle 1: `contested` -> `docs/sdd/reviews/TASK-03-epoch-1-cycle-1.md`

- TASK-02 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-02-epoch-1-cycle-1.md`

- TASK-01 cycle 3: `confirmed` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-3.md`

- TASK-01 cycle 2: `contested` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-2.md`

- TASK-01 cycle 1: `contested` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-1.md`
