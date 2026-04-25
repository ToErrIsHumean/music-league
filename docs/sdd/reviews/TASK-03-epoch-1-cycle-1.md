### Reviewer Verdict — TASK-03

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-10 | Every rendered moment exposes a canonical evidence path to a round, player, song, submission fragment, vote-breakdown fragment, or selected-game context appropriate to the claim. | `satisfied` | Competitive, song, and participation moments now receive selected-game-aware evidence hrefs, and the integration test asserts every board moment has a non-empty href. `src/archive/archive-utils.js:976`, `src/archive/archive-utils.js:1033`, `src/archive/archive-utils.js:1078`, `prisma/tests/archive-page.test.js:408` |
| AC-11 | `/?round=<id>` legacy links infer the round's parent game and still open canonical round detail; invalid `?game=` does not block a valid round deep link; `?game=<id>&round=<otherGameRoundId>` does not open cross-game round detail. | `satisfied` | Existing route selection resolves a requested round's parent game when no valid explicit game wins, preserves invalid-game notice behavior, and rejects selected-game/round mismatches; integration coverage asserts the invalid-game and cross-game cases. `src/archive/game-archive-page.js:274`, `src/archive/game-archive-page.js:304`, `prisma/tests/archive-page.test.js:289` |
| AC-12 | Song evidence links open canonical song memory and player evidence links open the existing player modal without creating alternate local board detail surfaces. | `satisfied` | The evidence helper emits canonical selected-game song and player query URLs, the adapter writes those hrefs onto existing round submission payloads, and renderers consume those adapted hrefs rather than creating new local surfaces. `src/archive/archive-utils.js:2568`, `src/archive/archive-utils.js:2651`, `src/archive/game-archive-page.js:768`, `prisma/tests/queries.test.js:2767` |
| AC-16 | Switcher, evidence, nested-modal, and close links preserve selected-game context from cold loads and never return the user to the old all-games directory surface. | `satisfied` | Selected-game route context is applied to open round, song, and player payloads; close/back/render fallbacks now prefer adapted selected-game hrefs; the integration test asserts no `href="/"` leak for the selected-game round path. `src/archive/game-archive-page.js:380`, `src/archive/game-archive-page.js:391`, `src/archive/game-archive-page.js:1181`, `src/archive/game-archive-page.js:1515`, `prisma/tests/archive-page.test.js:437` |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-04 | spec | `preserved` | Switcher links remain game-only selected-game URLs, while nested round/song/player identities are preserved through canonical ids in selected-game-aware hrefs. `src/archive/game-archive-page.js:260`, `src/archive/archive-utils.js:2568` |
| INV-10 | spec | `preserved` | The route adapter only rewrites href/return fields and copies payloads without changing canonical round, submission, song, player, or vote identifiers. `src/archive/archive-utils.js:2637`, `src/archive/archive-utils.js:2685`, `src/archive/archive-utils.js:2729` |
| INV-15 | spec | `preserved` | Round, song, player, submission-fragment, vote-breakdown, close, and nested back links are all cold-loadable selected-game query/fragment URLs. `src/archive/archive-utils.js:2524`, `src/archive/archive-utils.js:2568`, `src/archive/game-archive-page.js:1593` |
| AGENTS canonical guidance | guidance | `preserved` | The diff does not alter `AGENTS.md` or introduce competing repo guidance. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |
| bolder-utils SDD ownership | guidance | `preserved` | The diff does not alter SDD package bins, planner/reviewer/orchestrator wiring, or helper wrappers. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |
| Repo-local prompt override location | guidance | `preserved` | No prompt override files are added outside `docs/sdd/`. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |
| Runtime artifact location | guidance | `preserved` | The reviewed diff artifact remains under `docs/sdd/`, and source changes are limited to archive code and tests. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |
| Orchestrator PLAN ownership | guidance | `preserved` | No `PLAN-*.md` files are changed in the reviewed diff. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |
| Active spec contract/AC changes | guidance | `preserved` | The implementation changes code/tests only and does not modify active spec contracts or acceptance criteria. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |
| Dependency allowance | guidance | `preserved` | No package manifest or dependency file is changed; §4e also allows no new dependencies. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |
| Local config and gates | guidance | `preserved` | The diff does not alter `config/project.local.env` or `config/sdd-gates.json`. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4a-1 | Archive route with selected game, board, and canonical drill-down state | `fulfilled` | The route now applies selected-game context to opened round and nested song/player payloads, while existing route resolution covers legacy round inference, invalid game fallback, and cross-game round rejection. `src/archive/game-archive-page.js:274`, `src/archive/game-archive-page.js:304`, `src/archive/game-archive-page.js:380` |
| §4c-5 | Route-aware overlay and evidence targets | `fulfilled` | Round close hrefs return to `/?game=<selectedGameId>`, nested modal close/back links use adapted selected-game context, and submission/vote-breakdown fragment ids are rendered. `src/archive/archive-utils.js:2637`, `src/archive/archive-utils.js:2685`, `src/archive/archive-utils.js:2729`, `src/archive/game-archive-page.js:768`, `src/archive/game-archive-page.js:952` |
| §4d-9 | Canonical evidence hrefs | `fulfilled` | `buildArchiveHref()` accepts `gameId` and fragments, and `buildMemoryBoardEvidenceHref()` covers game-only, round, song, player, submission, and vote-breakdown destinations while omitting destinations without a valid game id. `src/archive/archive-utils.js:2508`, `src/archive/archive-utils.js:2524`, `src/archive/archive-utils.js:2568` |
| §4d-10 | Selected-game route context adapter | `fulfilled` | `applySelectedGameRouteContext()` provides a local adaptation boundary for round, song, and player payloads, preserving identity while replacing close/back/evidence hrefs and retaining cross-game row navigation with each row's game/round ids. `src/archive/archive-utils.js:2637`, `src/archive/archive-utils.js:2685`, `src/archive/archive-utils.js:2729`, `src/archive/archive-utils.js:2782` |
| §4e | Dependencies | `fulfilled` | The diff adds no npm, system, or third-party dependency changes. `/home/zacha/music-league-worktrees/M6-task-03/docs/sdd/last-diff-task-03.md:1` |

**Verdict:** `confirmed`

All audited ACs, invariants, and contracts passed. Verification run: `node --test prisma/tests/queries.test.js prisma/tests/archive-page.test.js` passed 50/50 tests.
Applied instruction: acceptance criteria already satisfied by existing code; diff may not reflect acceptance criteria. if no diff exists for an AC, use existing codebase to validate these ACs:  AC-11, AC-12
