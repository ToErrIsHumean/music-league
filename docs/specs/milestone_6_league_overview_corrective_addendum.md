# Milestone 6 Corrective Addendum - League Overview
## Game-Semantics Corrections for SPEC-006 Preparation

**Status:** Draft
**Created on:** 2026-04-24
**Sister document:** `docs/specs/milestone_6_league_overview.md`
**Builds on:** `docs/specs/PRE-M6-CORRECTIVE-PATCH-LEDGER.md`
**Reference model:** `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md`,
`docs/reference/FEATURE_ALIGNMENT_CHECKLIST.md`

---

## 1. Purpose

This addendum corrects Milestone 6 before SPEC-006 is authored. The original
Milestone 6 document establishes the desired product feel: a polished,
shareable, funny, low-clutter overview. This document adds the missing Music
League semantics that keep that overview truthful.

Milestone 6 must present a league/game as a Music League results artifact, not
as a generic music-library dashboard. Playful copy remains in scope, but every
claim must be grounded in canonical archive facts and must preserve game,
round, submission, vote, player, and song identity.

This addendum does not authorize implementation by itself. SPEC-006 must carry
these corrections into explicit contracts, acceptance criteria, task boundaries,
and fixture requirements.

---

## 2. Corrected Product Frame

The League Overview is a game-scoped archive landing surface:

- It summarizes one canonical `Game` at a time, even when user-facing copy says
  "league".
- It combines a small snapshot of high-signal outcomes with a small set of
  deterministic, evidence-backed insights.
- It foregrounds Music League memory: who submitted what, what round made it
  matter, what the voting outcome was, and what patterns the group would
  recognize.
- It links onward to canonical round, player, and song surfaces without
  creating alternate local meanings for those entities.

The overview may still be screenshot-friendly and aesthetically polished. Those
qualities are presentation goals, not permission to omit source provenance or
invent unsupported claims.

---

## 3. M6 Corrective Invariants

- **M6-INV-01: Game parentage.** Overview aggregates are scoped to one
  canonical `Game`. New M6 code must not infer parentage from round names,
  display text, `leagueSlug`, or incidental import labels unless SPEC-006
  explicitly authorizes that behavior.
- **M6-INV-02: Completed snapshots.** Current M6 surfaces assume supported
  imports are completed, post-vote, de-anonymized Music League exports.
  Submitter-song associations may be shown under that assumption. Pre-reveal
  import support requires a separate privacy/reveal-state contract.
- **M6-INV-03: Vote provenance.** Scores, ranks, standings, winners, champions,
  leaders, and performance claims must derive from canonical votes or stored
  derived fields whose provenance is canonical votes.
- **M6-INV-04: No persisted standings.** M6 standings are a derived read model.
  M6 must not add a persisted `Standing`, `Leaderboard`, or equivalent schema
  entity.
- **M6-INV-05: Unknown settings stay unknown.** Vote budgets, deadline
  penalties, low-stakes mode, and other source-platform settings must not be
  inferred from absence, odd-looking scores, or local intuition.
- **M6-INV-06: Canonical song links.** Song links from the overview target the
  canonical song-memory surface by canonical song identity, not a
  player-scoped, round-scoped, title-only, or row-local slice.
- **M6-INV-07: Archive facts only.** M6 insights may use only canonical archive
  facts currently imported or derived in repo scope: games, rounds, players,
  submissions, songs, exported artist labels, votes, scores, ranks, dates,
  playlist URLs, visibility flags as source evidence, and comments where the
  surface explicitly allows them.
- **M6-INV-08: Omit unsupported claims.** If an insight lacks its required
  source data, denominator, or minimum sample threshold, it is omitted rather
  than replaced by generic copy that sounds factual.

---

## 4. Required Corrections to the Original M6 Scope

### 4.1 Entry and Game Selection

The original entry point remains `/`, but SPEC-006 must define what game that
route represents when multiple games exist. Acceptable v1 shapes include:

- render the deterministically selected latest game;
- render an explicit selected game from route or URL state; or
- render a minimal game chooser before the overview.

SPEC-006 must choose one. It must not silently flatten multiple games into one
overview.

### 4.2 Snapshot Content

The snapshot should still contain 3-5 high-signal items, but at least one item
must represent the competitive spine of Music League unless SPEC-006 explicitly
defers it with a named non-goal.

Aligned snapshot candidates:

- standings leader or tied leaders;
- total rounds and total submissions in the selected game;
- top exported artist label;
- most active submitting player;
- most repeated exact song;
- closest round by score spread;
- biggest winning submission by score margin, when score data supports it.

Misaligned snapshot candidates unless new data sources are added:

- longest average song picker;
- saddest music;
- genre, mood, popularity, album, release-year, audio-feature, or Spotify
  enrichment claims.

### 4.3 Standings and Champion Semantics

SPEC-006 must define a derived standings read model:

