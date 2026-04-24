# Slice: TASK-01 — Add shared song familiarity derivation

> **Depends-on:** (none)
> **Universal:** SPEC-005-song-modal-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-1. `SongFamiliarityVerdict`

```ts
type SongFamiliarityKind = "debut" | "known-artist" | "brought-back";

interface SongFamiliarityVerdict {
  kind: SongFamiliarityKind;
  label: "New to us" | "Known artist" | "Brought back";
  shortSummary: string;
  exactSongSubmissionCount: number;
  priorExactSongSubmissionCount: number;
  priorArtistSubmissionCount: number;
  priorArtistSongCount: number;
  throughSubmitters: Array<{
    id: number;
    displayName: string;
  }>;
}
```

**Classification rules:**

- `brought-back`: prior exact-song history exists in a round before the origin
  round when an origin round is known, or exact-song history count is greater
  than 1 when no single origin round is available.
- `known-artist`: no prior exact-song history applies, but prior same-artist
  history exists through one or more other songs in rounds before the origin
  round.
- `debut`: neither prior exact-song nor prior same-artist history exists.
- Exact-song history wins over artist-only history when both are true.
- Classification uses canonical `Song.id` for exact-song history and
  canonical `Artist.id` for same-artist history. It must not use title
  coincidence, genre, album, decade, mood, fuzzy matching, or external
  metadata.
- Artist-only prior counts used for `known-artist` exclude submissions for the
  opened canonical `Song.id`; exact-song evidence is represented by the
  exact-song counts and history rows instead.
- Same-round co-occurrence does not count as prior familiarity. If two
  different songs by the same artist appear in the origin round and that artist
  has no earlier archive submissions, both songs remain `New to us`.

#### §4d-2. `deriveSongFamiliarity()`

```ts
function deriveSongFamiliarity(input: {
  songId: number;
  artistId: number;
  originRoundId: number | null;
  originSubmissionId: number | null;
  exactSongSubmissions: Array<{
    id: number;
    roundId: number;
    roundSequenceNumber: number | null;
    playerId: number;
    playerName: string;
    createdAt: Date | string | null;
    roundOccurredAt: Date | string | null;
  }>;
  artistSubmissions: Array<{
    id: number;
    roundId: number;
    roundSequenceNumber: number | null;
    songId: number;
    playerId: number;
    playerName: string;
    createdAt: Date | string | null;
    roundOccurredAt: Date | string | null;
  }>;
}): SongFamiliarityVerdict
```

**Ordering rule:** When an origin round is known, "prior" means submissions in
rounds before that origin round by deterministic archive history order:
`Round.occurredAt` ascending with nulls last, then `Round.sequenceNumber`
ascending with nulls last, then `Round.id` ascending, then
`Submission.createdAt` ascending with nulls last, then `Submission.id`
ascending. Other submissions in the origin round are current-context evidence,
not prior familiarity evidence, even when their submission timestamps sort
earlier than the representative origin row. When no origin round is known, use
the full archive history and the fallback counts in §4d-1.
`originSubmissionId` remains the anchor for foregrounding, shortcuts, and
representative-origin agreement, not for same-round familiarity inflation.

---

#### §4d-8. Song-memory implementation locality

```txt
Shared song-memory derivation, history ordering, and verdict vocabulary live in
one internal boundary, either `src/archive/archive-utils.js` or an adjacent
`src/archive/song-memory.js` helper imported by archive-utils and tests.
```

**Behavior rules:**

- Route resolution, round row rendering, and modal rendering must consume the
  shared verdict and ordering helpers rather than reimplementing classification
  or history precedence in UI code.
- A new adjacent helper file is allowed if it improves locality for the
  familiarity model; no new package is required or allowed by M5.

---

| ID | Condition | Verification |
|---|---|---|
| AC-02 | Familiarity derivation distinguishes true debut, same-artist/new-song, and prior exact-song history using only canonical `Song.id` and `Artist.id`; exact-song history wins when both apply, and same-round co-occurrence alone does not create prior familiarity | `test` |
| AC-03 | The same canonical song opened from round detail and from player history receives the same semantic familiarity kind and modal verdict for the same route-visible origin context, including anomalous same-round duplicates that resolve through the deterministic representative origin | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-11 | M5 ships without global search, fuzzy matching, external metadata enrichment, recommendations, charts, vote-by-vote explainers, or multiple simultaneous familiarity badges | `review` |

---

1. **[TASK-01] Add shared song familiarity derivation** — Implement `SongFamiliarityVerdict`, deterministic exact-song-vs-artist classification, shared history ordering helpers, and focused unit coverage for debut, known-artist, brought-back, precedence, artist-only exclusion, same-round co-occurrence exclusion, and sparse ordering cases.
   `contracts: §4d-1, §4d-2, §4d-8` · `preserves: INV-02, INV-03, INV-08, INV-10, INV-12` · `validates: AC-02, AC-03, AC-11`

---
