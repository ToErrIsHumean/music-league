# Slice: TASK-01 — Replace overlay routing with real route skeletons

> **Depends-on:** (none)
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

| ID | Condition | Verification |
|---|---|---|
| AC-01 | `/`, `/games/[id]`, `/games/[id]/rounds/[id]`, `/songs`, `/songs/[songId]`, and `/players/[id]` render as stable, shareable routes with meaningful titles and status-notice degradation for invalid IDs. | `test` / `manual` |
| AC-02 | Retired overlay params `round`, `song`, `player`, and `playerSubmission` are ignored on every valid route, no overlay code path remains active, and alpha URL-overlay routing code is deleted rather than dead-coded. | `test` / `manual` |

---

1. **[TASK-01] Replace overlay routing with real route skeletons** - Add the six Next route entries, route-level metadata fallbacks, route ID parsing, route href builders, and retired-param no-op behavior; remove active query-overlay selection paths from the root archive entrypoint.
   `contracts: §4a-1, §4a-2, §4a-3, §4a-4, §4a-5, §4a-6, §4a-7, §4d-1, §4d-9` · `preserves: INV-01, INV-02, INV-10, INV-11, INV-12, INV-13` · `validates: AC-01, AC-02`

---
