### Reviewer Verdict — TASK-04

**AC Audit** (`validates:` from §6)

| AC | Criterion (§5 text) | Status | Evidence |
|----|---------------------|--------|----------|
| AC-06 | The competitive anchor renders a sole leader or tied leaders from selected-game scored submissions with score context, and never conflates participation or recurrence with winning. | `satisfied` | `src/archive/archive-utils.js:943` builds anchors from `deriveGameStandings()`, emits `leader` / `tied-leaders` only after complete standings, and suppresses unavailable anchors from ordinary `the-table` moments at `src/archive/archive-utils.js:1049`; targeted tests passed with `node --test prisma/tests/archive-page.test.js prisma/tests/queries.test.js`. |
| AC-07 | Missing or partial score/rank evidence suppresses or cavesats outcome-dependent claims while preserving unrelated eligible memory moments. | `unsatisfied` | `deriveGameStandings()` classifies an all-unscored submitted round as `none` when `scoredSubmissionCount === 0 && !hasPartialScoreRankPair` at `src/archive/archive-utils.js:683`, despite §4d-5 requiring a whole submitted round with all scores/ranks missing to count as `partial`. That path returns no unavailable anchor at `src/archive/archive-utils.js:946` and no sparse score caveat at `src/archive/archive-utils.js:1429`, so missing outcome evidence is omitted rather than caveated while song/participation moments can still render at `src/archive/archive-utils.js:1461`. The added test codifies the misclassification at `prisma/tests/queries.test.js:1567`. |
| AC-09 | Sparse-data fixtures omit unsupported moment families and render a coherent smaller selected-game recap with safe copy. | `unsatisfied` | A selected game with submitted songs but no scored submissions is sparse data under §4d-5, but the new completeness logic reports `none` instead of `partial` at `src/archive/archive-utils.js:683`; `buildSelectedGameSparseState()` only explains `competitiveAnchor?.kind === "unavailable"` or no submissions at `src/archive/archive-utils.js:1414`, leaving the submitted-but-unscored recap without the required explicit sparse score state. |
| AC-10 | Every rendered moment exposes a canonical evidence path to a round, player, song, submission fragment, vote-breakdown fragment, or selected-game context appropriate to the claim. | `satisfied` | Moment construction now emits `evidence` with `requiresGameContext`, `href`, and `target` metadata at `src/archive/archive-utils.js:1010`; competitive, swing, song, and participation moments provide canonical game/round/song/vote-breakdown targets at `src/archive/archive-utils.js:1067`, `src/archive/archive-utils.js:1213`, `src/archive/archive-utils.js:1267`, and `src/archive/archive-utils.js:1348`. Integration assertions cover rendered board evidence metadata at `prisma/tests/archive-page.test.js:437`. |
| AC-13 | The board renders no v1 claims based on genre, mood, audio features, popularity, recommendations, personalization, inferred taste, unsupported humor, source deadline behavior, or vote-budget behavior. | `satisfied` | New copy is limited to score/rank completeness, round-scoped score margins, exact-song/exported-artist archive history, and participation counts at `src/archive/archive-utils.js:953`, `src/archive/archive-utils.js:1202`, `src/archive/archive-utils.js:1271`, `src/archive/archive-utils.js:1297`, `src/archive/archive-utils.js:1322`, and `src/archive/archive-utils.js:1351`; no prohibited source classes appear in the diff. |

