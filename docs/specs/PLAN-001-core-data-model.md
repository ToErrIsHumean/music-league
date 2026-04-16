# PLAN: Core Data Model — SPEC-001

> **Spec:** docs/specs/SPEC-001-core-data-model.md
> **Created:** 2026-04-16
> **Status:** `pending`

| Task | Title | Status | Depends-on |
| ---- | ----- | ------ | ---------- |
| TASK-00 | Initialize project | `done` | — |
| TASK-01 | Define Prisma schema | `done` | TASK-00 |
| TASK-02a | Generate initial migration | `blocked` | TASK-01 |
| TASK-02b | Constraint tests | `pending` | TASK-02a |
| TASK-03 | Implement normalization utility | `done` | — |
| TASK-04a | Seed reference data | `pending` | TASK-02a, TASK-03 |
| TASK-04b | Seed transactional data + derive scores | `pending` | TASK-04a |
| TASK-05 | Verify query patterns against seed data | `pending` | TASK-02b, TASK-03, TASK-04b |

Status values: `pending` | `active` | `done` | `fail` | `blocked` | `skipped`

## Signals Log

<!-- Append signals as tasks complete. -->

| Task | Signal | Discovery | Cycle | Model | Reasoning-Effort | Timestamp |
| ---- | ------ | --------- | ----- | ----- | ---------------- | --------- |
| TASK-00 | pass | null | 1 | gpt-5.4 | high | 2026-04-16T00:58:24.445Z |
| TASK-00 | pass | null | 2 | gpt-5.4 | high | 2026-04-16T01:03:31.236Z |
| TASK-01 | pass | null | 1 | gpt-5.4 | high | 2026-04-16T01:54:36.154Z |
| TASK-02a | pass | null | 1 | gpt-5.4 | high | 2026-04-16T01:59:53.366Z |
| TASK-02a | blocked | null | 2 | llm-fallback | unknown | 2026-04-16T02:26:42.661Z |
| TASK-03 | pass | null | 1 | gpt-5.4 | high | 2026-04-16T02:28:02.273Z |

## Review Notes

<!-- Orchestrator review notes append below. -->

- TASK-03 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-03-epoch-1-cycle-1.md`

- TASK-01 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-1.md`

- TASK-00 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-00-epoch-1-cycle-1.md`
