# PLAN: CSV Import Pipeline — SPEC-002

> **Spec:** docs/specs/SPEC-002-csv-import-pipeline.md
> **Created:** 2026-04-17
> **Status:** `pending`

| Task | Title | Status | Depends-on |
| ---- | ----- | ------ | ---------- |
| TASK-01 | Extend the Prisma schema for strict staged import | `done` | — |
| TASK-02 | Implement bundle parsing | `done` | — |
| TASK-03 | Implement batch staging | `done` | TASK-01, TASK-02 |
| TASK-04 | Implement deterministic validation and issue generation | `done` | TASK-01, TASK-02, TASK-03 |
| TASK-05 | Implement issue reads | `done` | TASK-01, TASK-02, TASK-03, TASK-04 |
| TASK-06 | Implement summary and history reads | `done` | TASK-01, TASK-02, TASK-03, TASK-04 |
| TASK-07 | Implement round-result recompute | `done` | TASK-01 |
| TASK-08 | Implement transactional commit orchestration | `done` | TASK-01, TASK-02, TASK-03, TASK-04, TASK-07 |
| TASK-09 | Add integration tests for clean, failed, and replayed imports | `pending` | TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08 |

Status values: `pending` | `active` | `done` | `fail` | `blocked` | `skipped`

## Reasoning Effort Overrides

Default wrapper reasoning effort is `high`. List only tasks that need an
elevated override.

| Task | Reasoning-effort | Why |
|------|------------------|-----|
| TASK-08 | `xhigh` | Transactional commit combines replay-safe upserts, game-scoped snapshot reconciliation, rollback handling, and affected-round recompute in one boundary. |
| TASK-09 | `xhigh` | End-to-end coverage spans clean, failed, replay, duplicate-row, workflow-summary, and rollback paths across every §4d service boundary. |

## Signals Log

human-created signal for TASK-01 cycle 1

<!-- Append signals as tasks complete. -->

| Task | Signal | Discovery | Cycle | Model | Reasoning-Effort | Timestamp |
| ---- | ------ | --------- | ----- | ----- | ---------------- | --------- |
| TASK-01 | pass | null | 1 | gpt-5.4 | high | 7:26AM SGT |
| TASK-02 | blocked | D-001 | 1 | gpt-5.4 | high | 2026-04-16T23:30:20.007Z |
| TASK-02 | pass | null | 1 | gpt-5.4 | high | 2026-04-16T23:46:47.905Z |
| TASK-02 | pass | null | 2 | gpt-5.4 | high | 2026-04-16T23:50:52.665Z |
| TASK-03 | pass | null | 1 | gpt-5.4 | high | 2026-04-17T00:01:14.665Z |
| TASK-03 | pass | null | 2 | gpt-5.4 | high | 2026-04-17T00:08:39.056Z |
| TASK-04 | pass | null | 1 | gpt-5.4 | high | 2026-04-17T00:21:26.130Z |
| TASK-04 | pass | null | 2 | gpt-5.4 | high | 2026-04-17T00:28:16.786Z |
| TASK-05 | pass | null | 1 | gpt-5.4 | high | 2026-04-17T00:36:20.985Z |
| TASK-05 | pass | null | 2 | gpt-5.4 | high | 2026-04-17T00:42:05.160Z |
| TASK-06 | pass | null | 1 | gpt-5.4 | high | 2026-04-17T00:53:08.175Z |
| TASK-07 | pass | null | 1 | gpt-5.4 | high | 2026-04-17T01:00:19.945Z |
| TASK-08 | pass | null | 1 | gpt-5.4 | xhigh | 2026-04-17T01:17:11.109Z |

## Review Notes

- TASK-01 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-1.md`


- TASK-02 cycle 1: `contested` -> `docs/sdd/reviews/TASK-02-epoch-2-cycle-1.md`

- TASK-02 cycle 2: `deferred` -> `docs/sdd/reviews/TASK-02-epoch-2-cycle-2.md`

- TASK-03 cycle 1: `contested` -> `docs/sdd/reviews/TASK-03-epoch-1-cycle-1.md`

- TASK-03 cycle 2: `deferred` -> `docs/sdd/reviews/TASK-03-epoch-1-cycle-2.md`

- TASK-04 cycle 1: `contested` -> `docs/sdd/reviews/TASK-04-epoch-1-cycle-1.md`

- TASK-04 cycle 2: `deferred` -> `docs/sdd/reviews/TASK-04-epoch-1-cycle-2.md`

- TASK-05 cycle 1: `contested` -> `docs/sdd/reviews/TASK-05-epoch-1-cycle-1.md`

- TASK-05 cycle 2: `confirmed` -> `docs/sdd/reviews/TASK-05-epoch-1-cycle-2.md`

- TASK-06 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-06-epoch-1-cycle-1.md`

- TASK-07 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-07-epoch-1-cycle-1.md`

- TASK-08 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-08-epoch-1-cycle-1.md`