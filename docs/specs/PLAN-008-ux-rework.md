# PLAN: UX Rework — SPEC-008

> **Spec:** docs/specs/SPEC-008-ux-rework.md
> **Created:** 2026-04-26
> **Status:** `pending`

| Task | Title | Status | Depends-on |
| ---- | ----- | ------ | ---------- |
| TASK-01 | Replace overlay routing with real route skeletons | `done` | — |
| TASK-02 | Establish archive visual tokens and badge primitives | `done` | TASK-01 |
| TASK-03 | Introduce persistent archive shell chrome | `done` | TASK-01, TASK-02 |
| TASK-04 | Centralize M8 derivation utilities | `done` | TASK-01 |
| TASK-05 | Implement header interactions and search suggestions | `done` | TASK-03, TASK-04 |
| TASK-06 | Build the landing page | `done` | TASK-03, TASK-04 |
| TASK-07 | Build the game page | `done` | TASK-03, TASK-04 |
| TASK-08 | Build the round page and inline vote disclosures | `done` | TASK-03, TASK-04 |
| TASK-09 | Build song browser route | `done` | TASK-03, TASK-04 |
| TASK-10 | Build song detail route | `done` | TASK-03, TASK-04 |
| TASK-11 | Build player detail route and trait registry | `done` | TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10 |
| TASK-12 | Run cross-route accessibility and regression hardening | `pending` | TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10, TASK-11 |

Status values: `pending` | `active` | `done` | `fail` | `blocked` | `skipped`

## Reasoning Effort Overrides

Default wrapper reasoning effort is `high`. List only tasks that need an
elevated override.

| Task | Reasoning-effort | Why |
|------|------------------|-----|
| TASK-04 | `xhigh` | Centralizes multiple cross-route derivations, including event chronology, tie logic, catalog normalization, vote attribution, route result types, and round ordering. |
| TASK-05 | `xhigh` | Couples the read-only suggestions endpoint with debounced client search, live-region behavior, keyboard switcher navigation, and non-persistent header state. |
| TASK-09 | `xhigh` | Combines URL-backed search/filter/sort state with debounced live result binding, catalog caps, familiarity consistency, and zero/empty archive states. |
| TASK-11 | `xhigh` | Spans player aggregates, thresholded trait registry logic, notable-pick selection, scoped vote aggregation, vote-to-submission attribution, negative vote display, and route links. |
| TASK-12 | `xhigh` | Verifies the full cross-route matrix across accessibility, retired params, responsive screenshots, shared shell behavior, badge IDs, token consumption, and out-of-scope exclusions. |

## Signals Log

<!-- Append signals as tasks complete. -->

| Task | Signal | Discovery | Cycle | Model | Reasoning-Effort | Timestamp |
| ---- | ------ | --------- | ----- | ----- | ---------------- | --------- |
| TASK-01 | pass | null | 1 | gpt-5.5 | high | 2026-04-26T03:27:16.666Z |
| TASK-01 | pass | null | 2 | gpt-5.5 | high | 2026-04-26T03:40:00.307Z |
| TASK-01 | pass | null | 3 | gpt-5.5 | high | 2026-04-26T03:45:25.191Z |
| TASK-02 | pass | null | 1 | gpt-5.5 | high | 2026-04-26T03:56:16.993Z |
| TASK-03 | pass | null | 1 | gpt-5.5 | high | 2026-04-26T04:10:34.657Z |
| TASK-03 | pass | null | 2 | gpt-5.5 | high | 2026-04-26T04:16:14.987Z |
| TASK-04 | pass | null | 1 | gpt-5.5 | xhigh | 2026-04-26T04:36:03.605Z |
| TASK-04 | pass | null | 2 | gpt-5.5 | xhigh | 2026-04-26T04:45:26.621Z |
| TASK-05 | pass | null | 1 | gpt-5.5 | xhigh | 2026-04-26T05:00:44.952Z |
| TASK-06 | pass | null | 1 | gpt-5.5 | high | 2026-04-26T05:15:38.209Z |
| TASK-07 | pass | null | 1 | gpt-5.5 | high | 2026-04-26T05:26:36.874Z |
| TASK-08 | pass | null | 1 | gpt-5.5 | high | 2026-04-26T05:41:34.064Z |
| TASK-09 | pass | null | 1 | gpt-5.5 | xhigh | 2026-04-26T05:56:22.873Z |
| TASK-10 | pass | null | 1 | gpt-5.5 | high | 2026-04-26T06:10:25.338Z |
| TASK-11 | pass | null | 1 | gpt-5.5 | xhigh | 2026-04-26T06:30:11.954Z |

## Review Notes

<!-- Orchestrator review notes append below. -->

- TASK-11 cycle 1: `deferred` -> `docs/sdd/reviews/TASK-11-epoch-1-cycle-1.md`

- TASK-10 cycle 1: `deferred` -> `docs/sdd/reviews/TASK-10-epoch-1-cycle-1.md`

- TASK-09 cycle 1: `deferred` -> `docs/sdd/reviews/TASK-09-epoch-1-cycle-1.md`

- TASK-08 cycle 1: `deferred` -> `docs/sdd/reviews/TASK-08-epoch-1-cycle-1.md`

- TASK-07 cycle 1: `deferred` -> `docs/sdd/reviews/TASK-07-epoch-1-cycle-1.md`

- TASK-06 cycle 1: `deferred` -> `docs/sdd/reviews/TASK-06-epoch-1-cycle-1.md`

- TASK-05 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-05-epoch-1-cycle-1.md`

- TASK-04 cycle 2: `confirmed` -> `docs/sdd/reviews/TASK-04-epoch-1-cycle-2.md`

- TASK-04 cycle 1: `contested` -> `docs/sdd/reviews/TASK-04-epoch-1-cycle-1.md`

- TASK-03 cycle 2: `confirmed` -> `docs/sdd/reviews/TASK-03-epoch-1-cycle-2.md`

- TASK-03 cycle 1: `contested` -> `docs/sdd/reviews/TASK-03-epoch-1-cycle-1.md`

- TASK-02 cycle 1: `confirmed` -> `docs/sdd/reviews/TASK-02-epoch-1-cycle-1.md`

- TASK-01 cycle 3: `confirmed` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-3.md`

- TASK-01 cycle 2: `contested` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-2.md`

- TASK-01 cycle 1: `contested` -> `docs/sdd/reviews/TASK-01-epoch-1-cycle-1.md`
