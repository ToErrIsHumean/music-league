# SPEC: Pre-M6 Corrective Game-Semantics Cleanup

> **Version:** 0.1.4-draft
> **Milestone:** Pre-M6 - corrective cleanup before league overview planning
> **Status:** `draft`
> **Author:** final-review 1
> **Depends-on:** `docs/specs/PRE-M6-CORRECTIVE-PATCH-LEDGER.md`, `docs/specs/SPEC-001-core-data-model.md`, `docs/specs/SPEC-002-csv-import-pipeline.md`, `docs/specs/SPEC-003-round-page.md`, `docs/specs/SPEC-004-player-modal.md`, `docs/specs/SPEC-005-song-modal.md`
> **Invalidated-by:** changes to `docs/specs/PRE-M6-CORRECTIVE-PATCH-LEDGER.md`, `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md`, or any accepted replacement for `SPEC-001` through `SPEC-005`

---

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

## 4. Interface Contracts

### 4a. API Surface

No new HTTP endpoint is introduced by this cleanup. Existing page routes and query-param behavior may be extended only through archive loader/component contracts below.

### 4b. Data Schema (migrations)

#### §4b-1. No schema migration

```sql
-- Migration: none
-- Direction: no-op
-- Rollback: no-op
```

- No persisted standings, leaderboard, source-settings, artist-collaboration, genre, mood, duration, or enrichment tables are introduced.
- Fixture files and tests may be added.
- Existing schema fields may be documented more precisely: `Game.sourceGameId`, `ImportBatch.gameKey`, `Round.gameId`, `Round.leagueSlug`, `Submission.visibleToVoters`, `Submission.score`, `Submission.rank`, `Vote.pointsAssigned`, and vote/submission comments.

### 4c. Component Contracts

#### §4c-1. Round result vote breakdown section

```ts
interface RoundVoteBreakdownSectionProps {
  roundId: number;
  groups: Array<{
    submissionId: number;
    song: { id: number; title: string; artistName: string };
    submitter: { id: number; displayName: string };
    rank: number | null;
    score: number | null;
    submissionComment: string | null;
    votes: Array<{
      voter: { id: number; displayName: string };
      pointsAssigned: number;
      votedAt: string | null;
      voteComment: string | null;
    }>;
  }>;
}
```

- Primary grouping is by target submission/song, ordered by the same submission order as round detail: `rank ASC NULLS LAST`, then deterministic fallback from the existing round detail contract.
- The target submission/song is resolvable because INV-16 prohibits duplicate canonical `Song.id` submissions inside one supported round.
- Votes within a group order by `pointsAssigned DESC`, then voter display name, then vote row id or equivalent stable fallback.
- The section labels vote comments as vote comments and submission comments as submission comments.
- Empty vote lists are allowed for unscored or partially imported submissions and must not suppress the submission row.
- The section must not display vote-budget usage, missed-deadline, disqualification, or low-stakes explanations.

#### §4c-2. M6 insight contract patch template

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

- Every M6 insight family shipped after this cleanup must be expressible in this shape.
- If `sourceFacts`, `denominator`, or `minimumSample` cannot be named, the insight is not dispatchable.

### 4d. Internal Boundaries

#### §4d-1. Corrective patch disposition record

```ts
type CorrectivePatchId =
  | "CP-01"
  | "CP-02"
  | "CP-03"
  | "CP-04"
  | "CP-05"
  | "CP-06"
  | "CP-07"
  | "CP-08"
  | "CP-09"
  | "CP-10";

interface CorrectivePatchDisposition {
  id: CorrectivePatchId;
  disposition: "patched" | "deferred" | "rejected";
  patchedContracts: string[];
  verification: string[];
  guardrail?: string;
  evidence?: string;
}
```

- This cleanup targets `patched` for all CP items.
- If implementation evidence proves an item is not applicable, the disposition may become `rejected` only with explicit evidence in the edited source document.
- Any `deferred` outcome must include a false-claim guardrail and requires backlog handling under the spec-authoring governance rules.

