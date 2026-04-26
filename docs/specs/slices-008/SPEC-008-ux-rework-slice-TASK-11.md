# Slice: TASK-11 — Build player detail route and trait registry

> **Depends-on:** TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10
> **Universal:** SPEC-008-ux-rework-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4a-6. Player detail route

```
GET /players/[playerId]
Query:
  voteGameId?: positive integer
Response: player detail with aggregate context, threshold-gated trait line, notable picks, submission history, votes-given table, and votes-received table.

Errors:
  Invalid playerId: render status notice with link to /.
  Player without submissions or votes: render player header with sparse-state copy rather than fabricated aggregates.
  Invalid voteGameId or a voteGameId where the player has no vote/submission evidence: normalize to archive-wide voting history.
```

---

#### §4c-6. Player detail

```ts
interface PlayerDetailProps {
  player: {
    id: number;
    displayName: string;
    totalSubmissions: number;
    totalVotesCast: number;
    totalPointsReceived: number;
  };
  traits: PlayerTraitLine[];
  notablePicks: Array<PlayerNotablePick>;
  submissionGroups: Array<PlayerSubmissionGroup>;
  voteScope: PlayerVoteScopeModel;
  votesGiven: PlayerVoteTable;
  votesReceived: PlayerVoteTable;
}

interface PlayerVoteScopeModel {
  active:
    | { kind: "all"; label: "All games"; href: string }
    | { kind: "game"; gameId: number; gameName: string; href: string };
  options: Array<
    | { kind: "all"; label: "All games"; href: string; selected: boolean }
    | { kind: "game"; gameId: number; gameName: string; href: string; selected: boolean }
  >;
}

interface PlayerTraitLine {
  traitId: "consistent-finisher" | "frequent-commenter" | "high-variance-voter" | "voting-twin";
  label: string;
  badgeVariant: "trait";
  evidence: Array<{
    metric: string;
    value: number;
    threshold: string;
  }>;
  subjectPlayer?: { playerId: number; displayName: string; href: string };
}

interface PlayerNotablePick {
  kind: "best" | "worst";
  gameId: number;
  gameName: string;
  submissionId: number;
  song: { id: number; title: string; artistName: string; href: string };
  round: { id: number; name: string; href: string };
  rank: number | null;
  score: number;
}

interface PlayerSubmissionGroup {
  gameId: number;
  gameName: string;
  rows: Array<{
    submissionId: number;
    round: { id: number; name: string; href: string };
    song: { id: number; title: string; artistName: string; href: string };
    rank: number | null;
    score: number | null;
    comment: string | null;
  }>;
}

interface PlayerVoteTable {
  hasNegativeVotes: boolean;
  rows: PlayerVoteTableRow[];
}

interface PlayerVoteTableRow {
  playerId: number;
  displayName: string;
  href: string;
  voteCount: number;
  positivePoints: number;
  negativePoints: number;
  netPoints: number;
  averagePoints: number;
  comments: Array<{
    voteId: number;
    gameId: number;
    gameName: string;
    roundId: number;
    roundName: string;
    roundHref: string;
    comment: string;
  }>;
}
```

Trait rows are suppressed when thresholds are not met. `traitId` is the stable registry key used for tests, ordering, and `data-trait-id`; dynamic text such as the counterparty name for a voting-twin trait lives in `label` and `subjectPlayer`, never in the ID. Vote tables filter self-rows and split positive/negative points when negative votes exist.

Notable picks are selected per game: best pick uses highest non-null score, then lower rank, then more recent `submittedAt`, then stable submission ID; worst pick uses lowest non-null score, then higher rank, then older `submittedAt`, then stable submission ID. Null-score submissions are excluded from notable-pick selection.

Vote table rows aggregate archive-wide by counterparty by default. The secondary per-game scope is selected through `voteGameId` links on the same player route. Rows sort by `abs(netPoints)` descending, then `voteCount` descending, then display name ascending. When `hasNegativeVotes` is false, the UI may render a single net-points column; when true, it renders positive, negative, and net values.

---

#### §4d-6. Page data loaders

```js
getLandingPageData({ year?: string, winner?: string, input }) => LandingPageProps
getSongBrowserData({ q?: string, familiarity?: string, sort?: string, input }) => SongBrowserProps
getGamePageData(gameId, input) => RouteDataResult<GamePageProps>
getRoundPageData(gameId, roundId, input) => RouteDataResult<RoundPageProps>
getSongDetailData(songId, input) => RouteDataResult<SongDetailProps>
getPlayerDetailData(playerId, { voteGameId?: number | null, input }) => RouteDataResult<PlayerDetailProps>

type RouteDataResult<T> =
  | { kind: "ready"; props: T }
  | { kind: "not-found"; statusNotice: StatusNoticeModel }
  | { kind: "sparse"; props: T; statusNotice: StatusNoticeModel };

interface StatusNoticeModel {
  title: string;
  body: string;
  href: string;
  hrefLabel: string;
}
```

