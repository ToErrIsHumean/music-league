# SPEC: Song Modal and Familiarity Cues

> **Version:** 0.1.8-draft
> **Milestone:** 5 - Song Modal
> **Status:** `draft`
> **Author:** final-review 1
> **Depends-on:** `docs/specs/SPEC-001-core-data-model.md`, `docs/specs/SPEC-002-csv-import-pipeline.md`, `docs/specs/SPEC-003-round-page.md`, `docs/specs/SPEC-004-player-modal.md`
> **Invalidated-by:** none

---

## 1. Objective

Make group song memory legible before and after a tap. Users scanning a round
should see one compact familiarity cue that distinguishes a true group debut,
a new song from a familiar artist, and a returning exact song; users who tap
should land in one canonical song detail surface that explains the people,
rounds, and results behind that cue.

Milestone 5 replaces the current round-scoped song shell with an archive-wide
song memory surface while preserving contextual browsing from round detail and
player history. The feature prioritizes user-story fidelity and fast
comprehension, with "intelligence" expressed as a deterministic shared
knowledge representation over exact-song and same-artist history rather than
speculative similarity, recommendations, or learned taste inference.

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| FSD | `docs/specs/FSD-005-song-modal.md` | Accepted product source for inline familiarity cues, canonical song detail, evidence history, navigation continuity, search readiness, and degraded states |
| Upstream player spec | `docs/specs/SPEC-004-player-modal.md` | Defines the current player modal and player-scoped song push that M5 must supersede for in-scope canonical song taps without breaking player navigation continuity |
| Archive route | `app/page.js` | Current Next.js entrypoint renders the archive route `/`; all modal state is represented by query params rather than standalone route files |
| Archive URL/data helpers | `src/archive/archive-utils.js` | Owns `buildArchiveHref()`, `getRoundDetail()`, `getSongRoundModal()`, `getPlayerRoundModal()`, and `getPlayerModalSubmission()`; this is the primary query and href expansion point |
| Current song loader | `src/archive/archive-utils.js#getSongRoundModal` | Hydrates only the first matching submission for `(roundId, songId)`, returning a round-scoped shell payload with submitter, rank, and score |
| Current round detail loader | `src/archive/archive-utils.js#getRoundDetail` | Returns ordered round submissions used by the priority inline-cue surface; currently has no familiarity state per song row |
| Archive UI | `src/archive/game-archive-page.js` | Renders round submission rows, nested round-scoped song shell, nested player modal, player history links, and query-param precedence |
| Route-state resolver | `src/archive/game-archive-page.js#resolveNestedSelection` | Gives valid player flow precedence over `?song=` and currently resolves `?song=` only after a valid round opens |
| Styling surface | `app/globals.css` | Establishes archive dialog, nested shell, submission row, player modal, and mobile layout styles that the M5 modal and cues should extend rather than replace wholesale |
| Schema | `prisma/schema.prisma` | Existing `Game`, `Round`, `Submission`, `Song`, `Artist`, and `Player` relations contain the required canonical identity and provenance data; no new table is obviously required |
| Query coverage | `prisma/tests/queries.test.js` | Existing tests prove the current song modal is round-scoped and hrefs are round-first; M5 must replace those assumptions deliberately |
| Route/render coverage | `prisma/tests/archive-page.test.js` | Confirms modal layering, direct entry, query precedence, and player-song flow behavior that M5 must preserve or supersede explicitly |
| Seed fixtures | `prisma/seed.js` | Current fixtures cover multiple games, scored and pending rounds, repeat artists, and some player history, but may need explicit M5 coverage for exact-song repeats and sparse history |

Current repo evidence shows a mature archive route with a round overlay and
nested modal shell, but song detail remains a thin current-round slice. M5
therefore upgrades the song concept and payload without introducing a global
search surface or a new persistence layer.

Authoring note: the FSD is authoritative for the user story, familiarity
model, canonical song meaning, and degraded-state behavior. The repo's
existing `Game` / `Round` route topology supplies implementation grounding for
origin context, grouping, and browser state where the FSD is intentionally
product-level rather than route-prescriptive.

## 3. Invariants

- **INV-01:** Every in-scope song tap resolves to the same canonical
  song-detail concept for the canonical `Song.id`. Origin context may affect
  close behavior, evidence foregrounding, and unavailable-state copy, but it
  must not redefine the opened song or produce a materially different song
  detail mode.
- **INV-02:** Inline cue and modal verdict share one mutually exclusive
  familiarity classification derived only from exact-song history and
  same-artist history for the canonical song identity.
