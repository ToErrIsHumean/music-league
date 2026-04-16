# Slice: TASK-02a — Generate initial migration

> **Depends-on:** TASK-01
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

| ID | Condition | Verification |
|---|---|---|
| AC-01 | `prisma migrate dev` applies without errors from a clean database | `manual` — run in fresh env |

---

2. **[TASK-02a] Generate initial migration** — Run
   `npx prisma migrate dev --name init` against a clean database. Confirm:
   (1) `prisma/migrations/` directory is created with SQL, (2) migration applies
   without errors, (3) `npx prisma generate` completes without errors. If the
   command blocks for interactive input, use `--create-only` followed by
   `npx prisma migrate deploy`.
   `contracts: §4b-1` · `preserves: INV-04` · `validates: AC-01`

---