Required ownership map:

| CP | Source-contract owner | Downstream implementation owner | Verification anchors |
|---|---|---|---|
| CP-01 completed snapshots | TASK-01 | TASK-05 | AC-01, AC-02, AC-11 |
| CP-02 game identity | TASK-01 | TASK-05 | AC-01, AC-03, AC-11 |
| CP-03 standings | TASK-01 | TASK-07 | AC-01, AC-04, AC-12, AC-13 |
| CP-04 normalized player metrics | TASK-02 | TASK-08 | AC-01, AC-05, AC-11, AC-13 |
| CP-05 source settings | TASK-02 | TASK-05, TASK-06 | AC-01, AC-06, AC-11 |
| CP-06 canonical song detail | TASK-03 | TASK-08 | AC-01, AC-07, AC-11 |
| CP-07 vote breakdown | TASK-02 | TASK-06 | AC-01, AC-08, AC-11 |
| CP-08 artist identity | TASK-03 | TASK-08 | AC-01, AC-09, AC-11 |
| CP-09 insight grounding | TASK-03 | Future SPEC-006 implementation | AC-01, AC-10, AC-13 |
| CP-10 fixtures | TASK-04 | TASK-05, TASK-06, TASK-07, TASK-08 | AC-11 |

- Source-contract owner tasks patch the named FSD/SPEC/source documents and record the CP disposition; they do not implement downstream code behavior unless their task text explicitly says so.
- Downstream implementation owner tasks may rely on the source-contract owner and fixture manifest rather than rediscovering CP intent from the ledger.

#### §4d-2. Round detail loader vote evidence

```ts
async function getRoundDetail(roundId: number, input?: ArchiveInput): Promise<{
  id: number;
  game: { id: number; sourceGameId: string; displayName: string | null };
  submissions: Array<RoundDetailSubmission>;
  voteBreakdown: RoundVoteBreakdownSectionProps["groups"];
} | null>
```

- The loader must hydrate votes by `roundId` and target canonical `songId`, joining each vote to its voter and the single supported target submission for that canonical song in the same round.
- If multiple submissions in the same round share the same canonical `songId`, that is outside supported product data under INV-16; implementation must treat it as an import/data anomaly or escalate rather than inventing per-submitter vote attribution.
- If a vote cannot be attached to a submission in the same round, existing import/recompute validation should already prevent committed state; the loader may omit impossible rows only if a test documents the degraded behavior.
- Query cost must be linear or near-linear in submissions plus votes for one round. No per-submission N+1 vote query is allowed.

#### §4d-3. Derived game standings read model

```ts
interface GameStandingRow {
  player: { id: number; displayName: string };
  totalScore: number;
  scoredSubmissionCount: number;
  scoredRoundCount: number;
  rank: number;
  tied: boolean;
}

function deriveGameStandings(submissions: Array<{
  playerId: number;
  playerName: string;
  roundId: number;
  score: number | null;
  rank: number | null;
}>): GameStandingRow[]
```

- Scope is one `Game`.
- Standings rank players descending by cumulative vote points for their submitted songs.
- Implementation may derive from canonical votes directly or from stored `Submission.score` when those scores are maintained as vote-derived fields.
- Inclusion is scored submissions only: `score !== null` and `rank !== null`; unscored submissions are incomplete outcome data, not automatic zeroes.
- Player totals sum the player's submitted songs' `Submission.score` values within the game. If a player has multiple scored submissions in a round, each scored submission contributes to the cumulative total.
- `scoredRoundCount` counts distinct rounds with at least one scored submission by that player.
- Ranking uses dense ranking by `totalScore DESC`; ties share the same rank and set `tied: true`.
- Deterministic display fallback for tied rows is player display name, then player id. The fallback must never create a sole champion.
- A player with zero scored submissions is excluded from the standings rows; M6 may separately show an incomplete-data caveat.
- The derivation must be computationally cheap for one game: linear or near-linear in the game's scored submissions/votes, with no per-player or per-round N+1 query pattern.

