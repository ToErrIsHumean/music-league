# Slice: TASK-05 — Implement header interactions and search suggestions

> **Depends-on:** TASK-03, TASK-04
> **Universal:** SPEC-008-ux-rework-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

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

---

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

---

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

---

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

---

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

---

| ID | Condition | Verification |
|---|---|---|
| AC-03 | Persistent header renders on every route with brand link, global search, songs link, compact game switcher, and contextual back-to-game chip when game context is available. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-15 | Header search uses the same normalization as `/songs`, submits to `/songs?q=`, supports `/` focus and `Esc` suggestion clearing, fetches live suggestions through the bounded read-only suggestions endpoint, and renders up to 8 song/artist suggestions. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-22 | Each primary route satisfies the M8 accessibility checklist: one H1, labeled landmarks, `aria-current`, table captions/headers, focus indicators, skip link, search label/live region, keyboard-operable disclosures, and an arrow-key navigable game switcher with `Enter`/`Space` selection and `Escape` close behavior. | `manual` / `test` |

---

5. **[TASK-05] Implement header interactions and search suggestions** - Add the bounded suggestions endpoint, debounced suggestion fetching, search submit/focus behavior, search live-region copy, game switcher roving keyboard behavior, and non-persistent client state for header interactions.
   `contracts: §4a-8, §4c-1, §4d-4, §4d-10, §4d-14, §4d-18` · `preserves: INV-06, INV-08, INV-10, INV-15, INV-20` · `validates: AC-03, AC-15, AC-22`

---
