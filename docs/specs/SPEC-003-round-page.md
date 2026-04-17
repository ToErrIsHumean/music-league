# SPEC: Game Browser and Round Detail Surface

> **Version:** 0.1.4-draft
> **Milestone:** 3 — Round Page
> **Status:** `draft`
> **Author:** final-review 2
> **Depends-on:** `docs/specs/SPEC-001-core-data-model.md`, `docs/specs/SPEC-002-csv-import-pipeline.md`
> **Invalidated-by:** none

---

## 1. Objective

Turn imported Music League data into a browseable archive that feels slick,
easy to move through, and immediately legible. This milestone closes when the
app shows every game as a first-class group, each game exposes concise round
summaries, and opening a round reveals a full, readable round story without
losing context.

The implementation must favor artifact-first presentation over dashboards:
high-signal summaries, playful but concise highlights, and a lightweight
open/close flow. Milestone 3 establishes the browse surface, explicit game
identity, and initial song/player modal shells that preserve context; richer
cross-round modal content remains a later-milestone expansion.

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| FSD | `docs/specs/FSD-003-round-page.md` | Product source of truth for game-first archive browsing, round detail, deep-linking, and context-preserving drill-in |
| Upstream spec | `docs/specs/SPEC-002-csv-import-pipeline.md` | Current game-scoped import contract and replay semantics; presently derives game grouping from `gameKey` / `Round.leagueSlug` |
| Prisma schema | `prisma/schema.prisma` | Current canonical schema has `Round.leagueSlug` but no first-class `Game` model |
| Seed data | `prisma/seed.js` | Current fixture only seeds one logical game (`leagueSlug = "main"`) with two rounds, which is insufficient to validate archive grouping |
| Query evidence | `prisma/tests/queries.test.js` | Confirms downstream round detail data shape and rank-order query assumptions already exist at the Prisma layer |
| Import parser | `src/import/parse-bundle.js` | Already captures bundle-level `sourceLabel`; canonical game identity currently flows through `parsedBundle.gameKey`, derived from the first valid round row |
| Runtime/deps | `package.json` | Repo currently has Prisma + Node only; no UI framework or route surface exists yet |

Current repo evidence shows solid data and import groundwork, but no consumer
UI and no explicit game entity. The FSD's browse-by-game model therefore
requires both a product surface and an architectural correction: the archive
must stop treating `Round.leagueSlug` as the authoritative game boundary.

## 3. Invariants

- **INV-01:** `Game` is the authoritative archive grouping boundary for
  Milestone 3. New archive queries and UI contracts MUST use explicit game
  identity and MUST NOT infer groups from round names, display labels, or
  transient sort order.
- **INV-02:** Round detail open state is URL-addressable and reversible. A user
  must be able to enter a specific round directly and dismiss it without losing
  surrounding archive orientation.
- **INV-03:** Round detail remains artifact-first: at most 3 quick-scan
  highlights, followed by the full submission list. This milestone MUST NOT add
  charts, filters, vote breakdowns, or analytics-heavy framing.
- **INV-04:** Missing optional metadata such as game display name, round date,
  winner, score, or rank must never hide the game, round summary, or submission
  row. Fallback presentation must read as intentional, not broken.
- **INV-05:** Milestone 3 song and player drill-ins use round-scoped modal
  shells rooted in the currently open round. They must preserve the round
  overlay beneath them and MUST NOT expand into cross-round history or
  personality summaries reserved for Milestones 4 and 5.
- **INV-06:** Introducing explicit `Game` identity must preserve replay-safe
  import behavior and the Milestone 2 game-ID rule. Existing committed data
  must be backfilled deterministically, and future imports must continue to
  reconcile one game snapshot at a time using the deterministic game identifier
  derived from the first valid round ID in bundle order.
- **INV-07:** During Milestone 3, every code path that creates or updates a
  `Round` MUST keep `Round.leagueSlug` equal to the owning
  `Game.sourceGameId`. The mirror remains temporary, but divergence during the
  transition is invalid.

## 4. Interface Contracts

### 4a. API Surface

