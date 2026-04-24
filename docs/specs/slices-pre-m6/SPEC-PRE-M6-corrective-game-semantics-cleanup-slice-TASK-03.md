# Slice: TASK-03 — Patch song, artist, and M6 insight source contracts

> **Depends-on:** TASK-01, TASK-02
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

---

| ID | Condition | Verification |
|---|---|---|
| AC-01 | CP-01 through CP-10 each have an explicit `patched`, `deferred`, or `rejected` disposition in the updated product/spec documents, and no CP item disappears through consolidation. | `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-07 | Song links from round, player, and M6 setup contracts target canonical song memory by `Song` identity unless explicitly labeled as a local evidence preview. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-09 | Artist aggregate and familiarity contracts state v1 identity as normalized exported artist display string and prohibit collaborator-level overclaims from multi-artist labels. | `test` + `review` |
| AC-10 | M6 overview setup prohibits genre, mood, duration, popularity, album, release-year, audio-feature, Spotify-enrichment, unsupported funny fallback, vote-budget, and deadline claims unless a prerequisite spec adds those facts. | `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-13 | HITL-resolved derivation decisions for standings, finish percentile, small samples, and vote-budget/deadline non-inference are reflected in the amended contracts, with no remaining open question blocking TASK-06 through TASK-08. | `review` |

---

3. **[TASK-03] Patch song, artist, and M6 insight source contracts** — Update the affected FSD/SPEC/source documents for CP-06, CP-08, and CP-09, record each disposition, and constrain song links, artist-display identity, and M6 insight templates to canonical archive facts.
   `contracts: §4c-2, §4d-1, §4d-4` · `preserves: INV-10, INV-11, INV-12, INV-13, INV-14, INV-15, INV-16` · `validates: AC-01, AC-07, AC-09, AC-10, AC-13`

---
