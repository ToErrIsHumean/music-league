# SPEC: UX Rework - Multi-Route Archive Companion

> **Version:** 0.1.14-draft
> **Milestone:** 8 - UX Rework
> **Status:** `draft`
> **Author:** final-review 1
> **Depends-on:** `SPEC-001-core-data-model.md`, `SPEC-002-csv-import-pipeline.md`, `SPEC-006-league-overview-memory-board.md`, `SPEC-007-batch-zip-import.md`
> **Invalidated-by:** `FSD-008-ux-rework.md`, `docs/reference/DESIGN.md`, `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md`, schema changes to `Game`, `Round`, `Submission`, `Vote`, `Song`, `Artist`, or `Player`

---

## 1. Objective

Milestone 8 rebuilds the archive from a single-route, overlay-driven memory board into a multi-route archive companion with stable URLs for games, rounds, songs, and players. Users must be able to see current and completed games immediately, reach any round or submission through fixed lists, search songs and artists from any route, and inspect song/player memory without nested dialogs.

The resulting experience must read as a Music League companion: leaderboards and ties are legible, comments remain first-class social evidence, familiarity signals stay consistent, and the visual system moves from the alpha's warm editorial palette to shared Music League-adjacent purple and gold tokens.

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| Next root route | `app/page.js` | The only current UI route; renders the archive page from `src/archive/game-archive-page.js` and consumes query params for game/round/song/player state. |
| Root layout metadata | `app/layout.js` | Global HTML shell has no persistent header, no skip link, and only static archive metadata. |
| Alpha archive page | `src/archive/game-archive-page.js` | Renders hero, game switcher, memory board, round dialog, song modal, player modal, and nested modal state from one page. |
| Archive query/derivation utilities | `src/archive/archive-utils.js` | Contains existing Prisma reads, memory board wiring, round detail data, song memory modal data, player modal data, standings helpers, route href builders, and alpha overlay query logic. |
| Song memory utilities | `src/archive/song-memory.js` | Existing song familiarity derivation distinguishes `debut`, `known-artist`, and `brought-back`; M8 requires an archive-wide first-time/returning verdict for F7/F8 while preserving optional artist-footprint context. |
| Player metrics utilities | `src/archive/player-metrics.js` | Existing score/rank-derived player metrics can inform player aggregates and traits, but M8 requires a named trait registry with explicit thresholds before display. |
| API route surface | `app/` | The current app has no archive API routes; live header suggestions require one bounded read-only JSON boundary rather than page-local catalog preloading. |
| Global stylesheet | `app/globals.css` | Contains alpha warm paper/brick palette and route-specific classes; M8 requires shared purple/gold tokens consumed by all routes. |
| Prisma schema | `prisma/schema.prisma` | Confirms no schema changes are required, `Game.finished` exists, `Round.playlistUrl` exists, event dates exist on rounds/submissions/votes, and no album field exists on `Song`. |
| Tests | `src/archive/*.test.js`, `prisma/tests/archive-page.test.js` | Existing coverage targets alpha utilities and archive page behavior; M8 needs new route, derivation, query-param, and accessibility-oriented tests. |

Checkpoint note: final-review 1 corrected the `/songs` browser interaction contract so it preserves the binding live-search behavior from `DESIGN.md §8a` while keeping `q` as canonical shareable URL state. Drift check: corrected-unauthorized-drift.
Drift issue: the saved draft specified `/songs` URL-backed search and prepopulation but omitted the debounced live result update required by the FSD's binding design source.

## 3. Invariants

- **INV-01:** Round, song, and player drill-ins are real routes. No route may reintroduce `?round=`, `?song=`, `?player=`, or `?playerSubmission=` as URL-addressable overlays.
- **INV-02:** No primary surface stacks modal dialogs. Per-submission vote disclosure on the round page is the only permitted in-place disclosure pattern.
- **INV-03:** `Game.finished` is the sole source for current versus completed game status.
- **INV-04:** Displayed game timeframes are derived from imported event timestamps only: `Round.occurredAt`, with `Submission.submittedAt` and `Vote.votedAt` as widening fallbacks. ORM/import bookkeeping timestamps are never displayed as game timeframes.
- **INV-05:** Leaderboard ties remain ties. Tied rows render the same rank with a `T<rank>` pill and never collapse into sole-leader copy.
- **INV-06:** Computed values appearing on multiple surfaces have one derivation path per concept: game timeframe, leaderboard ranks/ties, song familiarity verdict, search normalization, and player traits.
- **INV-07:** Every displayed player trait comes from a named registry entry with an explicit numeric threshold. Ad-hoc trait inference is prohibited.
- **INV-08:** Shared visual tokens own the M8 palette. Route components must not hardcode palette values that belong to the token set.
- **INV-09:** `Round.playlistUrl` is outbound-link-only. The product does not embed Spotify, fetch Spotify metadata, render Spotify artwork, or call Spotify APIs.
- **INV-10:** The archive remains a single-tenant, read-only browsing surface. No live submission, voting, playlist management, authentication, or account state is introduced.
- **INV-11:** Source game semantics remain intact: rounds stay scoped to games; submissions are player-song-in-round evidence; votes are score inputs; comments are social evidence, not scoring primitives.
- **INV-12:** Dynamic route IDs must be ownership-checked before rendering detail content. A round must not render under the wrong game context, and song/player pages must not fabricate game context from stale navigation state.
- **INV-13:** Alpha URL-overlay routing code is removed rather than left dormant. Retired params may be parsed only by no-op compatibility guards or tests proving they do not affect rendered content.
- **INV-14:** User-visible appearance chronology uses imported event timestamps and stable IDs, not ORM/import bookkeeping timestamps. Song first/most-recent appearance, song history ordering, and player/song provenance rows use `Submission.submittedAt`, `Round.occurredAt`, and stable IDs as their chronology inputs unless a section explicitly names another source.
- **INV-15:** Header client interactivity is ephemeral and read-only. Search suggestion open state, switcher open state, back-to-game context, and vote disclosure state must not persist to `localStorage`, cookies, database state, server module globals, or URL params except for canonical `/songs` query/filter/sort navigation.
- **INV-16:** Browser-derived back-to-game context only honors same-origin archive routes generated from the route builders. External referrers, malformed paths, or unsupported local paths produce no chip rather than a best-effort link.
- **INV-17:** Player trait UI never renders placeholder, generic, or unregistered trait copy. Since OQ-01 is resolved for v1, `TASK-11` must implement the enabled registry entries named in §4d-7 rather than a zero-trait scaffold.
- **INV-18:** Vote-to-submission attribution resolves from the immutable import-backed key `Vote.roundId + Vote.songId`, then groups downstream display and aggregation by the resolved `submissionId`. Song-only attribution is prohibited because recurring songs across rounds or games are distinct submission evidence.
- **INV-19:** Game round ordering is canonical and route-stable. Game round lists and round-derived navigation order by populated `Round.sequenceNumber` ascending, then populated `Round.occurredAt` ascending, then stable `Round.id`; ORM/import bookkeeping timestamps must not decide user-visible round order.
- **INV-20:** Registry IDs and badge variants are stable implementation identifiers, not display copy. They use lower-kebab ASCII slugs, never include player names or other mutable labels, and are mapped to user-facing text through §4d-7 or §4d-18.

## 4. Interface Contracts

### 4a. Route Surface

#### §4a-1. Landing route

```
GET /
Query:
  year?: string
  winner?: string
  retired overlay params are accepted but ignored.
Response: landing page with persistent header, current game band, completed game grid, and empty-archive state when no games exist.

Errors:
  Empty archive: render status copy and header; search produces no results until songs exist.
  Invalid year: ignore the year filter and preserve the completed-games base view.
  Empty winner: normalize to no winner filter.
  Retired params: render the base landing route normally; do not open overlays or return 404.
```

#### §4a-2. Game route

