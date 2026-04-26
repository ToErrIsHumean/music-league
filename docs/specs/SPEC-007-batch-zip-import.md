# SPEC: Batch Zip Import Script

> **Version:** 0.1.3-draft
> **Milestone:** 7 - Batch Zip Import
> **Status:** `draft`
> **Author:** architecture-audit 3
> **Depends-on:** `docs/specs/SPEC-002-csv-import-pipeline.md`
> **Invalidated-by:** changes to `docs/specs/FSD-007-batch-zip-import.md` or the import service contracts in `docs/specs/SPEC-002-csv-import-pipeline.md`

---

## 1. Objective

Document the local operator script for importing a directory of Music League
game zip files, with optional directory-level metadata for friendly game labels,
descriptions, finished state, speed classifications, and league-master labels.
Each zip remains one standard four-file CSV bundle and one normal
`ImportBatch`; the script automates repeated local invocation of the existing
import services while allowing trusted operator metadata to hydrate supported
canonical game metadata.

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| FSD | `docs/specs/FSD-007-batch-zip-import.md` | Operator intent, optional metadata sidecar, and exclusions. |
| Import services | `src/import/parse-bundle.js`, `src/import/stage-batch.js`, `src/import/analyze-batch.js`, `src/import/commit-batch.js`, `src/import/list-batch-issues.js` | Existing parse, stage, validate, commit, and issue-reporting pipeline. |
| Batch zip script | `scripts/import-zips.js` | Implements the directory-of-zips wrapper. |
| npm script | `package.json` | Exposes `import:zips`. |
| Existing import spec | `docs/specs/SPEC-002-csv-import-pipeline.md` | Governs the four-file completed-snapshot contract and replay-safe commit semantics. |
| Game schema | `prisma/schema.prisma` | Existing `Game` has `sourceGameId`, `displayName`, `createdAt`, and `updatedAt`; it does not yet have `description`, `finished`, `speed`, `leagueMaster`, or an imported game-level date. |
| Archive date derivation | `src/archive/archive-utils.js`, `src/archive/game-archive-page.js` | Game recency/timeframe is derived from child `Round.occurredAt` values, with `Game.createdAt` used as an ordering fallback. |

Secondary heuristic `X` for this architecture-audit pass: operator ergonomics
with explicit metadata provenance and minimal new moving parts. Drift check:
no-drift.

## 3. Invariants

- **INV-01:** Each `.zip` is treated as exactly one completed Music League game
  snapshot and one normal `ImportBatch`.
- **INV-02:** The script must use the existing parse, stage, analyze, issue, and
  commit service contracts for all four-file CSV source data. The only
  script-owned canonical writes allowed by this spec are the bounded `Game`
  metadata updates in §4d-3.
- **INV-03:** If any discovered zip fails before the commit phase, ready zips
  from that run are not committed.
- **INV-04:** Re-import behavior remains governed by `SPEC-002`: matching
  `gameKey` refreshes that game's snapshot rather than duplicating canonical
  game data.
- **INV-05:** The command must not introduce a new npm dependency.
- **INV-06:** Sidecar metadata must not alter `gameKey`, source IDs, parsed CSV
  facts, staged rows, scores, ranks, or snapshot reconciliation semantics.
- **INV-07:** The only supported sidecar destinations in this milestone are
  `Game.displayName`, `Game.description`, `Game.finished`, `Game.speed`, and
  `Game.leagueMaster`.
- **INV-08:** Sidecar metadata may initialize missing or blank `Game` metadata,
  but it must not overwrite a non-empty existing `Game.displayName`,
  `Game.description`, `Game.speed`, or `Game.leagueMaster`. `Game.finished`
  is an explicit boolean sidecar value and may update the committed default.
- **INV-09:** This milestone must not introduce a game-level date field.
  Imported date evidence remains on `Round.occurredAt`; game recency/timeframe
  remains derived from child rounds.
