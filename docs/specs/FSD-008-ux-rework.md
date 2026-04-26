<!--
FSD-008: all sections fully populated across PM and architect passes.
-->

# FSD — Project ABE Milestone 8 — FSD-008-ux-rework
## UX Rework: Multi-Route Archive Companion

**Status:** Draft
**Accepted on:** —
**Consuming role:** Planner -> SPEC-NNN authorship
**Source basis:** See §7
**Confidence:** High

---

## 1. Scope and Purpose

### For the PM

Milestone 8 rebuilds the archive UX from a single-route overlay experience into a multi-route, search-enabled archive companion. The alpha fails at scale: rounds and players are buried behind memory-board moments, modal stacking happens in practice, the game switcher is congested at 19 games, and there is no coherent place for song search.

**Before:** one route (`/`), navigation via overlays and memory-board cards, no global search, warm editorial palette.
**After:** six stable shareable URLs (landing, game, round, songs, song, player); fixed round and submission lists on every page; persistent header with global search and game switcher; ML-adjacent purple palette with gold accent.

Profile guarantees on every primary surface:

- **Merit Competitor** — leaderboard above the fold, fixed round and submission lists, tied ranks shown as ties.
- **Discovery Curator** — `/songs` as home; familiarity signals on every surface; submission and vote comments preserved.
- **Social Ritualist** — comments first-class; player pages expose votes-given and votes-received; overlay stacks replaced by direct routes.

`DESIGN.md` is the binding contract for surface, route, derivation, and visual decisions. `MUSIC_LEAGUE_GAME_MODEL.md` is binding for entity semantics.

### For the Architect

**Workstreams** (each group begins after the prior; items within a group may parallelize):

1. **Foundation** — F1 (routes), F3 (tokens), F2 (header). All subsequent SPECs depend on these.
2. **Core read path** — F4 → F5 → F6. Primary daily-use sequence.
3. **Discovery** — F7, F8, F10, F16. Parallelizable with core read path once foundation is stable.
4. **Player surfaces** — F9, F11. Last; needs all other link targets to exist.
5. **Cross-cutting** — F12, F13, F14, F15 are contracts consumed by per-route SPECs; not standalone sprints.

**No-regression constraints:**
- M6 memory board derivations are preserved inside F5; wire existing output, do not rebuild.
- No schema changes required. `Game.finished` exists. Entity semantics unchanged.
- Alpha overlay routing code (R3) must be deleted, not dead-coded.

---

## 2. Feature Specifications

### F1 — Route Architecture

**Outcome:** Every primary surface has a stable, shareable URL; invalid routes degrade gracefully.

- Six routes: `/`, `/games/[id]`, `/games/[id]/rounds/[id]`, `/songs`, `/songs/[songId]`, `/players/[id]`. IDs are stable internal IDs.
- Invalid routes render a status notice with a link to the nearest valid context.
- Each route sets a meaningful `<title>` appropriate to its content; format and fallback are the architect's call.

---

### F2 — Persistent Header Chrome

**Outcome:** A header on every route containing brand wordmark, global search (F10), compact game switcher, songs link, and contextual back-to-game chip.

- Game switcher open state: currently-playing games as chips above a scrollable completed-games list.
- Back-to-game chip sourced from in-tab navigation state or `document.referrer`; no persistence across reloads or sessions.

---

### F3 — Visual System Rework

**Outcome:** ML-adjacent visual identity defined once in shared tokens, consumed consistently across all routes.

- Palette: deep purple primary, off-white surface, muted lavender secondary, warm gold accent, desaturated purple-grays for muted text, near-black ink.
- Preserve serif display and system sans-serif body stacks from the alpha.
- All subsequent feature SPECs consume palette tokens; no hardcoded values.

---

### F4 — Landing Page (`/`)

**Outcome:** Users immediately see which games are in progress and which are complete.

- Two bands: currently-playing cards with `Current` badge (source: `Game.finished === false`); past-games grid sorted newest-first with `Completed` badge.
- Each game card renders a timeframe per F14.
- Empty-archive state: explains archive is unavailable until a game is imported.
- **[Stretch]** Past-games grid caps at 100; "Show more" in batches of 50 and lightweight filters (year, winner-substring) appear once the grid passes 30. v1 SPEC must document the threshold and deferral decision if skipped.

---

### F5 — Game Page (`/games/[id]`)

