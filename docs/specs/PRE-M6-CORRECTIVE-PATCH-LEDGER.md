# Pre-M6 Corrective Patch Ledger
## Music League Game-Semantics Cleanup Before Milestone 6

**Status:** Draft
**Created on:** 2026-04-24
**Consuming role:** Product state maintenance -> FSD cleanup and later technical implementation setup before SPEC-006
**Source basis:** See §7
**Confidence:** High for identified gaps and FSD-level executable feature coverage; Medium for exact technical sequencing until CP dispositions are recorded

---

## 1. Scope and Purpose

### For the PM

This document preserves the full corrective audit performed after adding the
Music League game-model references. Its purpose is to prevent Milestone 6 from
building overview, standings, and insight behavior on top of earlier naive or
underspecified assumptions.

The cleanup pass should happen before Milestone 6 planning is dispatched. It
does not replace existing FSDs or SPECs. It identifies where existing product
contracts need amendment, reconciliation, or explicit deferral so later agents
do not infer behavior from incomplete local context.

### For the Architect

This is a feature-definition patch ledger, not an implementation SPEC. Each
item names:

- the originating gap
- the affected existing milestone features
- the required product-contract correction
- the implementation and test implications that downstream technical specs must
  preserve

Done means every item below has one of three outcomes before SPEC-006 setup:

1. patched into the relevant FSD or recorded as a downstream SPEC setup
   requirement;
2. explicitly deferred with rationale and a guardrail; or
3. declared not applicable after review, with evidence.

No item should disappear merely because it is awkward, already partially fixed,
or overlaps another milestone.

### Architect Feature Index

Use this index as the executable feature list for downstream FSD correction and
later technical implementation setup. It condenses §2 without adding scope; the
detailed originating gap, affected documents, required product correction, and
verification obligations remain authoritative in each CP section.

- **CP-01 Completed snapshots:** Patch import/product contracts to state that
  supported imports are completed, post-vote, de-anonymized exports; annotate
  `Submission.visibleToVoters` as source evidence or compatibility ballast, not
  an active current-product privacy gate; add a guardrail that pre-reveal import
  requires a new privacy/reveal contract before player-song associations are
  exposed.
- **CP-02 Game identity:** Patch data model, import, replay, and browsing
  contracts so `Game` is the canonical parent of `Round`; define
  `Game.sourceGameId`, `ImportBatch.gameKey`, and derived game-key semantics in
  one place; decide and document whether `Round.leagueSlug` is deprecated,
  display-only, or still a namespace; require game-scoped round uniqueness and
  game-based archive queries.
- **CP-03 Standings:** Add a derived standings/champion read model for M6 using
  submitted-song `Submission.score` totals within a game; define included rounds,
  missing-score/null-rank behavior, and tie handling; prohibit persisted
  standings tables for M6 unless a later schema spec justifies them.
- **CP-04 Normalized player metrics:** Patch player trait and overview metric
  contracts to define normalized finish, denominators, multi-submit handling,
  score-variance posture, low-sample thresholds, and evidence context for best
  and worst picks.
- **CP-05 Source settings:** Patch import and analytics contracts to inventory
  available game settings, record absent settings as unknown, accept negative
  vote points, avoid vote-budget/deadline inference without source facts or
  trusted local config, and keep overview copy from explaining score anomalies
  through unknown settings.
- **CP-06 Canonical song detail:** Patch player, round, song, and overview link
  contracts so song taps resolve to canonical `Song` memory unless explicitly
  labeled as local evidence previews; preserve origin context only for return
  navigation and evidence foregrounding.
- **CP-07 Vote breakdown:** Patch completed round result surfaces to include a
  v1 vote-by-vote breakdown with voter, target song/submission, points, and vote
  comment; choose primary grouping and ordering; keep submission comments, vote
  comments, vote-budget explanations, and missed-deadline claims semantically
  separate.
- **CP-08 Artist identity:** Patch artist familiarity and M6 artist insight
  contracts to state that v1 identity is the normalized exported artist display
  string, not a parsed collaborator graph; constrain copy so multi-artist labels
  do not imply unavailable collaborator-level truth.
- **CP-09 Insight grounding:** Patch M6 insight contracts so every template names
  its canonical data source and minimum sample threshold; prohibit genre, mood,
  duration, popularity, album, release year, audio features, and Spotify
  enrichment unless a prerequisite spec adds those fields; omit unsupported
  funny copy rather than fabricating fallback claims.