- **INV-10:** `Game.leagueMaster` is plain imported text in this milestone. It
  must not be matched to `Player`, stored as a foreign key, or used as player
  identity evidence.

## 4. Interface Contracts

### 4a. API Surface

No HTTP API is introduced.

### 4b. Data Schema (migrations)

#### §4b-1. Game metadata fields

Add game metadata fields:

```prisma
enum GameSpeed {
  Steady
  Accelerated
  Speedy
}

model Game {
  id           Int        @id @default(autoincrement())
  sourceGameId String     @unique
  displayName  String?
  description  String?
  finished     Boolean    @default(true)
  speed        GameSpeed?
  leagueMaster String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  rounds       Round[]

  @@index([sourceGameId])
}
```

Migration rules:

- Existing `Game` rows receive `description = null`, `finished = true`,
  `speed = null`, and `leagueMaster = null`.
- No `Game.date`, `Game.occurredAt`, or other game-level date column is added.
- `description` length is enforced by import validation, not by the SQLite
  column type.
- `finished` is non-null boolean metadata and defaults to `true`.
- `speed` is nullable and may contain only `Steady`, `Accelerated`, or
  `Speedy`.
- `leagueMaster` is nullable text. No foreign key or index is added for
  `leagueMaster`.

### 4c. Component Contracts

No React component contract is introduced.

### 4d. Internal Boundaries

#### §4d-1. Optional `game-metadata.csv` sidecar

The zip directory may include a top-level metadata sidecar:

```csv
zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster
spring-2024.zip,Spring 2024,"A two-line description
with a preserved line break.",true,Accelerated,Alex
summer-2024.zip,Summer 2024,,false,Speedy,Sam
```

Contract rules:

- The sidecar filename is exactly `game-metadata.csv`.
- Header normalization is case-insensitive and whitespace-insensitive.
- Required headers are `zip_filename`, `game_display_name`,
  `game_description`, `game_finished`, `game_speed`, and `LeagueMaster`.
- `zip_filename` matches the basename of one discovered top-level `.zip` file
  after trimming. Directory components are invalid.
- `game_display_name` is trimmed; blank values mean no display-name metadata for
  that zip.
- `game_description` is decoded as a normal CSV field. Embedded carriage returns
  and newlines are preserved when the field is quoted.
- `game_description` may be blank. When non-blank, it must be at most 1000
  characters after CSV decoding, counting embedded `\r` and `\n` characters.
- `game_finished` is trimmed. Blank values mean no finished-state metadata for
  that zip. Non-blank values must be `true` or `false`, case-insensitive.
- `game_speed` is trimmed. Blank values mean no speed metadata for that zip.
- Non-blank `game_speed` must exactly match `Steady`, `Accelerated`, or
  `Speedy`.
- `LeagueMaster` is trimmed; blank values mean no league-master metadata for
  that zip.
- Non-blank `LeagueMaster` is stored as text only and is not resolved against
  players.
- Every sidecar row must provide at least one non-blank metadata value among
  `game_display_name`, `game_description`, `game_finished`, `game_speed`, and
  `LeagueMaster`.
- Duplicate `zip_filename` rows are invalid.
- Rows for zip files not discovered in the import directory are invalid.
- Discovered zip files without sidecar rows remain valid and use the existing
  metadata fallback from the import pipeline.
- Extra sidecar columns are invalid in this milestone; unsupported metadata must
  not be silently accepted.
- Sidecar validation runs before zip extraction, staging, analysis, or commit.
  Any sidecar validation failure aborts the run before ready zips are committed.

#### §4d-2. npm command

```bash
DATABASE_URL="file:./dev.db" npm run import:zips -- <directory-containing-zip-files>
```

Behavior:

- Discover top-level files ending in `.zip`, sorted by filename.
- If `game-metadata.csv` is present, parse and validate it against discovered
  zip basenames before processing any zip.
- Extract each zip to temporary storage.
- Resolve either root-level CSVs or a single child directory containing the four
  required CSVs.
