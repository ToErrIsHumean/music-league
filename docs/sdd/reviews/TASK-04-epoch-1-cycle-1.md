### Reviewer Verdict — TASK-04

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-01 | The archive route renders every seeded/imported game as a first-class group, with rounds nested only inside their parent game and ordered deterministically per §4d-1 | `satisfied` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:149-224` loads archive groups from `Game`, sorts games/rounds per §4d-1, and `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:64-120` exercises grouping, ordering, and summary-state fallbacks; verified with `node --test prisma/tests/queries.test.js`. |
| AC-03 | Round detail shows round identity, parent game context, 2-3 quick-scan highlights, and the full submission list ordered per §4d-2 | `satisfied` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:232-460` returns parent game context, deterministic highlights capped at 3, and submission ordering by rank then `createdAt`; `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:123-173` verifies highlight order/count, pending-round fallback copy, and ordered submissions. |
| AC-05 | Missing optional date, winner, score, or rank renders intentional fallback labels and never removes the relevant game, round, or submission from the UI | `satisfied` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:74-96,129-147,419-430,500-560` supplies fallback game labels, preserves pending/winner-null states, and keeps modal/detail rows present with `null` score/rank values; `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:64-173,176-250` covers blank display names, pending rounds, and scoped modal records with missing score/rank. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-01 | spec §3 | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:153-179,244-249` queries through `Game` and `Round.game`, with no archive grouping inferred from `Round.leagueSlug`. |
| INV-03 | spec §3 | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:296-343` returns the full submission list while constraining highlights to `slice(0, 3)`. |
| INV-04 | spec §3 | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:74-96,141-147,419-430,500-560` keeps games, rounds, and submissions visible when optional display metadata is blank or null. |
| INV-05 | spec §3 | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:463-567` resolves song/player modal payloads only for the currently open round; `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:176-250` verifies out-of-round requests return `null`. |
| `AGENTS.md` is the canonical repo guidance. `CLAUDE.md` may mirror or point to it for tool compatibility. | guidance | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/docs/sdd/last-diff-task-04.md:1,396,999` shows the implementer diff is limited to archive/test files and does not modify `AGENTS.md` or `CLAUDE.md`. |
| `docs/sdd/` contains the tracked Planner, Implementer, Reviewer, and Orchestrator prompts. | guidance | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/docs/sdd/last-diff-task-04.md:1,396,999` lists no prompt-file changes under `docs/sdd/`. |
| `scripts/sdd/` contains the tracked wrapper and orchestration scripts. | guidance | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/docs/sdd/last-diff-task-04.md:1,396,999` lists no changes under `scripts/sdd/`. |
| Only the Orchestrator writes `PLAN-*.md` files during execution. | guidance | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/docs/sdd/last-diff-task-04.md:1,396,999` shows no `PLAN-*.md` files in scope. |
| Do not change active spec contracts or acceptance criteria implicitly in code. | guidance | `preserved` | The diff implements the declared TASK-04 utility contracts in `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:149-588` and leaves spec files untouched per `/home/zacha/music-league-worktrees/M3-task-04/docs/sdd/last-diff-task-04.md:1,396,999`. |
| New dependencies must be explicitly allowed by the active spec or already present in `package.json` when one exists. | guidance | `preserved` | `/home/zacha/music-league-worktrees/M3-task-04/docs/sdd/last-diff-task-04.md:1,396,999` shows no `package.json` or lockfile changes and introduces no new dependency declarations. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4d-1 | `listArchiveGames()` | `fulfilled` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:149-224` matches the specified shape, fallback display-label rule, game ordering, round ordering, winner-label rule, and pending/scored status logic; `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:64-120` verifies those behaviors. |
| §4d-2 | `getRoundDetail(roundId)` | `fulfilled` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:232-460` returns `null` for missing rounds, orders submissions by `rank` then `createdAt`, and implements deterministic highlight selection with the required anomaly precedence; `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:123-173` covers both scored and pending rounds. |
| §4d-3 | `getSongRoundModal(roundId, songId)` | `fulfilled` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:463-514` resolves only a submission matching the current `roundId` and `songId` and returns `null` otherwise; `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:176-198` confirms in-round success and out-of-round rejection. |
| §4d-4 | `getPlayerRoundModal(roundId, playerId)` | `fulfilled` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:516-567` resolves only the player's submission within the current round and returns `null` when absent; `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:200-250` verifies the scoped behavior. |
| §4d-5 | `buildArchiveHref(state)` | `fulfilled` | `/home/zacha/music-league-worktrees/M3-task-04/src/archive/archive-utils.js:569-588` emits canonical `/` URLs, drops nested params when `roundId` is nullish, prefers `songId` over `playerId`, and preserves query ordering; `/home/zacha/music-league-worktrees/M3-task-04/prisma/tests/queries.test.js:253-261` exercises the canonicalization rules. |

**Verdict:** `confirmed`

All audited ACs, invariants, and contracts passed.
