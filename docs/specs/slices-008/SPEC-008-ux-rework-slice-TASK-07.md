# Slice: TASK-07 — Build the game page

> **Depends-on:** TASK-03, TASK-04
> **Universal:** SPEC-008-ux-rework-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4a-2. Game route

```
GET /games/[gameId]
Response: game page with header, status badge, event-derived timeframe, leaderboard, fixed round list, memory board, and competitive anchor.

Errors:
  Invalid gameId: render status notice with link to /.
  Game with no round evidence: render status notice rather than memory-board filler.
  Game with no scored rounds: suppress leaderboard table and render pending-scoring copy.
```

---

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

---

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

---

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

---

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

---

| ID | Condition | Verification |
|---|---|---|
| AC-01 | `/`, `/games/[id]`, `/games/[id]/rounds/[id]`, `/songs`, `/songs/[songId]`, and `/players/[id]` render as stable, shareable routes with meaningful titles and status-notice degradation for invalid IDs. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-08 | Game pages with scored evidence render a leaderboard above the fold, fixed round list in §4d-17 canonical order, memory board, and competitive anchor in the FSD order. | `manual` / `test` |
| AC-09 | Leaderboard ties render `T<rank>` rows with the total points -> round wins -> display name hierarchy and an accessible footnote whenever ties exist. | `test` / `manual` |
| AC-10 | Unfinished games render provisional standings with explicit in-progress labeling; games without scored rounds show scoring-evidence copy instead of fabricated rankings. | `test` / `manual` |
| AC-11 | Game round-list rows link to real round routes and render a secondary outbound `Playlist` link only when `Round.playlistUrl` is present; playlist links use `target="_blank"` and `rel="noopener"`. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-18 | Every leaderboard row, submission submitter, and vote voter links to `/players/[id]`; every submission song links to `/songs/[songId]`. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-21 | No page introduces album, genre, mood, release-year, audio-feature, recommendation, authentication, live voting, live submission, playlist management, or Spotify enrichment behavior. | `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-23 | An archive containing at least one current game and one completed game is screenshot-coherent across all primary routes at desktop and mobile widths. | `manual` |

---

7. **[TASK-07] Build the game page** - Complete `getGamePageData` and render game header, provisional/completed leaderboard, fixed round list with playlist links, preserved M6 memory board, and competitive anchor copy.
   `contracts: §4a-2, §4c-3, §4d-2, §4d-3, §4d-6, §4d-17, §4d-18, §4d-19` · `preserves: INV-03, INV-04, INV-05, INV-06, INV-08, INV-09, INV-11, INV-19, INV-20` · `validates: AC-01, AC-08, AC-09, AC-10, AC-11, AC-18, AC-21, AC-23`

---
