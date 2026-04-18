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
**Source basis:** See §7
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

## 4. Cross-cutting Invariants

- **INV-[short-id]:** [Non-negotiable rule that must remain true across the
  milestone.]
- **INV-[short-id]:** [Another invariant spanning multiple features or
  workflows.]

<!--
Invariant authoring cues:
- Use this section for milestone-wide rules, not per-feature details.
- Good invariants usually describe what must never happen or what must remain
  legible, bounded, or separated throughout implementation.
- If the milestone does not have meaningful cross-cutting invariants, replace
  with a short note rather than inventing filler.
-->

---

## 5. Gate Criteria

- [Ship/no-ship check that demonstrates a key guarantee of the milestone.]
- [Another pass/fail check that operationalizes one or more invariants.]

<!--
Gate authoring cues:
- Gate criteria are milestone-level pass/fail checks, not implementation tasks.
- They should operationalize the invariants and major feature outcomes into a
  small set of concrete readiness checks.
- If a gate is better expressed as a feature requirement, keep it in §2 instead
  of duplicating it here.
-->

---

## 6. Touched Boundaries

- **[Boundary name]** — [What boundary is in scope and why it matters for this
  milestone.]
  Primary surfaces: `[path]`, `[path]`

- **[Boundary name]** — [Another in-scope boundary.]
  Primary surfaces: `[path]`, `[path]`

<!--
Touched-boundary authoring cues:
- Keep this section concise and high-signal.
- The goal is to tell the architect where to investigate and what not to
  ignore, not to pre-solve the architecture.
- Name the boundary, give a short reason it is in scope, and point to the
  primary repo surfaces.
- Avoid implementation prescriptions, pseudo-task breakdowns, or long prose
  explanations here.
- If a surface is explicitly out of scope but easy to confuse with an in-scope
  boundary, it can be worth naming briefly elsewhere in the FSD.
-->

---

## 7. Provenance

- Planning session / era reconstructed: [date or label]
- Source documents consulted:
  - `[path]` — [how it informed scope, behavior, or exclusions]
  - `[path]` — [how it informed scope, behavior, or exclusions]
- Decision logs or companion notes consulted:
  - `[path]` — [why it mattered]

---

## 8. Uncertainty and Open Questions

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