- **CP-10 Fixtures:** Add or identify small semantic fixtures covering
  overlapping game/round names, repeat songs, same-artist new songs,
  multi-artist labels, negative points, vote rows/comments, standings ties,
  missing score/rank, completed snapshot visibility flags, sparse player
  histories, and stale origin context; require each non-deferred CP and shipped
  M6 insight category to name its fixture coverage.

### Corrective Patch Disposition Record

Disposition status here means the product/source contract is explicit. The
downstream implementation owner still owns the code, fixture, or UI work named
by the active cleanup SPEC.

| CP | Disposition | Patched contract | Downstream owner | Verification anchor |
| --- | --- | --- | --- | --- |
| CP-01 completed snapshots | `patched` | Supported imports are completed, post-vote, de-anonymized snapshots; `Submission.visibleToVoters` is source evidence/compatibility data, not a current privacy gate. | TASK-05 import-hardening tests | AC-01, AC-02, AC-11 |
| CP-02 game identity | `patched` | `Game` is the canonical parent of `Round`; `Game.sourceGameId`/`ImportBatch.gameKey` identify the source game; `Round.leagueSlug` is compatibility metadata. | TASK-05 import-hardening tests | AC-01, AC-03, AC-11 |
| CP-03 standings | `patched` | M6 standings are a derived, game-scoped read model over scored `Submission.score` values with dense tied ranking and no persisted standings table. | TASK-07 standings helper | AC-01, AC-04, AC-12, AC-13 |
| CP-04 normalized player metrics | `patched` | Overview player claims use named denominators, finish-percentile posture, explicit multi-submit treatment, and small-sample caveats. | TASK-08 overview insights | AC-01, AC-05, AC-11, AC-13 |
| CP-05 source settings | `patched` | Vote budget, deadline, low-stakes, and downvote-enabled settings remain unknown unless imported or configured; negative vote points remain valid imported facts. | TASK-05 and TASK-06 import/round evidence | AC-01, AC-06, AC-11 |
| CP-06 canonical song detail | `patched` | Song links target canonical song memory by canonical song identity; origin context is navigation/evidence chrome. | TASK-08 overview links | AC-01, AC-07, AC-11 |
| CP-07 vote breakdown | `patched` | Completed round result surfaces may display vote-by-vote evidence while keeping vote comments, submission comments, and settings explanations separate. | TASK-06 round evidence | AC-01, AC-08, AC-11 |
| CP-08 artist identity | `patched` | v1 artist identity is the normalized exported artist display string, not parsed collaborator truth. | TASK-08 overview insights | AC-01, AC-09, AC-11 |
| CP-09 insight grounding | `patched` | Each M6 insight template must name source facts, scope, denominator, minimum sample, omission condition, and evidence link; unsupported metadata claims are omitted. | Future SPEC-006 implementation | AC-01, AC-10, AC-13 |
| CP-10 fixtures | `patched` | Fixture coverage is required for overlapping games, standings ties, negative points, comments, sparse histories, visibility flags, and stale origin context. | TASK-04 fixture manifest and downstream consumers | AC-11 |

---

## 2. Corrective Patch Features

### CP-01 — Completed Snapshot Assumption

**Outcome:** Product contracts explicitly rely on the operational fact that
game data is not accessible to this app until voting has finished and
submissions are de-anonymized.

#### CP-01.1 Originating gap

- The audit originally flagged possible anonymity leakage because Music League
  hides submitters before voting closes and the source rows include
  `Submission.visibleToVoters`.
- Product clarification: this app only receives game data after voting has
  finished and submissions are de-anonymized.
- Result: a reveal-state subsystem is not needed for the current archive
  product, but the completed-snapshot assumption must be made explicit so later
  agents do not spend work on anonymity handling or accidentally expand import
  scope to pre-reveal data.

#### CP-01.2 Affected contracts

- `FSD-001-core-data-model`: `Submission.visibleToVoters` exists but should not
  be interpreted as an active privacy gate for current product surfaces.
- `FSD-002-csv-import-pipeline`: import scope should say supported bundles are
  post-vote, de-anonymized snapshots.