#### §4d-4. Normalized player metric contract for overview claims

```ts
interface PlayerPerformanceMetric {
  playerId: number;
  scoredSubmissionCount: number;
  submittedRoundCount: number;
  averageFinishPercentile: number | null; // 0 best, 1 worst
  winRate: number | null;
  rawScoreStdDev: number | null;
  minimumSampleMet: boolean;
}
```

- Finish percentile per scored submission is `(rank - 1) / max(scoredRoundSize - 1, 1)`.
- Denominator for finish and win-rate claims is scored submissions unless an M6 insight contract explicitly chooses another named denominator.
- Multi-submit rounds count per scored submission for submission-based claims and once per player/round for submitted-round claims.
- Raw score variance may be computed as descriptive context, but M6 copy must not use it to explain rule settings while vote budgets are unknown.
- Small samples are allowed for M6 player-performance claims when the claim names or exposes the denominator and avoids broad generalizations. A one-scored-submission claim may describe that one result; it must not imply a durable tendency unless a later spec records a stricter threshold and evidence rule.

#### §4d-5. Semantic fixture manifest

```ts
interface SemanticFixtureManifest {
  fixtureName: string;
  files: Array<"competitors.csv" | "rounds.csv" | "submissions.csv" | "votes.csv">;
  covers: CorrectivePatchId[];
  behaviors: string[];
}
```

Required fixture coverage may be satisfied by one or more small fixtures, but the combined set must cover:

- two games with overlapping or similar round names;
- repeat exact canonical song across rounds, but not twice within the same round;
- same title/name collisions that use distinct canonical song IDs;
- same exported artist label with a new song;
- same lead artist alone and in a multi-artist exported label;
- negative vote points;
- vote rows with voter, target song/submission, points, and vote comment;
- submission comments and vote comments in the same dataset;
- standings clear leader and standings tie;
- missing score/rank or unvoted submissions;
- completed post-vote submissions with any legacy visibility flags documented;
- sparse one-submission or one-scored-submission player history;
- stale or unresolvable origin context for modal routes.

#### §4d-6. Source settings posture

```ts
interface SourceSettingsPosture {
  knownSettings: Array<{ name: string; sourceField: string; attachesTo: "Game" | "Round" | "ImportBatch" }>;
  unknownSettings: string[];
  copyProhibitions: string[];
}
```

- The supported CSV bundle currently exposes no trusted vote-budget, deadline, low-stakes, or downvote-enabled configuration field.
- Unknown settings are documented as unknown, not defaulted.
- Known imported facts such as negative `Vote.pointsAssigned` remain displayable and computable.

### 4e. Dependencies

None.

| Package | Purpose | Rationale |
|---|---|---|
| None | N/A | No new dependency is needed for documentation patches, fixture additions, loaders, or deterministic read-model helpers. |

## 5. Acceptance Criteria

