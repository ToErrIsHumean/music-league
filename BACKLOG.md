# BACKLOG.md
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
