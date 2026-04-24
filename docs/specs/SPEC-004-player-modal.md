# SPEC: Player Modal Social Detail

> **Version:** 0.1.5-draft
> **Milestone:** 4 - Player Modal
> **Status:** `draft`
> **Author:** final-review 2
> **Depends-on:** `docs/specs/SPEC-001-core-data-model.md`, `docs/specs/SPEC-002-csv-import-pipeline.md`, `docs/specs/SPEC-003-round-page.md`
> **Invalidated-by:** none

---

## 1. Objective

Expand the current round-scoped player shell into a cross-round social detail
view that immediately explains how a player performs in the current game. When
opened from round detail, the modal should surface one data-backed trait line
and concrete notable-pick evidence above the fold, keep the full submission
history available below it, and let the user move into a player-scoped song
view or back to a target round without losing context.

This milestone should feel powerful yet no-fuss: quick to parse, slick to move
through, and grounded in existing rank/score data rather than analytics-heavy
UI or new metadata dependencies.

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| FSD | `docs/specs/FSD-004-player-modal.md` | Accepted product source for trait line, notable picks, player-scoped song push, and history behavior |
| Upstream spec | `docs/specs/SPEC-003-round-page.md` | Defines the current archive route, round detail overlay, and round-scoped song/player shells that M4 must expand without replacing |
| Archive route | `app/page.js` | Current Next.js entrypoint renders only the root archive route `/` and resolves open state through query params |
| Archive URL/data helpers | `src/archive/archive-utils.js` | Owns `buildArchiveHref()`, `getRoundDetail()`, `getSongRoundModal()`, and `getPlayerRoundModal()`; this is the primary M4 expansion seam |
| Archive UI | `src/archive/game-archive-page.js` | Renders the archive, round dialog, nested round-scoped song shell, and current player shell |
| Route-state resolver | `src/archive/game-archive-page.js` | `buildGameArchivePageProps()` and `resolveNestedSelection()` currently decide round/song/player precedence; M4 must extend that seam to depth-1 player song state without introducing a second shell |
| Current styling | `app/globals.css` | Establishes the archive modal shell, nested shell, and mobile layout constraints M4 must preserve while making the player summary above-the-fold |
| Query coverage | `prisma/tests/queries.test.js` | Confirms current player/song shell loaders stay scoped to the open round; M4 must preserve that gating while broadening player history within the current game |
| Route/render coverage | `prisma/tests/archive-page.test.js` | Confirms round dialog, nested shell rendering, and canonical href behavior on the archive route |
| Schema | `prisma/schema.prisma` | Existing `Game`, `Round`, `Submission`, `Song`, `Artist`, and `Player` tables already hold the data M4 needs; no new entity is obviously required |
| Seed fixtures | `prisma/seed.js` | Current fixtures cover scored and pending rounds, but do not yet guarantee all M4 trait/notable edge cases |

Current repo evidence shows that Milestone 3 shipped a single archive route
with game sections and a round-detail overlay, not a standalone game page or a
standalone round page path. M4 therefore extends the existing archive route
state rather than introducing a second modal system or a new primary pathname.

## 3. Invariants

- **INV-01:** The existing modal shell and entry path remain intact. Opening a
  player still begins from archive URL state on `/` with an open `round`
  context, and closing the player modal returns to that origin-round state.
- **INV-02:** For players with at least 1 scored submission in the origin
  round's owning `Game`, the player name, exactly 1 trait line, and notable
  picks must be visible on first open within a standard 375 x 667 mobile
  viewport without scrolling.
- **INV-03:** The trait line is derived only from existing rank/score data in
  the origin round's owning `Game`. If there are 0 scored submissions in that
  scope, the trait line is absent; placeholder copy is invalid.
- **INV-04:** Notable picks are selected only from scored submissions in the
  origin round's owning `Game`, using deterministic ordering and omission
  rules. A player modal must never render the same submission as both best and
  worst.
- **INV-05:** Modal push depth is capped at 1. Player summary/history may push
  into a player-scoped song view, but that song view must not expose further
  modal pushes.
- **INV-06:** The Milestone 3 round-scoped song flow remains valid. `?song=`
  continues to mean the round-scoped song shell unless the archive is in a
  canonical player flow, and M4 must not regress existing round-detail links or
  close behavior.
