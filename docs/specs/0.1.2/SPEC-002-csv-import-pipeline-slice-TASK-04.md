# Slice: TASK-04 — Implement deterministic validation and issue generation

> **Depends-on:** TASK-03
> **Universal:** SPEC-002-csv-import-pipeline-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-3. `analyzeImportBatch(batchId)`

Suggested module: `src/import/analyze-batch.js`

```js
analyzeImportBatch(batchId: number): {
  batchId: number,
  status: 'ready' | 'failed',
  summary: {
    matchedPlayers: number,
    createdPlayers: number,
    matchedRounds: number,
    createdRounds: number,
    matchedSongs: number,
    createdSongs: number,
    matchedArtists: number,
    createdArtists: number,
    openBlockingIssues: number
  }
}

Errors:
  - batch not found
  - batch not mutable (`committed`)
```

**Contract rules:**

- Matching is deterministic only:
  1. Players by `sourcePlayerId`
  2. Rounds by `(leagueSlug = batch.gameKey, sourceRoundId)`
  3. Songs by `spotifyUri`
  4. Artists by normalized artist name
- Classification branches:
  - exact deterministic-key match -> matched
  - no canonical candidate -> create disposition
  - candidate with a conflicting deterministic identity -> blocking
    `identity_conflict`
- Validation covers at least:
  - missing derived `gameKey`
  - missing required source file
  - missing required field/header
  - row-level parse failure
  - invalid `pointsAssigned` (`pointsAssigned` must be an integer)
  - cross-file missing identity (`sourcePlayerId`, `sourceRoundId`, `spotifyUri`)
  - vote row without a resolvable submission in the same round
  - source-key identity conflict
- Before writing fresh validation results, replace the prior
  validation-originated issue set for the batch.
- `recordStatus` becomes `ready` only when the row is fully resolvable under
  deterministic batch rules.
- If any blocking issue remains after analysis, set batch status `failed`,
  `failureStage = validate`, persist `failureSummary`, and return `failed`.
- If zero blocking issues remain, clear `failureStage` and `failureSummary`, set
  batch status `ready`, and return `ready`.

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
| AC-02 | Missing any required source file or required header yields a blocking `ImportIssue` and the batch fails validation without canonical-table writes | `test` |
| AC-03 | A clean bundle can be staged and analyzed to `ready` with zero blocking issues and zero canonical-table writes before commit | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-05 | Attempting to commit any batch that is not `ready` fails and leaves canonical tables unchanged | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-07 | A batch containing a vote that cannot be attached to a submission in the same round fails validation and cannot commit | `test` |

---

4. **[TASK-04] Implement deterministic validation and issue generation** — Analyze staged rows, assign match/create dispositions, replace validation issues, and transition the batch to `ready` or `failed`.
   `contracts: §4d-3, §4b-5` · `preserves: INV-03, INV-04, INV-06, INV-09` · `validates: AC-02, AC-03, AC-05, AC-07`

---
