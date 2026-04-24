### Reviewer Verdict — TASK-01

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-02 | Familiarity derivation distinguishes true debut, same-artist/new-song, and prior exact-song history using only canonical `Song.id` and `Artist.id`; exact-song history wins when both apply, and same-round co-occurrence alone does not create prior familiarity | `satisfied` | `deriveSongFamiliarity()` returns exactly one of the three kinds, filters exact evidence to the opened song id, excludes opened-song rows from artist-only counts, and prioritizes exact-song history before artist-only history in [song-memory.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.js:78). Focused tests cover debut, known artist, brought back, precedence, artist-only exclusion, and same-round co-occurrence in [song-memory.test.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.test.js:34). `npm test` passed. |
| AC-03 | The same canonical song opened from round detail and from player history receives the same semantic familiarity kind and modal verdict for the same route-visible origin context, including anomalous same-round duplicates that resolve through the deterministic representative origin | `satisfied` | The derivation ignores `originSubmissionId` for familiarity inflation, derives prior evidence from the route-visible `originRoundId`, and chooses a deterministic origin-round anchor from sorted round evidence in [song-memory.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.js:87). The duplicate-origin regression test verifies identical verdicts for round-detail and player-history anchors in [song-memory.test.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.test.js:305). `npm test` passed. |
| AC-11 | M5 ships without global search, fuzzy matching, external metadata enrichment, recommendations, charts, vote-by-vote explainers, or multiple simultaneous familiarity badges | `satisfied` | The diff adds only a shared song-memory helper, unit tests, archive-utils exports, test wiring, and a `.gitignore` entry; no search UI, fuzzy matching, external metadata, recommendation, chart, scoring-explainer, or multi-badge surface is introduced. Evidence: [song-memory.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.js:1), [archive-utils.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/archive-utils.js:1), [package.json](/home/zacha/music-league-worktrees/M5-task-01/package.json:20). |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-02 | spec | `preserved` | The helper computes one mutually exclusive `kind` from exact-song and same-artist evidence and returns that verdict for downstream cue/modal consumers in [song-memory.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.js:131). |
| INV-03 | spec | `preserved` | The label vocabulary is exactly `New to us`, `Known artist`, and `Brought back`; exact-song classification branches before artist-only classification in [song-memory.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.js:1). |
| INV-08 | spec | `preserved` | The diff is confined to deterministic song-memory derivation and tests; it adds no global search, fuzzy matching, instant results, or standalone search UI. |
| INV-10 | spec | `preserved` | Exact-song submissions are kept separate from other same-artist submissions, and artist-only counts exclude the opened canonical `Song.id` in [song-memory.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.js:79). |
| INV-12 | spec | `preserved` | Prior evidence is selected by comparison to the origin-round anchor, preventing same-round co-occurrence from counting as prior familiarity; covered by [song-memory.test.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.test.js:266). |
| AGENTS canonical guidance | guidance | `preserved` | The diff does not alter `AGENTS.md` or add competing guidance. |
| bolder-utils role ownership | guidance | `preserved` | The diff does not replace package-bin role ownership or SDD helper wrappers. |
| Prompt override locality | guidance | `preserved` | No repo-local prompt overrides are added or moved. |
| Runtime artifacts home | guidance | `preserved` | The diff artifact remains under `docs/sdd`; the implementation diff does not relocate runtime artifacts. |
| Orchestrator PLAN ownership | guidance | `preserved` | No `PLAN-*.md` files are modified in the provided diff. |
| Spec contract immutability | guidance | `preserved` | No active spec contracts or acceptance criteria are changed in the provided diff. |
| Dependency constraint | guidance | `preserved` | No new dependency is added; `package.json` only adds the new unit test file to `test:unit` in [package.json](/home/zacha/music-league-worktrees/M5-task-01/package.json:20). |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4d-1 | `SongFamiliarityVerdict` shape and classification | `fulfilled` | The returned verdict includes `kind`, canonical labels, `shortSummary`, exact/prior counts, artist song count, and `throughSubmitters`; classification branches implement brought-back, known-artist, and debut with exact-song precedence in [song-memory.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.js:131). |
| §4d-2 | `deriveSongFamiliarity()` and deterministic history order | `fulfilled` | The exported comparator orders by round occurred-at, round sequence, round id, submission created-at, and submission id with nulls last, and `deriveSongFamiliarity()` applies that order for prior evidence and no-origin fallback counts in [song-memory.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.js:37). Sparse-order and fallback tests cover the required order and no-origin behavior in [song-memory.test.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/song-memory.test.js:345). |
| §4d-8 | Song-memory implementation locality | `fulfilled` | Shared derivation and ordering live in adjacent `src/archive/song-memory.js`, are imported/exported by `archive-utils`, and are consumed by tests; no package is added in [archive-utils.js](/home/zacha/music-league-worktrees/M5-task-01/src/archive/archive-utils.js:1). |

**Verdict:** `confirmed`

All audited acceptance criteria, invariants, and contracts passed without unverifiable rows.
