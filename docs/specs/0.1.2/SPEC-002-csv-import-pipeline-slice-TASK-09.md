# Slice: TASK-09 — Add integration tests for clean, failed, and replayed imports

> **Depends-on:** TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08
> **Universal:** SPEC-002-csv-import-pipeline-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-1. `parseMusicLeagueBundle(input)`

Suggested module: `src/import/parse-bundle.js`

```js
parseMusicLeagueBundle(input: {
  bundlePath: string,
  sourceLabel?: string
}): {
  sourceLabel: string,
  gameKey: string | null,
  issues: Array<{
    sourceFileKind: 'batch' | 'competitors' | 'rounds' | 'submissions' | 'votes',
    sourceRowNumber: number | null,
    issueCode: 'missing_file' | 'missing_header' | 'parse_error' | 'invalid_scalar',
    message: string,
    rowPreview: Record<string, string | number | boolean | null>
  }>,
  files: {
    competitors: {
      filename: string,
      rowCount: number,
      rows: Array<{
        sourceRowNumber: number,
        sourcePlayerId: string,
        displayName: string
      }>
    },
    rounds: {
      filename: string,
      rowCount: number,
      rows: Array<{
        sourceRowNumber: number,
        sourceRoundId: string,
        occurredAt: Date | null,
        name: string,
        description: string | null,
        playlistUrl: string | null
      }>
    },
    submissions: {
      filename: string,
      rowCount: number,
      rows: Array<{
        sourceRowNumber: number,
        spotifyUri: string,
        title: string,
        artistName: string,
        sourceSubmitterId: string,
        submittedAt: Date | null,
        comment: string | null,
        sourceRoundId: string,
        visibleToVoters: boolean | null
      }>
    },
    votes: {
      filename: string,
      rowCount: number,
      rows: Array<{
        sourceRowNumber: number,
        spotifyUri: string,
        sourceVoterId: string,
        votedAt: Date | null,
        pointsAssigned: number,
        comment: string | null,
        sourceRoundId: string
      }>
    }
  }
}

Errors:
  - unreadable bundle path
  - unreadable CSV file
```

**Contract rules:**

- The parser enforces the four-file bundle contract (INV-05).
- `bundlePath` is a directory path containing the required CSV filenames.
- The bundle is interpreted as exactly one game snapshot.
- The parser requires these source headers before header normalization:
  - `competitors.csv`: `ID`, `Name`
  - `rounds.csv`: `ID`, `Created`, `Name`, `Description`, `Playlist URL`
  - `submissions.csv`: `Spotify URI`, `Title`, `Artist(s)`, `Submitter ID`,
    `Created`, `Comment`, `Round ID`, `Visible To Voters`
  - `votes.csv`: `Spotify URI`, `Voter ID`, `Created`, `Points Assigned`,
    `Comment`, `Round ID`
- Header normalization is case-insensitive and whitespace-insensitive; extra
  source columns are ignored.
- Scalar coercion rules are:
  - timestamp fields (`Created`) parse as ISO-8601 timestamps to `Date`; blank
    values become `null` where the typed row allows null
  - `Visible To Voters`: `Yes` -> `true`, `No` -> `false`, blank -> `null`
  - `Points Assigned` parses as a base-10 integer and may be negative, zero, or
    positive; invalid values emit `invalid_scalar`
- The parser does not normalize or validate non-scalar string values beyond CSV
  decoding and header normalization.
- `rowCount` counts source data rows encountered in the file, even when a row
  also emits a parse issue.
- In an otherwise readable bundle, `missing_file`, `missing_header`,
  `parse_error`, and `invalid_scalar` are surfaced through `issues`, not thrown
  errors.
- Each parser-originated issue carries best-effort `rowPreview`; use `{}` when
  no row-level preview exists, such as `missing_file`.
- Invalid rows are not emitted in typed `rows`.
- `gameKey` is derived from the first valid typed round row in file order whose
  `sourceRoundId` is non-empty after trimming.
- If no such round row exists, `gameKey` is `null`; later analysis must treat
  missing `gameKey` as a blocking batch issue.

#### §4d-2. `stageImportBundle(input)`

Suggested module: `src/import/stage-batch.js`

