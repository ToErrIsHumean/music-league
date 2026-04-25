# Slice: TASK-05 — Derive song, recurrence, and participation moments

> **Depends-on:** TASK-02, TASK-03
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

---

#### §4d-7. Song/discovery and recurrence derivation

```ts
interface ArchiveSongEvidence {
  exactSongSubmissionsBySongId: Map<number, ArchiveSongEvidenceSubmission[]>;
  artistSubmissionsByNormalizedArtistName: Map<string, ArchiveSongEvidenceSubmission[]>;
}

interface ArchiveSongEvidenceSubmission {
  gameId: number;
  roundId: number;
  submissionId: number;
  playerId: number;
  songId: number;
  artistId: number;
  artistName: string;
  normalizedArtistName: string;
  score: number | null;
  rank: number | null;
  roundOccurredAt: string | null;
  roundSequenceNumber: number | null;
  submittedAt: string | null;
  createdAt: string;
}

function deriveSongMemoryMoments(input: {
  selectedGameId: number;
  selectedGameSubmissions: SelectedGameSubmission[];
  archiveSongEvidence: ArchiveSongEvidence;
}): MemoryBoardMoment[]
```

Rules:

- `new-to-us-that-landed` requires no prior exact-song history and no prior exported-artist history before the selected-game submission, plus at least one named non-comment current fact: won a round, placed rank 1-2, or scored in the top half of a scored round.
- `back-again-familiar-face` may use exact canonical song recurrence or normalized exported artist recurrence, but copy must make the kind explicit.
- Selected-game moments must foreground a selected-game submission. Archive history may be evidence context, not the primary scope of the board claim.
- "Prior" archive history is determined by the same deterministic history ordering used by canonical song memory: round occurrence, round sequence, submission creation, then submission id. It must not depend on database return order.
- Do not split combined exported artist labels into collaborators.

#### §4d-8. Participation derivation

```ts
function deriveParticipationPulse(input: {
  selectedGameId: number;
  rounds: SelectedGameRound[];
  submissions: SelectedGameSubmission[];
}): MemoryBoardMoment | null
```

Rules:

- Allowed claims: participating player count, submitted song count, submitted round count, most active submitter by selected-game submission count, or broad participation across rounds.
- Most-active submitter ties remain ties or use cautious copy such as "shared the busiest slate."
- Participation is social context, not a competitive result.

#### §4d-9. Canonical evidence hrefs

```ts
function buildMemoryBoardEvidenceHref(input: {
  gameId: number;
  roundId?: number;
  songId?: number;
  playerId?: number;
  submissionId?: number;
  section?: "submissions" | "vote-breakdown";
}): string
```

Rules:

- Game-switcher and board-close hrefs may use the existing `buildArchiveHref()` helper if it is extended to accept `gameId` without requiring `roundId`.
- Game-only evidence opens `/?game=<gameId>`.
- Round evidence opens `/?game=<gameId>&round=<roundId>`.
- Song evidence opens canonical song memory using `roundId` origin context and `songId`.
- Player evidence opens the existing player modal using `roundId` origin context and `playerId`.
- Submission evidence opens the containing round, plus the existing player modal when `playerId` is available and that modal is the canonical evidence surface for the submission; otherwise it opens the containing round with a stable `#submission-<submissionId>` fragment.
- Vote-breakdown evidence opens the containing round with a stable vote-breakdown section destination such as `#vote-breakdown`.
- If a moment cannot identify a canonical evidence destination, omit the moment.
- All close links, switcher links, nested modal links, and evidence links generated while a selected game exists must be built through this helper or through `buildArchiveHref()` after it accepts equivalent `gameId`, `roundId`, nested entity, and fragment inputs. Do not leave ad hoc `"/"` close hrefs or round-only href builders in the memory-board route.

---

### 4e. Dependencies

No new npm, system, or third-party dependencies are introduced.

| Package | Purpose | Rationale |
|---|---|---|
| None | N/A | Existing Next.js, React, Prisma, and Node test tooling are sufficient. |

---

| ID | Condition | Verification |
|---|---|---|
| AC-07 | Missing or partial score/rank evidence suppresses or cavesats outcome-dependent claims while preserving unrelated eligible memory moments. | unit and integration test |
| AC-08 | A representative completed-game fixture renders a balanced board with at least one competitive, one song/discovery, and one social/participation moment when evidence exists for all three lenses. | integration test |
| AC-09 | Sparse-data fixtures omit unsupported moment families and render a coherent smaller selected-game recap with safe copy. | integration test |
| AC-10 | Every rendered moment exposes a canonical evidence path to a round, player, song, submission fragment, vote-breakdown fragment, or selected-game context appropriate to the claim. | integration test |

---

| ID | Condition | Verification |
|---|---|---|
| AC-12 | Song evidence links open canonical song memory and player evidence links open the existing player modal without creating alternate local board detail surfaces. | integration test |
| AC-13 | The board renders no v1 claims based on genre, mood, audio features, popularity, recommendations, personalization, inferred taste, unsupported humor, source deadline behavior, or vote-budget behavior. | unit and render regression test |
| AC-14 | Comment-backed "People Reacted" board moments and direct board comment snippets are absent from v1, while existing detailed comment surfaces remain governed by M4/M5/pre-M6 contracts. | render regression test |

---

5. **[TASK-05] Derive song, recurrence, and participation moments** - Implement `new-to-us-that-landed`, `back-again-familiar-face`, `participation-pulse`, board-family priority, sparse-state omission behavior, source facts, denominators, and copy guardrails.
   `contracts: §4c-3, §4d-4, §4d-7, §4d-8, §4d-9, §4e` · `preserves: INV-05, INV-08, INV-09, INV-10, INV-11, INV-12, INV-13, INV-14, INV-15` · `validates: AC-07, AC-08, AC-09, AC-10, AC-12, AC-13, AC-14`

---
