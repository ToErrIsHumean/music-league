# FSD — Music League Milestone 6 — FSD-006-league-overview-memory-board
## Latest Game Memory Board

**Status:** Draft
**Accepted on:** [YYYY-MM-DD or omit until accepted]
**Consuming role:** Product state maintenance -> SPEC-006 authorship
**Source basis:** See §7
**Confidence:** Medium-High

---

## 1. Scope and Purpose

### For the PM

Milestone 6 should make `/` a memorable, trustworthy recap surface for the
latest completed Music League game. The before state is that users can inspect
rounds, players, and songs through focused surfaces, but there is no primary
landing experience that synthesizes the game into a social artifact.

The intended after state is a **Latest Game Memory Board**: a low-clutter,
evidence-backed recap that opens on one selected game, foregrounds the
competitive result, and presents a small set of recognizable moments from that
game. The board should feel shareable and playful, but its claims must remain
anchored in canonical archive facts. The product posture is closer to "the
group's results board and memory wall" than to a generic music analytics
dashboard.

This checkpoint incorporates a persona pressure test, but leaves architecture,
task boundaries, implementation mechanics, and fixture design to SPEC-006.

### Persona Pressure Test

The Memory Board is compatible with all configured personas if it remains a
balanced recap instead of a pure leaderboard, pure discovery surface, or pure
banter wall.

- **Merit Competitor:** Needs a legible, procedurally fair competitive result:
  leader or tied leaders, score context, close finishes, decisive picks, and
  enough evidence to evaluate controversial outcomes.
- **Discovery Curator:** Needs distinctive curation to remain visible even when
  it did not simply win. The board should surface novelty, surprise, memorable
  song choices, and non-consensus picks when current archive facts can support
  those claims.
- **Social Ritualist:** Needs the recap to feel like a shared event. The board
  should foreground participation, recognizable people-and-song moments, and
  comment/reaction evidence only when comment provenance is clean enough to
  avoid conflating submission comments with vote comments.

The v1 board should therefore include, when evidence exists, at least one
competitive result moment, one song/discovery memory moment, and one
social/participation moment.

### For the Architect

SPEC-006 should translate this into four behavioral workstreams: deterministic
selected-game resolution, balanced moment derivation, canonical drill-down, and
resilient sparse-data presentation. "Done" means `/` opens one selected game,
explains that selection, renders evidence-backed moments, and lets users inspect
canonical player/song/round evidence without confusing game scope or inventing
claims.

This FSD names capabilities and deferral decisions without choosing query
boundaries, component boundaries, caching, fixtures, or task decomposition.
Features marked stretch/remove should be optionalized or cut if they threaten
the v1 promise.

---

## 2. Feature Specifications

### F1 — Latest Game Landing

**Outcome:** Opening `/` shows one deterministic latest game recap rather than
flattening multiple games or asking the user to interpret ambiguous archive
state.

#### F1.1 Default route behavior

- `/` resolves to exactly one selected `Game` for the initial v1 experience.
- The PM decision for v1 is **latest game by deterministic rule**.
- The deterministic rule should use the best available explicit game or round
  ordering signal and should be stable across reloads.
- If the fallback ordering signal is weak, the user-facing copy should avoid
  overstating recency. For example, "Selected game" is safer than "Latest game"
  when only a stable fallback ID determined the result.

#### F1.2 Multi-game legibility

- The page must make the selected game legible through a title, fallback label,
  timeframe, or equivalent context.
- Multiple games must not be silently blended into one recap.
- When multiple games exist, the page should expose a visible game switcher so
  the deterministic latest-game default is legible and reversible.
- The default landing state remains the latest game by deterministic rule; the
  switcher exists to clarify and change the selected game, not to replace the
  latest-game default.

### F2 — Memory Board Experience

**Outcome:** Users see a curated board of memorable game moments, not a dense
dashboard or a set of decorative analytics cards.

