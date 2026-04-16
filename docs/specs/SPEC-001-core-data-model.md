# SPEC: Core Data Model and Relational Backbone

> **Version:** 0.1.0-draft
> **Milestone:** 1 — Core Data Model
> **Status:** `draft`
> **Author:** claude-sonnet-4-6 · 2026-04-16
> **Depends-on:** none
> **Invalidated-by:** none

---

## 1. Objective

Establish the complete relational schema, shared normalization utility, and seed
dataset that all subsequent milestones depend on. No user-visible surface ships;
this milestone closes when the database migrates cleanly, all seven entities are
queryable via Prisma, the normalization module is importable, and seed data
satisfies every downstream query pattern.

---

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| FSD | `docs/specs/FSD-001-core-data-model.md` | Behavioral spec; authoritative for scope and entity decisions |
| CSV export sample | `import/gameid_placeholder/` | Four files: `competitors`, `rounds`, `submissions`, `votes`; drives field inventory and dedup strategy |
| AGENTS.md | `AGENTS.md` | Repo conventions |

No existing schema, migrations, or application code. This is a greenfield
Prisma project.

---

## 3. Invariants

- **INV-01:** `Submission.score` and `Submission.rank` are always derived from
  `Vote` rows. They must not be written to a non-null value unless corresponding
  `Vote` rows for that `(roundId, songId)` pair exist. They are computed and
  stored at import time; they are not source fields.
- **INV-02:** `normalize()` is a pure function — no side effects, no DB access,
  no I/O. Given the same input it always returns the same output.
- **INV-03:** `Song.spotifyUri` is non-nullable and is the sole deduplication
  key for songs. Every song record must have a URI; no normalization-based dedup
  fallback exists.
- **INV-04:** The initial migration must apply cleanly from an empty database.
  It must not assume any pre-existing tables, indexes, or data.

---

## 4. Interface Contracts

### 4a. API Surface

Not applicable. This milestone produces no HTTP surface.

---

### 4b. Data Schema

#### §4b-1. Initial Prisma schema

File: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Player {
  id             Int          @id @default(autoincrement())
  displayName    String
  normalizedName String       @unique
  sourcePlayerId String?      @unique
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  submissions    Submission[]
  votes          Vote[]
}

model Artist {
  id             Int      @id @default(autoincrement())
  name           String
  normalizedName String   @unique
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  songs          Song[]
}

model Song {
  id              Int          @id @default(autoincrement())
  title           String
  normalizedTitle String
  artistId        Int
  spotifyUri      String       @unique
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  artist          Artist       @relation(fields: [artistId], references: [id])
  submissions     Submission[]
  votes           Vote[]
}

model Round {
  id             Int          @id @default(autoincrement())
  leagueSlug     String       @default("main")
  name           String
  description    String?
  playlistUrl    String?
  sequenceNumber Int?
  occurredAt     DateTime?
  sourceRoundId  String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  submissions    Submission[]
  votes          Vote[]

  @@index([leagueSlug, sequenceNumber])
  @@unique([leagueSlug, sourceRoundId])
}

model Submission {
  id              Int          @id @default(autoincrement())
  roundId         Int
  playerId        Int
  songId          Int
  score           Int?
  rank            Int?
  comment         String?
  visibleToVoters Boolean      @default(false)
  submittedAt     DateTime?
  sourceImportId  Int?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  round        Round        @relation(fields: [roundId], references: [id])
  player       Player       @relation(fields: [playerId], references: [id])
  song         Song         @relation(fields: [songId], references: [id])
  sourceImport ImportBatch? @relation(fields: [sourceImportId], references: [id])

  @@unique([roundId, playerId, songId])
  @@index([roundId])
  @@index([playerId])
  @@index([songId])
}

model Vote {
  id             Int          @id @default(autoincrement())
  roundId        Int
  voterId        Int
  songId         Int
  pointsAssigned Int
  comment        String?
  votedAt        DateTime?
  sourceImportId Int?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  round        Round        @relation(fields: [roundId], references: [id])
  voter        Player       @relation(fields: [voterId], references: [id])
  song         Song         @relation(fields: [songId], references: [id])
  sourceImport ImportBatch? @relation(fields: [sourceImportId], references: [id])

  @@unique([roundId, voterId, songId])
  @@index([roundId])
  @@index([voterId])
  @@index([songId])
}