This milestone introduces an app route surface, not a public JSON API. Server
rendering, route handlers, or server actions MAY be used internally, but the
canonical user-facing contract is the archive route below.

#### §4a-1. Archive browser route with URL-state overlays

```http
GET /?round=<roundId>&song=<songId>&player=<playerId>
```

```txt
Query params:
  round?: integer   // canonical Round.id for the open round overlay
  song?: integer    // canonical Song.id for the nested song modal shell
  player?: integer  // canonical Player.id for the nested player modal shell

Response:
  200 HTML document containing:
    - all archive game groups
    - deterministic round summaries within each game
    - optional round detail overlay for ?round=
    - optional nested song/player modal shell for ?song= or ?player=

Validation / error handling:
  - invalid integer params are ignored
  - ?round=<id> that does not resolve renders the archive plus a non-blocking
    "Round not found" notice; no round overlay opens
  - ?song= or ?player= without a valid open round are ignored
  - ?song= or ?player= that does not belong to the open round are ignored while
    keeping the round overlay open
  - both ?song= and ?player= set at once is invalid; prefer ?song= and ignore
    ?player=
```

**Route behavior notes:**

- The base archive is always renderable without query params.
- Opening a round from a summary card mutates URL state on `/`; it does not
  navigate to a different pathname.
- Direct entry to `/?round=<id>` must render the same round detail content as
  in-app open.

### 4b. Data Schema (migrations)

#### §4b-1. Explicit `Game` boundary and `Round` parent linkage

File: `prisma/schema.prisma` (new migration extends Milestone 2 schema)

```prisma
model Game {
  id           Int       @id @default(autoincrement())
  sourceGameId String    @unique
  displayName  String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  rounds       Round[]

  @@index([sourceGameId])
}

model Round {
  id             Int       @id @default(autoincrement())
  gameId         Int
  leagueSlug     String    @default("main") // temporary compatibility mirror of Game.sourceGameId during M3
  name           String
  description    String?
  playlistUrl    String?
  sequenceNumber Int?
  occurredAt     DateTime?
  sourceRoundId  String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  game          Game       @relation(fields: [gameId], references: [id])
  submissions   Submission[]
  votes         Vote[]
  importRows    ImportRoundRow[]
  importSubmissions ImportSubmissionRow[]
  importVotes   ImportVoteRow[]

  @@index([gameId, sequenceNumber])
  @@index([gameId, occurredAt])
  @@index([leagueSlug, sequenceNumber])
  @@unique([gameId, sourceRoundId])
  @@unique([leagueSlug, sourceRoundId])
}
```

**Migration / compatibility rules:**

- Backfill one `Game` row per distinct existing `Round.leagueSlug`, with
  `Game.sourceGameId = Round.leagueSlug` and `Game.displayName = null`.
- Backfill every existing `Round.gameId` to the matching `Game.id`.
- `Game.sourceGameId` is the canonical Milestone 3 game identifier and MUST
  match the Milestone 2 `gameKey` contract: the deterministic identifier
  derived from the first valid round source ID in bundle order.
- Import commit flow MUST upsert or reuse exactly one `Game` row per committed
  batch before round upserts run, using `ImportBatch.gameKey` as
  `Game.sourceGameId`.
- When a committed batch has a non-empty `sourceFilename`, import code MAY use
  it to initialize `Game.displayName`, but it MUST NOT overwrite an existing
  non-empty `Game.displayName` chosen earlier.
- `Round.leagueSlug` remains in Milestone 3 only as a compatibility mirror for
  existing import code and previously committed data; new browse queries MUST
  treat `Round.gameId` + `Round.game` as canonical.
- The milestone may keep `ImportBatch.gameKey` unchanged for compatibility, but
  when Milestone 3 code touches import flow it MUST make `ImportBatch.gameKey`
  equal the same canonical value as `Game.sourceGameId`.

#### §4b-2. Seed and import identity expectations

```txt
Seed / import data required for archive browsing:
  - at least 2 Game rows after seeding
  - each displayed Round has:
      - Round.id
      - Round.gameId
      - Round.name
      - deterministic placement inside its game
  - game display label fallback:
      Game.displayName ?? short game identifier
```