- Scope: one `Game`.
- Unit: player.
- Source: each player's submitted songs' canonical `Submission.score` values.
- Inclusion: SPEC-006 must state whether all rounds, only scored rounds, or
  another explicit subset contributes.
- Missing data: missing score or rank means incomplete outcome data, not a loss.
- Ties: tied standings must be displayed as tied; arbitrary sort order must not
  create a fabricated sole champion.
- Persistence: no M6 standings table.

Copy constraints:

- "Winner", "champion", "leader", "first place", and equivalent language must
  be backed by the standings rule or by a specific round-level rank/score rule.
- Most submissions, most comments, or most wins must not be conflated with
  league champion.

### 4.4 Insight Cards

The overview may show 3-5 insight cards, but every shipped insight template must
declare the following in SPEC-006:

| Field | Requirement |
| --- | --- |
| Source facts | The canonical fields or derived read model used. |
| Scope | `Game`, `Round`, `Player`, `Song`, `Submission`, `Vote`, or explicit combination. |
| Denominator | Submitted rounds, scored submissions, all game rounds, votes, comments, or another named basis. |
| Minimum sample | The threshold below which the insight is omitted or caveated. |
| Omission condition | The exact missing-data or low-volume condition that suppresses the card. |
| Evidence link | The canonical player, song, or round destination that substantiates the claim. |

Recommended v1 insight families:

- repeat exact-song memory;
- familiar exported artist label with a new song;
- player with unusually many submissions, using an explicit denominator;
- dominant scored submission in a round;
- unusually close round by score spread;
- standings leader or tied leaders;
- frequently commented submission or vote, only when comments are within the
  chosen overview surface.

Forbidden v1 insight families unless a separate accepted spec adds data:

- genre, mood, tempo, valence, energy, danceability, popularity, release year,
  album, duration, audio features, or recommendations;
- vote-budget usage, missed-deadline penalties, disqualification, or low-stakes
  behavior;
- title-only song identity claims when Spotify URI is available;
- parsed collaborator-level artist claims from a combined exported artist label.

### 4.5 Artist Identity

M6 may aggregate artists only according to the current v1 artist model:

- The claim should say or imply "exported artist label" rather than parsed
  person/band identity when precision matters.
- A multi-artist export string is one artist label in v1.
- A lead artist appearing alone and the same lead artist appearing in a
  collaboration are not guaranteed to aggregate together in v1.
- If the product wants collaborator-level truth, artist splitting must become a
  prerequisite spec rather than an implicit M6 behavior.

### 4.6 Player Performance Claims

Player performance insights must be normalized enough to avoid socially
misleading results across different round shapes.

SPEC-006 must define:

- whether player claims use scored submissions, submitted rounds, all game
  rounds, or eligible rounds as the denominator;
- how multi-submit rounds count;
- whether score variance uses raw points, normalized points, or is excluded
  while vote-budget settings are unknown;
- a minimum sample threshold for player-level overview claims.

Preferred v1 metric: finish percentile within a scored round, where first place
is best and last place is worst. Raw average rank is not sufficient when round
sizes vary.

### 4.7 Vote and Comment Boundaries

Vote-by-vote result evidence belongs in v1 completed-results surfaces, most
likely round detail. M6 may link to that evidence, but it must not invent
budget/deadline explanations.

If M6 uses vote-derived or comment-derived insights:

- submission comments and vote comments must remain distinct;
- vote rows must preserve voter, target song/submission, points assigned, and
  vote comment when present;
- unknown vote budgets must not block display of known imported votes;
- overview copy must not claim that a player was penalized, disqualified,
  downvoted, or failed to use their budget unless imported or configured facts
  establish that claim.

### 4.8 Navigation and Context

Overview links must preserve canonical destination semantics:

- player mention -> Player Modal by stable player identity;
- song mention -> canonical Song Modal by canonical song identity;
- round mention -> game-scoped Round Page;
- standings item -> player and/or supporting scored submissions with game
  context preserved.

Deep links or URL state should identify the opened round, song, or player
without depending on prior in-app clicks. If a return path or origin highlight
is used, it is contextual chrome, not a different entity definition.

---

## 5. Revised Acceptance Criteria for SPEC-006

SPEC-006 should replace the original subjective acceptance criteria with
testable criteria at least as strong as these:

