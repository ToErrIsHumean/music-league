# Slice: TASK-06 — Implement round vote breakdown evidence

> **Depends-on:** TASK-04, TASK-05
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

---

| ID | Condition | Verification |
|---|---|---|
| AC-06 | Source-settings posture documents absent settings as unknown; negative vote points remain valid; overview/round copy does not explain budget usage, missed deadlines, disqualification, or low-stakes behavior without source facts. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-08 | Completed round detail exposes a v1 vote-by-vote breakdown with voter, target submission/song, points, and vote comment, while keeping submission comments and vote comments distinct. | `test` + `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-11 | Semantic fixture coverage exists or is named for every non-deferred CP item and every M6 insight category allowed by this cleanup. | `test` + `review` |

---

6. **[TASK-06] Implement round vote breakdown evidence** — Extend the round detail loader and rendering path to hydrate and display grouped vote-by-vote evidence for completed imported rounds without budget/deadline explanations.
   `contracts: §4c-1, §4d-2` · `preserves: INV-05, INV-07, INV-08, INV-09, INV-15, INV-16` · `validates: AC-06, AC-08, AC-11`

---
