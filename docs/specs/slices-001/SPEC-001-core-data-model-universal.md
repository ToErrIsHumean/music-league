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