**Invariant Audit** (`preserves:` + repo constitutional)

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| INV-01 | spec | `preserved` | `buildSelectedGameBoard()` returns one `selectedGameId` and builds board facts from selected rounds/submissions passed to that resolver at `src/archive/archive-utils.js:1441`; selected-game scoping is asserted at `prisma/tests/queries.test.js:1663`. |
| INV-05 | spec | `preserved` | New competitive, swing, song, and participation moments include source fact arrays, denominators, and evidence metadata at `src/archive/archive-utils.js:1074`, `src/archive/archive-utils.js:1214`, `src/archive/archive-utils.js:1278`, `src/archive/archive-utils.js:1304`, `src/archive/archive-utils.js:1326`, and `src/archive/archive-utils.js:1358`. |
| INV-06 | spec | `preserved` | Complete standings preserve tied rank-1 rows through dense ranking and `tied` metadata at `src/archive/archive-utils.js:625`; partial evidence suppresses leader anchors at `src/archive/archive-utils.js:950` for mixed scored/unscored cases. |
| INV-07 | spec | `violated` | Missing score/rank evidence for a whole submitted round with all scores/ranks missing is classified as `none`, not `partial`, at `src/archive/archive-utils.js:683`; that prevents an unavailable anchor or sparse caveat from being emitted for that incomplete-outcome state. |
| INV-09 | spec | `preserved` | New candidate moment construction omits ineligible swing rounds unless every submission in the candidate round is scored at `src/archive/archive-utils.js:1092`, and unsupported game-level table claims are omitted for partial evidence at `src/archive/archive-utils.js:1049`. |
| INV-13 | spec | `preserved` | The diff introduces no genre, mood, duration, popularity, album, release year, audio feature, recommendation, inferred taste, vote-budget, deadline, or unsupported-humor claims; moment copy remains archive-fact based at `src/archive/archive-utils.js:1202` and `src/archive/archive-utils.js:1351`. |
| INV-14 | spec | `violated` | For submitted-but-unscored sparse data, `competitiveAnchor` is `null` at `src/archive/archive-utils.js:946` and `sparseState` is also `null` because `buildSelectedGameSparseState()` only handles zero submissions or unavailable anchors at `src/archive/archive-utils.js:1414`; this leaves no explicit unavailable score sub-state. |
| Repo invariant: `AGENTS.md` canonical guidance | guidance | `preserved` | Diff touches only archive source and tests; it does not modify `AGENTS.md` or replace canonical repo guidance. |
| Repo invariant: `bolder-utils` default SDD tooling | guidance | `preserved` | No SDD package-bin or tooling replacement appears in the diff. |
| Repo invariant: prompt overrides only under `docs/sdd/` when configured | guidance | `preserved` | Diff introduces no prompt override files. |
| Repo invariant: `docs/sdd/` runtime artifacts home | guidance | `preserved` | Diff artifact remains under `docs/sdd/`; source changes do not relocate runtime artifacts. |
| Repo invariant: only Orchestrator writes `PLAN-*.md` during execution | guidance | `preserved` | No `PLAN-*.md` files are changed by the diff. |
| Repo invariant: active spec contracts/ACs not implicitly changed in code | guidance | `preserved` | No spec files are changed by the implementer diff. |
| Repo invariant: new dependencies must be allowed or preexisting | guidance | `preserved` | `package.json` is unchanged and §4e allows no new dependencies. |

**Contract Audit** (`contracts:` → §4 items)

| Contract ref | §4 item | Status | Evidence |
|--------------|---------|--------|----------|
| §4c-3 | Memory board payload | `fulfilled` | `buildSelectedGameBoard()` returns `selectedGameId`, `anchor`, `moments`, and `sparseState` at `src/archive/archive-utils.js:1472`; `buildMemoryBoardMoment()` emits the required moment fields at `src/archive/archive-utils.js:1010`. |
| §4c-4 | Competitive anchor | `broken` | The anchor handles complete and mixed-partial standings at `src/archive/archive-utils.js:946` and `src/archive/archive-utils.js:950`, but because §4d-5 all-unscored submitted rounds are misclassified as `none`, `buildSelectedGameCompetitiveAnchor()` returns `null` instead of an unavailable anchor for that submitted partial-evidence state. |
| §4d-4 | Board family catalog and priority | `fulfilled` | The diff supplies `the-table`, `game-swing`, `new-to-us-that-landed`, `back-again-familiar-face`, and `participation-pulse` metadata and composes them in catalog priority at `src/archive/archive-utils.js:1067`, `src/archive/archive-utils.js:1213`, `src/archive/archive-utils.js:1267`, `src/archive/archive-utils.js:1293`, `src/archive/archive-utils.js:1319`, and `src/archive/archive-utils.js:1461`. |
| §4d-5 | Standings derivation | `broken` | §4d-5 says `partial` includes a whole submitted round where all scores/ranks are missing, but the implementation returns `none` whenever there are zero scored submissions and no one-sided score/rank pair at `src/archive/archive-utils.js:683`; the new test expects this non-compliant state at `prisma/tests/queries.test.js:1567`. |
| §4d-6 | Swing derivation | `fulfilled` | `deriveGameSwingMoment()` groups selected submissions by round, requires complete scored round evidence, recognizes one-point photo finishes and >=5-point runaway picks, prefers photo finishes before largest runaways, and targets the vote-breakdown evidence path at `src/archive/archive-utils.js:1102`; coverage was added at `prisma/tests/queries.test.js:1600`. |
| §4e | Dependencies | `fulfilled` | No dependency file changes appear in the diff, and targeted tests run with existing Node/Prisma/React tooling. |

**Verdict:** `contested`

Failing items:
- AC-07: all-unscored submitted rounds are classified as `none`, so missing score/rank evidence is not caveated while unrelated moments can remain.
- AC-09: submitted-but-unscored sparse recaps do not receive an explicit sparse score state.
- INV-07: incomplete outcome data is not consistently cavesated.
- INV-14: the submitted-but-unscored sparse state lacks an explicit unavailable sub-state.
- §4c-4: the competitive anchor cannot render the required unavailable state for the all-unscored submitted-round partial case because standings completeness is misclassified.
- §4d-5: standings completeness violates the explicit partial-state rule for whole submitted rounds where all scores/ranks are missing.
