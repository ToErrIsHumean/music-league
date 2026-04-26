## 1. Objective

Milestone 8 rebuilds the archive from a single-route, overlay-driven memory board into a multi-route archive companion with stable URLs for games, rounds, songs, and players. Users must be able to see current and completed games immediately, reach any round or submission through fixed lists, search songs and artists from any route, and inspect song/player memory without nested dialogs.

The resulting experience must read as a Music League companion: leaderboards and ties are legible, comments remain first-class social evidence, familiarity signals stay consistent, and the visual system moves from the alpha's warm editorial palette to shared Music League-adjacent purple and gold tokens.

## 2. Prior State

| Artifact | Location | Relevance |
|---|---|---|
| Next root route | `app/page.js` | The only current UI route; renders the archive page from `src/archive/game-archive-page.js` and consumes query params for game/round/song/player state. |
| Root layout metadata | `app/layout.js` | Global HTML shell has no persistent header, no skip link, and only static archive metadata. |
| Alpha archive page | `src/archive/game-archive-page.js` | Renders hero, game switcher, memory board, round dialog, song modal, player modal, and nested modal state from one page. |
| Archive query/derivation utilities | `src/archive/archive-utils.js` | Contains existing Prisma reads, memory board wiring, round detail data, song memory modal data, player modal data, standings helpers, route href builders, and alpha overlay query logic. |
| Song memory utilities | `src/archive/song-memory.js` | Existing song familiarity derivation distinguishes `debut`, `known-artist`, and `brought-back`; M8 requires an archive-wide first-time/returning verdict for F7/F8 while preserving optional artist-footprint context. |
| Player metrics utilities | `src/archive/player-metrics.js` | Existing score/rank-derived player metrics can inform player aggregates and traits, but M8 requires a named trait registry with explicit thresholds before display. |
| API route surface | `app/` | The current app has no archive API routes; live header suggestions require one bounded read-only JSON boundary rather than page-local catalog preloading. |
| Global stylesheet | `app/globals.css` | Contains alpha warm paper/brick palette and route-specific classes; M8 requires shared purple/gold tokens consumed by all routes. |
| Prisma schema | `prisma/schema.prisma` | Confirms no schema changes are required, `Game.finished` exists, `Round.playlistUrl` exists, event dates exist on rounds/submissions/votes, and no album field exists on `Song`. |
| Tests | `src/archive/*.test.js`, `prisma/tests/archive-page.test.js` | Existing coverage targets alpha utilities and archive page behavior; M8 needs new route, derivation, query-param, and accessibility-oriented tests. |

Checkpoint note: final-review 1 corrected the `/songs` browser interaction contract so it preserves the binding live-search behavior from `DESIGN.md §8a` while keeping `q` as canonical shareable URL state. Drift check: corrected-unauthorized-drift.
Drift issue: the saved draft specified `/songs` URL-backed search and prepopulation but omitted the debounced live result update required by the FSD's binding design source.

## 3. Invariants

