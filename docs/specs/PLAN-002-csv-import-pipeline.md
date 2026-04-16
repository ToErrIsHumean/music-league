# PLAN: CSV Import Pipeline — SPEC-002

> **Spec:** docs/specs/SPEC-002-csv-import-pipeline.md
> **Created:** 2026-04-17
> **Status:** `pending`

| Task | Title | Status | Depends-on |
| ---- | ----- | ------ | ---------- |
| TASK-01 | Extend the Prisma schema for strict staged import | `done` | — |
| TASK-02 | Implement bundle parsing | `pending` | — |
| TASK-03 | Implement batch staging | `pending` | TASK-01, TASK-02 |
| TASK-04 | Implement deterministic validation and issue generation | `pending` | TASK-01, TASK-02, TASK-03 |
| TASK-05 | Implement issue reads | `pending` | TASK-01, TASK-02, TASK-03, TASK-04 |
| TASK-06 | Implement summary and history reads | `pending` | TASK-01, TASK-02, TASK-03, TASK-04 |
| TASK-07 | Implement round-result recompute | `pending` | TASK-01 |
| TASK-08 | Implement transactional commit orchestration | `pending` | TASK-01, TASK-02, TASK-03, TASK-04, TASK-07 |
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

## Review Notes

- TASK-01 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-1.md`
