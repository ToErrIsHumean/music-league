### Reviewer Verdict — TASK-04

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-02 | Missing any required source file or required header yields a blocking `ImportIssue` and the batch fails validation without canonical-table writes | `satisfied` | `analyzeImportBatch()` carries forward blocking parser issues into failed batch state via `parserIssueCount` and `status` updates in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:53-57,121-145`; covered by `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.test.js:242-294`. |
| AC-03 | A clean bundle can be staged and analyzed to `ready` with zero blocking issues and zero canonical-table writes before commit | `satisfied` | Clean-path analysis returns `ready`, clears failure metadata, and only updates staging/audit rows in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:77-145`; covered by `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.test.js:96-240`. |
| AC-05 | Attempting to commit any batch that is not `ready` fails and leaves canonical tables unchanged | `unverifiable` | This diff only adds `analyzeImportBatch()` and its tests; no commit-path code or commit test appears in the provided changes, so the commit guard itself cannot be proven from the diff alone. |
| AC-07 | A batch containing a vote that cannot be attached to a submission in the same round fails validation and cannot commit | `unverifiable` | The diff proves the validation half through unresolved-submission detection in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:660-676` and `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.test.js:296-362`, but it does not exercise or modify the commit path needed to prove the “cannot commit” half. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-03 | spec | `preserved` | Batch status is derived from remaining blocking issues and set to `failed` when any remain, `ready` only when none remain, in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:53-57,121-145`. |
| INV-04 | spec | `preserved` | The implementation only mutates staging/audit records (`ImportIssue`, staged row tables, `ImportBatch`) and never writes canonical `Submission`/`Vote` score or rank fields in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:59-136`; clean-path test also confirms canonical `submission`/`vote` counts stay `0` before commit in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.test.js:154-160,234`. |
| INV-06 | spec | `preserved` | Matching stays deterministic: players by `sourcePlayerId`/normalized-name conflict, rounds by `(gameKey, sourceRoundId)`, songs by `spotifyUri`, artists by normalized name in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:154-205,302-579`. |
| INV-09 | spec | `preserved` | Vote analysis blocks any vote lacking a resolvable submission for the same round/song pair in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:660-676`; covered by `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.test.js:296-362`. |
| Repo constitutional invariants | guidance | `preserved` | The provided diff is limited to `/src/import/analyze-batch.js` and `/src/import/analyze-batch.test.js`; it does not modify `PLAN-*`, specs/prompts/scripts, or dependency manifests, so the AGENTS.md repo-scope and dependency invariants remain intact. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4d-3 | `analyzeImportBatch(batchId)` replaces prior validation-originated issues before writing fresh results | `broken` | The implementation deletes only `unresolved_ref` and `identity_conflict` issues in `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:59-66`, even though §4d-3's validation coverage also includes missing-file/header, parse-failure, and invalid-scalar conditions. Prior validation issues in those other codes are retained instead of being replaced on a fresh validation pass. |
| §4b-5 | Issue audit replaces the prior batch issue set on each validation pass | `broken` | `/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:59-75` performs a partial issue cleanup keyed to two codes rather than replacing the batch's prior validation issue set as required by §4b-5, so stale machine-generated diagnostics can persist across re-analysis. |

**Verdict:** `contested`

- §4d-3 is failing because `analyzeImportBatch()` only clears `unresolved_ref` and `identity_conflict` issues before recreating diagnostics, leaving other validation issue codes stale across validation passes (`/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:59-66`).
- §4b-5 is failing for the same reason: the issue-audit contract requires replacing the prior batch issue set on each validation pass, but the current implementation performs only a two-code subset delete (`/home/zacha/music-league-worktrees/M2-task-04/src/import/analyze-batch.js:59-75`).