- **INV-01:** Round, song, and player drill-ins are real routes. No route may reintroduce `?round=`, `?song=`, `?player=`, or `?playerSubmission=` as URL-addressable overlays.
- **INV-02:** No primary surface stacks modal dialogs. Per-submission vote disclosure on the round page is the only permitted in-place disclosure pattern.
- **INV-03:** `Game.finished` is the sole source for current versus completed game status.
- **INV-04:** Displayed game timeframes are derived from imported event timestamps only: `Round.occurredAt`, with `Submission.submittedAt` and `Vote.votedAt` as widening fallbacks. ORM/import bookkeeping timestamps are never displayed as game timeframes.
- **INV-05:** Leaderboard ties remain ties. Tied rows render the same rank with a `T<rank>` pill and never collapse into sole-leader copy.
- **INV-06:** Computed values appearing on multiple surfaces have one derivation path per concept: game timeframe, leaderboard ranks/ties, song familiarity verdict, search normalization, and player traits.
- **INV-07:** Every displayed player trait comes from a named registry entry with an explicit numeric threshold. Ad-hoc trait inference is prohibited.
- **INV-08:** Shared visual tokens own the M8 palette. Route components must not hardcode palette values that belong to the token set.
- **INV-09:** `Round.playlistUrl` is outbound-link-only. The product does not embed Spotify, fetch Spotify metadata, render Spotify artwork, or call Spotify APIs.
- **INV-10:** The archive remains a single-tenant, read-only browsing surface. No live submission, voting, playlist management, authentication, or account state is introduced.
- **INV-11:** Source game semantics remain intact: rounds stay scoped to games; submissions are player-song-in-round evidence; votes are score inputs; comments are social evidence, not scoring primitives.
- **INV-12:** Dynamic route IDs must be ownership-checked before rendering detail content. A round must not render under the wrong game context, and song/player pages must not fabricate game context from stale navigation state.
- **INV-13:** Alpha URL-overlay routing code is removed rather than left dormant. Retired params may be parsed only by no-op compatibility guards or tests proving they do not affect rendered content.
- **INV-14:** User-visible appearance chronology uses imported event timestamps and stable IDs, not ORM/import bookkeeping timestamps. Song first/most-recent appearance, song history ordering, and player/song provenance rows use `Submission.submittedAt`, `Round.occurredAt`, and stable IDs as their chronology inputs unless a section explicitly names another source.
- **INV-15:** Header client interactivity is ephemeral and read-only. Search suggestion open state, switcher open state, back-to-game context, and vote disclosure state must not persist to `localStorage`, cookies, database state, server module globals, or URL params except for canonical `/songs` query/filter/sort navigation.
- **INV-16:** Browser-derived back-to-game context only honors same-origin archive routes generated from the route builders. External referrers, malformed paths, or unsupported local paths produce no chip rather than a best-effort link.
- **INV-17:** Player trait UI never renders placeholder, generic, or unregistered trait copy. Since OQ-01 is resolved for v1, `TASK-11` must implement the enabled registry entries named in §4d-7 rather than a zero-trait scaffold.
- **INV-18:** Vote-to-submission attribution resolves from the immutable import-backed key `Vote.roundId + Vote.songId`, then groups downstream display and aggregation by the resolved `submissionId`. Song-only attribution is prohibited because recurring songs across rounds or games are distinct submission evidence.
- **INV-19:** Game round ordering is canonical and route-stable. Game round lists and round-derived navigation order by populated `Round.sequenceNumber` ascending, then populated `Round.occurredAt` ascending, then stable `Round.id`; ORM/import bookkeeping timestamps must not decide user-visible round order.
- **INV-20:** Registry IDs and badge variants are stable implementation identifiers, not display copy. They use lower-kebab ASCII slugs, never include player names or other mutable labels, and are mapped to user-facing text through §4d-7 or §4d-18.

## 7. Out of Scope

- [ ] Album search - no album field exists in the data model or CSV export; requires Spotify enrichment or a new import source.
- [ ] Spotify enrichment beyond current CSV fields - M8 only surfaces stored playlist URLs as outbound links.
- [ ] Authentication, accounts, and per-user state - the archive remains single-tenant and read-only.
- [ ] Live submission, voting, or playlist management - outside archive product posture.
- [ ] Manual import-review UI - import remains a developer surface.
- [ ] Artist detail route (`/artists/[id]`) - artists are display/search text in M8; artist labels link to `/songs?q=<artist>` only.
- [ ] Player index route (`/players`) - global search and contextual links cover player navigation for M8.
- [ ] localStorage/session persistence for game switcher or back-to-game chip - back-to-game context is in-tab/referrer only and may disappear on reload.
- [ ] Pagination or virtualization beyond named caps - virtualization remains out until the corpus is near 10k songs.
- [ ] Vote-budget, deadline, disqualification, and source-platform-setting inference - preserve imported facts without reconstructing platform configuration.
- [ ] Genre, mood, tempo, audio-feature, recommendation, popularity, or release-year surfaces - no supporting canonical data source exists.
- [ ] Head-to-head W/L/D player surface - explicitly rejected by the design contract; any future affinity signal must be a thresholded trait.
- [ ] Nested dialogs and URL-addressable overlays - replaced by routes and inline vote disclosure.

## 8. Open Questions

- **OQ-01:** Which numeric thresholds, labels, evidence values, and focused fixture/test plan ship for the approved v1 trait IDs `high-variance-voter`, `frequent-commenter`, `consistent-finisher`, and the voting-twin trait? — **Resolution:** `resolved -> §4d-7`; HITL selected generous thresholds for `consistent-finisher` and the voting-twin trait, and conservative thresholds for `frequent-commenter` and `high-variance-voter`. The voting-twin registry ID is `voting-twin`; `<displayName>` appears only in rendered label copy.

Resolved during bootstrap:

- **OQ-R1:** Should artist labels in `/songs` link somewhere in v1? — **Resolution:** `resolved -> §4c-5`; artist labels link to `/songs?q=<artist name>` without introducing an artist route.
- **OQ-R2:** Should F10 live suggestions ship in v1? — **Resolution:** `resolved -> §4a-8, §4c-1, §4d-4, §4d-14, AC-15`; include up to 8 mixed song/artist suggestions because it improves the search-first user story without new dependencies.
- **OQ-R3:** How does header search behave below 720px? — **Resolution:** `resolved -> §4c-1`; collapse behind a text-labeled `Search` trigger, matching `DESIGN.md` responsive guidance and the icon-absent visual system.

---

## Appendix D: Discoveries Log

No implementation discoveries recorded during bootstrap authoring.

---
