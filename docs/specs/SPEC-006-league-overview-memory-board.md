# SPEC: Latest Game Memory Board

> **Version:** 0.1.9-draft
> **Milestone:** 6 - League Overview Memory Board
> **Status:** `draft`
> **Author:** final-review 2
> **Depends-on:** `docs/specs/SPEC-001-core-data-model.md`, `docs/specs/SPEC-002-csv-import-pipeline.md`, `docs/specs/SPEC-003-round-page.md`, `docs/specs/SPEC-004-player-modal.md`, `docs/specs/SPEC-005-song-modal.md`, `docs/specs/SPEC-PRE-M6-corrective-game-semantics-cleanup.md`
> **Invalidated-by:** changes to `docs/specs/FSD-006-league-overview-memory-board.md`, `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md`, or any accepted replacement for the M1-M5 archive browsing contracts

---

## 1. Objective

Make `/` open as a selected-game memory board instead of a multi-game archive directory. The page should resolve one deterministic latest game, make that choice legible and reversible, foreground the competitive result when score evidence supports it, and render a small set of evidence-backed moments that participants would recognize from that game.

Milestone 6 expresses intelligence as deterministic archive-fact curation: selection, knowledge representation, comparison, recurrence detection, and cautious inference over existing games, rounds, submissions, votes, scores, ranks, comments, players, songs, dates, and exported artist labels. It does not add external music enrichment, recommendation logic, learned taste inference, persona-specific variants, or unsupported humorous claims.

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| FSD | `docs/specs/FSD-006-league-overview-memory-board.md` | Product source for selected-game landing, balanced memory-board composition, competitive anchor, canonical drill-downs, basic-data intelligence, sparse-data behavior, and v1 exclusions. |
| Game model reference | `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md` | Defines `Game -> Round -> Submission/Vote` semantics, vote-derived scoring, canonical player/song/round meanings, and archive-memory posture. |
| Feature alignment checklist | `docs/reference/FEATURE_ALIGNMENT_CHECKLIST.md` | Guardrails for game scoping, deterministic ordering, source-fact support, navigation context, and unsupported music-app claims. |
| Pre-M6 cleanup spec | `docs/specs/SPEC-PRE-M6-corrective-game-semantics-cleanup.md` | Establishes first-class `Game` semantics, derived standings posture, canonical song links, vote evidence, insight-template guardrails, and prohibited M6 facts. |
| Archive route | `app/page.js` | Current `/` entrypoint builds props through `buildGameArchivePageProps()` and renders `GameArchivePage`. |
| Archive prop resolver/UI | `src/archive/game-archive-page.js` | Currently renders all games as archive sections, resolves `?round=`, `?song=`, and `?player=`, and owns route-level selection precedence. |
| Archive loaders/helpers | `src/archive/archive-utils.js` | Owns game listing, round detail, song memory, player modal, href construction, `deriveGameStandings()`, round highlights, and current sorting helpers. |
| Insight guardrails | `src/archive/insight-guardrails.js` | Provides dispatchable M6 insight-template validation and prohibits unsupported metadata, source-setting, and collaborator-level artist facts. |
| Song memory derivation | `src/archive/song-memory.js` | Provides exact-song and exported-artist familiarity classification that M6 should reuse for discovery/recurrence moments. |
| Player metrics derivation | `src/archive/player-metrics.js` | Provides scored-submission metrics and denominator-aware sample flags that M6 can consume for participation-safe player context. |
| Prisma schema | `prisma/schema.prisma` | Existing `Game`, `Round`, `Submission`, `Vote`, `Song`, `Artist`, and `Player` relations contain the v1 source facts; no new table is obviously required. |
| Seed fixtures | `prisma/seed.js` | Current fixture has two games, scored and unscored rounds, repeated songs/artists, submission comments, vote comments, and tied round winners, but it needs board-specific coverage for latest-game selection and balanced moment composition. |
| Existing tests | `prisma/tests/archive-page.test.js`, `prisma/tests/queries.test.js`, `src/archive/*.test.js` | Cover archive rendering, route-state precedence, standings helper behavior, round vote evidence, player metrics, song memory, and insight guardrails. |

Current repo evidence shows a mature server-rendered archive route with canonical round, player, and song detail surfaces. M6 should reshape the root page and add a selected-game recap payload rather than introduce a new persistence layer or alternative entity model.

