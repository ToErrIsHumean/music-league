# Slice: TASK-04 — Derive competitive board facts

> **Depends-on:** TASK-02
> **Universal:** SPEC-006-league-overview-memory-board-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4c-3. Memory board payload

```ts
interface MemoryBoardPayload {
  selectedGameId: number;
  anchor: CompetitiveAnchor | null;
  moments: MemoryBoardMoment[];
  sparseState: null | {
    title: string;
    copy: string;
    omittedFamilies: MemoryMomentFamily[];
  };
}

type MemoryMomentFamily =
  | "the-table"
  | "game-swing"
  | "new-to-us-that-landed"
  | "back-again-familiar-face"
  | "participation-pulse";

interface MemoryBoardMoment {
  id: string;
  family: MemoryMomentFamily;
  lens: "competitive" | "song-discovery" | "social-participation";
  title: string;
  copy: string;
  sourceFacts: string[];
  denominator: string;
  evidence: Array<MemoryBoardEvidenceLink>;
}

interface MemoryBoardEvidenceLink {
  kind: "game" | "round" | "player" | "song" | "submission" | "vote-breakdown";
  label: string;
  href: string;
  requiresGameContext: boolean;
  target?: {
    gameId: number;
    roundId?: number;
    songId?: number;
    playerId?: number;
    submissionId?: number;
    section?: "submissions" | "vote-breakdown";
  };
}
```

Rendering rules:

- `anchor` renders before ordinary moments when present.
- `moments` contains only eligible, source-backed moments, ordered by §4d-4 priority.
- Moment copy must include or expose the relevant denominator when the claim depends on count, rank, score, recurrence, novelty, or participation.
- `sparseState` appears only when important families were omitted due to unavailable evidence; it must be concise and must not substitute unsupported insight copy.
- `target` metadata is optional for final rendering but required during derivation for non-game evidence so tests can assert that each moment points at the intended canonical fact, not merely a generic board URL.

#### §4c-4. Competitive anchor

```ts
interface CompetitiveAnchor {
  kind: "leader" | "tied-leaders" | "unavailable";
  title: string;
  leaders: Array<{
    player: { id: number; displayName: string };
    totalScore: number;
    rank: 1;
    href: string;
  }>;
  scoreContext: string | null;
  unavailableReason: null | "no-scored-submissions" | "partial-score-rank-evidence";
}
```

Rules:

- `leader` requires exactly one rank-1 standings row from scored submissions in the selected game.
- `tied-leaders` requires two or more rank-1 standings rows with equal total score.
- `unavailable` is required when partial score/rank evidence prevents a reliable standings claim for a selected game that otherwise has submissions. It may be omitted only when the selected game has no submissions or the first viewport already contains an explicit sparse-state explanation.
- `leader` and `tied-leaders` must not be rendered from only the scored subset of a selected game when any selected-game round has submissions but no complete score/rank evidence.
- Most submissions, most comments, most recurrent artists, or most active players must not populate this anchor.

---

#### §4d-4. Board family catalog and priority

```ts
interface MemoryMomentTemplate {
  family: MemoryMomentFamily;
  lens: "competitive" | "song-discovery" | "social-participation";
  sourceFacts: string[];
  denominator: string;
  minimumSample: number;
  omissionCondition: string;
  evidenceLink: {
    kind: "game" | "round" | "player" | "song" | "submission" | "vote-breakdown";
    requiresGameContext: boolean;
  };
  copyGuardrails: string[];
}
```

Required v1 catalog:

| Family | Lens | Source facts | Denominator | Minimum sample | Omission condition | Evidence destination | Copy guardrails |
|---|---|---|---|---:|---|---|---|
| `the-table` | competitive | players, games, rounds, submissions, scores, ranks | scored submissions in selected game | 1 scored submission | omit or render unavailable when no scored submissions or partial score/rank evidence prevents standings | player or selected game | preserve ties; do not call activity a win |
| `game-swing` | competitive | rounds, submissions, scores, ranks | scored submissions within a selected-game round | 2 scored submissions in a round | omit when no close finish or runaway pick can be named from complete scored round evidence | round or vote-breakdown | name close/runaway basis; no comeback language without evidence |
| `new-to-us-that-landed` | song-discovery | games, rounds, submissions, songs, exported-artist-labels, scores, ranks | archive history before the selected-game submission | 1 eligible submission | omit when novelty, placement, win, or another non-comment current fact cannot be proven | song and round | current archive facts only; no genre/mood/taste/comment-reaction claims |
| `back-again-familiar-face` | song-discovery | games, rounds, submissions, songs, exported-artist-labels | exact-song or exported-artist submissions across archive history | 2 appearances | omit when neither exact-song nor exported-artist recurrence exists | song | distinguish exact song from exported-artist recurrence |
| `participation-pulse` | social-participation | players, rounds, submissions | submitted songs, submitted rounds, participating players in selected game | 1 submission | omit only when selected game has no submissions | player or selected game | explicit counts only; no durable player tendency claims |