**Contract note:** Milestone 3 may continue to render a fallback identifier for
games when no friendly title exists, but missing optional display metadata must
not suppress a game section. `short game identifier` means:

- `Game.sourceGameId` unchanged when it is already short and human-readable
- otherwise `"Game " + Game.sourceGameId.slice(0, 8)` for opaque machine IDs

### 4c. Component Contracts

#### §4c-1. `GameArchivePage`

```ts
interface GameArchivePageProps {
  games: Array<{
    id: number;
    sourceGameId: string;
    displayLabel: string;
    roundCount: number;
    rounds: Array<{
      id: number;
      name: string;
      occurredAt: string | null;
      sequenceNumber: number | null;
      submissionCount: number;
      winnerLabel: string | null;
      statusLabel: "scored" | "pending";
      href: string;
    }>;
  }>;
  openRoundId: number | null;
  notFoundNotice: string | null;
}
```

**Composition note:** `GameArchivePage` owns the archive browse surface only.
The route-layer page composes optional `RoundDetailDialog` and
`RoundScopedEntityModal` siblings around it based on URL state.

**Presentation rules:**

- Each game renders as a distinct section or card group.
- Each round summary stays concise: round name/theme plus at most 3 compact
  contextual signals (`occurredAt`, `winnerLabel`, `submissionCount`, or
  `statusLabel`).
- Round summaries MUST NOT inline the full submission list.

#### §4c-2. `RoundDetailDialog`

```ts
interface RoundDetailDialogProps {
  round: {
    id: number;
    name: string;
    description: string | null;
    occurredAt: string | null;
    playlistUrl: string | null;
    game: {
      id: number;
      displayLabel: string;
    };
    highlights: Array<{
      kind: "winner" | "lowest" | "anomaly";
      label: string;
      value: string;
    }>;
    submissions: Array<{
      id: number;
      song: { id: number; title: string; artistName: string };
      player: { id: number; displayName: string };
      score: number | null;
      rank: number | null;
      comment: string | null;
    }>;
  };
  closeHref: string;
  nestedEntity: null | {
    kind: "song" | "player";
    id: number;
  };
}
```

**Presentation rules:**

- Show parent game context in the header.
- Render 2-3 highlights only.
- Submission rows are vertically scannable and keep song, artist, player, and
  score/rank on one coherent row or compact stack.
- Song and player names are actionable affordances that open nested modal
  shells without dismissing the round dialog.

#### §4c-3. `RoundScopedEntityModal`

```ts
type RoundScopedEntityModalProps =
  | {
      kind: "song";
      data: {
        roundId: number;
        songId: number;
        title: string;
        artistName: string;
        submitterName: string;
        score: number | null;
        rank: number | null;
      };
      closeHref: string;
    }
  | {
      kind: "player";
      data: {
        roundId: number;
        playerId: number;
        displayName: string;
        songTitle: string;
        artistName: string;
        score: number | null;
        rank: number | null;
      };
      closeHref: string;
    };
```

**Presentation rules:**

- The modal shell is subordinate to the open round dialog, not a separate
  page.
- Content is intentionally minimal and current-round scoped in Milestone 3.
- The shell is the compatibility bridge for the fuller Song Modal and Player
  Modal milestones rather than a separate long-term interaction model.
- Close returns to the same round dialog URL state.

### 4d. Internal Boundaries

#### §4d-0. `upsertGameForBatch(batch)`

```js
upsertGameForBatch(input: {
  gameKey: string,
  sourceFilename: string | null
}): Promise<{
  id: number,
  sourceGameId: string,
  displayName: string | null
}>
```

**Contract rules:**

- Upserts exactly one canonical `Game` by `sourceGameId = input.gameKey.trim()`.
- Creates the row before any round upsert that depends on `gameId`.
- On create:
  - `sourceGameId = input.gameKey.trim()`
  - `displayName = input.sourceFilename?.trim() || null`