- `FSD-003-round-page`: showing submitter names is valid under the completed-
  snapshot assumption.
- `FSD-004-player-modal`: player-specific history and notable picks are valid
  under the completed-snapshot assumption.
- `FSD-005-song-modal`: submitter evidence and song memory are valid under the
  completed-snapshot assumption.
- Future `FSD/SPEC-006`: overview insights and standings may assume revealed
  submitter-song associations unless import scope changes.

#### CP-01.3 Required correction

- State the operational assumption directly: supported imports are completed,
  post-vote, de-anonymized Music League exports.
- Do not build `revealed` / `unrevealed` / `partial_or_unknown` lifecycle
  mechanics for M6 unless import scope changes.
- Decide whether `Submission.visibleToVoters` remains stored as source evidence,
  is ignored by product surfaces, or is removed/deprecated in a future schema
  cleanup.
- If a future feature imports pre-vote or in-progress data, that feature must
  introduce a new privacy/reveal-state contract before exposing player-song
  associations.
- Missing score/rank remains an incomplete-outcome concern, not an anonymity
  concern.

#### CP-01.4 Verification requirements

- Import or documentation test evidence that supported fixtures represent
  completed, de-anonymized exports.
- No M6 tests are required for unrevealed-round privacy unless import scope is
  expanded.
- If `visibleToVoters` remains in fixtures, add a comment or assertion that it
  is not currently a product privacy gate.

---

### CP-02 — First-Class Game Identity Reconciliation

**Outcome:** The product has one canonical game identity model, and agents do
not need to infer whether `Game`, `leagueSlug`, or a derived import key is the
real parent of a round.

#### CP-02.1 Originating gap

- FSD-001 originally modeled seven entities and omitted `Game`.
- Rounds were grouped by `leagueSlug` and source round key.
- FSD-002 introduced a derived game key from the first valid round row.
- FSD-003 later corrected the mental model: browse by game, then rounds.
- The current schema now includes `Game`, but `Round.leagueSlug` and
  `@@unique([leagueSlug, sourceRoundId])` still exist beside `gameId`.

#### CP-02.2 Affected contracts

- `FSD-001-core-data-model`: entity list, query readiness, round uniqueness.
- `SPEC-001-core-data-model`: schema invariant and historical contract.
- `FSD-002-csv-import-pipeline`: game-key derivation and replay safety.
- `SPEC-002-csv-import-pipeline`: commit behavior for same-game overwrite.
- `FSD-003-round-page`: game-first archive browsing.
- All archive queries that group or link rounds.

#### CP-02.3 Required correction

- Declare `Game` a first-class domain entity in the product model.
- Define `Game.sourceGameId`, `ImportBatch.gameKey`, and any derived game key
  semantics in one place.
- Decide whether `Round.leagueSlug` is deprecated compatibility ballast,
  retained display metadata, or a still-meaningful namespace. Document the
  decision.
- Define the canonical uniqueness rule for rounds as game-scoped source round
  identity.
- Ensure all product-facing browsing, song memory, player history, and overview
  aggregation use `gameId` rather than `leagueSlug` for parent-child semantics.
- If `leagueSlug` remains in schema, add a guardrail that new feature code must
  not use it to infer game grouping unless the active SPEC says so.

#### CP-02.4 Verification requirements

- Fixture with two games containing similar or identical round names.
- Query tests proving rounds group under `Game`, not inferred name or slug.
- Re-import tests proving same-game overwrite does not affect unrelated games.
- Overview test proving cross-game aggregation is explicit when used and not an
  accidental flattening artifact.

---

### CP-03 — Derived Standings and League Winner Semantics

**Outcome:** Milestone 6 treats standings and cumulative points as a core Music
League read model, derived from canonical submissions and votes rather than
persisted as a new schema entity.

#### CP-03.1 Originating gap

- Music League accumulates points across rounds until a league winner is
  determined.
- FSD-001 overview readiness covers most-submitted artist, most active player,
  average rank/score, and counts, but not canonical standings.
- The Milestone 6 source document emphasizes "Spotify Wrapped for your league"
  and funny insights, but does not require a standings or champion model.
- Result: M6 could ship a polished overview that misses the competitive spine
  of Music League, or incorrectly solve it by adding a standings table instead
  of deriving standings from canonical outcome data.