Authoring note: the secondary heuristic for this run is better user experience and fidelity to the user story first, then more intelligence through perception, knowledge representation, inference, planning, learning, or action capabilities. In this draft, that favors a legible memory-board experience with deterministic, explainable inference over broader analytics or opaque personalization.

Checkpoint note: architecture-audit 2 / task-shaping 2 tightened selected-game framing evidence, route-context side effects, and task ownership without changing the FSD behavior. Drift check: no-drift.

Final-review note: no blocking findings remain after approval-gate cleanup. The no-migration contract is task-referenced, the broad regression-matrix task is explicitly elevated-depth, and the stage-end drift check is no-drift.

## 3. Invariants

- **INV-01:** `/` is about exactly one selected canonical `Game` at a time, or an explicit unavailable archive state when no selectable game exists. Multiple games must not be silently flattened into one recap.
- **INV-02:** The selected game is always legible through visible title/label, timeframe or round context, and switcher state when multiple games exist. If selection rests on weak fallback identity rather than date/sequence evidence, copy must avoid overstating "latest."
- **INV-03:** Default selection is deterministic and stable across reloads. The rule prefers explicit game recency from game rounds, then stable fallback identity, without depending on database return order.
- **INV-04:** A valid game switcher changes the selected game without changing canonical player, song, round, submission, or vote meanings. The switcher is suppressed when fewer than two selectable games exist.
- **INV-05:** Every rendered memory moment is backed by named archive facts. Comparison, count, rank, score, recurrence, novelty, or participation claims must declare their denominator, omission condition, evidence destination, and copy guardrails in §4d.
- **INV-06:** The board prioritizes a competitive anchor when standings evidence exists. Tied leaders stay visibly tied; arbitrary sort order must never fabricate a sole champion.
- **INV-07:** Missing or partial score/rank data suppresses or cavesats outcome-dependent claims without suppressing unrelated selected-game memory items.
- **INV-08:** When enough evidence exists, board composition includes at least one competitive result moment, one song/discovery memory moment, and one social/participation moment. Balance is achieved by default composition, not persona-specific personalization.
- **INV-09:** Unsupported, low-sample, or provenance-unclear candidate moments are omitted rather than replaced with generic playful copy that sounds factual.
- **INV-10:** Player, song, round, submission, vote, and game references retain canonical Music League meanings. The board may summarize and link to them, but must not create alternate local identities or local detail surfaces.
- **INV-11:** Song identity is canonical `Song.id` / Spotify URI. Artist memory uses the normalized exported artist display string only; collaborator-level artist claims are not in scope.
- **INV-12:** Comment-derived overview moments are deferred from v1. Existing round/song/player detail may still display comments under their current contracts, but the board must not ship a "People Reacted" moment or direct comment snippet until a later contract proves provenance, denominator, fixture, and copy safety.
- **INV-13:** V1 claims use current archive facts only. Genre, mood, duration, popularity, album, release year, audio features, Spotify enrichment, recommendations, inferred taste, adaptive personalization, vote-budget explanations, deadline explanations, and unsupported humor are prohibited.
- **INV-14:** Sparse data produces a smaller, cautious board and explicit unavailable sub-states, not a broken page, inert controls, empty decorative cards, or overclaimed copy.
- **INV-15:** URL state is a canonical entrypoint, not an enhancement layer. Round, song, player, submission, vote-breakdown, switcher, and close links must be cold-loadable and must preserve selected-game context whenever a selected game exists.

## 4. Interface Contracts

### 4a. API Surface

This milestone continues the existing server-rendered archive route. No public JSON API is introduced.

#### §4a-1. Archive route with selected game, board, and canonical drill-down state

```http
GET /?game=<gameId>&round=<roundId>&song=<songId>&player=<playerId>&playerSubmission=<submissionId>
```

