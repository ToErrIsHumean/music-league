# FSD — Music League Milestone 2 — FSD-002-csv-import-pipeline
## CSV Import Pipeline

**Status:** Draft
**Consuming role:** Planner -> SPEC-002 authorship
**Source basis:** See §4
**Confidence:** High

---

## 1. Scope and Purpose

### For the PM

Milestone 2 turns raw Music League exports into a repeatable product workflow.
After voting closes and submitters are revealed, an admin or operator should be
able to load a fresh game export, validate it quickly, and commit it with
confidence.

The user-visible shift is from "the app only knows seed or manually prepared
data" to "the app can be refreshed from real game exports as part of normal
operations." This milestone is intentionally operational rather than
consumer-facing, but it unlocks every browsing experience that follows by
making post-round updates fast, repeatable, and trustworthy.

### For the Architect

This milestone defines an end-to-end import workflow with four behavioral
workstreams: parse, stage, validate, commit. The pipeline must stage imported
data before it touches canonical records, reject bad or inconsistent input
deterministically, and preserve an audit trail of what was imported, created,
or rejected. Each four-file CSV bundle represents exactly one completed,
post-vote, de-anonymized game snapshot.

Done means an operator can import a supported CSV export, receive an immediate
summary, and either commit a coherent dataset or get a clear failure report.
A clean import should require no human judgment. A bad import should fail fast
with explicit diagnostics rather than trying to recover through manual review
or fuzzy matching.

---

## 2. Feature Specifications

### F1 — Import Session Workflow

**Outcome:** Import is a repeatable operational workflow, not a one-off script.
An operator can start an import, inspect the staged result, and commit only
when deterministic validation succeeds.

#### F1.1 Import entry and session lifecycle

- The system supports starting an import from a CSV-based export package.
- The workflow may be initiated from an admin UI, a CLI, or both; whichever
  entry points ship must behave as the same import product, not as separate
  pipelines with divergent rules.
- Each import creates a distinct import session or batch with its own status,
  timestamps, counts, and failure metadata.
- Canonical data remains unchanged until the operator explicitly commits the
  staged import.
- One supported bundle equals one completed game snapshot; imports do not
  combine unrelated games into a single undifferentiated namespace or import
  pre-reveal player-song associations.

#### F1.2 Workflow stages

- The import proceeds through four product-meaningful stages: parse, stage,
  validate, commit.
- The system should surface stage progress and final state clearly enough that
  an operator can tell whether the import is still in progress, ready to
  commit, or failed.
- A failed or incomplete import remains inspectable as an import session rather
  than disappearing silently.

#### F1.3 Post-round operating model

- The workflow is optimized for the normal cadence of "a round ended, now bring
  in the latest export for that game."
- Re-importing recent data is expected behavior, not an edge case.
- The product should favor low-friction refresh of game state over bespoke
  import configuration.

### F2 — Supported Input and Parsing

**Outcome:** The pipeline accepts the intended Music League export shape and
converts rows into a stable staging representation that later stages can reason
about consistently.

#### F2.1 Supported source shape

- The supported input is the Music League CSV export containing competitor,
  round, submission, and vote data.
- A supported import unit is exactly one set of four CSVs representing one
  completed, post-vote, de-anonymized game snapshot.
- The canonical export fields evidenced in source samples are first-class input:
  competitor identity, round identity and metadata, submission song metadata,
  submitter identity, vote identity, and vote points.
- The pipeline is optimized for one trusted structured export shape, not
  arbitrary spreadsheet layouts assembled by hand.

#### F2.2 Parsed staging model

- After parsing, each staged record has a normalized internal shape that
  distinguishes raw source values from resolved references.
- Submission-stage records must be able to represent at least: song title,
  artist name, song identifier when present, submitter, round, timestamps,
  visibility flag, and free-text comment.
- The visibility flag is preserved as imported source evidence/compatibility
  data. Current product surfaces must not treat it as a privacy gate because
  supported imports are already de-anonymized snapshots.
- Vote-stage records must be able to represent at least: voter, round, song
  identifier, points assigned, vote timestamp, and comment.
