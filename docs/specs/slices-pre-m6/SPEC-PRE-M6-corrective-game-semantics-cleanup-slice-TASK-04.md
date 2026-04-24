# Slice: TASK-04 — Add semantic fixture bundles and manifest

> **Depends-on:** TASK-01, TASK-02, TASK-03
> **Universal:** SPEC-PRE-M6-corrective-game-semantics-cleanup-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-5. Semantic fixture manifest

```ts
interface SemanticFixtureManifest {
  fixtureName: string;
  files: Array<"competitors.csv" | "rounds.csv" | "submissions.csv" | "votes.csv">;
  covers: CorrectivePatchId[];
  behaviors: string[];
}
```

Required fixture coverage may be satisfied by one or more small fixtures, but the combined set must cover:

- two games with overlapping or similar round names;
- repeat exact canonical song across rounds, but not twice within the same round;
- same title/name collisions that use distinct canonical song IDs;
- same exported artist label with a new song;
- same lead artist alone and in a multi-artist exported label;
- negative vote points;
- vote rows with voter, target song/submission, points, and vote comment;
- submission comments and vote comments in the same dataset;
- standings clear leader and standings tie;
- missing score/rank or unvoted submissions;
- completed post-vote submissions with any legacy visibility flags documented;
- sparse one-submission or one-scored-submission player history;
- stale or unresolvable origin context for modal routes.

---

| ID | Condition | Verification |
|---|---|---|
| AC-03 | Product contracts and tests preserve `Game` as the canonical parent of `Round`, treat `Round.leagueSlug` as compatibility metadata, and prove similar round names across games do not create grouping ambiguity. | `test` + `review` |
| AC-04 | A derived standings read model totals scored `Submission.score` values by player within one game, excludes unscored submissions from totals, handles ties explicitly, and introduces no persisted standings table. | `test` + `schema review` |
| AC-05 | Player-performance overview contracts define denominators, finish-percentile normalization, multi-submit handling, score-variance posture, and small-sample copy posture before permitting M6 player claims. | `test` + `review` |
| AC-06 | Source-settings posture documents absent settings as unknown; negative vote points remain valid; overview/round copy does not explain budget usage, missed deadlines, disqualification, or low-stakes behavior without source facts. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-08 | Completed round detail exposes a v1 vote-by-vote breakdown with voter, target submission/song, points, and vote comment, while keeping submission comments and vote comments distinct. | `test` + `manual` |
| AC-09 | Artist aggregate and familiarity contracts state v1 identity as normalized exported artist display string and prohibit collaborator-level overclaims from multi-artist labels. | `test` + `review` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-11 | Semantic fixture coverage exists or is named for every non-deferred CP item and every M6 insight category allowed by this cleanup. | `test` + `review` |

---

4. **[TASK-04] Add semantic fixture bundles and manifest** — Add small inspectable fixture coverage for the CP-10 edge cases and document which CP items each fixture validates.
   `contracts: §4d-5` · `preserves: INV-01, INV-03, INV-05, INV-07, INV-08, INV-09, INV-11, INV-12, INV-15, INV-16` · `validates: AC-03, AC-04, AC-05, AC-06, AC-08, AC-09, AC-11`

---