```txt
Query params:
  game?: integer              // canonical Game.id for selected board state
  round?: integer             // canonical Round.id for open round overlay / evidence context
  song?: integer              // canonical Song.id for canonical song memory
  player?: integer            // canonical Player.id for player modal
  playerSubmission?: integer  // legacy player-song evidence input retained for compatibility

Response:
  200 HTML document containing:
    - selected-game memory board when a selectable game exists
    - explicit archive unavailable state when no selectable game exists
    - optional game switcher when multiple selectable games exist
    - optional round detail overlay for a selected-game round
    - optional canonical song memory or player modal under existing M5/M4 rules
    - optional non-blocking notice for invalid game or round params

Validation / error handling:
  - invalid integer params are ignored
  - invalid ?game=<id> falls back to deterministic default selection and renders a non-blocking "Game not found." notice
  - ?round=<id> without ?game=<id>, when valid, selects the round's parent Game and opens the round detail to preserve existing canonical links
  - ?round=<id> with an invalid ?game=<id>, when the round is valid, ignores the invalid game, selects the round's parent Game, opens the round detail, and renders the non-blocking "Game not found." notice
  - ?game=<id>&round=<id> opens the round only when the round belongs to the selected game; a mismatched round renders the selected board plus a non-blocking "Round not found in selected game." notice
  - ?game=<id>&round=<id> with a valid game and invalid round renders the selected board plus a non-blocking "Round not found." notice
  - ?song= and ?player= require a valid open round and continue to follow the existing deterministic nested-selection precedence
  - nested selection precedence remains player+playerSubmission first, then song, then player; invalid nested ids do not dismiss the selected board or a valid open round
  - when no selectable game exists, nested round/song/player params are ignored and the unavailable archive state renders
```

**Route behavior notes:**

- `buildArchiveHref()` may be extended to include `gameId` where useful, but existing `/?round=<roundId>` links remain valid and infer their parent game.
- The game switcher uses the same route and emits `/?game=<gameId>`.
- Board evidence links use canonical destinations: `round`, `song`, or `player` links with enough round/game context to explain the claim.
- Closing an open round detail from a selected board returns to `/?game=<selectedGameId>` instead of the root default-selection URL; closing nested song/player modal state returns to the containing selected-game round URL.
- Deep-linkable game selection is limited to this query param; M6 does not introduce saved user preferences, client-only board state, filters, or all-games overview state.

### 4b. Data Schema (migrations)

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

### 4c. Component Contracts

#### §4c-1. `GameMemoryBoardPage`

```ts
interface GameMemoryBoardPageProps {
  selectedGame: SelectedGameFrame | null;
  games: GameSwitcherOption[];
  board: MemoryBoardPayload | null;
  notices: string[];
  openRoundId: number | null;
  openRound: RoundDetailPayload | null;
  nestedEntity: null | { kind: "song" | "player"; id: number };
  openSongModal: SongMemoryModalPayload | null;
  openPlayerModal: PlayerModalPayload | null;
}
```

Presentation rules:

- If `selectedGame` is null, render an explicit unavailable state instead of an empty board.
- First viewport includes selected-game identity, cautious selection context, competitive anchor when available, and enough moment content to read as a memory board before scrolling.
- Render 4-6 moments when evidence supports them; render fewer with deliberate sparse-state copy when it does not.
- Suppress inert switcher controls when there is only one selectable game.
- The page must not visually regress into a dense dashboard, dominant standings table, advanced chart, or all-games directory.

#### §4c-2. Selected game frame and switcher

```ts
interface SelectedGameFrame {
  id: number;
  sourceGameId: string;
  displayLabel: string;
  timeframeLabel: string | null;
  roundCount: number;
  scoredRoundCount: number;
  selectionBasis:
    | "round-occurred-at"
    | "round-sequence"
    | "game-created-at"
    | "stable-source-game-id"
    | "explicit-query";
  selectionCopy: string;
}

interface GameSwitcherOption {
  id: number;
  displayLabel: string;
  timeframeLabel: string | null;
  isSelected: boolean;
  href: string;
}
```

Copy rules:

- `selectionCopy` may say "Latest game" only when the selected default is based on round occurrence, round sequence, or game creation evidence.
- When the default rests on `stable-source-game-id`, use cautious copy such as "Selected game."
- Explicit query selection may say "Selected game" and must not imply recency.

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

#### §4c-5. Route-aware overlay and evidence targets

Existing round, song, and player overlays remain the canonical detail surfaces, but their links must become selected-game aware after `/` becomes a one-game board.

Rules:

