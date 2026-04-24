# Slice: TASK-07 — Add derived standings read model

> **Depends-on:** TASK-04, TASK-05
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

| ID | Condition | Verification |
|---|---|---|
| AC-04 | A derived standings read model totals scored `Submission.score` values by player within one game, excludes unscored submissions from totals, handles ties explicitly, and introduces no persisted standings table. | `test` + `schema review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-11 | Semantic fixture coverage exists or is named for every non-deferred CP item and every M6 insight category allowed by this cleanup. | `test` + `review` |
| AC-12 | The cleanup adds no new package dependency and no schema migration. | `lint` + `schema review` |
| AC-13 | HITL-resolved derivation decisions for standings, finish percentile, small samples, and vote-budget/deadline non-inference are reflected in the amended contracts, with no remaining open question blocking TASK-06 through TASK-08. | `review` |

---

7. **[TASK-07] Add derived standings read model** — Implement and test the game-scoped standings helper for M6 consumption, including unscored submissions and tied rankings, without adding persisted state.
   `contracts: §4b-1, §4d-3` · `preserves: INV-03, INV-05, INV-06, INV-15` · `validates: AC-04, AC-11, AC-12, AC-13`

---