| ID | Condition | Verification |
|---|---|---|
| AC-01 | CP-01 through CP-10 each have an explicit `patched`, `deferred`, or `rejected` disposition in the updated product/spec documents, and no CP item disappears through consolidation. | `review` |
| AC-02 | Import and product-surface contracts state that current supported imports are completed, post-vote, de-anonymized snapshots; `visibleToVoters` is documented as source evidence/compatibility data, not a current-product privacy gate. | `review` |
| AC-03 | Product contracts and tests preserve `Game` as the canonical parent of `Round`, treat `Round.leagueSlug` as compatibility metadata, and prove similar round names across games do not create grouping ambiguity. | `test` + `review` |
| AC-04 | A derived standings read model totals scored `Submission.score` values by player within one game, excludes unscored submissions from totals, handles ties explicitly, and introduces no persisted standings table. | `test` + `schema review` |
| AC-05 | Player-performance overview contracts define denominators, finish-percentile normalization, multi-submit handling, score-variance posture, and small-sample copy posture before permitting M6 player claims. | `test` + `review` |
| AC-06 | Source-settings posture documents absent settings as unknown; negative vote points remain valid; overview/round copy does not explain budget usage, missed deadlines, disqualification, or low-stakes behavior without source facts. | `test` + `review` |
| AC-07 | Song links from round, player, and M6 setup contracts target canonical song memory by `Song` identity unless explicitly labeled as a local evidence preview. | `test` + `review` |
| AC-08 | Completed round detail exposes a v1 vote-by-vote breakdown with voter, target submission/song, points, and vote comment, while keeping submission comments and vote comments distinct. | `test` + `manual` |
| AC-09 | Artist aggregate and familiarity contracts state v1 identity as normalized exported artist display string and prohibit collaborator-level overclaims from multi-artist labels. | `test` + `review` |
| AC-10 | M6 overview setup prohibits genre, mood, duration, popularity, album, release-year, audio-feature, Spotify-enrichment, unsupported funny fallback, vote-budget, and deadline claims unless a prerequisite spec adds those facts. | `review` |
| AC-11 | Semantic fixture coverage exists or is named for every non-deferred CP item and every M6 insight category allowed by this cleanup. | `test` + `review` |
| AC-12 | The cleanup adds no new package dependency and no schema migration. | `lint` + `schema review` |
| AC-13 | HITL-resolved derivation decisions for standings, finish percentile, small samples, and vote-budget/deadline non-inference are reflected in the amended contracts, with no remaining open question blocking TASK-06 through TASK-08. | `review` |

## 6. Task Decomposition Hints

TASK-00 is omitted because the §2 artifacts do not require a mechanical conformance pass before the CP cleanup can be dispatched.

1. **[TASK-01] Patch snapshot, game, and standings source contracts** — Update the affected FSD/SPEC/source documents for CP-01, CP-02, and CP-03, record each disposition, and make completed-snapshot scope, first-class `Game` parentage, `Round.leagueSlug` compatibility posture, and derived standings/champion semantics explicit before any M6 consumer uses them.
   `contracts: §4b-1, §4d-1, §4d-3, §4d-6` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-15, INV-16` · `validates: AC-01, AC-02, AC-03, AC-04, AC-12, AC-13`
2. **[TASK-02] Patch player-metric, source-setting, and vote-evidence source contracts** — Update the affected FSD/SPEC/source documents for CP-04, CP-05, and CP-07, record each disposition, and pin denominator, small-sample, unknown-setting, negative-point, and v1 vote-breakdown semantics without adding vote-budget or deadline inference.
   `contracts: §4c-1, §4d-1, §4d-4, §4d-6` · `preserves: INV-05, INV-07, INV-08, INV-09, INV-12, INV-13, INV-14, INV-15, INV-16` · `validates: AC-01, AC-05, AC-06, AC-08, AC-13`
3. **[TASK-03] Patch song, artist, and M6 insight source contracts** — Update the affected FSD/SPEC/source documents for CP-06, CP-08, and CP-09, record each disposition, and constrain song links, artist-display identity, and M6 insight templates to canonical archive facts.
   `contracts: §4c-2, §4d-1, §4d-4` · `preserves: INV-10, INV-11, INV-12, INV-13, INV-14, INV-15, INV-16` · `validates: AC-01, AC-07, AC-09, AC-10, AC-13`
4. **[TASK-04] Add semantic fixture bundles and manifest** — Add small inspectable fixture coverage for the CP-10 edge cases and document which CP items each fixture validates.
   `contracts: §4d-5` · `preserves: INV-01, INV-03, INV-05, INV-07, INV-08, INV-09, INV-11, INV-12, INV-15, INV-16` · `validates: AC-03, AC-04, AC-05, AC-06, AC-08, AC-09, AC-11`
5. **[TASK-05] Harden import and identity tests for game semantics** — Add or amend deterministic tests for completed-snapshot assumptions, game-scoped round uniqueness, same-game replay safety, negative points, unknown settings, and `leagueSlug` compatibility posture.
   `contracts: §4b-1, §4d-5, §4d-6` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-07, INV-08, INV-15, INV-16` · `validates: AC-02, AC-03, AC-06, AC-11, AC-12`
