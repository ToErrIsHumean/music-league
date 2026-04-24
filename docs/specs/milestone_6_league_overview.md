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
- short, punchy, readable
- reference real players/songs
- omit unsupported genre, mood, duration, vote-budget, and deadline claims

---

### 5. Navigation Hooks

Subtle links to:
- recent rounds  
- player names  
- songs  

These should lead into:
- Player Modal  
- Song Modal  
- Round Page  

---

## 🔗 Interaction Model

- Clicking player → Player Modal  
- Clicking song → Song Modal  
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
