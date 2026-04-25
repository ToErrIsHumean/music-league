# Slice: TASK-02 — Add selected-game recap read model

> **Depends-on:** TASK-01
> **Universal:** SPEC-006-league-overview-memory-board-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4b-1. No Prisma migration for Milestone 6

```sql
-- Migration: none
-- Direction: no-op
-- Rollback: no-op
```

M6 derives from existing tables:

```txt
Game(id, sourceGameId, displayName, createdAt, updatedAt)
Round(id, gameId, name, description, playlistUrl, sequenceNumber, occurredAt, createdAt)
Submission(id, roundId, playerId, songId, score, rank, comment, submittedAt, createdAt)
Vote(id, roundId, voterId, songId, pointsAssigned, comment, votedAt)
Song(id, title, spotifyUri, artistId)
Artist(id, name, normalizedName)
Player(id, displayName, sourcePlayerId)
```

No persisted `Standing`, `Leaderboard`, `Insight`, `Moment`, source-settings, artist-collaboration, genre, mood, duration, enrichment, recommendation, or personalization table is introduced.

#### §4b-2. Fixture expectations for Memory Board coverage

```txt
Seed / integration fixture coverage required for M6:
  - at least 2 selectable games with deterministic default ordering evidence
  - at least 1 single-game archive where the switcher is suppressed
  - at least 1 no-game or no-round archive state
  - at least 1 selected game with tied game leaders
  - at least 1 selected game with a sole game leader
  - at least 1 selected game with missing or partial score/rank evidence
  - at least 1 selected game with close-finish or runaway-pick evidence
  - at least 1 discovery candidate with no prior exact-song or exported-artist history before the selected game moment
  - at least 1 exact-song recurrence or exported-artist recurrence candidate
  - at least 1 participation-pulse candidate
  - at least 1 multi-game recurrence case proving board claims stay selected-game scoped while evidence links can show archive history
```

Fixture data may extend `prisma/seed.js` or add focused integration fixtures. It must not add same-song/same-round duplicate cases, unsupported metadata columns, or external music-feature facts.

---

#### §4d-3. Selected game recap query

```ts
async function getSelectedGameMemoryBoard(
  gameId: number,
  input?: ArchiveInput,
): Promise<{
  frame: SelectedGameFrame;
  rounds: SelectedGameRound[];
  submissions: SelectedGameSubmission[];
  votes: SelectedGameVote[];
  board: MemoryBoardPayload;
}>
```

The query must load all selected-game rounds, submissions, submitters, songs, artists, and votes needed for v1 moments. It may perform one additional bounded archive-memory query for exact-song and exported-artist recurrence evidence. It must not flatten unrelated games into the selected-game standings, participation, round-swing, or leader calculations.

Required internal record shape:

```ts
interface SelectedGameRound {
  id: number;
  gameId: number;
  name: string;
  description: string | null;
  playlistUrl: string | null;
  sequenceNumber: number | null;
  occurredAt: string | null;
}

interface SelectedGameSubmission {
  id: number;
  roundId: number;
  playerId: number;
  playerName: string;
  songId: number;
  songTitle: string;
  artistId: number;
  artistName: string;
  normalizedArtistName: string;
  score: number | null;
  rank: number | null;
  submittedAt: string | null;
  createdAt: string;
}

interface SelectedGameVote {
  id: number;
  roundId: number;
  voterId: number;
  songId: number;
  pointsAssigned: number;
  votedAt: string | null;
}
```

Implementation notes:

- The selected-game query may be factored into smaller local helpers, but it must retain one selected-game read boundary so board derivation cannot accidentally consume all-game archive rows.
- The selected-game submission projection must include `Song.artist.normalizedName` as `normalizedArtistName` so exported-artist recurrence uses the same normalized display-string basis as canonical song memory.
- The bounded archive-memory query must filter by the selected game's canonical `songId` set and selected game's normalized exported artist-name set. It may return historical rows from other games only for those candidate songs or artist labels.
- Prisma client ownership follows the existing `ArchiveInput` convention: helper functions that create a client must disconnect it, and helpers receiving a client must not disconnect it.

---

### 4e. Dependencies

No new npm, system, or third-party dependencies are introduced.

| Package | Purpose | Rationale |
|---|---|---|
| None | N/A | Existing Next.js, React, Prisma, and Node test tooling are sufficient. |

---

| ID | Condition | Verification |
|---|---|---|
| AC-02 | When multiple selectable games exist, the page renders a visible switcher, the default is deterministic, and `?game=<id>` changes the selected game without blending games. | integration test |

---

| ID | Condition | Verification |
|---|---|---|
| AC-04 | When no selectable game exists, `/` renders an explicit unavailable archive state and ignores nested round/song/player params. | integration test |

---

| ID | Condition | Verification |
|---|---|---|
| AC-06 | The competitive anchor renders a sole leader or tied leaders from selected-game scored submissions with score context, and never conflates participation or recurrence with winning. | unit and integration test |
| AC-07 | Missing or partial score/rank evidence suppresses or cavesats outcome-dependent claims while preserving unrelated eligible memory moments. | unit and integration test |
| AC-08 | A representative completed-game fixture renders a balanced board with at least one competitive, one song/discovery, and one social/participation moment when evidence exists for all three lenses. | integration test |
| AC-09 | Sparse-data fixtures omit unsupported moment families and render a coherent smaller selected-game recap with safe copy. | integration test |

---

2. **[TASK-02] Add selected-game recap read model** - Implement the selected-game recap query, selected-game-scoped projections, bounded archive-memory evidence lookup, and the fixture rows needed for selection, sparse, complete, partial, recurrence, and participation scenarios.
   `contracts: §4b-1, §4b-2, §4d-3, §4e` · `preserves: INV-01, INV-03, INV-05, INV-07, INV-10, INV-11, INV-13, INV-14` · `validates: AC-02, AC-04, AC-06, AC-07, AC-08, AC-09`

---