- Closing a round overlay opened from a selected-game board returns to `/?game=<selectedGameId>`, not `/`.
- Closing a nested song or player overlay returns to `/?game=<selectedGameId>&round=<originRoundId>` when the origin round belongs to the selected game.
- Links inside canonical song/player history that intentionally navigate to another game may use that evidence row's round context; they must not route through the old all-games directory as an intermediate surface.
- Existing song/player/round detail payloads that still expose legacy close hrefs must be adapted before rendering in the memory-board route, so selected-game pages do not leak `href="/"` or round-only close/back targets.
- Submission rows rendered inside round detail expose stable fragment ids in the form `submission-<submissionId>` when board evidence may link to a submission.
- The vote evidence section rendered inside round detail exposes the stable fragment id `vote-breakdown` when board evidence may link to vote evidence.
- Fragment targets are enhancement anchors only; the page must remain intelligible if the browser does not scroll to the fragment.

### 4d. Internal Boundaries

#### §4d-1. Selected game resolver

```ts
async function buildGameMemoryBoardPageProps(input?: {
  prisma?: PrismaClient;
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}): Promise<GameMemoryBoardPageProps>
```

Responsibilities:

- Parse and validate route params.
- Load selectable games and selected-game payloads.
- Preserve valid legacy `?round=` entry by selecting the round's parent game.
- Treat a valid explicit `?game=` as the selected-game authority; treat a valid `?round=` as the selected-game authority only when no valid `?game=` was supplied.
- Preserve a valid round deep link even when `?game=` is syntactically valid but points at no game; in that case the invalid-game notice remains non-blocking and the round's parent game is selected.
- Enforce selected-game/round consistency when both params are present.
- Delegate canonical nested song/player behavior to existing M4/M5 loaders after open-round resolution.

#### §4d-2. Selectable game listing and default order

```ts
async function listSelectableGames(input?: ArchiveInput): Promise<GameSwitcherOptionSource[]>

interface GameSwitcherOptionSource {
  id: number;
  sourceGameId: string;
  displayLabel: string;
  roundCount: number;
  scoredRoundCount: number;
  earliestOccurredAt: string | null;
  latestOccurredAt: string | null;
  highestSequenceNumber: number | null;
  createdAt: string;
}
```

Default ordering:

1. latest non-null `Round.occurredAt` descending
2. highest non-null `Round.sequenceNumber` descending
3. `Game.createdAt` descending
4. `Game.sourceGameId` ascending
5. `Game.id` ascending

Selectable games must have at least one round. A game with missing score/rank data is still selectable; competitive claims degrade under §4d-5.

Frame and copy derivation:

- `timeframeLabel` should prefer an explicit date span from `earliestOccurredAt` and `latestOccurredAt`; when no date evidence exists, it may fall back to round count or sequence context rather than a blank label.
- The resolver must record the ordering tier that selected the default game. Defaults chosen by round occurrence, round sequence, or game creation evidence use the matching recency `selectionBasis`; defaults chosen only by stable source identity or database id use `stable-source-game-id` copy guardrails.
- Explicit `?game=` selection always sets `selectionBasis: "explicit-query"` even when the same game would also be the deterministic default.

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

#### §4d-10. Selected-game route context adapter

```ts
interface SelectedGameRouteContext {
  selectedGameId: number;
  openRoundId: number | null;
  selectedGameHref: string;
}

function applySelectedGameRouteContext<T>(
  payload: T,
  context: SelectedGameRouteContext,
): T
```

Responsibilities:

- Provide one local adaptation boundary between existing M3-M5 detail payloads and the M6 selected-game route contract.
- Replace or derive round, song, player, submission, vote-breakdown, close, and back hrefs with selected-game-aware hrefs before render.
- Preserve intentional cross-game history navigation by using the destination row's `gameId` and `roundId`, not the currently selected game.
- Leave canonical entity identity untouched; the adapter changes route context and return targets only.
- Omit a board evidence link when neither `gameId` nor a resolvable `roundId` is available for the destination.
- Prefer adding explicit href fields to adapted payloads over recomputing route strings inside deeply nested render helpers.

Existing loaders such as `getSongMemoryModal()`, `getPlayerRoundModal()`, and `getRoundDetail()` may keep returning legacy-compatible hrefs for old tests during the transition, but `GameMemoryBoardPage` must render the adapted selected-game hrefs.

#### §4d-11. Route module transition boundary

