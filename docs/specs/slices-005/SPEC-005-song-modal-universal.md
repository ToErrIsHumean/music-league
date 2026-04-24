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
  breakdowns, or scoring explainers inside song detail.
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