- The v1 shape is **Memory Board**: roughly 4-6 curated moments when evidence
  exists, fewer when the selected game is sparse.
- The board should mix competitive outcome, round drama, song/discovery memory,
  artist familiarity, and participation signals without becoming only a
  leaderboard, recurrence board, or activity board.
- The board itself is the insight layer; v1 does not need a separate insight
  cards section, dense dashboard, or complex chart surface.
- A moment should read like a socially recognizable game memory, not a raw
  aggregate. The payoff is recollection: who submitted what, which round made it
  matter, how it performed, and why the group would recognize it.
- Playful copy is desirable only when supported; unsupported jokes or traits
  should be omitted rather than generalized.

### F3 — Competitive Anchor

**Outcome:** The recap preserves Music League's competitive spine by showing
the game leader, tied leaders, or equivalent standings signal.

- The Memory Board should foreground a standings-derived leader or tied leaders
  as a primary board item or top anchor.
- Tied leaders must remain visibly tied; arbitrary ordering must not fabricate
  a sole champion.
- Most submissions, most comments, or most repeated artists must not be
  conflated with winning the game.
- Missing score or rank should suppress or caveat outcome-dependent claims
  without hiding unrelated memory items.
- If competitive outcome data is insufficient, the FSD/SPEC should decide
  whether the board degrades to a selected-game memory state or blocks the
  competitive anchor with explicit unavailable-state copy.

### F4 — Recommended V1 Board Item Families

**Outcome:** SPEC-006 has a concise candidate set of high-value board moments
to contract, fixture, and implement without expanding into unsupported
analytics.

#### F4.1 Recommended balanced set

- **The Table:** standings leader or tied leaders for the selected game,
  including enough score context to make the result legible.
- **Game Swing:** either the closest scored round by score spread (**Photo
  Finish**) or the biggest winning submission margin (**Runaway Pick**) where
  score/rank evidence supports the claim.
- **New To Us That Landed:** an exact canonical song or normalized exported
  artist label with no prior archive history that still placed highly, won a
  round, drew cleanly attributable comments, or otherwise stood out through a
  named current archive fact.
- **Back Again / Familiar Face:** exact canonical song repeated across rounds,
  or normalized exported artist label appearing across multiple songs or
  submissions.
- **Participation Pulse:** broad participation, most active submitting player,
  or similar activity signal, only with explicit counts such as submitted songs,
  submitted rounds, or participating players.
- **People Reacted:** most-commented or otherwise conversation-backed moment,
  only if the evidence surface distinguishes submission comments from vote
  comments.

#### F4.2 Eligibility and demotion rules

- Every shipped family must have source basis, denominator where relevant,
  minimum threshold, omission condition, evidence link, and copy guardrails in
  SPEC-006; families that cannot meet this bar should be deferred.
- Player tendencies usually belong in player detail surfaces unless overview
  copy can name its denominator and avoid durable low-sample overclaims.
- Comment-derived moments require clear submission-comment versus vote-comment
  provenance.
- Artist-label humor must stay conservative because v1 artist identity is the
  exported display string, not collaborator-level truth.
- **Heavy Rotation** should not label submitter activity; **Participation
  Pulse** is safer for submission or round counts.

### F5 — Canonical Drill-down

**Outcome:** The board invites exploration without creating alternate local
meanings for players, songs, rounds, submissions, or votes.

- Player mentions should open the canonical player surface.
- Song mentions should open canonical song memory by canonical song identity.
- Round mentions should open the game-scoped round surface.
- Evidence context may foreground the relevant row or moment, but it should not
  redefine the destination entity.
- A user should be able to move from a board moment into its supporting detail
  and retain enough context to understand why that detail was linked.
- Return navigation or origin highlighting is desirable contextual chrome, not a
  separate product meaning.

### F6 — Basic-Data Intelligence Now, Enriched Analysis Later

**Outcome:** M6 v1 can feel observant and curated using sparse current archive
data, while leaving a clear product path for richer extracted-music-feature
analysis in a later version.

