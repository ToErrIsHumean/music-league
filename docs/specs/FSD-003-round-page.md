# FSD — Music League Milestone 3 — FSD-003-round-page
## Game Browser and Round Detail Surface

**Status:** Draft
**Consuming role:** Planner -> SPEC-003 authorship
**Source basis:** See §5
**Confidence:** High

---

## 1. Scope and Purpose

### For the PM

Milestone 3 is the first consumer-facing browsing surface that turns imported
league data into something a user can actually move through. The corrected
mental model is not "find a round in isolation." It is "see every game, scan
the rounds inside each game, and open a round when you want the full story."

The product shift is from "the system contains round data" to "the user can
browse league history in a structure that matches how the source data is
organized." This milestone should make the archive legible: game first, rounds
second, details on demand.

### For the Architect

This milestone defines a two-level browsing experience:

1. a game-level discovery surface that displays every game
2. a per-game round summary collection
3. an openable round-detail surface that can be implemented as a modal or a
   dedicated page, so long as the interaction contract stays stable

Done means a user can browse all games, understand which rounds belong to each
game, open any round's details, and read a complete round breakdown without
encountering identity ambiguity or broken context. Unique game IDs and unique
round IDs eliminate idempotency ambiguity at the product-contract level; this
milestone should treat those identifiers as stable facts, not derived guesses.

---

## 2. Refined User Stories

### US1 — Browse the archive by game

As a league participant or viewer, I want to see every game in the archive so I
can understand the full set of playable history instead of relying on isolated
round links.

### US2 — Understand a game's rounds quickly

As a user looking at a game, I want to see the rounds that belong to it as
compact summaries so I can understand the shape of that game without opening
every round one by one.

### US3 — Open a round when it becomes interesting

As a curious user, I want each round summary to open into a fuller round-detail
view so I can move from overview to detail at the moment I want more context.

### US4 — Revisit a round as a coherent moment

As a user inside round detail, I want to see the theme, submissions, and
outcome in one readable flow so I can experience that round as a complete
moment in league history.

### US5 — Explore outward without losing orientation

As a user following interesting songs or players, I want to drill into song and
player detail from round detail without losing my game-and-round context.

### US6 — Trust identity and structure

As a product team member or user, I want games and rounds to be represented
with their real unique IDs and parent-child relationship so browsing, linking,
and future execution do not rely on inferred grouping rules.

### Story synthesis

Together, these stories define Milestone 3 as a browse-and-open flow: discover
by game, scan by round, then expand into a round detail surface that supports
deeper exploration.

---

## 3. Feature Specifications

### F1 — Game-First Discovery Surface

**Outcome:** A user can browse every game in the dataset from one coherent
entry surface.

#### F1.1 Game coverage

- The milestone displays every game available in the dataset.
- Games are presented as first-class browseable entities, not as incidental
  metadata attached to rounds.
- The browsing surface must make it obvious that rounds are grouped under
  games.

#### F1.2 Game identity

- Each displayed game must be backed by a stable unique game ID.
- The UI may display a human-readable game label, title, or fallback identifier
  depending on available source data.
- Missing optional game metadata must not prevent the game from appearing in
  the browse surface.

### F2 — Per-Game Round Summary Collection

**Outcome:** Within each game, a user can quickly scan the rounds that belong
to that game and decide which one to open.

#### F2.1 Round grouping

- Every displayed round must appear within its parent game's section or group.
- A round belongs to exactly one game in the browsing model.
- The product must not flatten rounds from different games into one
  undifferentiated list.

#### F2.2 Round summary content

- Each round is represented by a lightweight summary item.
- A round summary must include the round's primary identity, such as name or
  theme.
- A round summary may include compact contextual fields such as date, winner,
  placement signal, or submission count when available.

#### F2.3 Ordering

- Rounds within a game must use a deterministic order.
- The downstream SPEC should choose the ordering source from stable round data,
  such as explicit sequence, created date, or imported order.
- Different games may share similar round names without creating ambiguity,
  because identity is anchored by parent game and unique round ID.

### F3 — Round Open Interaction

**Outcome:** A user can move from round summary to full round detail with a
stable, low-friction interaction.

#### F3.1 Open affordance

- Each round summary can be opened into a round-detail surface.
- The open action should feel lightweight and intentional rather than like a
  context switch into a different part of the product.

#### F3.2 Surface flexibility

- The round-detail surface may be implemented as a modal or as a dedicated
  page.
- The FSD leaves the presentation choice open, but the behavioral contract is
  fixed: open a specific round, show complete detail, and allow the user to
  return to game-level browsing cleanly.

#### F3.3 Deep-linking requirement

- Even if round detail is implemented as a modal, a specific round should still
  be addressable by a stable route or URL state.
- Direct entry to a specific round must remain possible.
- The product must not make round detail reachable only from prior in-app
  clicks.

### F4 — Round Detail Content

**Outcome:** Opening a round reveals a complete, readable representation of
that round as a cohesive league moment.

#### F4.1 Identity header

- Round detail must display the round name or theme.
- Round detail should show parent game context clearly enough that the user
  knows which game the round belongs to.
- Round detail may display optional metadata such as date or winner when
  available.

#### F4.2 Lightweight highlights

- Round detail should surface 2 to 3 quick-scan highlights when sufficient data
  exists.
- Supported highlight types include winner, lowest-scoring song, and one
  notable edge case or memorable anomaly.
