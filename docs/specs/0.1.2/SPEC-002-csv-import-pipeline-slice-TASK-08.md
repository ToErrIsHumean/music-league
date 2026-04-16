# Slice: TASK-08 — Implement transactional commit orchestration

> **Depends-on:** TASK-04, TASK-07
> **Universal:** SPEC-002-csv-import-pipeline-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-7. `commitImportBatch(batchId)`

Suggested module: `src/import/commit-batch.js`

```js
commitImportBatch(batchId: number): {
  batchId: number,
  status: 'committed',
  canonicalWrites: {
    playersCreated: number,
    roundsCreated: number,
    artistsCreated: number,
    songsCreated: number,
    submissionsUpserted: number,
    votesUpserted: number
  },
  affectedRoundIds: number[]
}

Errors:
  - batch not found
  - batch status is not `ready`
  - open blocking issues remain
  - any canonical write fails
  - affected-round outcome recompute fails
```

**Commit rules:**

- One transaction boundary covers:
  - creation/upsert of canonical identities approved by deterministic staged data
  - snapshot reconciliation of canonical rows scoped to `batch.gameKey`
  - upsert of `Submission` and `Vote`
  - recomputation of `Submission.score` and `Submission.rank` for all affected
    rounds
  - persistence of committed entity-count snapshot on `ImportBatch`
  - final `ImportBatch.status = committed` and `committedAt`
- Failure branches:
  - precondition failure before canonical writes (`batch not found`, status not
    `ready`, open blocking issues) -> return an error and leave batch status
    unchanged
  - failure after transactional work begins (`canonical write fails` or
    `affected-round outcome recompute fails`) -> roll back canonical writes,
    then mark the batch `failed`, set `failureStage = commit`, and persist
    `failureSummary` in a follow-up audit write
- Replay safety rules:
  - `Player` upsert key: `sourcePlayerId`
  - `Round` upsert key: `(leagueSlug = batch.gameKey, sourceRoundId)`
  - `Song` upsert key: `spotifyUri`
  - `Artist` upsert key: `normalizedName`
  - `Submission` upsert key: `(roundId, playerId, songId)`
  - `Vote` upsert key: `(roundId, voterId, songId)`
- Snapshot overwrite rules:
  - Re-ingesting a bundle whose derived `gameKey` matches an existing imported
    game overwrites that game's canonical snapshot.
  - After commit, canonical `Round` rows with `leagueSlug = batch.gameKey` and
    their dependent `Submission` and `Vote` rows must match the incoming staged
    bundle exactly.
  - Canonical rows for the same `gameKey` that are absent from the incoming
    bundle are deleted as part of the commit transaction.
  - Global `Player`, `Artist`, and `Song` rows are never deleted solely because
    they are absent from a later bundle.
- Canonical field hydration rules:
  - `Player.displayName` refreshes from the source row that matches
    `sourcePlayerId`
  - `Artist.name` may refresh from the source row that matches
    `normalizedName`
  - `Song.title` and `normalizedTitle` may refresh from the source row that
    matches `spotifyUri`
  - `Round.name`, `description`, `playlistUrl`, and `occurredAt` may refresh
    from the source row that matches `(leagueSlug = batch.gameKey, sourceRoundId)`
  - `Submission.submittedAt`, `comment`, `visibleToVoters`, and
    `sourceImportId` must be written from the staged row
  - `Vote.votedAt`, `comment`, and `sourceImportId` must be written from the
    staged row
- On upsert conflicts, non-identity source-derived fields may be refreshed, but
  identity changes that would remap an existing canonical record to a different
  deterministic key become blocking conflicts rather than silent rewrites.
- Rows absent from the committing bundle are left untouched only when they are
  outside the committing batch's `gameKey`.

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

#### §4b-1. ImportBatch evolution

File: `prisma/schema.prisma` (new migration extends existing model)

```prisma
model ImportBatch {
  id              Int              @id @default(autoincrement())
  sourceType      String           // "music-league-csv"
  sourceFilename  String?          // bundle label, archive name, or directory name
  gameKey         String?          // derived from the first valid typed round row; null until derivation succeeds
  status          String           // parsed | ready | committed | failed
  rowCount        Int              @default(0) // total staged rows across all source files
  issueCount      Int              @default(0) // current blocking issue records for this batch
  createdPlayerCount Int           @default(0)
  createdRoundCount  Int           @default(0)
  createdArtistCount Int           @default(0)
  createdSongCount   Int           @default(0)
  submissionsUpsertedCount Int     @default(0)
  votesUpsertedCount Int           @default(0)
  committedAt     DateTime?
  failureStage    String?          // stage | validate | commit
  failureSummary  String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  sourceFiles     ImportSourceFile[]
  playerRows      ImportPlayerRow[]
  roundRows       ImportRoundRow[]
  submissionRows  ImportSubmissionRow[]
  voteRows        ImportVoteRow[]
  issues          ImportIssue[]
  submissions     Submission[]
  votes           Vote[]

  @@index([gameKey])
}
```

**Status semantics:**

- `parsed`: bundle parse/stage completed and staged data plus parser-originated
  issues were persisted; deterministic validation pending
- `ready`: no blocking issues remain; commit permitted
- `committed`: canonical upserts and outcome recompute succeeded
- `failed`: staging, validation, or commit failed; `failureStage` names the
  pipeline stage that failed

---

| ID | Condition | Verification |
|---|---|---|
| AC-05 | Attempting to commit any batch that is not `ready` fails and leaves canonical tables unchanged | `test` |
| AC-06 | Committing a `ready` batch creates or upserts the required canonical players, rounds, artists, songs, submissions, and votes with correct relationships, hydrated source-derived fields, and `sourceImportId` set on committed submissions and votes | `test` |
| AC-07 | A batch containing a vote that cannot be attached to a submission in the same round fails validation and cannot commit | `test` |
| AC-08 | Re-ingesting and committing the same logical bundle, or a later full-snapshot bundle with the same derived `gameKey`, does not create duplicate canonical players, rounds, artists, songs, submissions, or votes and removes stale game-scoped rounds, submissions, and votes omitted from the incoming bundle | `test` |
| AC-09 | After commit, every affected round has `Submission.score` and `Submission.rank` values equal to those derived from canonical `Vote` rows, with unvoted submissions left null | `test` |
| AC-10 | Batch summary/history exposes batch status, per-file row counts, issue counts, `failureStage`, and `failureSummary` for failed and committed imports | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-12 | If any canonical write or round-result recompute fails during commit, the batch is not marked `committed` and canonical writes are rolled back | `test` |

---

8. **[TASK-08] Implement transactional commit orchestration** — Upsert canonical entities from a `ready` batch, upsert submissions and votes with replay-safe keys, call round-result recompute, and enforce rollback/failure-state handling.
   `contracts: §4d-7, §4d-8, §4b-1` · `preserves: INV-01, INV-02, INV-04, INV-06, INV-08, INV-09, INV-10` · `validates: AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-12`

---