```ts
interface ArchivePageModuleExports {
  GameMemoryBoardPage: typeof GameMemoryBoardPage;
  buildGameMemoryBoardPageProps: typeof buildGameMemoryBoardPageProps;
  GameArchivePage?: typeof GameMemoryBoardPage;
  buildGameArchivePageProps?: typeof buildGameMemoryBoardPageProps;
}
```

Rules:

- `app/page.js` must render the memory board props and component after this milestone.
- The old all-games directory render path must not remain as a parallel route-level product surface.
- Existing `GameArchivePage` / `buildGameArchivePageProps` exports may remain only as compatibility aliases that delegate to the memory-board implementation during the transition; they must not maintain a separate all-games archive UI or a second prop resolver.
- Tests may be updated to import the new names, the aliases, or both, but either import path must exercise the same route behavior.

### 4e. Dependencies

No new npm, system, or third-party dependencies are introduced.

| Package | Purpose | Rationale |
|---|---|---|
| None | N/A | Existing Next.js, React, Prisma, and Node test tooling are sufficient. |

## 5. Acceptance Criteria

| ID | Condition | Verification |
|---|---|---|
| AC-01 | Opening `/` with no query resolves exactly one deterministic selected game when at least one selectable game exists. | integration test |
| AC-02 | When multiple selectable games exist, the page renders a visible switcher, the default is deterministic, and `?game=<id>` changes the selected game without blending games. | integration test |
| AC-03 | When only one selectable game exists, the switcher is suppressed and no inert game control is rendered. | integration test |
| AC-04 | When no selectable game exists, `/` renders an explicit unavailable archive state and ignores nested round/song/player params. | integration test |
| AC-05 | Selected-game copy uses "Latest game" only when default selection rests on recency evidence; weak fallback identity uses cautious selected-game copy. | unit or integration test |
| AC-06 | The competitive anchor renders a sole leader or tied leaders from selected-game scored submissions with score context, and never conflates participation or recurrence with winning. | unit and integration test |
| AC-07 | Missing or partial score/rank evidence suppresses or cavesats outcome-dependent claims while preserving unrelated eligible memory moments. | unit and integration test |
| AC-08 | A representative completed-game fixture renders a balanced board with at least one competitive, one song/discovery, and one social/participation moment when evidence exists for all three lenses. | integration test |
| AC-09 | Sparse-data fixtures omit unsupported moment families and render a coherent smaller selected-game recap with safe copy. | integration test |
| AC-10 | Every rendered moment exposes a canonical evidence path to a round, player, song, submission fragment, vote-breakdown fragment, or selected-game context appropriate to the claim. | integration test |
| AC-11 | `/?round=<id>` legacy links infer the round's parent game and still open canonical round detail; invalid `?game=` does not block a valid round deep link; `?game=<id>&round=<otherGameRoundId>` does not open cross-game round detail. | integration test |
| AC-12 | Song evidence links open canonical song memory and player evidence links open the existing player modal without creating alternate local board detail surfaces. | integration test |
| AC-13 | The board renders no v1 claims based on genre, mood, audio features, popularity, recommendations, personalization, inferred taste, unsupported humor, source deadline behavior, or vote-budget behavior. | unit and render regression test |
| AC-14 | Comment-backed "People Reacted" board moments and direct board comment snippets are absent from v1, while existing detailed comment surfaces remain governed by M4/M5/pre-M6 contracts. | render regression test |
| AC-15 | Manual product review confirms the first viewport is screenshot-friendly, comprehensible in roughly five seconds, and not dominated by a dense dashboard, large table, complex chart, or all-games directory. | manual |
| AC-16 | Switcher, evidence, nested-modal, and close links preserve selected-game context from cold loads and never return the user to the old all-games directory surface. | integration test |

## 6. Task Decomposition Hints

TASK-00 is omitted. The touched §2 artifacts use the repo's current CommonJS/Next.js conventions; M6 changes should preserve those conventions rather than run a separate mechanical conformance pass.