#### CP-03.2 Affected contracts

- `FSD-001-core-data-model`: downstream query readiness; no new standings
  schema entity.
- `FSD-002-csv-import-pipeline`: score/rank recomputation and snapshot
  overwrite.
- `FSD-004-player-modal`: trait context and player performance claims.
- `docs/specs/milestone_6_league_overview.md`: primary M6 product concept.
- Future `FSD/SPEC-006`: overview content, acceptance criteria, and derived
  read-model contract.

#### CP-03.3 Required correction

- Define standings as a derived read model: total points by player within a
  game, computed from the player's submitted songs' canonical
  `Submission.score` values after import.
- The standings row contract includes `totalScore`, `scoredSubmissionCount`,
  `scoredRoundCount`, dense `rank`, and explicit `tied` state. Multi-submit
  rounds count once per scored submission for total score and once per
  distinct round for `scoredRoundCount`.
- Do not add `Standing`, `Leaderboard`, or equivalent persisted schema tables
  for M6. If future performance or audit requirements need persistence, that
  must be justified in a separate schema-changing spec.
- Define whether standings include all rounds, only scored rounds, or another
  explicitly named subset.
- Define how missing scores, null ranks, and partial imports affect standings.
- Define tie handling. Minimum: stable deterministic tie ordering and explicit
  tied-state display; do not invent a winner from arbitrary sort order. Players
  with zero scored submissions are excluded from standings rows.
- Require a computationally cheap one-game derivation that is linear or
  near-linear in the game's scored submissions/votes and avoids per-player or
  per-round query loops.
- M6 overview must include a standings/champion signal unless explicitly
  deferred with a rationale stronger than "not in the original overview doc."
- "Winner", "champion", "leader", and similar copy must be backed by the
  standings rule, not by most wins, most submissions, or generic activity.

#### CP-03.4 Verification requirements

- Fixture with multiple rounds where total points produce a clear leader.
- Fixture with a standings tie.
- Fixture with unscored or partially scored rounds excluded or handled per
  contract.
- Overview test proving champion/leader copy maps to the standings derivation.
- Schema review proving M6 does not introduce persisted standings state.

---

### CP-04 — Player Metrics Normalized for Round Shape

**Outcome:** Player traits and overview performance claims remain fair when
round sizes, participation, and submission counts vary.

#### CP-04.1 Originating gap

- Music League games can vary in number of songs per player, voting rules,
  deadlines, downvotes, and round participation.
- FSD-004 uses average rank relative to league, score variance, and win rate.
- The FSD does not require normalization by round size, number of scored
  submissions, missed rounds, or multi-submit rounds.
- Result: traits can be mathematically true but socially misleading.

#### CP-04.2 Affected contracts

- `FSD-004-player-modal`: trait line, notable picks, history ordering.
- `SPEC-004-player-modal`: trait computation implementation.
- Future `FSD/SPEC-006`: player-based overview insights.
- Any future leaderboard or awards logic.

#### CP-04.3 Required correction

- Define a normalized finish metric. Candidate: finish percentile within the
  scored round, where first place is best and last place is worst.
- Define which denominator each claim uses: scored submissions, submitted
  rounds, all game rounds, or eligible rounds.
- Define how multi-submit rounds count for win rate, average finish, and
  notable picks.
- Define whether score variance uses raw points, normalized points, or is
  disabled when vote-budget settings are unavailable.
- Keep rank-first notable picks, but require the selected "best" and "worst"
  evidence to expose enough context that a one-song round or tiny round does
  not look equivalent to a large competitive round.
- Minimum sample thresholds should be revisited. FSD-004 currently allows one
  scored submission for a trait; that may be too low for M6 overview claims.

#### CP-04.4 Verification requirements

- Trait tests with different round sizes.
- Trait tests with a player who submits in only one round.
- Trait tests with multiple submissions by one player in a round if source
  settings allow it.
- Overview insight tests proving low-sample claims are omitted or caveated.

---

### CP-05 — Source Game Settings and Vote-Rule Provenance

**Outcome:** Import and analytics preserve enough rule context to explain
negative points, vote budgets, missed-deadline behavior, and score anomalies
without reverse-engineering source settings from outcomes. Vote-by-vote display
in v1 does not by itself require vote-budget derivation or missed-deadline
behavior.

