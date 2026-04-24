## 1. Objective

Before Milestone 6 planning is dispatched, the repo must reconcile existing product contracts with the canonical Music League game model so overview, standings, round evidence, player metrics, song memory, and insight copy are not built on incomplete assumptions. This spec turns the corrective patch ledger into dispatchable cleanup work: each CP item is either patched into the relevant contracts and fixtures or explicitly prohibited from M6 inference. The user-visible outcome is a more truthful archive product that treats a game as a competitive Music League artifact, with votes, standings, submissions, players, songs, and source uncertainty represented without fabrication.

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| Corrective patch ledger | `docs/specs/PRE-M6-CORRECTIVE-PATCH-LEDGER.md` | Product source for CP-01 through CP-10 and the required pre-M6 cleanup outcomes. |
| Game model reference | `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md` | Secondary heuristic for this run: game-model accuracy. Defines Game -> Round -> Submission/Vote semantics, scoring provenance, and archive posture. |
| Feature alignment checklist | `docs/reference/FEATURE_ALIGNMENT_CHECKLIST.md` | Review guardrails for game parentage, submission identity, vote/scoring semantics, song memory, player memory, and import integrity. |
| Core data model FSD/SPEC | `docs/specs/FSD-001-core-data-model.md`, `docs/specs/SPEC-001-core-data-model.md` | Earlier contracts model vote provenance and artist display strings, but older source text still underemphasizes first-class `Game` identity and completed-snapshot assumptions. |
| CSV import FSD/SPEC | `docs/specs/FSD-002-csv-import-pipeline.md`, `docs/specs/SPEC-002-csv-import-pipeline.md` | Defines four-file bundle import, staging, `ImportBatch.gameKey`, replay safety, negative point parsing, and vote-derived score/rank recomputation. |
| Round page FSD/SPEC | `docs/specs/FSD-003-round-page.md`, `docs/specs/SPEC-003-round-page.md` | Establishes game-first browsing and explicit `Game`; currently excludes dense vote breakdowns, which CP-07 reverses for v1 completed results. |
| Player modal FSD/SPEC | `docs/specs/FSD-004-player-modal.md`, `docs/specs/SPEC-004-player-modal.md` | Defines rank/score-derived traits and notable picks; needs pre-M6 normalization guardrails for round size, denominators, multi-submit cases, and low-sample claims. |
| Song modal FSD/SPEC | `docs/specs/FSD-005-song-modal.md`, `docs/specs/SPEC-005-song-modal.md` | Supersedes player-scoped song slices with canonical song memory; M6 links must inherit that destination model. |
| Milestone 6 source doc | `docs/specs/milestone_6_league_overview.md` | Experience brief for M6; contains examples that require correction because some rely on unsupported metadata such as mood or song length. |
| Prisma schema | `prisma/schema.prisma` | Current schema includes `Game`, `Round.gameId`, compatibility `Round.leagueSlug`, `ImportBatch.gameKey`, `Submission.visibleToVoters`, `Submission.score/rank`, and vote rows/comments. |
| Archive loaders/UI | `src/archive/archive-utils.js`, `src/archive/game-archive-page.js`, `src/archive/song-memory.js` | Existing browse, round detail, player modal, and song memory code. Player metric code already contains a finish-percentile helper shape; round detail lacks a v1 vote-by-vote breakdown. |
| Import fixtures/tests | `src/import/test-fixtures/**`, `src/import/*.test.js`, `prisma/tests/*.test.js`, `src/archive/song-memory.test.js` | Existing fixtures cover clean, replay, missing-required, and duplicate cases. CP-10 requires additional small semantic fixtures for overlapping games, standings ties, negative points, comments, sparse histories, and stale origin context. |

## 3. Invariants

