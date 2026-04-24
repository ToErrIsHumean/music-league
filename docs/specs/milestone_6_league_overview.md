# Milestone 6 — League Overview (Source of Truth)

## 🎯 Purpose

Create the primary landing experience that presents the league as a polished, shareable artifact—combining a curated snapshot of key stats with a small set of playful, data-backed insights.

---

## 🧭 Guiding Principles

1. Beauty first (artifact over dashboard)  
2. High signal, low clutter (5–8 elements max)  
3. Social + playful tone (roasty, but grounded)  
4. Fast comprehension (no learning curve)  
5. Optional depth via links (modals / pages)

---

## 🧩 User Story Alignment

> A user opens the app and immediately sees a lively, shared overview of their Music League—surfacing funny patterns, memorable picks, and social dynamics within the group.

---

## 🧱 Core Concept

The **League Overview** is a hybrid:
- **Snapshot**: curated, visually clean summary
- **Insights**: a small set of humorous, data-backed callouts

It should feel like “Spotify Wrapped for your league”.

---

### Corrective Semantic Contract

Milestone 6 is scoped to one selected canonical `Game`. It must not flatten
rounds across games, group by round names, or use `Round.leagueSlug` as the
product grouping boundary.

Supported imported data is a completed, post-vote, de-anonymized snapshot.
`Submission.visibleToVoters` may be displayed or audited as source evidence
only; it is not a current-product privacy gate.

The overview must include a competitive standings or leader signal unless
SPEC-006 explicitly defers it with a false-claim guardrail. Standings are a
derived read model over scored `Submission.score` values within the selected
game, exclude null score/null rank submissions from totals, use dense ranking,
show ties as ties, and must not introduce a persisted standings table. The
read model exposes total score, scored submission count, and distinct scored
round count per player; multiple scored submissions in one round each add to
the total but count as one scored round for that player. Tied leaders may be
ordered by display name and player id for stable rendering only; the fallback
does not create a sole champion. Players with no scored submissions are absent
from standings rows, and the one-game derivation must avoid per-player or
per-round query loops.

Player-performance insights must name their denominator and avoid
durable-tendency copy when the sample is small. The preferred v1 posture is
finish percentile within scored rounds, with small samples shown only when the
copy exposes the denominator or omitted when the claim would overreach.
Finish percentile is `(rank - 1) / max(scoredRoundSize - 1, 1)`, where `0`
is best and `1` is worst. Submission-based claims use scored submissions as
their denominator; submitted-round claims must use a distinct submitted-round
count. Multi-submit rounds count once per scored submission for
submission-based claims and once per player/round for submitted-round claims.
Raw score variance is descriptive context only and must not be used to infer
vote-budget or deadline settings.

Completed round evidence links should resolve to the round-level
vote-by-vote breakdown. That evidence groups by target submission/song,
includes voter, points, voted-at timestamp when present, and vote comment, and
keeps vote comments distinct from submission comments. Empty vote lists do not
remove the submission row.

Song links from the overview target canonical song memory by `Song` identity.
Round, player, or insight origin context may foreground the relevant evidence
row and provide return navigation, but it must not create local song-detail
semantics unless the UI explicitly labels the element as an evidence preview.

Artist aggregate and artist-familiarity copy uses the normalized exported
artist display string as v1 identity. A combined multi-artist export label is
one label for aggregation and familiarity; overview copy must not imply
collaborator-level truth, split-artist attribution, or artist-graph knowledge.

Every shipped insight family must declare this contract before implementation:

```ts
interface InsightTemplateContract {
  id: string;
  sourceFacts: string[];
  scope: "Game" | "Round" | "Player" | "Song" | "Submission" | "Vote" | "mixed";
  denominator: string;
  minimumSample: number;
  omissionCondition: string;
  evidenceLink: {
    kind: "round" | "player" | "song" | "submission" | "vote-breakdown";
    requiresGameContext: boolean;
  };
  copyGuardrails: string[];
}
```

