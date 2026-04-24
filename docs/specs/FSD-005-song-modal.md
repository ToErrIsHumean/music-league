# FSD — Music League Milestone 5 — FSD-005-song-modal
## Song Modal and Familiarity Cues

**Status:** Accepted
**Accepted on:** 2026-04-24
**Consuming role:** Planner -> SPEC-005 authorship
**Source basis:** See §7
**Confidence:** High — final PM/architect review complete

---

## 1. Scope and Purpose

### For the PM

User story: while scanning or revisiting league songs, a user can quickly tell
whether a pick is new to the group, connected through a familiar artist, or
returned from prior group memory, then open one dependable song detail surface
to see the people, rounds, and results that prove it.

Milestone 5 moves song memory earlier in the flow. Users should often know
"new to us, familiar artist, or brought back?" before tapping, then land in a
canonical detail surface when they want provenance. The payoff is faster
recognition, less low-value drill-in, and one dependable place to understand
how a song or artist already lives in group memory.

This milestone does not add global search. It sharpens the existing click path
and creates a stable song destination that future search can reuse.

### For the Architect

Execution workstreams:

1. **Canonical song surface** — replace round-scoped song detail with one
   archive-wide song memory surface. Entry points may retain origin context,
   but the song concept and core payload must be invariant.
2. **Reusable familiarity derivation** — compute one mutually exclusive verdict
   from exact-song history plus same-artist history, then reuse it for inline
   cues and the modal's above-fold answer.
3. **Evidence-first content model** — show a terse verdict, named people and
   moments, grouped history, and direct jumps to evidence rows.
4. **Exploration continuity** — preserve song, player, and round navigation
   without parallel song-detail modes or ambiguous return semantics.
5. **Future search compatibility** — keep song detail stable enough for later
   search-result entry, though M5 still opens mostly from contextual taps.
6. **Degraded-state resilience** — keep song detail intelligible when history
   is sparse, rank or score is missing, or origin context resolves imperfectly.

Done means users can often answer the recall question before tapping, and any
in-scope tap opens one canonical song detail that explains why the song feels
new, familiar, or brought back.

Story coverage: F1 supplies pre-tap recognition, F2 and F3 supply the
authoritative proof surface, F4 preserves exploration, and F5/F6 keep the
surface reusable and resilient without expanding milestone scope.

---

## 2. Feature Specifications

### F1 — Inline Familiarity Cue

**Outcome:** A user sees one compact familiarity signal before tapping a song,
making group memory legible at scan speed.

Requirements:

- Show cues on existing song-tap surfaces where pre-tap memory materially helps
  scanning. First priority is round detail.
- Secondary surfaces, such as player history or notable-pick views, may ship if
  the cue remains visually quiet. First release does not require cues on every
  song mention.
- Each song instance shows at most one cue.
- Cue vocabulary is people-centric and memory-centric, not performance-centric.
  It answers "how does this connect to our group?" rather than summarizing full
  history or score performance.
- First ship must distinguish at least true group debut, familiar artist with
  new song, and prior exact-song history. Example labels: `New to us`, `Known
  artist`, `Brought back`.
- Cues may use only canonical archive signals available for the song:
  exact-song history and same-artist history. Do not infer familiarity from
  genre, album, decade, mood, title similarity, or other non-key metadata.
- In v1, artist identity for same-artist history is the normalized exported
  artist display string represented by the canonical `Artist` row. Combined
  labels such as "Artist A & Artist B" are one display label, not parsed
  collaborator facts.
- No prior song-level or artist-level history means debut. Prior artist history
  without exact-song history means familiar-through-artist. Prior exact-song
  history may mean brought-back.
- When both song-level and artist-level familiarity apply, one cue wins based
  on the stronger social-memory signal; do not stack badges. Exact precedence
  is a SPEC-level locking decision in §8.
- Inline cue and modal verdict share one semantic classification model, even if
  copy or visual treatment differs.
- Cue computation must be lightweight enough for song rows and must not require
  the full song-detail payload.
- The same canonical song must not receive different familiarity states based
  on origin surface.

### F2 — Canonical Song Detail

**Outcome:** Any in-scope song tap opens one canonical detail experience that
explains why the song feels familiar, unfamiliar, or socially meaningful.

