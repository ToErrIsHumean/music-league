# SPEC: CSV Import Pipeline

> **Version:** 0.1.0-draft
> **Milestone:** 2 — CSV Import Pipeline
> **Status:** `draft`
> **Author:** gpt-5-codex · 2026-04-16
> **Depends-on:** `docs/specs/SPEC-001-core-data-model.md`
> **Invalidated-by:** none

---

## 1. Objective

Establish a staged, replay-safe import workflow for Music League CSV exports.
This milestone closes when a full export bundle can be ingested into staging,
deterministically validated without mutating canonical data, and committed
transactionally with round outcomes recomputed from votes.

This milestone adds a strict machine-to-machine import path for a trusted
source, not a human review workflow or consumer-facing UI, while preserving
Milestone 1 contracts. Each four-file bundle represents exactly one game
snapshot; replay safety and overwrite semantics are defined per game, not
across unrelated games.

---

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| FSD | `docs/specs/FSD-002-csv-import-pipeline.md` | Behavioral scope, exclusions, and architect-facing feature set |
| Upstream spec | `docs/specs/SPEC-001-core-data-model.md` | Canonical schema, normalization rules, score/rank derivation invariant |
| Current Prisma schema | `prisma/schema.prisma` | Existing canonical models: `Player`, `Artist`, `Song`, `Round`, `Submission`, `Vote`, `ImportBatch` |
| Normalization utility | `src/lib/normalize.js` | Shared deterministic normalization contract already defined and tested |
| Seed/query tests | `prisma/tests/*.test.js` | Evidence of current query needs and downstream shape assumptions |
| CSV export sample | `import/gameid_placeholder/` | Concrete source contract for competitors, rounds, submissions, and votes files |
| Runtime/deps | `package.json` | Current stack is Node.js + CommonJS + Prisma + SQLite; no UI stack exists |

Current state has the canonical schema and normalization helper, but no staged
import workflow. `ImportBatch` is only a thin audit model and cannot support
staging, deterministic validation, or failure tracking.

---

## 3. Invariants

- **INV-01:** Canonical tables (`Player`, `Artist`, `Song`, `Round`,
  `Submission`, `Vote`) remain unchanged until `commitImportBatch()` succeeds.
  Parsing, matching, and validation write only to staging and audit records.
- **INV-02:** A batch is committed atomically. `ImportBatch.status` may become
  `committed` only after all canonical upserts and all affected-round outcome
  recomputations succeed inside one transaction boundary.
- **INV-03:** A batch is committable only when deterministic validation
  succeeds with zero blocking issues; otherwise the batch becomes `failed`.
- **INV-04:** `Submission.score` and `Submission.rank` are derived only from
  canonical `Vote` rows after commit. This milestone does not accept direct
  score/rank CSV fields as authoritative input.
- **INV-05:** The v1 import contract is a full Music League export bundle
  containing exactly the four required files: `competitors.csv`, `rounds.csv`,
  `submissions.csv`, and `votes.csv`. Each bundle represents exactly one
  completed, post-vote, de-anonymized game snapshot. Partial imports and
  pre-reveal player-song associations are out of scope.
- **INV-06:** Matching is deterministic only. `gameKey` is derived from the
  first valid typed round row in `rounds.csv` and maps to
  `Game.sourceGameId`. Players use globally stable `sourcePlayerId`, rounds
  use `(gameId, sourceRoundId)` with `Round.leagueSlug = Game.sourceGameId` as
  compatibility metadata, songs use `spotifyUri`, and artists use normalized
  artist name. This milestone does not use fuzzy or fallback matching for
  players, rounds, songs, or artists.
- **INV-06a:** Source rows are unique within a bundle by their deterministic
  source keys. Duplicate competitor rows (`sourcePlayerId`), duplicate round
  rows (`sourceRoundId`), duplicate submission rows
  (`sourceRoundId + sourceSubmitterId + spotifyUri`), and duplicate vote rows
  (`sourceRoundId + sourceVoterId + spotifyUri`) are invalid input and must be
  surfaced as blocking `duplicate_source_row` issues.
