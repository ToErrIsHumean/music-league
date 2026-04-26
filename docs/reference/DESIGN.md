# DESIGN: Archive UX Target

> **Status:** target design for the post-alpha redesign milestone
> **Replaces:** `DESIGN_alpha.md` as the forward-looking baseline
> **Posture:** descriptive of the intended product, not an implementation SPEC
> **Game model precedence:** `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md` for
> entity semantics; this document for surface, route, and visual contracts

---

## 1. Purpose

The redesign exists because the alpha treats the entire archive as one route
with URL-addressable overlays. That metaphor scales poorly: rounds and players
are reachable only through derived memory moments, modal stacking happens in
practice, a 19-game switcher is congested, and a searchable song browser has no
sensible place to live. The target design moves to a small set of real routes,
keeps the memory board as an analytical surface rather than a navigational one,
and adds a global search that addresses the "have we already done this song?"
question that recurs in submission planning.

Three participant profiles drive the design. Each surface should remain legible
to all three.

- **Merit Competitor** — wants a leaderboard above the fold, intelligible round
  results, and player-vs-player legibility.
- **Discovery Curator** — wants a searchable song/artist browser, familiarity
  signals, and room for distinctive picks to be surfaced rather than averaged
  away.
- **Social Ritualist** — wants comments and reactions to feel central, and
  navigation to stay low-friction so the ritual survives busy weeks.

## 2. Product Posture

- The product is a read-only archive. There are no create, edit, vote, or
  import controls in the user UI. Import remains a developer surface.
