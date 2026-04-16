# Slice: TASK-01 — Extend the Prisma schema for strict staged import

> **Depends-on:** (none)
> **Universal:** SPEC-002-csv-import-pipeline-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

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

---

| ID | Condition | Verification |
|---|---|---|
| AC-01 | Ingesting a valid four-file export bundle creates one `ImportBatch`, four `ImportSourceFile` rows, and staged row counts equal the parsed CSV row counts | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-10 | Batch summary/history exposes batch status, per-file row counts, issue counts, `failureStage`, and `failureSummary` for failed and committed imports | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-13 | A readable bundle containing duplicate source-key rows in any source file yields blocking `duplicate_source_row` issues and does not fail staging as a raw database constraint error | `test` |

---

1. **[TASK-01] Extend the Prisma schema for strict staged import** — Add the §4b batch, source-file, staged-row, and machine-generated issue models in a backward-compatible migration.
   `contracts: §4b-1, §4b-2, §4b-3, §4b-4, §4b-5` · `preserves: INV-01, INV-02, INV-05` · `validates: AC-01, AC-10, AC-13`

---
