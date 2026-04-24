# Slice: TASK-08 — Normalize player, artist, and song-memory guardrails

> **Depends-on:** TASK-04, TASK-06, TASK-07
> **Universal:** SPEC-PRE-M6-corrective-game-semantics-cleanup-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

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

---

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

---

| ID | Condition | Verification |
|---|---|---|
| AC-05 | Player-performance overview contracts define denominators, finish-percentile normalization, multi-submit handling, score-variance posture, and small-sample copy posture before permitting M6 player claims. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-07 | Song links from round, player, and M6 setup contracts target canonical song memory by `Song` identity unless explicitly labeled as a local evidence preview. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-09 | Artist aggregate and familiarity contracts state v1 identity as normalized exported artist display string and prohibit collaborator-level overclaims from multi-artist labels. | `test` + `review` |
| AC-10 | M6 overview setup prohibits genre, mood, duration, popularity, album, release-year, audio-feature, Spotify-enrichment, unsupported funny fallback, vote-budget, and deadline claims unless a prerequisite spec adds those facts. | `review` |
| AC-11 | Semantic fixture coverage exists or is named for every non-deferred CP item and every M6 insight category allowed by this cleanup. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-13 | HITL-resolved derivation decisions for standings, finish percentile, small samples, and vote-budget/deadline non-inference are reflected in the amended contracts, with no remaining open question blocking TASK-06 through TASK-08. | `review` |

---

8. **[TASK-08] Normalize player, artist, and song-memory guardrails** — Patch or test the reusable derivation/copy boundaries for normalized player metrics, artist display-string identity, canonical song-link semantics, and M6 insight template inputs.
   `contracts: §4c-2, §4d-4, §4d-5` · `preserves: INV-10, INV-11, INV-12, INV-13, INV-14, INV-15, INV-16` · `validates: AC-05, AC-07, AC-09, AC-10, AC-11, AC-13`

---
