# Slice: TASK-04b — Seed transactional data + derive scores

> **Depends-on:** TASK-04a
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

---

| ID | Condition | Verification |
|---|---|---|
| AC-08 | Seed script runs without error on a migrated database | `manual` |
| AC-09 | Running the seed script twice produces the same record counts (idempotent via upsert) | `manual` |
| AC-10 | Post-seed: at least one song has ≥ 2 submission rows across different rounds or players | `test` — query count |
| AC-11 | Post-seed: at least one round has all submissions with non-null `score` and `rank`; at least one round has ≥ 1 submission with null `score` and null `rank` | `test` — query |
| AC-12 | Post-seed: Vote rows exist for at least one round, with `pointsAssigned` varying across rows and at least one non-null `comment` | `test` — query |

---

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

---
