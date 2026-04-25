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
