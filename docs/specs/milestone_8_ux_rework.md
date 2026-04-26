# Milestone 8 — UX Rework

**Status:** Draft
**Created on:** 2026-04-26
**Design contract:** `docs/reference/DESIGN.md`
**Prior baseline:** `docs/reference/DESIGN_alpha.md`
**Reference model:** `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md`
**Profiles driving design:** `docs/pm/research/config/profiles.json`

---

## 1. Purpose

Milestone 8 rebuilds the archive UX from a single-route, overlay-driven
experience into a multi-route, search-enabled archive companion. The redesign
is motivated by emergent failures of the alpha at archive scale: rounds and
players are reachable only through derived memory moments, modal stacking
happens in practice, the game switcher is congested at 19 games, and there is
nowhere coherent to put a searchable song browser.

This document inventories the feature-level changes a SPEC author must specify
and ship to land that redesign. Implementation choices are intentionally left
out — the SPECs (and PLANs) carry those.

This milestone consumes a fully ratified design (`DESIGN.md`) rather than
iterating one. SPEC authors should treat `DESIGN.md` as the binding contract
for surface, route, derivation, and visual decisions, and treat
`MUSIC_LEAGUE_GAME_MODEL.md` as the binding contract for entity semantics.

---

## 2. Guiding Principles

1. **Routes over overlays.** Every primary surface has a shareable URL. Modals
   survive only as in-place disclosures within a page.
2. **Foreground navigation, demote derivation.** Fixed lists (rounds,
   submissions) are always present; the memory board returns to being analysis,
   not navigation.
3. **Search as discovery.** A persistent global search and a dedicated song
   browser answer the recurring "have we already done this?" question.
4. **Brand affinity without imitation.** The visual identity moves toward
   Music League's purple, with gold accent and serif display as the
   differentiators.
5. **One profile is not the whole product.** Every primary surface remains
   legible to Merit Competitors, Discovery Curators, and Social Ritualists.
6. **Less ceremony.** No nested dialogs, no overlay-as-page metaphor, no
   stacked back actions.

---

## 3. User Story Alignment

> A user opens the app and sees the games in progress front-and-center. They
> jump into any round of any game in one click — no hunting through derived
> insights. From any context, they can search the archive for a song or
> artist before deciding what to submit. Returning to a player's full
> history, votes given, and votes received takes one click from any leaderboard
> or vote row. The experience reads as a Music League companion, not a generic
> music dashboard.

Profile coverage:

- **Merit Competitor** — leaderboard above the fold on every game page,
  intelligible round-level results, fixed round and submission lists, tied
  ranks shown as ties.
- **Discovery Curator** — `/songs` is their home page; familiarity signals
  carry through every surface; submission and vote comments preserved.
- **Social Ritualist** — comments stay first-class; player pages add
  votes-given and votes-received tables that make group dynamics legible;
  navigation friction drops because routes replace modal stacks.

---

## 4. Architectural Shift

This milestone is a structural redesign, not a polish pass. The shift can be
characterized as:

| Aspect | Alpha posture | Milestone 8 posture |
| --- | --- | --- |
| Routes | One (`/`) with URL-addressable overlays | Multi-route: landing, game, round, songs, song, player |
| Navigation | Overlays opened from memory moments | Fixed lists on every page; persistent header chrome |
| Modals | Round, song, and player modals; nesting permitted | No nested modals; in-place disclosures only |
| Search | None | Global search in header + `/songs` browser |
| Visual identity | Warm, editorial paper / brick red | ML-adjacent purple, off-white, gold accent |
| Memory board role | Primary navigation surface | Analytical surface; navigation lives elsewhere |
| Vote evidence | Separate section per round | Inline disclosure per submission |
| Player access | Modal opened from a few entry points | Real route reachable from any player reference |

SPECs must respect this shift consistently. A SPEC that re-introduces overlay
nesting, treats the memory board as the navigation surface, or omits
persistent chrome is out of contract.

---

## 5. Required Feature Changes

Features are grouped into foundation, per-route surfaces, cross-cutting
concerns, and explicit removals. Each feature is a candidate SPEC unit;
adjacent features may be combined into one SPEC where the design contract is
small.