- **INV-07:** Validation failures are durable and inspectable through batch and
  issue records. This milestone does not support staged-data editing or manual
  issue resolution before commit.
- **INV-08:** Every `Submission` and `Vote` written by `commitImportBatch()`
  must retain `sourceImportId = ImportBatch.id` so committed transactional rows
  remain attributable to the batch that created or last refreshed them.
- **INV-09:** A canonical `Vote` may be committed only if a canonical
  `Submission` exists for the same `(roundId, songId)` pair. Votes that cannot
  be attached to a resolvable submission cause validation to fail.
- **INV-10:** v1 import is snapshot-destructive within a game. Committing a
  bundle for an existing `gameKey` overwrites previously committed canonical
  `Round`, `Submission`, and `Vote` rows for that game so the game-scoped
  canonical snapshot matches the incoming bundle exactly. Global canonical
  `Player`, `Artist`, and `Song` rows are not deleted by snapshot
  reconciliation.

---

## 4. Interface Contracts

### 4a. API Surface

No HTTP API is required in this milestone. Any CLI or admin UI introduced for
operation MUST call the internal service boundaries in §4d and MUST NOT bypass
staging or write canonical tables directly.

---

### 4b. Data Schema (migrations)

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

#### §4b-2. Source-file registration

```prisma
model ImportSourceFile {
  id            Int         @id @default(autoincrement())
  importBatchId Int
  fileKind      String      // competitors | rounds | submissions | votes
  filename      String
  rowCount      Int
  createdAt     DateTime    @default(now())

  importBatch   ImportBatch  @relation(fields: [importBatchId], references: [id])

  @@unique([importBatchId, fileKind])
  @@index([importBatchId])
}
```

**Contract note:** `ImportSourceFile` is the canonical record of required-file
presence and parsed row counts.

#### §4b-3. Staged identity rows

```prisma
model ImportPlayerRow {
  id               Int         @id @default(autoincrement())
  importBatchId    Int
  sourceRowNumber  Int
  sourcePlayerId   String
  rawName          String
  normalizedName   String
  recordStatus     String      // pending | ready | blocked
  matchedPlayerId  Int?
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  importBatch      ImportBatch  @relation(fields: [importBatchId], references: [id])
  matchedPlayer    Player?      @relation(fields: [matchedPlayerId], references: [id])

  @@unique([importBatchId, sourcePlayerId])
  @@unique([importBatchId, sourceRowNumber])
  @@index([importBatchId, recordStatus])
}

model ImportRoundRow {
  id                Int         @id @default(autoincrement())
  importBatchId     Int
  sourceRowNumber   Int
  sourceRoundId     String
  rawName           String
  rawDescription    String?
  rawPlaylistUrl    String?
  rawOccurredAt     DateTime?
  recordStatus      String      // pending | ready | blocked
  matchedRoundId    Int?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  importBatch       ImportBatch  @relation(fields: [importBatchId], references: [id])
  matchedRound      Round?       @relation(fields: [matchedRoundId], references: [id])

  @@unique([importBatchId, sourceRoundId])
  @@unique([importBatchId, sourceRowNumber])
  @@index([importBatchId, recordStatus])
}
```

**Contract note:** These models stage per-batch source-keyed identity
decisions before transactional commit.

#### §4b-4. Staged transactional rows

