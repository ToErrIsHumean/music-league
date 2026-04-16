# FSD — Music League Milestone 1 — FSD-001-core-data-model
## Core Data Model and Relational Backbone

**Status:** Draft
**Accepted on:** 2026-04-16
**Consuming role:** Planner → SPEC-001 authorship
**Source basis:** See §4
**Confidence:** High

---

## 1. Scope and Purpose

### For the PM

Milestone 1 produces no user-visible surface. It produces the relational backbone
that makes every subsequent milestone fast and clean.

The five user stories the full product must deliver — none of which ship here,
all of which depend on this:

1. **League snapshot.** Open the app and immediately see a lively, data-backed
   summary of the whole league — funny patterns, memorable picks, social
   dynamics — grounded in real submissions.
2. **Round memory.** Browse past rounds and experience each as a cohesive
   moment: theme, every submission, and result — not a flat list of rows.
3. **Player exploration.** Click a player's name and see a playful,
   data-backed summary of their music taste, tendencies, and submission history.
4. **Song lookup.** Look up a song and immediately know whether it has appeared
   before, who submitted it, in which round, and how it performed.
5. **Admin import.** Upload a CSV export after a round, review flagged issues,
   and commit clean data in a fast, repeatable workflow.

When this milestone closes: a clean schema that migrates in a fresh environment,
a normalization helper shared by all ingestion and lookup code, and a seed
dataset that lets Milestone 3–6 authors build pages and modals without waiting
for real import data.

**Scope note:** The source CSV export provides full vote-level data
(`votes.csv`). The original conditional exclusion of voting breakdown tables no
longer applies; `Vote` is a first-class entity in this milestone.

### For the Architect

Prisma schema, initial migration, normalization utility, and seed data. No API
surface, no UI.

Three workstreams:

1. **Schema.** Seven entities — `Player`, `Artist`, `Song`, `Round`,
   `Submission`, `Vote`, `ImportBatch` — with foreign keys, unique constraints,
   and indexes sufficient for all downstream query patterns. No speculative
   tables.
2. **Normalization utility.** A single deterministic helper consumed by both
   import and lookup code. `spotifyUri` on `Song` is the primary dedup key when
   present; normalization is the fallback.
3. **Seed data.** A minimal fixture dataset so Milestone 3–6 authors don't
   depend on a real CSV import.

Done: migration applies cleanly, all entities persistable and queryable via
Prisma, normalization available as a shared module, and all downstream query
patterns (song modal, player modal, round page, overview aggregates,
vote-based scoring) expressible without raw SQL.

---

## 2. Feature Specifications

### F1 — Canonical Entity Schema

**Outcome:** The database contains seven first-class entities that correctly
represent the domain, enforce relational integrity, and support all downstream
query patterns without brittle hacks.

#### F1.1 Player entity

- Fields: `id`, `displayName`, `normalizedName` (unique), `sourcePlayerId`
  (unique, optional), `createdAt`, `updatedAt`.
- `sourcePlayerId`: the hex ID from `competitors.csv`. Primary import-matching
  key; normalization-based matching is the fallback when absent.
- No authentication linkage; player is a display entity only.

#### F1.2 Artist entity

- Fields: `id`, `name`, `normalizedName` (unique), `createdAt`, `updatedAt`.
- `name` may contain a comma-separated multi-artist string (e.g. `"The Maine,
  Taking Back Sunday, Charlotte Sands"`). Treated as one display entity in v1;
  multi-artist normalization is deferred.
- Separate from songs so per-artist aggregates are query-efficient.

#### F1.3 Song entity

- Fields: `id`, `title`, `normalizedTitle`, `artistId` (FK → Artist),
  `spotifyUri` (unique, optional), `createdAt`, `updatedAt`.
- `spotifyUri` is the primary dedup key when present. The `(artistId,
  normalizedTitle)` pair is the fallback unique constraint for songs without a
  URI.
- One canonical artist per song in v1; multi-artist modeling deferred.

#### F1.4 Round entity

- Fields: `id`, `leagueSlug` (default `"main"`), `name`, `description`
  (optional), `playlistUrl` (optional), `sequenceNumber` (optional integer),
  `occurredAt` (optional date), `sourceRoundKey` (optional), `createdAt`,
  `updatedAt`.
- Unique constraint on `(leagueSlug, sourceRoundKey)` — prevents duplicate
  round creation on re-import. Null values are exempt (multiple rounds without
  a source key are allowed).
- Index on `(leagueSlug, sequenceNumber)`.
- `leagueSlug` is present in single-league v1 so multi-league does not become
  a schema migration later.

#### F1.5 Submission entity

