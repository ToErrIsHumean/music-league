# Slice: TASK-03 — Build canonical song memory payload

> **Depends-on:** TASK-01
> **Universal:** SPEC-005-song-modal-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4b-1. No Prisma migration for Milestone 5

```txt
No schema changes are required for M5. The song modal derives from existing:
  Game(id, sourceGameId, displayName)
  Round(id, gameId, name, occurredAt, sequenceNumber)
  Submission(id, roundId, playerId, songId, score, rank, comment, createdAt)
  Song(id, title, normalizedTitle, spotifyUri, artistId)
  Artist(id, name, normalizedName)
  Player(id, displayName)
```

**Compatibility rule:** M5 consumes canonical `Song.id` and `Artist.id` from
the existing import pipeline. It must not introduce deduplication tooling,
title-similarity matching, genre/mood inference, external metadata enrichment,
or a precomputed familiarity table without a later explicit spec update.

---

#### §4c-2. `ArchiveSongModal`

```ts
interface SongHistoryRow {
  submissionId: number;
  gameId: number;
  gameLabel: string;
  roundId: number;
  roundName: string;
  occurredAt: string | null;
  submitter: {
    id: number;
    displayName: string;
  };
  result: {
    rank: number | null;
    score: number | null;
  };
  comment: string | null;
  isOrigin: boolean;
}

interface SongEvidenceShortcut {
  kind: "first-appearance" | "most-recent-appearance";
  label: string;
  submissionId: number;
}

interface SongArtistFootprint {
  songCount: number;
  submitterCount: number;
  submissionCount: number;
  notableSubmitters: Array<{
    id: number;
    displayName: string;
  }>;
}

interface ArchiveSongModalProps {
  originRoundId: number;
  song: {
    id: number;
    title: string;
    artistName: string;
  };
  familiarity: SongFamiliarityVerdict;
  summary: {
    firstSubmitter: { id: number; displayName: string } | null;
    mostRecentSubmitter: { id: number; displayName: string } | null;
    exactSongSubmissionCount: number;
    bestExactSongFinish: { rank: number; score: number | null; submissionId: number } | null;
    artistFootprint: SongArtistFootprint;
    recallComment: { submissionId: number; text: string } | null;
  };
  shortcuts: SongEvidenceShortcut[];
  historyGroups: Array<{
    gameId: number;
    gameLabel: string;
    isOriginGame: boolean;
    rows: SongHistoryRow[];
  }>;
  closeHref: string;
}
```

**Presentation rules:**

- Header identity is song title plus artist. Origin round is provenance copy,
  not a competing song definition.
- Above-fold content renders identity, the familiarity verdict, and terse
  people/moment evidence before the full history list.
- The modal may repeat the inline cue label for continuity, but the richer
  verdict copy must distinguish exact-song and artist facts when they diverge,
  for example a new song by a familiar artist.
- Summary content prioritizes named submitters, first/most recent appearances,
  artist footprint, and best exact-song finish over dense counts.
- `artistFootprint` summarizes same-artist submissions for canonical songs
  other than the opened `Song.id`; exact-song recurrence belongs in
  `exactSongSubmissionCount`, `bestExactSongFinish`, and the exact-song history
  rows.
- A single known submission is a complete state with identity, verdict,
  submitter, round, and result context when available.
- Missing rank or score must never block the modal. Result copy uses rank
  first when rank exists and score as supporting context when available.
- Comments are optional recall evidence. Render at most one selected short
  comment in the above-fold summary; do not render empty comment chrome.
- History groups preserve game provenance when a song spans games, with the
  origin game first when known and broader archive groups after it.
- History rows default newest first within each group.
- Evidence shortcuts are lightweight controls that jump to existing history
  rows. They do not introduce a second hierarchy or filtered view.

#### §4c-3. Contained unavailable song state

```ts
interface UnavailableSongStateProps {
  originRoundId: number;
  requestedSongId: number | null;
  closeHref: string;
}
```

**Presentation rules:**

