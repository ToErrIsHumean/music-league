# Slice: TASK-02 — Patch player-metric, source-setting, and vote-evidence source contracts

> **Depends-on:** TASK-01
> **Universal:** SPEC-PRE-M6-corrective-game-semantics-cleanup-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

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

---

| ID | Condition | Verification |
|---|---|---|
| AC-05 | Player-performance overview contracts define denominators, finish-percentile normalization, multi-submit handling, score-variance posture, and small-sample copy posture before permitting M6 player claims. | `test` + `review` |
| AC-06 | Source-settings posture documents absent settings as unknown; negative vote points remain valid; overview/round copy does not explain budget usage, missed deadlines, disqualification, or low-stakes behavior without source facts. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-08 | Completed round detail exposes a v1 vote-by-vote breakdown with voter, target submission/song, points, and vote comment, while keeping submission comments and vote comments distinct. | `test` + `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-13 | HITL-resolved derivation decisions for standings, finish percentile, small samples, and vote-budget/deadline non-inference are reflected in the amended contracts, with no remaining open question blocking TASK-06 through TASK-08. | `review` |

---

2. **[TASK-02] Patch player-metric, source-setting, and vote-evidence source contracts** — Update the affected FSD/SPEC/source documents for CP-04, CP-05, and CP-07, record each disposition, and pin denominator, small-sample, unknown-setting, negative-point, and v1 vote-breakdown semantics without adding vote-budget or deadline inference.
   `contracts: §4c-1, §4d-1, §4d-4, §4d-6` · `preserves: INV-05, INV-07, INV-08, INV-09, INV-12, INV-13, INV-14, INV-15, INV-16` · `validates: AC-01, AC-05, AC-06, AC-08, AC-13`

---