- Fields: `id`, `roundId` (FK → Round), `playerId` (FK → Player), `songId`
  (FK → Song), `score` (nullable float, derived), `rank` (nullable integer,
  derived), `comment` (optional), `visibleToVoters` (boolean, default false),
  `submittedAt` (nullable), `sourceImportId` (nullable FK → ImportBatch),
  `createdAt`, `updatedAt`.
- Unique constraint on `(roundId, playerId, songId)`. Multiple submissions per
  player per round are permitted; this constraint prevents exact duplicate
  triples from re-import.
- Individual indexes on `roundId`, `playerId`, `songId`.
- `score` is the sum of `pointsAssigned` across all `Vote` rows for this
  submission. `rank` is the ordinal rank by score within the round. Both are
  computed and stored at import time for query efficiency; neither is a direct
  source field.

#### F1.6 Vote entity

- Fields: `id`, `roundId` (FK → Round), `voterId` (FK → Player), `songId`
  (FK → Song), `pointsAssigned` (integer), `comment` (optional), `votedAt`
  (nullable, source timestamp from CSV), `sourceImportId` (nullable FK →
  ImportBatch), `createdAt`, `updatedAt`.
- Unique constraint on `(roundId, voterId, songId)` — a voter casts at most one
  vote per song per round.
- Individual indexes on `roundId`, `voterId`, `songId`.
- Primary source of truth for scores. `Submission.score` and
  `Submission.rank` are derived from this table.

#### F1.7 ImportBatch entity

- Fields: `id`, `sourceType` (e.g. `"csv"`), `sourceFilename` (optional),
  `importedAt`, `rowCount`, `status` (`parsed` | `committed` | `failed`),
  `notes` (optional), `createdAt`, `updatedAt`.
- Audit trail for debugging and future rollback tooling.

#### F1.8 Relationship rules

- `Artist` → many `Songs`; `Player`, `Round`, `Song`, `ImportBatch` → many
  `Submissions`.
- `Player` (as voter), `Round`, `Song`, `ImportBatch` → many `Votes`.
- Deleting a `Round` requires explicit operational intent; default behavior is
  restrictive.
- Deleting a `Player`, `Artist`, or `Song` is blocked when dependent
  `Submission` or `Vote` rows exist.

---

### F2 — Normalization Utility

**Outcome:** Player names, artist names, and song titles resolve to the same
lookup token regardless of casing, spacing, or common punctuation variation.
When a Spotify URI is available, it takes precedence over normalization for song
deduplication.

#### F2.1 Normalization behavior

- Input string is lowercased.
- Leading and trailing whitespace is stripped.
- Repeated internal whitespace is collapsed to a single space.
- Common punctuation is stripped where safe; the full character class must be
  specified in SPEC-001 with test fixtures (see §5).
- Smart quotes and non-ASCII quotation equivalents are normalized to ASCII
  counterparts before stripping.

#### F2.2 Normalization scope and placement

- Applied to: `displayName → normalizedName` on Player, `name →
  normalizedName` on Artist, `title → normalizedTitle` on Song.
- A single shared module; consumed by both the import pipeline (Milestone 2)
  and any lookup or deduplication logic.
- When `Song.spotifyUri` is present, it is the dedup key; normalization is used
  for display cleanup and fallback matching only.
- Phonetic matching and spelling correction are out of scope for v1.

---

### F3 — Migration and Schema Infrastructure

**Outcome:** A Prisma-managed schema that migrates cleanly in a fresh
environment and is the stable base for all subsequent milestones.

#### F3.1 Prisma schema

- Defines all seven entities per F1. Minor field renaming acceptable; relational
  intent must be preserved.

#### F3.2 Initial migration

- A single initial migration creates all tables, constraints, and indexes.
- Applies cleanly via `prisma migrate dev` or `prisma migrate deploy`.

---

### F4 — Seed Dataset

**Outcome:** A minimal fixture dataset exists in the development database so
that Milestone 3–6 authors can build and test pages and modals without depending
on a real CSV import.

#### F4.1 Fixture scope

- At minimum: 2 rounds, 3–4 players, 5–8 songs with associated artists, enough
  submissions to populate one full round with rank and score data, and at least
  one round with partial data (nullable score/rank).
- At least one song must appear in both rounds (same or different submitters) so
  that the song modal's submission history contains multiple rows.
- Vote rows sufficient to derive the stored `score` and `rank` values on all
  scored submissions.
- Fixture data must satisfy all five downstream query patterns: song modal,
  player modal, round page, overview aggregates, and vote-based scoring.

#### F4.2 Seed execution

- A seed script applies the fixture data via Prisma seed or an explicit script
  entry point.
