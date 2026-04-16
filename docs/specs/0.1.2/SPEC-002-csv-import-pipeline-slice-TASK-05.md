# Slice: TASK-05 — Implement issue reads

> **Depends-on:** TASK-04
> **Universal:** SPEC-002-csv-import-pipeline-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-4. `listImportBatchIssues(batchId)`

Suggested module: `src/import/list-batch-issues.js`

```js
listImportBatchIssues(batchId: number): Array<{
  issueId: number,
  blocking: boolean,
  sourceFileKind: 'batch' | 'competitors' | 'rounds' | 'submissions' | 'votes',
  sourceRowNumber: number | null,
  recordKind: 'batch' | 'player' | 'round' | 'submission' | 'vote',
  issueCode: string,
  message: string,
  rowPreview: Record<string, string | number | boolean | null>
}>

Errors:
  - batch not found
```

**Contract rules:**

- Every blocking issue must include enough row context for debugging.
- `rowPreview` is reconstructed from the staged row when available; otherwise it
  is decoded from `ImportIssue.rowPreviewJson`.
- `rowPreview` is informational only; this milestone does not support mutating
  staged data through this interface.

---

#### §4b-5. Issue audit

```prisma
model ImportIssue {
  id               Int         @id @default(autoincrement())
  importBatchId    Int
  sourceFileKind   String      // batch | competitors | rounds | submissions | votes
  sourceRowNumber  Int?
  recordKind       String      // batch | player | round | submission | vote
  issueCode        String      // missing_file | missing_header | parse_error | unresolved_ref | duplicate_source_row | invalid_scalar | identity_conflict
  blocking         Boolean     @default(true)
  message          String
  rowPreviewJson   String?     // compact JSON object used when no staged row exists or preview must be preserved verbatim
  createdAt        DateTime    @default(now())

  importBatch      ImportBatch @relation(fields: [importBatchId], references: [id])

  @@index([importBatchId, sourceFileKind])
}
```

**Contract notes:**

- Issues are anchored by `(importBatchId, sourceFileKind, sourceRowNumber)`,
  not polymorphic foreign keys to staged row tables.
- Issues are machine-generated diagnostics only. Each validation pass replaces
  the prior issue set for the batch rather than resolving issues in place.
- `rowPreviewJson` canonically stores parser-originated issue context and any
  issue whose preview cannot be reconstructed from a staged row.
- Original raw CSV blobs are out of scope.

---

---

| ID | Condition | Verification |
|---|---|---|
| AC-04 | `listImportBatchIssues(batchId)` returns every blocking issue with row-level context sufficient for debugging | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-11 | The internal import workflow is adapter-neutral: a bundle-path ingest followed by issue listing, summary, and commit can be exercised entirely through the §4d service contracts | `test` |

---

5. **[TASK-05] Implement issue reads** — Expose diagnostic issue listing with row previews derived from current batch state.
   `contracts: §4d-4, §4b-5` · `preserves: INV-03, INV-07` · `validates: AC-04, AC-11`

---