Each loader accepts a Prisma injection for tests, returns serializable props, and owns its route's invalid/sparse states without relying on the old single-page selection resolver. Round loaders must distinguish invalid game, invalid round, and round-outside-game cases so the route can link to the nearest valid context named in §4a-3. `getSongBrowserData` owns `/songs` query normalization, invalid filter/sort normalization, empty-archive state, zero-result state, and the empty-query 100-row cap through §4d-4 rather than duplicating catalog logic in the route component.
`getGamePageData` derives its round list through §4d-17 so fixed round-list navigation remains independent from memory-board evidence and stable across route reloads.

Task ownership note: `TASK-04` owns the shared `RouteDataResult`/`StatusNoticeModel` shape, Prisma-injection convention, and reusable derivation helpers consumed by loaders. `TASK-06` through `TASK-11` own completing and testing their route-specific loaders from this contract.

#### §4d-7. Player trait registry

```js
const PLAYER_TRAIT_REGISTRY = {
  [traitId]: {
    label: string | ((evidence) => string),
    thresholds: Array<{ metric: string, operator: ">=" | "<=", value: number }>,
    computeEvidence: (playerArchiveFacts) => Record<string, number | string | null>,
    qualify: (evidence) => boolean,
  },
};

derivePlayerTraits(playerArchiveFacts, registry = PLAYER_TRAIT_REGISTRY) => PlayerTraitLine[]
```

The v1 registry ships four enabled entries:

| traitId | Label | Evidence metrics | Thresholds | Focused fixture/test plan |
|---|---|---:|---:|---|
| `consistent-finisher` | `Consistent finisher` | `averageFinishPercentile` across scored submissions; lower is better. | `<= 0.40` and at least `4` scored submissions. | Player at `0.40` with 4 scored submissions renders; player at `0.41` or with 3 scored submissions does not. |
| `frequent-commenter` | `Frequent commenter` | `commentRate = nonEmptyCommentCount / commentOpportunityCount`, where opportunities are submissions plus votes cast and comments are trimmed before counting. | `>= 0.60` and at least `12` comment opportunities. | Player at `0.60` with 12 opportunities renders; player below rate or below sample does not. |
| `high-variance-voter` | `High-variance voter` | `votePointStdDev` across `Vote.pointsAssigned` values cast by the player; negative points remain in the sample. | `>= 3.0` and at least `24` votes cast. | Player at `3.0` with 24 votes renders; player below variance or below sample does not. |
| `voting-twin` | `Voting twin with <displayName>` | Highest pairwise voting similarity with another player over shared voted songs in the same round contexts. Similarity uses cosine similarity over both players' `pointsAssigned` vectors after vote-to-submission attribution. | `>= 0.70` and at least `10` shared voted songs. | Best matching counterparty at `0.70` with 10 shared votes renders the counterparty name through `subjectPlayer`; below similarity, below overlap, and self-pairs do not render. |

Trait display order is `consistent-finisher`, `frequent-commenter`, `high-variance-voter`, then `voting-twin`. The FSD phrase `voting-twin-with-<name>` is implemented as rendered label copy, not as a registry key, so tests and styling remain stable when player display names change. A route may render all qualifying traits or cap visible traits only if the cap is explicit in component copy/tests; it must never invent fallback copy when no trait qualifies. Do not implement pairwise head-to-head records as a substitute for `voting-twin`.

---

#### §4d-13. Player voting-history aggregation

```js
getPlayerVoteHistory({
  playerId,
  voteGameId?: number | null,
  input,
}) => {
  voteScope: PlayerVoteScopeModel,
  votesGiven: PlayerVoteTable,
  votesReceived: PlayerVoteTable,
}
```

The default scope is archive-wide. Valid per-game scopes are restricted to games where the player has submission or vote evidence, and invalid scopes normalize to archive-wide. Votes-given rows aggregate points this player assigned to each submitter's song; votes-received rows aggregate points assigned by each voter to this player's submissions. Both tables filter self-rows, preserve negative points, expose comment context with game and round links, and use the sort order in §4c-6.

`getPlayerVoteHistory` must use §4d-16 before aggregation. Votes-given rows derive the counterparty from the resolved submission's submitter. Votes-received rows include only votes whose resolved submission submitter is the viewed player. A recurring song in a different round or game must not be treated as the voted-for submission.

---

#### §4d-16. Vote-to-submission attribution

```js
mapVotesToRoundSubmissions({
  submissions: Array<{ id: number; roundId: number; songId: number; playerId: number }>,
  votes: Array<{ id: number; roundId: number; songId: number; voterId: number }>,
}) => {
  votesBySubmissionId: Map<number, Array<Vote>>,
  submissionByVoteId: Map<number, Submission>,
}
```

This helper is the canonical read-side bridge between `Vote` rows and submission evidence for round disclosures and player voting history. A vote resolves from the immutable import-backed key to exactly one submission where `submission.roundId === vote.roundId` and `submission.songId === vote.songId`; after that resolution, route loaders and UI components group by `submissionId`, not by `songId`. The helper never joins by `songId` alone.

