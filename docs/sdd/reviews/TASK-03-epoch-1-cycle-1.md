### Reviewer Verdict — TASK-03

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-07 | `normalize()` passes all test cases in §4d-1, including idempotency | `satisfied` | `src/lib/normalize.test.js:6-39` covers the required examples, idempotency, preserved characters outside the strip set, and empty-output failure; `node --test src/lib/normalize.test.js` passed with 10/10 tests in `/home/zacha/music-league-worktrees/M1-task-03`. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-02 | spec §3 | `preserved` | `src/lib/normalize.js:2-14` uses only deterministic string transforms and an error throw; no I/O, DB access, or side effects are introduced. |
| `AGENTS.md` is the canonical repo guidance. `CLAUDE.md` may mirror or point to it for tool compatibility. | guidance | `preserved` | Diff scope is limited to `src/lib/normalize.js` and `src/lib/normalize.test.js`; no guidance files are modified. |
| `docs/sdd/` contains the tracked Planner, Implementer, Reviewer, and Orchestrator prompts. | guidance | `preserved` | The reviewed diff adds only the normalization module and its tests; no tracked prompt files under `docs/sdd/` are changed. |
| `scripts/sdd/` contains the tracked wrapper and orchestration scripts. | guidance | `preserved` | No files under `scripts/sdd/` appear in the diff; task scope is confined to `src/lib/`. |
| Only the Orchestrator writes `PLAN-*.md` files during execution. | guidance | `preserved` | No `PLAN-*.md` files are modified by the reviewed diff. |
| Do not change active spec contracts or acceptance criteria implicitly in code. | guidance | `preserved` | `src/lib/normalize.js:1-17` and `src/lib/normalize.test.js:6-39` implement and verify the slice-defined behavior in §4d-1 / AC-07 without redefining it. |
| New dependencies must be explicitly allowed by the active spec or already present in `package.json` when one exists. | guidance | `preserved` | No dependency-manifest changes are present; `src/lib/normalize.test.js:1-2` uses built-in Node modules only. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4d-1 | `normalize(input: string): string` ordered transforms, pure behavior, empty-output error, and CommonJS export | `fulfilled` | `src/lib/normalize.js:1-17` decodes smart quotes, lowercases, strips only `. , ' "`, collapses whitespace, trims, preserves non-ASCII characters, throws the specified error on empty output, and exports `normalize`; `src/lib/normalize.test.js:6-39` exercises the mandated cases. |

**Verdict:** `confirmed`

All audited AC, invariant, and contract rows passed.