### 5a. Foundation

These features are prerequisites for the per-route surfaces. They should ship
first.

**F1 — Route architecture.**
Establish the multi-route map defined in DESIGN.md §3: landing, game, round,
song browser, song detail, player detail. Invalid routes degrade in place with
a status notice and a link to the nearest valid context. Route IDs are stable
internal IDs.

**F2 — Persistent header chrome.**
A header rendered on every route, containing brand wordmark, global search
(F10), compact game switcher, songs link, and the back-to-game chip described
in DESIGN.md §4. The switcher's open state buckets currently-playing games as
chips above a scrollable list of completed games. The back-to-game chip is
sourced from in-tab navigation state or `document.referrer`; persistence
across reloads or sessions is explicitly out of scope.

**F3 — Visual system rework.**
Adopt the palette and surface contracts of DESIGN.md §13: deep ML-adjacent
purple primary, off-white surface paper, muted lavender secondary surface,
warm gold accent (the differentiator from official ML branding), desaturated
purple-grays for muted text, near-black ink. Preserve the serif display stack
and the system sans-serif body stack from the alpha. Tokens must be defined
once and consumed consistently across all subsequent feature SPECs.

### 5b. Per-Route Surfaces

These features are independently SPEC-able once foundation lands. Several may
be parallelized.

**F4 — Landing page (`/`).**
Two-band layout per DESIGN.md §5: currently-playing games as prominent cards
with `Current` badges (sourced from `Game.finished === false`), and past
games as a card grid sorted newest-first with `Completed` badges. Past-games
grid renders up to 100 cards before invoking a "Show more" affordance in
batches of 50; lightweight filters (year, winner-substring) appear once the
grid passes 30 cards. Empty-archive state explains that the archive is
unavailable until a game is imported.

**F5 — Game page (`/games/[id]`).**
Five-section structure per DESIGN.md §6: header (with description and status
badge), leaderboard above the fold, fixed round list, memory board, and
expanded competitive anchor. Leaderboard tie-break treatment per F12.
Competitive anchor headline copy follows the patterns in DESIGN.md §6e for 1,
2, and 3+ tied leaders. Provisional standings render for unfinished games
with explicit "in progress" labeling. The memory board is preserved as an
analytical surface but no longer carries navigation weight. Round list rows
expose a secondary outbound `Playlist ↗` link when `Round.playlistUrl` is
present, per F15.

**F6 — Round page (`/games/[id]/rounds/[id]`).**
Replaces the alpha round overlay with a real page per DESIGN.md §7. Header,
optional highlights (max three), and a full submissions list ordered by rank.
Vote evidence is inline disclosure per submission (DESIGN.md §7d) — `Show N
votes` / `Hide N votes` per row, with an `Expand all votes` affordance at the
top. The previous separate vote-evidence section is retired. Header surfaces
the playlist as a real outbound pill when `Round.playlistUrl` is present,
per F15.

**F7 — Song browser (`/songs`).**
Full-text search over song title and artist name per DESIGN.md §8 and §10.
Filters (familiarity: all / first-time / returning) and sort (most
appearances, most recent, best finish, alphabetical) carried as URL params for
shareability. Empty-query view caps at 100 rows sorted by most-recent
appearance, with a visible `Showing 100 of N — refine your search` hint when
the catalog exceeds the cap.

**F8 — Song detail (`/songs/[songId]`).**
Port the alpha song memory overlay to its own route per DESIGN.md §9. Title,
artist, familiarity verdict, summary facts (first appearance, most recent
appearance, exact-history count, artist footprint, best finish), origin
labels, and submission evidence grouped by game. Back navigation prefers the
referrer, falling back to `/songs`.

**F9 — Player detail (`/players/[id]`).**
A real route per DESIGN.md §11, reachable from every leaderboard row, every
submission row, and every vote row. Sections: header with aggregate context,
trait line (sourced from F11), notable picks with explicit tie-break rules
(DESIGN.md §11c), submission history grouped by game, votes-given table
(DESIGN.md §11e), votes-received table. Both vote tables apply the
split-on-negatives display rule when negative votes exist in the data, and
filter out self-rows. A structural head-to-head W/L/D surface is explicitly
rejected (DESIGN.md §11f); pairwise affinity, if needed, lives in the trait
registry.

