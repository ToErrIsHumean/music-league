### Reviewer Verdict — TASK-07

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-09 | After commit, every affected round has `Submission.score` and `Submission.rank` values equal to those derived from canonical `Vote` rows, with unvoted submissions left null | `satisfied` | `src/import/recompute-round-results.js:51-127` sums canonical vote points by `(roundId, songId)`, nulls all targeted submissions first, and reapplies dense ranks; `src/import/recompute-round-results.test.js:209-314` verifies scored ties become rank `1`, the next score becomes rank `2`, and an unvoted submission remains `null`; targeted run `node --test src/import/recompute-round-results.test.js` passed. |
| AC-12 | If any canonical write or round-result recompute fails during commit, the batch is not marked `committed` and canonical writes are rolled back | `satisfied` | `src/import/recompute-round-results.js:77-89` throws on an orphan vote; `src/import/recompute-round-results.test.js:316-386` wraps batch-status and submission writes in `prisma.$transaction(...)`, triggers that throw, then verifies the batch stayed `ready` and the submission mutation was rolled back; targeted run `node --test src/import/recompute-round-results.test.js` passed. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-04 | SPEC-002 §3 | `preserved` | `src/import/recompute-round-results.js:51-127` derives `Submission.score` and `Submission.rank` only from canonical `Vote` rows and never reads CSV-provided scoring fields; `src/import/recompute-round-results.test.js:209-314` exercises the derived results end to end. |
| INV-09 | SPEC-002 §3 | `preserved` | `src/import/recompute-round-results.js:77-89` rejects any canonical vote lacking a matching `(roundId, songId)` submission before recomputing, and `src/import/recompute-round-results.test.js:316-386` verifies that failure path. |
| `AGENTS.md` remains the canonical repo guidance | `AGENTS.md` | `preserved` | The diff is limited to `src/import/recompute-round-results.js` and `src/import/recompute-round-results.test.js`; no guidance files were changed (`docs/sdd/last-diff-task-07.md:1-151`). |
| `docs/sdd/` contains the tracked Planner, Implementer, Reviewer, and Orchestrator prompts | `AGENTS.md` | `preserved` | No tracked prompt files were touched; the audited diff only adds import implementation and tests (`docs/sdd/last-diff-task-07.md:1-151`). |
| `scripts/sdd/` contains the tracked wrapper and orchestration scripts | `AGENTS.md` | `preserved` | No `scripts/sdd/` paths appear in the audited diff (`docs/sdd/last-diff-task-07.md:1-151`). |
| Only the Orchestrator writes `PLAN-*.md` files during execution | `AGENTS.md` | `preserved` | No `PLAN-*.md` files were added or modified in the audited diff (`docs/sdd/last-diff-task-07.md:1-151`). |
| Active spec contracts and acceptance criteria are not changed implicitly in code | `AGENTS.md` | `preserved` | The implementation aligns with the slice contract instead of broadening it: it recomputes only targeted rounds, derives results from votes, leaves unvoted submissions null, and throws on orphan votes (`src/import/recompute-round-results.js:41-127`). |
| New dependencies must be explicitly allowed by the active spec or already present in `package.json` | `AGENTS.md` | `preserved` | The diff adds no dependency-manifest changes and imports only existing runtime/test modules plus `@prisma/client` already used by the repo (`docs/sdd/last-diff-task-07.md:1-151`; `src/import/recompute-round-results.js:1`; `src/import/recompute-round-results.test.js:1-14`). |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4d-8 | Recompute scores from canonical `Vote` rows as `SUM(vote.pointsAssigned)` grouped by `(roundId, songId)` | `fulfilled` | `src/import/recompute-round-results.js:93-103` aggregates `pointsAssigned` by `roundId` and `songId`, and `src/import/recompute-round-results.js:123-127` writes those sums back to submissions. |
| §4d-8 | Apply dense ranking by score descending | `fulfilled` | `src/import/recompute-round-results.js:7-33` sorts by score descending and increments rank only when the score changes, producing dense ranks; `src/import/recompute-round-results.test.js:268-295` verifies tied winners share rank `1` and the next score becomes rank `2`. |
| §4d-8 | Leave submissions with no vote rows at `score = null` and `rank = null` | `fulfilled` | `src/import/recompute-round-results.js:109-121` clears all targeted submissions before restoring only voted songs, and `src/import/recompute-round-results.test.js:291-294` verifies the unvoted submission remains null. |
| §4d-8 | Operate only on rounds touched by the committing batch | `fulfilled` | `src/import/recompute-round-results.js:44-49` deduplicates and scopes work to the provided `roundIds`, and `src/import/recompute-round-results.test.js:214-245` plus `src/import/recompute-round-results.test.js:298-310` verify an untouched round retains its prior values. |
| §4d-8 | Throw on a vote that violates INV-09 so commit rollback can occur | `fulfilled` | `src/import/recompute-round-results.js:77-89` throws on any vote without a same-round submission; `src/import/recompute-round-results.test.js:354-383` verifies that exception causes the surrounding transaction to roll back. |

**Verdict:** `confirmed`

All AC, invariant, and contract rows passed for the audited TASK-07 diff.