- **INV-07:** Player modal aggregation is scoped to the origin round's owning
  `Game`, which is the current repo's authoritative league boundary. M4 does
  not silently broaden player history across unrelated games.

## 4. Interface Contracts

### 4a. API Surface

#### §4a-1. Archive route with expanded player modal state

```http
GET /?round=<roundId>&player=<playerId>&playerSubmission=<submissionId>&song=<songId>
```

```txt
Query params:
  round?: integer             // canonical Round.id for the open round overlay
  player?: integer            // canonical Player.id for the expanded player modal
  playerSubmission?: integer  // canonical Submission.id for the player-scoped song view
  song?: integer              // canonical Song.id for the existing round-scoped song shell

Response:
  200 HTML document containing:
    - archive route with game sections
    - optional round detail overlay for ?round=
    - optional round-scoped song shell for ?song=
    - optional expanded player modal for ?player=
    - optional player-scoped song view inside the player modal for ?playerSubmission=

Validation / error handling:
  - invalid integer params are ignored
  - invalid ?round=<id> renders the archive plus the existing non-blocking
    "Round not found." notice
  - ?player=<id> without a valid open round is ignored
  - ?player=<id> must resolve to a player who submitted in the open round;
    otherwise the player modal stays closed
  - ?playerSubmission=<id> without a valid player state is ignored
  - ?playerSubmission=<id> must belong to the active player and to the open
    round's Game; otherwise the player modal falls back to the player summary
  - canonical player-flow URLs MUST NOT emit ?song= alongside ?player= or
    ?playerSubmission=; if both appear, ignore ?song=
```

**Route behavior notes:**

- Direct entry to `/?round=<id>&player=<id>` must render the same player modal
  as an in-app open from round detail.
- Song links inside the player summary/history use
  `buildArchiveHref({ roundId: originRoundId, playerId, playerSubmissionId: submissionId })`.
- Round links inside the player summary/history use
  `buildArchiveHref({ roundId: historyRoundId })`.
- Round links inside the player modal use ordinary archive href navigation; the
  preserved player state lives in the browser history stack rather than a
  parallel client-only store.
- Closing the player summary returns to
  `buildArchiveHref({ roundId: originRoundId })`.
- Backing out of the player-scoped song view returns to
  `buildArchiveHref({ roundId: originRoundId, playerId })`.

### 4b. Data Schema (migrations)

#### §4b-1. No Prisma migration for Milestone 4

```txt
No schema changes are required for M4. The player modal derives from existing:
  Player(id, displayName)
  Game(id, sourceGameId, displayName)
  Round(id, gameId, name, occurredAt, sequenceNumber)
  Submission(id, roundId, playerId, songId, score, rank, comment, createdAt)
  Song(id, title)
  Artist(name)
```

**Compatibility rule:** M4 may add query helpers, projections, and derived
metrics, but it must not introduce a new persistence layer or precomputed trait
table without a later explicit spec update.

#### §4b-2. Fixture expectations for player-modal coverage

```txt
Seed / integration data required for M4:
  - at least 1 player with 0 scored submissions but at least 1 submission in a Game
  - at least 1 player with exactly 1 scored submission
  - at least 1 player with multiple scored submissions and enough spread to
    exercise the top-finish, win-rate, variance, and low-finish trait branches
  - at least 1 notable-pick tiebreak case where rank alone is insufficient
```

### 4c. Component Contracts

#### §4c-1. `ArchivePlayerModal`

```ts
interface PlayerHistoryRow {
  submissionId: number;
  roundId: number;
  roundName: string;
  occurredAt: string | null;
  song: {
    id: number;
    title: string;
    artistName: string;
  };
  score: number | null;
  rank: number | null;
  comment: string | null;
}

interface ArchivePlayerModalProps {
  originRoundId: number;
  player: {
    id: number;
    displayName: string;
    traitLine: string | null;
    traitKind: null | "top-finish" | "win-rate" | "variance" | "low-finish";
    notablePicks: {
      best: PlayerHistoryRow | null;
      worst: PlayerHistoryRow | null;
    };
    history: PlayerHistoryRow[];
  };
  activeSubmissionId: number | null;
  activeSubmission: null | {
    submissionId: number;
    roundId: number;
    roundName: string;
    title: string;
    artistName: string;
    rank: number | null;
    score: number | null;
    comment: string | null;
  };
  closeHref: string;
  backToPlayerHref: string | null;
}
```

