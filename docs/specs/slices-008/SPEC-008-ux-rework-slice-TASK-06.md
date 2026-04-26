# Slice: TASK-06 — Build the landing page

> **Depends-on:** TASK-03, TASK-04
> **Universal:** SPEC-008-ux-rework-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

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

---

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

#### §4d-11. Landing game partition, filters, and caps

```js
getLandingPageData({
  year?: string,
  winner?: string,
  input,
}) => LandingPageProps
```

The loader partitions games only by `Game.finished`, derives card timeframes through §4d-2, sorts current and completed games by timeframe end descending with stable import/source fallback for undated games, and applies URL-backed `year`/`winner` filters only to completed games after partitioning. Stable fallback ordering uses `sourceGameId` when present, then internal `Game.id`; it is a sort fallback only and is never displayed as a timeframe. `year` matches games whose derived timeframe intersects that calendar year. `winner` matches normalized winner-label text, including tied-winner labels, and an empty value normalizes to no winner filter. `completedTotal` counts the filtered completed corpus; `completedVisibleCount` starts at `min(100, completedTotal)` and increases by 50 through client-side show-more state without changing the filter query.

---

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
| AC-05 | Landing page splits games by `Game.finished === false` and `Game.finished === true`; no game appears in both bands or disappears from both. | `test` |
| AC-06 | Landing game cards and game headers use event-derived timeframe labels and omit timeframe when no event dates exist. ORM/import bookkeeping timestamps are not displayed. | `test` |
| AC-07 | Completed games render newest-first by event timeframe end, initially cap at 100, reveal additional rows in 50-item batches, and expose URL-backed year/winner filters once the completed corpus exceeds 30. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-21 | No page introduces album, genre, mood, release-year, audio-feature, recommendation, authentication, live voting, live submission, playlist management, or Spotify enrichment behavior. | `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-23 | An archive containing at least one current game and one completed game is screenshot-coherent across all primary routes at desktop and mobile widths. | `manual` |

---

6. **[TASK-06] Build the landing page** - Complete `getLandingPageData` and replace the root memory-board default with current/completed game bands, empty archive copy, completed-game cap, show-more batches, URL-backed filters, and event-derived card timeframes.
   `contracts: §4a-1, §4c-2, §4d-2, §4d-6, §4d-11, §4d-18, §4d-19` · `preserves: INV-03, INV-04, INV-08, INV-10, INV-20` · `validates: AC-01, AC-05, AC-06, AC-07, AC-21, AC-23`

---