- The supported CSV bundle exposes no trusted vote-budget, deadline,
  low-stakes, songs-per-round, or downvote-enabled setting field. Those source
  settings are unknown unless a future import source or trusted local
  configuration explicitly supplies them.
- If a later source adds settings, the accepting SPEC must define whether each
  setting attaches to `Game`, `Round`, or `ImportBatch` before product copy may
  explain outcomes with it.
- Negative vote points are valid imported facts and must not be rejected solely
  because they are negative.
- Parsing errors are captured as explicit import issues; they must not be
  dropped silently.

#### F2.3 Tolerance and strictness

- Minor formatting variance such as casing, whitespace, and common CSV quoting
  differences should not make an otherwise valid export fail.
- Unsupported structure or missing critical fields should produce a clear
  failure, not a best-effort guess that mutates league data.
- Validation must not fabricate failures from absent source settings. Unknown
  vote budgets, deadline behavior, low-stakes behavior, songs-per-round rules,
  or downvote availability remain unknown rather than defaulting to local
  assumptions.
- The product promise is "strict deterministic import for a trusted source,"
  not "accept anything and let a human fix it later."

### F3 — Deterministic Matching and Validation

**Outcome:** Imported rows resolve deterministically to existing canonical
entities or to explicit "new" or "failed" states without human review.

#### F3.1 Matching categories

- Every importable entity resolution ends in one of two successful states:
  matched or new.
- "Matched" means the system has enough deterministic evidence to connect the
  row to an existing canonical entity without human judgment.
- "New" means no existing canonical entity was found and the row can be
  created cleanly.
- Any identity conflict, broken reference, or unresolved dependency is a
  validation failure, not a review state.

#### F3.2 Matching rules by domain object

- Players match by stable source identifier.
- Each bundle derives a deterministic game key from the first valid round row.
- Rounds match by stable source identifier scoped to that derived game key.
- Songs match by stable source song identifier.
- Artists match by normalized artist name.

#### F3.3 Deterministic normalization

- Normalization exists to make obvious formatting differences disappear, not to
  perform fuzzy identity inference.
- Case changes, surrounding whitespace, repeated internal spacing, and routine
  punctuation variation should not create duplicate artists or titles where the
  source contract is otherwise stable.
- Normalization rules must be applied consistently across import and later
  lookup flows so that "same entity" means the same thing everywhere.

#### F3.4 Validation posture

- Validation surfaces only issues that could produce wrong canonical data,
  broken relationships, or duplicate records.
- Expected issue classes include at minimum: missing required identity,
  conflicting deterministic identity, invalid scalar values, duplicate staged
  identities, and broken cross-file references.
- If the system is unsure, it fails the batch. It does not invent an answer and
  it does not ask a human to arbitrate.

### F4 — Commit Semantics and Data Integrity

**Outcome:** Commit writes a coherent dataset with the right relationships and
without duplicate inflation, and it does so only after validation has passed.

#### F4.1 Commit behavior

- Commit creates any required new canonical entities and links all matched rows
  into the main dataset.
- All imported records for a committed session must reference the correct
  player, round, song, and artist entities.
- The commit stage must preserve referential integrity across submissions,
  votes, and derived round outcome data.
- If a newly committed bundle has the same derived game key as an existing
  imported game, the commit overwrites that game's canonical round/submission/
  vote snapshot so the committed data matches the incoming bundle exactly.
- The derived game key maps to one canonical `Game.sourceGameId`. Rounds are
  written under `Round.gameId`; `Round.leagueSlug` remains a compatibility
  mirror of `Game.sourceGameId`, not the canonical product grouping boundary.

#### F4.2 Duplicate prevention and replay safety

- Re-importing the same export or overlapping exports must not create duplicate
  canonical entities when the source rows describe the same player, round,
  artist, song, submission, or vote.
- Re-importing a later full-snapshot bundle for the same derived game key is an
  update, not a parallel import. Stale rounds, submissions, and votes for that
  game should be removed rather than preserved beside the new snapshot.
- Duplicate prevention should favor stable source identifiers where available,
  with deterministic normalized matching only where that is part of the
  canonical model.