```
GET /games/[gameId]
Response: game page with header, status badge, event-derived timeframe, leaderboard, fixed round list, memory board, and competitive anchor.

Errors:
  Invalid gameId: render status notice with link to /.
  Game with no round evidence: render status notice rather than memory-board filler.
  Game with no scored rounds: suppress leaderboard table and render pending-scoring copy.
```

#### §4a-3. Round route

```
GET /games/[gameId]/rounds/[roundId]
Response: round page with parent game context, playlist pill when present, optional highlights, full ranked submissions, inline vote disclosures, and Expand all votes control.

Errors:
  Invalid gameId: render status notice with link to /.
  Invalid roundId: render status notice with link to /games/[gameId] when the game exists, else /.
  Round outside gameId: render status notice with link to the owning game route if resolvable.
```

#### §4a-4. Song browser route

```
GET /songs
Query:
  q?: string
  familiarity?: "all" | "first-time" | "returning"
  sort?: "most-appearances" | "most-recent" | "best-finish" | "alphabetical"
Response: searchable song/artist browser with URL-backed filter and sort state.

Errors:
  Invalid familiarity: normalize to "all" and preserve a status notice only if the invalid value changes visible results.
  Invalid sort: normalize to "most-recent".
  Empty archive: render import-needed copy.
  Zero results: render explicit zero-state and clear-filters link.
```

#### §4a-5. Song detail route

```
GET /songs/[songId]
Response: canonical song detail with title, artist, familiarity verdict, summary facts, origin labels, optional recall comment, and submission history grouped by game.

Errors:
  Invalid songId: render status notice with link to /songs.
  Song without submission evidence: render status notice with link to /songs; do not synthesize provenance.
```

#### §4a-6. Player detail route

```
GET /players/[playerId]
Query:
  voteGameId?: positive integer
Response: player detail with aggregate context, threshold-gated trait line, notable picks, submission history, votes-given table, and votes-received table.

Errors:
  Invalid playerId: render status notice with link to /.
  Player without submissions or votes: render player header with sparse-state copy rather than fabricated aggregates.
  Invalid voteGameId or a voteGameId where the player has no vote/submission evidence: normalize to archive-wide voting history.
```

#### §4a-7. Retired overlay params

```
Applies to every valid route:
  ?round=
  ?song=
  ?player=
  ?playerSubmission=

Behavior:
  Params are silently ignored and must not alter rendered content, open dialogs, or produce an error.
```

#### §4a-8. Header search suggestions API

```
GET /api/archive/search-suggestions?q=<string>
Response: {
  data: {
    suggestions: Array<
      | { type: "song"; songId: number; title: string; artistName: string; href: string }
      | { type: "artist"; artistName: string; href: string }
    >
  },
  error: null
}

Errors:
  400: { data: null, error: "validation: q exceeds 200 characters" }
  405: { data: null, error: "method not allowed" }
```

Whitespace-only or omitted `q` returns an empty suggestions array with `200`. The endpoint is read-only, returns at most eight suggestions, uses the same normalization as `/songs`, and exposes no album, player, Spotify, authentication, or mutating behavior.

### 4b. Data Schema (migrations)

#### §4b-1. Schema changes

```sql
-- Migration: none
-- Direction: not applicable
-- Rollback: not applicable
```

M8 reads existing `Game.finished`, `Round.playlistUrl`, `Round.occurredAt`, `Submission.submittedAt`, `Vote.votedAt`, `Submission.score`, `Submission.rank`, `Submission.comment`, and `Vote.comment`. It must not add album, Spotify enrichment, account, or live-gameplay fields.

### 4c. Component Contracts

#### §4c-1. App shell and persistent header

```ts
interface ArchiveShellProps {
  activeRoute: "landing" | "game" | "round" | "songs" | "song" | "player";
  gameContext: null | { gameId: number; displayName: string; href: string };
  search: HeaderSearchModel;
  switcher: GameSwitcherModel;
  children: React.ReactNode;
}

interface HeaderSearchModel {
  value: string;
  submitHrefBase: "/songs";
  suggestions: Array<
    | { type: "song"; songId: number; title: string; artistName: string; href: string }
    | { type: "artist"; artistName: string; href: string }
  >;
}

interface GameSwitcherModel {
  currentGames: Array<GameSwitcherItem>;
  completedGames: Array<GameSwitcherItem>;
  selectedGameId: number | null;
  backToGame: null | { label: string; href: string };
}

interface GameSwitcherItem {
  gameId: number;
  displayName: string;
  status: "Current" | "Completed";
  timeframeLabel: string | null;
  href: string;
}
```

The header includes a skip-to-content link, brand link, global search, songs link, compact game switcher, and contextual back-to-game chip. The switcher trigger is a button with `aria-expanded` and a stable controlled-region relationship. The switcher open state renders currently-playing games as chips above a scrollable completed-games list, with a single roving keyboard order: current-game chips first, then completed games. Back-to-game chips are omitted unless the target is a same-origin archive route accepted by §4d-8. Below `720px`, search collapses behind a text-labeled `Search` trigger while remaining keyboard accessible.

The search input submits to `/songs?q=<normalized query>`. Live suggestions are fetched from §4a-8 after client-side debouncing; page loaders may provide an initial empty suggestions model but must not preload the full song catalog into the header.

The shell also renders the minimal footer named by `DESIGN.md`; route components do not define their own persistent landmarks.

#### §4c-2. Landing page

```ts
interface LandingPageProps {
  currentGames: GameCardModel[];
  completedGames: GameCardModel[];
  completedTotal: number;
  completedVisibleCount: number;
  filters: { year: string | null; winner: string | null };
}

interface GameCardModel {
  gameId: number;
  displayName: string;
  status: "Current" | "Completed";
  timeframeLabel: string | null;
  roundCount: number;
  scoredRoundCount: number;
  winnerLabel: string | null;
  href: string;
}
```

Completed games render up to 100 initially. When the completed corpus exceeds 100, `Show more` reveals batches of 50. Year and winner-substring filters are exposed once the completed corpus exceeds 30.

Completed games sort by derived timeframe end descending. Games with no derivable event timeframe fall back to stable import/source order for sorting only; no fallback date is displayed. `year` and `winner` filters are URL-backed query state and apply only to the completed-games grid.

#### §4c-3. Game page

```ts
interface GamePageProps {
  game: {
    id: number;
    displayName: string;
    description: string | null;
    status: "Current" | "Completed";
    timeframeLabel: string | null;
    roundCount: number;
    scoredRoundCount: number;
  };
  leaderboard: LeaderboardModel;
  rounds: GameRoundListItem[];
  memoryBoard: MemoryBoardModel;
  competitiveAnchor: CompetitiveAnchorModel;
}

interface GameRoundListItem {
  roundId: number;
  gameId: number;
  sequenceLabel: string;
  name: string;
  occurredAtLabel: string | null;
  submissionCount: number;
  scoringStatus: "scored" | "unscored" | "partial";
  winnerLabel: string | null;
  href: string;
  playlistUrl: string | null;
}

interface LeaderboardRow {
  playerId: number;
  displayName: string;
  rankLabel: string;
  isTiedRank: boolean;
  totalPoints: number;
  roundWins: number;
  roundsPlayed: number;
  href: string;
}

interface CompetitiveAnchorModel {
  headline: string;
  leaders: Array<{ playerId: number; displayName: string; totalPoints: number; href: string }>;
  closestRace: null | { label: string; pointGap: number };
  roundsWonLeader: null | { playerId: number; displayName: string; roundWins: number; href: string };
}
```

The leaderboard appears above the fold for games with scored evidence. The round list is always structural and does not depend on memory board content.
Round list items are ordered by §4d-17.

Competitive anchor headline copy follows the design contract:

- 1 leader: `Leader: <name> with <points> points`
- 2 tied: `Tied leaders: <name> & <name> at <points> points`
- 3+ tied: `<N>-way tie at <points> points: <name>, <name>, <name>`