**Outcome:** Every game page leads with leaderboard and fixed round list; the memory board is analytical, not navigational.

- Five sections in order: header (description + status badge); leaderboard above the fold (F12 tie-break); fixed round list (secondary `Playlist ↗` per row when `Round.playlistUrl` is present, per F15); memory board (analytical surface, sourced from M6 derivations, no navigation weight); competitive anchor (headline copy per DESIGN.md §6e for 1 / 2 / 3+ tied leaders).
- Unfinished games render provisional standings with explicit "in progress" label.

---

### F6 — Round Page (`/games/[id]/rounds/[id]`)

**Outcome:** Round content lives on its own page; vote evidence is inline per submission.

- Header with playlist pill (F15 when `Round.playlistUrl` present); optional highlights (max three, sourced from M6 derivations); full submissions list ordered by rank.
- Submission comments are displayed inline per row; not collapsed.
- Vote evidence: `Show N votes` / `Hide N votes` inline disclosure per submission row; `Expand all votes` affordance at list top.

---

### F7 — Song Browser (`/songs`)

**Outcome:** Users can search the archive by title or artist and filter/sort results from a shareable URL.

- Case-insensitive substring search over song title and artist name.
- Artist labels link to the filtered song browser at `/songs?q=<artist name>` in v1; no artist detail route is introduced.
- Familiarity filter: all / first-time / returning (per F16). Sort: most appearances, most recent, best finish, alphabetical.
- Filter and sort state carried as URL params.
- Empty-query view: 100 rows by most-recent appearance; `Showing 100 of N — refine your search` hint when catalog exceeds cap.
- When loaded with `?q=<query>` (entry point from F10), input is pre-populated and results filtered on mount. `q` is the canonical search state; F10 is a producer.

---

### F8 — Song Detail (`/songs/[songId]`)

**Outcome:** The alpha song overlay is promoted to a real route with full provenance context. Back navigation prefers the referrer, falling back to `/songs`.

- Title, artist, familiarity verdict (F16).
- Summary facts: first appearance, most recent appearance, appearance count, artist footprint, best finish.
- Origin labels; submission history grouped by game.

---

### F9 — Player Detail (`/players/[id]`)

**Outcome:** Any player reference anywhere in the product links to a real player page.

- Reachable from every leaderboard row, submission row, and vote row.
- Sections: header with aggregate context (specific aggregates — total points, games participated, rounds won, or similar — not defined here; SPEC proposes and confirms with PM); trait line (F11, threshold-gated); **[Stretch]** notable picks (DESIGN.md §11c — high derivation complexity, SPEC may defer); submission history grouped by game; votes-given table; votes-received table.
- Vote tables: comments shown inline; split-on-negatives display rule when negative votes exist; self-rows filtered out.
- Head-to-head W/L/D surface is explicitly rejected (DESIGN.md §11f); pairwise affinity belongs in the trait registry if needed.

---

### F10 — Global Search

**Outcome:** From any route, users can search the archive by song or artist without navigating away first.

- Persistent input in header on every route; case-insensitive substring match against normalized song title and artist. Normalization definition is the architect's call; must be consistent with F7.
- **[Stretch]** Live suggestions: up to ~8 mixed song/artist results with type chips. `/songs` covers the core need; suggestions are polish and may be deferred.
- Submit navigates to `/songs?q=<query>` (see F7).
- Keyboard: `/` focuses input; `Esc` clears suggestions.

---

### F11 — Trait Line Registry

**Outcome:** Player traits are drawn from a named registry with explicit thresholds; no ad-hoc inference.

- Every shipped trait has a registry entry (named identifier + numeric threshold); surfaces on `/players/[id]` only when threshold is met.
- v1 ships four traits: `consistent-finisher`, `frequent-commenter`, `high-variance-voter`, and `voting-twin-with-<name>` (resolved in §8).
- **[Stretch]** If capacity is constrained, SPEC may ship the registry scaffolding with zero enabled traits, adding traits post-launch without structural changes.

---

### F12 — Tie-Break Treatment

**Outcome:** Tied leaderboard rows render visibly as ties with a consistent, documented sort hierarchy.

- Tied rows: `T<rank>` prefix on rank pill. Sort hierarchy: total points → round wins → display name (alphabetical). Average points per round excluded as a tie-break.
- Accessible footnote names the hierarchy whenever ties are present.

---

### F13 — Accessibility and Keyboard Contracts