model ImportBatch {
  id             Int          @id @default(autoincrement())
  sourceType     String
  sourceFilename String?
  rowCount       Int          @default(0)
  status         String
  notes          String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  submissions    Submission[]
  votes          Vote[]
}
```

**Schema notes:**

- `Round.@@unique([leagueSlug, sourceRoundId])`: SQLite treats NULL as
  non-comparable in unique indexes; multiple rounds with `sourceRoundId = null`
  are permitted. Only non-null values are deduplicated.
- `Song.normalizedTitle`: not a unique constraint. `spotifyUri` is the sole
  dedup key (INV-03); `normalizedTitle` exists for display normalization and
  future lookup paths only.
- Self-vote invariant: a voter never votes for their own submission. Enforced
  by Music League at source; no application or DB guard required.
- `ImportBatch.status`: plain validated string. Valid values: `parsed`,
  `committed`, `failed`. Application layer enforces the value set.
- `ImportBatch.rowCount`: count of raw parsed rows, set at the `parsed` stage.
  Not updated on transition to `committed` or `failed`.

---

### 4c. Component Contracts

Not applicable. No frontend components in this milestone.

---

### 4d. Internal Boundaries

#### §4d-1. `normalize(input: string): string`

File: `src/lib/normalize.js`

```
normalize(input: string): string

Contract:
  - Pure function (INV-02)
  - Applies in order:
      1. Decode smart quotes: \u2018 \u2019 → '   |   \u201c \u201d → "
      2. Lowercase
      3. Strip characters in the strip set: . , ' "
      4. Collapse runs of whitespace (including tabs) to a single space
      5. Trim leading and trailing whitespace
  - Characters NOT stripped: - ! ? ( ) & + / and all alphanumerics
  - Non-ASCII characters (accents, diacritics) are preserved as-is.
  - Empty output (after step 5) throws:
      Error(`normalize: empty output for input: "${input}"`)

Test cases (must pass):
  normalize("Mr. Brightside")       → "mr brightside"
  normalize("  The Weeknd  ")       → "the weeknd"
  normalize("It\u2019s a Trap")     → "its a trap"
  normalize("wake  up,   mr  crow") → "wake up mr crow"
  normalize("JANE DOE")             → "jane doe"
  normalize("Beyoncé")              → "beyoncé"
  normalize(normalize(x)) === normalize(x)   (idempotent)
```

**Export:** `module.exports = { normalize };`

#### §4d-2. Song modal query shape

```
Input:  songId: number
Output: Song & {
  artist: Artist,
  submissions: Array<Submission & {
    player: Player,
    round: Pick<Round, 'id' | 'name'>
  }>
}
```

#### §4d-3. Player modal query shape

```
Input:  playerId: number
Output: Player & {
  submissions: Array<Submission & {
    song: Song & { artist: Artist },
    round: Pick<Round, 'id' | 'name'>
  }>
}
// Aggregates (submission count, avg score) computed in application layer
// from the returned submissions array.
// Vote comments received (FSD §F5.2): requires a separate query per §4d-6
// shape 1 (roundId + songId) for each song the player submitted, or a
// single prisma.vote.findMany({ where: { songId: { in: [...playerSongIds] } } }).
// Not included in this shape.
```

#### §4d-4. Round page query shape

```
Input:  roundId: number
Output: Round & {
  submissions: Array<Submission & {
    player: Pick<Player, 'id' | 'displayName'>,
    song: Song & { artist: Pick<Artist, 'id' | 'name'> }
  }>
}
// Ordered by rank ASC NULLS LAST, then createdAt ASC.
```

#### §4d-5. Overview aggregate query shape

```
// Most-submitted artist: two-step application aggregation
Step 1: prisma.submission.findMany({ include: { song: { include: { artist: true } } } })
Step 2: group by song.artistId in application code, sum counts