#### §4c-4. Round page and vote disclosure

```ts
interface RoundPageProps {
  round: {
    id: number;
    gameId: number;
    gameDisplayName: string;
    name: string;
    description: string | null;
    sequenceNumber: number | null;
    occurredAtLabel: string | null;
    playlistUrl: string | null;
  };
  highlights: RoundHighlight[];
  submissions: RoundSubmissionRow[];
}

interface RoundSubmissionRow {
  submissionId: number;
  rankLabel: string;
  scoreLabel: string;
  song: { id: number; title: string; artistName: string; href: string };
  submitter: { id: number; displayName: string; href: string };
  familiarity: SongFamiliarityVerdict;
  submissionComment: string | null;
  votes: VoteDisclosureRow[];
}

interface VoteDisclosureRow {
  voteId: number;
  voter: { id: number; displayName: string; href: string };
  pointsAssigned: number;
  votedAtLabel: string | null;
  comment: string | null;
}
```

Each vote disclosure is a `button[aria-expanded]`; rows with no imported votes render non-interactive `No imported votes` text. `Expand all votes` toggles all rows together.

Submissions are ordered by rank ascending, then `submittedAt` ascending, then stable submission ID. Missing rank renders after ranked submissions without suppressing the row.

Round highlights are capped at three, sourced from existing M6-compatible derivations where evidence exists, and suppressed rather than padded when no highlight qualifies.

#### §4c-5. Song browser and song detail

```ts
interface SongBrowserProps {
  query: string;
  familiarity: "all" | "first-time" | "returning";
  sort: "most-appearances" | "most-recent" | "best-finish" | "alphabetical";
  rows: SongBrowserRow[];
  totalMatches: number;
  totalCatalogSize: number;
  capped: boolean;
}

interface SongBrowserRow {
  songId: number;
  title: string;
  artistName: string;
  artistSearchHref: string;
  appearanceCount: number;
  mostRecentAppearance: null | { gameName: string; roundName: string; href: string };
  bestFinish: null | { rank: number; score: number | null };
  familiarity: SongFamiliarityVerdict;
  href: string;
}

interface SongDetailProps {
  song: SongBrowserRow;
  summaryFacts: Array<{ label: string; value: string }>;
  originLabels: string[];
  recallComment: string | null;
  historyGroups: Array<{ gameId: number; gameName: string; rows: SongHistoryRow[] }>;
  backHref: string;
}

interface SongHistoryRow {
  submissionId: number;
  round: { id: number; name: string; href: string; occurredAtLabel: string | null };
  submitter: { id: number; displayName: string; href: string };
  rank: number | null;
  score: number | null;
  submittedAtLabel: string | null;
  comment: string | null;
  isOrigin: boolean;
}
```

The song browser renders a page-local search input above results. It prepopulates from the canonical `q` param, updates the result list after a short debounce as the user types, and keeps the shareable `q` URL state in sync through route navigation or replacement rather than private storage. Explicit submit still navigates to `/songs?q=<normalized query>`. Familiarity and sort controls remain URL-backed and compose with live query updates.

Artist labels link to `/songs?q=<artist name>` in v1; no `/artists/[id]` route is introduced. Song detail receives `/songs` as its server-rendered fallback back href; client-only header/navigation behavior may prefer a safe referrer when available.

Song summary facts and `historyGroups` use the appearance chronology defined in §4d-15. Group order is newest game appearance first; row order within each game is newest appearance first.

#### §4c-6. Player detail

```ts
interface PlayerDetailProps {
  player: {
    id: number;
    displayName: string;
    totalSubmissions: number;
    totalVotesCast: number;
    totalPointsReceived: number;
  };
  traits: PlayerTraitLine[];
  notablePicks: Array<PlayerNotablePick>;
  submissionGroups: Array<PlayerSubmissionGroup>;
  voteScope: PlayerVoteScopeModel;
  votesGiven: PlayerVoteTable;
  votesReceived: PlayerVoteTable;
}

interface PlayerVoteScopeModel {
  active:
    | { kind: "all"; label: "All games"; href: string }
    | { kind: "game"; gameId: number; gameName: string; href: string };
  options: Array<
    | { kind: "all"; label: "All games"; href: string; selected: boolean }
    | { kind: "game"; gameId: number; gameName: string; href: string; selected: boolean }
  >;
}

interface PlayerTraitLine {
  traitId: "consistent-finisher" | "frequent-commenter" | "high-variance-voter" | "voting-twin";
  label: string;
  badgeVariant: "trait";
  evidence: Array<{
    metric: string;
    value: number;
    threshold: string;
  }>;
  subjectPlayer?: { playerId: number; displayName: string; href: string };
}

interface PlayerNotablePick {
  kind: "best" | "worst";
  gameId: number;
  gameName: string;
  submissionId: number;
  song: { id: number; title: string; artistName: string; href: string };
  round: { id: number; name: string; href: string };
  rank: number | null;
  score: number;
}

interface PlayerSubmissionGroup {
  gameId: number;
  gameName: string;
  rows: Array<{
    submissionId: number;
    round: { id: number; name: string; href: string };
    song: { id: number; title: string; artistName: string; href: string };
    rank: number | null;
    score: number | null;
    comment: string | null;
  }>;
}

interface PlayerVoteTable {
  hasNegativeVotes: boolean;
  rows: PlayerVoteTableRow[];
}

interface PlayerVoteTableRow {
  playerId: number;
  displayName: string;
  href: string;
  voteCount: number;
  positivePoints: number;
  negativePoints: number;
  netPoints: number;
  averagePoints: number;
  comments: Array<{
    voteId: number;
    gameId: number;
    gameName: string;
    roundId: number;
    roundName: string;
    roundHref: string;
    comment: string;
  }>;
}
```

Trait rows are suppressed when thresholds are not met. `traitId` is the stable registry key used for tests, ordering, and `data-trait-id`; dynamic text such as the counterparty name for a voting-twin trait lives in `label` and `subjectPlayer`, never in the ID. Vote tables filter self-rows and split positive/negative points when negative votes exist.

Notable picks are selected per game: best pick uses highest non-null score, then lower rank, then more recent `submittedAt`, then stable submission ID; worst pick uses lowest non-null score, then higher rank, then older `submittedAt`, then stable submission ID. Null-score submissions are excluded from notable-pick selection.

Vote table rows aggregate archive-wide by counterparty by default. The secondary per-game scope is selected through `voteGameId` links on the same player route. Rows sort by `abs(netPoints)` descending, then `voteCount` descending, then display name ascending. When `hasNegativeVotes` is false, the UI may render a single net-points column; when true, it renders positive, negative, and net values.

### 4d. Internal Boundaries

#### §4d-1. Route href builders

```js
buildGameHref(gameId) => `/games/${gameId}`
buildRoundHref(gameId, roundId) => `/games/${gameId}/rounds/${roundId}`
buildSongHref(songId) => `/songs/${songId}`
buildPlayerHref(playerId) => `/players/${playerId}`
buildSongSearchHref({ q, familiarity, sort }) => `/songs?...`
```

All UI links use these builders or route-local equivalents. Alpha `buildArchiveHref` query-overlay behavior is removed.

#### §4d-2. Game timeframe derivation

```js
deriveGameTimeframe({
  rounds: Array<{ occurredAt: Date | null }>,
  submissions: Array<{ submittedAt: Date | null }>,
  votes: Array<{ votedAt: Date | null }>,
}) => null | { start: Date; end: Date; label: string; source: "rounds" | "widened-events" }
```

When `start` and `end` differ, the label is always a range. When no usable event dates exist, the result is `null`.

#### §4d-3. Leaderboard and tie derivation

```js
deriveLeaderboardRows(submissions) => {
  rows: LeaderboardRow[];
  hasTies: boolean;
  footnote: string | null;
}
```

