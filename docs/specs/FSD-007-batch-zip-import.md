# FSD - Music League Milestone 7 - FSD-007-batch-zip-import
## Batch Zip Import Script

**Status:** Draft
**Accepted on:** [YYYY-MM-DD or omit until accepted]
**Consuming role:** Maintenance documentation -> SPEC-007 authorship
**Source basis:** Operator request after adding `npm run import:zips`
**Confidence:** High

---

## 1. Scope and Purpose

Operators need a concise way to import several completed Music League exports at
once when each game is stored as a `.zip` containing the standard four CSV
files. The desired workflow is directory-oriented: point the command at a folder
of game zips and let the existing deterministic import pipeline handle each game
as its own normal import batch. Operators may also provide a directory-level
metadata CSV when the zip filenames are not good user-facing game labels or when
the archive needs operator-authored game description/speed/league-master context
that is not present in the standard Music League export, plus an explicit
finished flag for imported game lifecycle state.

This feature documents the already-added operator script rather than opening a
larger import-product milestone. The script is a local convenience wrapper over
the existing parse, stage, analyze, and commit services.

## 2. Feature Specifications

### F1 - Directory-Based Zip Import

- The command accepts one directory argument.
- It discovers top-level `.zip` files in that directory.
- Each zip represents one game snapshot and must contain:
  - `competitors.csv`
  - `rounds.csv`
  - `submissions.csv`
  - `votes.csv`
- Each zip is imported as its own `ImportBatch`; multiple zips are not merged
  into one logical import batch.

### F2 - Conservative Commit Behavior

- The command stages and validates every discovered zip before committing.
- If any zip fails extraction, parsing, staging, or validation, the command
  reports the failure and does not commit the ready zips from that run.
- Once all zips are ready, the command commits them one by one through the
  existing `commitImportBatch` service.

### F3 - Operational Output

- The command prints a compact summary for discovered zips, ready batches,
  validation issues, committed batches, game keys, affected rounds, submissions,
  and votes.
- The command requires `DATABASE_URL`.

### F4 - Optional Game Metadata Sidecar

- The zip directory may contain a top-level `game-metadata.csv` sidecar.
- The sidecar maps zip filenames to operator-authored metadata for the imported
  game.
- In the current milestone, the supported sidecar metadata is:
  - a friendly game display name that hydrates `Game.displayName`
  - a game description that hydrates `Game.description`
  - a finished flag that hydrates `Game.finished`
  - a game speed label that hydrates `Game.speed`
  - a league-master label that hydrates `Game.leagueMaster`
- `Game.description` supports up to 1000 characters after CSV decoding,
  including embedded carriage returns and newlines.
- `Game.finished` defaults to `true`; when supplied in the sidecar, it accepts
  `true` or `false`.
- `Game.speed` supports exactly `Steady`, `Accelerated`, or `Speedy`.
- `Game.leagueMaster` is stored as text in this milestone. It is not matched to
  `Player` yet.
- Sidecar metadata must not change source identity, derived `gameKey`, round
  identity, player identity, song identity, submission facts, votes, scores, or
  ranks.
- If the sidecar is malformed, references a zip that is not in the import
  directory, or contains duplicate rows for the same zip, the command reports the
  issue and does not commit ready zips from that run.

## 3. Non-Goals

- No browser import UI.
- No HTTP API.
- No new import semantics beyond the existing four-file completed-snapshot
  contract.
- No arbitrary metadata store or unsupported sidecar columns.
- No game-level date field in this milestone; imported date evidence remains on
  `Round.occurredAt`, with archive surfaces deriving game timeframe/recency from
  rounds.
- No player relationship, foreign key, or identity matching for league-master
  metadata in this milestone.
- No overwrite of non-empty existing `Game.displayName`, `Game.description`,
  `Game.speed`, or `Game.leagueMaster`; `Game.finished` may be set explicitly
  from sidecar metadata.
- No cross-game all-or-nothing database transaction.
- No new npm dependency for zip parsing.

## 4. Usage

```bash
DATABASE_URL="file:./dev.db" npm run import:zips -- import
```

Optional metadata sidecar:

```csv
zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster
spring-2024.zip,Spring 2024,"A two-line description
with a preserved line break.",true,Accelerated,Alex
summer-2024.zip,Summer 2024,,false,Speedy,Sam
```

The source zips are not needed by the app after a successful import, but they
may be retained externally as source backups.

## Appendix A: Historical Player Source ID Reuse

One known Music League export anomaly reuses a player source ID across two
canonical people. The import pipeline normalizes this at import time, before
canonical player matching:

- Reused source ID: `19957d9ac36645bf852a590e3811b3b9`
- Historical canonical source ID: `f2c7860442964a8aa327c08f81ce884e`
- Cutoff date: `2025-10-01`

Submission and vote references to the reused ID are remapped only when the
referenced round occurred before `2025-10-01`. References on or after
`2025-10-01`, or references whose round date is missing or ambiguous, remain
unchanged. This is not UI/query-time coalescing and must not change source round
IDs, song IDs, vote points, scores, ranks, game keys, or snapshot reconciliation
semantics.

Existing canonical data, if already imported with the reused ID, should be
handled by a separate one-time repair script with collision checks rather than
by implicit import-side mutation of unrelated rows.

## Appendix B: Game Finished Metadata

`Game.finished` records whether the imported game has completed. Canonical rows
default to `true`, matching the completed-snapshot import posture. Operators may
set `game_finished` in `game-metadata.csv` to `false` for an imported game that
should remain distinguishable as unfinished.
