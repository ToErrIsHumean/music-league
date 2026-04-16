# SPEC: [Feature/Milestone Short Name]

> **Version:** 0.1.0-draft
> **Milestone:** N — [milestone name]
> **Status:** `draft` | `approved` | `in-progress` | `implemented` | `superseded`
> **Author:** [human | claude-opus session ID/date]
> **Depends-on:** [list spec filenames or "none"]
> **Invalidated-by:** [list specs that, if changed, invalidate this one]

---

## 1. Objective

<!-- 2-4 sentences. Answer: what user-visible or system-visible outcome does this produce, and why now? -->
<!-- Avoid implementation vocabulary. Describe the WHAT and WHY, never the HOW. -->
<!-- Milestone scope enforcement happens HERE — if a capability belongs to a later -->
<!-- milestone, it does not appear in the objective. The Milestone frontmatter field -->
<!-- and §7 (Out of Scope) are the gating mechanism, not a runtime invariant. -->

## 2. Prior State

<!-- Concise snapshot of relevant existing behavior, schemas, and file paths. -->
<!-- Purpose: gives the implementation agent grounding without requiring repo-wide exploration. -->

| Artifact | Location | Relevance |
|---|---|---|
| | | |

## 3. Invariants

<!-- Non-negotiable constraints the implementation MUST preserve. -->
<!-- Prefix with INV-XX. These are referenced by task annotations in §6. -->
<!-- Invariants from CLAUDE.md are constitutional and apply implicitly. -->
<!-- List here ONLY spec-specific invariants or explicit overrides. -->
<!-- Override format: "OVERRIDE INV-XX (from CLAUDE.md): [what changes] — [rationale]" -->
<!-- An override without rationale is invalid — the task agent must escalate (E-03). -->

- **INV-01:** [e.g., "All SQLite schema changes must be backward-compatible with the previous migration."]
- **INV-02:**
- **INV-03:**

## 4. Interface Contracts

<!-- Define every boundary this feature touches: API routes, DB schema changes, -->
<!-- component props, event shapes, internal service signatures. -->
<!-- Use code blocks for schemas/types. -->
<!-- This section is the primary decomposition anchor — a cold-reading agent must be -->
<!-- able to derive atomic tasks from §4 alone, without asking clarifying questions. -->
<!-- -->
<!-- NUMBERING: Label each contract item for precise cross-reference from §6 tasks. -->
<!-- Use subsection-relative numbering: §4a-1, §4a-2, §4b-1, §4d-1, etc. -->
<!-- -->
<!-- PERFORMANCE: If any contract item has superlinear cost characteristics -->
<!-- (O(n²) or worse), annotate it explicitly with the growth profile and the -->
<!-- rationale for accepting it. Unannotated superlinear cost triggers E-09. -->

### 4a. API Surface

<!-- One block per endpoint. Enumerate error conditions explicitly — -->
<!-- an agent that only sees the happy path will only build the happy path. -->
<!-- -->
<!-- VALIDATION: An endpoint with no error cases listed is a spec defect. -->
<!-- Every endpoint has at least one failure mode. If you cannot identify one, -->
<!-- the contract is underspecified — add an OQ to §8. -->

#### §4a-1. [Endpoint name]

```
METHOD /api/v1/path
Request:  { field: type }
Response: { data: { field: type }, error: null }

Errors:
  400: { data: null, error: "validation: [specific condition]" }
  404: { data: null, error: "[entity] not found" }
  409: { data: null, error: "conflict: [specific condition]" }
```

#### §4a-2. [Endpoint name]

```
...
```

### 4b. Data Schema (migrations)

#### §4b-1. [Migration name]

```sql
-- Migration: NNNN_short_name.sql
-- Direction: up
-- Rollback: [describe or reference down migration]
```

### 4c. Component Contracts

#### §4c-1. [Component name]

```ts
// Props interface for new/modified React components
interface ComponentNameProps {
  // ...
}
```

### 4d. Internal Boundaries

<!-- Service function signatures, event emitter contracts, middleware interfaces. -->
<!-- Include ONLY boundaries that tasks in §6 depend on across task boundaries. -->

<!-- VALIDATION: For each task in §6, verify that every function or service it calls -->
<!-- that is DEFINED by a different task is declared here. If missing, add it. -->
<!-- An undeclared cross-task dependency is a decomposition defect. -->

#### §4d-1. [Service/function name]

```js
// Signature, input shape, return shape
```

### 4e. Dependencies

<!-- New npm packages, system-level dependencies, or third-party APIs this spec -->
<!-- introduces. Each must include purpose and rationale for inclusion. -->
<!-- Dependencies not listed here or already in package.json trigger E-04. -->
<!-- If this spec introduces no new dependencies, state "None" explicitly. -->

| Package | Purpose | Rationale |
|---|---|---|
| | | |

## 5. Acceptance Criteria

<!-- Each criterion is independently testable. -->
<!-- The implementation agent uses these as its definition of done per-task. -->
<!-- Every AC must be reachable from at least one task in §6. -->
<!-- An AC not covered by any task is a decomposition gap. -->