Requirements:

- Song detail is the canonical after-tap destination for group memory about a
  song. Do not preserve parallel song-detail modes with materially different
  meaning by context.
- The surface should feel authoritative, not like a temporary shell around a
  single current-row slice.
- The first visible content includes song identity and one deterministic
  familiarity verdict that synthesizes song-level and artist-level history.
- On open, the user can determine whether the exact song is new or returning,
  whether the artist is familiar, and through whom that familiarity was
  established.
- Above-fold content prioritizes named people and memorable moments over dense
  counts.
- When current-game context and archive context differ, name the current game
  first and treat broader archive memory as supporting context.
- Include, when known: first submitter, most recent submitter, exact-song
  submission count, artist familiarity footprint, and best exact-song finish.
- Artist familiarity is first-class; show whether the artist appeared through
  multiple songs, multiple submitters, or both.
- If song-level and artist-level familiarity diverge, say so plainly, e.g.
  "new song from a familiar artist."
- The modal may repeat the inline cue for continuity.
- If one prior submission comment materially aids recall, the summary may show
  one short excerpt as social evidence.
- A single-appearance song still opens a meaningful detail state.
- A song can be brand new while coming from a familiar artist; do not collapse
  those facts into one "new/repeat" label.
- A song and artist with no prior history should read as truly new to the group.
- Missing rank or score data must not block opening or known people/history
  context.
- Exact-song history is keyed by canonical song identity, not title-string
  coincidence inside the current round.
- Existing round-origin taps may remain a first-ship entry path, but they must
  hydrate archive-wide song memory.
- Within the supported import model, the same canonical song does not appear
  multiple times in one round. Song-detail contracts should not add product,
  fixture, or copy branches for same-song/same-round duplicates unless a future
  data-corruption spec explicitly opens that case.
- Header identity remains song plus artist. Origin-round context is provenance,
  not a competing song definition.
- Stable first-ship blocks are identity, verdict summary, evidence shortcuts,
  and submission history.
- The core verdict must be legible without tab switching, accordion expansion,
  or scrolling into history.
- Layout may use cards, sections, or another composition, but the surface
  should read as one coherent story.

### F3 — Submission History as Evidence

**Outcome:** After reading the summary, the user can inspect full provenance
without losing the main answer.

Requirements:

- Each submission is its own history row across rounds and games. Product data
  does not intentionally contain same-round duplicates with the same song and
  artist.
- Preserve submitter, round, and result for each specific submission.
- Default history order is newest first.
- When a song spans multiple games, preserve game grouping so current-game
  memory and broader archive memory remain distinguishable.
- Each row shows submitter, round, and result. Result uses rank first, with
  score as supporting context when available.
- The list is provenance evidence, not an analytics table; avoid filters and
  charts in first ship.
- Include current-context and broader-archive evidence when both exist, with
  current context foregrounded.
- Row identity is submission-level. If three people submitted the same song,
  the user sees three separate moments.
- Submission comments are optional recall evidence and should appear
  selectively, not mechanically on every row.

### F4 — Navigation and Exploration

**Outcome:** Song detail supports further browsing without fragmenting the
meaning of a song tap.

Requirements:

- From song detail, the user can move to the relevant submitter's Player Modal
  and the relevant Round Page.
- Links reinforce provenance: who made the song part of memory, and where it
  happened.
- Provide one-click jumps to the most relevant evidence so users can validate
  the summary without linear scrolling.
- Minimum must-ship shortcuts are first appearance and most recent appearance
  when those rows are distinct historical moments.
- Evidence shortcuts support verification; they are not a second information
  hierarchy.
- Song taps from round detail and player history converge on the same
  song-detail concept.
- M5 supersedes interim song views that expose only one player-scoped or
  round-scoped slice as the full song story.
- Users should not need to learn different song-tap meanings by origin surface.
- Player links should open the submitting player's modal in the round or game
  context that best explains the evidence row; the anchoring rule is locked in
  §8 before implementation dispatch.
- Round links should land on the referenced round, not a generic archive home.
- Song detail may link to players and rounds, but must not spawn alternate song
  subviews.

### F5 — Search Readiness Without Search Scope

**Outcome:** The song surface becomes a reusable lookup destination later
without forcing global search into M5.

