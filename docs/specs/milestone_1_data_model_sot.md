# Music League App - Milestone 1 Source of Truth
## Milestone: Core Data Model and Relational Backbone

**Document type:** Source of Truth / SDD handoff  
**Project:** Music League webapp  
**Build mode:** Weekend sprint v1, beauty-first but data-correct  
**Status:** Approved scope for implementation  

---

## 1. Purpose
This milestone establishes the canonical relational model for the app. It exists to make every later milestone possible: CSV import, round pages, player modals, song history modals, and overview insights.

The implementation goal is not to create the perfect long-term schema. The goal is to create a clean, understandable, extensible schema that can support the agreed v1 product without painting the project into a corner.

This milestone is complete when the database can accurately represent:
- players
- songs
- artists
- rounds
- submissions
- import history

and when the relationships are simple enough that later milestones can query them without brittle hacks.

---

## 2. Product intent this milestone must protect
The product is:
- shared, not personalized
- social and playful
- beautiful by default
- optionally nerdy via deep links
- built fast first, iterated later

This milestone does **not** need to directly create beauty. It does need to preserve the data shape required for beauty and social exploration later.

The schema must support these approved user stories:
1. Shared league overview with polished snapshot and dynamic social insights.
2. Song lookup showing prior appearances, submitter, round, and performance.
3. Player exploration showing tendencies, notable picks, and history.
4. Admin CSV import in a fast repeatable workflow.
5. Round exploration as a full page memory unit.

---

## 3. Scope
### In scope
- Define canonical entities and relationships.
- Support repeated imports over time.
- Support normalized lookups for songs, artists, players, and rounds.
- Preserve enough submission result data for ranking-based views.
- Track imports for debugging and future rollback support.
- Add lightweight normalization fields to improve matching and dedupe.

### Out of scope
- Authentication and user accounts.
- Playwright scraping.
- Advanced fuzzy matching engine.
- External music metadata enrichment.
- AI-generated insights.
- Voting breakdowns, if the CSV does not already provide them.
- Full migration strategy for future breaking schema changes.

---

## 4. Design principles
### 4.1 Canonical over clever
Use boring, explicit relational structure. Avoid over-abstracting.

### 4.2 Normalize where it matters
Artists, songs, players, rounds, and submissions should be first-class records. Do not collapse everything into a single denormalized submissions table.

### 4.3 Preserve future flexibility
Store enough structure so the app can later support richer insights, more detailed round pages, and optional power-user views.

### 4.4 Weekend-sprint realism
Prefer practical fields over speculative ones. If a field does not clearly unlock v1 or near-term iteration, leave it out.

---

## 5. Canonical entity model
### 5.1 `players`
Represents one Music League participant identity used in the app.

Required fields:
- `id` - internal primary key
- `display_name` - canonical player name shown in UI
- `normalized_name` - normalized version for matching and dedupe
- `created_at`
- `updated_at`

Notes:
- No auth linkage is needed.
- Treat player identity as a display entity only.
- One player may appear across many rounds and submissions.

### 5.2 `artists`
Represents the canonical artist identity attached to songs.

Required fields:
- `id`
- `name`
- `normalized_name`
- `created_at`
- `updated_at`

Notes:
- Keep this separate from songs so top-artist views are easy and reliable.
- Do not model collaborations in a complicated way yet. Use one display artist string in v1.

### 5.3 `songs`
Represents the canonical song identity.

Required fields:
- `id`
- `title`
- `normalized_title`
- `artist_id`
- `canonical_label` - optional combined display helper like `Song Title - Artist`
- `created_at`
- `updated_at`

Notes:
- A song belongs to one canonical artist in v1.
- Multiple submissions can reference the same song.
- The normalization strategy should help avoid obvious duplicates but does not need to solve every edge case.

### 5.4 `rounds`
Represents one Music League round or theme.

Required fields:
- `id`
- `league_slug` - simple shared namespace, useful even in single-league v1
- `name` - theme or round title
- `sequence_number` - optional but useful for ordering if present
- `occurred_at` - optional round date if known
- `source_round_key` - original identifier from CSV if available
- `created_at`
- `updated_at`

Notes:
- Round is a first-class memory unit.
- Build for easy round pages and chronological browsing.

### 5.5 `submissions`
Represents one player's submitted song in one round.

Required fields:
- `id`
- `round_id`
- `player_id`
- `song_id`
- `score` - nullable numeric if not always available
- `rank` - nullable integer if not always available
- `submitted_at` - nullable if known
- `source_import_id` - links back to import batch
- `created_at`
- `updated_at`

Notes:
- This is the most important table for v1 features.
- A submission is the bridge connecting rounds, players, and songs.
- Add a unique constraint to prevent duplicate insertion of the same canonical submission once the row is resolved.

### 5.6 `imports`
Represents one CSV ingestion event.

Required fields:
- `id`
- `source_type` - for v1 this will usually be `csv`
- `source_filename`
- `imported_at`
- `row_count`
- `status` - `parsed`, `committed`, `failed`
- `notes` - nullable
- `created_at`
- `updated_at`

Notes:
- This table exists for confidence, debugging, and future rollback tooling.
- It is intentionally simple in v1.

---

## 6. Relationship rules
- One `artist` has many `songs`.
- One `song` belongs to one `artist`.
- One `player` has many `submissions`.
- One `round` has many `submissions`.
- One `song` has many `submissions`.
- One `import` has many `submissions`.

