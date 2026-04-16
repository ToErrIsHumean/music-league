### Reviewer Verdict — TASK-04b

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-08 | Seed script runs without error on a migrated database | `satisfied` | `prisma/tests/seed.test.js:16-31,64-85` migrates a fresh SQLite DB and runs `prisma/seed.js`; verified by local run `node --test prisma/tests/seed.test.js` in `/home/zacha/music-league-worktrees/M1-task-04b` with 4/4 tests passing. |
| AC-09 | Running the seed script twice produces the same record counts (idempotent via upsert) | `satisfied` | Idempotence is asserted in `prisma/tests/seed.test.js:64-85`, and the seed implementation uses `upsert` for `Vote` and `Submission` on composite keys in `prisma/seed.js:491-510,581-608`; verified by the same passing local test run. |
| AC-10 | Post-seed: at least one song has ≥ 2 submission rows across different rounds or players | `satisfied` | `submissionPlan` reuses `spotify:track:seed-song-001` in both `seed-r1` and `seed-r2` at `prisma/seed.js:102-149`, and `prisma/tests/seed.test.js:88-119` asserts a reused song exists; verified by the passing local test run. |
| AC-11 | Post-seed: at least one round has all submissions with non-null `score` and `rank`; at least one round has ≥ 1 submission with null `score` and null `rank` | `satisfied` | Round 1 votes are seeded before score/rank derivation in `prisma/seed.js:491-553,621-626`, while round 2 submissions are seeded with an empty score map in `prisma/seed.js:627`; `prisma/tests/seed.test.js:122-159` confirms both fully scored and unscored rounds; verified by the passing local test run. |
| AC-12 | Post-seed: Vote rows exist for at least one round, with `pointsAssigned` varying across rows and at least one non-null `comment` | `satisfied` | Ballots in `prisma/seed.js:151-232` contain varying `pointsAssigned` values and non-null comments, and are upserted in `prisma/seed.js:491-510`; `prisma/tests/seed.test.js:161-178` verifies these conditions; verified by the passing local test run. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-01 | spec | `preserved` | Non-null `Submission.score`/`rank` are only populated from grouped `Vote` rows in `prisma/seed.js:514-553,589-607`; round 1 submissions require a computed score at `prisma/seed.js:577-579`, and round 2 is explicitly seeded with null-derived values via `new Map()` at `prisma/seed.js:627`. |
| AGENTS canonical guidance retained | guidance | `preserved` | The diff footprint is limited to `prisma/seed.js` and `prisma/tests/seed.test.js` only in `/home/zacha/music-league-worktrees/M1-task-04b/docs/sdd/last-diff-task-04b.md:1-639`; `AGENTS.md` and `CLAUDE.md` are untouched. |
| `docs/sdd/` tracked prompts preserved | guidance | `preserved` | No files under `docs/sdd/` prompts were modified; the only added file in the diff is `prisma/tests/seed.test.js`, with the other change in `prisma/seed.js` (`/home/zacha/music-league-worktrees/M1-task-04b/docs/sdd/last-diff-task-04b.md:1-639`). |
| `scripts/sdd/` tracked wrappers preserved | guidance | `preserved` | The diff contains no changes under `scripts/sdd/`; only `prisma/seed.js` and `prisma/tests/seed.test.js` are present in `/home/zacha/music-league-worktrees/M1-task-04b/docs/sdd/last-diff-task-04b.md:1-639`. |
| Only Orchestrator writes `PLAN-*.md` files during execution | guidance | `preserved` | The diff contains no `PLAN-*.md` additions or edits (`/home/zacha/music-league-worktrees/M1-task-04b/docs/sdd/last-diff-task-04b.md:1-639`). |
| Active spec contracts / ACs not changed implicitly in code | guidance | `preserved` | The implementation follows the seed ordering and derived-score behavior from the task slice without modifying spec artifacts; the diff changes only runtime seed code and tests (`/home/zacha/music-league-worktrees/M1-task-04b/docs/sdd/last-diff-task-04b.md:1-639`). |
| No new dependency introduced outside allowed scope | guidance | `preserved` | No package manifest or dependency-related file is touched in the diff; changes are confined to `prisma/seed.js` and `prisma/tests/seed.test.js` (`/home/zacha/music-league-worktrees/M1-task-04b/docs/sdd/last-diff-task-04b.md:1-639`). |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4b-1 | `Vote` composite upsert key `@@unique([roundId, voterId, songId])` and nullable `sourceImportId` | `fulfilled` | Schema contract is declared at `prisma/schema.prisma:86-107`; the seed uses `where.roundId_voterId_songId` and writes `sourceImportId: null` in `prisma/seed.js:495-510`. |
| §4b-1 | `Submission` composite upsert key `@@unique([roundId, playerId, songId])` with nullable derived `score`/`rank` and nullable `sourceImportId` | `fulfilled` | Schema contract is declared at `prisma/schema.prisma:61-84`; the seed uses `where.roundId_playerId_songId` and writes `score`/`rank` from the computed map or `null`, with `sourceImportId: null`, in `prisma/seed.js:581-608`. |
| §4d-7 | Score for a `(roundId, songId)` is `SUM(pointsAssigned)` from `Vote` | `fulfilled` | `computeRoundScoresAndRanks()` groups `Vote` by `songId` filtered to one `roundId` and derives `score` from `_sum.pointsAssigned` in `prisma/seed.js:514-527`. |
| §4d-7 | Rank is dense by score descending; ties share rank with no gaps | `fulfilled` | The same function sorts by descending score and increments rank only when the score changes in `prisma/seed.js:523-553`, which is the specified dense-ranking algorithm. |
| §4d-7 | Null scores receive null rank | `fulfilled` | Only songs with vote sums enter the score map (`prisma/seed.js:523-528`), and submission upserts default missing entries to `score: null, rank: null` in `prisma/seed.js:589-607`; `main()` passes an empty map for `seed-r2` at `prisma/seed.js:627`. |

**Verdict:** `confirmed`

All AC, invariant, and contract rows passed.