#### CP-05.1 Originating gap

- Music League game settings can vary: vote budget, downvotes, deadlines,
  songs per round, and missed-deadline consequences.
- FSD-002 validates vote scalar values and recomputes score/rank, but does not
  preserve game settings.
- The source CSV fixtures may not expose every setting, so existing specs
  implicitly treat settings as unknowable.
- Result: future agents may overvalidate legitimate data or overinterpret
  imported scores without knowing the source league rules.

#### CP-05.2 Affected contracts

- `FSD-001-core-data-model`: schema extensibility and non-goals.
- `FSD-002-csv-import-pipeline`: validation posture and import summary.
- `SPEC-002-csv-import-pipeline`: scalar validation and recomputation.
- Future `FSD/SPEC-006`: overview claims and score explanations.

#### CP-05.3 Required correction

- Inventory which game settings are present in the supported export, if any.
- For settings not present in CSV, explicitly record them as unknown rather
  than silently assuming defaults.
- Do not reject negative vote points solely because they are negative.
- Do not infer vote-budget violations unless the source export supplies the
  budget or the active spec defines a trusted local configuration.
- Do not derive missed-voting-deadline or low-stakes deadline behavior from
  absence of votes unless the supported export or a trusted local configuration
  supplies the relevant deadline and eligibility facts.
- Vote-by-vote breakdowns may show imported votes, point values, voters, target
  songs, and vote comments without explaining whether the voter used a full
  budget or missed a deadline.
- If a later import source exposes settings, define where they attach: `Game`,
  `Round`, or `ImportBatch`.
- Overview copy must avoid explaining score oddities via settings unless those
  settings are known.

#### CP-05.4 Verification requirements

- Import fixture with negative vote points.
- Import fixture with unusual but valid-looking point distribution.
- Validation test proving unknown settings do not cause fabricated failures.
- Overview test proving copy does not claim a player was penalized, disqualified,
  or downvoted unless the imported facts support that claim.
- Vote-breakdown test proving unknown vote budgets or deadline settings do not
  block display of known imported votes.

---

### CP-06 — Canonical Song Detail vs Player-Scoped Song Slice

**Outcome:** Song taps converge on one song-memory concept unless an active
SPEC explicitly declares a local slice as a non-canonical preview.

#### CP-06.1 Originating gap

- FSD-004 introduced a player-scoped song push view inside the player modal.
- FSD-005 later corrected the product model: song detail should be canonical,
  archive-wide, and invariant across origin surfaces.
- FSD-005 says M5 supersedes interim player-scoped and round-scoped meanings,
  but the older FSD-004 contract still exists and can mislead agents.

#### CP-06.2 Affected contracts

- `FSD-004-player-modal`: song tap behavior and modal depth cap.
- `SPEC-004-player-modal`: player-scoped song view implementation.
- `FSD-005-song-modal`: canonical song surface and navigation continuity.
- `SPEC-005-song-modal`: routing, query, and player-modal integration.
- Future `FSD/SPEC-006`: overview song links.

#### CP-06.3 Required correction

- Amend or annotate FSD-004 so the player-scoped song view is either:
  - explicitly superseded by FSD-005; or
  - retained only as a local evidence preview that cannot be mistaken for full
    song detail.
- Define the canonical link behavior for all song mentions before M6:
  round detail, player history, notable picks, overview insights, and search
  readiness surfaces.
- Ensure canonical song detail uses `Song` identity, not current row, title
  string, or player-specific context.
- Preserve origin context only for return behavior and evidence foregrounding.
- Overview song links must target the canonical song surface, not a local
  player- or round-scoped slice.

#### CP-06.4 Verification requirements

- Navigation tests for song links from round detail, player history, notable
  picks, and overview.
- Test proving the same canonical song returns the same memory classification
  from different origin surfaces.
- Regression test proving player modal does not create an alternate song-detail
  hierarchy after FSD-005.

---

### CP-07 — Vote-by-Vote Result Breakdown

**Outcome:** v1 includes a vote-by-vote result breakdown for completed imported
rounds, while keeping vote-budget and missed-deadline explanations out of scope
unless the source facts are available.

#### CP-07.1 Originating gap

- Music League result reveal includes submitters, votes, comments, round
  winners, and standings.