Rows aggregate scored submissions by player, sort by total points descending, round wins descending, then display name ascending. Average points per round is excluded.

#### §4d-4. Search normalization and catalog query

```js
normalizeArchiveSearch(value) => string
getSongCatalog({
  q?: string,
  familiarity?: "all" | "first-time" | "returning",
  sort?: "most-appearances" | "most-recent" | "best-finish" | "alphabetical",
  limit?: number,
}) => SongCatalogResult
getHeaderSearchSuggestions(q, { limit: 8 }) => HeaderSearchModel["suggestions"]
```

Normalization is shared by header search and `/songs`. Matching is case-insensitive substring over normalized song title and normalized artist name.

`normalizeArchiveSearch` trims whitespace, normalizes curly quotes to straight quotes, lowercases, removes punctuation already handled by `src/lib/normalize.js`, collapses internal whitespace, and returns `""` for empty input instead of throwing. Header suggestions are suppressed for `""`; `/songs` treats `""` as the capped empty-query catalog.

`getSongCatalog` returns rows with appearance counts, best finish, most-recent appearance, and familiarity in the same loader result so the 100-row empty-query view does not need a second request to reconcile F7 and F16.

`getHeaderSearchSuggestions` is the sole data source for §4a-8. It applies a hard limit of eight, returns artist suggestions as `/songs?q=<artist name>` links, and must not include player matches.

#### §4d-5. Song familiarity verdict

```js
deriveArchiveSongFamiliarity(songId) => {
  kind: "first-time" | "returning";
  label: "First-time" | "Returning";
  appearanceCount: number;
}
```

This verdict is archive-wide and exact-song based: one submission is `first-time`; two or more submissions is `returning`. Same-artist footprint may appear as a separate supporting signal but must not change this verdict.

#### §4d-6. Page data loaders

```js
getLandingPageData({ year?: string, winner?: string, input }) => LandingPageProps
getSongBrowserData({ q?: string, familiarity?: string, sort?: string, input }) => SongBrowserProps
getGamePageData(gameId, input) => RouteDataResult<GamePageProps>
getRoundPageData(gameId, roundId, input) => RouteDataResult<RoundPageProps>
getSongDetailData(songId, input) => RouteDataResult<SongDetailProps>
getPlayerDetailData(playerId, { voteGameId?: number | null, input }) => RouteDataResult<PlayerDetailProps>

type RouteDataResult<T> =
  | { kind: "ready"; props: T }
  | { kind: "not-found"; statusNotice: StatusNoticeModel }
  | { kind: "sparse"; props: T; statusNotice: StatusNoticeModel };

interface StatusNoticeModel {
  title: string;
  body: string;
  href: string;
  hrefLabel: string;
}
```

Each loader accepts a Prisma injection for tests, returns serializable props, and owns its route's invalid/sparse states without relying on the old single-page selection resolver. Round loaders must distinguish invalid game, invalid round, and round-outside-game cases so the route can link to the nearest valid context named in §4a-3. `getSongBrowserData` owns `/songs` query normalization, invalid filter/sort normalization, empty-archive state, zero-result state, and the empty-query 100-row cap through §4d-4 rather than duplicating catalog logic in the route component.
`getGamePageData` derives its round list through §4d-17 so fixed round-list navigation remains independent from memory-board evidence and stable across route reloads.

Task ownership note: `TASK-04` owns the shared `RouteDataResult`/`StatusNoticeModel` shape, Prisma-injection convention, and reusable derivation helpers consumed by loaders. `TASK-06` through `TASK-11` own completing and testing their route-specific loaders from this contract.

#### §4d-7. Player trait registry

```js
const PLAYER_TRAIT_REGISTRY = {
  [traitId]: {
    label: string | ((evidence) => string),
    thresholds: Array<{ metric: string, operator: ">=" | "<=", value: number }>,
    computeEvidence: (playerArchiveFacts) => Record<string, number | string | null>,
    qualify: (evidence) => boolean,
  },
};

derivePlayerTraits(playerArchiveFacts, registry = PLAYER_TRAIT_REGISTRY) => PlayerTraitLine[]
```

The v1 registry ships four enabled entries:

| traitId | Label | Evidence metrics | Thresholds | Focused fixture/test plan |
|---|---|---:|---:|---|
| `consistent-finisher` | `Consistent finisher` | `averageFinishPercentile` across scored submissions; lower is better. | `<= 0.40` and at least `4` scored submissions. | Player at `0.40` with 4 scored submissions renders; player at `0.41` or with 3 scored submissions does not. |
| `frequent-commenter` | `Frequent commenter` | `commentRate = nonEmptyCommentCount / commentOpportunityCount`, where opportunities are submissions plus votes cast and comments are trimmed before counting. | `>= 0.60` and at least `12` comment opportunities. | Player at `0.60` with 12 opportunities renders; player below rate or below sample does not. |
| `high-variance-voter` | `High-variance voter` | `votePointStdDev` across `Vote.pointsAssigned` values cast by the player; negative points remain in the sample. | `>= 3.0` and at least `24` votes cast. | Player at `3.0` with 24 votes renders; player below variance or below sample does not. |
| `voting-twin` | `Voting twin with <displayName>` | Highest pairwise voting similarity with another player over shared voted songs in the same round contexts. Similarity uses cosine similarity over both players' `pointsAssigned` vectors after vote-to-submission attribution. | `>= 0.70` and at least `10` shared voted songs. | Best matching counterparty at `0.70` with 10 shared votes renders the counterparty name through `subjectPlayer`; below similarity, below overlap, and self-pairs do not render. |

Trait display order is `consistent-finisher`, `frequent-commenter`, `high-variance-voter`, then `voting-twin`. The FSD phrase `voting-twin-with-<name>` is implemented as rendered label copy, not as a registry key, so tests and styling remain stable when player display names change. A route may render all qualifying traits or cap visible traits only if the cap is explicit in component copy/tests; it must never invent fallback copy when no trait qualifies. Do not implement pairwise head-to-head records as a substitute for `voting-twin`.

#### §4d-8. Back-to-game context

```js
resolveBackToGameContext({
  currentPath,
  documentReferrer?: string,
  inTabNavigationState?: { gameId: number; label: string; href: string },
}) => null | { label: string; href: string }
```

The result is computed only in client-capable header code. Server-rendered routes pass explicit `gameContext` when the URL itself contains game context; `/songs`, `/songs/[songId]`, and `/players/[playerId]` render without a chip until client-only referrer or in-tab state safely resolves one. `documentReferrer` is accepted only when it is same-origin and resolves to `/games/[gameId]` or `/games/[gameId]/rounds/[roundId]` through §4d-1/§4d-9; unsupported local paths and all external origins return `null`. When a referrer supplies only an ID, the display label must be resolved from the shell's switcher data; if the game is absent from that data, no chip renders. The result is ephemeral and never persisted to localStorage, cookies, database state, or server module globals.

#### §4d-9. Route params, metadata, and retired-param guard

```js
parsePositiveRouteId(value) => number | null
stripRetiredOverlayParams(searchParams) => URLSearchParams
buildRouteMetadata(routeData) => { title: string; description: string }
```

Route files use `parsePositiveRouteId` before calling loaders. Invalid or missing IDs return the status-notice state defined in §4a rather than throwing. Metadata derives from the same route data as the rendered page and falls back to route-specific archive titles for invalid/sparse states.

`stripRetiredOverlayParams` is compatibility-only. It removes `round`, `song`, `player`, and `playerSubmission` from comparison URLs and tests, but must not redirect, mutate valid non-overlay params, or feed any overlay-rendering branch.

#### §4d-10. Shared shell data loader

```js
getArchiveShellData({
  activeRoute,
  gameContext,
  searchParams,
  input,
}) => Omit<ArchiveShellProps, "children">
```