**Presentation rules:**

- Summary mode renders player name first, then the trait line if present, then
  the notable-picks block if at least 1 pick exists, then the full history
  list.
- `player.history` includes both scored and unscored submissions in origin-game
  reverse-chronological order; trait derivation and notable-pick selection use
  only the scored subset.
- For players with at least 1 scored submission, the summary header, trait
  line, and notable-picks block must fit above the fold on a 375 x 667 mobile
  viewport; the history area may extend below the fold or scroll within the
  shell.
- The above-fold summary stays compact: 1 sentence of trait copy plus at most
  2 notable-pick cards, with no raw-metric legends, percentages, or secondary
  explainer copy competing with the song evidence.
- When a notable pick exists, it renders as a compact labeled card:
  `Best Pick` or `Worst Pick`, each showing song title, artist, round name,
  rank-first result copy, and secondary score copy.
- Best and worst notable cards must be visually distinct from each other and
  from the history rows beneath them through label plus container treatment;
  the history list remains visually subordinate on first open.
- Zero-scored players omit the trait-line block and notable-picks block
  entirely; no placeholder card or copy-heavy empty state is allowed.
- Every history row shows song title, artist, round name, rank label, and score
  label. Song title and round name are actionable; the player name is not
  repeated as a link inside the modal body.

#### §4c-2. `PlayerModalSongView`

```ts
interface PlayerModalSongViewProps {
  playerName: string;
  submission: {
    submissionId: number;
    roundId: number;
    roundName: string;
    title: string;
    artistName: string;
    rank: number | null;
    score: number | null;
    comment: string | null;
  };
  backHref: string;
}
```

**Presentation rules:**

- The player-scoped song view reuses the same player-modal shell and replaces
  only the inner content/body.
- The back affordance must clearly return to the player summary and identify
  the player in visible copy or accessible labeling.
- The view shows title, artist, round name, rank, score, and comment when a
  comment exists.
- The round name in this view is plain text, not a link, so the push depth
  remains capped at 1.
- The view must not expose any further modal push affordances for song or
  player entities.

### 4d. Internal Boundaries

#### §4d-1. `getPlayerRoundModal(originRoundId, playerId)`

```ts
getPlayerRoundModal(originRoundId: number, playerId: number): Promise<null | {
  originRoundId: number;
  originGameId: number;
  playerId: number;
  displayName: string;
  traitLine: string | null;
  traitKind: null | "top-finish" | "win-rate" | "variance" | "low-finish";
  notablePicks: {
    best: PlayerHistoryRow | null;
    worst: PlayerHistoryRow | null;
  };
  history: PlayerHistoryRow[];
}>
```

**Loader rules:**

- Return `null` when the origin round does not exist or the player does not
  have a submission in that origin round.
- Scope all history rows to `Submission.playerId = playerId` and
  `Submission.round.gameId = originRound.gameId`.
- Include every scoped submission in `history`, even when `score` and `rank`
  are `null`.
- Order history by `Round.occurredAt DESC NULLS LAST`, then
  `Round.sequenceNumber DESC NULLS LAST`, then `Submission.createdAt DESC`,
  then `Submission.id DESC`.
- Derive `traitLine` and `traitKind` from the scored subset only, using player
  metrics plus game-level peer baselines computed from every player with at
  least 1 scored submission in the same `Game`.
- Return `traitLine = null`, `traitKind = null`, and both notable picks as
  `null` when the scoped history has 0 scored submissions.

#### §4d-2. `getPlayerModalSubmission(originRoundId, playerId, submissionId)`

```ts
getPlayerModalSubmission(
  originRoundId: number,
  playerId: number,
  submissionId: number,
): Promise<null | {
  originRoundId: number;
  playerId: number;
  submissionId: number;
  playerName: string;
  roundId: number;
  roundName: string;
  title: string;
  artistName: string;
  rank: number | null;
  score: number | null;
  comment: string | null;
}>
```

**Loader rules:**

- Return `null` when the origin round or player state is invalid.
- Return `null` when the target submission does not belong to the active player.
- Return `null` when the target submission belongs to a different `Game` than
  the origin round.
