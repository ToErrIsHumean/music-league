***

### Reviewer Verdict — TASK-03

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-01 | Ingesting a valid four-file export bundle creates one `ImportBatch`, four `ImportSourceFile` rows, and staged row counts equal the parsed CSV row counts | `satisfied` | `src/import/stage-batch.js:96-167` creates the batch, source-file rows, staged rows, and batch counters; `src/import/stage-batch.test.js:54-210` verifies one batch, four `ImportSourceFile` rows, and staged counts `2/1/2/2`. |
| AC-02 | Missing any required source file or required header yields a blocking `ImportIssue` and the batch fails validation without canonical-table writes | `unverifiable` | `src/import/stage-batch.js:76-79,115-122` persists blocking issues, and `src/import/stage-batch.test.js:217-317` proves zero canonical-table writes, but this diff does not include the validation step needed to prove the batch later fails validation. |
| AC-13 | A readable bundle containing duplicate source-key rows in any source file yields blocking `duplicate_source_row` issues and does not fail staging as a raw database constraint error | `satisfied` | `src/import/parse-bundle.js:149-159,228-239` records source-key snapshots for every parsed row before typed-row exclusion, `src/import/stage-batch.js:239-281` detects duplicates from those snapshots before inserts, and `src/import/stage-batch.test.js:418-497` verifies the duplicate issue is persisted even when the earlier row is excluded from typed output. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-01 | spec §3 | `preserved` | `src/import/stage-batch.js:96-167` writes only `ImportBatch`, `ImportSourceFile`, staging-row, and `ImportIssue` records; `src/import/stage-batch.test.js:233-317` confirms canonical `Player`, `Round`, `Submission`, and `Vote` counts remain `0` when staging parser issues. |
| INV-05 | spec §3 | `preserved` | `src/import/parse-bundle.js:149-161` initializes exactly the four required bundle files, and `src/import/stage-batch.js:5,106-112` registers one `ImportSourceFile` row for each required file kind. |
| INV-07 | spec §3 | `preserved` | `prisma/schema.prisma:262-275` and `prisma/migrations/20260417090000_import_batch_staging/migration.sql:137-170` add durable `ImportIssue` storage, and `src/import/stage-batch.js:76-79,115-122,307-320` persists blocking issue diagnostics with `rowPreviewJson`. |
| Repo constitutional invariants | `AGENTS.md` | `preserved` | The diff is confined to `prisma/schema.prisma`, `prisma/migrations/20260417090000_import_batch_staging/migration.sql`, and `src/import/*`; it does not modify `PLAN-*.md`, `docs/sdd/`, `scripts/sdd/`, spec files, or `package.json`. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4d-2 | `stageImportBundle(input)` | `fulfilled` | `src/import/stage-batch.js:74-79` detects duplicate source keys before staged inserts, `src/import/stage-batch.js:96-167` persists the parsed batch, source files, staged rows, and parser/duplicate issues with `gameKey`, `rowCount`, and `issueCount`, `src/import/stage-batch.js:175-180,332-345` marks post-create staging failures as `failed` with `failureStage = "stage"` and `failureSummary`, and `src/import/stage-batch.js:190-235` writes normalized/coerced staging fields. |
| §4b-1 | ImportBatch evolution | `fulfilled` | `prisma/schema.prisma:118-147` and `prisma/migrations/20260417090000_import_batch_staging/migration.sql:4-45,151` add the required `ImportBatch` fields, relations, failure metadata, and `gameKey` index. |
| §4b-2 | Source-file registration | `fulfilled` | `prisma/schema.prisma:149-160` defines `ImportSourceFile` with the required uniqueness and index, and `src/import/stage-batch.js:106-112` persists one row per required file kind with filename and parsed row count. |
| §4b-3 | Staged identity rows | `fulfilled` | `prisma/schema.prisma:162-200` defines `ImportPlayerRow` and `ImportRoundRow` as specified, and `src/import/stage-batch.js:190-209` stages normalized player names plus typed round fields with `recordStatus: "pending"`. |
| §4b-4 | Staged transactional rows | `fulfilled` | `prisma/schema.prisma:202-260` defines `ImportSubmissionRow` and `ImportVoteRow` with the required typed/raw fields and indexes, and `src/import/stage-batch.js:210-235` persists parsed booleans, timestamps, integers, and comments into staging. |
| §4b-5 | Issue audit | `fulfilled` | `prisma/schema.prisma:262-275` defines the required `ImportIssue` fields, and `src/import/stage-batch.js:115-122,307-320` persists parser and duplicate issues with `sourceFileKind`, optional `sourceRowNumber`, `recordKind`, and serialized `rowPreviewJson`. |

**Verdict:** `deferred`

- AC-02 `unverifiable`: this diff proves blocking `ImportIssue` persistence and absence of canonical-table writes for missing files/headers, but it does not include the validation transition needed to show the batch subsequently fails validation.

***