Every primary route obtains header search models, game switcher groups, selected-game state, and footer/static shell copy through this boundary or a route-local wrapper around it. The shell loader owns current/completed switcher grouping through `Game.finished`; individual pages must not independently reimplement switcher ordering or header suggestion shaping.

#### §4d-11. Landing game partition, filters, and caps

```js
getLandingPageData({
  year?: string,
  winner?: string,
  input,
}) => LandingPageProps
```

The loader partitions games only by `Game.finished`, derives card timeframes through §4d-2, sorts current and completed games by timeframe end descending with stable import/source fallback for undated games, and applies URL-backed `year`/`winner` filters only to completed games after partitioning. Stable fallback ordering uses `sourceGameId` when present, then internal `Game.id`; it is a sort fallback only and is never displayed as a timeframe. `year` matches games whose derived timeframe intersects that calendar year. `winner` matches normalized winner-label text, including tied-winner labels, and an empty value normalizes to no winner filter. `completedTotal` counts the filtered completed corpus; `completedVisibleCount` starts at `min(100, completedTotal)` and increases by 50 through client-side show-more state without changing the filter query.

#### §4d-12. Round vote disclosure state

```js
useRoundVoteDisclosureState(submissionIds) => {
  isExpanded(submissionId) => boolean,
  toggleSubmission(submissionId) => void,
  toggleAll() => void,
  allExpanded: boolean,
}
```

The default state is collapsed. The state is client-local only and never appears in the URL. Rows with zero imported votes are excluded from `toggleAll` and render the non-interactive copy required by §4c-4.

#### §4d-13. Player voting-history aggregation

```js
getPlayerVoteHistory({
  playerId,
  voteGameId?: number | null,
  input,
}) => {
  voteScope: PlayerVoteScopeModel,
  votesGiven: PlayerVoteTable,
  votesReceived: PlayerVoteTable,
}
```

The default scope is archive-wide. Valid per-game scopes are restricted to games where the player has submission or vote evidence, and invalid scopes normalize to archive-wide. Votes-given rows aggregate points this player assigned to each submitter's song; votes-received rows aggregate points assigned by each voter to this player's submissions. Both tables filter self-rows, preserve negative points, expose comment context with game and round links, and use the sort order in §4c-6.

`getPlayerVoteHistory` must use §4d-16 before aggregation. Votes-given rows derive the counterparty from the resolved submission's submitter. Votes-received rows include only votes whose resolved submission submitter is the viewed player. A recurring song in a different round or game must not be treated as the voted-for submission.

#### §4d-14. Header client interaction state

```js
useArchiveHeaderInteractions({
  initialSearchValue,
  activeRoute,
  suggestionEndpoint = "/api/archive/search-suggestions",
  switcherItems,
}) => {
  searchValue: string,
  suggestions: HeaderSearchModel["suggestions"],
  suggestionStatus: "idle" | "loading" | "ready" | "error",
  suggestionCountAnnouncement: string,
  submitSearch: () => void,
  clearSuggestions: () => void,
  focusSearchFromShortcut: (event) => void,
  switcherOpen: boolean,
  switcherActiveIndex: number | null,
  setSwitcherOpen: (open) => void,
  moveSwitcherFocus: (direction: "previous" | "next") => void,
  selectActiveSwitcherItem: () => void,
}
```

`switcherItems` is the flattened interaction order derived from `GameSwitcherModel`: all current games first, then completed games. This client-only boundary owns `/` focus, `Esc` suggestion clearing, debounced suggestion fetches, search live-region copy, and keyboard-operable switcher open state. It also owns switcher arrow-key behavior: `ArrowDown`/`ArrowUp` move through the roving order, `Enter`/`Space` select the active game link, and `Escape` closes the switcher without persisting state. `Tab` must not be trapped. It never writes storage or database state and does not mutate URL state except through explicit search submit links to `/songs?q=`.

#### §4d-15. Song appearance chronology

```js
compareSongAppearanceAscending(left, right) => number
compareSongAppearanceDescending(left, right) => number
deriveSongAppearanceFacts(submissions) => {
  firstAppearance: SongHistoryRow | null,
  mostRecentAppearance: SongHistoryRow | null,
  historyGroups: SongDetailProps["historyGroups"],
}
```

Chronology uses `Submission.submittedAt` first, then `Round.occurredAt`, then stable submission ID. It never uses `Submission.createdAt`, `Song.createdAt`, `Game.createdAt`, `ImportBatch.createdAt`, or update timestamps to label or order user-visible appearances.

#### §4d-16. Vote-to-submission attribution

```js
mapVotesToRoundSubmissions({
  submissions: Array<{ id: number; roundId: number; songId: number; playerId: number }>,
  votes: Array<{ id: number; roundId: number; songId: number; voterId: number }>,
}) => {
  votesBySubmissionId: Map<number, Array<Vote>>,
  submissionByVoteId: Map<number, Submission>,
}
```

This helper is the canonical read-side bridge between `Vote` rows and submission evidence for round disclosures and player voting history. A vote resolves from the immutable import-backed key to exactly one submission where `submission.roundId === vote.roundId` and `submission.songId === vote.songId`; after that resolution, route loaders and UI components group by `submissionId`, not by `songId`. The helper never joins by `songId` alone.

M8 must not change the import data schema or canonical `Vote` persistence shape to store `submissionId`. The supported game model treats same-canonical-song/same-round duplicates as a non-case, so implementation should preserve a deterministic guard at this boundary: missing or duplicate same-round matches are data-integrity defects covered by tests, not alternate product states.

#### §4d-17. Game round ordering and round-list derivation

```js
compareGameRoundAscending(left, right) => number
deriveGameRoundListItems({
  gameId,
  rounds: Array<{
    id: number,
    sequenceNumber: number | null,
    occurredAt: Date | null,
    name: string,
    playlistUrl: string | null,
    submissions: Array<{ score: number | null, rank: number | null, playerId: number, songId: number }>,
  }>,
}) => GameRoundListItem[]
```

`compareGameRoundAscending` sorts by populated `Round.sequenceNumber` ascending, then populated `Round.occurredAt` ascending, then stable `Round.id` ascending. Null `sequenceNumber` and null `occurredAt` values sort after populated values at their comparison step. The comparator never falls back to `Round.createdAt`, `Round.updatedAt`, `ImportBatch.createdAt`, or import-row timestamps.

`deriveGameRoundListItems` is the canonical source for game-page round rows, sequence labels, submission counts, scored/unscored/partial status, winner labels, round hrefs, and playlist URLs. It must not depend on memory-board moment selection, because the fixed round list is the primary structural path to round pages.

#### §4d-18. Badge and registry display models

```js
const ARCHIVE_BADGE_VARIANTS = {
  "status-current": { tokenRole: "accent", defaultLabel: "Current" },
  "status-completed": { tokenRole: "primary", defaultLabel: "Completed" },
  "rank-tie": { tokenRole: "accent", defaultLabel: "T<rank>" },
  "rank-plain": { tokenRole: "neutral", defaultLabel: "<rank>" },
  "score": { tokenRole: "neutral", defaultLabel: "<score>" },
  "playlist-link": { tokenRole: "accent", defaultLabel: "Playlist" },
  "familiarity-first-time": { tokenRole: "secondary", defaultLabel: "First-time" },
  "familiarity-returning": { tokenRole: "primary", defaultLabel: "Returning" },
  "search-type-song": { tokenRole: "secondary", defaultLabel: "Song" },
  "search-type-artist": { tokenRole: "secondary", defaultLabel: "Artist" },
  "trait": { tokenRole: "accent", defaultLabel: "<trait label>" },
};

buildArchiveBadgeModel({
  variant,
  label,
  ariaLabel,
}) => { variant: keyof ARCHIVE_BADGE_VARIANTS; label: string; ariaLabel: string | null }
```