- The result is player-scoped only; it does not include cross-player song
  history or recurrence context.

#### §4d-3. `derivePlayerTrait(input)`

```ts
derivePlayerTrait(input: {
  playerMetrics: {
    scoredCount: number;
    wins: number;
    averageFinishPercentile: number;
    scoreStdDev: number;
    winRate: number;
  };
  gameBaselines: {
    playerCount: number;
    averageFinishPercentile: number;
    scoreStdDev: number;
    winRate: number;
  };
}): null | {
  kind: "top-finish" | "win-rate" | "variance" | "low-finish";
  line: string;
}
```

**Branch inventory:**

- `top-finish` -> `"Consistently near the top - plays it safe, plays it well."`
- `win-rate` -> `"Wins more rounds than anyone likes to admit."`
- `variance` -> `"Could be first, could be last. You never know."`
- `low-finish` -> `"Bravely marches to their own drummer."`

**Derivation rules:**

- Use only scored submissions from the origin round's owning `Game`.
- Use only rank/score-derived metrics; genre, mood, duration, Spotify metadata,
  or free-text comments must not influence the branch choice.
- Compute `averageFinishPercentile` from each scored submission as
  `(rank - 1) / max(scoredRoundSize - 1, 1)` so `0` means best-in-round and `1`
  means worst-in-round.
- The denominator for `averageFinishPercentile`, `winRate`, and branch
  eligibility is scored submissions. Multi-submit rounds count once per scored
  submission for these submission-based metrics.
- If a downstream overview insight needs a submitted-round denominator, it must
  compute and name a distinct submitted-round count rather than reusing scored
  submission count.
- Compute `scoreStdDev` from scored submission `score` values; treat fewer than
  2 scored submissions as `0`.
- `scoreStdDev` is raw descriptive variance only. It must not be used to infer
  vote-budget size, deadline penalties, low-stakes behavior, or downvote
  availability because those source settings are not imported in the current
  CSV contract.
- Compute candidate dominance deltas as:
  - `top-finish = gameBaselines.averageFinishPercentile - playerMetrics.averageFinishPercentile`
  - `low-finish = playerMetrics.averageFinishPercentile - gameBaselines.averageFinishPercentile`
  - `win-rate = playerMetrics.winRate - gameBaselines.winRate`
  - `variance = playerMetrics.scoreStdDev - gameBaselines.scoreStdDev`
- `win-rate` is eligible only when `playerMetrics.wins >= 2`.
- `variance` is eligible only when `playerMetrics.scoredCount >= 2`.
- When at least 1 eligible candidate has a positive dominance delta, choose the
  branch with the largest positive delta.
- Positive-delta ties resolve in this order:
  `win-rate`, `variance`, `top-finish`, `low-finish`.
- When no eligible positive-delta candidate exists, choose `top-finish` when
  `playerMetrics.averageFinishPercentile <= gameBaselines.averageFinishPercentile`;
  otherwise choose `low-finish`.
- Return exactly 1 branch for any player with at least 1 scored submission, and
  return `null` for 0 scored submissions.
- The branch selection must compare the player's metrics against the current
  game's player distribution rather than raw app-wide totals.
- The M4 modal may render a one-scored-submission trait, but overview claims
  that reuse this derivation must expose the scored-submission denominator and
  avoid durable-tendency wording for small samples.

#### §4d-4. `selectPlayerNotablePicks(scoredHistory)`

```ts
selectPlayerNotablePicks(scoredHistory: PlayerHistoryRow[]): {
  best: PlayerHistoryRow | null;
  worst: PlayerHistoryRow | null;
}
```

**Selection rules:**

- `best` sorts by `rank ASC`, then `score DESC`, then `occurredAt DESC NULLS LAST`,
  then `submissionId DESC`.
- `worst` sorts by `rank DESC`, then `score ASC`, then `occurredAt DESC NULLS LAST`,
  then `submissionId DESC`.
- Multi-submit rounds are evaluated per scored submission; distinct
  submitted-round counts are separate overview context and do not collapse
  notable-pick evidence.
- When there is exactly 1 scored submission, return it as `best` and return
  `worst = null`.
- When the sorted `worst` candidate equals `best`, advance to the next distinct
  scored submission. If none exists, return `worst = null`.