- **INV-03:** A rendered song instance shows at most one familiarity cue. The
  first ship vocabulary is exactly `New to us`, `Known artist`, and
  `Brought back`; exact-song history outranks artist-only familiarity when
  both apply.
- **INV-04:** The modal's first visible content includes song title, artist,
  and deterministic familiarity verdict. The core answer must not require tab
  switching, accordion expansion, or scrolling into submission history.
- **INV-05:** Submission history is submission-level evidence. Duplicate
  appearances across rounds or games remain separate rows rather than being
  collapsed into song-level rollups.
- **INV-06:** When origin game or origin round is known and broader archive
  evidence exists, the current context is foregrounded without hiding broader
  archive memory.
- **INV-07:** Player and round links from song detail reinforce provenance and
  must not create alternate song-detail modes or a second song subview.
- **INV-08:** M5 improves contextual lookup from existing song taps and keeps
  the song detail suitable for future search, but it does not ship global
  search, fuzzy matching, instant results, or a standalone search UI.
- **INV-09:** A resolvable song identity opens even when rank, score, or
  comment data is missing. Missing optional data removes texture, not the
  identity, verdict, or provenance structure.
- **INV-10:** Full song-detail history rows are exact-song evidence for the
  canonical `Song.id`. Same-artist evidence may inform the verdict and artist
  footprint, but it must not be interleaved into the exact-song submission
  history as if those rows were appearances of the opened song.
- **INV-11:** Origin anchoring for the first-ship `round + song` route state is
  deterministic and shared by inline cues and modal payloads. M5 assumes there
  are no intentional same-song duplicates inside one round; if anomalous
  same-round duplicates exist, the earliest deterministic submission may be
  used as the representative origin and duplicate rows may be collapsed for
  this song-memory surface.
- **INV-12:** Familiarity is historical archive memory, not same-round
  co-occurrence. For an origin-round cue or modal, other submissions in the
  same round must not by themselves make a song `Known artist` or
  `Brought back`.

## 4. Interface Contracts

### 4a. API Surface

This milestone continues the existing server-rendered archive route rather
than adding a public JSON API. Route handlers or server actions may be used
internally only if implementation requires them, but the canonical user-facing
contract is the archive route below.

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

### 4b. Data Schema (migrations)

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

### 4c. Component Contracts

#### §4c-1. Round submission row with familiarity cue

```ts
interface RoundSubmissionRow {
  id: number;
  song: {
    id: number;
    title: string;
    artistName: string;
    familiarity: SongFamiliarityVerdict;
  };
  player: {
    id: number;
    displayName: string;
  };
  score: number | null;
  rank: number | null;
  comment: string | null;
}
```

**Presentation rules:**

- Round detail is the required first-ship inline-cue surface.
- The cue renders within the existing song row affordance and remains visually
  quiet enough that rank, score, submitter, title, and artist remain legible.
- Exactly one cue may render per song instance.
- The cue label is derived from `song.familiarity.label`.
- The row link continues to open song detail; the cue is not a separate
  navigation target.
- A row with missing rank, score, or comment still shows the cue when song and
  artist history are available.
- If anomalous same-round duplicates are present in source data, duplicate
  song rows may share one representative cue verdict for the route-visible
  `round + song` state.

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

### 4d. Internal Boundaries

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

### 4e. Dependencies

| Package | Purpose | Rationale |
|---|---|---|
| None | Use existing `next`, `react`, `react-dom`, `prisma`, and `@prisma/client` only | Current repo dependencies already cover the route, rendering, query, and deterministic derivation work needed for M5 |

## 5. Acceptance Criteria