**Outcome:** Every route satisfies DESIGN.md §15; per-route SPECs include an a11y checklist referencing this contract, not re-deriving it.

- Structural: one H1 per route; `aria-current` on active nav; vote disclosures as `button[aria-expanded]`; table semantics (`<th scope>`, `<caption>`); labeled landmarks; skip-to-content link; focus indicators on all controls.
- Keyboard: `/` focuses search; disclosures toggle on `Enter`/`Space`; switcher is arrow-key navigable.

---

### F14 — Game Timeframe Derivation

**Outcome:** Game cards and headers show event-derived timeframes; ORM timestamps are never displayed.

- Primary: `min(Round.occurredAt)` to `max(Round.occurredAt)`.
- Fallback widening: `min(Submission.submittedAt)` / `max(Vote.votedAt)` when the round window collapses or is sparse.
- Any temporal spread renders as a range. `Game.createdAt`, `Game.updatedAt`, and analogous child-row columns are prohibited as timeframe sources.
- No usable event dates → timeframe omitted, not synthesized.

---

### F15 — Spotify Playlist Link Surfacing

**Outcome:** `Round.playlistUrl`, when present, surfaces as an outbound link on two surfaces; when null, no affordance appears.

- Round page header: `Open Spotify playlist ↗` pill (`target="_blank" rel="noopener"`).
- Round-list row on game page: secondary `Playlist ↗` link (same `target="_blank" rel="noopener"` behavior).
- `playlistUrl === null`: both affordances omitted — no disabled state, no placeholder.
- Spotify is outbound-link-only; no embedding, playlist metadata fetch, artwork render, or API call.

---

### F16 — Song Familiarity Verdict

**Outcome:** "First-time" and "returning" are defined and derived once so F7's filter and F8's display agree.

- **First-time:** exactly one submission record in the archive. **Returning:** two or more, across any games or rounds.
- Familiarity is a current archive-wide property of the song record, not a per-appearance attribute.
- Computation form (derived column, view, or query-time) is the architect's call; must be fast enough for F7's 100-row empty-query view without a separate request.

---

### Explicit Removals

**R1 — Nested modal stacking.** The alpha "round → song → player" overlay stack is replaced by route navigation. No nested dialogs.

**R2 — Memory board as primary navigation.** Cards may link to evidence but are no longer the only path to rounds, songs, or players.

**R3 — URL-addressable overlays.** `?round=`, `?song=`, `?player=`, `?playerSubmission=` overlays are retired; their replacements are real routes.

**R4 — Separate vote evidence section per round.** Replaced by per-submission inline disclosure.

**R5 — Legacy overlay URL params.** Retired params are silently ignored on any route (base route renders normally, not a 404). Overlay routing code must be deleted.

---

## 3. Explicit Exclusions

- **Album search** — no album field in the data model or CSV export; requires Spotify enrichment or a new import source. Separate spec.
- **Additional Spotify enrichment** beyond current CSV fields.
- **Authentication, accounts, per-user state** — single-tenant read-only archive.
- **Live submission, voting, or playlist management** — out of product posture (DESIGN.md §2).
- **Manual import-review UI** — import is a developer surface.
- **Artist detail route** (`/artists/[id]`) — artist is a filter and display string in M8; future milestone.
- **Player index route** (`/players`) — deferred; global search covers the navigation need.
- **localStorage persistence** for game switcher or back-to-game chip — in-tab state only.
- **Pagination beyond named caps** — virtualization deferred until ~10k songs.
- **Vote-budget, deadline, disqualification, platform-setting inferences** — prior milestone constraint, carried forward.
- **Genre, mood, audio-feature, recommendation, release-year surfaces** — prior milestone constraint, carried forward.

---

## 4. Cross-cutting Invariants

- **INV-routes-over-overlays:** Round, song, and player are always real routes. No SPEC may reintroduce overlay-based navigation for these entities.

- **INV-no-nested-modals:** No surface stacks two modal dialogs. Vote disclosure (F6) is the only permitted in-place disclosure pattern.

- **INV-ties-are-ties:** A game with tied leaders never claims a sole leader. Tied rows render as `T<rank>`.

- **INV-registry-only-traits:** Every player trait has a named registry entry with an explicit numeric threshold; no ad-hoc inference.