| ID | Condition | Verification |
| --- | --- | --- |
| M6-AC-01 | Opening `/` resolves to exactly one selected `Game` overview or a deliberate game-selection state. | integration/manual |
| M6-AC-02 | The overview shows 3-5 snapshot items derived only from canonical archive facts for the selected game. | test/manual |
| M6-AC-03 | The overview includes standings/champion/leader semantics derived from `Submission.score`, or SPEC-006 explicitly defers that capability with a named non-goal and false-claim guardrail. | test/spec review |
| M6-AC-04 | Tied standings remain visibly tied and do not produce an arbitrary sole champion. | test |
| M6-AC-05 | Missing score or rank suppresses or caveats outcome-dependent claims without hiding unrelated submissions. | test |
| M6-AC-06 | Each shipped insight template declares source facts, scope, denominator, minimum sample, omission condition, and evidence link. | spec review |
| M6-AC-07 | Unsupported metadata insights are absent unless a separate accepted prerequisite spec adds those fields. | test/spec review |
| M6-AC-08 | Artist aggregate copy does not overclaim beyond exported artist-label identity. | test/manual |
| M6-AC-09 | Player performance claims use a normalized or explicitly bounded metric and avoid low-sample overclaims. | test/spec review |
| M6-AC-10 | Player, song, and round links open canonical destinations while preserving game context. | integration/manual |
| M6-AC-11 | Vote-derived or comment-derived overview claims cite the correct canonical evidence and keep vote comments distinct from submission comments. | test |
| M6-AC-12 | The page remains visually clean and low-clutter while satisfying the semantic criteria above. | manual |

---

## 6. Required Fixture Coverage

SPEC-006 must name or create fixtures for every insight category it ships. At
minimum, M6 planning should cover:

- two games with overlapping or similar round names;
- multiple rounds where cumulative points produce a clear standings leader;
- a standings tie;
- missing score or rank;
- negative vote points;
- repeat exact song across rounds;
- same exported artist label with a new song;
- multi-artist exported artist label;
- sparse one-submission or one-scored-submission player history;
- vote rows with voter, target song/submission, points, and vote comment;
- submission comments and vote comments in the same fixture without conflation.

Fixtures should be small enough to audit by inspection. Fixture names should
describe the semantic behavior being exercised, not only the CSV shape.

---

## 7. Required Dispositions Before SPEC-006 Dispatch

Before SPEC-006 is dispatched, each item in
`PRE-M6-CORRECTIVE-PATCH-LEDGER.md` must have one disposition:

- `patched` into the relevant FSD/SPEC or this addendum's SPEC-006 contract;
- `deferred` with a guardrail that prevents M6 from making false claims; or
- `rejected` with evidence.

Minimum expected disposition for this addendum:

| Patch | Expected SPEC-006 treatment |
| --- | --- |
| CP-01 Completed Snapshot Assumption | Patch into M6 invariants and import assumptions. |
| CP-02 Game Identity | Patch into overview scoping and route/query contracts. |
| CP-03 Standings | Patch into derived read model and snapshot content, or explicitly defer. |
| CP-04 Player Metrics | Patch into insight denominators, normalization, and thresholds. |
| CP-05 Source Settings | Patch into unknown-settings guardrails and copy prohibitions. |
| CP-06 Canonical Song Detail | Patch into overview link contracts. |
| CP-07 Vote-by-Vote Breakdown | Patch into evidence-link behavior; round-detail implementation may remain in the relevant round spec if sequenced separately. |
| CP-08 Artist Identity | Patch into artist aggregate copy and tests. |
| CP-09 Insight Grounding | Patch into insight-template contract and non-goals. |
| CP-10 Fixture Coverage | Patch into SPEC-006 acceptance criteria and test plan. |

No corrective patch should disappear merely because it is inconvenient or
because the original Milestone 6 document did not mention it.

---

## 8. Non-Goals Preserved From Milestone 6

The corrective semantics above do not require M6 to become a dense dashboard.
The following remain out of scope for v1 unless SPEC-006 explicitly changes
direction:

- large dashboards;
- dense tables;
- advanced filtering;
- complex visualizations;
- infinite scrolling feeds;
- live submission, voting, deadline, or league-administration features;
- external metadata enrichment;
- ML-generated or recommendation-style insights;
- manual import arbitration UI;
- persisted standings schema.

---

## 9. Open Questions for SPEC-006

- **M6-OQ-01:** Which game does `/` show when multiple games exist?
  **Resolution required before SPEC-006 approval.**
- **M6-OQ-02:** Are insights computed on page load or materialized after import?
  **Resolution required before SPEC-006 approval.** Either is acceptable if no
  new persisted semantic entity is introduced without justification.
- **M6-OQ-03:** What exact minimum sample thresholds suppress player and insight
  claims?
  **Resolution required before SPEC-006 approval.**
- **M6-OQ-04:** Does M6 include standings/champion in v1, or explicitly defer it?
  **Resolution required before SPEC-006 approval.**
- **M6-OQ-05:** Which vote-by-vote result surface is canonical for evidence links
  from the overview?
  **Resolution required before SPEC-006 approval if M6 links to vote evidence.**

---

## 10. Authoring Instruction for SPEC-006

When authoring SPEC-006, treat the original Milestone 6 document as the
experience brief and this addendum as the semantic correction layer. If the two
conflict, preserve the addendum's game-model constraints unless a human
explicitly authorizes a different product direction.

SPEC-006 should not proceed to implementation until:

- all M6 open questions above are resolved or explicitly excluded;
- every shipped insight has a data-source contract;
- every corrective ledger item has a disposition;
- fixture coverage exists or is created for all shipped insight categories;
- acceptance criteria are testable rather than purely subjective.
