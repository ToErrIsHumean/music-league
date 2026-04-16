### Reviewer Verdict — TASK-02b

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-02 | All 7 entities are insertable via Prisma Client without errors | `satisfied` | `/home/zacha/music-league-worktrees/M1-task-02b/prisma/tests/constraints.test.js:99-145` inserts `Artist`, `Song`, `Round`, `Player`, `ImportBatch`, `Submission`, and `Vote`; `node --test prisma/tests/constraints.test.js` passed (5/5). |
| AC-03 | Inserting a duplicate `(roundId, playerId, songId)` submission throws a unique constraint error | `satisfied` | `/home/zacha/music-league-worktrees/M1-task-02b/prisma/tests/constraints.test.js:147-175` creates a duplicate `Submission` and asserts Prisma `P2002` on `roundId`, `playerId`, `songId`; test run passed. |
| AC-04 | Inserting a duplicate `(roundId, voterId, songId)` vote throws a unique constraint error | `satisfied` | `/home/zacha/music-league-worktrees/M1-task-02b/prisma/tests/constraints.test.js:177-213` creates a duplicate `Vote` and asserts Prisma `P2002` on `roundId`, `voterId`, `songId`; test run passed. |
| AC-05 | Inserting a `Round` with a duplicate `(leagueSlug, sourceRoundId)` where `sourceRoundId` is non-null throws a unique constraint error | `satisfied` | `/home/zacha/music-league-worktrees/M1-task-02b/prisma/tests/constraints.test.js:215-240` inserts duplicate non-null round keys and asserts Prisma `P2002` on `leagueSlug`, `sourceRoundId`; test run passed. |
| AC-06 | Inserting two `Round` rows with the same `leagueSlug` and `sourceRoundId = null` succeeds | `satisfied` | `/home/zacha/music-league-worktrees/M1-task-02b/prisma/tests/constraints.test.js:242-267` inserts two `Round` rows with `sourceRoundId` omitted and asserts both IDs exist with `null` source keys; test run passed. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| `AGENTS.md` remains the canonical repo guidance | guidance | `preserved` | `/home/zacha/music-league-worktrees/M1-task-02b/docs/sdd/last-diff-task-02b.md:1-272` shows the diff only adds `prisma/tests/constraints.test.js`; no guidance files were modified. |
| `docs/sdd/` contains the tracked Planner, Implementer, Reviewer, and Orchestrator prompts | guidance | `preserved` | `/home/zacha/music-league-worktrees/M1-task-02b/docs/sdd/last-diff-task-02b.md:1-272` contains no changes under tracked prompt files; scope is limited to the new Prisma test. |
| `scripts/sdd/` contains the tracked wrapper and orchestration scripts | guidance | `preserved` | `/home/zacha/music-league-worktrees/M1-task-02b/docs/sdd/last-diff-task-02b.md:1-272` contains no changes under `scripts/sdd/`. |
| Only the Orchestrator writes `PLAN-*.md` files during execution | guidance | `preserved` | `/home/zacha/music-league-worktrees/M1-task-02b/docs/sdd/last-diff-task-02b.md:1-272` shows no `PLAN-*.md` changes. |
| Active spec contracts and acceptance criteria are not changed implicitly in code | guidance | `preserved` | The diff adds only executable tests in `/home/zacha/music-league-worktrees/M1-task-02b/prisma/tests/constraints.test.js:1-266`; no spec or plan documents are edited. |
| New dependencies must be explicitly allowed by the active spec or already present in `package.json` | guidance | `preserved` | `/home/zacha/music-league-worktrees/M1-task-02b/docs/sdd/last-diff-task-02b.md:1-272` shows no manifest changes; the test uses existing `@prisma/client` and `prisma` dependencies already present in `/home/zacha/music-league-worktrees/M1-task-02b/package.json`. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4b-1 | Initial Prisma schema | `fulfilled` | The schema defines the relevant composite uniques at `/home/zacha/music-league-worktrees/M1-task-02b/prisma/schema.prisma:57-58`, `/home/zacha/music-league-worktrees/M1-task-02b/prisma/schema.prisma:80`, and `/home/zacha/music-league-worktrees/M1-task-02b/prisma/schema.prisma:103`; the added tests exercise those exact behaviors plus per-model insertability at `/home/zacha/music-league-worktrees/M1-task-02b/prisma/tests/constraints.test.js:99-267`, and `node --test prisma/tests/constraints.test.js` passed. |

**Verdict:** `confirmed`

All audited ACs, repo invariants, and referenced contract rows passed.
