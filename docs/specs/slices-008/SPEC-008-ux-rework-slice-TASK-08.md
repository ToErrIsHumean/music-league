# Slice: TASK-08 — Build the round page and inline vote disclosures

> **Depends-on:** TASK-03, TASK-04
> **Universal:** SPEC-008-ux-rework-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4a-3. Round route

```
GET /games/[gameId]/rounds/[roundId]
Response: round page with parent game context, playlist pill when present, optional highlights, full ranked submissions, inline vote disclosures, and Expand all votes control.

Errors:
  Invalid gameId: render status notice with link to /.
  Invalid roundId: render status notice with link to /games/[gameId] when the game exists, else /.
  Round outside gameId: render status notice with link to the owning game route if resolvable.
```

---

#### §4c-4. Round page and vote disclosure

```ts
interface RoundPageProps {
  round: {
    id: number;
    gameId: number;
    gameDisplayName: string;
    name: string;
    description: string | null;
    sequenceNumber: number | null;
    occurredAtLabel: string | null;
    playlistUrl: string | null;
  };
  highlights: RoundHighlight[];
  submissions: RoundSubmissionRow[];
}

interface RoundSubmissionRow {
  submissionId: number;
  rankLabel: string;
  scoreLabel: string;
  song: { id: number; title: string; artistName: string; href: string };
  submitter: { id: number; displayName: string; href: string };
  familiarity: SongFamiliarityVerdict;
  submissionComment: string | null;
  votes: VoteDisclosureRow[];
}

interface VoteDisclosureRow {
  voteId: number;
  voter: { id: number; displayName: string; href: string };
  pointsAssigned: number;
  votedAtLabel: string | null;
  comment: string | null;
}
```

Each vote disclosure is a `button[aria-expanded]`; rows with no imported votes render non-interactive `No imported votes` text. `Expand all votes` toggles all rows together.

Submissions are ordered by rank ascending, then `submittedAt` ascending, then stable submission ID. Missing rank renders after ranked submissions without suppressing the row.

Round highlights are capped at three, sourced from existing M6-compatible derivations where evidence exists, and suppressed rather than padded when no highlight qualifies.

---

#### §4d-5. Song familiarity verdict

```js
deriveArchiveSongFamiliarity(songId) => {
  kind: "first-time" | "returning";
  label: "First-time" | "Returning";
  appearanceCount: number;
}
```

This verdict is archive-wide and exact-song based: one submission is `first-time`; two or more submissions is `returning`. Same-artist footprint may appear as a separate supporting signal but must not change this verdict.

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

---

#### §4d-12. Round vote disclosure state

```js
useRoundVoteDisclosureState(submissionIds) => {
  isExpanded(submissionId) => boolean,
  toggleSubmission(submissionId) => void,
  toggleAll() => void,
  allExpanded: boolean,
}
```

The default state is collapsed. The state is client-local only and never appears in the URL. Rows with zero imported votes are excluded from `toggleAll` and render the non-interactive copy required by §4c-4.

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
| AC-11 | Game round-list rows link to real round routes and render a secondary outbound `Playlist` link only when `Round.playlistUrl` is present; playlist links use `target="_blank"` and `rel="noopener"`. | `test` / `manual` |
| AC-12 | Round pages render parent game context, optional playlist pill, up to three highlights, and full submissions ordered by rank with comments inline. | `test` / `manual` |
| AC-13 | Round vote evidence is co-located beneath each submission behind initially collapsed `button[aria-expanded]` controls, with per-row Show/Hide labels, non-interactive no-vote rows, and an Expand all votes affordance. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-18 | Every leaderboard row, submission submitter, and vote voter links to `/players/[id]`; every submission song links to `/songs/[songId]`. | `test` / `manual` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-21 | No page introduces album, genre, mood, release-year, audio-feature, recommendation, authentication, live voting, live submission, playlist management, or Spotify enrichment behavior. | `manual` |
| AC-22 | Each primary route satisfies the M8 accessibility checklist: one H1, labeled landmarks, `aria-current`, table captions/headers, focus indicators, skip link, search label/live region, keyboard-operable disclosures, and an arrow-key navigable game switcher with `Enter`/`Space` selection and `Escape` close behavior. | `manual` / `test` |
| AC-23 | An archive containing at least one current game and one completed game is screenshot-coherent across all primary routes at desktop and mobile widths. | `manual` |
| AC-24 | Round vote disclosures and player voting-history tables attribute votes only through same-round song matches; recurring songs in other rounds or games never receive those votes. | `test` |

---

8. **[TASK-08] Build the round page and inline vote disclosures** - Complete `getRoundPageData`, promote round overlay content into the route page, preserve comments, wire submission song/player links, add playlist pill, and replace the separate vote section with per-submission disclosures.
   `contracts: §4a-3, §4c-4, §4d-5, §4d-6, §4d-12, §4d-16, §4d-18, §4d-19` · `preserves: INV-01, INV-02, INV-06, INV-08, INV-09, INV-11, INV-18, INV-20` · `validates: AC-01, AC-11, AC-12, AC-13, AC-18, AC-21, AC-22, AC-23, AC-24`

---