```prisma
model ImportSubmissionRow {
  id                  Int         @id @default(autoincrement())
  importBatchId       Int
  sourceRowNumber     Int
  sourceRoundId       String
  sourceSubmitterId   String
  spotifyUri          String
  rawTitle            String
  rawArtist           String
  rawSubmittedAt      DateTime?
  rawComment          String?
  rawVisibleToVoters  Boolean?
  recordStatus        String      // pending | ready | blocked
  matchedArtistId     Int?
  matchedSongId       Int?
  matchedPlayerId     Int?
  matchedRoundId      Int?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  importBatch         ImportBatch  @relation(fields: [importBatchId], references: [id])
  matchedArtist       Artist?      @relation(fields: [matchedArtistId], references: [id])
  matchedSong         Song?        @relation(fields: [matchedSongId], references: [id])
  matchedPlayer       Player?      @relation(fields: [matchedPlayerId], references: [id])
  matchedRound        Round?       @relation(fields: [matchedRoundId], references: [id])

  @@unique([importBatchId, sourceRowNumber])
  @@index([importBatchId, recordStatus])
  @@index([importBatchId, sourceRoundId])
  @@index([importBatchId, sourceSubmitterId])
  @@index([importBatchId, spotifyUri])
}

model ImportVoteRow {
  id                  Int         @id @default(autoincrement())
  importBatchId       Int
  sourceRowNumber     Int
  sourceRoundId       String
  sourceVoterId       String
  spotifyUri          String
  rawPointsAssigned   Int
  rawComment          String?
  rawVotedAt          DateTime?
  recordStatus        String      // pending | ready | blocked
  matchedSongId       Int?
  matchedVoterId      Int?
  matchedRoundId      Int?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  importBatch         ImportBatch  @relation(fields: [importBatchId], references: [id])
  matchedSong         Song?        @relation(fields: [matchedSongId], references: [id])
  matchedVoter        Player?      @relation(fields: [matchedVoterId], references: [id])
  matchedRound        Round?       @relation(fields: [matchedRoundId], references: [id])

  @@unique([importBatchId, sourceRowNumber])
  @@index([importBatchId, recordStatus])
  @@index([importBatchId, sourceRoundId])
  @@index([importBatchId, sourceVoterId])
  @@index([importBatchId, spotifyUri])
}
```

**Contract note:** Transactional staging rows may reference canonical IDs when
known, but remain non-canonical until commit.

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

### 4c. Component Contracts

Not applicable. This milestone introduces no frontend component surface.

---

### 4d. Internal Boundaries

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
  1. Games by `sourceGameId = batch.gameKey`
  2. Players by `sourcePlayerId`
  3. Rounds by `(gameId, sourceRoundId)` with `Round.leagueSlug` mirrored from
     `Game.sourceGameId` for compatibility
  4. Songs by `spotifyUri`
  5. Artists by normalized artist name
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
  - `Game` upsert key: `sourceGameId = batch.gameKey`
  - `Player` upsert key: `sourcePlayerId`
  - `Round` upsert key: `(gameId, sourceRoundId)`
  - `Song` upsert key: `spotifyUri`
  - `Artist` upsert key: `normalizedName`
  - `Submission` upsert key: `(roundId, playerId, songId)`
  - `Vote` upsert key: `(roundId, voterId, songId)`
- Snapshot overwrite rules:
  - Re-ingesting a bundle whose derived `gameKey` matches an existing imported
    game overwrites that game's canonical snapshot.
  - After commit, canonical `Round` rows under the canonical `Game` for
    `batch.gameKey` and their dependent `Submission` and `Vote` rows must match
    the incoming staged bundle exactly.
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
    from the source row that matches `(gameId, sourceRoundId)`
  - `Submission.submittedAt`, `comment`, `visibleToVoters`, and
    `sourceImportId` must be written from the staged row
  - `Vote.votedAt`, `comment`, and `sourceImportId` must be written from the
    staged row
- On upsert conflicts, non-identity source-derived fields may be refreshed, but
  identity changes that would remap an existing canonical record to a different
  deterministic key become blocking conflicts rather than silent rewrites.
- Rows absent from the committing bundle are left untouched only when they are
  outside the committing batch's `Game`.
- `Submission.visibleToVoters` is stored from the staged row as source
  evidence/compatibility data. It is not an active current-product privacy gate
  because supported bundles are completed, post-vote, de-anonymized snapshots.

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

### 4e. Dependencies

| Package | Purpose | Rationale |
|---|---|---|
| `prisma` | Existing ORM, migrations, transaction boundary | Required to extend the current schema and perform canonical upserts |
| `@prisma/client` | Existing query client | Required by import services and tests |
| `csv-parse` | CSV parsing with header-aware row extraction | Explicitly allowed to avoid brittle ad hoc CSV parsing in v1 |