- Render inside the existing round overlay / nested shell area when an origin
  song URL is stale or no longer resolves.
- State copy must be contained and non-alarming, indicating the song detail is
  unavailable while preserving the archive and origin round.
- The only required action is returning to the origin round via `closeHref`.

---

#### §4d-1. `SongFamiliarityVerdict`

```ts
type SongFamiliarityKind = "debut" | "known-artist" | "brought-back";

interface SongFamiliarityVerdict {
  kind: SongFamiliarityKind;
  label: "New to us" | "Known artist" | "Brought back";
  shortSummary: string;
  exactSongSubmissionCount: number;
  priorExactSongSubmissionCount: number;
  priorArtistSubmissionCount: number;
  priorArtistSongCount: number;
  throughSubmitters: Array<{
    id: number;
    displayName: string;
  }>;
}
```

**Classification rules:**

- `brought-back`: prior exact-song history exists in a round before the origin
  round when an origin round is known, or exact-song history count is greater
  than 1 when no single origin round is available.
- `known-artist`: no prior exact-song history applies, but prior same-artist
  history exists through one or more other songs in rounds before the origin
  round.
- `debut`: neither prior exact-song nor prior same-artist history exists.
- Exact-song history wins over artist-only history when both are true.
- Classification uses canonical `Song.id` for exact-song history and
  canonical `Artist.id` for same-artist history. It must not use title
  coincidence, genre, album, decade, mood, fuzzy matching, or external
  metadata.
- Artist-only prior counts used for `known-artist` exclude submissions for the
  opened canonical `Song.id`; exact-song evidence is represented by the
  exact-song counts and history rows instead.
- Same-round co-occurrence does not count as prior familiarity. If two
  different songs by the same artist appear in the origin round and that artist
  has no earlier archive submissions, both songs remain `New to us`.

#### §4d-2. `deriveSongFamiliarity()`

```ts
function deriveSongFamiliarity(input: {
  songId: number;
  artistId: number;
  originRoundId: number | null;
  originSubmissionId: number | null;
  exactSongSubmissions: Array<{
    id: number;
    roundId: number;
    roundSequenceNumber: number | null;
    playerId: number;
    playerName: string;
    createdAt: Date | string | null;
    roundOccurredAt: Date | string | null;
  }>;
  artistSubmissions: Array<{
    id: number;
    roundId: number;
    roundSequenceNumber: number | null;
    songId: number;
    playerId: number;
    playerName: string;
    createdAt: Date | string | null;
    roundOccurredAt: Date | string | null;
  }>;
}): SongFamiliarityVerdict
```

**Ordering rule:** When an origin round is known, "prior" means submissions in
rounds before that origin round by deterministic archive history order:
`Round.occurredAt` ascending with nulls last, then `Round.sequenceNumber`
ascending with nulls last, then `Round.id` ascending, then
`Submission.createdAt` ascending with nulls last, then `Submission.id`
ascending. Other submissions in the origin round are current-context evidence,
not prior familiarity evidence, even when their submission timestamps sort
earlier than the representative origin row. When no origin round is known, use
the full archive history and the fallback counts in §4d-1.
`originSubmissionId` remains the anchor for foregrounding, shortcuts, and
representative-origin agreement, not for same-round familiarity inflation.

#### §4d-3. `getSongMemoryModal()`

```ts
async function getSongMemoryModal(
  originRoundId: number,
  songId: number,
  input?: { prisma?: PrismaClient },
): Promise<ArchiveSongModalProps | { unavailable: true; originRoundId: number; requestedSongId: number } | null>
```

**Behavior rules:**

- Return `null` only when `originRoundId` itself cannot resolve.
- Return `unavailable` when the round resolves but the requested song cannot
  resolve to a usable origin context for this first-ship route.
- If anomalous multiple submissions in the origin round use the same canonical
  song, choose the earliest origin submission by `Submission.createdAt`
  ascending with nulls last, then `Submission.id` ascending as the deterministic
  representative origin. This same anchor is the route-visible origin used by
  round-row cues and player-history links that target that `round + song`
  state; duplicate same-round rows may be collapsed for this song-memory
  surface.
