# Slice: TASK-10 — Build song detail route

> **Depends-on:** TASK-03, TASK-04
> **Universal:** SPEC-008-ux-rework-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4a-5. Song detail route

```
GET /songs/[songId]
Response: canonical song detail with title, artist, familiarity verdict, summary facts, origin labels, optional recall comment, and submission history grouped by game.

Errors:
  Invalid songId: render status notice with link to /songs.
  Song without submission evidence: render status notice with link to /songs; do not synthesize provenance.
```

---

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

---

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
| AC-16 | A song shown as `First-time` or `Returning` in `/songs` shows the same verdict on `/songs/[songId]`. | `test` |
| AC-17 | Song detail renders full provenance: title, artist, familiarity verdict, event-chronological first/most-recent appearance, appearance count, artist footprint, best finish, origin labels, optional recall comment, and history grouped by game. | `test` / `manual` |
| AC-18 | Every leaderboard row, submission submitter, and vote voter links to `/players/[id]`; every submission song links to `/songs/[songId]`. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-21 | No page introduces album, genre, mood, release-year, audio-feature, recommendation, authentication, live voting, live submission, playlist management, or Spotify enrichment behavior. | `manual` |
| AC-22 | Each primary route satisfies the M8 accessibility checklist: one H1, labeled landmarks, `aria-current`, table captions/headers, focus indicators, skip link, search label/live region, keyboard-operable disclosures, and an arrow-key navigable game switcher with `Enter`/`Space` selection and `Escape` close behavior. | `manual` / `test` |
| AC-23 | An archive containing at least one current game and one completed game is screenshot-coherent across all primary routes at desktop and mobile widths. | `manual` |

---

10. **[TASK-10] Build song detail route** - Complete `getSongDetailData` and promote alpha song memory into `/songs/[songId]`, using the archive-wide familiarity verdict, summary facts, origin labels, recall comment, and history grouped by game.
   `contracts: §4a-5, §4c-5, §4d-5, §4d-6, §4d-15, §4d-18, §4d-19` · `preserves: INV-01, INV-06, INV-08, INV-10, INV-11, INV-14, INV-20` · `validates: AC-01, AC-16, AC-17, AC-18, AC-21, AC-22, AC-23`

---