Required relational behavior:
- Deleting a round should not be a casual operation. Use restrictive delete behavior or soft operational discipline.
- Deleting a player, artist, or song should generally be prevented if submissions depend on it.
- Updates to canonical names should cascade safely through UI reads because submissions reference ids, not raw strings.

---

## 7. Recommended Prisma schema shape
This section is intentionally implementation-oriented so an AI coding agent can start quickly.

```prisma
model Player {
  id             Int          @id @default(autoincrement())
  displayName    String
  normalizedName String       @unique
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  submissions    Submission[]
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
  canonicalLabel  String?
  artistId        Int
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  artist          Artist       @relation(fields: [artistId], references: [id])
  submissions     Submission[]

  @@unique([artistId, normalizedTitle])
}

model Round {
  id             Int          @id @default(autoincrement())
  leagueSlug     String       @default("main")
  name           String
  sequenceNumber Int?
  occurredAt     DateTime?
  sourceRoundKey String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  submissions    Submission[]

  @@index([leagueSlug, sequenceNumber])
}

model ImportBatch {
  id             Int          @id @default(autoincrement())
  sourceType     String
  sourceFilename String?
  importedAt     DateTime     @default(now())
  rowCount       Int          @default(0)
  status         String
  notes          String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  submissions    Submission[]
}

model Submission {
  id             Int          @id @default(autoincrement())
  roundId        Int
  playerId       Int
  songId         Int
  score          Float?
  rank           Int?
  submittedAt    DateTime?
  sourceImportId Int?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  round          Round        @relation(fields: [roundId], references: [id])
  player         Player       @relation(fields: [playerId], references: [id])
  song           Song         @relation(fields: [songId], references: [id])
  sourceImport   ImportBatch? @relation(fields: [sourceImportId], references: [id])

  @@index([roundId])
  @@index([playerId])
  @@index([songId])
  @@unique([roundId, playerId, songId])
}
```

This schema is the recommended starting point, not sacred law. Minor field renaming is acceptable if the relational intent remains unchanged.

---

## 8. Normalization policy for v1
Use a lightweight deterministic normalization helper for matching.

Apply to player names, artist names, and song titles:
- lowercase
- trim leading and trailing whitespace
- collapse repeated internal whitespace to single spaces
- strip common punctuation where safe
- optionally remove smart quotes and normalize to ASCII-friendly equivalents

Example intent:
- `Mr. Brightside` and `mr brightside` should likely normalize to the same lookup token.
- `The Weeknd` and `the weeknd` should match.

Do **not** attempt advanced semantic normalization in this milestone.

---

## 9. Query support requirements
The schema must make these app queries straightforward.

### 9.1 Song modal query
Given a song id, fetch:
- song title
- artist
- all submissions of that song
- each submitter
- round name
- rank and score

### 9.2 Player modal query
Given a player id, fetch:
- player name
- all submissions by that player
- linked song and artist
- linked round
- enough aggregate data to compute simple roast templates later

### 9.3 Round page query
Given a round id, fetch:
- round metadata
- all submissions in rank order if available
- linked player
- linked song and artist

### 9.4 Overview queries
Support simple aggregate calculations such as:
- most submitted artist
- most active player
- average song rank or score per player
- submission counts by player and artist

---

## 10. Constraints and assumptions
- Single shared league is acceptable in v1, but keep `league_slug` so multi-league does not become painful later.
- Not every CSV will provide every field. Nullable fields are allowed where source fidelity is inconsistent.
- Ranking is important enough to store if present.
- Score is useful for future insights and should be stored if present.
- Voting breakdowns are not required in this milestone.

---

## 11. Migration and seeding expectations
This milestone should produce:
1. Prisma schema
2. initial migration
3. optional seed script with a tiny fixture dataset
4. one normalization utility shared by import code and lookup code

A tiny seed dataset is strongly recommended because it speeds up later UI milestone development.

---

## 12. Acceptance criteria
This milestone is done when:
- the database schema exists and migrates cleanly
- canonical entities exist for players, artists, songs, rounds, submissions, and import batches
- normalization fields exist and are populated consistently
- duplicate song definitions are prevented at the canonical level using pragmatic constraints
- downstream milestone queries can be expressed cleanly through Prisma without raw SQL hacks
- a seed dataset or fixture data allows later pages and modals to be developed immediately

---

## 13. Implementation notes for AI coding agents
- Prefer boring schema names and explicit relations.
- Avoid premature tables for genres, moods, tags, votes, or external metadata.
- Do not build auth scaffolding.
- Do not invent personalized entities or user accounts.
- Keep the schema aligned with the approved user stories, not imagined enterprise needs.
- A small amount of redundancy for developer speed is acceptable, but relational truth should live in canonical tables.

---

## 14. Explicit non-goals to protect sprint velocity
The agent should **not** spend time on:
- generalized CMS patterns
- admin permission systems
- event sourcing
- background job infrastructure
- polymorphic content models
- speculative analytics tables

---

## 15. Hand-off summary
If an implementation agent reads only one thing, the core message is:

Build a clean relational foundation with `players`, `artists`, `songs`, `rounds`, `submissions`, and `import_batches`, plus lightweight normalization. Optimize for fast later implementation of CSV import, round pages, player modals, song history modals, and overview aggregates. Keep it simple, explicit, and extensible enough for post-weekend iteration.