- On update:
  - preserve existing non-empty `displayName`
  - if existing `displayName` is empty and `sourceFilename` is non-empty, set
    it once
- Returns the canonical `Game` row used for round writes.

#### §4d-1. `listArchiveGames()`

```js
listArchiveGames(): Promise<Array<{
  id: number,
  sourceGameId: string,
  displayLabel: string,
  roundCount: number,
  rounds: Array<{
    id: number,
    name: string,
    occurredAt: string | null,
    sequenceNumber: number | null,
    submissionCount: number,
    winnerLabel: string | null,
    statusLabel: "scored" | "pending"
  }>
}>>
```

**Contract rules:**

- Returns every `Game` with at least one round.
- Game order: newest non-null `Round.occurredAt` within each game DESC, nulls
  last, then `Game.sourceGameId` ASC.
- `displayLabel` uses:
  - `Game.displayName` when non-empty
  - otherwise the short game identifier rule from §4b-2
- Round order inside each game: `sequenceNumber` ASC nulls last, then
  `occurredAt` ASC nulls last, then `Round.id` ASC.
- `winnerLabel` is:
  - player display name when exactly one submission has `rank = 1`
  - `"Tied winners"` when multiple submissions have `rank = 1`
  - `null` when no ranked submissions exist
- `statusLabel` is `"pending"` when every submission for the round has `rank`
  and `score` both null; otherwise `"scored"`.

#### §4d-2. `getRoundDetail(roundId)`

```js
getRoundDetail(roundId: number): Promise<null | {
  id: number,
  name: string,
  description: string | null,
  occurredAt: string | null,
  playlistUrl: string | null,
  game: {
    id: number,
    displayLabel: string
  },
  highlights: Array<{
    kind: "winner" | "lowest" | "anomaly",
    label: string,
    value: string
  }>,
  submissions: Array<{
    id: number,
    song: { id: number, title: string, artistName: string },
    player: { id: number, displayName: string },
    score: number | null,
    rank: number | null,
    comment: string | null
  }>
}>
```

**Contract rules:**

- Returns `null` when `roundId` does not resolve.
- Submission order: `rank` ASC nulls last, then `createdAt` ASC.
- `highlights.length` is between 0 and 3 inclusive.
- Highlight selection order is deterministic:
  1. winner/top-spot highlight when any ranked submission exists
  2. lowest-scoring song highlight when at least 2 scored submissions exist
  3. anomaly highlight from the first applicable rule:
     - tie for first
     - one or more unscored submissions
     - winner margin of 1 point
- When scores are absent, fallback copy must use plain status language such as
  `"Awaiting votes"` rather than synthetic rankings.

#### §4d-3. `getSongRoundModal(roundId, songId)`

```js
getSongRoundModal(roundId: number, songId: number): Promise<null | {
  roundId: number,
  songId: number,
  title: string,
  artistName: string,
  submitterName: string,
  score: number | null,
  rank: number | null
}>
```

**Contract rules:**

- Resolves only the submission for that song within the currently open round.
- Returns `null` if the song is not part of the round.
- MUST NOT query or aggregate cross-round song history in Milestone 3.

#### §4d-4. `getPlayerRoundModal(roundId, playerId)`

```js
getPlayerRoundModal(roundId: number, playerId: number): Promise<null | {
  roundId: number,
  playerId: number,
  displayName: string,
  songTitle: string,
  artistName: string,
  score: number | null,
  rank: number | null
}>
```

**Contract rules:**

- Resolves only the player's submission within the currently open round.
- Returns `null` if the player has no submission in the round.
- MUST NOT query or aggregate cross-round player history or traits in
  Milestone 3.

#### §4d-5. `buildArchiveHref(state)`

```js
buildArchiveHref(input: {
  roundId?: number | null,
  songId?: number | null,
  playerId?: number | null
}): string
```

**Contract rules:**

- Produces canonical archive URLs on `/`.
- If `roundId` is nullish, omit `songId` and `playerId`.
- If both `songId` and `playerId` are provided, prefer `songId`.
- Output ordering is stable: `round`, then `song`, then `player`.

### 4e. Dependencies

