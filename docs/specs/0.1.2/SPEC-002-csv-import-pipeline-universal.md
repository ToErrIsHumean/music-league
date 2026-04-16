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
  `submissions.csv`, and `votes.csv`. Each bundle represents exactly one game
  snapshot. Partial imports are out of scope.
- **INV-06:** Matching is deterministic only. `gameKey` is derived from the
  first valid typed round row in `rounds.csv` and scopes the imported game.
  Players use globally stable `sourcePlayerId`, rounds use
  `(leagueSlug = gameKey, sourceRoundId)`, songs use `spotifyUri`, and artists
  use normalized artist name. This milestone does not use fuzzy or fallback
  matching for players, rounds, songs, or artists.
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