1. **[TASK-01] Establish selected-game route foundation** - Replace the root archive resolver substrate with selectable-game listing, deterministic default ordering, `?game=` parsing, legacy `?round=` parent-game inference, selected-game frame/switcher props, no-game unavailable props, and compatibility aliases for the old archive exports.
   `contracts: §4a-1, §4c-1, §4c-2, §4d-1, §4d-2, §4d-11, §4e` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-10, INV-14, INV-15` · `validates: AC-01, AC-02, AC-03, AC-04, AC-05, AC-11`
2. **[TASK-02] Add selected-game recap read model** - Implement the selected-game recap query, selected-game-scoped projections, bounded archive-memory evidence lookup, and the fixture rows needed for selection, sparse, complete, partial, recurrence, and participation scenarios.
   `contracts: §4b-1, §4b-2, §4d-3, §4e` · `preserves: INV-01, INV-03, INV-05, INV-07, INV-10, INV-11, INV-13, INV-14` · `validates: AC-02, AC-04, AC-06, AC-07, AC-08, AC-09`
3. **[TASK-03] Build route-aware evidence navigation** - Extend archive href construction, add memory-board evidence hrefs, adapt existing round/song/player payloads to selected-game route context, and add stable submission and vote-breakdown fragment targets.
   `contracts: §4a-1, §4c-5, §4d-9, §4d-10, §4e` · `preserves: INV-04, INV-10, INV-15` · `validates: AC-10, AC-11, AC-12, AC-16`
4. **[TASK-04] Derive competitive board facts** - Add standings completeness metadata, competitive anchor construction, and game-swing derivation from selected-game submissions and rounds only.
   `contracts: §4c-3, §4c-4, §4d-4, §4d-5, §4d-6, §4e` · `preserves: INV-01, INV-05, INV-06, INV-07, INV-09, INV-13, INV-14` · `validates: AC-06, AC-07, AC-09, AC-10, AC-13`
5. **[TASK-05] Derive song, recurrence, and participation moments** - Implement `new-to-us-that-landed`, `back-again-familiar-face`, `participation-pulse`, board-family priority, sparse-state omission behavior, source facts, denominators, and copy guardrails.
   `contracts: §4c-3, §4d-4, §4d-7, §4d-8, §4d-9, §4e` · `preserves: INV-05, INV-08, INV-09, INV-10, INV-11, INV-12, INV-13, INV-14, INV-15` · `validates: AC-07, AC-08, AC-09, AC-10, AC-12, AC-13, AC-14`
6. **[TASK-06] Render the Memory Board route** - Replace the all-games directory UI with the selected-game frame, visible switcher when eligible, competitive anchor, curated moments, sparse-state copy, canonical overlays, selected-game-aware close links, and responsive first-viewport styling.
   `contracts: §4a-1, §4c-1, §4c-2, §4c-3, §4c-4, §4c-5, §4d-1, §4d-9, §4d-10, §4d-11, §4e` · `preserves: INV-01, INV-02, INV-04, INV-08, INV-09, INV-10, INV-14, INV-15` · `validates: AC-01, AC-02, AC-03, AC-04, AC-08, AC-09, AC-10, AC-11, AC-12, AC-15, AC-16`
7. **[TASK-07] Close the regression matrix** - Consolidate focused unit, integration, render-regression, and manual-review coverage for the full M6 behavior matrix, including fixture sufficiency, prohibited claims, deferred comment-board moments, route compatibility aliases, sparse-state degradation, and selected-game context preservation from cold loads.
   `contracts: §4a-1, §4b-2, §4c-1, §4c-2, §4c-3, §4c-4, §4c-5, §4d-1, §4d-2, §4d-3, §4d-4, §4d-5, §4d-6, §4d-7, §4d-8, §4d-9, §4d-10, §4d-11, §4e` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, INV-10, INV-11, INV-12, INV-13, INV-14, INV-15` · `validates: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16` · `depth: elevated`

### Dependency Graph

```
TASK-01:
TASK-02: TASK-01
TASK-03: TASK-01
TASK-04: TASK-02
TASK-05: TASK-02,TASK-03
TASK-06: TASK-03,TASK-04,TASK-05
TASK-07: TASK-06
```

## 7. Out of Scope