M8 must not change the import data schema or canonical `Vote` persistence shape to store `submissionId`. The supported game model treats same-canonical-song/same-round duplicates as a non-case, so implementation should preserve a deterministic guard at this boundary: missing or duplicate same-round matches are data-integrity defects covered by tests, not alternate product states.

---

#### §4d-18. Badge and registry display models

```js
const ARCHIVE_BADGE_VARIANTS = {
  "status-current": { tokenRole: "accent", defaultLabel: "Current" },
  "status-completed": { tokenRole: "primary", defaultLabel: "Completed" },
  "rank-tie": { tokenRole: "accent", defaultLabel: "T<rank>" },
  "rank-plain": { tokenRole: "neutral", defaultLabel: "<rank>" },
  "score": { tokenRole: "neutral", defaultLabel: "<score>" },
  "playlist-link": { tokenRole: "accent", defaultLabel: "Playlist" },
  "familiarity-first-time": { tokenRole: "secondary", defaultLabel: "First-time" },
  "familiarity-returning": { tokenRole: "primary", defaultLabel: "Returning" },
  "search-type-song": { tokenRole: "secondary", defaultLabel: "Song" },
  "search-type-artist": { tokenRole: "secondary", defaultLabel: "Artist" },
  "trait": { tokenRole: "accent", defaultLabel: "<trait label>" },
};

buildArchiveBadgeModel({
  variant,
  label,
  ariaLabel,
}) => { variant: keyof ARCHIVE_BADGE_VARIANTS; label: string; ariaLabel: string | null }
```

Recurring pills and badges use these named variants or route-local aliases that resolve to them. Status badges, tie-rank pills, familiarity pills, search suggestion type chips, playlist pills, and player trait badges must not hardcode route-specific color classes or use visible labels as styling keys. The variant names are stable for tests and styles; labels remain ordinary copy and may vary only when the relevant contract above permits it.

#### §4d-19. Archive visual tokens

```css
:root {
  --brand-purple: <deep purple>;
  --accent-gold: <warm gold>;
  --surface-paper: <off-white>;
  --surface-secondary: <muted lavender-tinted off-white>;
  --ink-primary: <near-black ink>;
  --ink-muted: <desaturated purple-gray>;
  --focus-ring: <accessible focus indicator>;
  --font-display: <serif display stack>;
  --font-body: <system sans-serif stack>;
}
```

These named tokens are the sole palette and typeface source for M8 route surfaces, shell chrome, recurring badges, focus states, and route-local aliases. Route styles may define layout, spacing, and component-specific aliases, but any alias that carries a palette role must resolve to this token set. Alpha warm paper/brick palette values must be removed or remapped through these tokens rather than consumed directly by route components.

---

| ID | Condition | Verification |
|---|---|---|
| AC-01 | `/`, `/games/[id]`, `/games/[id]/rounds/[id]`, `/songs`, `/songs/[songId]`, and `/players/[id]` render as stable, shareable routes with meaningful titles and status-notice degradation for invalid IDs. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-18 | Every leaderboard row, submission submitter, and vote voter links to `/players/[id]`; every submission song links to `/songs/[songId]`. | `test` / `manual` |
| AC-19 | Player detail renders aggregate context, threshold-gated registry traits with stable registry IDs, notable picks, submission history grouped by game, votes-given table, and votes-received table. | `test` / `manual` |
| AC-20 | Player vote tables default to archive-wide scope, expose a per-game secondary scope, filter self-rows, display comments inline with game/round context where applicable, sort by absolute points, and split positive/negative points when negative votes exist. | `test` / `manual` |
| AC-21 | No page introduces album, genre, mood, release-year, audio-feature, recommendation, authentication, live voting, live submission, playlist management, or Spotify enrichment behavior. | `manual` |
| AC-22 | Each primary route satisfies the M8 accessibility checklist: one H1, labeled landmarks, `aria-current`, table captions/headers, focus indicators, skip link, search label/live region, keyboard-operable disclosures, and an arrow-key navigable game switcher with `Enter`/`Space` selection and `Escape` close behavior. | `manual` / `test` |
| AC-23 | An archive containing at least one current game and one completed game is screenshot-coherent across all primary routes at desktop and mobile widths. | `manual` |
| AC-24 | Round vote disclosures and player voting-history tables attribute votes only through same-round song matches; recurring songs in other rounds or games never receive those votes. | `test` |

---

11. **[TASK-11] Build player detail route and trait registry** - Complete `getPlayerDetailData` and implement player aggregates, the OQ-01-resolved trait registry shape, per-game notable picks, grouped submission history, archive-wide and per-game votes-given/votes-received tables, split-on-negatives display, and links from every player reference.
   `contracts: §4a-6, §4c-6, §4d-6, §4d-7, §4d-13, §4d-16, §4d-18, §4d-19` · `preserves: INV-01, INV-06, INV-07, INV-08, INV-10, INV-11, INV-17, INV-18, INV-20` · `validates: AC-01, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24`

---