Requirements:

- M5 improves contextual lookup from existing song taps.
- M5 does not require a global search bar, fuzzy matching, or instant-result
  dropdowns.
- Canonical song detail should be suitable as the future destination for search
  results.
- Prioritize stable meaning and first-open comprehension over origin-specific
  copy or one-off behavior.
- Future search should be able to open this same song detail with no semantic
  loss.
- If first ship relies on origin-round context for routing, shell behavior, or
  browser history, treat that dependency as an implementation convenience, not
  the product definition of a song.

### F6 — Availability and Degraded States

**Outcome:** The canonical song surface remains intelligible when history is
sparse, partial, or opened from stale context.

Requirements:

- A resolvable song identity opens even if rank, score, or comment data is
  incomplete.
- First meaningful paint is identity plus verdict; full history may hydrate
  later if the primary answer does not stall.
- If an origin tap no longer resolves, show a contained unavailable state
  rather than a broken nested shell.
- A single known submission is a complete song-detail case: who brought it,
  where it appeared, and whether the artist is otherwise familiar.
- A song with no prior song or artist history reads as a clean debut state, not
  as missing data.
- Absence of comments removes texture, not structure; empty comment chrome is
  out of scope.
- Same-song repeats across rounds remain separate evidence rows. Same-round
  song+artist duplicates are not expected product data.
- Re-opening the same song from different origin surfaces converges on the same
  canonical answer, even if surrounding navigation context differs.

---

## 3. Explicit Exclusions

- Global search, fuzzy matching, and instant results.
- Recommendation, similarity matching, or "you might also like" behavior.
- External metadata enrichment from Spotify or other third-party APIs.
- Charts, score timelines, or analytics-heavy song dashboards.
- Vote-by-vote breakdowns or scoring explainers inside song detail. Song detail
  may link to round-level vote evidence when an active round-detail contract
  provides it, but it must not duplicate or reinterpret that evidence locally.
- First-release familiarity cues on every song mention across the product.
- Multiple simultaneous familiarity badges on one song instance.
- Merge or deduplication tooling; M5 consumes canonical song identity rather
  than solving data cleanup.

---

## 4. Cross-Cutting Invariants

- **INV-CANONICAL-SONG:** Every in-scope song tap resolves to the same canonical
  song-detail concept. Origin context may affect return behavior or evidence
  foregrounding, but it must not redefine the opened song.
- **INV-FAMILIARITY-MODEL:** Inline cues and modal verdicts share one mutually
  exclusive familiarity classification derived only from exact-song history and
  same-artist history.
- **INV-ONE-CUE:** A song instance shows at most one familiarity cue. The
  milestone must distinguish true group debut, familiar artist with new song,
  and brought-back exact song.
- **INV-ABOVE-FOLD-ANSWER:** The modal's first visible content includes song
  identity plus deterministic familiarity verdict. The core answer cannot
  require tab switching, accordion expansion, or scrolling into history.
- **INV-EVIDENCE-ROWS:** Submission history remains submission-level evidence.
  Duplicate appearances, including same-song repeats inside one round, are
  separate rows rather than song-level rollups.
- **INV-CURRENT-CONTEXT:** When an origin game or round is known and broader
  archive evidence exists, foreground the current context without hiding
  broader archive memory.
- **INV-NAVIGATION-CONTINUITY:** Player and round links from song detail
  reinforce provenance and must not create alternate song-detail modes.
- **INV-SEARCH-DEFERRED:** M5 may prepare the song surface for future search,
  but it does not ship global search, fuzzy matching, or instant results.
- **INV-DEGRADED-OPENABILITY:** A resolvable song identity opens when rank,
  score, or comment data is missing. Missing optional data removes detail, not
  the surface.

---

## 5. Gate Criteria

- A priority song-tap surface, initially round detail, shows at most one compact
  familiarity cue per song instance where the cue materially helps scanning.
- Familiarity derivation distinguishes no known song or artist history,
  same-artist history without exact-song history, and prior exact-song history.
- Inline cue and modal verdict use the same semantic classification for the
  same canonical song, regardless of origin surface.
- Any in-scope song tap opens archive-wide canonical song detail, not a
  current-round row or current-player slice.
