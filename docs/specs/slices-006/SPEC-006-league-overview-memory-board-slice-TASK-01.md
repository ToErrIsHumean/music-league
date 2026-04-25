# Slice: TASK-01 — Establish selected-game route foundation

> **Depends-on:** (none)
> **Universal:** SPEC-006-league-overview-memory-board-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

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

---

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

---

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

---

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

---

### 4e. Dependencies

No new npm, system, or third-party dependencies are introduced.

| Package | Purpose | Rationale |
|---|---|---|
| None | N/A | Existing Next.js, React, Prisma, and Node test tooling are sufficient. |

---

| ID | Condition | Verification |
|---|---|---|
| AC-01 | Opening `/` with no query resolves exactly one deterministic selected game when at least one selectable game exists. | integration test |
| AC-02 | When multiple selectable games exist, the page renders a visible switcher, the default is deterministic, and `?game=<id>` changes the selected game without blending games. | integration test |
| AC-03 | When only one selectable game exists, the switcher is suppressed and no inert game control is rendered. | integration test |
| AC-04 | When no selectable game exists, `/` renders an explicit unavailable archive state and ignores nested round/song/player params. | integration test |
| AC-05 | Selected-game copy uses "Latest game" only when default selection rests on recency evidence; weak fallback identity uses cautious selected-game copy. | unit or integration test |

---

| ID | Condition | Verification |
|---|---|---|
| AC-11 | `/?round=<id>` legacy links infer the round's parent game and still open canonical round detail; invalid `?game=` does not block a valid round deep link; `?game=<id>&round=<otherGameRoundId>` does not open cross-game round detail. | integration test |

---

1. **[TASK-01] Establish selected-game route foundation** - Replace the root archive resolver substrate with selectable-game listing, deterministic default ordering, `?game=` parsing, legacy `?round=` parent-game inference, selected-game frame/switcher props, no-game unavailable props, and compatibility aliases for the old archive exports.
   `contracts: §4a-1, §4c-1, §4c-2, §4d-1, §4d-2, §4d-11, §4e` · `preserves: INV-01, INV-02, INV-03, INV-04, INV-10, INV-14, INV-15` · `validates: AC-01, AC-02, AC-03, AC-04, AC-05, AC-11`

---
