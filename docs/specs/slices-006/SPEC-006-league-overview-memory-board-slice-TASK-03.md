# Slice: TASK-03 — Build route-aware evidence navigation

> **Depends-on:** TASK-01
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

---

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

---

### 4e. Dependencies

No new npm, system, or third-party dependencies are introduced.

| Package | Purpose | Rationale |
|---|---|---|
| None | N/A | Existing Next.js, React, Prisma, and Node test tooling are sufficient. |

---

| ID | Condition | Verification |
|---|---|---|
| AC-10 | Every rendered moment exposes a canonical evidence path to a round, player, song, submission fragment, vote-breakdown fragment, or selected-game context appropriate to the claim. | integration test |
| AC-11 | `/?round=<id>` legacy links infer the round's parent game and still open canonical round detail; invalid `?game=` does not block a valid round deep link; `?game=<id>&round=<otherGameRoundId>` does not open cross-game round detail. | integration test |
| AC-12 | Song evidence links open canonical song memory and player evidence links open the existing player modal without creating alternate local board detail surfaces. | integration test |

---

| ID | Condition | Verification |
|---|---|---|
| AC-16 | Switcher, evidence, nested-modal, and close links preserve selected-game context from cold loads and never return the user to the old all-games directory surface. | integration test |

---

3. **[TASK-03] Build route-aware evidence navigation** - Extend archive href construction, add memory-board evidence hrefs, adapt existing round/song/player payloads to selected-game route context, and add stable submission and vote-breakdown fragment targets.
   `contracts: §4a-1, §4c-5, §4d-9, §4d-10, §4e` · `preserves: INV-04, INV-10, INV-15` · `validates: AC-10, AC-11, AC-12, AC-16`

---