**Language/runtime:** JavaScript (CommonJS) on Node.js.  
**Database:** SQLite via Prisma.  
**Test runner:** `node:test`.

**Operational targets:** On normal league-sized datasets, parse+stage and
commit should each complete in under 2 seconds, and summary reads should feel
interactive. These are optimization targets, not a license to weaken
correctness.

---

## 5. Acceptance Criteria

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

## 6. Task Decomposition Hints

1. **[TASK-01] Extend the Prisma schema for strict staged import** — Add the §4b batch, source-file, staged-row, and machine-generated issue models in a backward-compatible migration.
   `contracts: §4b-1, §4b-2, §4b-3, §4b-4, §4b-5` · `preserves: INV-01, INV-02, INV-05` · `validates: AC-01, AC-10, AC-13`
2. **[TASK-02] Implement bundle parsing** — Enforce the four-file directory contract, emit typed rows with `sourceRowNumber`, and report parser-originated issues.
   `contracts: §4d-1` · `preserves: INV-05` · `validates: AC-02, AC-04, AC-11`
3. **[TASK-03] Implement batch staging** — Persist `ImportBatch`, `ImportSourceFile`, staged rows, and parser-originated `ImportIssue` rows from a parsed bundle, rejecting duplicate source-key rows across all four files.
   `contracts: §4d-2, §4b-1, §4b-2, §4b-3, §4b-4, §4b-5` · `preserves: INV-01, INV-05, INV-07` · `validates: AC-01, AC-02, AC-13`
4. **[TASK-04] Implement deterministic validation and issue generation** — Analyze staged rows, assign match/create dispositions, replace validation issues, and transition the batch to `ready` or `failed`.
   `contracts: §4d-3, §4b-5` · `preserves: INV-03, INV-04, INV-06, INV-09` · `validates: AC-02, AC-03, AC-05, AC-07`
5. **[TASK-05] Implement issue reads** — Expose diagnostic issue listing with row previews derived from current batch state.
   `contracts: §4d-4, §4b-5` · `preserves: INV-03, INV-07` · `validates: AC-04, AC-11`
6. **[TASK-06] Implement summary and history reads** — Add batch summary and batch-history read surfaces for parsed, ready, failed, and committed imports.
   `contracts: §4d-5, §4d-6` · `preserves: INV-01, INV-07` · `validates: AC-10, AC-11, AC-15`
7. **[TASK-07] Implement round-result recompute** — Recompute affected-round submission scores and dense ranks from canonical votes.
   `contracts: §4d-8` · `preserves: INV-04, INV-09` · `validates: AC-09, AC-12`
8. **[TASK-08] Implement transactional commit orchestration** — Upsert canonical entities from a `ready` batch, upsert submissions and votes with replay-safe keys, call round-result recompute, and enforce rollback/failure-state handling.
   `contracts: §4d-7, §4d-8, §4b-1` · `preserves: INV-01, INV-02, INV-04, INV-06, INV-08, INV-09, INV-10` · `validates: AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-12`