| ID | Condition | Verification |
|---|---|---|
| AC-01 | Round detail renders at most one compact familiarity cue per submission row, using `New to us`, `Known artist`, or `Brought back` from the shared classification model | `manual` + `test` |
| AC-02 | Familiarity derivation distinguishes true debut, same-artist/new-song, and prior exact-song history using only canonical `Song.id` and `Artist.id`; exact-song history wins when both apply, and same-round co-occurrence alone does not create prior familiarity | `test` |
| AC-03 | The same canonical song opened from round detail and from player history receives the same semantic familiarity kind and modal verdict for the same route-visible origin context, including anomalous same-round duplicates that resolve through the deterministic representative origin | `test` |
| AC-04 | Any new in-app song tap from round detail or player history opens canonical archive-wide song detail rather than the old current-round row shell or M4 player-scoped song subview | `manual` + `test` |
| AC-05 | On open, the modal shows song title, artist, and a concise familiarity verdict above the fold, plus known first submitter, most recent submitter, exact-song submission count, artist footprint, and best exact-song finish when those facts exist | `manual` |
| AC-06 | Submission history renders as provenance evidence, newest first within game groups, preserving current/origin game foregrounding and broader archive grouping when the song spans games | `test` + `manual` |
| AC-07 | Each history row identifies submitter, round, and result; rank is primary and score is supporting context when available, while missing rank or score still leaves an intelligible row | `manual` |
| AC-08 | First appearance and most recent appearance render as direct evidence shortcuts when they are distinct submission rows and jump to the corresponding history evidence | `manual` |
| AC-09 | Player links from history evidence open the submitting player in the evidence row's round context, and round links land on the referenced round URL state | `test` + `manual` |
| AC-10 | Sparse cases render meaningful detail states: one known submission, no prior artist history, missing rank or score, absent comments, and unresolved or stale origin-song URLs remain contained and intelligible | `test` + `manual` |
| AC-11 | M5 ships without global search, fuzzy matching, external metadata enrichment, recommendations, charts, vote-by-vote explainers, or multiple simultaneous familiarity badges | `review` |
| AC-12 | Nested route-state resolution preserves legacy `playerSubmission` direct URLs while new `round + song` links open exactly one canonical song detail surface, including mixed-query URLs | `test` |

## 6. Task Decomposition Hints

1. **[TASK-01] Add shared song familiarity derivation** — Implement `SongFamiliarityVerdict`, deterministic exact-song-vs-artist classification, shared history ordering helpers, and focused unit coverage for debut, known-artist, brought-back, precedence, artist-only exclusion, same-round co-occurrence exclusion, and sparse ordering cases.
   `contracts: §4d-1, §4d-2, §4d-8` · `preserves: INV-02, INV-03, INV-08, INV-10, INV-12` · `validates: AC-02, AC-03, AC-11`
2. **[TASK-02] Hydrate round-detail familiarity cues** — Extend `getRoundDetail()` with lightweight batched cue data and render compact row cues on the existing round submission surface without changing row ordering or navigation affordances.
   `contracts: §4c-1, §4d-1, §4d-2, §4d-4, §4d-8` · `preserves: INV-02, INV-03, INV-09, INV-11, INV-12` · `validates: AC-01, AC-02, AC-03`
3. **[TASK-03] Build canonical song memory payload** — Add `getSongMemoryModal()` and direct query coverage for archive-wide exact-song history, same-artist footprint inputs, deterministic origin anchoring, evidence shortcuts, game grouping, and unavailable origin-song payloads without yet changing in-app route precedence.
   `contracts: §4b-1, §4c-2, §4c-3, §4d-1, §4d-2, §4d-3, §4d-8` · `preserves: INV-01, INV-05, INV-06, INV-08, INV-09, INV-10, INV-11, INV-12` · `validates: AC-03, AC-06, AC-08, AC-10, AC-11`
4. **[TASK-04] Wire and render canonical song detail** — Replace the round-scoped song-shell resolver path and visible shell with canonical song-state resolution, above-fold verdict, grouped exact-song history, evidence shortcut targets, rank-first result copy, player/round provenance links, close hrefs, contained unavailable states, and mixed-query precedence while preserving legacy `playerSubmission` direct URLs.
   `contracts: §4a-1, §4c-2, §4c-3, §4d-3, §4d-5, §4d-7, §4d-8` · `preserves: INV-01, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, INV-10, INV-11, INV-12` · `validates: AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12`
5. **[TASK-05] Converge player-history song taps on canonical song detail** — Change new player-modal song links from the M4 `playerSubmission` song subview to evidence-row anchored canonical `round + song` URLs while preserving ordinary player modal and round link behavior.
   `contracts: §4a-1, §4d-5, §4d-6, §4d-7` · `preserves: INV-01, INV-07, INV-11` · `validates: AC-03, AC-04, AC-12`
6. **[TASK-06] Expand M5 fixtures and integrated regressions** — Add targeted seed or test fixtures plus end-to-end query/render coverage for the three familiarity states, cross-game grouping, missing result data, absent comments, evidence shortcuts, stale origin handling, mixed-query precedence, canonical player-history links, and out-of-scope exclusions.
   `contracts: §4b-2, §4d-1, §4d-2, §4d-3, §4d-4, §4d-5, §4d-6, §4d-7, §4d-8` · `preserves: INV-02, INV-03, INV-05, INV-08, INV-09, INV-10, INV-11, INV-12` · `validates: AC-01, AC-02, AC-03, AC-04, AC-06, AC-08, AC-09, AC-10, AC-11, AC-12`

### Dependency Graph

