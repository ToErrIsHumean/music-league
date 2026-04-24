# Slice: TASK-05 — Harden import and identity tests for game semantics

> **Depends-on:** TASK-04
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

---

| ID | Condition | Verification |
|---|---|---|
| AC-02 | Import and product-surface contracts state that current supported imports are completed, post-vote, de-anonymized snapshots; `visibleToVoters` is documented as source evidence/compatibility data, not a current-product privacy gate. | `review` |
| AC-03 | Product contracts and tests preserve `Game` as the canonical parent of `Round`, treat `Round.leagueSlug` as compatibility metadata, and prove similar round names across games do not create grouping ambiguity. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-06 | Source-settings posture documents absent settings as unknown; negative vote points remain valid; overview/round copy does not explain budget usage, missed deadlines, disqualification, or low-stakes behavior without source facts. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-11 | Semantic fixture coverage exists or is named for every non-deferred CP item and every M6 insight category allowed by this cleanup. | `test` + `review` |
| AC-12 | The cleanup adds no new package dependency and no schema migration. | `lint` + `schema review` |

---

5. **[TASK-05] Harden import and identity tests for game semantics** — Add or amend deterministic tests for completed-snapshot assumptions, game-scoped round uniqueness, same-game replay safety, negative points, unknown settings, and `leagueSlug` compatibility posture.
   `contracts: §4b-1, §4d-5, §4d-6` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-07, INV-08, INV-15, INV-16` · `validates: AC-02, AC-03, AC-06, AC-11, AC-12`

---