- Real routes replace overlay-as-navigation. Modals survive only for in-place
  disclosures (e.g. expanding a single submission's vote breakdown).
- Game, round, song, player, and the song browser are first-class routes with
  shareable URLs and natural browser-back behavior.
- A persistent header carries brand, global search, and a compact game
  switcher so users can navigate between games from anywhere.
- The UI emphasizes remembered league events and earned outcomes; it withholds
  result claims when scoring evidence is absent.

## 3. Route Model

| Route | Purpose |
| --- | --- |
| `/` | Landing. Currently-playing games up top, completed games as a card grid. |
| `/games/[id]` | Game shell. Header, leaderboard, round list, memory board, competitive anchor. |
| `/games/[id]/rounds/[id]` | Round page. Submissions list with inline vote disclosure. |
| `/songs` | Searchable song/artist browser. |
| `/songs/[songId]` | Canonical song memory. |
| `/players/[id]` | Player detail page. |
| `/players` | Player index (deferred; not required for v1 if global search covers the navigation need). |

URL parameter conventions:

- Game and round IDs are stable internal IDs, resolved server-side.
- `/songs` accepts `?q=<query>` and may accept filter params (`?familiarity=`,
  `?sort=`).
- A single submission's vote disclosure is local UI state, not URL state.

Invalid route states degrade in place with a status notice and a link back to
the nearest valid context (game, landing, or browser).

## 4. Persistent Chrome

A header is rendered on every route. It contains:

- **Brand wordmark** linking to `/`.
- **Global search** — a single input with live suggestions (see §10).
- **Game switcher** — a compact dropdown showing the current game name (when
  one is in context) with a chevron. Open state shows currently-playing games
  as chips at the top, then a scrollable list of completed games. Clicking a
  game navigates to `/games/[id]`.
- **Back-to-game chip** — when the user navigates from a game-context route
  (`/games/[id]/...`) to `/songs`, `/songs/[songId]`, or `/players/[id]`, the
  header renders a `← Back to <Game Name>` chip alongside the switcher.
  Clicking returns to that game page. The chip is sourced from in-memory tab
  navigation state (or `document.referrer` on first render) — it is not
  persisted across reloads or sessions, so URLs remain the source of truth.
  When no game context applies (cold landing on `/songs`, `/`, etc.) the
  switcher reads "Choose a game" and the chip is absent.
- **Songs link** — an explicit nav entry to `/songs`.

Footer is minimal: project attribution and a link to the underlying repo.
There are no other persistent landmarks; per-page navigation lives on the
page.

## 5. Landing Page (`/`)

The landing page foregrounds the games the user is most likely to be playing
right now and provides a navigable archive of everything before that.

### 5a. Currently Playing

- Renders games where `Game.finished === false`.
- Each currently-playing game renders as a prominent card showing the game
  display name, timeframe (per §5d), round count, scored-round count, and a
  `Current` badge.
- Zero-state copy is explicit: "No games are in progress." This is the most
  common state.

### 5b. Past Games

- Renders games where `Game.finished === true`.
- Layout is a card grid sorted newest-first by timeframe end (per §5d). When
  a card has no derivable timeframe, fall back to import order for sort
  position only — do not synthesize a displayed date.
- Each card shows: display name, timeframe (per §5d), round count, winner
  display name (or tied leaders), and a `Completed` badge.
- The grid renders all completed games up to 100 cards. Beyond 100, a "Show
  more" affordance reveals additional cards in batches of 50. Lightweight
  filters (year, winner-substring) become available once the grid passes 30
  cards.

### 5c. Empty Archive

If no games exist, the page shows an `Archive unavailable` panel explaining
that the archive is empty until a game with round evidence is imported. The
header still renders; search yields no results until songs exist.

### 5d. Game Card Timeframe

The timeframe shown on every game card (this section) and every game header
(§6a) is derived from imported event timestamps, not ORM or import
bookkeeping. ORM `Game.createdAt` / `Game.updatedAt` (and the analogous
columns on child rows) track when this archive touched the data, not when
the game was played, and must not be displayed as a game timeframe.

Derivation:

- **Primary source:** `min(Round.occurredAt)` to `max(Round.occurredAt)`
  across the rounds in the game.
- **Fallback widening:** when the round-only window collapses to a single
  formatted value, or when round dates are sparse, widen the window using
  `min(Submission.submittedAt)` and `max(Vote.votedAt)` so the displayed
  range reflects the actual span of recorded activity.
- **Always render as a range when any temporal spread exists** between the
  earliest and latest event, even short spans (e.g. `Apr 12 – Apr 19`). The
  formatter must not collapse a true range into a single date.
- **No synthetic fallback.** When no usable source event dates exist for the
  game, the card and header omit the timeframe rather than substitute an
  import-derived placeholder. Data quality is high enough that this is not an
  expected case; treating it honestly avoids misleading users when it does
  occur.

## 6. Game Page (`/games/[id]`)

The game page is the primary analytical surface for one league. Its order of
elements is opinionated:

1. **Header**
2. **Leaderboard** (above the fold)
3. **Round list**
4. **Memory board**
5. **Competitive anchor and standings detail**

### 6a. Header

- Game display name as H1.
- Status badge: `Current` or `Completed` per `Game.finished`.
- Timeframe (start–end) per §5d, round count, scored-round count.
- Game description (`Game.description`) when present.
- Optional: league master credit when imported.

### 6b. Leaderboard

The leaderboard is the Merit Competitor's home. It must be present, dense, and
intelligible.

- Columns: rank, player display name, total points, round wins, rounds played.
- Sorted by total points descending. When ties exist on total points, display
  order is settled by: (1) round wins descending, (2) display name
  alphabetical. Average points per round is intentionally not used as a
  tie-break — it advantages players who missed rounds.
- Tied rows share a rank with a `T` prefix on the rank pill (e.g. `T1`, `T1`,
  `3` — standard sports convention). Tied rows receive identical visual
  weight; no row is privileged.
- A small accessible footnote/caption names the tie-break hierarchy whenever
  ties are present in the displayed table.
- Player name links to `/players/[id]`.
- For unfinished games, the leaderboard renders provisional standings with
  explicit `In progress — through round N` labeling. The Merit Competitor
  expects to see the running tally even mid-game.
- For games with no scored rounds, the table is suppressed and replaced by
  copy explaining that scoring evidence is required.

### 6c. Round List

The round list is the structural answer to "rounds are unreliably accessible."
It is always rendered, in canonical order, regardless of memory-board content.

- Order: by `sequenceNumber` when populated, falling back to `occurredAt`,
  then to stable ID.
- Each row shows: round number/sequence, round name (theme), occurred date,
  submission count, scored/unscored indicator, and the round's winning
  submission when scored.
- Each row is a link to `/games/[id]/rounds/[id]`.
- When `Round.playlistUrl` is present, the row also exposes a secondary
  outbound `Playlist ↗` link that opens the Spotify playlist in a new tab
  (`target="_blank" rel="noopener"`). The link is visually subordinate to
  the row's primary navigation — it must not capture the row click. When
  `playlistUrl` is null the affordance is omitted (no disabled state).
- Rows render comfortably at 10–25 rounds per game; no in-row scroll required.

### 6d. Memory Board

The memory board is preserved as an analytical surface but is no longer the
primary navigation. It surfaces derived insights — exact-song recurrence,
same-artist recurrence, notable picks, player tendencies, comment moments.

- Two-column grid on desktop, one column on mobile.
- Each card may link to a round or a song, but the card itself is evidence,
  not navigation chrome.
- If the game lacks evidence to populate the board, a sparse-state card
  renders instead of empty filler.

### 6e. Competitive Anchor and Standings Detail

Below the memory board, an expanded competitive section can include:

- Game leader summary (or pending-evidence copy). Headline copy patterns:
  - 1 leader: `Leader: <name> with <points> points`
  - 2 tied: `Tied leaders: <name> & <name> at <points> points`
  - 3+ tied: `<N>-way tie at <points> points: <name>, <name>, <name>`
- Closest-race callouts (smallest gap between adjacent ranks).
- Biggest swings (largest single-round movement).
- Rounds-won leader when distinct from points leader.

This area is the "below the fold" elaboration of the leaderboard — Merit
Competitor sustenance after the at-a-glance ranking.

## 7. Round Page (`/games/[id]/rounds/[id]`)

The round page replaces the round overlay. Because it is a real page, the
viewport scrolls naturally and the in-element scroll constraint of the alpha
overlay is dropped.

### 7a. Header

- Parent game link (`From <game name>`).
- Round name as H1.
- Round sequence number, occurred date.
- When `Round.playlistUrl` is present, an `Open Spotify playlist ↗` pill
  rendered as a real outbound link (`target="_blank" rel="noopener"`).
  When `playlistUrl` is null the pill is omitted entirely — no disabled
  state, no "no playlist" placeholder.
- Round description when present.
- A back link to the parent game.

Spotify is treated as a target for outbound navigation only. The archive
does not embed a playlist player, fetch playlist metadata, render artwork,
or attempt any Spotify API integration as part of this surface.

### 7b. Round Highlights (optional)

Up to three derived highlight cards (winning submission, biggest comment
moment, notable familiarity signal). Suppressed if no derived highlights
qualify; do not render filler.

### 7c. Submission List

The submission list is the structural answer to "submissions need a fixed
list." All submissions render in rank order.

- Sort: rank ascending, then submitted time, then stable ID.
- Each submission row shows: rank pill, score pill, song title (linking to
  `/songs/[songId]`), artist name, submitter display name (linking to
  `/players/[id]`), familiarity pill when applicable, and submission comment
  when present.
- Missing rank renders as `Unranked`; missing score renders as `Score
  pending`.
- An `Expand all votes` affordance sits at the top of the list. Default state
  is collapsed.

### 7d. Inline Vote Disclosure

Vote evidence is co-located with the submission it explains, not in a
separate section.

- Each submission row has a disclosure control (`Show N votes` / `Hide N
  votes`).
- Expanded state renders the vote rows inline beneath the submission.
- Vote rows show: voter display name (linking to `/players/[id]`), assigned
  points (`+N` for positive, `N` otherwise), optional vote date, optional
  vote comment.
- If no votes are imported for the submission, the disclosure renders as
  `No imported votes` and is non-interactive.
- The `Expand all` control toggles every submission's disclosure together.

This pattern shortens the page substantially and resolves the alpha's
duplicated submission/vote header structure. The Social Ritualist's "scan all
comments" need is met by `Expand all`.

## 8. Song Browser (`/songs`)

The song browser is the Discovery Curator's home and the practical answer to
"have we done this song before?" during submission planning.

### 8a. Search Input

- Single input at the top of the page; mirrors the header search.
- Submits to `/songs?q=<query>` for shareable result URLs.
- Live results appear as the user types after a short debounce.

### 8b. Filters and Sort

- Familiarity: all / first-time only / returning only.
- Sort: most appearances, most recent appearance, best finish, alphabetical.
- Filters are URL params so views are linkable.

### 8c. Result Rows

Each result row shows: song title, artist, appearance count, most recent
appearance (round + game), best finish (rank + score), and a familiarity
pill. Title links to `/songs/[songId]`; artist may link to a future artist
filter view (deferred).

### 8d. Empty and Zero-Result States

- Empty archive: prompt to import games.
- Empty query: render the song catalog sorted by most recent appearance,
  capped at 100 rows. When more than 100 songs exist, a visible hint reads
  `Showing 100 of <N> — refine your search` to steer browsing into search.
- Zero results: explicit copy and a link to clear filters.

## 9. Song Detail (`/songs/[songId]`)

Song memory is preserved largely as in the alpha but lives at its own URL
rather than as a nested overlay.

- Header: song title, artist, familiarity pill, familiarity verdict copy.
- Summary facts: first appearance, most recent appearance, exact-history
  count, artist footprint, best finish.
- Origin submission and origin game labels.
- Submission evidence grouped by game, with each occurrence linking to the
  relevant round.
- Optional recall comment.
- Back navigation goes to the referrer when available, else to `/songs`.

## 10. Global Search

A persistent search input lives in the header on every route. Its scope in
v1:

- **Match domains:** song title and artist name.
- **Album is deferred.** The data model does not currently carry album, and
  the Music League CSV export does not provide it. Adding album search
  requires either a Spotify enrichment pass or a new import source and is out
  of scope for the redesign.
- **Match behavior:** case-insensitive substring match against normalized
  title and normalized artist name.
- **Live suggestions:** a dropdown of up to ~8 results appears beneath the
  input, mixing songs and artists with type chips for disambiguation.
- **Result navigation:** selecting a song result navigates to
  `/songs/[songId]`; selecting an artist result navigates to
  `/songs?q=<artist>`.
- **Submitting** the input (Enter) navigates to `/songs?q=<query>`.

Keyboard: `/` focuses the search input from anywhere a typing context isn't
already active. `Esc` clears suggestions and returns focus to the trigger.

## 11. Player Detail (`/players/[id]`)

Player detail is a real page. Reachable from: every leaderboard row, every
submission row, every vote row, and from any future player index.

### 11a. Header

- Player display name as H1.
- Aggregate context: total submissions across the archive, total votes cast,
  total points received.

### 11b. Trait Line

Optional derived trait copy when evidence supports it. Traits are drawn from
a small named registry defined in the player-page SPEC, with explicit numeric
thresholds per trait (e.g. `high-variance-voter`, `frequent-commenter`,
`consistent-finisher`). Ad-hoc trait inference is not permitted — every
displayed trait corresponds to a registry entry. Traits are suppressed when
evidence is thin.

### 11c. Notable Picks

Best and worst pick cards per game in the archive (deferred: per-game
collapsing if list is long). Each card shows song, artist, round, rank, and
score.

Definitions:

- **Best pick** = the player's submission with the highest score in the
  game. Ties are broken by lower rank number, then by more recent
  `submittedAt`, then by stable ID.
- **Worst pick** = the player's submission with the lowest non-null score in
  the game. Ties are broken by higher rank number, then by older
  `submittedAt`, then by stable ID.
- Submissions with null score are excluded from both best and worst.

### 11d. Submission History

Full submission history grouped by game, newest game first. Each row shows:
song, artist, round, rank, score, optional submission comment. Songs link to
`/songs/[songId]`; rounds link to `/games/[id]/rounds/[id]`.

### 11e. Voting History

New surface beyond the alpha. Shows who this player tends to reward and
penalize, in service of Social Ritualist legibility ("ah, A always upvotes
B").

- **Default scope** is archive-wide (all games this player participated in),
  with a per-game toggle as a secondary view.
- **Votes given table:** per recipient — vote count, points given (display
  rules below), average points per vote.
  - When the data contains no negative votes for this player, points given
    renders as a single net column.
  - When negative votes exist, points given renders split as
    `+<positive> / -<negative> = <net>`. The asymmetry tells a social story
    that pure net hides.
- **Votes received table:** the inverse — per voter, vote count and points
  received, with the same split-on-negatives rule. Rendered as a separate
  table below votes-given, not interleaved.
- Both tables sort by absolute points (given or received) descending. The
  long tail is rendered without truncation; the table is meant to be browsed.
- Self-rows are filtered out (the source platform prevents self-voting; if
  any slip through as a data anomaly, omit them).
- Names link to the corresponding player page.

### 11f. Pairwise Comparisons (Deferred)

A structural head-to-head surface (W/L/D records per opponent) was considered
and rejected. The W/L/D framing reads as combative for what is fundamentally
a friend-group activity, and the Merit Competitor profile is already well
served by the leaderboard, round wins, and competitive anchor.

The mutual-affinity story between any two players is already legible by
cross-reading §11e's votes-given and votes-received tables.

If a comparative signal proves wanted in practice, prefer expressing it as a
trait line entry in the §11b registry (e.g. `voting twin with <name>`,
`frequent rival of <name>`) rather than reintroducing a structural section.
Such traits would surface only when affinity or divergence is statistically
strong, keeping the player page narrative rather than scoreboard-shaped.

## 12. Modal Usage

Modals are no longer a primary navigation pattern. Permitted modal use:

- Per-submission vote disclosure (inline, not a modal in the strict sense —
  a disclosure region within the page).
- Optional song-quick-look from `/songs` results (deferred; only add if
  usability evidence shows the navigation cost is real).

There is no nested modal layering. The alpha's "round → song → player" stack
is dissolved into route navigation.

## 13. Visual Language

The redesign moves the visual identity toward Music League's brand colors,
with enough differentiation to read as a companion archive rather than a
clone. The serif display stack is preserved — it pairs well with the new
palette and provides editorial character.

### 13a. Palette

- **Primary:** deep purple (Music League–adjacent), approximately a `#5C2D91`
  family. Used for headers, primary actions, active nav states.
- **Surface paper:** off-white. Primary content background.
- **Surface secondary:** muted lavender-tinted off-white. Secondary cards and
  rows.
- **Accent:** warm gold, approximately `#D4A537`. Used for rank emphasis,
  winner badges, eyebrow labels, and competitive anchors. Gold is the
  redesign's primary differentiator from official Music League branding.
- **Muted:** desaturated purple-grays for secondary text and de-emphasized
  chrome.
- **Ink:** near-black for primary text on paper.

Exact hex values are an implementation concern. The token names
(`--surface-paper`, `--surface-secondary`, `--ink-primary`, `--accent-gold`,
`--brand-purple`, etc.) should be defined in `app/globals.css` and used
consistently.

### 13b. Typography

- Body: system sans-serif stack (carry over from alpha).
- Display: serif stack (carry over from alpha).
- Eyebrow labels: uppercase, letter-spaced, accent-colored, bold.

### 13c. Components and Surfaces

- Cards keep large rounded corners (18–30px) but with reduced shadow
  intensity to feel less atmospheric and more operational.
- Pills retain their role: rank, score, date, playlist, familiarity, status
  badges.
- Status badges (`Current`, `Completed`) use accent gold and primary purple
  respectively.
- Tables (leaderboard, voting history, head-to-head) use restrained row
  separators rather than card-per-row treatment to keep dense data scannable.
- Icons remain absent. Status, action, and category meaning is communicated
  through text and pill color.

## 14. Responsive Behavior

- At widths below `720px`, the header collapses search behind an icon button
  affordance (text-labeled if icons remain absent — e.g. a `Search` text
  button) and the game switcher remains accessible.
- Multi-column grids collapse to single column.
- Tables (leaderboard, voting history) reflow to stacked rows below `560px`,
  preserving rank, name, and total points as the primary line.
- Round and submission lists wrap their meta pills under the primary line
  rather than truncating.
- Page content respects safe-area insets on mobile.

## 15. Accessibility and Semantics

The redesign retains the alpha's positive patterns and resolves its
limitations.

Required:

- Each route has exactly one H1.
- Header `nav` regions are named.
- Active nav items use `aria-current`.
- Search input is labeled and announces suggestion count via a live region.
- Submission vote disclosures use a labeled `button` with `aria-expanded`
  state, not a styled link.
- Tables use proper `th` scope and caption elements.
- Player and song links carry contextual `aria-label` when display text is
  ambiguous (e.g. when only a rank is the visible link content).
- Status notices use `role="status"`.
- Focus is visibly indicated on all interactive controls.
- Skip-to-content link is present in the header for keyboard users.

Keyboard:

- `/` focuses the global search input from any non-typing context.
- `Esc` closes the search dropdown; `Enter` submits to `/songs?q=`.
- Vote disclosure controls toggle on `Enter` / `Space`.
- The game-switcher dropdown is keyboard-navigable with arrow keys, `Enter`
  to select, `Esc` to close.

The alpha's URL-driven nested-modal accessibility caveats are obsolete: real
routes replace the modal stack.

## 16. Interaction Inventory

Primary flows the redesign must support:

- From `/`, jump into a currently-playing game in one click.
- From any game page, navigate to any of its rounds without going through the
  memory board.
- From any round page, navigate to any submission's song or submitter.
- From any submission row, expand its vote evidence in place.
- From any leaderboard row, navigate to that player's page.
- From any page, search by song title or artist and land on a result.
- From any page with game context, switch to another game via the header
  switcher.
- From `/songs`, filter by familiarity and sort, then share the resulting URL.
- From a player page, see who they tend to reward and who tends to reward
  them (voting given and voting received tables).

## 17. Out of Scope (Redesign)

The following remain out of scope unless a future spec changes them. Listed to
preempt scope drift:

- Live submission, voting, or playlist management.
- Album search (deferred pending data-source decision).
- Spotify enrichment for any field beyond what the CSV export provides.
- Authentication, accounts, per-user state.
- Genre, tempo, audio-feature, or recommendation surfaces.
- Manual import-review UI.
- A separate `/players` index route (may be added later if global search proves
  insufficient).
- An `/artists/[id]` route (may be added later; v1 treats artist as a search
  filter and a display string only).

## 18. Resolved Design Commitments

Items previously held as open questions, now ratified and folded into the
sections above. Listed here as a changelog so SPEC authors can audit the
design's resolved posture without re-litigating the calls.

- **Pagination & scale.** No virtualization in v1. `/songs` empty-query caps
  at 100 with a "refine your search" hint. Past-games grid renders up to
  100, then "Show more" in batches of 50; lightweight filters appear past 30.
  Revisit if the corpus crosses ~10k songs. (Folded into §5b, §8d.)
- **Tie-break treatment.** `T<rank>` shared-rank prefix, sort hierarchy
  total-points → round-wins → name, accessible footnote when ties are
  present, opinionated headline copy for the competitive anchor. (Folded
  into §6b, §6e.)
- **Player-page derivation rules.** Voting history split-on-negatives with
  inverse votes-received table, named registry for trait line, explicit
  tie-breaks for best/worst pick. A structural head-to-head (W/L/D) surface
  was considered and rejected as too combative for a friend-group archive;
  pairwise comparison, if needed, lives as a trait registry entry rather
  than a section. (Folded into §11b, §11c, §11e, §11f.)
- **Game switcher session behavior.** Tab-session sticky context with a
  `← Back to <Game>` chip; no localStorage persistence; URL remains the
  source of truth. (Folded into §4.)

## 19. Provenance

- `docs/reference/DESIGN_alpha.md` — the prior baseline this document
  supersedes.
- `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md` — game-model precedence.
- `docs/pm/research/config/profiles.json` — participant profiles driving
  surface decisions.
- `prisma/schema.prisma` — confirms `Game.finished` exists with default
  `true`, and confirms the absence of an album field on `Song`.

---

<!-- END DESIGN -->