- V1 intelligence is **basic archive-fact curation**, not full music
  intelligence. It may detect close rounds, runaway winners, repeats, recurring
  exported artist labels, standings ties, and unusually active submitters using
  current facts only.
- A memory moment should have title, concise copy, referenced entities, source
  facts, evidence destination, omission behavior, and copy guardrails.
- Learning, personalization, autonomous action, black-box recommendation, and
  extracted music-feature analysis are outside v1.
- Future enrichment may add mood, energy, genre/style clusters, tempo/duration
  outliers, similarity, diversity, or theme-fit analysis after new source
  contracts. It must remain additive and preserve v1 truthfulness.
- Individual v1 capabilities may be deferred if source facts, sample quality,
  copy semantics, fixture complexity, or implementation complexity outweigh
  Memory Board value.

### F7 — Architect-facing Feature Inventory

**Outcome:** SPEC-006 has enough product feature coverage to execute without
turning the Memory Board into a broad analytics project.

#### F7.1 Executable feature inventory

- **Selected-game frame:** `/` opens the deterministic latest-game candidate,
  explains the selection cautiously when recency evidence is weak, shows a
  visible but unobtrusive switcher when multiple games exist, suppresses inert
  controls for a single game, and shows an explicit unavailable state when no
  completed game can be selected.
- **First viewport:** show selected-game identity, useful timeframe or round
  context, leader/tied leaders with score context when available, and enough
  top moments that the page reads as a shareable memory board before scrolling.
- **Moment system:** prefer one competitive, one song/discovery, and one
  social/participation slot; render roughly 4-6 moments when evidence supports
  them; prioritize competitive anchor first; omit empty or low-confidence slots.
- **Competitive features:** leader/tied leaders and score context, plus close
  finish or runaway pick when score/rank evidence is strong enough.
- **Song/discovery features:** new-to-us-that-landed, familiar-face recurrence,
  round-defining pick, and canonical song evidence links, subject to eligibility
  thresholds.
- **Social features:** participation pulse and player recognition, plus
  comment-backed reaction moments only when provenance is clear.
- **Navigation/evidence:** player, song, and round references open canonical
  destinations with enough origin context to explain the board claim.
- **Presentation:** compact board/wall layout, cautious copy modes,
  sparse-data rendering, responsive legibility, and screenshot-friendly first
  viewport.

#### F7.2 Deferral ledger for SPEC-006

- **Keep in v1 unless proven too costly:** selected-game default, multi-game
  switcher, competitive anchor, 4-6 evidence-backed moments, canonical
  drill-downs, sparse-data omission behavior.
- **Likely optional v1:** close finish, runaway pick, new-to-us-that-landed,
  familiar-face recurrence, participation pulse, origin highlighting.
- **High-risk v1:** comment-derived reaction moments, direct comment snippets,
  full standings expansion, deep-linkable board selection state, decorative
  novelty layer.
- **Remove from v1:** external music enrichment, recommendations,
  personalization, adaptive persona boards, dense filters, advanced charts,
  all-games overview, and unsupported joke/trait generation.

---

## 3. Explicit Exclusions

- No all-games overview on `/` for v1.
- No silent cross-game flattening.
- No dense dashboard, dominant standings table, advanced filters, or complex
  charts.
- No genre, mood, duration, popularity, release-year, album, audio-feature,
  Spotify-enrichment, recommendation, or ML-generated insight claims.
- No vote-budget, deadline, penalty, disqualification, low-stakes, or
  source-setting explanations unless a separate accepted product contract adds
  those source facts.
- No collaborator-level artist claims from combined exported artist labels; v1
  artist memory uses exported display strings only.
- No fallback jokes, generic traits, or durable player-tendency claims that
  sound factual without supporting evidence.
- No persisted standings or leaderboard concept as a product requirement of
  this FSD.
- No v1 learning, personalization, autonomous action, black-box
  recommendation, inferred taste modeling, persona-specific variants, or
  adaptive rendering.

