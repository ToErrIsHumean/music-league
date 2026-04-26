# DESIGN_alpha: Current Archive UX Baseline

> **Status:** baseline capture
> **Scope:** current `app/` archive experience as implemented before a UX redesign milestone
> **Primary surfaces:** `/`, selected-game memory board, round detail overlay, song memory overlay, player detail overlay
> **Source files:** `app/page.js`, `app/layout.js`, `app/error.js`, `app/globals.css`, `src/archive/game-archive-page.js`, `src/archive/archive-utils.js`

---

## 1. Purpose

This document records the current user experience so a future redesign can spec
against an explicit diff. It is descriptive, not aspirational. A redesign SPEC
may preserve, replace, or retire any pattern here, but should name the intended
change rather than relying on tacit disagreement with the alpha UI.

The alpha UX presents Music League as an import-backed archive and memory board,
not as a live game runner, playlist manager, or editing interface.

## 2. Product Posture

- The app has one primary route: the archive home at `/`.
- The first screen is the selected game's memory board.
- The experience is read-only. Navigation changes URL query state; there are no
  create, edit, vote, import, or settings controls in the product UI.
- The UI emphasizes remembered league events: game leaders, notable rounds,
  exact-song recurrence, same-artist recurrence, player histories, comments,
  scores, and ranks.
- The UI avoids result claims when score/rank evidence is absent or incomplete.

## 3. Route and State Model

The current UX is query-state driven:

- `?game=<id>` selects a game.
- `?round=<id>` opens a round detail overlay within the selected game context.
- `?song=<id>` opens a song memory overlay nested inside an open round.
- `?player=<id>` opens a player detail overlay nested inside an open round.
- `?player=<id>&playerSubmission=<id>` opens a player-specific song detail view
  inside the player overlay.

Invalid query state degrades in place:

- An invalid game query shows a status notice and falls back to a resolvable
  selected game when possible.
- A round not found, or not in the selected game, shows a status notice.
- A song detail that cannot be resolved for the open round shows an unavailable
  nested state with a return action.

## 4. Information Architecture

### 4a. Page Frame

- The page uses a centered shell with a maximum content width around `1120px`.
- The top frame is a large hero panel containing:
  - the kicker `Music League`;
  - the selected game display label as the H1;
  - selection copy such as `Latest game` or `Selected game`;
  - a timeframe label when available;
  - a game switcher when more than one selectable game exists.
- If no selectable game exists, the hero and empty state both explain that the
  archive is unavailable until a game with round evidence is imported.

### 4b. Game Switcher

- The game switcher is a horizontal wrapping nav of pill-like rectangular links.
- Each option shows the game display label and timeframe.
- The active game is visually highlighted and marked with `aria-current="page"`.
- The switcher is omitted when there is only one selectable game.

### 4c. Selected-Game Memory Board

- The board is rendered as one large section titled `Selected memory board`.
- It shows the selected game name, round count, and scored round count.
- It does not currently render the full round list as visible navigational
  chrome; the primary board content is a competitive anchor plus memory moments.
- The competitive anchor summarizes the game leader or tied leaders when the
  selected game has complete scoring evidence.
- If game-level scoring evidence is unavailable, the anchor says scores are
  pending or that complete score evidence is required.
- Memory moments are rendered as a two-column grid on desktop and one column on
  mobile.
- Memory moments may link to evidence, usually by opening a round plus a nested
  song detail.

## 5. Round Detail Overlay

- Opening a round renders a full-screen fixed overlay.
- The dark translucent backdrop is an anchor that closes back to the selected
  game URL.
- The round dialog is centered, scrollable, and constrained to roughly `860px`
  wide and `88vh` high.
- The dialog is marked `role="dialog"` and `aria-modal="true"`.
- The header includes:
  - kicker `Round detail`;
  - parent game context, formatted as `From <game>`;
  - round name;
  - date pill;
  - playlist availability pill;
  - optional round description;
  - a `Back to game` close link.
- The body includes:
  - three highlight cards;
  - a full ordered submission list;
  - a vote evidence section grouped by submitted song.

Round highlights currently include existing derived highlights plus fallback
cards for submission count, playlist state, and date. The visible list is capped
at three items.

## 6. Submission Rows

- Submissions are ordered by rank, then creation time, then stable ID.
- Each row shows:
  - song title as the primary link;
  - artist name;
  - optional familiarity pill;
  - submitter as a player-detail link;
  - rank pill;
  - score pill;
  - optional submission comment.
- Missing rank renders as `Unranked`.
- Missing score renders as `Score pending`.
- Song links open canonical song memory in a nested overlay.
- Player links open player detail in a nested overlay.

## 7. Vote Evidence

- Vote evidence appears below the submission list inside round detail.
- The section header shows `Vote evidence` and the imported vote count.
- Each submitted song has a vote breakdown card showing:
  - song title and artist;
  - submitter;
  - rank and score;
  - optional submission comment;
  - ordered vote rows.
- Vote rows show voter name, optional vote date, assigned points, and optional
  vote comment.
- Positive vote points are prefixed with `+`; zero and negative values are shown
  without a positive prefix.
- If no votes are imported for a submission, the row says so explicitly.

## 8. Song Memory Overlay

- Song memory opens as a nested overlay on top of the round dialog.
- The nested backdrop closes back to the round.
- The nested dialog uses `role="dialog"` and `aria-modal="false"` because it is
  visually nested within the modal round context.
- The shell is wider than player detail, approximately `680px`, and internally
  scrollable.
- The header includes:
  - kicker `Song memory`;
  - song title or unavailable title;
  - artist name or requested song ID;
  - `Back to round` close link.
