# FSD — Music League Milestone 4 — FSD-004-player-modal
## Player Modal

**Status:** Accepted
**Accepted on:** 2026-04-18
**Consuming role:** Planner -> SPEC authorship
**Source basis:** See §7
**Confidence:** High

---

## 1. Scope and Purpose

### For the PM

The current player modal answers "what did this person submit?" — not "who is this person?" M4 adds a trait line (one sentence on how this player scores relative to the league) and notable picks (best- and worst-ranked submissions), both visible above the fold on open. Submission history, modal shell, close behavior, and navigation entry point are unchanged.

The payoff is social: tapping any player's name gives an instant personality read without having to scroll their full history. The trait line is a scoring personality signal only; musical identity (genre, mood, duration) requires metadata not available until post-0.1.0.

### For the Architect

Three workstreams:

1. **Above-fold content** — one computed trait line (the claim) and notable picks, best + worst (the evidence). Derived entirely from existing submission/rank data; no new external data sources.
2. **Navigation model** — internal links push rather than nest. Song tap replaces modal content with a player-scoped song view (back affordance included); round tap navigates to the round page while preserving the player modal in the history stack.
3. **Below-fold history** — the existing submission list, preserved and made scrollable.

"Done" means: a user taps a player name, immediately sees something meaningful about how they play, and can navigate forward or back without losing their place.

---

## 2. Feature Specifications

### F1 — Trait Line

**Outcome:** The user reads one short, generated sentence characterizing how this player competes in the league.

#### F1.1 Derivation

- Computed from rank and score data only; no genre, mood, duration, or external metadata
- Uses finish percentile, not raw rank alone, when comparing finishes across
  rounds: `(rank - 1) / max(scoredRoundSize - 1, 1)`, where `0` is best and
  `1` is worst
- Names or exposes the denominator for any player-performance claim. Finish
  and win-rate claims use scored submissions unless a later SPEC explicitly
  chooses another named denominator.
- Multi-submit rounds count once per scored submission for submission-based
  claims, and once per player/round only for submitted-round-count claims
- Score variance may use raw score as descriptive context, but copy must not
  explain that variance through vote budgets, deadlines, low-stakes settings,
  or downvote availability unless those source settings are known
- Reflects the most statistically dominant supported signal among: normalized
  average finish, score variance, win rate
- Exactly one trait line; no stacking
- Omitted for players with 0 scored submissions; minimum threshold: 1. A
  one-scored-submission line may describe that one result but must not imply a
  durable tendency without a later threshold rule.

#### F1.2 Copy tone

- Lightly humorous, consistent with the round highlights voice
- Must be backed by a real signal; no generic fallbacks

#### F1.3 Trait triggers (illustrative; SPEC defines complete enumeration)

- High avg rank: "Consistently near the top — plays it safe, plays it well."
- High variance: "Could be first, could be last. You never know."
- High win rate: "Wins more rounds than anyone likes to admit."
- Consistently low: "Bravely marches to their own drummer."

---

### F2 — Notable Picks

**Outcome:** The user sees the player's best and worst submission above the fold on open, as concrete evidence of the trait line.

#### F2.1 Selection rules

- Best pick: lowest rank ordinal among all scored submissions; score is the tiebreak
- Worst pick: highest rank ordinal among all scored submissions; score is the tiebreak
- One scored submission: show best only; omit worst
- Zero scored submissions: omit section entirely; no placeholders

#### F2.2 Display

- Each pick shows: song title, artist, round name, rank position (score as secondary)
- Evidence copy should keep rank legible with its scored-round denominator when
  a pick is used outside the modal as player-performance support
- Picks are labeled "Best Pick" and "Worst Pick" respectively
- Song title and round name are tappable (see F3)
- Best and worst are visually distinguished from each other and from the submission history below; exact visual treatment is a SPEC decision

---

### F3 — Navigation Model

**Outcome:** The user can tap forward to a song or round without getting lost, with a clear path back to the player view.

#### F3.1 Song tap (push)

