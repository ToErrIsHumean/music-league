<!--
Use this template for new forward-looking ABE FSDs.
Primary house-style anchor: docs/specs/FSD-004-goals-schema.md

Authoring rules:
- Keep this document behavioral and outcome-focused.
- Put implementation mechanics, contracts, task decomposition, and file-level
  instructions in the SPEC, not here.
- Delete instructional comments and unused placeholders when filling this in.
- If you insert any optional sections before §3, renumber the later sections.
-->

# FSD — Project ABE [version/milestone] — FSD-[NNN-slug]
## [Short feature or milestone title]

**Status:** Draft | Accepted | Retroactively compiled draft
**Accepted on:** [YYYY-MM-DD or omit until accepted]
**Consuming role:** [Planner -> SPEC-NNN authorship | Architect -> SPEC | Product state maintenance]
**Source basis:** See §4
**Confidence:** High | Medium | Low

---

## 1. Scope and Purpose

### For the PM

[Describe the product/user value, the before/after shift, and the intended
payoff.]

[If the milestone is primarily enabling work, say what deliberately stays
unchanged for the user in this milestone.]

### For the Architect

[Describe the major workstreams, important compatibility or no-regression
constraints, and what "done" means at a behavioral level.]

[Keep this section behavioral. Implementation mechanics, file contracts, and
task decomposition belong in the SPEC.]

---

## 2. Feature Specifications

### F1 — [Feature Name]

**Outcome:** [What the user can do or what the system guarantees after this
feature ships.]

#### F1.1 [Subfeature or rule cluster]

- [Behavioral requirement]
- [Behavioral requirement]

#### F1.2 [Subfeature or rule cluster]

- [Behavioral requirement]
- [Behavioral requirement]

### F2 — [Feature Name]

**Outcome:** [What changes for the user or what guarantee now exists.]

#### F2.1 [Subfeature or rule cluster]

- [Behavioral requirement]
- [Behavioral requirement]

#### F2.2 [Subfeature or rule cluster]

- [Behavioral requirement]
- [Behavioral requirement]

[Repeat F3+ as needed.]

<!--
Feature authoring cues:
- Outcome lines should state a capability or guarantee, not an implementation
  task.
- Bullets should name behavior, constraints, enums, formulas, and invariants
  only when they matter to the product contract.
- If a rename, migration, compatibility promise, or no-regression constraint
  is in scope, say it explicitly.
- If something is intentionally deferred, say so plainly here or in §3.
-->

---

## 3. Explicit Exclusions

- [Clearly out-of-scope behavior]
- [Deferred capability]
- [Known sharp edge accepted for this milestone]
- [Non-goal needed to prevent scope creep]

---

## 4. Provenance

- Planning session / era reconstructed: [date or label]
- Source documents consulted:
  - `[path]` — [how it informed scope, behavior, or exclusions]
  - `[path]` — [how it informed scope, behavior, or exclusions]
- Decision logs or companion notes consulted:
  - `[path]` — [why it mattered]

---

## 5. Uncertainty and Open Questions

- [Unresolved question or ambiguity], including why it is unresolved and what
  downstream doc should decide it.
- [Known risk, schema ambiguity, or boundary that may need a follow-up
  decision.]
- [Migration, compatibility, or naming question, if relevant.]

---

## Optional Sections

Use these only when they materially improve the document. If you move one into
the main body, renumber the later sections.

### Configurable Constants

[Use when product behavior depends on fixed values, formulas, or thresholds.]

### Cross-cutting Standards

[Use when one rule applies across multiple features, such as error
communication or shared interaction patterns.]

### Domain Vocabulary

[Use when terms are overloaded, newly renamed, or easy to misread.]

### Gate Criteria

[Use when the milestone has explicit ship or no-ship criteria beyond normal
feature completion.]
