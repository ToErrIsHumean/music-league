# Slice: TASK-03 — Introduce persistent archive shell chrome

> **Depends-on:** TASK-01, TASK-02
> **Universal:** SPEC-008-ux-rework-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

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

#### §4d-8. Back-to-game context

```js
resolveBackToGameContext({
  currentPath,
  documentReferrer?: string,
  inTabNavigationState?: { gameId: number; label: string; href: string },
}) => null | { label: string; href: string }
```

The result is computed only in client-capable header code. Server-rendered routes pass explicit `gameContext` when the URL itself contains game context; `/songs`, `/songs/[songId]`, and `/players/[playerId]` render without a chip until client-only referrer or in-tab state safely resolves one. `documentReferrer` is accepted only when it is same-origin and resolves to `/games/[gameId]` or `/games/[gameId]/rounds/[roundId]` through §4d-1/§4d-9; unsupported local paths and all external origins return `null`. When a referrer supplies only an ID, the display label must be resolved from the shell's switcher data; if the game is absent from that data, no chip renders. The result is ephemeral and never persisted to localStorage, cookies, database state, or server module globals.

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
| AC-03 | Persistent header renders on every route with brand link, global search, songs link, compact game switcher, and contextual back-to-game chip when game context is available. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-22 | Each primary route satisfies the M8 accessibility checklist: one H1, labeled landmarks, `aria-current`, table captions/headers, focus indicators, skip link, search label/live region, keyboard-operable disclosures, and an arrow-key navigable game switcher with `Enter`/`Space` selection and `Escape` close behavior. | `manual` / `test` |

---

3. **[TASK-03] Introduce persistent archive shell chrome** - Build `ArchiveShell`, persistent header landmarks, footer, skip link, responsive search trigger structure, shared shell data loader, game switcher grouping, client-only back-to-game context, and token-backed shell/badge consumption; leave live suggestions and roving keyboard behavior to `TASK-05`.
   `contracts: §4c-1, §4d-8, §4d-10, §4d-18, §4d-19` · `preserves: INV-03, INV-06, INV-08, INV-10, INV-15, INV-16, INV-20` · `validates: AC-03, AC-22`

---