If source facts, denominator, minimum sample, omission condition, and evidence
link cannot be named, the insight is not dispatchable. Unsupported funny copy
is omitted rather than replaced with generic text that sounds factual.

Downstream round, standings, and overview insight work may rely on these
resolved derivations without reopening the pre-M6 questions:

- Standings are game-scoped, derived from scored `Submission.score` totals,
  exclude null score/null rank submissions, use dense ranking, preserve ties,
  and never require a persisted standings table.
- Finish-percentile player claims use `(rank - 1) /
  max(scoredRoundSize - 1, 1)` within each scored round, where `0` is best and
  `1` is worst.
- Submission-based player claims use scored submissions as the denominator;
  submitted-round claims use distinct player/round submissions. Multi-submit
  rounds count per scored submission for submission-based claims and once per
  player/round for submitted-round claims.
- Small-sample claims are allowed only when the copy names or exposes the
  denominator and avoids durable-tendency overclaims.

Vote-budget usage, missed-deadline penalties, disqualification, low-stakes
mode, downvote availability, genre, mood, duration, popularity, album,
release-year, audio-feature, and Spotify-enrichment claims are prohibited
unless a prerequisite spec adds those source facts. Negative vote points remain
valid imported facts; the overview must not infer the source setting that
enabled them.

---

## 🧭 Entry Point

- Default route: `/`
- No login required
- Loads immediately with existing data

---

## 🧩 Page Structure

### 1. Header

- League name (or generic title)
- Optional: subtitle / timeframe

---

### 2. Snapshot (Top Section)

Display 3–5 high-signal items:

Examples:
- Most submitted artist  
- Most active player  
- Standings leader or tied leaders  
- Total rounds / submissions (optional)

Artist-count items aggregate the normalized exported artist display string.
They must not parse collaborators out of combined labels.

Presentation:
- clean cards or simple visual blocks
- designed to be screenshot-friendly

---

### 3. Primary Visual (Optional v1-lite)

- Simple representation of top artists or players
- Can be a list or basic bar-style layout (no heavy charts required)

---

### 4. Insight Cards (Core Personality Layer)

Display 3–5 insights:

Examples:
- “Single-handedly keeping [artist] relevant”  
- “[Player] turned 3 scored submissions into a podium average”

Requirements:
- grounded in real data
- expressible through `InsightTemplateContract`
- short, punchy, readable
- reference real players/songs
- omit unsupported genre, mood, duration, popularity, album, release-year,
  audio-feature, Spotify-enrichment, vote-budget, deadline, disqualification,
  low-stakes, and collaborator-level artist claims

---

### 5. Navigation Hooks

Subtle links to:
- recent rounds  
- player names  
- songs  

These should lead into:
- Player Modal  
- canonical Song Modal by `Song` identity
- Round Page  

---

## 🔗 Interaction Model

- Clicking player → Player Modal  
- Clicking song → canonical Song Modal by `Song` identity
- Clicking round → Round Page  

No heavy navigation UI required.

---

## 🧠 Data Requirements

Requires aggregated data:

- per-player stats  
- per-artist counts  
- submission totals  

Insights should be derived from:
- simple heuristics (v1)
- no complex ML required
- canonical archive facts already imported or derived in current scope:
  players, games, rounds, submissions, songs, normalized exported artist
  labels, votes, scores, ranks, dates, playlist URLs, visibility flags as
  source evidence, and comments where an insight template explicitly permits
  them

Each insight category requires a named fixture or fixture plan before SPEC-006
can dispatch implementation. Small samples are allowed only when the insight
names or exposes the denominator and the copy avoids durable-tendency claims.

---

## ⚡ UX Expectations

- Page loads quickly (<1s perceived)
- Content understandable in <5 seconds
- Visually clean and spaced
- Encourages clicking and exploration

---

## ❌ Non-Goals (v1)

Do NOT include:
- large dashboards  
- dense tables  
- advanced filtering  
- complex visualizations  
- infinite scrolling feeds  

---

## ✅ Acceptance Criteria

- User can open `/` and see:
  - league title  
  - 3–5 stats  
  - 3–5 insights  