```txt
TASK-01:
TASK-02: TASK-01
TASK-03: TASK-01
TASK-04: TASK-03
TASK-05: TASK-04
TASK-06: TASK-01,TASK-02,TASK-03,TASK-04,TASK-05
```

## 7. Out of Scope

- [ ] Global search, fuzzy matching, instant-result dropdowns, or a standalone
  search UI - Milestone 5 prepares the canonical destination but does not ship
  search.
- [ ] A new standalone song pathname or search-result locator independent of
  archive origin context - first ship may remain origin-aware as an
  implementation convenience.
- [ ] Recommendation, similarity matching, "you might also like" behavior, or
  learned taste inference.
- [ ] Familiarity inference from genre, album, decade, mood, title similarity,
  audio features, comments, scores, ranks, or other non-key metadata.
- [ ] External metadata enrichment from Spotify or other third-party APIs.
- [ ] Charts, score timelines, filters, analytics dashboards, vote-by-vote
  breakdowns, or scoring explainers inside song detail. Round-level vote
  evidence links are allowed when supplied by the round-detail contract, but
  song detail must not create a parallel vote explainer.
- [ ] First-release familiarity cues on every song mention across the product;
  round detail is the required inline-cue surface.
- [ ] Multiple simultaneous familiarity badges on one song instance.
- [ ] Merge, deduplication, or canonical-identity repair tooling.
- [ ] Weakening existing uniqueness constraints to manufacture duplicate
  submission cases.
- [ ] Alternate song subviews spawned from song detail.
- [ ] Submission-scoped song URLs solely to distinguish same-round duplicate
  origin anchors - first ship uses the deterministic `round + song` anchor.
- [ ] Preservation of same-song duplicate submissions within one round as
  separate song-memory evidence rows - HITL direction on 2026-04-24 says this
  case will not occur in product data and may be deduplicated if encountered.
  Disposition: dropped. Reason: product decision. Trace: §7 and OQ-08.

## 8. Open Questions