- FSD-003 originally excluded vote-by-vote breakdowns and scoring explainers.
- FSD-001 still supports vote-level queries.
- Product correction: vote-by-vote breakdowns should ship in v1.
- Result: the previous omission should be patched, but vote-budget derivation
  and low-stakes missed-deadline behavior remain separate unresolved scope
  questions.

#### CP-07.2 Affected contracts

- `FSD-001-core-data-model`: vote-based query readiness.
- `FSD-003-round-page`: round detail content and exclusions must be amended.
- `FSD-005-song-modal`: excludes vote-by-vote explainers inside song detail;
  decide whether song detail links to round-level vote evidence or stays
  submission-history-only.
- Future `FSD/SPEC-006`: overview evidence and links.

#### CP-07.3 Required correction

- Add a v1 vote-by-vote breakdown to the appropriate completed-results surface,
  most likely round detail.
- Each vote row must preserve voter, target song/submission, points assigned,
  and vote comment when present.
- Define where vote comments are allowed to appear. Submission comments and vote
  comments must remain distinct.
- Define ordering for vote rows. Candidate orderings include by submitted song
  rank, by target song title, by voter, or by source vote timestamp.
- Define whether the breakdown is grouped by song/submission, by voter, or both.
  The first v1 surface should choose one primary grouping rather than shipping
  an ambiguous matrix.
- Do not infer whether a voter used their full budget unless vote-budget
  settings are known.
- Do not infer missed-voting-deadline or low-stakes penalty behavior unless
  deadline and eligibility facts are known.
- If M6 includes contentious or social insights from voting behavior, require
  each insight to cite vote-level evidence and avoid budget/deadline claims
  unless CP-05 has been resolved for those settings.

#### CP-07.4 Verification requirements

- Query tests distinguishing submission comments from vote comments.
- UI/content tests proving round detail exposes the v1 vote-by-vote breakdown
  for completed imported rounds.
- UI/content tests proving vote comments are visually and semantically distinct
  from submission comments.
- Overview insight tests proving vote-derived claims cite vote data, not rank or
  comment proxies.
- Tests proving unknown vote budgets and deadline settings do not create
  fabricated warnings, penalties, or completion claims.

---

### CP-08 — Artist Identity, Collaboration Strings, and Familiarity Claims

**Outcome:** Same-artist familiarity and artist aggregates are truthful about
the v1 identity model: they operate on exported display strings, not a parsed
artist graph.

#### CP-08.1 Originating gap

- FSD-001 intentionally models a comma-separated `Artist(s)` value as one
  display entity.
- FSD-005 makes same-artist familiarity first-class.
- Milestone 6 source material suggests artist-based insights such as "most
  submitted artist" and "single-handedly keeping [artist] relevant."
- Result: artist claims can be false negatives or misleading for features,
  collaborations, remixes, and differently ordered multi-artist strings.

#### CP-08.2 Affected contracts

- `FSD-001-core-data-model`: artist model and overview aggregate readiness.
- `FSD-005-song-modal`: same-artist familiarity.
- `docs/specs/milestone_6_league_overview.md`: artist stats and insights.
- Future `FSD/SPEC-006`: top artist and artist-based humorous callouts.

#### CP-08.3 Required correction

- Define v1 artist identity copy precisely. Recommended wording: "artist display
  string" or "exported artist label" when making aggregate claims.
- Do not imply parsed collaborator-level truth in M6.
- Same-artist familiarity should be documented as same canonical `Artist`
  record, which currently means normalized exported artist string.
- Add guardrails for artist insight copy so it does not overclaim when the
  artist field contains multiple artists.
- If M6 needs stronger artist truth, split multi-artist modeling must become a
  real prerequisite rather than an implicit assumption.

#### CP-08.4 Verification requirements

- Fixture with a multi-artist exported string.
- Fixture with the same lead artist appearing alone and in a collaboration.
- Song familiarity test documenting current v1 behavior.
- Overview copy test proving artist aggregate labels do not overclaim parsed
  artist identity.

---

### CP-09 — Overview Insight Grounding and External-Metadata Guardrails

**Outcome:** Milestone 6 insights are constrained to canonical archive facts and
do not revive deferred genre, mood, song-length, popularity, or audio-feature
claims.

#### CP-09.1 Originating gap

- Older milestone source material mentions optional genre and average song
  length for player modal ideas.