- Overview data is scoped to one selected `Game`
- A standings/leader item is derived from scored `Submission.score` totals or
  explicitly deferred by SPEC-006 with a false-claim guardrail
- Tied standings remain visibly tied and never fabricate a sole champion
- Standings expose scored submission and distinct scored round counts; multiple
  scored submissions in one round all contribute to the player's total score
- Missing score/rank data suppresses or caveats outcome-dependent claims
- Player-performance insight copy names or exposes its denominator when the
  sample is small
- Unsupported metadata, vote-budget, deadline, disqualification, and low-stakes
  explanations are omitted
- Vote-derived evidence links resolve to round-level vote breakdowns without
  conflating submission comments with vote comments
- Song links resolve to canonical song memory by `Song` identity unless
  explicitly labeled as local evidence previews
- Artist aggregates and familiarity claims use normalized exported artist
  display strings and prohibit collaborator-level overclaims
- Each shipped insight template declares source facts, scope, denominator,
  minimum sample, omission condition, evidence link, and copy guardrails
- At least one element feels “funny/true”
- Elements link to deeper exploration:
  - Player modal  
  - Song modal  
  - Round page  
- Page is visually clean and not cluttered

---

## 🧭 Open Questions (for architect)

1. Should insights be:
   - computed on page load  
   - precomputed after import?

2. How should missing or low-volume data be handled?

Missing or low-volume data must be handled by each insight's
`minimumSample`, `denominator`, and `omissionCondition`; it is not an open
license for unsupported fallback claims.

---

## Pre-M6 Corrective Patch Dispositions

| CP | Disposition | Patched contracts | Verification |
| --- | --- | --- | --- |
| CP-01 completed snapshots | patched | Completed, post-vote, de-anonymized snapshot assumption in this M6 overview contract and PRE-M6 ledger disposition | AC-01, AC-02, AC-11 |
| CP-02 game identity | patched | One selected canonical `Game` scope and no `Round.leagueSlug` product grouping in this M6 overview contract and PRE-M6 ledger disposition | AC-01, AC-03, AC-11 |
| CP-03 standings | patched | Derived game-scoped standings contract in this M6 overview contract and PRE-M6 ledger disposition | AC-01, AC-04, AC-12, AC-13 |
| CP-04 normalized player metrics | patched | Finish percentile, denominator, multi-submit, and small-sample contract in this M6 overview contract and PRE-M6 ledger disposition | AC-01, AC-05, AC-11, AC-13 |
| CP-05 source settings | patched | Unknown vote-budget, deadline, disqualification, low-stakes, downvote, and unsupported-setting prohibitions in this M6 overview contract and PRE-M6 ledger disposition | AC-01, AC-06, AC-11 |
| CP-06 canonical song detail | patched | `FSD-003` F5.1; `SPEC-003` §4c/§4d-5; `FSD-004` F3.1; `SPEC-004` §4a/§7; `FSD-005` F1/F2; `SPEC-005` §4d-3/§4d-5; this M6 overview contract | AC-01, AC-07, AC-11 |
| CP-07 vote breakdown | patched | Round-level vote-breakdown evidence-link contract in this M6 overview contract and PRE-M6 ledger disposition | AC-01, AC-08, AC-11 |
| CP-08 artist identity | patched | `FSD-005` F1; `SPEC-005` §4d-1; this M6 overview artist aggregate and insight contract | AC-01, AC-09, AC-11 |
| CP-09 insight grounding | patched | this M6 overview insight-template, data-source, omission, and unsupported-claim contract | AC-01, AC-10, AC-13 |
| CP-10 fixtures | patched | PRE-M6 fixture coverage requirement retained for TASK-04 fixture manifest and downstream consumers | AC-11 |

---

## 🔗 Dependencies

- Requires Milestone 1 (data model)
- Uses data from Milestone 2 (import pipeline)
- Integrates with:
  - Milestone 3 (round page)
  - Milestone 4 (player modal)
  - Milestone 5 (song modal)

---

## 🚀 Next

Backlog & Feature Expansion (post-v1 iteration)