- **OQ-01:** What exact cue labels and precedence should M5 use? - **Resolution:** `resolved -> §3 INV-03, §4d-1` (`New to us`, `Known artist`, `Brought back`; exact-song history outranks artist-only familiarity)
- **OQ-02:** Is player history an inline-cue surface in first ship? - **Resolution:** `resolved -> §4c-1, §7` (round detail is required; player history must route song taps to canonical detail but does not need inline cues in M5)
- **OQ-03:** How should cross-game history display by default? - **Resolution:** `resolved -> §4c-2, §4d-3` (game groups remain visible as provenance, origin game first when known, rows newest first within each group)
- **OQ-04:** Should first ship add a more song-centric locator now? - **Resolution:** `resolved -> §4a-1, §7` (no standalone locator; route may stay origin-aware while payload semantics are canonical)
- **OQ-05:** How should player links from song history anchor? - **Resolution:** `resolved -> §4a-1` (open the submitting player in the evidence row's round context)
- **OQ-06:** What affordance should evidence shortcuts use? - **Resolution:** `resolved -> §4c-2` (lightweight controls that jump to existing history rows; no filtered or alternate evidence hierarchy)
- **OQ-07:** Does the FSD's product-level language require changing the repo's
  game / round route topology in M5? - **Resolution:** `resolved -> §2, §4a-1`
  (no; the FSD governs user-facing song meaning, while current game / round
  structure remains valid implementation provenance and browser state for first
  ship)
- **OQ-08:** How should same-round duplicate song submissions interact with a
  `round + song` URL that cannot identify the clicked submission? -
  **Resolution:** `resolved -> §3 INV-11, §4a-1, §4b-2, §4d-3, §4d-4, §7`
  (HITL direction on 2026-04-24 says same-round duplicates will not occur in
  product data and may be deduplicated if encountered; use the deterministic
  representative origin for cue/modal agreement)

---

## Appendix D: Discoveries Log

### D-001 — 2026-04-24T08:13:46Z

- **Trigger:** Meta-orchestrator dispatch for `TASK-01` failed before
  implementation because `bolder-meta-orchestrator` delegated to
  `scripts/sdd/orchestrator.sh`, which did not exist in this repo.
- **Nature:** `operational`
- **Affected sections:** orchestration hygiene only; no product contract
  sections changed
- **Agent assessment:** The repo exposes SDD commands through `package.json`
  package bins, while the meta-orchestrator's nested dispatch path expects
  repo-local role wrapper scripts. Adding narrow forwarding wrappers keeps the
  product spec unchanged and preserves `bolder-utils` as the implementation
  source of truth.
- **Escalation required:** `no` — low-blast-radius procedural fix authorized
  by the operator and reversible
- **Resolution:** Add repo-local forwarding wrappers for the orchestrator,
  implementer, and reviewer scripts, then resume meta-orchestration.

## Appendix E: Context Slices

### E.1 Two-file model

Every task invocation receives:

1. `SPEC-MMM-universal.md` — §1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries
2. `SPEC-MMM-slice-TASK-NN.md` — assembled from tokens below

§4 (contracts), §5 (ACs), §6 (task hints), and Appendix E are excluded from the universal file. Universal content is never repeated in slice files.

### E.2 Extraction contract

Section boundaries in the source spec follow the pattern:

```
#### §4a-N. Title    →  ends at next ####, ###, or EOF
#### §4c-N. Title    →  ends at next ####, ###, or EOF
```

Slice blocks are delimited:

```
&lt;!-- SLICE:TASK-NN --&gt;
&lt;!-- /SLICE:TASK-NN --&gt;
```

**Regex — extract named slice:**

```
<!-- SLICE:(TASK-[\w]+) -->[\s\S]*?<!-- /SLICE:\1 -->
```

**Regex — extract SECTIONS tokens from a slice:**

```
^  (§[\w-:]+)
```

*(exactly two leading spaces; distinguishes tokens from prose)*

**Regex — extract a section from the source spec by token `§4a-3`:**

```
(?=#### §4a-3\ .)[\s\S]*?(?=#### |### |## |$)
```

**Regex — extract a single task hint from §6:**

```
\d+\.\s+\*\*\[TASK-NN\][\s\S]*?(?=\n\d+\.\s+\*\*\[TASK-|\n###\s|\n##\s|$)
```

### E.3 Token grammar

|Token|Matches|
|-|-|
|`§4a-N`|Single API endpoint section|
|`§4a-N:M`|§4a-N through §4a-M inclusive|
|`§4b-N`|Single schema migration section|
|`§4b-N:M`|§4b-N through §4b-M inclusive|
|`§4c-N`|Single component contract section|
|`§4d-N`|Single internal boundary section|
|`§4d-N:M`|§4d-N through §4d-M inclusive|
|`§4e`|Full dependency table|
|`§5:AC-NN`|Single AC row|
|`§5:AC-NN:MM`|AC rows NN through MM inclusive|
|`§6:TASK-NN`|Single task decomposition hint entry (prose line + metadata line)|

### E.4 Slice definitions


<!-- SLICE:TASK-01 -->
TASK:     TASK-01
LABEL:    Add shared song familiarity derivation
DEPENDS:  (none)
SECTIONS:
§4d-1:2
§4d-8
§5:AC-02:03
§5:AC-11
§6:TASK-01
<!-- /SLICE:TASK-01 -->

<!-- SLICE:TASK-02 -->
TASK:     TASK-02
LABEL:    Hydrate round-detail familiarity cues
DEPENDS:  TASK-01
SECTIONS:
§4c-1
§4d-1:2
§4d-4
§4d-8
§5:AC-01:03
§6:TASK-02
<!-- /SLICE:TASK-02 -->

<!-- SLICE:TASK-03 -->
TASK:     TASK-03
LABEL:    Build canonical song memory payload
DEPENDS:  TASK-01
SECTIONS:
§4b-1
§4c-2:3
§4d-1:3
§4d-8
§5:AC-03
§5:AC-06
§5:AC-08
§5:AC-10:11
§6:TASK-03
<!-- /SLICE:TASK-03 -->

<!-- SLICE:TASK-04 -->
TASK:     TASK-04
LABEL:    Wire and render canonical song detail
DEPENDS:  TASK-03
SECTIONS:
§4a-1
§4c-2:3
§4d-3
§4d-5
§4d-7:8
§5:AC-04:12
§6:TASK-04
<!-- /SLICE:TASK-04 -->

<!-- SLICE:TASK-05 -->
TASK:     TASK-05
LABEL:    Converge player-history song taps on canonical song detail
DEPENDS:  TASK-04
SECTIONS:
§4a-1
§4d-5:7
§5:AC-03:04
§5:AC-12
§6:TASK-05
<!-- /SLICE:TASK-05 -->

<!-- SLICE:TASK-06 -->
TASK:     TASK-06
LABEL:    Expand M5 fixtures and integrated regressions
DEPENDS:  TASK-01, TASK-02, TASK-03, TASK-04, TASK-05
SECTIONS:
§4b-2
§4d-1:8
§5:AC-01:04
§5:AC-06
§5:AC-08:12
§6:TASK-06
<!-- /SLICE:TASK-06 -->

<!-- END SPEC -->