- FSD-004 correctly excludes genre, mood, duration, and external metadata.
- The Milestone 6 overview source previously gave examples such as sad music
  and long songs; the corrective contract now prohibits those examples unless
  prerequisite source facts are added.
- Result: M6 agents may reintroduce unavailable metadata as if it were product
  truth.

#### CP-09.2 Affected contracts

- `docs/specs/milestone_4_player_modal.md`: original optional genre/song-length
  ideas.
- `FSD-004-player-modal`: external metadata exclusion.
- `docs/specs/milestone_6_league_overview.md`: example insight cards.
- Future `FSD/SPEC-006`: insight derivation and copy.

#### CP-09.3 Required correction

- M6 insights may use only canonical archive facts available in schema and
  import: players, games, rounds, submissions, songs, exported artist strings,
  votes, scores, ranks, dates, playlist URLs, visibility, and comments when the
  surface explicitly allows comments.
- M6 must not use genre, mood, duration, popularity, album, release year, audio
  features, or Spotify enrichment unless a new accepted prerequisite spec adds
  those fields.
- Existing example copy that implies unavailable metadata should be marked as
  illustrative only or replaced.
- Every overview insight template must name its data source and minimum sample
  threshold.
- Funny copy is allowed only when backed by a deterministic signal.

#### CP-09.4 Verification requirements

- Insight-template tests that fail when required source data is absent.
- Test proving generic fallback jokes are omitted rather than fabricated.
- Static review checklist for M6 copy/data-source mapping.

---

### CP-10 — Import Fixture Coverage for Game-Semantics Edge Cases

**Outcome:** Cleanup patches and M6 planning have fixtures that exercise real
Music League semantics rather than only the happy-path clean bundle.

#### CP-10.1 Originating gap

- Existing clean fixtures are useful for import correctness but do not cover all
  semantic edge cases exposed by the game-model audit.
- Several later features depend on cross-game, repeat-song, familiarity, score,
  visibility, and standings behavior.
- Result: agents can implement superficially correct features that pass narrow
  fixtures but fail real league behavior.

#### CP-10.2 Affected contracts

- `FSD-001-core-data-model`: seed dataset.
- `FSD-002-csv-import-pipeline`: validation and replay safety.
- `FSD-003-round-page`: missing metadata and completed-snapshot assumptions.
- `FSD-004-player-modal`: metric normalization.
- `FSD-005-song-modal`: familiarity and cross-game history.
- Future `FSD/SPEC-006`: overview stats, standings, and insights.

#### CP-10.3 Required correction

- Add or identify fixtures for:
  - two games with overlapping round names;
  - repeat exact song across rounds;
  - same artist with a new song;
  - multi-artist display string;
  - negative vote points;
  - vote-by-vote breakdown with voter, target song, points, and vote comment;
  - standings tie;
  - missing score/rank;
  - completed post-vote submissions with any legacy visibility flags documented;
  - sparse one-submission or one-scored-submission player history;
  - stale or unresolvable origin context for modal routes.
- Fixtures should be small enough to reason about by inspection.
- Fixture names should describe the semantic behavior, not only the file shape.

#### CP-10.4 Verification requirements

- Each corrective patch that changes product behavior must name the fixture it
  uses.
- M6 SPEC must include fixture coverage for any overview insight category it
  ships.

---

## 3. Explicit Exclusions

- This ledger does not patch the existing FSDs or SPECs by itself.
- This ledger does not authorize schema migrations, route changes, or UI work
  without a follow-up implementation SPEC.
- This ledger does not require live gameplay features such as creating rounds,
  hosting submissions, running voting, managing deadlines, or administering
  league membership.
- This ledger does not require external metadata enrichment.
- This ledger requires a v1 vote-by-vote result breakdown, but does not require
  vote-budget derivation, missed-deadline detection, or low-stakes penalty
  explanation unless source facts are available.
- This ledger does not settle exact visual presentation for M6 overview.

---

## 4. Cross-cutting Invariants

- **INV-SPEC-PRECEDENCE:** Active SPEC contracts remain binding until explicitly
  amended. This ledger identifies required cleanup; it does not silently
  override shipped contracts.
- **INV-COMPLETED-SNAPSHOTS:** Current product surfaces assume imported game
  data is post-vote and de-anonymized. Pre-reveal import requires a new privacy
  contract before player-song associations are exposed.