- The product guarantee is replay safety for normal operational re-imports, not
  dependence on operators remembering what has already been loaded.

#### F4.3 Derived outcome data

- The committed dataset must support downstream experiences that expect round
  outcomes such as submission score and rank.
- Source vote-level data is authoritative for scoring in this milestone.
- Submission score and rank must be recomputed from canonical committed votes
  rather than trusting imported score/rank fields.

### F5 — Import Summary and History

**Outcome:** Every import leaves behind a concise operational record that makes
recent activity understandable and failures debuggable.

#### F5.1 Import summary

- Before commit, the operator sees a summary of the staged import including row
  counts, matched entities, new entities, and issue counts.
- The summary should highlight what changed and whether the batch is ready or
  failed rather than dumping raw rows.
- Summary data should be understandable at a glance for the common case of a
  post-round refresh of one game snapshot.

#### F5.2 Failure diagnostics

- Failed imports must remain visible with enough context to understand what
  went wrong.
- Diagnostic output should identify the failing stage and preserve row-level
  context for blocking issues where available.
- Failure handling is for inspection and rerun, not inline repair.

#### F5.3 Import history

- The system records import timestamp, import status, total staged row count,
  issue count, failure metadata, and the number or class of entities created.
- Import history is an audit aid and operational memory, even if v1 does not
  yet support rollback.

### F6 — Performance and Operational Expectations

**Outcome:** The workflow feels fast enough to use routinely after each round.

#### F6.1 Responsiveness targets

- Parsing and staging should feel near-immediate for the expected game export
  sizes. The source milestone target is under 2 seconds for parse and under 2
  seconds for commit on normal datasets.
- Summary reads should appear quickly enough that the operator perceives import
  as an interactive workflow rather than a background batch job.

#### F6.2 Failure posture

- Performance shortcuts must not weaken correctness or silently skip
  validation.
- A slow import is acceptable as a failure to optimize; a fast import that
  commits the wrong relationships is not.

---

## 3. Explicit Exclusions

- No manual review queue, issue-resolution workflow, or staged-row editing.
- No fuzzy matching UI or human arbitration of ambiguous identities.
- No AI-assisted cleaning, enrichment, or auto-resolution.
- No scraping or external data collection outside the provided CSV inputs.
- No silent writes directly into canonical data before staging and validation.
- No rollback or destructive undo tooling in this milestone.
- No destructive reconciliation across unrelated games; overwrite behavior is
  scoped only to the game identified by the incoming bundle.
- No generalized ETL builder for arbitrary spreadsheet formats.
- No consumer-facing analytics or browsing UI beyond whatever minimal admin
  surface is required to run imports.

---

## 4. Provenance

- Planning session / era reconstructed: 2026-04-16 milestone-to-FSD conversion
- Source documents consulted:
  - `docs/specs/milestone_2_csv_pipeline.md` — primary source of workflow,
    guiding principles, stages, acceptance criteria, and non-goals
  - `docs/specs/FSD-001-core-data-model.md` — upstream entity and normalization
    assumptions that this import pipeline must populate correctly
  - `docs/specs/milestone_3_round_page.md` — downstream dependency for round,
    submission, score, and rank readiness
  - `docs/specs/milestone_4_player_modal.md` — downstream dependency for player
    identity and submission-history completeness
  - `docs/specs/milestone_6_league_overview.md` — downstream dependency for
    aggregate-ready imported data
- Decision logs or companion notes consulted:
  - `import/gameid_placeholder/competitors.csv` — source identity shape for
    player import expectations
  - `import/gameid_placeholder/rounds.csv` — source round metadata and stable
    round identifier shape
  - `import/gameid_placeholder/submissions.csv` — source submission fields
    including song metadata, timestamps, comment, and voter-visibility flag
  - `import/gameid_placeholder/votes.csv` — source vote-level scoring shape and
    evidence that downstream score/rank should be derived from votes
  - `docs/templates/FSD-template.md` — structural authoring template

---

## 5. Uncertainty and Open Questions

- None at the FSD level. SPEC-002 should remain strict about trusted-source,
  full-bundle imports, deterministic validation, transactional commit, derived
  game identity, and replay-safe same-game overwrites.
