***

### Reviewer Verdict — TASK-02

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-01 | Round detail renders at most one compact familiarity cue per submission row, using `New to us`, `Known artist`, or `Brought back` from the shared classification model | `satisfied` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:720` orders submissions once and `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:736` adds `song.familiarity` per row; `/home/zacha/music-league-worktrees/M5-task-02/src/archive/game-archive-page.js:352` renders one cue span inside the existing song link; `/home/zacha/music-league-worktrees/M5-task-02/prisma/tests/archive-page.test.js:114` asserts one cue per rendered submission row. |
| AC-02 | Familiarity derivation distinguishes true debut, same-artist/new-song, and prior exact-song history using only canonical `Song.id` and `Artist.id`; exact-song history wins when both apply, and same-round co-occurrence alone does not create prior familiarity | `satisfied` | Applied narrow pre-satisfied-AC instruction. `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:78` filters exact evidence by `songId`, `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:103` excludes opened-song rows from artist-only counts, `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:131` makes exact-song history outrank artist-only history, and `/home/zacha/music-league-worktrees/M5-task-02/prisma/tests/queries.test.js:791` covers same-round same-artist co-occurrence as debut. |
| AC-03 | The same canonical song opened from round detail and from player history receives the same semantic familiarity kind and modal verdict for the same route-visible origin context, including anomalous same-round duplicates that resolve through the deterministic representative origin | `unsatisfied` | The diff hydrates row cues, but the opened song modal still has no familiarity verdict to compare: `/home/zacha/music-league-worktrees/M5-task-02/src/archive/game-archive-page.js:104` resolves `?song=` through `getSongRoundModal`, `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:946` returns only `roundId`, `songId`, title, artist, submitter, score, and rank, and `/home/zacha/music-league-worktrees/M5-task-02/src/archive/game-archive-page.js:419` renders only title, artist, submitter, rank, and score. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-02 | spec | `violated` | Inline cues now use shared familiarity, but the modal path has no verdict to share with them: `/home/zacha/music-league-worktrees/M5-task-02/src/archive/game-archive-page.js:352` renders the row cue while `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:946` returns a song modal payload without `familiarity`. |
| INV-03 | spec | `preserved` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:1` defines the first-ship labels, `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:131` enforces exact-song precedence, and `/home/zacha/music-league-worktrees/M5-task-02/src/archive/game-archive-page.js:352` renders at most one cue span for a row. |
| INV-09 | spec | `preserved` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:688` selects nullable `score`, `rank`, and `comment`, while `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:742` builds familiarity independently of those optional fields; `/home/zacha/music-league-worktrees/M5-task-02/prisma/tests/queries.test.js:764` covers pending rounds. |
| INV-11 | spec | `preserved` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:181` chooses a deterministic representative origin per song using `createdAt` then `id`, and `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:253` passes that origin into shared derivation for duplicate-aware cues. |
| INV-12 | spec | `preserved` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:97` compares prior evidence before the origin-round anchor, and `/home/zacha/music-league-worktrees/M5-task-02/prisma/tests/queries.test.js:791` verifies same-round same-artist co-occurrence remains `debut`. |
| `AGENTS.md` is the canonical repo guidance | guidance | `preserved` | The audited diff does not modify `AGENTS.md` or `CLAUDE.md`. |
| `bolder-utils` provides default SDD role bins | guidance | `preserved` | The audited diff does not modify `package.json` role scripts or dependency declarations. |
| Repo-local prompt overrides live under `docs/sdd/` only when explicitly configured | guidance | `preserved` | No prompt override files or `APP_SDD_PROMPTS_DIR` configuration appear in the audited diff. |
| `docs/sdd/` remains the home for runtime artifacts | guidance | `preserved` | The implementer artifact remains under `docs/sdd/last-diff-task-02.md`; no alternate runtime-artifact location is introduced by the audited diff. |
| Only the Orchestrator writes `PLAN-*.md` files during execution | guidance | `preserved` | No `PLAN-*.md` files appear in the audited diff. |
| Do not change active spec contracts or acceptance criteria implicitly in code | guidance | `preserved` | The audited diff does not modify spec files; failing contract coverage is reported rather than treated as a spec change. |
| New dependencies must be explicitly allowed or already present | guidance | `preserved` | The audited diff does not modify `package.json`, lockfiles, or imports from new packages. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4c-1 | Round submission row with familiarity cue | `fulfilled` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:736` extends round rows with `song.familiarity`; `/home/zacha/music-league-worktrees/M5-task-02/src/archive/game-archive-page.js:316` keeps the row link target as song detail and `/home/zacha/music-league-worktrees/M5-task-02/src/archive/game-archive-page.js:352` renders the cue inside that existing affordance. |
| §4d-1 | `SongFamiliarityVerdict` | `fulfilled` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:1` defines the required vocabulary and `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:171` returns `kind`, `label`, `shortSummary`, exact/prior counts, artist counts, and `throughSubmitters`. |
| §4d-2 | `deriveSongFamiliarity()` | `fulfilled` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:37` implements deterministic archive ordering; `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:78` derives debut, known-artist, and brought-back verdicts from exact-song and same-artist evidence. |
| §4d-4 | Lightweight cue hydration for round detail | `broken` | `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:201` uses one batched evidence query and `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:720` preserves row ordering, but the required cue/modal semantic agreement is not met because the modal payload returned at `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:946` contains no familiarity verdict. |
| §4d-8 | Song-memory implementation locality | `broken` | Shared derivation exists in `/home/zacha/music-league-worktrees/M5-task-02/src/archive/song-memory.js:78` and row rendering consumes it through `/home/zacha/music-league-worktrees/M5-task-02/src/archive/archive-utils.js:255`, but modal rendering still consumes `getSongRoundModal` without shared verdict data at `/home/zacha/music-league-worktrees/M5-task-02/src/archive/game-archive-page.js:393`. |

**Verdict:** `contested`

Failing items: AC-03 is unsatisfied because opened song modal state lacks any semantic familiarity kind or verdict; INV-02 is violated for the same inline-cue/modal mismatch; §4d-4 is broken because round-detail cue hydration does not agree with a modal verdict; §4d-8 is broken because modal rendering still bypasses the shared song-memory verdict.
Applied instruction: acceptance criteria already satisfied by existing code; diff may not reflect acceptance criteria. if no diff exists for an AC, use existing codebase to validate these ACs:  AC-02

***