- On open, the modal shows song title, artist, and concise familiarity verdict
  above the fold. When known, it also surfaces first submitter, most recent
  submitter, exact-song submission count, artist familiarity footprint, and
  best exact-song finish without competing with the verdict.
- Submission history is visible as provenance evidence, newest first by
  default, preserving game grouping when a song spans games.
- Each history row identifies submitter, round, and result; rank is primary and
  score is supporting context when available.
- First appearance and most recent appearance are direct evidence shortcuts
  when they are distinct historical moments.
- Player links from history evidence open the relevant submitter context, and
  round links land on the referenced round.
- Sparse cases render meaningful detail states: one known submission, no prior
  artist history, missing rank or score, and absent comments remain
  intelligible.
- Unresolved or stale origin taps fail to a contained unavailable state, not a
  broken nested modal shell.
- The milestone ships without global search, fuzzy matching, external metadata
  enrichment, recommendations, charts, vote-by-vote explainers, or multiple
  simultaneous familiarity badges.

---

## 6. Touched Boundaries

- **Archive song data query** — `getSongRoundModal` currently hydrates a
  round-origin song detail from `src/archive/archive-utils.js`. M5 needs a
  canonical song-detail query that gathers exact-song history, same-artist
  history, submitters, rounds, results, useful comments, and current-origin
  foregrounding from one canonical song identity.
- **Familiarity derivation** — add reusable derivation over canonical song
  identity, exact-song submission history, and same-artist history. It must be
  callable from lightweight song rows and from the full modal payload.
- **Archive round detail UI** — `src/archive/game-archive-page.js` currently
  renders round submissions and a nested round-scoped song modal. M5 touches
  song row cues, canonical modal rendering, evidence shortcuts,
  submission-history grouping, degraded states, and outbound player/round links.
- **Player-modal song path** — M4 introduced a player-scoped song push view.
  M5 supersedes that interim meaning for in-scope canonical song taps while
  preserving player navigation continuity.
- **Routing and browser state** — the existing archive route uses query
  parameters such as `round`, `song`, `player`, and `playerSubmission` for
  nested state. M5 may continue origin-aware routing initially, but origin
  context is provenance and return behavior, not song identity.
- **Canonical data model consumption** — M5 consumes existing canonical `Song`,
  `Artist`, `Submission`, `Player`, `Round`, and `Game` relationships. It does
  not introduce external metadata sources or deduplication tooling.
- **Fixture and verification data** — downstream SPEC work should cover true
  debut, familiar-artist/new-song, exact-song repeat, cross-game history,
  missing rank/score, absent comments, and stale or unresolvable origin
  handling. Same-round song+artist duplicates are not expected product data.

---

## 7. Provenance

- Planning session / era reconstructed: 2026-04-22
- Source documents consulted:
  - `docs/specs/milestone_5_song_modal.md` — original history-and-lookup
    handoff that this FSD narrows and reframes
  - `src/archive/archive-utils.js` and `src/archive/game-archive-page.js` —
    current round-scoped song modal/query-param flow that M5 should subsume
- Decision logs or companion notes consulted:
  - current PM pressure-test thread — established the hybrid direction:
    familiarity cues before tap, canonical full song detail after tap, and no
    search scope in M5

---

## 8. Uncertainty and Open Questions

These are SPEC-level locking decisions, not feature-scope uncertainty. Resolve
them before implementation dispatch.

- Exact cue labels and priority order remain unlocked, though the vocabulary is
  constrained to a small mutually exclusive set.
- `round detail` is the first priority cue surface; whether `player history`
  also ships first should be confirmed before SPEC authorship.
- Cross-game history must preserve provenance, but default expansion/collapse
  behavior is unsettled.
- If a song has both deep artist familiarity and prior exact-song history, cue
  precedence and threshold language remain unresolved; M5 establishes that one
  cue wins.
- First ship likely reuses origin-aware archive routes; whether M5 should add a
  more song-centric locator now or later remains open.
- Player-link anchoring is not locked: preserve current origin context, jump to
  the row's round, or use a game-level player view that reconciles both.
- Evidence shortcuts are required in spirit, but their affordance is a SPEC
  choice: scroll jumps, compact chips, or equivalent lightweight controls.