- Re-running the seed script is idempotent (upsert or truncate-then-insert;
  strategy deferred to SPEC-001 — see §5).

---

### F5 — Query Readiness

**Outcome:** All downstream query patterns are expressible cleanly through
Prisma ORM without raw SQL. No downstream milestone should need to work around
the schema.

#### F5.1 Song modal query

- Given a `songId`: retrieve song title, artist name, and all submissions of
  that song with each submitter's display name, round name, rank, and score.

#### F5.2 Player modal query

- Given a `playerId`: retrieve player display name, all submissions by that
  player, each linked song with artist, linked round name, and enough aggregate
  data (submission count, scores, ranks, vote comments received) to compute
  simple insight templates.

#### F5.3 Round page query

- Given a `roundId`: retrieve round name, description, and playlist URL; all
  submissions in rank order where available; each linked player display name;
  and each linked song with artist.

#### F5.4 Overview aggregate queries

- Schema supports: most-submitted artist, most active player, average rank or
  score per player, and total submission and round counts.
- Implementation note: "most submitted artist" requires grouping through the
  `Song → Artist` relation. This is achievable via multi-step Prisma queries
  with application-layer aggregation; it is not a single `groupBy` call. No raw
  SQL is required, but SPEC-001 authors should not expect a direct one-query
  aggregate for artist-level rollups.

#### F5.5 Vote-based queries

- Given a `submissionId` (or `roundId` + `songId`): retrieve all votes with
  voter display name, points assigned, and comment.
- Given a `playerId` as voter: retrieve all votes cast, linked songs, rounds,
  and points assigned — sufficient to derive per-voter patterns (e.g. consistent
  high/low scorer, frequent commenter).

---

## 3. Explicit Exclusions

- No authentication, user accounts, or session isolation of any kind.
- No API routes or HTTP surface — schema only.
- No UI, no frontend scaffolding.
- No Playwright scraping or external data ingestion.
- No AI-generated insights, external metadata (Spotify enrichment, MusicBrainz),
  or speculative analytics tables (genres, moods, tags).
- No album metadata on `Song` — present in source CSV but no downstream
  milestone consumes it.
- No phonetic or fuzzy matching — normalization is deterministic and lightweight.
- No multi-artist relational modeling — one display artist string per song in v1.
- No event sourcing, background job infrastructure, or migration strategy for
  future breaking schema changes.

---

## 4. Provenance

- `docs/specs/milestone_1_data_model_sot.md` — canonical entity definitions,
  field shapes, relationship rules, normalization policy, query support
  requirements, and non-goals.
- `docs/specs/milestone_2_csv_pipeline.md` through
  `milestone_6_league_overview.md` — consulted to verify F5 query readiness
  requirements against what downstream milestones actually need.
- `import/gameid_placeholder/` — actual CSV export structure (`competitors.csv`,
  `rounds.csv`, `submissions.csv`, `votes.csv`); drove addition of `Vote`
  entity, `spotifyUri`, `sourcePlayerId`, `Round.description`,
  `Round.playlistUrl`, `Submission.comment`, `Submission.visibleToVoters`, and
  reversal of the voting-breakdown exclusion.
- `docs/templates/FSD-template.md` — structural reference.
- House style anchor: `projectABE/docs/specs/FSD-004-goals-schema.md`.

---

## 5. Uncertainty and Open Questions

- **Unicode normalization.** Whether to strip accents (`é → e`) is unresolved.
  SPEC-001 must decide the exact Unicode normalization form and document it with
  test fixtures before the normalization utility is written.

- **Punctuation character class.** F2.1 does not enumerate the full set of
  characters stripped or normalized. Characters common in song and artist names
  (`!`, `?`, `(`, `)`, `-`, `&`, `+`) are unaddressed. SPEC-001 must define the
  complete character class and supply normalization test fixtures.

- **`sequenceNumber` source.** Not present in `rounds.csv`. SPEC-001 must
  define whether it is derived from CSV row order, an explicit import field, or
  manual entry, and how to handle rounds where it is absent.

- **Fallback sort when `score` and `rank` are both null.** Round page and
  overview queries assume at least one ordering signal. SPEC-001 must specify
  the fallback (e.g. `submittedAt`, insertion order).

- **Seed idempotency strategy.** Upsert preserves local manual edits;
  truncate-then-insert is simpler but destructive. SPEC-001 should decide based
  on expected development workflow.

- **`ImportBatch.rowCount` lifecycle.** Does this reflect parsed rows,
  committed rows, or both? The M2 pipeline has distinct parse and commit stages.
  SPEC-001 must specify which stage writes this field and what it counts.

- **`ImportBatch.status` — native enum vs. validated string.** SPEC-001 should
  decide based on migration tooling preference.