- Available song state includes:
  - familiarity pill;
  - familiarity verdict copy;
  - summary facts grid;
  - optional recall comment;
  - shortcut links for first and most recent appearance when applicable;
  - submission evidence grouped by game.
- Summary facts can include first appearance, most recent appearance, exact
  history count, artist footprint, and best finish.
- Origin submission and origin game are labeled with small pills.
- Unavailable song state keeps the round accessible and gives a `Return to round`
  action.

## 9. Player Detail Overlay

- Player detail opens as a nested overlay on top of the round dialog.
- The shell is approximately `560px` wide and internally scrollable.
- The header includes:
  - kicker `Player detail`;
  - player display name;
  - either game submission count or active song context;
  - `Back to round` close link.
- The default player summary view includes:
  - optional trait line;
  - optional notable picks section;
  - full submission history.
- Notable picks can show best and worst pick cards, each with song, artist,
  round, rank, and score.
- Full history rows show song, artist, round link, rank, score, and optional
  comment.
- Selecting a player-history song can open a player-scoped song detail view
  inside the player overlay. That view has a `Back to <player> summary` action.

## 10. Empty, Error, and Degraded States

- No selectable game:
  - hero title becomes `Archive unavailable`;
  - page body shows `No selectable game is available.`;
  - copy tells the user to import a game with at least one round.
- Global route error:
  - `app/error.js` shows an archive-unavailable panel;
  - the user gets a `Retry` button;
  - copy points to archive data-layer attention if the error persists.
- Sparse selected-game board:
  - the board can show a sparse-state memory card instead of pretending there
    are enough memory moments.
- Partial score/rank evidence:
  - game-level leader claims are withheld;
  - missing submission scores and ranks render as pending/unranked labels.

## 11. Visual Language

- The alpha visual system is warm, editorial, and card-heavy.
- Dominant colors are paper, sand, muted brown, dark ink, and brick red accent.
- The page background uses a radial accent glow plus a vertical paper gradient.
- Primary panels use translucent paper backgrounds, blur, large radius corners,
  and soft shadows.
- Typography pairs a system sans-serif body stack with a serif display stack for
  hero, game, round, and card titles.
- Eyebrow labels are uppercase, letter-spaced, accent-colored, and bold.
- Most interactive surfaces are text links styled as cards, pills, or buttons.
- The UI does not use icons.
- Cards and dialogs use large rounded corners, typically between `18px` and
  `30px`.
- Rank, score, date, playlist, familiarity, and origin labels are represented
  as pills.

## 12. Responsive Behavior

- At widths below `720px`, the shell padding tightens and most grids collapse to
  one column.
- Dialog padding and corner radii are reduced.
- Round headers, submission rows, vote rows, player history rows, and song
  history rows stack vertically.
- Nested song and player shells become full-width within the overlay padding.
- The round dialog and nested dialogs remain viewport-height constrained and
  scroll internally when content exceeds available height.

## 13. Accessibility and Semantics

Current positive patterns:

- The page has a single H1 in the hero.
- Game switcher uses a named `nav`.
- Active game and active round links use `aria-current`.
- Round detail is a modal dialog with an accessible title.
- Nested song and player details are dialogs with accessible titles.
- Backdrops have close labels.
- Submission song and player links include contextual aria labels.
- Status notices use `role="status"`.

Current limitations to consider in redesign:

- Nested dialogs are URL-driven server-rendered overlays, not focus-managed
  client modals.
- Close controls are textual links, not buttons.
- There is no documented keyboard focus restoration behavior.
- Visual affordances rely heavily on text, rounded cards, and color shifts.
- There are no skip links or persistent landmarks beyond `main`, `header`, and
  section structure.

## 14. Interaction Inventory

- Select a game from the game switcher.
- Open a round by following a memory moment or explicit round URL.
- Close round detail by using the backdrop or `Back to game`.
- Open song detail from a submission, memory moment, player pick, player
  history row, or song history evidence link.
- Close song detail by using the nested backdrop or `Back to round`.
- Open player detail from a submission row or song history evidence.
- Close player detail by using the nested backdrop or `Back to round`.
- Move from player summary to player-scoped song detail.
- Return from player-scoped song detail to player summary.
- Jump within song memory evidence using first/most-recent shortcut anchors.

## 15. Alpha Constraints a Redesign Should Address Explicitly

These are not necessarily defects; they are current design facts that a redesign
SPEC should either preserve or intentionally change.

- The app has one route and treats overlays as URL-addressable query states.
- The primary screen is a memory board, not a complete round browser.
- The design is visually atmospheric and spacious rather than dense and
  operational.
- The hierarchy privileges derived memory moments over exhaustive navigation.
- The UI is card-heavy and uses large radii.
- There are no icons, toolbars, tabs, filters, search, or persistent navigation.
- Modal layering can become deep: round detail plus nested song/player detail
  plus player-scoped song view.
- The current implementation has limited client-side interaction machinery, so
  richer modal behavior would require new client components or equivalent
  routing conventions.

## 16. Redesign Diff Guidance

A future redesign milestone should specify deltas in this shape:

- **Preserve:** alpha behaviors that remain authoritative.
- **Replace:** alpha patterns that should be superseded by new UX contracts.
- **Remove:** alpha elements that should disappear.
- **Add:** new surfaces, controls, routes, states, or accessibility behaviors.
- **Acceptance:** concrete visual, semantic, and interaction criteria that prove
  the diff landed.

The redesign should continue to respect the Music League game model: games own
rounds, submissions are round-specific events, votes are scoring evidence, and
song/player memory claims must be backed by imported or derived data.

---

<!-- END DESIGN_alpha -->