| ID | Condition | Verification |
|---|---|---|
| AC-01 | | `test` / `manual` / `type-check` / `lint` |
| AC-02 | | |
| AC-03 | | |

## 6. Task Decomposition Hints

<!-- Suggested atomic work units. The orchestrator or human MAY reorder or split further, -->
<!-- but MUST NOT merge tasks that cross interface boundaries defined in §4. -->
<!-- Each task should be completable in a single agent session. -->
<!-- -->
<!-- REQUIRED ANNOTATIONS PER TASK: -->
<!--   contracts:  — §4 subsections this task implements or depends on. -->
<!--                 This is the agent's precise lookup path into the spec. -->
<!--   preserves:  — invariants (§3 + CLAUDE.md) this task must respect. -->
<!--                 The agent's "do not break" verification anchor. -->
<!--   validates:  — acceptance criteria (§5) this task is responsible for. -->
<!--                 The agent's "must satisfy" completion anchor. -->
<!-- -->
<!-- COVERAGE CHECKS: -->
<!--   - Every AC in §5 must appear in at least one task's validates: annotation. -->
<!--     An uncovered AC is a decomposition gap. -->
<!--   - Every task must validate at least one AC. A task with validates: (none) -->
<!--     is either missing its criteria or should not be a discrete task. -->
<!--
<!-- TASK-00 CONVENTION (conformance on contact):
<!--   If any files listed in §2 (Prior State) do not conform to CLAUDE.md
<!--   conventions (e.g., outdated handler headers, naming violations), include
<!--   a TASK-00 as the first task: "Bring all §2 files into CLAUDE.md conformance."
<!--   TASK-00 has no contracts/preserves/validates annotations — its scope is
<!--   mechanical normalization, not feature work. Omit TASK-00 when all §2 files
<!--   are already conformant. -->

1. **[TASK-01] Short imperative title** — scope sentence.
   `contracts: §4a-1, §4b-1, §4d-1` · `preserves: INV-01, INV-04` · `validates: AC-01, AC-02`
2. **[TASK-02] Short imperative title** — scope sentence.
   `contracts: §4a-2, §4d-1` · `preserves: INV-02` · `validates: AC-03`
3. **[TASK-03] Short imperative title** — scope sentence.
   `contracts: §4c-1` · `preserves: INV-01` · `validates: AC-04, AC-05`

### Dependency Graph

<!-- Adjacency list: one line per task. Format: CHILD: PARENT1,PARENT2 -->
<!-- Root tasks (no predecessors) have an empty RHS. -->
<!-- Every TASK-XX in the list above must appear here exactly once as a LHS entry. -->
<!-- Parse regex: /^(TASK-\d+):\s*((?:TASK-\d+)(?:,TASK-\d+)*)?$/gm -->
<!-- A task appearing only on a RHS and never on a LHS is a coverage defect. -->

```
TASK-01:
TASK-02: TASK-01
TASK-03: TASK-01
TASK-04: TASK-02,TASK-03
```

## 7. Out of Scope

<!-- Explicit exclusions prevent scope creep during implementation. -->
<!-- These are assertions, not suggestions — the task agent treats them as prohibitions. -->
<!-- Milestone-gated work that is adjacent to this spec's domain MUST be listed here. -->

- [ ] [Excluded item] — [reason / milestone gate]

## 8. Open Questions

<!-- Unresolved design decisions identified during spec authoring. -->
<!-- ALL open questions MUST be resolved before status transitions to `approved`. -->
<!-- Resolution means: moved to §3-§6 (incorporated) or §7 (explicitly excluded). -->
<!-- An approved spec with unresolved OQs is invalid. -->

- **OQ-01:** [question] — **Resolution:** `pending` | `resolved → §N` | `excluded → §7`

---

## Appendix D: Discoveries Log

<!-- APPEND-ONLY during implementation. The task agent writes here when encountering -->
<!-- spec gaps, ambiguities, or emergent requirements during execution. -->
<!-- Each entry triggers an escalation assessment per ESCALATION_CRITERIA.md. -->
<!-- -->
<!-- PROPAGATION AUDIT: When a Discovery resolves and the spec is amended, the -->
<!-- amendment is tracked via git diff on this file — not via an in-document field. -->
<!-- During review, verify: for every resolved Discovery with affected sections, -->
<!-- do those sections reflect the resolution? git diff is the source of truth. -->

### D-001 — [ISO-8601 timestamp]

- **Trigger:** [what the agent was doing when the issue surfaced]
- **Nature:** `gap` | `ambiguity` | `contradiction` | `emergent-requirement` | `perf-concern`
- **Affected sections:** [§N, §M]
- **Agent assessment:** [what the agent believes the resolution should be]
- **Escalation required:** `yes` | `no` — per escalation criteria rule [E-XX]
- **Resolution:** [filled post-escalation or post-self-resolution]

---

<!-- END SPEC -->