### 5c. Cross-Cutting Concerns

These features touch multiple routes. They may be SPEC'd alongside the route
that first depends on them or as standalone units.

**F10 — Global search.**
Persistent search input in the header per DESIGN.md §10. Match scope: case-
insensitive substring against normalized song title and normalized artist
name. Live suggestions surface up to ~8 mixed song/artist results with type
chips. Submitting navigates to `/songs?q=<query>`. Keyboard: `/` focuses the
input from any non-typing context; `Esc` clears suggestions. Album search is
deferred (see §7 Out of Scope).

**F11 — Trait line registry.**
A small named registry of player traits with explicit numeric thresholds, per
DESIGN.md §11b. Traits surface on `/players/[id]` only when their threshold
is met. Ad-hoc trait inference is not permitted — every trait shipped must
have a registry entry. Initial trait set should be small (3–5 traits is a
reasonable v1).

**F12 — Tie-break treatment.**
Shared `T<rank>` prefix on the rank pill for tied rows per DESIGN.md §6b. Sort
hierarchy for displayed order when ties exist: total points → round wins →
display name (alphabetical). Average points per round is explicitly excluded
as a tie-break. An accessible footnote names the tie-break hierarchy when ties
are present in the displayed table.

**F15 — Spotify playlist link surfacing.**
`Round.playlistUrl` is exposed as a real outbound link on two surfaces per
DESIGN.md §6c and §7a: an `Open Spotify playlist ↗` pill in the round page
header, and a secondary `Playlist ↗` link per round-list row on the game
page. Both open in a new tab (`target="_blank" rel="noopener"`). When
`playlistUrl` is null, both affordances are omitted entirely — no disabled
state, no placeholder copy. Spotify is treated as outbound navigation only;
the archive does not embed a player, fetch playlist metadata, render
artwork, or call any Spotify API as part of this work.

**F14 — Game timeframe derivation.**
The timeframe shown on every game card (`/`) and every game header
(`/games/[id]`) is derived from imported event timestamps per DESIGN.md §5d.
Primary source: `min(Round.occurredAt)` to `max(Round.occurredAt)`. Fallback
widening uses `min(Submission.submittedAt)` and `max(Vote.votedAt)` when the
round-only window collapses or is sparse. Always render as a range when any
temporal spread exists, even short spans. ORM and import-bookkeeping
timestamps (`Game.createdAt`, `Game.updatedAt`, and the analogous columns
on child rows) must not be used as a displayed timeframe. When no usable
source event dates exist for a game, the timeframe is omitted rather than
synthesized.

**F13 — Accessibility & keyboard contracts.**
Per DESIGN.md §15: one H1 per route, `aria-current` on active nav, vote
disclosures rendered as `button` elements with `aria-expanded`, table semantics
(`<th scope>`, `<caption>`), labeled landmarks, skip-to-content link, focus
indicators on all controls. Keyboard contracts: `/` focuses search,
disclosures toggle on `Enter`/`Space`, switcher dropdown is arrow-key
navigable. Each per-route SPEC must include an a11y checklist that satisfies
this contract; F13 is the source of truth, not an additional implementation
SPEC.

### 5d. Explicit Removals

Each removal is named so SPEC authors do not accidentally preserve alpha
behavior.

**R1 — Nested modal stacking.**
The alpha's "round → song → player → player-scoped song" stack is dissolved
into route navigation. SPECs must not reintroduce nested dialogs.

**R2 — Memory board as primary navigation.**
Memory board cards may link to evidence, but are no longer the only path to
rounds, songs, or players. Round and submission lists are now the primary
navigation surface for those entities.

**R3 — Round, song, and player as URL-addressable overlays.**
The `?round=`, `?song=`, `?player=`, and `?playerSubmission=` query-state
overlays from the alpha are retired. Their replacements are real routes.

**R4 — Separate vote evidence section per round.**
Replaced by per-submission inline disclosure. The duplicated submission/vote
header structure of the alpha is gone.