Recurring pills and badges use these named variants or route-local aliases that resolve to them. Status badges, tie-rank pills, familiarity pills, search suggestion type chips, playlist pills, and player trait badges must not hardcode route-specific color classes or use visible labels as styling keys. The variant names are stable for tests and styles; labels remain ordinary copy and may vary only when the relevant contract above permits it.

#### §4d-19. Archive visual tokens

```css
:root {
  --brand-purple: <deep purple>;
  --accent-gold: <warm gold>;
  --surface-paper: <off-white>;
  --surface-secondary: <muted lavender-tinted off-white>;
  --ink-primary: <near-black ink>;
  --ink-muted: <desaturated purple-gray>;
  --focus-ring: <accessible focus indicator>;
  --font-display: <serif display stack>;
  --font-body: <system sans-serif stack>;
}
```

These named tokens are the sole palette and typeface source for M8 route surfaces, shell chrome, recurring badges, focus states, and route-local aliases. Route styles may define layout, spacing, and component-specific aliases, but any alias that carries a palette role must resolve to this token set. Alpha warm paper/brick palette values must be removed or remapped through these tokens rather than consumed directly by route components.

### 4e. Dependencies

No new packages. M8 must use the existing Next, React, Prisma, and Node test stack already present in `package.json`.

| Package | Purpose | Rationale |
|---|---|---|
| None | Not applicable | Existing dependencies are sufficient; new packages require explicit reauthorization. |

## 5. Acceptance Criteria

| ID | Condition | Verification |
|---|---|---|
| AC-01 | `/`, `/games/[id]`, `/games/[id]/rounds/[id]`, `/songs`, `/songs/[songId]`, and `/players/[id]` render as stable, shareable routes with meaningful titles and status-notice degradation for invalid IDs. | `test` / `manual` |
| AC-02 | Retired overlay params `round`, `song`, `player`, and `playerSubmission` are ignored on every valid route, no overlay code path remains active, and alpha URL-overlay routing code is deleted rather than dead-coded. | `test` / `manual` |
| AC-03 | Persistent header renders on every route with brand link, global search, songs link, compact game switcher, and contextual back-to-game chip when game context is available. | `test` / `manual` |
| AC-04 | Shared purple/gold/off-white/lavender/ink tokens and named badge variants are defined once and consumed by route styles; alpha warm palette values and route-specific badge colors are not hardcoded in route components. | `manual` / `lint` |
| AC-05 | Landing page splits games by `Game.finished === false` and `Game.finished === true`; no game appears in both bands or disappears from both. | `test` |
| AC-06 | Landing game cards and game headers use event-derived timeframe labels and omit timeframe when no event dates exist. ORM/import bookkeeping timestamps are not displayed. | `test` |
| AC-07 | Completed games render newest-first by event timeframe end, initially cap at 100, reveal additional rows in 50-item batches, and expose URL-backed year/winner filters once the completed corpus exceeds 30. | `test` / `manual` |
| AC-08 | Game pages with scored evidence render a leaderboard above the fold, fixed round list in §4d-17 canonical order, memory board, and competitive anchor in the FSD order. | `manual` / `test` |
| AC-09 | Leaderboard ties render `T<rank>` rows with the total points -> round wins -> display name hierarchy and an accessible footnote whenever ties exist. | `test` / `manual` |
| AC-10 | Unfinished games render provisional standings with explicit in-progress labeling; games without scored rounds show scoring-evidence copy instead of fabricated rankings. | `test` / `manual` |
| AC-11 | Game round-list rows link to real round routes and render a secondary outbound `Playlist` link only when `Round.playlistUrl` is present; playlist links use `target="_blank"` and `rel="noopener"`. | `test` / `manual` |
| AC-12 | Round pages render parent game context, optional playlist pill, up to three highlights, and full submissions ordered by rank with comments inline. | `test` / `manual` |
| AC-13 | Round vote evidence is co-located beneath each submission behind initially collapsed `button[aria-expanded]` controls, with per-row Show/Hide labels, non-interactive no-vote rows, and an Expand all votes affordance. | `test` / `manual` |
| AC-14 | `/songs` supports title/artist search, canonical `q`, debounced live result updates, familiarity filter, sort URL params, empty-query 100-row cap, refine hint, zero-result state, and prepopulation from `?q=`. | `test` / `manual` |
| AC-15 | Header search uses the same normalization as `/songs`, submits to `/songs?q=`, supports `/` focus and `Esc` suggestion clearing, fetches live suggestions through the bounded read-only suggestions endpoint, and renders up to 8 song/artist suggestions. | `test` / `manual` |
| AC-16 | A song shown as `First-time` or `Returning` in `/songs` shows the same verdict on `/songs/[songId]`. | `test` |
| AC-17 | Song detail renders full provenance: title, artist, familiarity verdict, event-chronological first/most-recent appearance, appearance count, artist footprint, best finish, origin labels, optional recall comment, and history grouped by game. | `test` / `manual` |
| AC-18 | Every leaderboard row, submission submitter, and vote voter links to `/players/[id]`; every submission song links to `/songs/[songId]`. | `test` / `manual` |
| AC-19 | Player detail renders aggregate context, threshold-gated registry traits with stable registry IDs, notable picks, submission history grouped by game, votes-given table, and votes-received table. | `test` / `manual` |
| AC-20 | Player vote tables default to archive-wide scope, expose a per-game secondary scope, filter self-rows, display comments inline with game/round context where applicable, sort by absolute points, and split positive/negative points when negative votes exist. | `test` / `manual` |
| AC-21 | No page introduces album, genre, mood, release-year, audio-feature, recommendation, authentication, live voting, live submission, playlist management, or Spotify enrichment behavior. | `manual` |
| AC-22 | Each primary route satisfies the M8 accessibility checklist: one H1, labeled landmarks, `aria-current`, table captions/headers, focus indicators, skip link, search label/live region, keyboard-operable disclosures, and an arrow-key navigable game switcher with `Enter`/`Space` selection and `Escape` close behavior. | `manual` / `test` |
| AC-23 | An archive containing at least one current game and one completed game is screenshot-coherent across all primary routes at desktop and mobile widths. | `manual` |
| AC-24 | Round vote disclosures and player voting-history tables attribute votes only through same-round song matches; recurring songs in other rounds or games never receive those votes. | `test` |

## 6. Task Decomposition Hints

1. **[TASK-01] Replace overlay routing with real route skeletons** - Add the six Next route entries, route-level metadata fallbacks, route ID parsing, route href builders, and retired-param no-op behavior; remove active query-overlay selection paths from the root archive entrypoint.
   `contracts: §4a-1, §4a-2, §4a-3, §4a-4, §4a-5, §4a-6, §4a-7, §4d-1, §4d-9` · `preserves: INV-01, INV-02, INV-10, INV-11, INV-12, INV-13` · `validates: AC-01, AC-02`
2. **[TASK-02] Establish archive visual tokens and badge primitives** - Define the M8 token set, remap or remove alpha warm palette values, implement stable badge variants, and make token consumption available before shell and route components are built.
   `contracts: §4d-18, §4d-19` · `preserves: INV-08, INV-20` · `validates: AC-04`
3. **[TASK-03] Introduce persistent archive shell chrome** - Build `ArchiveShell`, persistent header landmarks, footer, skip link, responsive search trigger structure, shared shell data loader, game switcher grouping, client-only back-to-game context, and token-backed shell/badge consumption; leave live suggestions and roving keyboard behavior to `TASK-05`.
   `contracts: §4c-1, §4d-8, §4d-10, §4d-18, §4d-19` · `preserves: INV-03, INV-06, INV-08, INV-10, INV-15, INV-16, INV-20` · `validates: AC-03, AC-22`
