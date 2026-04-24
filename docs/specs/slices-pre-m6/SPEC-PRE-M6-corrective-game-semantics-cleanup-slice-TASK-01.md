# Slice: TASK-01 — Patch snapshot, game, and standings source contracts

> **Depends-on:** (none)
> **Universal:** SPEC-PRE-M6-corrective-game-semantics-cleanup-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4b-1. No schema migration

```sql
-- Migration: none
-- Direction: no-op
-- Rollback: no-op
```

- No persisted standings, leaderboard, source-settings, artist-collaboration, genre, mood, duration, or enrichment tables are introduced.
- Fixture files and tests may be added.
- Existing schema fields may be documented more precisely: `Game.sourceGameId`, `ImportBatch.gameKey`, `Round.gameId`, `Round.leagueSlug`, `Submission.visibleToVoters`, `Submission.score`, `Submission.rank`, `Vote.pointsAssigned`, and vote/submission comments.

---

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

---

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

---

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

---

| ID | Condition | Verification |
|---|---|---|
| AC-01 | CP-01 through CP-10 each have an explicit `patched`, `deferred`, or `rejected` disposition in the updated product/spec documents, and no CP item disappears through consolidation. | `review` |
| AC-02 | Import and product-surface contracts state that current supported imports are completed, post-vote, de-anonymized snapshots; `visibleToVoters` is documented as source evidence/compatibility data, not a current-product privacy gate. | `review` |
| AC-03 | Product contracts and tests preserve `Game` as the canonical parent of `Round`, treat `Round.leagueSlug` as compatibility metadata, and prove similar round names across games do not create grouping ambiguity. | `test` + `review` |
| AC-04 | A derived standings read model totals scored `Submission.score` values by player within one game, excludes unscored submissions from totals, handles ties explicitly, and introduces no persisted standings table. | `test` + `schema review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-12 | The cleanup adds no new package dependency and no schema migration. | `lint` + `schema review` |
| AC-13 | HITL-resolved derivation decisions for standings, finish percentile, small samples, and vote-budget/deadline non-inference are reflected in the amended contracts, with no remaining open question blocking TASK-06 through TASK-08. | `review` |

---

1. **[TASK-01] Patch snapshot, game, and standings source contracts** — Update the affected FSD/SPEC/source documents for CP-01, CP-02, and CP-03, record each disposition, and make completed-snapshot scope, first-class `Game` parentage, `Round.leagueSlug` compatibility posture, and derived standings/champion semantics explicit before any M6 consumer uses them.
   `contracts: §4b-1, §4d-1, §4d-3, §4d-6` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-15, INV-16` · `validates: AC-01, AC-02, AC-03, AC-04, AC-12, AC-13`

---