9. **[TASK-09] Add integration tests for clean, failed, and replayed imports** — Exercise the service boundaries end to end using fixture bundles.
   `contracts: §4d-1, §4d-2, §4d-3, §4d-4, §4d-5, §4d-6, §4d-7, §4d-8` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, INV-10` · `validates: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15`

### Dependency Graph

```text
TASK-01:
TASK-02:
TASK-03: TASK-01,TASK-02
TASK-04: TASK-03
TASK-05: TASK-04
TASK-06: TASK-04
TASK-07: TASK-01
TASK-08: TASK-04,TASK-07
TASK-09: TASK-02,TASK-03,TASK-04,TASK-05,TASK-06,TASK-07,TASK-08
```

## 7. Out of Scope

- [ ] Partial imports of only submissions, only votes, or arbitrary subsets of
  the four-file export bundle — prohibited by INV-05
- [ ] Manual review queues, issue-resolution actions, or editing staged data
- [ ] Fuzzy, probabilistic, or fallback matching beyond deterministic import
  keys
- [ ] AI-assisted cleaning, source enrichment, or external metadata lookup
- [ ] HTTP APIs, frontend admin screens, or consumer-facing import UI
- [ ] Rollback/undo of committed batches
- [ ] Cross-game destructive reconciliation outside the committing bundle's
  derived `gameKey`
- [ ] General-purpose ETL support for hand-authored spreadsheets or non-Music
  League CSV layouts
- [ ] Background-job orchestration or multi-user locking beyond what SQLite and
  single-process operation already provide

## 8. Open Questions

None.

---

## Appendix D: Discoveries Log

### D-001 — 2026-04-16T00:00:00Z

- **Trigger:** Drafting `SPEC-002` from the FSD and checking current repo state
- **Nature:** `ambiguity`
- **Affected sections:** §2, §3, §4b, §4d, §8
- **Agent assessment:** The repo has an `ImportBatch` model already, but it is
  too thin for staged import diagnostics. Extending it with staged-row and
  issue models is the least-coupled way to preserve Milestone 1 while enabling
  Milestone 2.
- **Escalation required:** `no` — resolved within spec scope
- **Resolution:** Incorporated into §4b schema evolution and §4d service
  boundaries

### D-002 — 2026-04-16T00:00:00Z

- **Trigger:** Reviewing completeness at upstream/downstream boundaries after
  the first SPEC draft
- **Nature:** `gap`
- **Affected sections:** §3, §4b, §4d, §5, §7
- **Agent assessment:** The safer architecture needs explicit contracts for
  issue reads, canonical provenance on committed rows, vote-to-submission
  integrity, and game-scoped replay semantics. Those choices keep v1 strict and
  deterministic while remaining implementable against a trusted automated
  source.
- **Escalation required:** `no` — resolved within spec scope
- **Resolution:** Added INV-08 through INV-10, issue-read contracts, stronger
  commit/recompute rules, expanded acceptance coverage, and explicit exclusions
  for manual review workflows in §7

### D-003 — 2026-04-17T00:00:00Z

- **Trigger:** Clarifying that each four-file bundle is one game snapshot and
  that re-importing the same game should overwrite prior game-scoped data
- **Nature:** `ambiguity`
- **Affected sections:** §1, §3, §4b, §4d, §5, §7
- **Agent assessment:** The original draft treated imports as globally
  non-destructive and hardcoded rounds into a single `"main"` namespace. That
  was incompatible with many independent games. Deriving a deterministic
  `gameKey` from the first valid round row keeps the source contract simple
  while making replay and overwrite behavior explicit.
- **Escalation required:** `no` — resolved within spec scope
- **Resolution:** Added `ImportBatch.gameKey`, replaced `"main"` round matching
  with `batch.gameKey`, and changed commit semantics to snapshot reconciliation
  within the committing game only

---

## Appendix E: Context Slices

### E.1 Two-file model

Every task invocation receives:

1. `SPEC-MMM-universal.md` — §1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries
2. `SPEC-MMM-slice-TASK-NN.md` — assembled from tokens below

§4 (contracts), §5 (ACs), §6 (task hints), and Appendix E are excluded from the universal file. Universal content is never repeated in slice files.

### E.2 Extraction contract

Section boundaries in the source spec follow the pattern:

```
#### §4a-N. Title    →  ends at next ####, ###, or EOF
#### §4c-N. Title    →  ends at next ####, ###, or EOF
```

Slice blocks are delimited:

```
&lt;!-- SLICE:TASK-NN --&gt;
&lt;!-- /SLICE:TASK-NN --&gt;
```

**Regex — extract named slice:**

```
<!-- SLICE:(TASK-[\w]+) -->[\s\S]*?<!-- /SLICE:\1 -->
```

**Regex — extract SECTIONS tokens from a slice:**

```
^  (§[\w-:]+)
```

*(exactly two leading spaces; distinguishes tokens from prose)*

**Regex — extract a section from the source spec by token `§4a-3`:**

```
(?=#### §4a-3\ .)[\s\S]*?(?=#### |### |## |$)
```

**Regex — extract a single task hint from §6:**

```
\d+\.\s+\*\*\[TASK-NN\][\s\S]*?(?=\n\d+\.\s+\*\*\[TASK-|\n###\s|\n##\s|$)
```

### E.3 Token grammar

|Token|Matches|
|-|-|
|`§4a-N`|Single API endpoint section|
|`§4a-N:M`|§4a-N through §4a-M inclusive|
|`§4b-N`|Single schema migration section|
|`§4b-N:M`|§4b-N through §4b-M inclusive|
|`§4c-N`|Single component contract section|
|`§4d-N`|Single internal boundary section|
|`§4d-N:M`|§4d-N through §4d-M inclusive|
|`§4e`|Full dependency table|
|`§5:AC-NN`|Single AC row|
|`§5:AC-NN:MM`|AC rows NN through MM inclusive|
|`§6:TASK-NN`|Single task decomposition hint entry (prose line + metadata line)|

### E.4 Slice definitions


<!-- SLICE:TASK-01 -->
TASK:     TASK-01
LABEL:    Extend the Prisma schema for strict staged import
DEPENDS:  (none)
SECTIONS:
§4b-1:5
§5:AC-01
§5:AC-10
§5:AC-13
§6:TASK-01
<!-- /SLICE:TASK-01 -->

<!-- SLICE:TASK-02 -->
TASK:     TASK-02
LABEL:    Implement bundle parsing
DEPENDS:  (none)
SECTIONS:
§4d-1
§5:AC-02
§5:AC-04
§5:AC-11
§6:TASK-02
<!-- /SLICE:TASK-02 -->

<!-- SLICE:TASK-03 -->
TASK:     TASK-03
LABEL:    Implement batch staging
DEPENDS:  TASK-01, TASK-02
SECTIONS:
§4d-2
§4b-1:5
§5:AC-01:02
§5:AC-13
§6:TASK-03
<!-- /SLICE:TASK-03 -->

<!-- SLICE:TASK-04 -->
TASK:     TASK-04
LABEL:    Implement deterministic validation and issue generation
DEPENDS:  TASK-03
SECTIONS:
§4d-3
§4b-5
§5:AC-02:03
§5:AC-05
§5:AC-07
§6:TASK-04
<!-- /SLICE:TASK-04 -->

<!-- SLICE:TASK-05 -->
TASK:     TASK-05
LABEL:    Implement issue reads
DEPENDS:  TASK-04
SECTIONS:
§4d-4
§4b-5
§5:AC-04
§5:AC-11
§6:TASK-05
<!-- /SLICE:TASK-05 -->

<!-- SLICE:TASK-06 -->
TASK:     TASK-06
LABEL:    Implement summary and history reads
DEPENDS:  TASK-04
SECTIONS:
§4d-5:6
§5:AC-10:11
§5:AC-15
§6:TASK-06
<!-- /SLICE:TASK-06 -->

<!-- SLICE:TASK-07 -->
TASK:     TASK-07
LABEL:    Implement round-result recompute
DEPENDS:  TASK-01
SECTIONS:
§4d-8
§5:AC-09
§5:AC-12
§6:TASK-07
<!-- /SLICE:TASK-07 -->

<!-- SLICE:TASK-08 -->
TASK:     TASK-08
LABEL:    Implement transactional commit orchestration
DEPENDS:  TASK-04, TASK-07
SECTIONS:
§4d-7:8
§4b-1
§5:AC-05:10
§5:AC-12
§6:TASK-08
<!-- /SLICE:TASK-08 -->

<!-- SLICE:TASK-09 -->
TASK:     TASK-09
LABEL:    Add integration tests for clean, failed, and replayed imports
DEPENDS:  TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08
SECTIONS:
§4d-1:8
§5:AC-01:15
§6:TASK-09
<!-- /SLICE:TASK-09 -->

<!-- END SPEC -->