#### §4d-5. `buildArchiveHref(input)`

```ts
buildArchiveHref(input: {
  roundId?: number | null;
  songId?: number | null;
  playerId?: number | null;
  playerSubmissionId?: number | null;
}): string
```

**Href rules:**

- No valid `roundId` returns `/`.
- `songId` is emitted only when there is no active player flow.
- `playerSubmissionId` is emitted only when `playerId` is also valid.
- Canonical player-flow hrefs use `round -> player -> playerSubmission` ordering.

#### §4d-6. `resolveNestedSelection(searchParams, roundSelection, input)`

```ts
resolveNestedSelection(
  searchParams: Record<string, string | string[] | undefined>,
  roundSelection: {
    openRoundId: number | null;
    openRound: null | { id: number };
    notFoundNotice: string | null;
  },
  input?: {
    prisma?: {
      $disconnect(): Promise<void>;
    };
  },
): Promise<{
  nestedEntity: null | { kind: "song" | "player"; id: number };
  openSongModal: Awaited<ReturnType<typeof getSongRoundModal>> | null;
  openPlayerModal: null | {
    originRoundId: number;
    originGameId: number;
    playerId: number;
    displayName: string;
    traitLine: string | null;
    traitKind: null | "top-finish" | "win-rate" | "variance" | "low-finish";
    notablePicks: {
      best: PlayerHistoryRow | null;
      worst: PlayerHistoryRow | null;
    };
    history: PlayerHistoryRow[];
    activeSubmissionId: number | null;
    activeSubmission: Awaited<ReturnType<typeof getPlayerModalSubmission>> | null;
  };
}>
```

**Resolution rules:**

- If `roundSelection.openRound` is `null`, return `nestedEntity = null`,
  `openSongModal = null`, and `openPlayerModal = null`.
- Parse `player` before honoring round-scoped `song` so canonical player-flow
  URLs keep control of the modal body.
- Ignore `playerSubmission` unless `player` resolves to a valid `openPlayerModal`.
- A valid `playerSubmission` enriches `openPlayerModal` with
  `activeSubmissionId` and `activeSubmission`; it does not create a second
  nested modal layer or change `nestedEntity.kind` away from `"player"`.
- If `player` resolves but `playerSubmission` does not, keep the player summary
  open with `activeSubmissionId = null` and `activeSubmission = null`.
- Round-scoped `song` resolution is allowed only when no valid player flow is
  active; this preserves Milestone 3 `?song=` behavior while preventing player
  flow from silently falling into the wrong shell.

### 4e. Dependencies

| Package | Purpose | Rationale |
|---|---|---|
| None | Use existing `next`, `react`, `react-dom`, `prisma`, and `@prisma/client` only | Current repo dependencies already cover the route, rendering, and query work needed for M4 |

## 5. Acceptance Criteria

| ID | Condition | Verification |
|---|---|---|
| AC-01 | Direct entry to `/?round=<valid-id>&player=<valid-id>` opens the expanded player modal on top of the existing round overlay and renders cross-round history for that player's current `Game` | `manual` |
| AC-02 | A player with at least 1 scored submission opens to a view where the player name, 1 trait line, and notable picks are visible without scrolling on a 375 x 667 viewport; the above-fold summary stays compact, labels/distinguishes Best Pick vs Worst Pick from each other and from history, and a player with 0 scored submissions renders no trait/notable placeholders | `manual` |
| AC-03 | Trait selection follows the deterministic dominance rules in `§4d-3`, returns exactly 1 trait for any player with at least 1 scored submission, and returns `null` for 0 scored submissions | `test` |
| AC-04 | Best/worst notable picks follow the deterministic ordering in `§4d-4`, show only best when exactly 1 scored submission exists, and omit the entire notable-picks block when 0 scored submissions exist | `test` |
| AC-05 | Clicking a song title from the trait evidence or history replaces the player modal body with the player-scoped song view, and the back affordance returns to the player summary without dismissing the underlying round overlay | `manual` |
| AC-06 | The player-scoped song view shows only this player's submission details and exposes no further modal push links | `test` |
| AC-07 | Clicking a round name from the player summary/history navigates to the archive route with that round open, and browser back returns to the previous player modal URL state | `manual` |
| AC-08 | Existing Milestone 3 `/?round=<id>&song=<id>` behavior remains intact outside player flow, including close URLs and round context preservation | `test` |
| AC-09 | Seed/integration coverage includes zero-scored, single-scored, multi-scored, each trait branch, and notable-pick tiebreak cases needed to exercise the M4 player modal contracts | `test` |
| AC-10 | Query precedence and fallback follow `§4a-1` and `§4d-6`: canonical player-flow URLs ignore `?song=`, and an invalid or cross-game `playerSubmission` falls back to the player summary without closing the round overlay | `test` |