- Tapping a song title replaces modal inner content with a player-scoped song view
- Song view shows this player's submission: title, artist, round name, rank, score, comment if present — not cross-player history
- Back affordance (e.g. "← [Player name]") returns to the player view; modal shell stays throughout

#### F3.2 Round tap (navigate, preserve stack)

- Tapping a round name navigates to the round page; player modal state is preserved in the browser history stack (mobile browser target)

#### F3.3 Modal depth cap

- Maximum push depth: 1 (player → song view); song view exposes no further pushable links

---

### F4 — Submission History

**Outcome:** The user can scroll through all of a player's submissions in one place.

#### F4.1 Display

- Full list sorted by round date descending
- Each row: song title, artist, round name, rank position (score as secondary)
- Song and round names are tappable per F3

#### F4.2 Placement

- History lives below the fold

---

## 3. Explicit Exclusions

- Taste-based trait signals (genre, song duration, mood, audio features) — deferred to post-0.1.0 metadata milestone
- Multiple trait lines or trait stacking
- Nested modals (song modal opening on top of player modal)
- Cross-player song history within the player modal push view — M5 (Song Modal) behavior
- Player-to-player comparison
- Charts, graphs, or visual score timelines
- Editable player profiles
- Pagination or filtering of submission history
- Dedicated empty-state design for players with zero submissions — silent omission per F1 and F2 is defined; no illustrated or copy-heavy empty state is in scope

---

## 4. Cross-cutting Invariants

- **INV-SHELL:** The modal shell — overlay, close button, query-param navigation entry point — is unchanged. M4 adds content and internal navigation; it never rewires or replaces the shell.
- **INV-ABOVE-FOLD:** Trait line and notable picks are always the first content visible on modal open on a standard mobile viewport. No data state may push them below the fold or substitute a placeholder.
- **INV-SIGNAL:** The trait line is backed by a real data signal or absent entirely. Generic fallback copy is never acceptable.
- **INV-PUSH-CAP:** Modal push depth is capped at 1. Player view may push to song view; song view must not expose further pushable links within the modal.
- **INV-SCOPE:** The song view surfaces only this player's submission details. Cross-player song history is not accessible from within the player modal — that is M5 behavior.

---

## 5. Gate Criteria

- Above-fold content is fully visible on a standard mobile viewport (375 × 667 px, iPhone SE baseline) without scrolling for any player with ≥1 scored submission.
- A player with 0 scored submissions opens the modal with no trait line and no notable picks — no placeholders, no empty containers.
- Song tap replaces modal inner content; back affordance returns to the player view; modal shell never closes or re-mounts during the push.
- Round tap navigates to the round page; browser back returns to the player modal URL state.
- The song view contains no tappable links that push further modal content.

---

## 6. Touched Boundaries

- **Player modal data layer** — `getPlayerRoundModal` currently returns a single round-scoped submission. M4 requires expanding or replacing this to return cross-round history and rank/score aggregates for trait and notable picks.
  Primary surfaces: data query layer, player modal component.

- **Trait computation** — new surface. A function over a player's submission history returning one trait string or null. Inputs: rank and score fields on existing `Submission` records only.
  Primary surfaces: new utility module.

- **Modal navigation model** — currently flat (M3 shell). M4 introduces client-side push and browser-history round navigation.
  Primary surfaces: player modal component, browser history API integration point.

- **Submission query surface** — currently per-round. M4 requires cross-round aggregation per player (all submissions by `playerId`, sorted by `Round.occurredAt` descending).
  Primary surfaces: Prisma query layer; `Submission`, `Round`, `Song` tables.

---

## 7. Provenance

- Planning session: 2026-04-18
- Source documents consulted:
  - `docs/specs/milestone_4_player_modal.md` — original product intent and interaction model
- Decision logs or companion notes consulted: none on record

---

## 8. Uncertainty and Open Questions

- **Trait trigger completeness** — F1.3 lists four illustrative triggers; the exhaustive set and exact copy are a SPEC decision. The SPEC must enumerate all signal branches before ship.
- **Viewport baseline** — gate criteria use 375 × 667 px (iPhone SE) as the standard mobile viewport. If the team targets a different baseline, this gate criterion must be updated before acceptance testing.