---

## 4. Cross-cutting Invariants

- **INV-SELECTED-GAME:** `/` is always about one selected canonical `Game` at a
  time. The page may expose archive history only as supporting context for a
  selected-game moment, never as a silent all-games blend.
- **INV-SELECTION-LEGIBILITY:** The selected game must be identifiable to the
  user through title, label, timeframe, switcher state, or unavailable-state
  copy. If recency evidence is weak, copy must avoid overstating "latest."
- **INV-EVIDENCE-FIRST:** Every rendered board item must be backed by named
  archive facts. Where the claim depends on a comparison, count, rank, score, or
  recurrence, the later SPEC must define the denominator, omission condition,
  evidence destination, and copy guardrails.
- **INV-OUTCOME-HONESTY:** Outcome-dependent copy must never fabricate a
  champion, winner, decisive pick, tie-break, loss, comeback, or close finish
  from missing or ambiguous score/rank evidence; ties must remain visibly tied.
- **INV-PERSONA-BALANCE:** When enough evidence exists, the board must include
  at least one competitive result moment, one song/discovery memory moment, and
  one social/participation moment. Balance is achieved through default board
  composition, not persona-specific personalization.
- **INV-OMISSION-OVER-FILLER:** Unsupported, low-sample, or provenance-unclear
  moment candidates must be omitted rather than replaced with generic playful
  copy that sounds factual.
- **INV-CANONICAL-ENTITIES:** Player, song, round, submission, vote, and game
  references must retain their canonical Music League meanings. The board may
  summarize those entities, but it must not create alternate local identities.
- **INV-COMMENT-PROVENANCE:** Comment-derived moments must distinguish
  submission comments from vote comments; otherwise they are omitted from v1.
- **INV-V1-SOURCE-LIMITS:** V1 claims must use current archive facts only. No
  genre, mood, audio-feature, popularity, recommendation, personalization, or
  inferred taste claim is allowed without a later accepted source contract.
- **INV-DEGRADED-USEFULNESS:** Sparse data should produce a smaller, cautious
  board, not a broken, empty-looking, or misleading board.

---

## 5. Gate Criteria

- Opening `/` resolves to exactly one selected game or an explicit unavailable
  archive state. Multiple games are never silently blended, and multi-game
  archives expose a deterministic default plus visible switcher.
- The selected game is legible through visible context; weak fallback ordering
  uses cautious language rather than overclaiming recency.
- A representative completed-game scenario renders a balanced board with
  competitive, song/discovery, and social/participation moments when evidence
  exists for all three lenses.
- The competitive anchor shows a leader or tied leaders with enough score
  context to understand the result; missing score/rank suppresses or caveats
  outcome claims without hiding unrelated memory items.
- A sparse-data scenario omits unsupported items and still renders a coherent
  selected-game recap with safe degraded copy.
- Each rendered moment provides a clear evidence path to a canonical player,
  song, round, submission, vote, or game context as appropriate for the claim.
- Comment-derived moments are absent unless the chosen evidence surface can
  preserve submission-comment versus vote-comment provenance.
- The board ships no v1 claims based on genre, mood, audio features,
  popularity, recommendations, personalization, inferred taste, or unsupported
  humor/traits.
- Manual product review confirms the first viewport is screenshot-friendly,
  comprehensible in roughly five seconds, and not visually dominated by a dense
  dashboard, large table, complex chart, or inert selector.
- Manual product review confirms optional/high-risk features called out in the
  deferral ledger were either intentionally included with evidence or explicitly
  deferred from SPEC-006.

---

## 6. Touched Boundaries

- **Landing experience and game selection** — `/` becomes the primary recap
  surface for one selected game. This boundary includes selected-game context,
  multi-game legibility, switcher behavior, and no-game/unavailable posture.

- **Game recap framing** — The page needs a clear first-viewport hierarchy:
  selected-game identity, competitive anchor when available, and an immediate
  sense that this is a memory board rather than an archive dashboard.