4. **[TASK-04] Centralize M8 derivation utilities** - Implement shared derivations for event timeframes, leaderboard ties, search normalization, archive-wide song familiarity, route-data result types, Prisma-injection conventions, vote-to-submission attribution, song appearance chronology, and game round ordering; replace alpha round-local vote grouping with §4d-16 before new route/player loaders consume vote evidence.
   `contracts: §4b-1, §4d-1, §4d-2, §4d-3, §4d-4, §4d-5, §4d-6, §4d-9, §4d-15, §4d-16, §4d-17` · `preserves: INV-03, INV-04, INV-05, INV-06, INV-11, INV-12, INV-14, INV-18, INV-19` · `validates: AC-06, AC-09, AC-16, AC-24`
5. **[TASK-05] Implement header interactions and search suggestions** - Add the bounded suggestions endpoint, debounced suggestion fetching, search submit/focus behavior, search live-region copy, game switcher roving keyboard behavior, and non-persistent client state for header interactions.
   `contracts: §4a-8, §4c-1, §4d-4, §4d-10, §4d-14, §4d-18` · `preserves: INV-06, INV-08, INV-10, INV-15, INV-20` · `validates: AC-03, AC-15, AC-22`
6. **[TASK-06] Build the landing page** - Complete `getLandingPageData` and replace the root memory-board default with current/completed game bands, empty archive copy, completed-game cap, show-more batches, URL-backed filters, and event-derived card timeframes.
   `contracts: §4a-1, §4c-2, §4d-2, §4d-6, §4d-11, §4d-18, §4d-19` · `preserves: INV-03, INV-04, INV-08, INV-10, INV-20` · `validates: AC-01, AC-05, AC-06, AC-07, AC-21, AC-23`
7. **[TASK-07] Build the game page** - Complete `getGamePageData` and render game header, provisional/completed leaderboard, fixed round list with playlist links, preserved M6 memory board, and competitive anchor copy.
   `contracts: §4a-2, §4c-3, §4d-2, §4d-3, §4d-6, §4d-17, §4d-18, §4d-19` · `preserves: INV-03, INV-04, INV-05, INV-06, INV-08, INV-09, INV-11, INV-19, INV-20` · `validates: AC-01, AC-08, AC-09, AC-10, AC-11, AC-18, AC-21, AC-23`
8. **[TASK-08] Build the round page and inline vote disclosures** - Complete `getRoundPageData`, promote round overlay content into the route page, preserve comments, wire submission song/player links, add playlist pill, and replace the separate vote section with per-submission disclosures.
   `contracts: §4a-3, §4c-4, §4d-5, §4d-6, §4d-12, §4d-16, §4d-18, §4d-19` · `preserves: INV-01, INV-02, INV-06, INV-08, INV-09, INV-11, INV-18, INV-20` · `validates: AC-01, AC-11, AC-12, AC-13, AC-18, AC-21, AC-22, AC-23, AC-24`
9. **[TASK-09] Build song browser route** - Complete `getSongBrowserData` and implement `/songs` query/filter/sort state, debounced live result updates from the page search input, artist-to-search links, empty-query cap, refine hint, empty archive state, and zero-result state using the same catalog and familiarity derivations as header search.
   `contracts: §4a-4, §4c-5, §4d-4, §4d-5, §4d-6, §4d-18, §4d-19` · `preserves: INV-06, INV-08, INV-10, INV-11, INV-15, INV-20` · `validates: AC-01, AC-14, AC-16, AC-21, AC-22, AC-23`
10. **[TASK-10] Build song detail route** - Complete `getSongDetailData` and promote alpha song memory into `/songs/[songId]`, using the archive-wide familiarity verdict, summary facts, origin labels, recall comment, and history grouped by game.
   `contracts: §4a-5, §4c-5, §4d-5, §4d-6, §4d-15, §4d-18, §4d-19` · `preserves: INV-01, INV-06, INV-08, INV-10, INV-11, INV-14, INV-20` · `validates: AC-01, AC-16, AC-17, AC-18, AC-21, AC-22, AC-23`
11. **[TASK-11] Build player detail route and trait registry** - Complete `getPlayerDetailData` and implement player aggregates, the OQ-01-resolved trait registry shape, per-game notable picks, grouped submission history, archive-wide and per-game votes-given/votes-received tables, split-on-negatives display, and links from every player reference.
   `contracts: §4a-6, §4c-6, §4d-6, §4d-7, §4d-13, §4d-16, §4d-18, §4d-19` · `preserves: INV-01, INV-06, INV-07, INV-08, INV-10, INV-11, INV-17, INV-18, INV-20` · `validates: AC-01, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24`
