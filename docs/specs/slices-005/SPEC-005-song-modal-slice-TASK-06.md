# Slice: TASK-06 — Expand M5 fixtures and integrated regressions

> **Depends-on:** TASK-01, TASK-02, TASK-03, TASK-04, TASK-05
> **Universal:** SPEC-005-song-modal-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4b-2. Fixture expectations for song-memory coverage

```txt
Seed / integration data required for M5:
  - at least 1 true debut song whose artist has no prior submissions before the origin round
  - at least 1 new song by an artist with prior archive history
  - at least 1 exact-song repeat across rounds
  - at least 1 exact-song repeat across games
  - at least 1 song with missing rank or score
  - at least 1 song with no comments across history
  - at least 1 history case with first and most recent appearances as distinct rows
  - at least 1 stale or unresolvable origin-song URL case
```

**Contract note:** Do not add same-round duplicate fixtures for M5. If existing
or imported data contains multiple submissions for the same canonical song in a
single round, representative-origin behavior in §4d-3 is sufficient; do not
weaken the existing uniqueness constraint for M5.

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

#### §4d-4. Lightweight cue hydration for round detail

```ts
async function getRoundDetail(roundId: number, input?: { prisma?: PrismaClient }): Promise<{
  // existing round fields
  submissions: RoundSubmissionRow[];
} | null>
```

**Behavior rules:**

- Preserve the existing round-detail payload and ordering, adding only the
  `song.familiarity` field needed by §4c-1.
- Cue hydration must not require the full modal payload per row.
- Cue hydration must use batched archive evidence over the round's song IDs
  and artist IDs; it must not issue one archive-wide query per submission row
  or instantiate the full modal payload for each row.
- The same canonical song and origin submission must receive the same semantic
  classification that `getSongMemoryModal()` renders in the modal.
- If anomalous same-round duplicate submissions exist, cue hydration must use
  the deterministic representative origin from §4d-3 so the cue and modal do
  not diverge.
- Same-round same-artist co-occurrence must be handled by the shared
  familiarity derivation rather than by per-row UI heuristics.

#### §4d-5. `buildArchiveHref()` canonical song links

```ts
function buildArchiveHref(input?: {
  roundId?: number;
  songId?: number;
  playerId?: number;
  playerSubmissionId?: number;
}): string
```

**Behavior rules:**

- Preserve base archive and round-only href behavior.
- Preserve player href behavior for player modal opens.
- New or changed song links in round detail and player history use
  `roundId + songId`.
- New M5 code must not emit `playerSubmission` for song detail navigation.
- If `playerId` and `songId` are both supplied by new M5 code, prefer omitting
  `playerId` at the call site. The helper may retain its M4 precedence for
  backward compatibility, but M5 tests must assert canonical song links are
  round-plus-song links.

#### §4d-6. Player-history song-link convergence

```txt
When rendering song links in ArchivePlayerModal history or notable picks:
  before M5: /?round=<originRoundId>&player=<playerId>&playerSubmission=<submissionId>
  after M5:  /?round=<historyRoundId>&song=<songId>
```

**Behavior rules:**

- The clicked history row's round becomes origin context for the canonical
  song detail.
- The player modal close/back behavior remains unchanged for ordinary player
  links and round links.
- M4 player-scoped song view may remain as legacy code only when reachable by
  old direct URLs; new in-app song taps must converge on the canonical song
  surface.

#### §4d-7. Nested route-state resolution

```ts
type NestedArchiveSelection =
  | { kind: "none" }
  | { kind: "song"; songId: number; modal: ArchiveSongModalProps | UnavailableSongStateProps }
  | { kind: "player"; playerId: number; activeSubmissionId: number | null };
```

**Behavior rules:**

- Nested state is considered only after `?round=` resolves to an open round.
- Legacy M4 player-song direct URLs retain precedence only when both
  `?player=` and `?playerSubmission=` are present and the player resolves in
  the origin round. If the submission resolves, render the legacy active
  submission view; if the submission is stale, fall back to the player summary
  rather than opening a different song.
- Canonical song state is next: when `?song=` is present and no legacy
  `playerSubmission` flow owns the URL, resolve `getSongMemoryModal()` for the
  origin round and song.
- Player summary state is last: when `?player=` is present without `?song=`
  and without `?playerSubmission=`, resolve the existing player modal.
- Invalid integer params remain ignored. Invalid player state must not block a
  valid canonical song state unless the URL is a legacy playerSubmission flow.

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
| AC-01 | Round detail renders at most one compact familiarity cue per submission row, using `New to us`, `Known artist`, or `Brought back` from the shared classification model | `manual` + `test` |
| AC-02 | Familiarity derivation distinguishes true debut, same-artist/new-song, and prior exact-song history using only canonical `Song.id` and `Artist.id`; exact-song history wins when both apply, and same-round co-occurrence alone does not create prior familiarity | `test` |
| AC-03 | The same canonical song opened from round detail and from player history receives the same semantic familiarity kind and modal verdict for the same route-visible origin context, including anomalous same-round duplicates that resolve through the deterministic representative origin | `test` |
| AC-04 | Any new in-app song tap from round detail or player history opens canonical archive-wide song detail rather than the old current-round row shell or M4 player-scoped song subview | `manual` + `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-06 | Submission history renders as provenance evidence, newest first within game groups, preserving current/origin game foregrounding and broader archive grouping when the song spans games | `test` + `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-08 | First appearance and most recent appearance render as direct evidence shortcuts when they are distinct submission rows and jump to the corresponding history evidence | `manual` |
| AC-09 | Player links from history evidence open the submitting player in the evidence row's round context, and round links land on the referenced round URL state | `test` + `manual` |
| AC-10 | Sparse cases render meaningful detail states: one known submission, no prior artist history, missing rank or score, absent comments, and unresolved or stale origin-song URLs remain contained and intelligible | `test` + `manual` |
| AC-11 | M5 ships without global search, fuzzy matching, external metadata enrichment, recommendations, charts, vote-by-vote explainers, or multiple simultaneous familiarity badges | `review` |
| AC-12 | Nested route-state resolution preserves legacy `playerSubmission` direct URLs while new `round + song` links open exactly one canonical song detail surface, including mixed-query URLs | `test` |

---

6. **[TASK-06] Expand M5 fixtures and integrated regressions** — Add targeted seed or test fixtures plus end-to-end query/render coverage for the three familiarity states, cross-game grouping, missing result data, absent comments, evidence shortcuts, stale origin handling, mixed-query precedence, canonical player-history links, and out-of-scope exclusions.
   `contracts: §4b-2, §4d-1, §4d-2, §4d-3, §4d-4, §4d-5, §4d-6, §4d-7, §4d-8` · `preserves: INV-02, INV-03, INV-05, INV-08, INV-09, INV-10, INV-11, INV-12` · `validates: AC-01, AC-02, AC-03, AC-04, AC-06, AC-08, AC-09, AC-10, AC-11, AC-12`

---
