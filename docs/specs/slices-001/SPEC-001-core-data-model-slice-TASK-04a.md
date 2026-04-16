# Slice: TASK-04a — Seed reference data

> **Depends-on:** TASK-02a, TASK-03
> **Universal:** SPEC-001-core-data-model-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

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

---

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

---

| ID | Condition | Verification |
|---|---|---|
| AC-08 | Seed script runs without error on a migrated database | `manual` |
| AC-09 | Running the seed script twice produces the same record counts (idempotent via upsert) | `manual` |

---

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

---