12. **[TASK-12] Run cross-route accessibility and regression hardening** - Verify all primary routes against the F13 checklist, retired overlay behavior, mobile responsiveness, screenshot coherence, shared shell behavior, stable badge/registry IDs, token consumption, no-schema-change posture, and no out-of-scope surfaces.
   `contracts: §4a-1, §4a-2, §4a-3, §4a-4, §4a-5, §4a-6, §4a-7, §4a-8, §4b-1, §4c-1, §4c-2, §4c-3, §4c-4, §4c-5, §4c-6, §4d-1, §4d-2, §4d-3, §4d-4, §4d-5, §4d-6, §4d-7, §4d-8, §4d-9, §4d-10, §4d-11, §4d-12, §4d-13, §4d-14, §4d-15, §4d-16, §4d-17, §4d-18, §4d-19, §4e` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, INV-10, INV-11, INV-12, INV-13, INV-14, INV-15, INV-16, INV-17, INV-18, INV-19, INV-20` · `validates: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24`

### Dependency Graph

```
TASK-01:
TASK-02: TASK-01
TASK-03: TASK-01,TASK-02
TASK-04: TASK-01
TASK-05: TASK-03,TASK-04
TASK-06: TASK-03,TASK-04
TASK-07: TASK-03,TASK-04
TASK-08: TASK-03,TASK-04
TASK-09: TASK-03,TASK-04
TASK-10: TASK-03,TASK-04
TASK-11: TASK-05,TASK-06,TASK-07,TASK-08,TASK-09,TASK-10
TASK-12: TASK-05,TASK-06,TASK-07,TASK-08,TASK-09,TASK-10,TASK-11
```

## 7. Out of Scope

- [ ] Album search - no album field exists in the data model or CSV export; requires Spotify enrichment or a new import source.
- [ ] Spotify enrichment beyond current CSV fields - M8 only surfaces stored playlist URLs as outbound links.
- [ ] Authentication, accounts, and per-user state - the archive remains single-tenant and read-only.
- [ ] Live submission, voting, or playlist management - outside archive product posture.
- [ ] Manual import-review UI - import remains a developer surface.
- [ ] Artist detail route (`/artists/[id]`) - artists are display/search text in M8; artist labels link to `/songs?q=<artist>` only.
- [ ] Player index route (`/players`) - global search and contextual links cover player navigation for M8.
- [ ] localStorage/session persistence for game switcher or back-to-game chip - back-to-game context is in-tab/referrer only and may disappear on reload.
- [ ] Pagination or virtualization beyond named caps - virtualization remains out until the corpus is near 10k songs.
- [ ] Vote-budget, deadline, disqualification, and source-platform-setting inference - preserve imported facts without reconstructing platform configuration.
- [ ] Genre, mood, tempo, audio-feature, recommendation, popularity, or release-year surfaces - no supporting canonical data source exists.
- [ ] Head-to-head W/L/D player surface - explicitly rejected by the design contract; any future affinity signal must be a thresholded trait.
- [ ] Nested dialogs and URL-addressable overlays - replaced by routes and inline vote disclosure.

## 8. Open Questions

- **OQ-01:** Which numeric thresholds, labels, evidence values, and focused fixture/test plan ship for the approved v1 trait IDs `high-variance-voter`, `frequent-commenter`, `consistent-finisher`, and the voting-twin trait? — **Resolution:** `resolved -> §4d-7`; HITL selected generous thresholds for `consistent-finisher` and the voting-twin trait, and conservative thresholds for `frequent-commenter` and `high-variance-voter`. The voting-twin registry ID is `voting-twin`; `<displayName>` appears only in rendered label copy.

Resolved during bootstrap:

- **OQ-R1:** Should artist labels in `/songs` link somewhere in v1? — **Resolution:** `resolved -> §4c-5`; artist labels link to `/songs?q=<artist name>` without introducing an artist route.
- **OQ-R2:** Should F10 live suggestions ship in v1? — **Resolution:** `resolved -> §4a-8, §4c-1, §4d-4, §4d-14, AC-15`; include up to 8 mixed song/artist suggestions because it improves the search-first user story without new dependencies.
- **OQ-R3:** How does header search behave below 720px? — **Resolution:** `resolved -> §4c-1`; collapse behind a text-labeled `Search` trigger, matching `DESIGN.md` responsive guidance and the icon-absent visual system.

---

## Appendix D: Discoveries Log

No implementation discoveries recorded during bootstrap authoring.

---

## Appendix E: Context Slices

### E.1 Two-file model

Every task invocation receives:

1. `SPEC-MMM-universal.md` — §1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries
2. `SPEC-MMM-slice-TASK-NN.md` — assembled from tokens below

§4 (contracts), §5 (ACs), §6 (task hints), and Appendix E are excluded from the universal file. Universal content is never repeated in slice files.

### E.2 Extraction contract

Section boundaries in the source spec follow the pattern:

```
#### §4a-N. Title    →  ends at next ####, ###, or EOF
#### §4c-N. Title    →  ends at next ####, ###, or EOF
```

Slice blocks are delimited:

```
&lt;!-- SLICE:TASK-NN --&gt;
&lt;!-- /SLICE:TASK-NN --&gt;
```

**Regex — extract named slice:**

```
<!-- SLICE:(TASK-[\w]+) -->[\s\S]*?<!-- /SLICE:\1 -->
```

**Regex — extract SECTIONS tokens from a slice:**

```
^  (§[\w-:]+)
```

*(exactly two leading spaces; distinguishes tokens from prose)*

**Regex — extract a section from the source spec by token `§4a-3`:**

```
(?=#### §4a-3\ .)[\s\S]*?(?=#### |### |## |$)
```

**Regex — extract a single task hint from §6:**

```
\d+\.\s+\*\*\[TASK-NN\][\s\S]*?(?=\n\d+\.\s+\*\*\[TASK-|\n###\s|\n##\s|$)
```

### E.3 Token grammar

|Token|Matches|
|-|-|
|`§4a-N`|Single API endpoint section|
|`§4a-N:M`|§4a-N through §4a-M inclusive|
|`§4b-N`|Single schema migration section|
|`§4b-N:M`|§4b-N through §4b-M inclusive|
|`§4c-N`|Single component contract section|
|`§4d-N`|Single internal boundary section|
|`§4d-N:M`|§4d-N through §4d-M inclusive|
|`§4e`|Full dependency table|
|`§5:AC-NN`|Single AC row|
|`§5:AC-NN:MM`|AC rows NN through MM inclusive|
|`§6:TASK-NN`|Single task decomposition hint entry (prose line + metadata line)|

### E.4 Slice definitions


<!-- SLICE:TASK-01 -->
TASK:     TASK-01
LABEL:    Replace overlay routing with real route skeletons
DEPENDS:  (none)
SECTIONS:
§4a-1:7
§4d-1
§4d-9
§5:AC-01:02
§6:TASK-01
<!-- /SLICE:TASK-01 -->

<!-- SLICE:TASK-02 -->
TASK:     TASK-02
LABEL:    Establish archive visual tokens and badge primitives
DEPENDS:  TASK-01
SECTIONS:
§4d-18:19
§5:AC-04
§6:TASK-02
<!-- /SLICE:TASK-02 -->

<!-- SLICE:TASK-03 -->
TASK:     TASK-03
LABEL:    Introduce persistent archive shell chrome
DEPENDS:  TASK-01, TASK-02
SECTIONS:
§4c-1
§4d-8
§4d-10
§4d-18:19
§5:AC-03
§5:AC-22
§6:TASK-03
<!-- /SLICE:TASK-03 -->

<!-- SLICE:TASK-04 -->
TASK:     TASK-04
LABEL:    Centralize M8 derivation utilities
DEPENDS:  TASK-01
SECTIONS:
§4b-1
§4d-1:6
§4d-9
§4d-15:17
§5:AC-06
§5:AC-09
§5:AC-16
§5:AC-24
§6:TASK-04
<!-- /SLICE:TASK-04 -->

<!-- SLICE:TASK-05 -->
TASK:     TASK-05
LABEL:    Implement header interactions and search suggestions
DEPENDS:  TASK-03, TASK-04
SECTIONS:
§4a-8
§4c-1
§4d-4
§4d-10
§4d-14
§4d-18
§5:AC-03
§5:AC-15
§5:AC-22
§6:TASK-05
<!-- /SLICE:TASK-05 -->

<!-- SLICE:TASK-06 -->
TASK:     TASK-06
LABEL:    Build the landing page
DEPENDS:  TASK-03, TASK-04
SECTIONS:
§4a-1
§4c-2
§4d-2
§4d-6
§4d-11
§4d-18:19
§5:AC-01
§5:AC-05:07
§5:AC-21
§5:AC-23
§6:TASK-06
<!-- /SLICE:TASK-06 -->

<!-- SLICE:TASK-07 -->
TASK:     TASK-07
LABEL:    Build the game page
DEPENDS:  TASK-03, TASK-04
SECTIONS:
§4a-2
§4c-3
§4d-2:3
§4d-6
§4d-17:19
§5:AC-01
§5:AC-08:11
§5:AC-18
§5:AC-21
§5:AC-23
§6:TASK-07
<!-- /SLICE:TASK-07 -->

<!-- SLICE:TASK-08 -->
TASK:     TASK-08
LABEL:    Build the round page and inline vote disclosures
DEPENDS:  TASK-03, TASK-04
SECTIONS:
§4a-3
§4c-4
§4d-5:6
§4d-12
§4d-16
§4d-18:19
§5:AC-01
§5:AC-11:13
§5:AC-18
§5:AC-21:24
§6:TASK-08
<!-- /SLICE:TASK-08 -->

<!-- SLICE:TASK-09 -->
TASK:     TASK-09
LABEL:    Build song browser route
DEPENDS:  TASK-03, TASK-04
SECTIONS:
§4a-4
§4c-5
§4d-4:6
§4d-18:19
§5:AC-01
§5:AC-14
§5:AC-16
§5:AC-21:23
§6:TASK-09
<!-- /SLICE:TASK-09 -->

<!-- SLICE:TASK-10 -->
TASK:     TASK-10
LABEL:    Build song detail route
DEPENDS:  TASK-03, TASK-04
SECTIONS:
§4a-5
§4c-5
§4d-5:6
§4d-15
§4d-18:19
§5:AC-01
§5:AC-16:18
§5:AC-21:23
§6:TASK-10
<!-- /SLICE:TASK-10 -->

<!-- SLICE:TASK-11 -->
TASK:     TASK-11
LABEL:    Build player detail route and trait registry
DEPENDS:  TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10
SECTIONS:
§4a-6
§4c-6
§4d-6:7
§4d-13
§4d-16
§4d-18:19
§5:AC-01
§5:AC-18:24
§6:TASK-11
<!-- /SLICE:TASK-11 -->

<!-- SLICE:TASK-12 -->
TASK:     TASK-12
LABEL:    Run cross-route accessibility and regression hardening
DEPENDS:  TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10, TASK-11
SECTIONS:
§4a-1:8
§4b-1
§4c-1:6
§4d-1:19
§4e
§5:AC-01:24
§6:TASK-12
<!-- /SLICE:TASK-12 -->

<!-- END SPEC -->
