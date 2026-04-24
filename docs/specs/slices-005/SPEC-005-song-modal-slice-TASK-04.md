# Slice: TASK-04 — Wire and render canonical song detail

> **Depends-on:** TASK-03
> **Universal:** SPEC-005-song-modal-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4a-1. Archive route with canonical song memory state

```http
GET /?round=<roundId>&song=<songId>&player=<playerId>&playerSubmission=<submissionId>
```

```txt
Query params:
  round?: integer             // canonical Round.id for the open round overlay / origin context
  song?: integer              // canonical Song.id for canonical song detail
  player?: integer            // canonical Player.id for the player modal
  playerSubmission?: integer  // legacy M4 player-song push input, superseded for song opens

Response:
  200 HTML document containing:
    - archive route with game sections
    - optional round detail overlay for ?round=
    - optional canonical song detail when ?song= resolves in a valid origin context
    - optional player modal for ?player=
    - optional contained unavailable state for stale origin-song combinations

Validation / error handling:
  - invalid integer params are ignored
  - invalid ?round=<id> renders the archive plus the existing non-blocking
    "Round not found." notice; no nested song or player modal opens
  - ?song=<id> without a valid open round is ignored in first ship
  - ?song=<id> with a valid round but no resolvable Song renders a contained
    unavailable song state inside the round overlay
  - ?song=<id> with a valid Song but an origin round that no longer contains
    that song renders the same contained unavailable song state; it must not
    fall back to a broken nested shell
  - ?player=<id> without a valid open round is ignored
  - valid player flow retains precedence over playerSubmission; however,
    player-history song links introduced or changed by M5 MUST target
    canonical song detail with ?song=<songId> rather than the M4
    playerSubmission song subview
  - if both ?player= and ?song= are present, follow the deterministic nested
    route precedence in §4d-7; new M5 song links MUST omit ?player= to avoid
    parallel song meanings
```

**Route behavior notes:**

- Round-detail song links use `buildArchiveHref({ roundId, songId })`.
- Player-history song links use
  `buildArchiveHref({ roundId: evidenceRoundId, songId })` so the canonical
  song detail foregrounds the clicked evidence row's game/round context.
- If anomalous same-round duplicate submissions exist for the same canonical
  `songId`, first-ship route state foregrounds the deterministic representative
  origin from §4d-3 rather than adding a submission-scoped song URL.
- Closing canonical song detail returns to `buildArchiveHref({ roundId })` for
  the origin round that opened it.
- Round links inside song history use `buildArchiveHref({ roundId:
  historyRoundId })`.
- Player links inside song history use `buildArchiveHref({ roundId:
  historyRoundId, playerId: submitterId })`, anchoring the player modal to the
  evidence row's round because that row best explains the provenance.
- M5 may keep the nested shell implementation, but visible copy and payload
  semantics must present one canonical archive-wide song memory surface rather
  than a round-scoped submission shell.
- Game and round query state are implementation provenance for the current
  archive route, not a product-level redefinition of song identity.

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

---

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
| AC-04 | Any new in-app song tap from round detail or player history opens canonical archive-wide song detail rather than the old current-round row shell or M4 player-scoped song subview | `manual` + `test` |
| AC-05 | On open, the modal shows song title, artist, and a concise familiarity verdict above the fold, plus known first submitter, most recent submitter, exact-song submission count, artist footprint, and best exact-song finish when those facts exist | `manual` |
| AC-06 | Submission history renders as provenance evidence, newest first within game groups, preserving current/origin game foregrounding and broader archive grouping when the song spans games | `test` + `manual` |
| AC-07 | Each history row identifies submitter, round, and result; rank is primary and score is supporting context when available, while missing rank or score still leaves an intelligible row | `manual` |
| AC-08 | First appearance and most recent appearance render as direct evidence shortcuts when they are distinct submission rows and jump to the corresponding history evidence | `manual` |
| AC-09 | Player links from history evidence open the submitting player in the evidence row's round context, and round links land on the referenced round URL state | `test` + `manual` |
| AC-10 | Sparse cases render meaningful detail states: one known submission, no prior artist history, missing rank or score, absent comments, and unresolved or stale origin-song URLs remain contained and intelligible | `test` + `manual` |
| AC-11 | M5 ships without global search, fuzzy matching, external metadata enrichment, recommendations, charts, vote-by-vote explainers, or multiple simultaneous familiarity badges | `review` |
| AC-12 | Nested route-state resolution preserves legacy `playerSubmission` direct URLs while new `round + song` links open exactly one canonical song detail surface, including mixed-query URLs | `test` |

---

4. **[TASK-04] Wire and render canonical song detail** — Replace the round-scoped song-shell resolver path and visible shell with canonical song-state resolution, above-fold verdict, grouped exact-song history, evidence shortcut targets, rank-first result copy, player/round provenance links, close hrefs, contained unavailable states, and mixed-query precedence while preserving legacy `playerSubmission` direct URLs.
   `contracts: §4a-1, §4c-2, §4c-3, §4d-3, §4d-5, §4d-7, §4d-8` · `preserves: INV-01, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, INV-10, INV-11, INV-12` · `validates: AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12`

---
