# BACKLOG.md
---

## Player Modal Full Content

**Outcome:** Users can open a full Player Modal from round detail and see cross-round submission history, identity summaries, and later milestone social insights without losing archive context.
**Trigger:** Milestone 4 sequencing after the Milestone 3 round-scoped modal shell ships
**Complexity:** Medium
**Dependencies:** Milestone 3 archive route, round detail overlay, and round-scoped player modal shell
**Notes:** Milestone 3 intentionally ships the player modal as a round-scoped shell only; preserve URL-state close/back behavior when expanding it.

---

## Song Modal Full Content

**Outcome:** Users can open a full Song Modal from round detail and see cross-round song history, recurrence context, and later milestone lookup detail without losing archive context.
**Trigger:** Milestone 5 sequencing after the Milestone 3 round-scoped modal shell ships
**Complexity:** Medium
**Dependencies:** Milestone 3 archive route, round detail overlay, and round-scoped song modal shell
**Notes:** Milestone 3 intentionally ships the song modal as a round-scoped shell only; preserve URL-state close/back behavior when expanding it.

---

## Extracted Music Feature Enrichment

**Outcome:** Users can see richer Memory Board moments based on extracted music characteristics such as mood, energy, genre/style clusters, tempo, duration outliers, similarity, diversity, or theme-fit analysis.
**Trigger:** After M6 basic-data Memory Board ships and a future product/spec decision accepts extracted music features as canonical source facts
**Complexity:** High
**Dependencies:** M6 Memory Board, accepted extracted-music-feature data contract, fixture coverage for enriched claims
**Notes:** Do not retrofit v1 moments to imply unavailable music-feature truth; enriched moments should be additive and evidence-backed.

---

## Memory Board Moment Deferral Review

**Outcome:** Deferred v1 Memory Board moment families can be reconsidered with known reasons, expected value, and implementation cost instead of being forgotten.
**Trigger:** After SPEC-006 or M6 implementation records a moment family as deferred for unavailable facts, low sample quality, copy ambiguity, fixture complexity, or implementation complexity
**Complexity:** Low
**Dependencies:** FSD-006/SPEC-006 moment-family disposition notes
**Notes:** Preserve the deferral reason; only promote a moment when it can satisfy source facts, evidence link, omission behavior, and copy guardrails.
**Notes:** SPEC-006 bootstrap defers comment-backed `People Reacted` board moments and direct board comment snippets for risk reduction; Participation Pulse remains the v1 social/participation moment, and later promotion requires provenance, denominator, fixture, and copy-safety contracts.

---

## Vote SubmissionId Canonicalization

**Outcome:** Backend vote storage can reference the resolved canonical submission directly, while preserving Music League import replay semantics and submission-scoped vote display.
**Trigger:** After M8 ships the read-side vote-to-submission resolver and a future backend/data-model milestone explicitly accepts a schema migration.
**Complexity:** High
**Dependencies:** Accepted schema migration plan, canonical backfill from `Vote.roundId + Vote.songId`, replay-safe import commit updates, score recomputation updates, and regression coverage for recurring songs across rounds/games.
**Notes:** Do not change the import CSV/data schema; source vote rows remain resolved from round plus Spotify URI before any canonical `submissionId` is stored.

<!-- SKILL CONTRACT
  Location: First comment block in the file, immediately after the # Title line. Must not appear elsewhere.
  Purpose: Holding pen for Music League work that is real but not yet sequenced. Exists to prevent scope creep and amnesia.
  Entry anchor: ## [Feature Name] (heading is unique within this file)
  Entry fields:
    - Outcome: [What the user can do] — IMMUTABLE after creation
    - Trigger: [Milestone or condition] — IMMUTABLE after creation
    - Complexity: Low | Medium | High — MUTABLE
    - Dependencies: [What must exist first] — MUTABLE
    - Notes: [Load-bearing constraints only] — MUTABLE (append only; do not overwrite existing notes)
  Valid operations:
    - APPEND: Add new entry as a new ## section, above this comment block, preceded by ---
    - UPDATE NOTES: Append a new line to the Notes field when a trigger fires or a constraint is discovered
    - UPDATE COMPLEXITY: Change Complexity value if scope is better understood
    - MARK SHIPPED: Add a line "**Shipped:** YYYY-MM-DD" to the entry — do not remove the entry
    - VOID: Prepend "**VOID:** [reason] — [date]" as the first line of the entry body. Do not remove or alter any other content.
  Resolved condition: Trigger fires and the feature is built. Mark as shipped; entry stays in file.
  Locate entry by: ## heading text (case-insensitive match is acceptable)
-->

---

<!-- Entry format:
## [Feature Name]

**Outcome:** [What the user can do that they can't do now]
**Trigger:** [Milestone or condition that makes this active work]
**Complexity:** Low | Medium | High
**Dependencies:** [What must exist first]
**Notes:** [Load-bearing constraints only — leave blank until trigger fires]
-->
