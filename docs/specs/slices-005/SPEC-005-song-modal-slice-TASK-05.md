# Slice: TASK-05 — Converge player-history song taps on canonical song detail

> **Depends-on:** TASK-04
> **Universal:** SPEC-005-song-modal-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4a-1. Archive route with canonical song memory state

```http
GET /?round=<roundId>&song=<songId>&player=<playerId>&playerSubmission=<submissionId>
```

```txt
Query params:
  round?: integer             // canonical Round.id for the open round overlay / origin context
  song?: integer              // canonical Song.id for canonical song detail
  player?: integer            // canonical Player.id for the player modal
  playerSubmission?: integer  // legacy M4 player-song push input, superseded for song opens

Response:
  200 HTML document containing:
    - archive route with game sections
    - optional round detail overlay for ?round=
    - optional canonical song detail when ?song= resolves in a valid origin context
    - optional player modal for ?player=
    - optional contained unavailable state for stale origin-song combinations

Validation / error handling:
  - invalid integer params are ignored
  - invalid ?round=<id> renders the archive plus the existing non-blocking
    "Round not found." notice; no nested song or player modal opens
  - ?song=<id> without a valid open round is ignored in first ship
  - ?song=<id> with a valid round but no resolvable Song renders a contained
    unavailable song state inside the round overlay
  - ?song=<id> with a valid Song but an origin round that no longer contains
    that song renders the same contained unavailable song state; it must not
    fall back to a broken nested shell
  - ?player=<id> without a valid open round is ignored
  - valid player flow retains precedence over playerSubmission; however,
    player-history song links introduced or changed by M5 MUST target
    canonical song detail with ?song=<songId> rather than the M4
    playerSubmission song subview
  - if both ?player= and ?song= are present, follow the deterministic nested
    route precedence in §4d-7; new M5 song links MUST omit ?player= to avoid
    parallel song meanings
```

**Route behavior notes:**

- Round-detail song links use `buildArchiveHref({ roundId, songId })`.
- Player-history song links use
  `buildArchiveHref({ roundId: evidenceRoundId, songId })` so the canonical
  song detail foregrounds the clicked evidence row's game/round context.
- If anomalous same-round duplicate submissions exist for the same canonical
  `songId`, first-ship route state foregrounds the deterministic representative
  origin from §4d-3 rather than adding a submission-scoped song URL.
- Closing canonical song detail returns to `buildArchiveHref({ roundId })` for
  the origin round that opened it.
- Round links inside song history use `buildArchiveHref({ roundId:
  historyRoundId })`.
- Player links inside song history use `buildArchiveHref({ roundId:
  historyRoundId, playerId: submitterId })`, anchoring the player modal to the
  evidence row's round because that row best explains the provenance.
- M5 may keep the nested shell implementation, but visible copy and payload
  semantics must present one canonical archive-wide song memory surface rather
  than a round-scoped submission shell.
- Game and round query state are implementation provenance for the current
  archive route, not a product-level redefinition of song identity.

---

#### §4d-5. `buildArchiveHref()` canonical song links

```ts
function buildArchiveHref(input?: {
  roundId?: number;
  songId?: number;
  playerId?: number;
  playerSubmissionId?: number;
}): string
```

**Behavior rules:**

- Preserve base archive and round-only href behavior.
- Preserve player href behavior for player modal opens.
- New or changed song links in round detail and player history use
  `roundId + songId`.
- New M5 code must not emit `playerSubmission` for song detail navigation.
- If `playerId` and `songId` are both supplied by new M5 code, prefer omitting
  `playerId` at the call site. The helper may retain its M4 precedence for
  backward compatibility, but M5 tests must assert canonical song links are
  round-plus-song links.

#### §4d-6. Player-history song-link convergence

```txt
When rendering song links in ArchivePlayerModal history or notable picks:
  before M5: /?round=<originRoundId>&player=<playerId>&playerSubmission=<submissionId>
  after M5:  /?round=<historyRoundId>&song=<songId>
```

**Behavior rules:**

- The clicked history row's round becomes origin context for the canonical
  song detail.
- The player modal close/back behavior remains unchanged for ordinary player
  links and round links.
- M4 player-scoped song view may remain as legacy code only when reachable by
  old direct URLs; new in-app song taps must converge on the canonical song
  surface.

#### §4d-7. Nested route-state resolution

```ts
type NestedArchiveSelection =
  | { kind: "none" }
  | { kind: "song"; songId: number; modal: ArchiveSongModalProps | UnavailableSongStateProps }
  | { kind: "player"; playerId: number; activeSubmissionId: number | null };
```

**Behavior rules:**

- Nested state is considered only after `?round=` resolves to an open round.
- Legacy M4 player-song direct URLs retain precedence only when both
  `?player=` and `?playerSubmission=` are present and the player resolves in
  the origin round. If the submission resolves, render the legacy active
  submission view; if the submission is stale, fall back to the player summary
  rather than opening a different song.
- Canonical song state is next: when `?song=` is present and no legacy
  `playerSubmission` flow owns the URL, resolve `getSongMemoryModal()` for the
  origin round and song.
- Player summary state is last: when `?player=` is present without `?song=`
  and without `?playerSubmission=`, resolve the existing player modal.
- Invalid integer params remain ignored. Invalid player state must not block a
  valid canonical song state unless the URL is a legacy playerSubmission flow.

---

| ID | Condition | Verification |
|---|---|---|
| AC-03 | The same canonical song opened from round detail and from player history receives the same semantic familiarity kind and modal verdict for the same route-visible origin context, including anomalous same-round duplicates that resolve through the deterministic representative origin | `test` |
| AC-04 | Any new in-app song tap from round detail or player history opens canonical archive-wide song detail rather than the old current-round row shell or M4 player-scoped song subview | `manual` + `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-12 | Nested route-state resolution preserves legacy `playerSubmission` direct URLs while new `round + song` links open exactly one canonical song detail surface, including mixed-query URLs | `test` |

---

5. **[TASK-05] Converge player-history song taps on canonical song detail** — Change new player-modal song links from the M4 `playerSubmission` song subview to evidence-row anchored canonical `round + song` URLs while preserving ordinary player modal and round link behavior.
   `contracts: §4a-1, §4d-5, §4d-6, §4d-7` · `preserves: INV-01, INV-07, INV-11` · `validates: AC-03, AC-04, AC-12`

---