- Hydrate exact-song history across the archive for the canonical `Song.id`.
- Hydrate same-artist history across the archive for the canonical `Artist.id`
  without including non-canonical similarity matches.
- Populate `summary.artistFootprint` from same-artist submissions whose
  `songId` differs from the opened canonical song. The opened song's exact
  recurrence must remain visible through exact-song summary fields and
  exact-song history, not double-counted as artist-only familiarity evidence.
- Pass origin-round context into the shared familiarity derivation so
  same-round artist co-occurrences cannot be counted as historical prior
  evidence.
- Preserve each cross-round and cross-game submission as a distinct history row.
  Same-round duplicate submissions for the opened canonical song may be
  represented by the deterministic origin row rather than by separate duplicate
  rows.
- `historyGroups.rows` contain exact-song submissions only. Same-artist
  submissions for other songs may contribute to `familiarity` and
  `summary.artistFootprint`, but they must not appear in the opened song's
  submission history.
- Group history by `Game.id`; origin game appears first when present, then
  other games by newest contained row.
- Sort history rows newest first using `Round.occurredAt` descending with nulls
  last, then `Round.sequenceNumber` descending with nulls last, then
  `Round.id` descending, then `Submission.createdAt` descending with nulls
  last, then `Submission.id` descending.
- Select `firstSubmitter` and first appearance by the ascending history order
  from §4d-2.
- Select `mostRecentSubmitter` and most recent appearance by the descending
  history order above.
- Select `bestExactSongFinish` by lowest non-null rank, then highest non-null
  score, then newest row. If no rank exists, return `null`.
- Select `recallComment` only when at least one non-empty comment exists; use
  the most recent exact-song comment, trimmed to a short excerpt in UI copy.

---

#### §4d-8. Song-memory implementation locality

```txt
Shared song-memory derivation, history ordering, and verdict vocabulary live in
one internal boundary, either `src/archive/archive-utils.js` or an adjacent
`src/archive/song-memory.js` helper imported by archive-utils and tests.
```

**Behavior rules:**

- Route resolution, round row rendering, and modal rendering must consume the
  shared verdict and ordering helpers rather than reimplementing classification
  or history precedence in UI code.
- A new adjacent helper file is allowed if it improves locality for the
  familiarity model; no new package is required or allowed by M5.

---

| ID | Condition | Verification |
|---|---|---|
| AC-03 | The same canonical song opened from round detail and from player history receives the same semantic familiarity kind and modal verdict for the same route-visible origin context, including anomalous same-round duplicates that resolve through the deterministic representative origin | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-06 | Submission history renders as provenance evidence, newest first within game groups, preserving current/origin game foregrounding and broader archive grouping when the song spans games | `test` + `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-08 | First appearance and most recent appearance render as direct evidence shortcuts when they are distinct submission rows and jump to the corresponding history evidence | `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-10 | Sparse cases render meaningful detail states: one known submission, no prior artist history, missing rank or score, absent comments, and unresolved or stale origin-song URLs remain contained and intelligible | `test` + `manual` |
| AC-11 | M5 ships without global search, fuzzy matching, external metadata enrichment, recommendations, charts, vote-by-vote explainers, or multiple simultaneous familiarity badges | `review` |

---

3. **[TASK-03] Build canonical song memory payload** — Add `getSongMemoryModal()` and direct query coverage for archive-wide exact-song history, same-artist footprint inputs, deterministic origin anchoring, evidence shortcuts, game grouping, and unavailable origin-song payloads without yet changing in-app route precedence.
   `contracts: §4b-1, §4c-2, §4c-3, §4d-1, §4d-2, §4d-3, §4d-8` · `preserves: INV-01, INV-05, INV-06, INV-08, INV-09, INV-10, INV-11, INV-12` · `validates: AC-03, AC-06, AC-08, AC-10, AC-11`

---