- [ ] All-games overview or cross-game blended landing board on `/` - v1 is always one selected game at a time.
- [ ] Dense standings table, full leaderboard expansion, advanced filters, complex charts, or analytics dashboard layout - the v1 surface is a memory board.
- [ ] Persisted standings, leaderboard, insight, moment, or recommendation tables - M6 uses derived read models.
- [ ] External music enrichment, recommendations, personalization, adaptive persona boards, inferred taste modeling, genre/mood/audio-feature/popularity/release-year/album/duration claims, or ML-generated insight claims - prohibited by FSD source limits and INV-13.
- [ ] Collaborator-level artist parsing from combined exported artist labels - v1 uses normalized exported artist display strings.
- [ ] Vote-budget, deadline, penalty, disqualification, low-stakes, or source-setting explanations - no accepted source contract exists for those facts.
- [ ] Unsupported joke generation, generic player traits, durable low-sample tendencies, or decorative novelty layers - unsupported filler is omitted.
- [ ] Comment-backed `People Reacted` board moments and direct board comment snippets - deferred because v1 can satisfy the social/user-story requirement through Participation Pulse while comment-backed overview copy needs tighter provenance, denominator, fixture, and copy-safety work. `Disposition: deferred` `Reason: risk reduction` `Trace: §7 | BACKLOG.md | FSD-006 F4.1/F4.2/F7.2`
- [ ] Saved user preferences, client-only board filters, and board selection state beyond the minimal `?game=` query param - not required for v1 switcher legibility.

## 8. Open Questions

- **OQ-01:** Should `partial` standings completeness render an unavailable competitive anchor or omit the anchor and rely on sparse-state copy? - **Resolution:** `resolved -> §4c-4, §4d-5`
- **OQ-02:** What exact visual density satisfies "screenshot-friendly first viewport" once real content lengths are visible in browser screenshots? - **Resolution:** `resolved -> §4c-1, §5 AC-15, §6 TASK-06`

---

## Appendix D: Discoveries Log

<!-- APPEND-ONLY during implementation. The task agent writes here when encountering -->
<!-- spec gaps, ambiguities, or emergent requirements during execution. -->
<!-- Each entry triggers an escalation assessment per ESCALATION_CRITERIA.md. -->

---

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
LABEL:    Establish selected-game route foundation
DEPENDS:  (none)
SECTIONS:
§4a-1
§4c-1:2
§4d-1:2
§4d-11
§4e
§5:AC-01:05
§5:AC-11
§6:TASK-01
<!-- /SLICE:TASK-01 -->

<!-- SLICE:TASK-02 -->
TASK:     TASK-02
LABEL:    Add selected-game recap read model
DEPENDS:  TASK-01
SECTIONS:
§4b-1:2
§4d-3
§4e
§5:AC-02
§5:AC-04
§5:AC-06:09
§6:TASK-02
<!-- /SLICE:TASK-02 -->

<!-- SLICE:TASK-03 -->
TASK:     TASK-03
LABEL:    Build route-aware evidence navigation
DEPENDS:  TASK-01
SECTIONS:
§4a-1
§4c-5
§4d-9:10
§4e
§5:AC-10:12
§5:AC-16
§6:TASK-03
<!-- /SLICE:TASK-03 -->

<!-- SLICE:TASK-04 -->
TASK:     TASK-04
LABEL:    Derive competitive board facts
DEPENDS:  TASK-02
SECTIONS:
§4c-3:4
§4d-4:6
§4e
§5:AC-06:07
§5:AC-09:10
§5:AC-13
§6:TASK-04
<!-- /SLICE:TASK-04 -->

<!-- SLICE:TASK-05 -->
TASK:     TASK-05
LABEL:    Derive song, recurrence, and participation moments
DEPENDS:  TASK-02, TASK-03
SECTIONS:
§4c-3
§4d-4
§4d-7:9
§4e
§5:AC-07:10
§5:AC-12:14
§6:TASK-05
<!-- /SLICE:TASK-05 -->

<!-- SLICE:TASK-06 -->
TASK:     TASK-06
LABEL:    Render the Memory Board route
DEPENDS:  TASK-03, TASK-04, TASK-05
SECTIONS:
§4a-1
§4c-1:5
§4d-1
§4d-9:11
§4e
§5:AC-01:04
§5:AC-08:12
§5:AC-15:16
§6:TASK-06
<!-- /SLICE:TASK-06 -->

<!-- SLICE:TASK-07 -->
TASK:     TASK-07
LABEL:    Close the regression matrix
DEPENDS:  TASK-06
SECTIONS:
§4a-1
§4b-2
§4c-1:5
§4d-1:11
§4e
§5:AC-01:16
§6:TASK-07
<!-- /SLICE:TASK-07 -->

<!-- END SPEC -->