- Run `parseMusicLeagueBundle`, `stageImportBundle`, and `analyzeImportBatch`.
- On validation failure, print `listImportBatchIssues` output and abort without
  committing ready zips from the same run.
- If every zip is ready, call `commitImportBatch` once per zip.
- After a zip commits, apply its resolved sidecar metadata to the committed
  canonical `Game` through §4d-3.
- Remove temporary extraction directories before exit.

Errors:

- Missing directory argument.
- Argument path is not a directory.
- No `.zip` files found.
- Missing `DATABASE_URL`.
- Malformed `game-metadata.csv`.
- Missing required sidecar headers.
- Unsupported sidecar columns.
- Duplicate sidecar row for a zip filename.
- Sidecar row references a zip filename not discovered in the import directory.
- Sidecar row has no non-blank metadata values.
- `game_description` exceeds 1000 characters after CSV decoding, including
  embedded `\r` and `\n`.
- `game_finished` is not `true` or `false`.
- `game_speed` is not one of `Steady`, `Accelerated`, or `Speedy`.
- Zip extraction failure.
- Existing parser, staging, validation, or commit errors.

#### §4d-3. Apply committed game metadata

Suggested script-local helper:

```js
applyCommittedGameMetadata(input: {
  prisma: PrismaClient,
  gameKey: string,
  metadata: {
    gameDisplayName: string | null,
    gameDescription: string | null,
    gameFinished: boolean | null,
    gameSpeed: 'Steady' | 'Accelerated' | 'Speedy' | null,
    leagueMaster: string | null
  } | null
}): Promise<{
  gameId: number,
  displayName: string | null,
  description: string | null,
  finished: boolean,
  speed: 'Steady' | 'Accelerated' | 'Speedy' | null,
  leagueMaster: string | null,
  displayNameUpdated: boolean,
  descriptionUpdated: boolean,
  finishedUpdated: boolean,
  speedUpdated: boolean,
  leagueMasterUpdated: boolean
}>
```

Contract rules:

- `gameKey` must be the committed batch's derived `gameKey`.
- If `metadata` is null, the helper returns the canonical game unchanged.
- The helper finds the canonical `Game` by `sourceGameId = gameKey.trim()`.
- If the canonical game does not exist after commit, the helper throws.
- If a target `Game` metadata field is null or blank and metadata has a
  validated non-empty value for that field, the helper updates that field.
- If a target `Game` metadata field is already non-empty, the helper preserves it
  and reports that field's `*Updated` flag as `false`.
- If `metadata.gameFinished` is non-null, the helper updates `Game.finished`
  when it differs from the current canonical value.
- The helper must not write `Round`, `Player`, `Artist`, `Song`, `Submission`,
  `Vote`, staged import rows, or `ImportBatch.sourceFilename`.
- The helper must not resolve, create, update, or link a `Player` from
  `leagueMaster`.
- The helper must not write a game-level date field.

### 4e. Dependencies

| Package | Purpose | Rationale |
|---|---|---|
| None | N/A | The script uses existing npm dependencies and the existing import services. |

System prerequisite: `unzip` must be available on the operator machine.

## 5. Acceptance Criteria

| ID | Condition | Verification |
|---|---|---|
| AC-01 | `package.json` exposes `npm run import:zips -- <directory>`. | `manual` |
| AC-02 | A directory containing valid game zips is imported by validating all zips before committing any. | `manual` |
| AC-03 | Invalid zips or invalid bundles print diagnostic errors/issues and leave ready zips from that run uncommitted. | `manual` |
| AC-04 | No new npm dependency is added. | `review` |
| AC-05 | A valid `game-metadata.csv` maps discovered zip filenames to supported game metadata without changing derived `gameKey` or four-file import semantics. | `test` |
| AC-06 | Invalid sidecar metadata aborts before commit and reports the offending sidecar condition. | `test` |
| AC-07 | Sidecar metadata initializes blank `Game.displayName`, `Game.description`, `Game.speed`, and `Game.leagueMaster` after commit, may explicitly set `Game.finished`, and does not overwrite existing non-empty text metadata values. | `test` |
| AC-08 | Prisma schema and migration add nullable `Game.description`, non-null default-true `Game.finished`, nullable `Game.speed`, and nullable `Game.leagueMaster` without adding a game-level date field or player relationship. | `test` |