- **INV-01:** Supported current-product imports are completed, post-vote, de-anonymized Music League exports. `Submission.visibleToVoters` may remain stored as source evidence or compatibility ballast, but current product surfaces must not treat it as an active privacy gate.
- **INV-02:** Pre-reveal or in-progress import support is not added by this cleanup. Any future feature that imports unrevealed player-song associations must introduce a privacy/reveal-state contract before exposing those associations.
- **INV-03:** `Game` is the canonical parent of `Round`. Product-facing grouping, links, standings, overview aggregation, song memory, and player history must use `gameId`/`Game` semantics, not round names, display labels, or `Round.leagueSlug` inference.
- **INV-04:** `Round.leagueSlug` is compatibility metadata in current scope. New feature code must not use it to infer game grouping unless an active spec explicitly authorizes that compatibility path.
- **INV-05:** Votes are the provenance for score, rank, standings, winners, champions, leaders, and performance claims. Stored `Submission.score` and `Submission.rank` are acceptable only as vote-derived fields.
- **INV-06:** M6 standings are a derived read model, not a persisted schema entity. This spec must not add `Standing`, `Leaderboard`, or equivalent tables.
- **INV-07:** Unknown source settings remain unknown. Vote budgets, deadline penalties, low-stakes behavior, songs-per-round rules, and downvote availability must not be inferred from absence, odd scores, or local intuition.
- **INV-08:** Negative vote points are valid imported facts and must not be rejected solely because they are negative.
- **INV-09:** Completed round result surfaces include v1 vote-by-vote evidence. Submission comments and vote comments must remain distinct, and vote-budget/deadline explanations remain out of scope unless source facts establish them.
- **INV-10:** Song mentions in round, player, overview, and search-readiness surfaces resolve to canonical `Song` memory unless explicitly labeled as local evidence previews.
- **INV-11:** Artist identity in v1 means the normalized exported artist display string. Copy must not imply parsed collaborator-level truth from combined artist labels.
- **INV-12:** Player performance claims must name their denominator and avoid low-sample overclaims. Small samples are allowed when the copy remains factual about the sample size. Rank-first evidence remains valid, but M6 overview claims must account for round size and scored-submission count.
- **INV-13:** M6 insights may use only canonical archive facts already imported or derived in current scope: players, games, rounds, submissions, songs, exported artist labels, votes, scores, ranks, dates, playlist URLs, visibility flags as source evidence, and comments where the surface explicitly allows them.
- **INV-14:** Unsupported genre, mood, duration, popularity, album, release-year, audio-feature, Spotify-enrichment, vote-budget, or deadline claims are omitted rather than replaced with generic copy that sounds factual.
- **INV-15:** Every CP item from the ledger must retain traceability to a disposition, contract, task, and verification obligation. Overlapping fixes may be merged only when both originating gaps and verification obligations remain visible.
- **INV-16:** Within a supported imported round, a canonical song identity appears at most once as a submission. This uniqueness is by canonical `Song.id` / Spotify URI, not by title, display name, or artist text. Same-title or same-name collisions with different song IDs must not be treated as duplicate-song violations.

## 7. Out of Scope

- [ ] Implementing the Milestone 6 overview page itself - this cleanup prepares the contracts and helpers that SPEC-006 must consume.
- [ ] Using the Milestone 6 corrective addendum as source input for this spec - per authoring direction, this bootstrap consumes the corrective patch ledger directly.
- [ ] Adding live gameplay features such as creating rounds, hosting submissions, running votes, enforcing deadlines, or administering league membership - the current product is an import-backed archive.
- [ ] Importing or exposing pre-reveal player-song associations - requires a future privacy/reveal-state contract.
- [ ] Persisting standings, leaderboard, source-settings, artist-collaboration, genre, mood, duration, popularity, album, release-year, audio-feature, or Spotify-enrichment schema - not required for pre-M6 cleanup.
- [ ] Inferring vote budgets, missed-deadline penalties, low-stakes behavior, or downvote availability from outcome data - source facts are absent in the supported CSV contract.
- [ ] Building collaborator-level artist identity from multi-artist display strings - v1 artist identity is the exported artist label.
- [ ] Adding global search, recommendations, ML-generated insights, dense dashboards, advanced filtering, or complex charts - not required to correct game semantics.
- [ ] Rewriting existing active SPEC acceptance criteria silently - this cleanup must amend or annotate contracts explicitly rather than relying on implied precedence.

## 8. Open Questions

- **OQ-01:** Are any CP items intentionally not to be patched before SPEC-006? - **Resolution:** `resolved -> §4d-1, §5 AC-01` (bootstrap targets `patched` for all CP items; `deferred` or `rejected` requires explicit evidence and traceability during implementation).
- **OQ-02:** Should standings use the §4d-3 derivation: scored submissions only, submitted-song score totals, dense ranking by total score, players with no scored submissions excluded, and multi-submit rounds counting once per scored submission? - **Resolution:** `resolved -> §4d-3, §5 AC-04, §5 AC-13` (HITL: standings are descending rank of players by cumulative vote points for their submitted songs; implementation may choose any accurate, computationally cheap derivation).
- **OQ-03:** What primary grouping should v1 vote breakdown use? - **Resolution:** `resolved -> §3 INV-16, §4c-1` (group by the uniquely resolvable target submission/song for canonical `Song.id` within the round; song title/name is not identity).
- **OQ-04:** Which normalized player-performance derivations are acceptable for M6 claims: finish percentile formula, win-rate denominator, multi-submit treatment, raw score variance posture, and minimum sample threshold? - **Resolution:** `resolved -> §4d-4, §5 AC-05, §5 AC-13` (HITL: finish percentile is acceptable for now; small samples are acceptable if copy names/exposes the denominator and avoids durable-tendency overclaiming).
- **OQ-05:** What minimum sample thresholds should M6 insight families use when the threshold is not already entailed by a source fact or existing spec? - **Resolution:** `resolved -> §4c-2, §4d-4, §5 AC-13` (HITL: small sample size is acceptable; unresolved threshold choices should not block factual insights, but each shipped insight still names `minimumSample` and its omission condition).

---

## Appendix D: Discoveries Log

No discoveries recorded.

---
