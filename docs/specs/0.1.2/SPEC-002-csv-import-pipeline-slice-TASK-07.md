# Slice: TASK-07 — Implement round-result recompute

> **Depends-on:** TASK-01
> **Universal:** SPEC-002-csv-import-pipeline-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-8. `recomputeRoundResults(roundIds)`

Suggested module: `src/import/recompute-round-results.js`

```js
recomputeRoundResults(roundIds: number[]): void
```

**Contract rules:**

- For each affected round, recompute from canonical `Vote` rows:
  - `Submission.score = SUM(vote.pointsAssigned)` grouped by `(roundId, songId)`
  - `Submission.rank` uses dense ranking by score DESC
- A submission with no vote rows in its round receives `score = null` and
  `rank = null`.
- Recompute operates only on rounds touched by the committing batch.
- Recompute assumes INV-09 already holds for the transactional candidate set. If
  a violating vote is detected, recompute must throw and cause commit rollback;
  it is not a recoverable scoring branch.

---

---

| ID | Condition | Verification |
|---|---|---|
| AC-09 | After commit, every affected round has `Submission.score` and `Submission.rank` values equal to those derived from canonical `Vote` rows, with unvoted submissions left null | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-12 | If any canonical write or round-result recompute fails during commit, the batch is not marked `committed` and canonical writes are rolled back | `test` |

---

7. **[TASK-07] Implement round-result recompute** — Recompute affected-round submission scores and dense ranks from canonical votes.
   `contracts: §4d-8` · `preserves: INV-04, INV-09` · `validates: AC-09, AC-12`

---
