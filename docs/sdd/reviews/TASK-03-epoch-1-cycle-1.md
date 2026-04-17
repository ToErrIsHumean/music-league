***

### Reviewer Verdict — TASK-03

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-01 | Ingesting a valid four-file export bundle creates one `ImportBatch`, four `ImportSourceFile` rows, and staged row counts equal the parsed CSV row counts | `satisfied` | `src/import/stage-batch.js:60-139` creates a parsed batch, four source-file rows, staged rows, and updates `rowCount`; `src/import/stage-batch.test.js:54-210` verifies one batch, four `ImportSourceFile` rows, and staged counts `2/1/2/2`. |
| AC-02 | Missing any required source file or required header yields a blocking `ImportIssue` and the batch fails validation without canonical-table writes | `unverifiable` | `src/import/stage-batch.js:60-139` only stages the batch with `status: "parsed"` and never invokes validation; `src/import/stage-batch.test.js:217-317` proves blocking issues and zero canonical writes, but the validation-failure portion is outside this diff. |
| AC-13 | A readable bundle containing duplicate source-key rows in any source file yields blocking `duplicate_source_row` issues and does not fail staging as a raw database constraint error | `unsatisfied` | `collectDuplicateRows()` scans only `parsedBundle.files[fileKind].rows` at `src/import/stage-batch.js:213-239`, while `parseMusicLeagueBundle()` excludes invalid-scalar rows from those arrays at `src/import/parse-bundle.js:223-237` and `src/import/parse-bundle.test.js:163-240`. An empirical repro on the current worktree with two submission rows sharing the same source key and one invalid scalar persisted only `invalid_scalar`, with no `duplicate_source_row` issue. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-01 | spec §3 | `preserved` | `src/import/stage-batch.js:70-131` writes only `ImportSourceFile`, staged-row, and `ImportIssue` tables plus `ImportBatch` metadata; `src/import/stage-batch.test.js:245-317` confirms canonical `Player`, `Round`, `Submission`, and `Vote` counts remain `0` when staging parser issues. |
| INV-05 | spec §3 | `preserved` | `src/import/stage-batch.js:5,71-77` hard-codes the four required file kinds and registers each one per batch; `src/import/parse-bundle.js:142-149` initializes exactly those four bundle slots, preserving the full-bundle contract. |
| INV-07 | spec §3 | `preserved` | `prisma/schema.prisma:262-275` and `prisma/migrations/20260417090000_import_batch_staging/migration.sql:137-170` add durable `ImportIssue` storage; `src/import/stage-batch.js:41-44,80-87,265-279` persists parser and duplicate issues with `rowPreviewJson`. |
| Repo constitutional invariants | `AGENTS.md` | `preserved` | The diff is limited to `prisma/schema.prisma`, one migration, and `src/import/*`; it does not modify `PLAN-*.md`, spec files, `docs/sdd/`, orchestration scripts, or `package.json`, so the repo-level execution and dependency invariants remain intact. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4d-2 | `stageImportBundle(input)` | `broken` | The contract requires duplicate source keys to be detected “anywhere in the bundle” before staged-row inserts, but `src/import/stage-batch.js:213-239` only inspects typed rows that survived parse. Because `src/import/parse-bundle.js:223-237` drops invalid-scalar rows before staging, duplicate keys involving a rejected row are missed and no `duplicate_source_row` issue is persisted. |
| §4b-1 | ImportBatch evolution | `fulfilled` | `prisma/schema.prisma:118-147` and `prisma/migrations/20260417090000_import_batch_staging/migration.sql:4-45,151` expand `ImportBatch` with the required status, counters, failure metadata, relations, and `gameKey` index. |
| §4b-2 | Source-file registration | `fulfilled` | `prisma/schema.prisma:149-160` defines `ImportSourceFile` with the required uniqueness/indexes, and `src/import/stage-batch.js:71-78` persists one row per required file kind with filename and parsed row count. |
| §4b-3 | Staged identity rows | `fulfilled` | `prisma/schema.prisma:162-200` defines `ImportPlayerRow` and `ImportRoundRow` as specified, and `src/import/stage-batch.js:153-174,89-105` stages normalized player names plus typed round fields with `recordStatus: "pending"`. |
| §4b-4 | Staged transactional rows | `fulfilled` | `prisma/schema.prisma:202-260` defines `ImportSubmissionRow` and `ImportVoteRow` with the required typed/raw fields and indexes, and `src/import/stage-batch.js:175-200,107-123` persists parsed booleans, timestamps, integers, and comments into staging. |
| §4b-5 | Issue audit | `fulfilled` | `prisma/schema.prisma:262-275` adds the required `ImportIssue` fields, and `src/import/stage-batch.js:41-44,80-87,265-287` writes parser-originated issues with `sourceFileKind`, optional `sourceRowNumber`, `recordKind`, and serialized `rowPreviewJson`. |

**Verdict:** `contested`

- AC-13 `unsatisfied`: duplicate detection is limited to typed rows, so readable bundles with duplicate source keys can miss required `duplicate_source_row` issues when one of the duplicate rows is dropped during parse.
- §4d-2 `broken`: the implementation does not satisfy the contract rule to detect duplicate source keys anywhere in the bundle before staged-row inserts.

***