// Most active player:
prisma.submission.groupBy({ by: ['playerId'], _count: { id: true } })
```

#### §4d-6. Vote-based query shape

```
Input:  roundId: number, songId: number
Output: Array<Vote & { voter: Pick<Player, 'id' | 'displayName'> }>

Input:  voterId: number
Output: Array<Vote & {
  song: Song & { artist: Pick<Artist, 'id' | 'name'> },
  round: Pick<Round, 'id' | 'name'>
}>
```

#### §4d-7. Score and rank computation

```
// Canonical algorithm. Seed script (TASK-04b) and M2 import pipeline both use this.

score(roundId, songId):
  SUM(pointsAssigned) FROM Vote WHERE roundId = :roundId AND songId = :songId

rank(roundId):
  // Dense ranking by score DESC. Equal scores share the same rank;
  // next distinct rank = previous rank + 1 (no gaps).
  // Example: scores [10, 10, 7, 3] → ranks [1, 1, 2, 3]
  // Null scores receive null rank and sort last.
```

---

### 4e. Dependencies

| Package | Purpose | Rationale |
|---|---|---|
| `prisma` | Schema management, migrations, Prisma CLI | ORM for SQLite; manages schema and migration files |
| `@prisma/client` | Type-safe DB query client | Generated from schema; used by seed script and all downstream consumers |

**Language:** JavaScript (CommonJS). All source files use `.js` extensions and
`require` / `module.exports`. No TypeScript in this milestone.

**Test runner:** `node:test` (Node.js built-in, v18+). No additional test
dependency.

---

## 5. Acceptance Criteria

| ID | Condition | Verification |
|---|---|---|
| AC-01 | `prisma migrate dev` applies without errors from a clean database | `manual` — run in fresh env |
| AC-02 | All 7 entities are insertable via Prisma Client without errors | `test` — one insert per model |
| AC-03 | Inserting a duplicate `(roundId, playerId, songId)` submission throws a unique constraint error | `test` |
| AC-04 | Inserting a duplicate `(roundId, voterId, songId)` vote throws a unique constraint error | `test` |
| AC-05 | Inserting a `Round` with a duplicate `(leagueSlug, sourceRoundId)` where `sourceRoundId` is non-null throws a unique constraint error | `test` |
| AC-06 | Inserting two `Round` rows with the same `leagueSlug` and `sourceRoundId = null` succeeds | `test` |
| AC-07 | `normalize()` passes all test cases in §4d-1, including idempotency | `test` |
| AC-08 | Seed script runs without error on a migrated database | `manual` |
| AC-09 | Running the seed script twice produces the same record counts (idempotent via upsert) | `manual` |
| AC-10 | Post-seed: at least one song has ≥ 2 submission rows across different rounds or players | `test` — query count |
| AC-11 | Post-seed: at least one round has all submissions with non-null `score` and `rank`; at least one round has ≥ 1 submission with null `score` and null `rank` | `test` — query |
| AC-12 | Post-seed: Vote rows exist for at least one round, with `pointsAssigned` varying across rows and at least one non-null `comment` | `test` — query |
| AC-13 | All 7 query shapes in §4d-2 through §4d-6 (both §4d-5 sub-queries and both §4d-6 input shapes) execute against seed data without error and return non-empty results | `test` |

---

## 6. Task Decomposition

0. **[TASK-00] Initialize project** — Run `npm init -y` at the repo root. Install
   dependencies: `npm install prisma @prisma/client`. Run `npx prisma init` to
   generate `prisma/schema.prisma` (stub) and `.env`. Set
   `DATABASE_URL="file:./dev.db"` in `.env`. Add `.env` to `.gitignore`.
   `contracts: §4e` · `preserves: INV-04`

1. **[TASK-01] Define Prisma schema** — Overwrite `prisma/schema.prisma` with
   the full schema per §4b-1, including all seven models, constraints, indexes,
   and the `datasource`/`generator` blocks. Do not run migrations.
   `contracts: §4b-1` · `preserves: INV-03, INV-04`

2. **[TASK-02a] Generate initial migration** — Run
   `npx prisma migrate dev --name init` against a clean database. Confirm:
   (1) `prisma/migrations/` directory is created with SQL, (2) migration applies
   without errors, (3) `npx prisma generate` completes without errors. If the
   command blocks for interactive input, use `--create-only` followed by
   `npx prisma migrate deploy`.
   `contracts: §4b-1` · `preserves: INV-04` · `validates: AC-01`

3. **[TASK-02b] Constraint tests** — Write `prisma/tests/constraints.test.js`
   using `node:test`. Each test case uses a Prisma transaction rolled back on
   completion to isolate state. Cover:
   - One successful insert per model (AC-02)
   - Duplicate `(roundId, playerId, songId)` submission rejected (AC-03)
   - Duplicate `(roundId, voterId, songId)` vote rejected (AC-04)
   - Duplicate `(leagueSlug, sourceRoundId)` with non-null `sourceRoundId`
     rejected (AC-05)
   - Two rounds with same `leagueSlug` and `sourceRoundId = null` both succeed
     (AC-06)
   Run with `node --test prisma/tests/constraints.test.js`.
   `contracts: §4b-1` · `validates: AC-02, AC-03, AC-04, AC-05, AC-06`

4. **[TASK-03] Implement normalization utility** — Write `src/lib/normalize.js`
   per §4d-1. Write `src/lib/normalize.test.js` using `node:test` with the test
   cases from §4d-1. Run with `node --test src/lib/normalize.test.js`.
   `contracts: §4d-1` · `preserves: INV-02` · `validates: AC-07`

5. **[TASK-04a] Seed reference data** — Add `"prisma": { "seed": "node prisma/seed.js" }`
   to `package.json`. Write `prisma/seed.js` that upserts the following reference
   entities via Prisma Client (all `sourceImportId` fields null):

   - **Players** (3–4): upsert on `normalizedName`
   - **Artists** (3–5): upsert on `normalizedName`
   - **Songs** (5–8): upsert on `spotifyUri`; set `normalizedTitle` via
     `normalize(title)`
   - **Rounds** (exactly 2): upsert on `leagueSlug_sourceRoundId` (Prisma
     compound key name). Use stable `sourceRoundId` values `'seed-r1'`
     (scored) and `'seed-r2'` (partially scored). At least one song must
     appear in both rounds.

   Prisma compound `where` for Round:
   `where: { leagueSlug_sourceRoundId: { leagueSlug: 'main', sourceRoundId: '...' } }`

   `contracts: §4b-1, §4d-1` · `preserves: INV-02, INV-03` · `validates: AC-08, AC-09`

6. **[TASK-04b] Seed transactional data + derive scores** — Extend `prisma/seed.js`
   to upsert Votes and Submissions (all `sourceImportId` null).

   **Order of operations (required):**
   1. Upsert Vote rows for `seed-r1` (every player votes on every other
      player's submission). Upsert key: `roundId_voterId_songId`.
   2. Compute `score` and `rank` from the upserted votes per §4d-7.
   3. Upsert Submissions for `seed-r1` with computed `score` and `rank`.
   4. Upsert Submissions for `seed-r2` with `score: null, rank: null`
      (at least one). No Vote rows for `seed-r2`.

   Upsert key for Submission: `roundId_playerId_songId`.

   `contracts: §4b-1, §4d-7` · `preserves: INV-01` · `validates: AC-08, AC-09, AC-10, AC-11, AC-12`

7. **[TASK-05] Verify query patterns against seed data** — Write
   `prisma/tests/queries.test.js` using `node:test`. Query the seeded database
   (no setup/teardown — read-only against the live seed). Assert non-empty
   results for all six shapes below. No raw SQL.

   | Shape | Query anchor |
   |---|---|
   | §4d-2 Song modal | any `songId` present in both rounds |
   | §4d-3 Player modal | any `playerId` with ≥ 1 submission |
   | §4d-4 Round page | round with `sourceRoundId = 'seed-r1'` |
   | §4d-5 Most-submitted artist | full `findMany` + app-layer group |
   | §4d-5 Most active player | `groupBy playerId` |
   | §4d-6 shape 1 (roundId + songId) | any `(roundId, songId)` with votes |
   | §4d-6 shape 2 (voterId) | any `voterId` with ≥ 1 vote cast |

   Run with `node --test prisma/tests/queries.test.js`.
   `contracts: §4d-2, §4d-3, §4d-4, §4d-5, §4d-6` · `preserves: INV-01` · `validates: AC-13`

### Dependency Graph

```
TASK-00:
TASK-01:  TASK-00
TASK-02a: TASK-01
TASK-02b: TASK-02a
TASK-03:
TASK-04a: TASK-02a, TASK-03
TASK-04b: TASK-04a
TASK-05:  TASK-02b, TASK-03, TASK-04b
```

---

## 7. Out of Scope

- [ ] API routes or HTTP surface — Milestone 2+
- [ ] CSV import pipeline — Milestone 2
- [ ] Any UI or frontend scaffolding — Milestone 3+
- [ ] Playwright scraping or external data ingestion — not planned
- [ ] External metadata enrichment (Spotify API, MusicBrainz) — not planned
- [ ] Multi-artist relational modeling — deferred post-v1
- [ ] Album metadata on `Song` — present in source CSV; no downstream consumer in v1
- [ ] Phonetic or fuzzy matching — normalization is deterministic only

---

## 8. Open Questions

- **OQ-01:** Normalization strip set — **Resolved → §4d-1.**
- **OQ-02:** Unicode accent stripping — **Resolved → §4d-1.**
- **OQ-03:** `Round.sequenceNumber` source — **Resolved:** `Int?`; M2 import
  pipeline populates from CSV row order where available, otherwise null.

---

## Appendix D: Discoveries Log

_No discoveries recorded._

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



<!-- SLICE:TASK-00 -->
TASK:     TASK-00
LABEL:    Initialize project
DEPENDS:  (none)
SECTIONS:
§4e
§6:TASK-00
<!-- /SLICE:TASK-00 -->

<!-- SLICE:TASK-01 -->
TASK:     TASK-01
LABEL:    Define Prisma schema
DEPENDS:  TASK-00
SECTIONS:
§4b-1
§6:TASK-01
<!-- /SLICE:TASK-01 -->

<!-- SLICE:TASK-02a -->
TASK:     TASK-02a
LABEL:    Generate initial migration
DEPENDS:  TASK-01
SECTIONS:
§4b-1
§5:AC-01
§6:TASK-02a
<!-- /SLICE:TASK-02a -->

<!-- SLICE:TASK-02b -->
TASK:     TASK-02b
LABEL:    Constraint tests
DEPENDS:  TASK-02a
SECTIONS:
§4b-1
§5:AC-02:06
§6:TASK-02b
<!-- /SLICE:TASK-02b -->

<!-- SLICE:TASK-03 -->
TASK:     TASK-03
LABEL:    Implement normalization utility
DEPENDS:  (none)
SECTIONS:
§4d-1
§5:AC-07
§6:TASK-03
<!-- /SLICE:TASK-03 -->

<!-- SLICE:TASK-04a -->
TASK:     TASK-04a
LABEL:    Seed reference data
DEPENDS:  TASK-02a, TASK-03
SECTIONS:
§4b-1
§4d-1
§5:AC-08:09
§6:TASK-04a
<!-- /SLICE:TASK-04a -->

<!-- SLICE:TASK-04b -->
TASK:     TASK-04b
LABEL:    Seed transactional data + derive scores
DEPENDS:  TASK-04a
SECTIONS:
§4b-1
§4d-7
§5:AC-08:12
§6:TASK-04b
<!-- /SLICE:TASK-04b -->

<!-- SLICE:TASK-05 -->
TASK:     TASK-05
LABEL:    Verify query patterns against seed data
DEPENDS:  TASK-02b, TASK-03, TASK-04b
SECTIONS:
§4d-2:6
§5:AC-13
§6:TASK-05
<!-- /SLICE:TASK-05 -->

<!-- END SPEC -->