- **Memory moment definition and selection** — The product needs a bounded
  catalog of moment families, eligibility rules, omission behavior, and copy
  guardrails.

- **Competitive result interpretation** — Standings, leaders, ties, close
  finishes, and runaway picks are product-sensitive because they can easily
  overclaim. This boundary includes what may be said when score/rank evidence is
  complete, partial, or absent.

- **Song and artist memory cues** — New-to-us, recurring exact-song, and
  recurring exported-artist claims touch archive-memory semantics. These cues
  must remain distinct from external music intelligence or collaborator-level
  artist analysis.

- **Participation and comment-backed social cues** — Participation counts and
  comment-backed moments are promising social signals. Comment-derived features
  should remain optional or deferred unless provenance is sufficiently clear.

- **Canonical exploration paths** — Board moments should lead to existing
  player, song, and game-scoped round meanings. This boundary includes origin
  context and evidence legibility, without requiring a new detail surface.

- **Responsive and degraded presentation** — The board must remain low-clutter,
  screenshot-friendly, and useful when the selected game lacks enough evidence
  for all candidate moment families.

- **Scope-control ledger** — SPEC-006 should explicitly carry forward which
  F7.2 items are in v1, optional, high-risk, or removed so later implementation
  does not expand the milestone by implication.

---

## 7. Provenance

- Planning session / era reconstructed: 2026-04-25 PM pressure-test checkpoint
- Source documents consulted:
  - `docs/specs/milestone_6_league_overview.md` — supplied the original
    product intent: polished, shareable, low-clutter league overview with
    playful data-backed insights.
  - `docs/specs/milestone_6_league_overview_corrective_addendum.md` —
    supplied the corrected game-scoped framing, source-fact limits, standings
    posture, insight grounding requirements, and forbidden unsupported claims.
  - `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md` — supplied the product model
    that the overview must respect: games, rounds, submissions, votes, songs,
    players, standings, and archive-memory semantics.
  - `docs/reference/FEATURE_ALIGNMENT_CHECKLIST.md` — supplied the alignment
    lens for avoiding generic music-app behavior and preserving canonical
    navigation and evidence semantics.
- Decision logs or companion notes consulted:
  - Planning conversation on 2026-04-25 — PM decisions: `/` selects latest game
    by deterministic rule; v1 shape is Memory Board; FSD should remain a
    state checkpoint and avoid over-prescribing architect-facing sections.
  - Persona pressure-test pass on 2026-04-25 — PM decision: v1 should satisfy
    configured personas through balanced board composition, with competitive,
    song/discovery, and social/participation lenses when evidence exists.
  - Follow-up PM decision on 2026-04-25 — when multiple games exist, v1 should
    still expose a visible game switcher while defaulting to the deterministic
    latest game.
  - Follow-up PM decision on 2026-04-25 — v1 should support a basic-data
    intelligence layer over sparse archive facts, while preserving a v2 path for
    extracted music features and allowing deferral if a candidate capability is
    unexpectedly high complexity.

---

## 8. Uncertainty and Open Questions

- What exact deterministic latest-game ordering should the FSD commit to when
  multiple timestamp-like signals are available or absent?
- Should insufficient standings data block the competitive anchor, produce a
  caveated unavailable state, or allow the board to render with non-competitive
  memory items?
- Which recommended board item families should be mandatory in SPEC-006 versus
  opportunistic, and what minimum sample thresholds should they use?
- Are comment-derived memory items in v1, or deferred until vote-by-vote and
  comment evidence surfaces are product-complete?
- How much origin highlighting or return navigation is necessary when a board
  item opens a canonical song, player, or round surface?
- Should SPEC-006 make **New To Us That Landed** mandatory when fixture evidence
  exists, or treat it as an optional discovery slot behind standings and
  participation guarantees?
- Is **People Reacted** viable in v1, or should social fit rely on
  Participation Pulse until comment evidence surfaces are complete?