6. **[TASK-06] Implement round vote breakdown evidence** — Extend the round detail loader and rendering path to hydrate and display grouped vote-by-vote evidence for completed imported rounds without budget/deadline explanations.
   `contracts: §4c-1, §4d-2` · `preserves: INV-05, INV-07, INV-08, INV-09, INV-15, INV-16` · `validates: AC-06, AC-08, AC-11`
7. **[TASK-07] Add derived standings read model** — Implement and test the game-scoped standings helper for M6 consumption, including unscored submissions and tied rankings, without adding persisted state.
   `contracts: §4b-1, §4d-3` · `preserves: INV-03, INV-05, INV-06, INV-15` · `validates: AC-04, AC-11, AC-12, AC-13`
8. **[TASK-08] Normalize player, artist, and song-memory guardrails** — Patch or test the reusable derivation/copy boundaries for normalized player metrics, artist display-string identity, canonical song-link semantics, and M6 insight template inputs.
   `contracts: §4c-2, §4d-4, §4d-5` · `preserves: INV-10, INV-11, INV-12, INV-13, INV-14, INV-15, INV-16` · `validates: AC-05, AC-07, AC-09, AC-10, AC-11, AC-13`

### Dependency Graph

```
TASK-01:
TASK-02: TASK-01
TASK-03: TASK-01,TASK-02
TASK-04: TASK-01,TASK-02,TASK-03
TASK-05: TASK-04
TASK-06: TASK-04,TASK-05
TASK-07: TASK-04,TASK-05
TASK-08: TASK-04,TASK-06,TASK-07
```

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

### D-001 — PRE-M6 worktree label must not collide with prior M1 worktrees

- **Discovered:** 2026-04-24T23:08:02Z during `TASK-01` cycle 1 meta-orchestrator dispatch.
- **Trigger:** The meta-orchestrator derived the default worktree label `M1-task-01` for this PRE-M6 spec and reused the existing `/home/zacha/music-league-worktrees/M1-task-01` branch/worktree.
- **Impact:** Runtime slice files from `docs/specs/slices-pre-m6/` existed on `main`, but were absent in the reused task worktree, so the implementer could not load `TASK-01` contracts or acceptance criteria and produced an empty diff. This is an orchestration/worktree identity issue, not a product-contract failure.
- **Resolution:** Resume this PRE-M6 workstream with an explicit non-colliding milestone label, for example `--milestone PRE-M6`, while preserving the existing spec, plan, slice directory, contracts, and acceptance criteria.

---

## Appendix E: Context Slices

### E.1 Two-file model

Every task invocation receives:

1. `SPEC-MMM-universal.md` — §1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries
2. `SPEC-MMM-slice-TASK-NN.md` — assembled from tokens below

§4 (contracts), §5 (ACs), §6 (task hints), and Appendix E are excluded from the universal file. Universal content is never repeated in slice files.

### E.2 Extraction contract

Section boundaries in the source spec follow the pattern:

```
#### §4a-N. Title    →  ends at next ####, ###, or EOF
#### §4c-N. Title    →  ends at next ####, ###, or EOF
```

Slice blocks are delimited:

```
&lt;!-- SLICE:TASK-NN --&gt;
&lt;!-- /SLICE:TASK-NN --&gt;
```

**Regex — extract named slice:**

```
<!-- SLICE:(TASK-[\w]+) -->[\s\S]*?<!-- /SLICE:\1 -->
```

**Regex — extract SECTIONS tokens from a slice:**

```
^  (§[\w-:]+)
```

*(exactly two leading spaces; distinguishes tokens from prose)*

**Regex — extract a section from the source spec by token `§4a-3`:**

```
(?=#### §4a-3\ .)[\s\S]*?(?=#### |### |## |$)
```

**Regex — extract a single task hint from §6:**