## 6. Task Decomposition Hints

1. **[TASK-01] Expand player modal loaders and derivations** - Replace the round-scoped `getPlayerRoundModal()` payload with origin-game history, trait derivation inputs, and notable-pick selection while preserving origin-round gating.
   `contracts: §4d-1, §4d-2, §4d-3, §4d-4` · `preserves: INV-01, INV-03, INV-04, INV-07` · `validates: AC-03, AC-04, AC-06`
2. **[TASK-02] Extend archive URL-state helpers for player depth-1 flow** - Teach `buildArchiveHref()` and `resolveNestedSelection()` about `playerSubmission`, canonical precedence, and round-navigation handoff without regressing the existing round-scoped song shell.
   `contracts: §4a-1, §4d-5, §4d-6` · `preserves: INV-01, INV-05, INV-06` · `validates: AC-01, AC-05, AC-07, AC-08, AC-10`
3. **[TASK-03] Rebuild the player modal shell for summary and song subviews** - Render the above-fold player summary, notable picks, scrollable history, and player-scoped song body inside the existing archive modal chrome across desktop and mobile layouts.
   `contracts: §4c-1, §4c-2, §4d-1, §4d-2, §4d-6` · `preserves: INV-02, INV-05` · `validates: AC-01, AC-02, AC-05, AC-06`
4. **[TASK-04] Expand fixtures and regressions for M4 behavior** - Update seeds and automated checks so the repo exercises trait/notable edge cases and proves that Milestone 3 song-shell behavior still works outside the new player flow.
   `contracts: §4b-2, §4d-3, §4d-4, §4d-5, §4d-6` · `preserves: INV-03, INV-04, INV-06` · `validates: AC-03, AC-04, AC-08, AC-09, AC-10`

### Dependency Graph

```txt
TASK-01:
TASK-02: TASK-01
TASK-03: TASK-01,TASK-02
TASK-04: TASK-01,TASK-02,TASK-03
```

## 7. Out of Scope

- [ ] Metadata-backed taste signals such as genre, duration, mood, or audio
  features - post-0.1.0 metadata milestone
- [ ] Multiple simultaneous trait lines or stacked personality blurbs
- [ ] Cross-game player history outside the origin round's owning `Game`
- [ ] Nested modals or a second shell layered on top of the player modal
- [ ] Cross-player song history, recurrence counts, or the broader Song Modal
  lookup experience inside the player-scoped song view - Milestone 5.
  `Disposition: deferred` `Reason: sequencing` `Trace: §7 | BACKLOG.md`
- [ ] Charts, graphs, or score timeline visualizations
- [ ] Player-to-player comparison, filtering, or editable profiles
- [ ] Illustrated or copy-heavy empty-state treatments for zero-submission or
  zero-scored players

## 8. Open Questions

- **OQ-01:** What is the canonical navigation target when the FSD says "round page"? - **Resolution:** `resolved -> §2, §4a-1` (current repo reality is the archive route `/` with the target round open in URL state; no standalone game or round path is required for M4)
- **OQ-02:** What exact dominance formula should choose among the 4 trait branches when multiple signals are competitive? - **Resolution:** `resolved -> §4d-3, §5` (largest positive game-relative dominance delta wins, with `win-rate -> variance -> top-finish -> low-finish` tie-break order and a finish-based fallback when no positive delta exists)
- **OQ-03:** Should player history scope across the whole archive or the origin round's owning `Game`? - **Resolution:** `resolved -> §3 INV-07, §4d-1` (origin `Game` only, matching the current repo's authoritative league boundary and the history row contract)

---

## Appendix D: Discoveries Log

No discoveries recorded yet.

<!-- END SPEC -->