- Highlights are supportive context, not a substitute for the submission list.

#### F4.3 Full submission list

- Round detail displays the full submission list for the round.
- Each submission row displays song name, artist, player, and score or rank
  when available.
- The list should read as a complete artifact of the round, not a truncated
  preview.

#### F4.4 Ordering and readability

- When rank is available, submissions should appear in rank order.
- When rank is unavailable, the downstream SPEC must define a deterministic
  fallback ordering rule.
- The detail view should remain vertically scannable and easy to read without
  filters, tabs, or analytics-heavy framing.

### F5 — Context-Preserving Exploration

**Outcome:** A user can branch from a round into related entities without
losing orientation.

#### F5.1 Song drill-in

- Clicking a song from round detail opens the Song Modal.
- Song drill-in should not sever the user's connection to the underlying round.

#### F5.2 Player drill-in

- Clicking a player from round detail opens the Player Modal.
- Player drill-in should not sever the user's connection to the underlying
  round.

#### F5.3 Return path

- After closing drill-in surfaces, the user should still understand which game
  and round they were viewing.
- If round detail is modal-based, closing it should preserve the user's
  surrounding browse context.
- If round detail is page-based, the return path should still feel obvious and
  low-friction.

### F6 — Stable Identity and Data Contract

**Outcome:** The browsing model is grounded in explicit game and round identity
instead of inferred grouping or deduplication rules.

#### F6.1 Game requirements

- Each game requires a unique game ID.
- The browse surface needs enough game-level data to render one visible game
  container per canonical game.

#### F6.2 Round requirements

- Each round requires a unique round ID and a parent game ID.
- The parent-child relationship between game and round is part of the product
  contract and must be queryable without heuristics.
- A round's display identity should include at minimum its name or theme.

#### F6.3 Submission requirements

- Each displayed submission requires `round_id`, `song_id`, and `player_id`.
- Each displayed submission requires user-readable song, artist, and player
  labels.
- Score or rank should be shown when available, but missing outcome data must
  not block rendering.

#### F6.4 Idempotency posture

- This milestone does not need to solve identity ambiguity between games or
  rounds because both entities have stable unique IDs.
- Execution work should avoid reintroducing inferred identity schemes where
  explicit IDs already exist.

### F7 — Graceful Handling and UX Expectations

**Outcome:** The browse-and-open flow feels immediate, understandable, and
robust under incomplete optional metadata.

#### F7.1 Partial-data handling

- Missing optional game metadata must not hide a game.
- Missing optional round metadata such as date or winner must not block either
  round summaries or round detail.
- Missing score or rank should be rendered cleanly rather than as a broken
  value.

#### F7.2 Performance and clarity

- The game browse surface and round detail should feel fast on normal datasets.
- Users should understand the archive structure quickly without needing
  explanation.
- The overall presentation should stay artifact-first and avoid dashboard
  complexity.

---

## 4. Explicit Exclusions

- No vote-by-vote breakdowns or scoring explainers in Milestone 3.
- No charts, dense analytics panels, or dashboard-style comparison views.
- No cross-game comparison tools, filters, or faceting in v1.
- No editing, curation, or admin actions on games, rounds, or submissions.
- No requirement to decide in the FSD whether round detail is modal-first or
  page-first; that is an execution choice for SPEC-003.
- No inferred deduplication or heuristic game-grouping logic when explicit game
  and round IDs exist.

---

## 5. Provenance

- Planning session / era reconstructed: 2026-04-17 milestone-to-FSD conversion
  with follow-up scope correction
- Source documents consulted:
  - `docs/specs/milestone_3_round_page.md` — original milestone intent around
    round readability, highlights, submission list, and lightweight
    exploration; corrected here to fit the fuller game-round hierarchy
  - `docs/specs/FSD-001-core-data-model.md` — upstream round, submission, song,
    and player assumptions relevant to round detail
  - `docs/specs/FSD-002-csv-import-pipeline.md` — upstream import assumptions
    around game snapshots, round identity, and archive completeness
  - `docs/specs/milestone_4_player_modal.md` — downstream interaction contract
    for player drill-in
  - `docs/specs/milestone_5_song_modal.md` — downstream interaction contract
    for song drill-in
  - Working clarification from product direction — each round belongs to a
    game; games and rounds have unique IDs; the browse flow should show every
    game, show round summaries within each game, and open round details on
    demand
  - `docs/templates/FSD-template.md` — structural authoring template

---

## 6. Uncertainty and Open Questions

- The main open execution decision is whether round detail should be modal-first
  or page-first. SPEC-003 should choose based on navigation ergonomics, URL
  design, and implementation simplicity, while preserving deep-linkability.
- Upstream modeling has been reconciled for current scope: `Game` is the
  first-class archive parent, while `Round.leagueSlug` is retained only as
  compatibility metadata. Round-page grouping must stay anchored on `Game` and
  stable round IDs.
- Game-level presentation remains open. SPEC-003 should decide whether each
  game is best rendered as a section, card, accordion, or other lightweight
  grouping pattern.
- Round summary density remains open. SPEC-003 should choose the minimum useful
  metadata for summaries so users can decide what to open without recreating
  the full round page inline.
- Deterministic round ordering within a game remains open. SPEC-003 should
  resolve whether ordering is sequence-based, date-based, or imported-order
  based.
- The exact treatment of missing score or rank remains open. SPEC-003 should
  choose a concise presentation that reads as intentionally unavailable rather
  than broken.