- **INV-GAME-PARENTAGE:** Product-facing round semantics are game-scoped. New
  feature work must not infer game grouping from round names, display text, or
  incidental slug fields.
- **INV-VOTE-PROVENANCE:** Scores, ranks, standings, winners, and performance
  claims must be derived from canonical votes or stored derived fields whose
  provenance is canonical votes.
- **INV-VOTE-BREAKDOWN-V1:** Completed round result surfaces include
  vote-by-vote evidence in v1. Budget usage and deadline behavior remain
  unknown unless imported or configured facts establish them.
- **INV-UNKNOWN-SETTINGS:** Unknown source-platform settings must remain
  unknown. Do not validate, explain, or joke as though the setting value is
  known.
- **INV-CANONICAL-SONG:** In-scope song links should resolve to canonical song
  memory unless explicitly labeled as local evidence previews.
- **INV-ARCHIVE-FACTS-ONLY:** M6 insights may use only canonical archive facts
  unless a separate accepted spec adds new metadata sources.
- **INV-LOSSLESS-CLEANUP:** Every patch item must be either implemented,
  explicitly deferred, or rejected with evidence. Do not collapse two items into
  one unless both originating gaps and verification obligations remain visible.

---

## 5. Gate Criteria

- Before SPEC-006 setup, every CP item in §2 has a recorded disposition:
  `patched`, `deferred`, or `rejected`.
- Any deferred item has a guardrail preventing M6 from making false claims in
  that area.
- FSD updates include an explicit completed-snapshots-only import policy.
- FSD updates declare `Game` the canonical parent of `Round`, or document
  the alternative with migration/compatibility implications.
- M6 overview requirements include standings/champion semantics or explicitly
  defer them with a named non-goal.
- V1 cleanup requirements include a vote-by-vote result breakdown and explicitly
  separate it from vote-budget and missed-deadline derivation.
- M6 insight requirements include data-source and sample-threshold rules.
- Fixture coverage exists or is explicitly created for all M6 insight categories
  and all non-deferred corrective patches.

---

## 6. Suggested Cleanup Sequence

1. Patch product semantics first: CP-01 completed snapshots, CP-02 game identity,
   CP-03 standings.
2. Patch derivation semantics next: CP-04 player metrics, CP-05 source settings,
   CP-07 vote-level result boundaries.
3. Patch navigation/memory semantics: CP-06 canonical song detail, CP-08 artist
   identity.
4. Patch M6 guardrails: CP-09 overview insight grounding.
5. Backfill fixtures: CP-10, then run deterministic gates.

The sequence is advisory. If a task bundle splits work differently, preserve
the same dependency logic: M6 overview should not consume unresolved identity,
snapshot-scope, or standings semantics.

---

## 7. Provenance

Primary reference docs:

- `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md`
- `docs/reference/FEATURE_ALIGNMENT_CHECKLIST.md`

Existing product/spec docs audited:

- `docs/specs/FSD-001-core-data-model.md`
- `docs/specs/SPEC-001-core-data-model.md`
- `docs/specs/FSD-002-csv-import-pipeline.md`
- `docs/specs/SPEC-002-csv-import-pipeline.md`
- `docs/specs/FSD-003-round-page.md`
- `docs/specs/FSD-004-player-modal.md`
- `docs/specs/FSD-005-song-modal.md`
- `docs/specs/milestone_6_league_overview.md`

Repo evidence consulted:

- `prisma/schema.prisma`
- `src/import/test-fixtures/clean-bundle/*.csv`

Audit findings preserved:

- completed-snapshot import scope should be explicit so reveal-state mechanics
  are not overbuilt;
- first-class `Game` identity was missing early and later repaired partially;
- cumulative standings and league winner semantics are not first-class enough
  for M6;
- player trait math needs normalization for round shape and participation;
- source game settings and vote-rule provenance are absent;
- player-scoped and round-scoped song detail paths need canonical reconciliation;
- vote-by-vote result breakdowns should ship in v1, while budget/deadline
  derivation remains unresolved unless source facts are available;
- artist familiarity is fragile under v1 artist-display-string modeling;
- M6 insight examples risk reintroducing unavailable external metadata;
- fixture coverage needs to exercise the game semantics above.