- **INV-no-orm-dates-as-timeframes:** `Game.createdAt`, `Game.updatedAt`, and analogous child-row columns never appear as a displayed timeframe. No usable event dates → omitted, not synthesized.

- **INV-token-system:** No surface hardcodes a palette value from the F3 token set; all are consumed via named tokens.

- **INV-single-derivation-path:** Computed values appearing on multiple surfaces (familiarity verdict, leaderboard rank, game timeframe) have exactly one derivation path; no surface re-derives them independently.

- **INV-game-finished-authoritative:** `Game.finished` is the sole source for current vs. completed status; no proxy field substitutes.

---

## 5. Gate Criteria

- Every primary surface named in F1 has a stable, shareable URL.
- The persistent header (brand, global search, game switcher, songs link) renders on every route.
- No route produces a nested modal; per-submission vote toggle is the only in-place disclosure.
- Every game page with at least one scored round renders a leaderboard above the fold; tied rows render as `T<rank>` with a tie-break footnote.
- `?round=X`, `?song=X`, `?player=X`, or `?playerSubmission=X` appended to any valid route URL does not open an overlay, alter content, or produce an error.
- A song shown as "Returning" in F7 shows "Returning" in F8; "First-time" in F7 matches "First-time" in F8.
- On the landing page, every game with `Game.finished === false` is in the Current band; every game with `Game.finished === true` is in the Completed band. No game appears in both; no game is absent from both.

---

## 6. Touched Boundaries

- **Routing layer** — Structural shift from single-route to six-route. Touches app entry point, existing navigation logic, and anything assuming a single rendered context.
  Primary surfaces: router config, app shell, URL structure, existing route/location utilities

- **Navigation shell** — New always-present UI layer (F2). Every route participates; cannot be opt-in.
  Primary surfaces: shell/layout component, game switcher state, in-tab navigation history

- **Design token system** — Full visual identity change (F3). Token definitions are the dependency; every surface stylesheet is a consumer.
  Primary surfaces: global token definitions, shared stylesheet, existing hardcoded alpha values

- **Text search and normalization** — New capability shared by F7 and F10. Normalization must be defined once; divergence between header search and song browser produces inconsistent results.
  Primary surfaces: song/artist search query, shared normalization utility

- **Per-route data fetching and aggregation** — Single-load alpha model breaks into distinct per-route query shapes: leaderboard aggregation, familiarity verdict, player vote tables, timeframe derivation, trait evaluation.
  Primary surfaces: per-route data loading, aggregation queries, existing single-load utilities

- **Alpha overlay code** — Deletion target. Removal must be complete: no dead handlers, no components conditionally rendering on retired params.
  Primary surfaces: overlay state management, query-param routing logic, dependent components

- **Memory board wiring** — M6 derivations survive unchanged in computation; role changes from navigation entry point to analytical section within F5. Wiring is in scope; derivation logic is not.
  Primary surfaces: game page layout (F5), M6 derivation output contracts

---

## 7. Provenance

- Planning session / era: 2026-04-26
- Source documents consulted:
  - `docs/specs/milestone_8_ux_rework.md` — primary source for features, exclusions, open questions, and sequencing
  - `docs/reference/DESIGN.md` — binding design contract for routes, surfaces, visual tokens, a11y, and component behavior
  - `docs/reference/DESIGN_alpha.md` — prior baseline; informs removals and what is promoted to routes
  - `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md` — entity semantics
  - `docs/pm/research/config/profiles.json` — participant profiles driving per-surface coverage requirements
  - `prisma/schema.prisma` — confirms `Game.finished` (Boolean, default `true`); confirms no album field on `Song`

---

## 8. Uncertainty and Open Questions

1. **Artist link in F7:** Display-only or link-to-filtered-search in v1? — **Resolution:** link-to-filtered-search in v1 via `/songs?q=<artist name>`; no artist detail route.
2. **Initial trait set (F11):** Which 3–5 traits ship? — **Resolution:** v1 ships `consistent-finisher`, `frequent-commenter`, `high-variance-voter`, and `voting-twin-with-<name>`. Thresholds and fixture plans are defined in `SPEC-008-ux-rework.md §4d-7`.
3. **F10 live suggestions:** v1 or follow-up? `/songs` covers the core need; suggestions are polish. → F10 SPEC.
4. **Header search under 720px (F2 / F10):** Collapse behind a `Search` trigger, or shrink inline input? DESIGN.md §14 is silent. → F2 / F10 SPEC.
