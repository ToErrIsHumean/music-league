### Reviewer Verdict — TASK-05

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-04 | `listImportBatchIssues(batchId)` returns every blocking issue with row-level context sufficient for debugging | `satisfied` | `src/import/list-batch-issues.js:11-55` loads all batch issues, reconstructs staged-row previews by file kind, and falls back to decoded `rowPreviewJson`; `src/import/list-batch-issues.test.js:73-132` verifies both staged-row and stored-preview paths for blocking issues. |
| AC-11 | The internal import workflow is adapter-neutral: a bundle-path ingest followed by issue listing, summary, and commit can be exercised entirely through the §4d service contracts | `unsatisfied` | `src/import/list-batch-issues.test.js:73-85` exercises parse, stage, analyze/summary, and issue listing only. The diff adds no `commitImportBatch()` service contract or commit-path test, so the full ingest → issues → summary → commit workflow is not demonstrated from the provided task scope. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-03 | spec | `preserved` | `src/import/list-batch-issues.js:16-55` is read-only over `ImportBatch`/`ImportIssue` and cannot make a batch committable; validation gating remains owned by `analyzeImportBatch()`. |
| INV-07 | spec | `preserved` | `src/import/list-batch-issues.js:25-55,270-295` exposes persisted issue records and durable preview context; `src/import/list-batch-issues.test.js:80-132` confirms failed-batch diagnostics remain inspectable after analysis. |
| `AGENTS.md` remains canonical repo guidance | guidance | `preserved` | Diff scope is limited to `src/import/list-batch-issues.js` and `src/import/list-batch-issues.test.js`; no guidance files were changed. |
| `docs/sdd/` contains tracked Planner, Implementer, Reviewer, and Orchestrator prompts | guidance | `preserved` | Diff scope does not touch `docs/sdd/` prompt files. |
| `scripts/sdd/` contains tracked wrapper and orchestration scripts | guidance | `preserved` | Diff scope does not touch `scripts/sdd/`. |
| Only the Orchestrator writes `PLAN-*.md` files during execution | guidance | `preserved` | Diff scope contains no `PLAN-*.md` changes. |
| Active spec contracts and acceptance criteria are not changed implicitly in code | guidance | `preserved` | No spec files were modified; the task adds an issue-read module and tests only. |
| New dependencies must be spec-allowed or already present in `package.json` | guidance | `preserved` | No `package.json` or lockfile changes appear in the diff; the task uses existing Node/Prisma dependencies. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4d-4 | `listImportBatchIssues(batchId)` | `fulfilled` | `src/import/list-batch-issues.js:11-55` returns the specified issue shape, throws `batch not found`, and supplies `rowPreview` from staged rows or decoded stored JSON; `src/import/list-batch-issues.test.js:85-148` covers both success and missing-batch error paths. |
| §4b-5 | Issue audit | `fulfilled` | `prisma/schema.prisma:262-275` defines issue records by `importBatchId`, `sourceFileKind`, and `sourceRowNumber` with optional `rowPreviewJson`; `src/import/list-batch-issues.js:25-55,270-295` reads those fields without requiring staged-row foreign keys and falls back to canonical stored preview JSON when reconstruction is unavailable. |

**Verdict:** `contested`

- AC-11 is not met: the provided diff demonstrates ingest, analysis summary, and issue listing, but it does not add or exercise the commit service contract required by the acceptance criterion.