| Package | Purpose | Rationale |
|---|---|---|
| `next` | App router, server rendering, URL-state overlays | Smallest clean way to add a real route surface and deep-linkable overlay behavior in this repo |
| `react` | UI rendering | Required by `next` |
| `react-dom` | Browser/server render bindings | Required by `next` |

**Dependency constraints:**

- No CSS framework, component kit, charting library, or modal package is
  authorized in this spec.
- Shared data-loader modules under `src/` should remain plain JavaScript so
  Node-based tests can exercise them without extra tooling.

## 5. Acceptance Criteria

| ID | Condition | Verification |
|---|---|---|
| AC-01 | The archive route renders every seeded/imported game as a first-class group, with rounds nested only inside their parent game and ordered deterministically per §4d-1 | `test` |
| AC-02 | Direct entry to `/?round=<valid-id>` opens the same round detail overlay as an in-app open, and invalid `round` params fall back gracefully to the archive with a non-blocking notice | `manual` |
| AC-03 | Round detail shows round identity, parent game context, 2-3 quick-scan highlights, and the full submission list ordered per §4d-2 | `test` |
| AC-04 | Clicking a song or player inside round detail opens the corresponding nested round-scoped modal shell without closing the round overlay, and closing the shell returns to the same round state | `manual` |
| AC-05 | Missing optional date, winner, score, or rank renders intentional fallback labels and never removes the relevant game, round, or submission from the UI | `test` |
| AC-06 | Prisma schema and migration introduce explicit `Game` identity, backfill existing rows deterministically, and archive loaders query via `Game` / `Round.gameId` rather than `Round.leagueSlug` inference | `test` |
| AC-07 | Seed data includes at least 2 games and enough rounds to exercise both a scored and pending round summary state in the archive surface | `test` |
| AC-08 | Round summaries stay concise: each summary exposes the round name plus no more than 3 compact metadata signals and never inlines the full submission list | `manual` |
| AC-09 | Committing a ready import batch after the Milestone 3 schema change still upserts or reuses exactly one canonical `Game`, writes its rounds against that `Game`, preserves `Round.leagueSlug = Game.sourceGameId`, and retains same-game replay semantics from Milestone 2 | `test` |

## 6. Task Decomposition Hints

1. **[TASK-01] Introduce explicit game identity and migration backfill** — Extend the Prisma schema with `Game`, add `Round.gameId`, preserve the temporary `leagueSlug` mirror constraints, and write the migration/backfill path so archive code can pivot to explicit game identity without breaking existing canonical rows.
   `contracts: §4b-1, §4e` · `preserves: INV-01, INV-06, INV-07` · `validates: AC-06`
2. **[TASK-02] Expand fixtures to a real multi-game archive** — Update `prisma/seed.js` and any affected tests so local development and automated checks have at least two games, multiple rounds per archive, and both scored and pending-round states.
   `contracts: §4b-2, §4d-1` · `preserves: INV-04, INV-06` · `validates: AC-01, AC-05, AC-07`
3. **[TASK-03] Preserve import compatibility through the Game transition** — Update commit-path code and integration tests so committed batches upsert a canonical `Game`, write `Round.gameId`, and keep `Round.leagueSlug` mirrored to `Game.sourceGameId` while preserving Milestone 2 replay behavior.
   `contracts: §4b-1, §4d-0` · `preserves: INV-06, INV-07` · `validates: AC-09`
4. **[TASK-04] Build archive loader utilities and URL-state helpers** — Implement `listArchiveGames()`, `getRoundDetail()`, `getSongRoundModal()`, `getPlayerRoundModal()`, and `buildArchiveHref()` under a shared data/UI utility layer, with Node-based tests covering ordering, fallback labels, highlight count, and scoped modal behavior.
   `contracts: §4d-1, §4d-2, §4d-3, §4d-4, §4d-5` · `preserves: INV-01, INV-03, INV-04, INV-05` · `validates: AC-01, AC-03, AC-05`