---

## 6. Sequencing Notes

A reasonable build order:

1. **Foundation first.** F1 (routes), F2 (chrome), F3 (visual tokens) ship
   before any per-route SPEC. Chrome and tokens are referenced by every
   subsequent feature; routes are the substrate.
2. **Core read path next.** F4 (landing) → F5 (game) → F6 (round). This is
   the primary daily-use path and unblocks the visible value of the redesign.
3. **Search and discovery in parallel.** F7 (song browser), F8 (song detail),
   F10 (global search) form a coherent unit; they may be one SPEC or two
   adjacent SPECs.
4. **Player surfaces last.** F9 (player page) depends on F11 (trait registry)
   and on every other surface existing as a link target. Shipping it last
   means it can absorb any contract surprises from earlier features.
5. **Cross-cutting all along.** F12 (tie-breaks), F11 (trait registry), and
   F13 (a11y) are not standalone milestones; their contracts are consumed by
   the per-route SPECs. SPEC authors should reference these contracts rather
   than re-deriving them.

The "Show more" / filter affordances on the past-games grid (F4) and the
referenced 100-cap heuristics on `/songs` (F7) are scale-thresholds, not
v1-launch features. They may be deferred to follow-up SPECs once the corpus
demands them, provided the v1 SPEC documents the threshold and the chosen
deferral.

---

## 7. Out of Scope

The following are explicitly out of scope for Milestone 8. They are listed to
preempt scope drift; each may be opened by a later milestone with its own
contract.

- **Album search.** The data model does not carry album, and the Music League
  CSV export does not provide it. Adding album search requires either a
  Spotify enrichment pass or a new import source. Both decisions belong to a
  separate spec.
- **Spotify enrichment** for any field beyond what the CSV export already
  provides.
- **Authentication, accounts, per-user state.** The product remains a
  single-tenant read-only archive.
- **Live submission, voting, or playlist management.** Out of product
  posture per DESIGN.md §2.
- **Manual import-review UI.** Import remains a developer surface.
- **Artist detail route.** Artist is a search filter and a display string in
  M8. A future `/artists/[id]` route may be added by a later milestone.
- **Player index route (`/players`).** Deferred — global search is expected
  to cover the navigation need. Add only if usage shows otherwise.
- **Persistent localStorage session memory** for the game switcher. The
  back-to-game chip is in-tab only by design.
- **Pagination beyond the named caps.** Virtualization is deferred until the
  corpus crosses approximately 10k songs.
- **Vote-budget, deadline, disqualification, and other source-platform
  setting inferences.** Carried over from prior milestone constraints.
- **Genre, mood, tempo, audio-feature, recommendation, or release-year
  surfaces.** Carried over from prior milestone constraints.

---

## 8. Acceptance Criteria

Milestone-level acceptance. Per-feature acceptance lives in each SPEC.

- Every primary surface (landing, game, round, song browser, song detail,
  player detail) has a stable, shareable URL.
- The header is present on every route with brand, global search, game
  switcher, songs link, and (when applicable) the back-to-game chip.
- Landing splits unfinished games (`Current`) from completed games
  (`Completed`); bucketing reads `Game.finished` directly.
- Game pages render the leaderboard above the fold and a fixed round list as
  structural elements, regardless of memory-board content.
- Tied leaderboard rows render as `T<rank>` with the F12 sort hierarchy and
  an accessible tie-break footnote.
- Round pages replace the alpha round overlay; vote evidence appears as
  inline per-submission disclosure with an `Expand all` affordance.
- The song browser supports search by title and artist, familiarity and sort
  filters as URL params, and the empty-query 100-cap with refine hint.
- Song detail and player detail are real routes; player detail exposes
  votes-given and votes-received tables with the split-on-negatives rule.
- Trait line entries surface only when registry thresholds are met; no
  ad-hoc trait inference is shipped.
- The visual palette (purple primary, off-white surface, gold accent, muted
  purple-grays, near-black ink) is consumed via shared tokens across all
  routes.
- No surface introduces nested modals; vote disclosure is the only permitted
  in-place disclosure pattern.