```js
stageImportBundle(input: {
  parsedBundle: ReturnType<typeof parseMusicLeagueBundle>
}): {
  batchId: number,
  gameKey: string | null,
  status: 'parsed',
  rowCounts: {
    competitors: number,
    rounds: number,
    submissions: number,
    votes: number,
    total: number
  }
}
```

**Contract rules:**

- Creates `ImportBatch`, `ImportSourceFile`, staged row records, and parser
  issues only.
- `stageImportBundle()` creates the batch in `parsed` after persisting source
  files and staged rows.
- Persists `parsedBundle.gameKey` onto `ImportBatch.gameKey`.
- If any irrecoverable staging write fails after the batch is created,
  `stageImportBundle()` must mark the batch `failed`, set
  `failureStage = stage`, persist `failureSummary`, and then rethrow.
- Before staged-row inserts, detect duplicate source keys anywhere in the
  bundle. Persist them as blocking `duplicate_source_row` issues and skip
  inserting the offending duplicate rows. Source keys are:
  - competitors: `sourcePlayerId`
  - rounds: `sourceRoundId`
  - submissions: `(sourceRoundId, sourceSubmitterId, spotifyUri)`
  - votes: `(sourceRoundId, sourceVoterId, spotifyUri)`
- Writes source-normalized fields to staging: normalized player names and any
  booleans/dates/integers coerced during parse.

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

| ID | Condition | Verification |
|---|---|---|
| AC-01 | Ingesting a valid four-file export bundle creates one `ImportBatch`, four `ImportSourceFile` rows, and staged row counts equal the parsed CSV row counts | `test` |
| AC-02 | Missing any required source file or required header yields a blocking `ImportIssue` and the batch fails validation without canonical-table writes | `test` |
| AC-03 | A clean bundle can be staged and analyzed to `ready` with zero blocking issues and zero canonical-table writes before commit | `test` |
| AC-04 | `listImportBatchIssues(batchId)` returns every blocking issue with row-level context sufficient for debugging | `test` |
| AC-05 | Attempting to commit any batch that is not `ready` fails and leaves canonical tables unchanged | `test` |
| AC-06 | Committing a `ready` batch creates or upserts the required canonical players, rounds, artists, songs, submissions, and votes with correct relationships, hydrated source-derived fields, and `sourceImportId` set on committed submissions and votes | `test` |
| AC-07 | A batch containing a vote that cannot be attached to a submission in the same round fails validation and cannot commit | `test` |
| AC-08 | Re-ingesting and committing the same logical bundle, or a later full-snapshot bundle with the same derived `gameKey`, does not create duplicate canonical players, rounds, artists, songs, submissions, or votes and removes stale game-scoped rounds, submissions, and votes omitted from the incoming bundle | `test` |
| AC-09 | After commit, every affected round has `Submission.score` and `Submission.rank` values equal to those derived from canonical `Vote` rows, with unvoted submissions left null | `test` |
| AC-10 | Batch summary/history exposes batch status, per-file row counts, issue counts, `failureStage`, and `failureSummary` for failed and committed imports | `test` |
| AC-11 | The internal import workflow is adapter-neutral: a bundle-path ingest followed by issue listing, summary, and commit can be exercised entirely through the §4d service contracts | `test` |
| AC-12 | If any canonical write or round-result recompute fails during commit, the batch is not marked `committed` and canonical writes are rolled back | `test` |
| AC-13 | A readable bundle containing duplicate source-key rows in any source file yields blocking `duplicate_source_row` issues and does not fail staging as a raw database constraint error | `test` |
| AC-14 | On normal league-sized datasets, parse+stage and commit each complete within the milestone target budget, and summary reads return quickly enough to feel interactive | `manual` |
| AC-15 | `getImportBatchSummary(batchId)` exposes batch workflow stage progress and whether the batch is still awaiting system work | `test` |

---

9. **[TASK-09] Add integration tests for clean, failed, and replayed imports** — Exercise the service boundaries end to end using fixture bundles.
   `contracts: §4d-1, §4d-2, §4d-3, §4d-4, §4d-5, §4d-6, §4d-7, §4d-8` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, INV-10` · `validates: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15`

---
