# Slice: TASK-06 — Implement summary and history reads

> **Depends-on:** TASK-04
> **Universal:** SPEC-002-csv-import-pipeline-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-5. `getImportBatchSummary(batchId)`

Suggested module: `src/import/get-batch-summary.js`

```js
getImportBatchSummary(batchId: number): {
  batchId: number,
  gameKey: string | null,
  status: 'parsed' | 'ready' | 'committed' | 'failed',
  workflow: {
    stages: {
      parse: 'pending' | 'current' | 'complete',
      stage: 'pending' | 'current' | 'complete',
      validate: 'pending' | 'current' | 'complete',
      commit: 'pending' | 'current' | 'complete'
    },
    awaiting: 'system' | 'none'
  },
  rowCounts: {
    competitors: number,
    rounds: number,
    submissions: number,
    votes: number,
    total: number
  },
  matchCounts: {
    matched: number,
    newEntities: number,
    openIssues: number
  },
  createdEntityPlan: {
    players: number,
    rounds: number,
    artists: number,
    songs: number
  },
  committedEntityCounts: {
    players: number,
    rounds: number,
    artists: number,
    songs: number,
    submissionsUpserted: number,
    votesUpserted: number
  },
  affectedRounds: number[],
  failureStage: 'stage' | 'validate' | 'commit' | null,
  failureSummary: string | null
}

Errors:
  - batch not found
```

**Contract rules:**

- A user-facing surface may format this summary differently but may not invent
  fields that bypass staged/import truth.
- `workflow.stages` is the canonical batch progress model for this milestone.
- `workflow.awaiting = system` means another import service call is still
  required; `none` means the batch is terminal or ready to commit.
- Stage mapping is status-driven:
  - `parsed` -> `parse = complete`, `stage = complete`, `validate = current`, `commit = pending`, `awaiting = system`
  - `ready` -> `parse = complete`, `stage = complete`, `validate = complete`, `commit = pending`, `awaiting = none`
  - `committed` -> all stages `complete`, `awaiting = none`
  - `failed` with `failureStage = stage` -> `parse = complete`, `stage = current`, later stages `pending`, `awaiting = none`
  - `failed` with `failureStage = validate` -> `parse = complete`, `stage = complete`, `validate = current`, `commit = pending`, `awaiting = none`
  - `failed` with `failureStage = commit` -> `parse = complete`, `stage = complete`, `validate = complete`, `commit = current`, `awaiting = none`
- `committedEntityCounts` reflects the persisted per-batch commit snapshot; it
  is all zeroes before commit.

#### §4d-6. `listImportBatches(input?)`

Suggested module: `src/import/list-batches.js`

```js
listImportBatches(input?: {
  statuses?: Array<'parsed' | 'ready' | 'committed' | 'failed'>,
  limit?: number
}): Array<{
  batchId: number,
  gameKey: string | null,
  sourceFilename: string | null,
  status: 'parsed' | 'ready' | 'committed' | 'failed',
  rowCount: number,
  issueCount: number,
  createdCounts: {
    players: number,
    rounds: number,
    artists: number,
    songs: number,
    submissionsUpserted: number,
    votesUpserted: number
  },
  committedAt: Date | null,
  failureStage: 'stage' | 'validate' | 'commit' | null,
  failureSummary: string | null,
  createdAt: Date,
  updatedAt: Date
}>
```

**Contract rules:**

- `createdCounts` is the persisted per-batch snapshot of canonical rows created
  or upserted by commit; it remains zeroed for uncommitted batches.
- `statuses` filters by exact batch status; omitted means no status filter.
- `limit` caps result count; omitted means implementation default.

---

| ID | Condition | Verification |
|---|---|---|
| AC-10 | Batch summary/history exposes batch status, per-file row counts, issue counts, `failureStage`, and `failureSummary` for failed and committed imports | `test` |
| AC-11 | The internal import workflow is adapter-neutral: a bundle-path ingest followed by issue listing, summary, and commit can be exercised entirely through the §4d service contracts | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-15 | `getImportBatchSummary(batchId)` exposes batch workflow stage progress and whether the batch is still awaiting system work | `test` |

---

6. **[TASK-06] Implement summary and history reads** — Add batch summary and batch-history read surfaces for parsed, ready, failed, and committed imports.
   `contracts: §4d-5, §4d-6` · `preserves: INV-01, INV-07` · `validates: AC-10, AC-11, AC-15`

---