## 6. Task Decomposition Hints

1. **[TASK-01] Add sidecar metadata parsing** - Parse and validate optional
   `game-metadata.csv` in `scripts/import-zips.js` before any zip extraction or
   staging work begins.
   `contracts: §4d-1, §4e` · `preserves: INV-03, INV-05, INV-06, INV-07` · `validates: AC-04, AC-05, AC-06`
2. **[TASK-02] Add game metadata schema fields** - Add the nullable
   `Game.description`, nullable `Game.speed`, nullable `Game.leagueMaster`, and
   default-true `Game.finished` schema fields and migrations without adding a
   game-level date column or player relationship.
   `contracts: §4b-1` · `preserves: INV-04, INV-07, INV-08, INV-09, INV-10` · `validates: AC-08`
3. **[TASK-03] Apply committed game metadata** - Keep the zip importer
   aligned with the existing import service contracts while applying sidecar
   `Game` metadata only after successful commit.
   `contracts: §4d-2, §4d-3, §4e` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, INV-10` · `validates: AC-01, AC-02, AC-03, AC-04, AC-05, AC-07`

### Dependency Graph

```text
TASK-01:
TASK-02:
TASK-03: TASK-01,TASK-02
```

## 7. Out of Scope

- [ ] Browser import UI - not part of this local operator script.
- [ ] HTTP import API - not required for local maintenance.
- [ ] Cross-game all-or-nothing database transaction - each underlying commit
  remains the existing per-game transaction.
- [ ] New zip parsing npm package - the script uses the system `unzip` binary.
- [ ] Arbitrary sidecar metadata storage - unsupported until a future schema and
  product surface define where those facts live.
- [ ] Sidecar metadata for rounds, players, songs, submissions, votes, scores,
  or ranks - this milestone only supports `Game.displayName`,
  `Game.description`, `Game.finished`, `Game.speed`, and `Game.leagueMaster`.
- [ ] Game-level date metadata - current date evidence remains round-scoped via
  `Round.occurredAt`, and archive game timeframe remains derived from rounds.
- [ ] Mapping `Game.leagueMaster` to `Player` - this milestone stores the
  sidecar value as text only.
- [ ] Overwriting non-empty game metadata from the sidecar - preserving existing
  curated labels avoids accidental operator data loss.

## 8. Open Questions

- None.

---

## Appendix D: Discoveries Log

- None.

## Appendix E: Historical Player Source ID Reuse

The import service has one checked-in player source ID remap for a source
platform reuse case:

| Field | Value |
|---|---|
| Reused source ID | `19957d9ac36645bf852a590e3811b3b9` |
| Historical canonical source ID | `f2c7860442964a8aa327c08f81ce884e` |
| Cutoff date | `2025-10-01` |

Contract:

- Apply during import staging before canonical `Player.sourcePlayerId` matching.
- Use the referenced `Round.occurredAt` date for submission and vote rows.
- Remap only when the referenced round occurred before `2025-10-01`.
- Do not remap rows on or after `2025-10-01`.
- If the referenced round date is missing, invalid, or ambiguous, do not remap.
- Preserve source round IDs, song IDs, vote points, scores, ranks, game keys,
  and snapshot reconciliation semantics.
- Do not implement UI/query-time coalescing for this case.
- Correct existing imported rows, if needed, with a separate repair script that
  checks for submission/vote uniqueness collisions before writing.

## Appendix F: Game Finished Metadata

`Game.finished` records whether the imported game has completed. Canonical rows
default to `true`, matching the completed-snapshot import posture. Operators may
set `game_finished` in `game-metadata.csv` to `false` for an imported game that
should remain distinguishable as unfinished.