```
\d+\.\s+\*\*\[TASK-NN\][\s\S]*?(?=\n\d+\.\s+\*\*\[TASK-|\n###\s|\n##\s|$)
```

### E.3 Token grammar

|Token|Matches|
|-|-|
|`§4a-N`|Single API endpoint section|
|`§4a-N:M`|§4a-N through §4a-M inclusive|
|`§4b-N`|Single schema migration section|
|`§4b-N:M`|§4b-N through §4b-M inclusive|
|`§4c-N`|Single component contract section|
|`§4d-N`|Single internal boundary section|
|`§4d-N:M`|§4d-N through §4d-M inclusive|
|`§4e`|Full dependency table|
|`§5:AC-NN`|Single AC row|
|`§5:AC-NN:MM`|AC rows NN through MM inclusive|
|`§6:TASK-NN`|Single task decomposition hint entry (prose line + metadata line)|

### E.4 Slice definitions


<!-- SLICE:TASK-01 -->
TASK:     TASK-01
LABEL:    Patch snapshot, game, and standings source contracts
DEPENDS:  (none)
SECTIONS:
§4b-1
§4d-1
§4d-3
§4d-6
§5:AC-01:04
§5:AC-12:13
§6:TASK-01
<!-- /SLICE:TASK-01 -->

<!-- SLICE:TASK-02 -->
TASK:     TASK-02
LABEL:    Patch player-metric, source-setting, and vote-evidence source contracts
DEPENDS:  TASK-01
SECTIONS:
§4c-1
§4d-1
§4d-4
§4d-6
§5:AC-01
§5:AC-05:06
§5:AC-08
§5:AC-13
§6:TASK-02
<!-- /SLICE:TASK-02 -->

<!-- SLICE:TASK-03 -->
TASK:     TASK-03
LABEL:    Patch song, artist, and M6 insight source contracts
DEPENDS:  TASK-01, TASK-02
SECTIONS:
§4c-2
§4d-1
§4d-4
§5:AC-01
§5:AC-07
§5:AC-09:10
§5:AC-13
§6:TASK-03
<!-- /SLICE:TASK-03 -->

<!-- SLICE:TASK-04 -->
TASK:     TASK-04
LABEL:    Add semantic fixture bundles and manifest
DEPENDS:  TASK-01, TASK-02, TASK-03
SECTIONS:
§4d-5
§5:AC-03:06
§5:AC-08:09
§5:AC-11
§6:TASK-04
<!-- /SLICE:TASK-04 -->

<!-- SLICE:TASK-05 -->
TASK:     TASK-05
LABEL:    Harden import and identity tests for game semantics
DEPENDS:  TASK-04
SECTIONS:
§4b-1
§4d-5:6
§5:AC-02:03
§5:AC-06
§5:AC-11:12
§6:TASK-05
<!-- /SLICE:TASK-05 -->

<!-- SLICE:TASK-06 -->
TASK:     TASK-06
LABEL:    Implement round vote breakdown evidence
DEPENDS:  TASK-04, TASK-05
SECTIONS:
§4c-1
§4d-2
§5:AC-06
§5:AC-08
§5:AC-11
§6:TASK-06
<!-- /SLICE:TASK-06 -->

<!-- SLICE:TASK-07 -->
TASK:     TASK-07
LABEL:    Add derived standings read model
DEPENDS:  TASK-04, TASK-05
SECTIONS:
§4b-1
§4d-3
§5:AC-04
§5:AC-11:13
§6:TASK-07
<!-- /SLICE:TASK-07 -->

<!-- SLICE:TASK-08 -->
TASK:     TASK-08
LABEL:    Normalize player, artist, and song-memory guardrails
DEPENDS:  TASK-04, TASK-06, TASK-07
SECTIONS:
§4c-2
§4d-4:5
§5:AC-05
§5:AC-07
§5:AC-09:11
§5:AC-13
§6:TASK-08
<!-- /SLICE:TASK-08 -->

<!-- END SPEC -->
