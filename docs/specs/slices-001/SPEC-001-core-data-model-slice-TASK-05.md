# Slice: TASK-05 — Verify query patterns against seed data

> **Depends-on:** TASK-02b, TASK-03, TASK-04b
> **Universal:** SPEC-001-core-data-model-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-2. Song modal query shape

```
Input:  songId: number
Output: Song & {
  artist: Artist,
  submissions: Array<Submission & {
    player: Player,
    round: Pick<Round, 'id' | 'name'>
  }>
}
```

#### §4d-3. Player modal query shape

```
Input:  playerId: number
Output: Player & {
  submissions: Array<Submission & {
    song: Song & { artist: Artist },
    round: Pick<Round, 'id' | 'name'>
  }>
}
// Aggregates (submission count, avg score) computed in application layer
// from the returned submissions array.
// Vote comments received (FSD §F5.2): requires a separate query per §4d-6
// shape 1 (roundId + songId) for each song the player submitted, or a
// single prisma.vote.findMany({ where: { songId: { in: [...playerSongIds] } } }).
// Not included in this shape.
```

#### §4d-4. Round page query shape

```
Input:  roundId: number
Output: Round & {
  submissions: Array<Submission & {
    player: Pick<Player, 'id' | 'displayName'>,
    song: Song & { artist: Pick<Artist, 'id' | 'name'> }
  }>
}
// Ordered by rank ASC NULLS LAST, then createdAt ASC.
```

#### §4d-5. Overview aggregate query shape

```
// Most-submitted artist: two-step application aggregation
Step 1: prisma.submission.findMany({ include: { song: { include: { artist: true } } } })
Step 2: group by song.artistId in application code, sum counts

// Most active player:
prisma.submission.groupBy({ by: ['playerId'], _count: { id: true } })
```

#### §4d-6. Vote-based query shape

```
Input:  roundId: number, songId: number
Output: Array<Vote & { voter: Pick<Player, 'id' | 'displayName'> }>

Input:  voterId: number
Output: Array<Vote & {
  song: Song & { artist: Pick<Artist, 'id' | 'name'> },
  round: Pick<Round, 'id' | 'name'>
}>
```

---

| ID | Condition | Verification |
|---|---|---|
| AC-13 | All 7 query shapes in §4d-2 through §4d-6 (both §4d-5 sub-queries and both §4d-6 input shapes) execute against seed data without error and return non-empty results | `test` |

---

7. **[TASK-05] Verify query patterns against seed data** — Write
   `prisma/tests/queries.test.js` using `node:test`. Query the seeded database
   (no setup/teardown — read-only against the live seed). Assert non-empty
   results for all six shapes below. No raw SQL.

   | Shape | Query anchor |
   |---|---|
   | §4d-2 Song modal | any `songId` present in both rounds |
   | §4d-3 Player modal | any `playerId` with ≥ 1 submission |
   | §4d-4 Round page | round with `sourceRoundId = 'seed-r1'` |
   | §4d-5 Most-submitted artist | full `findMany` + app-layer group |
   | §4d-5 Most active player | `groupBy playerId` |
   | §4d-6 shape 1 (roundId + songId) | any `(roundId, songId)` with votes |
   | §4d-6 shape 2 (voterId) | any `voterId` with ≥ 1 vote cast |

   Run with `node --test prisma/tests/queries.test.js`.
   `contracts: §4d-2, §4d-3, §4d-4, §4d-5, §4d-6` · `preserves: INV-01` · `validates: AC-13`

---