Moment priority:

1. competitive anchor / `the-table`
2. one strongest `game-swing`, if eligible
3. one strongest song/discovery moment, preferring `new-to-us-that-landed` when it has rank/score support
4. one strongest recurrence moment when distinct from the discovery moment
5. one `participation-pulse`
6. additional eligible non-duplicative moments until the board has at most 6 moments

If priority would create a pure leaderboard or pure song-memory board, rebalance toward the missing lens when eligible evidence exists.

#### §4d-5. Standings derivation

```ts
function deriveSelectedGameStandings(submissions: Array<{
  playerId: number;
  playerName: string;
  roundId: number;
  score: number | null;
  rank: number | null;
}>): {
  rows: Array<{
    player: { id: number; displayName: string };
    totalScore: number;
    scoredSubmissionCount: number;
    scoredRoundCount: number;
    rank: number;
    tied: boolean;
  }>;
  completeness: "complete" | "partial" | "none";
}
```

Rules:

- Sum only submissions where both `score` and `rank` are non-null.
- `none` means zero scored submissions.
- `partial` means the selected game has any submitted round without complete score/rank evidence for all of that round's submissions. This includes a submission with exactly one of `score` or `rank` missing, a round that mixes scored and unscored submissions, or a whole submitted round where all scores/ranks are missing.
- A selected game with scored submissions in one round and an entirely unscored submitted round is still `partial` for game-level standings; do not infer a final game leader from the scored subset.
- Rank standings densely by `totalScore DESC`; equal totals share rank and set `tied: true`.
- Stable fallback ordering after score ties is display name, then player id, but copy must still present tied rows as tied.
- Partial completeness suppresses game-level `leader`, `tied-leaders`, and `the-table` claims. It suppresses `game-swing` and `new-to-us-that-landed` only for candidate rounds or submissions whose own score/rank evidence is incomplete. A complete scored round inside an otherwise partial selected game may still support a round-scoped swing or song/discovery moment when copy names the round-level denominator and does not imply a final game result.

The current `deriveGameStandings()` helper may be reused or amended if it can expose the completeness metadata without regressing existing tests.

#### §4d-6. Swing derivation

```ts
function deriveGameSwingMoment(input: {
  rounds: SelectedGameRound[];
  submissions: SelectedGameSubmission[];
}): MemoryBoardMoment | null
```

Eligibility:

- Candidate rounds are built from selected-game submissions grouped by `roundId`; no all-game submission rows may enter the margin calculation.
- `Photo Finish`: a scored round where the top score and runner-up score differ by exactly 1 point.
- `Runaway Pick`: a scored round where the top score exceeds the runner-up by at least 5 points.
- If both exist, prefer the candidate with clearer first-viewport story value: exact 1-point finish first, then largest runaway margin.
- Tied winners are not photo finishes unless a runner-up score below the tied top can be named without implying a sole winner.

---

### 4e. Dependencies

No new npm, system, or third-party dependencies are introduced.

| Package | Purpose | Rationale |
|---|---|---|
| None | N/A | Existing Next.js, React, Prisma, and Node test tooling are sufficient. |

---

| ID | Condition | Verification |
|---|---|---|
| AC-06 | The competitive anchor renders a sole leader or tied leaders from selected-game scored submissions with score context, and never conflates participation or recurrence with winning. | unit and integration test |
| AC-07 | Missing or partial score/rank evidence suppresses or cavesats outcome-dependent claims while preserving unrelated eligible memory moments. | unit and integration test |

---

| ID | Condition | Verification |
|---|---|---|
| AC-09 | Sparse-data fixtures omit unsupported moment families and render a coherent smaller selected-game recap with safe copy. | integration test |
| AC-10 | Every rendered moment exposes a canonical evidence path to a round, player, song, submission fragment, vote-breakdown fragment, or selected-game context appropriate to the claim. | integration test |

---

| ID | Condition | Verification |
|---|---|---|
| AC-13 | The board renders no v1 claims based on genre, mood, audio features, popularity, recommendations, personalization, inferred taste, unsupported humor, source deadline behavior, or vote-budget behavior. | unit and render regression test |

---

4. **[TASK-04] Derive competitive board facts** - Add standings completeness metadata, competitive anchor construction, and game-swing derivation from selected-game submissions and rounds only.
   `contracts: §4c-3, §4c-4, §4d-4, §4d-5, §4d-6, §4e` · `preserves: INV-01, INV-05, INV-06, INV-07, INV-09, INV-13, INV-14` · `validates: AC-06, AC-07, AC-09, AC-10, AC-13`

---