5. **[TASK-05] Ship the archive route and round summary browser** — Add the minimal Next.js runtime, root layout, and `/` route wiring, then render game sections, concise round summary cards, and archive-level fallback/error states so the archive structure is immediately understandable and visually tidy on desktop and mobile.
   `contracts: §4a-1, §4c-1, §4d-1, §4d-5, §4e` · `preserves: INV-01, INV-02, INV-03, INV-04` · `validates: AC-01, AC-05, AC-08`
6. **[TASK-06] Implement round detail overlay and highlights** — Add the round dialog, direct-entry handling, header context, deterministic highlight rendering, and full submission list so opening a round feels lightweight but complete.
   `contracts: §4a-1, §4c-2, §4d-2, §4d-5` · `preserves: INV-02, INV-03, INV-04` · `validates: AC-02, AC-03`
7. **[TASK-07] Add round-scoped song/player modal shells and final polish** — Wire nested song/player modal shells, confirm round context preservation, and finish the concise/high-signal interaction polish required by the milestone heuristic.
   `contracts: §4a-1, §4c-3, §4d-3, §4d-4, §4d-5` · `preserves: INV-02, INV-05` · `validates: AC-04`

### Dependency Graph

```txt
TASK-01:
TASK-02: TASK-01
TASK-03: TASK-01
TASK-04: TASK-01,TASK-02,TASK-03
TASK-05: TASK-04
TASK-06: TASK-04,TASK-05
TASK-07: TASK-04,TASK-06
```

## 7. Out of Scope

- [ ] Full player-history modal content, summary traits, or social insights beyond the round-scoped modal shell — Milestone 4. `Disposition: deferred` `Reason: sequencing` `Trace: §7 | BACKLOG.md`
- [ ] Full song-history modal content, recurrence counts, or cross-round lookup utility beyond the round-scoped modal shell — Milestone 5. `Disposition: deferred` `Reason: sequencing` `Trace: §7 | BACKLOG.md`
- [ ] League overview landing page, overview aggregates, or curated insights outside the round/archive flow — Milestone 6
- [ ] Vote-by-vote breakdowns, scoring explainers, or ballot inspection
- [ ] Cross-game filters, faceting, or comparison tools
- [ ] Charts, dashboards, dense analytics panels, or screenshot-unfriendly clutter
- [ ] Replacing every legacy `leagueSlug` reference outside the paths touched for Milestone 3 compatibility

## 8. Open Questions

- **OQ-01:** Round detail surface shape — **Resolution:** `resolved -> §4a-1, §4c-2` (URL-addressable overlay on `/`)
- **OQ-02:** Canonical game identity source for Milestone 3 — **Resolution:** `resolved -> §2, §4b-1` (explicit `Game`, backfilled from legacy `leagueSlug`, with `Game.sourceGameId` aligned to the Milestone 2 first-round-ID-derived `gameKey` per 2026-04-17 HITL clarification)
- **OQ-03:** Round summary density — **Resolution:** `resolved -> §4c-1, §5` (name/theme plus at most 3 compact signals)
- **OQ-04:** Song/player drill-in scope before Milestones 4 and 5 — **Resolution:** `resolved -> §3 INV-05, §4c-3, §4d-3, §4d-4` (round-scoped modal shells now; richer cross-round modal content deferred to later milestones)

---

## Appendix D: Discoveries Log

### D-001 — 2026-04-17T00:00:00Z

- **Trigger:** Meta-orchestrator promotion for `TASK-05` failed three times on
  `node_modules` overlap between `master` and `music-league/M3-task-05`
- **Nature:** `operational`
- **Affected sections:** orchestration hygiene only; no product contract
  sections changed
- **Agent assessment:** The repo ignored `node_modules/`, but `master` also
  tracked a root-level `node_modules` symlink from a prior task commit. That
  stale tracked entry created a low-value merge surface that can block
  promotion even when feature work is correct.
- **Escalation required:** `no` — low-blast-radius repo hygiene fix authorized
  and reversible
- **Resolution:** Remove the tracked root `node_modules` entry from Git on
  `master`, keep the real dependency directory ignored, and redispatch
  `TASK-05` in a fresh epoch

<!-- END SPEC -->
