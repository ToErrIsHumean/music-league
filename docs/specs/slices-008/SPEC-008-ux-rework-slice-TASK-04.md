# Slice: TASK-04 — Centralize M8 derivation utilities

> **Depends-on:** TASK-01
> **Universal:** SPEC-008-ux-rework-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4b-1. Schema changes

```sql
-- Migration: none
-- Direction: not applicable
-- Rollback: not applicable
```

M8 reads existing `Game.finished`, `Round.playlistUrl`, `Round.occurredAt`, `Submission.submittedAt`, `Vote.votedAt`, `Submission.score`, `Submission.rank`, `Submission.comment`, and `Vote.comment`. It must not add album, Spotify enrichment, account, or live-gameplay fields.

---

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

---

#### §4d-9. Route params, metadata, and retired-param guard

```js
parsePositiveRouteId(value) => number | null
stripRetiredOverlayParams(searchParams) => URLSearchParams
buildRouteMetadata(routeData) => { title: string; description: string }
```

Route files use `parsePositiveRouteId` before calling loaders. Invalid or missing IDs return the status-notice state defined in §4a rather than throwing. Metadata derives from the same route data as the rendered page and falls back to route-specific archive titles for invalid/sparse states.

`stripRetiredOverlayParams` is compatibility-only. It removes `round`, `song`, `player`, and `playerSubmission` from comparison URLs and tests, but must not redirect, mutate valid non-overlay params, or feed any overlay-rendering branch.

---

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

---

| ID | Condition | Verification |
|---|---|---|
| AC-06 | Landing game cards and game headers use event-derived timeframe labels and omit timeframe when no event dates exist. ORM/import bookkeeping timestamps are not displayed. | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-09 | Leaderboard ties render `T<rank>` rows with the total points -> round wins -> display name hierarchy and an accessible footnote whenever ties exist. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-16 | A song shown as `First-time` or `Returning` in `/songs` shows the same verdict on `/songs/[songId]`. | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-24 | Round vote disclosures and player voting-history tables attribute votes only through same-round song matches; recurring songs in other rounds or games never receive those votes. | `test` |

---

4. **[TASK-04] Centralize M8 derivation utilities** - Implement shared derivations for event timeframes, leaderboard ties, search normalization, archive-wide song familiarity, route-data result types, Prisma-injection conventions, vote-to-submission attribution, song appearance chronology, and game round ordering; replace alpha round-local vote grouping with §4d-16 before new route/player loaders consume vote evidence.
   `contracts: §4b-1, §4d-1, §4d-2, §4d-3, §4d-4, §4d-5, §4d-6, §4d-9, §4d-15, §4d-16, §4d-17` · `preserves: INV-03, INV-04, INV-05, INV-06, INV-11, INV-12, INV-14, INV-18, INV-19` · `validates: AC-06, AC-09, AC-16, AC-24`

---