- Each per-route SPEC's acceptance includes the F13 a11y checklist.
- Game cards and game headers render timeframes derived from event
  timestamps (`Round.occurredAt` with submission/vote fallback widening),
  not ORM or import-bookkeeping timestamps; true ranges always render as
  ranges; games with no usable source event dates omit the timeframe.
- Where `Round.playlistUrl` is present, the round page header and the
  round-list row both surface it as a real outbound link opening in a new
  tab; rounds without a playlist URL show no pill and no row affordance.
- An archive with at least one currently-playing game and at least one
  completed game is screenshot-coherent at every primary surface.

---

## 9. Open Questions

1. Should F7 (song browser) ship with artist-as-link-to-filtered-search in
   v1, or is artist initially display-only? DESIGN.md §8c notes the link
   target is deferred; the SPEC should commit one way.
2. Initial set of named traits in F11 — which 3–5 traits ship in v1?
   Candidates: `high-variance-voter`, `frequent-commenter`,
   `consistent-finisher`, `voting-twin-with-<name>`. Each requires a fixture
   plan and a numeric threshold.
3. Whether F10 (global search) live-suggestions are a v1 feature or a
   follow-up. The dedicated `/songs` page covers the search need; the
   suggestion dropdown is a polish.
4. Header behavior under 720px (DESIGN.md §14): does global search collapse
   behind a `Search` text trigger, or does it remain an inline input with a
   shrunk placeholder? The design contract leaves this open.

---

## 10. Dependencies

- **Milestone 1** — data model is the source of truth for entities.
- **Milestone 2** — import pipeline produces the snapshots the redesign
  consumes; no schema additions are required by M8 itself.
- **Milestone 6** — league overview / memory board derivations are preserved
  and surfaced inside the new game page (F5). Insight contracts established
  in M6 carry forward unchanged.
- **In-flight game-metadata import** — `Game.finished` already exists in
  schema with default `true`. The redesign reads this field directly. No new
  schema work is required.
- **MUSIC_LEAGUE_GAME_MODEL.md** — entity semantics are unchanged. SPECs must
  not reinterpret game / round / submission / vote / player / song meanings.

---

## 11. Out-of-Contract Behaviors to Reject in Review

A SPEC, PLAN, or implementation that does any of the following is out of
Milestone 8 contract and must be revised before merge.

- Reintroduces overlay-based navigation for round, song, or player.
- Uses the memory board as the only path to a round.
- Stacks two modals.
- Adds an unnamed ad-hoc player trait.
- Withholds a leaderboard from a game with at least one scored round.
- Hides tied leaders behind a single sole-leader claim.
- Persists switcher state to localStorage.
- Introduces album, genre, audio-feature, or recommendation surfaces.
- Renders the past-games grid or `/songs` empty-query view without the
  documented caps and hints.
- Replaces inline vote disclosure with a separate vote-evidence section per
  round.
- Uses ORM `Game.createdAt` / `Game.updatedAt` (or any other import-
  bookkeeping timestamp) as a game card or game header timeframe, or
  synthesizes a fake range when no event dates are available.
- Collapses a true event-date range into a single date for display
  (e.g. renders `Apr 12` for a game that actually spans `Apr 12 – Apr 19`).
- Embeds a Spotify player, fetches playlist metadata, renders Spotify
  artwork, or calls any Spotify API as part of round playlist surfacing —
  the contract is outbound-link-only.
- Renders a disabled-state playlist pill or "no playlist" placeholder when
  `Round.playlistUrl` is null; the affordance is omitted entirely.

---

## 12. Provenance

- `docs/reference/DESIGN.md` — the binding design contract for this
  milestone.
- `docs/reference/DESIGN_alpha.md` — the prior baseline this milestone
  supersedes.
- `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md` — entity semantics precedence.
- `docs/pm/research/config/profiles.json` — the participant profiles whose
  coverage is required on every primary surface.
- `prisma/schema.prisma` — confirms `Game.finished` exists as a Boolean with
  default `true`, and confirms the absence of an album field on `Song`
  (driving the album-search deferral in §7).
