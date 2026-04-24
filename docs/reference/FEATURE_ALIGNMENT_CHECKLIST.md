# Feature Alignment Checklist

Purpose: help agents decide whether a proposed feature, implementation, or
review finding lines up with the Music League game model and the current archive
product. Use this together with `docs/reference/MUSIC_LEAGUE_GAME_MODEL.md`.

This is a checklist, not a spec. If an active SPEC is stricter or more specific,
the SPEC wins.

## Fast Triage

Before writing or reviewing product code, classify the change:

- **Import correctness:** parsing, staging, matching, validation, commit,
  replay safety, source identity.
- **Archive browsing:** games, rounds, round detail, submission lists, links,
  empty or degraded states.
- **Player memory:** player history, notable picks, traits, score/rank-derived
  tendencies.
- **Song memory:** exact-song history, same-artist familiarity, evidence rows,
  canonical song modal.
- **Operational/tooling:** SDD wrappers, logs, config, plans, test harnesses.

If the change is product-facing and none of these buckets fit, check whether it
is premature relative to the active specs.

## Required Semantic Checks

### Game and Round Structure

- Rounds remain grouped under games.
- A round has one parent game.
- Similar round names across games do not imply sameness.
- Round detail shows the round as a complete event: theme, submissions, outcome
  when available, and parent game context.
- Ordering is deterministic and based on explicit data such as sequence,
  occurrence date, creation date, or a spec-defined fallback.

### Submission Semantics

- A submission means "this player brought this song to this round."
- Submission identity is not interchangeable with song identity.
- Multiple appearances of the same song across rounds remain separate
  submission events.
- Submission comments are displayed as optional social context.
- Missing score or rank does not suppress the submission.

### Vote and Scoring Semantics

- Votes are the authoritative input to score computation.
- Score is derived from vote points for a song in a round.
- Rank is derived from score ordering within that round.
- Negative points are possible when source game settings allow downvotes.
- Self-vote handling is source-platform behavior unless a spec adds local
  validation.
- Features do not fabricate results for unscored rounds.

### Song Identity and Memory

- Spotify URI is the canonical song identity in current v1 data.
- Title and artist text are display metadata and lookup context, not sufficient
  identity for imported songs with URIs.
- Exact-song history and same-artist history are distinct.
- Familiarity cues use one mutually exclusive classification.
- A song can be new while its artist is familiar.
- History rows remain submission-level evidence, not deduplicated anecdotes.

### Player Identity and Memory

- Players match by stable source player ID.
- Display names are labels; name-only matching is a fallback only where a spec
  permits it.
- Player traits use scored submission data only in current scope.
- Trait copy must be backed by a real signal or be absent.
- Notable picks use rank first, score as the tie-breaker or supporting detail
  according to the active spec.

### Import Integrity

- One supported import unit is exactly one four-file CSV bundle.
- Canonical data changes only after a staged import passes deterministic
  validation and is committed.
- Re-importing the same or newer snapshot for the same game must not duplicate
  canonical players, rounds, songs, submissions, or votes.
- Ambiguous identity, broken references, duplicate staged identities, and invalid
  scalar values are failures, not manual guesswork.
- Full-snapshot re-imports for the same game update the game snapshot instead
  of preserving stale canonical rows beside fresh rows.

### Navigation and Context

- Round, song, and player drill-ins preserve enough context for the user to know
  what game and round they came from.
- Song detail converges on one canonical song-memory concept.
- Player detail can show player-scoped song evidence, but must not redefine the
  canonical song modal unless the active spec says so.
- Deep links or URL state should identify the opened round/song/player without
  relying on prior in-app clicks.

## Red Flags

Treat these as review findings unless the active spec explicitly allows them:

- A feature flattens all rounds across games without preserving game context.
- A query joins songs by title alone when Spotify URI is available.
- A UI hides unscored submissions because rank or score is null.
- A summary says a player or song "won" without checking rank/score provenance.
- An import path writes directly to canonical tables before staging and
  validation.
- A re-import appends a second copy of the same game snapshot.
- A feature uses genre, mood, popularity, audio features, or release year before
  those data sources exist in canonical schema.
- A player trait or song verdict falls back to generic copy that sounds factual
  but has no supporting signal.
- A comment is treated as a score, vote, or identity field.
- A route or modal cannot be opened from a stable URL state.

## Capability Mapping

Use this table to keep feature scope aligned:

| Capability | Currently aligned basis | Not aligned without a new spec |
| --- | --- | --- |
| Round page | Game -> rounds -> full submission list with score/rank when available. | Live voting controls or round editing. |
| Player modal | Cross-round submissions, rank/score-derived trait, notable picks. | Taste claims based on genre, mood, or external metadata. |
| Song modal | Canonical song memory, exact-song history, same-artist footprint. | Recommendations, similarity, fuzzy global search. |
| Import | Deterministic four-file CSV snapshot workflow. | Arbitrary spreadsheet repair or manual row arbitration. |
| Highlights | Vote-derived outcomes and simple anomalies. | Claims unsupported by canonical votes/submissions. |
| Search readiness | Stable destination semantics for future lookup. | Shipping global search behavior by implication. |

## Review Prompts

When reviewing a change, ask:

1. What source data supports the user-visible claim?
2. Is this source data raw, normalized, matched, or derived?
3. What happens when rank, score, comments, dates, or playlist URLs are missing?
4. Can the same import be replayed without duplicating canonical state?
5. Does the UI preserve game and round context while allowing exploration?
6. Would a league participant recognize this as Music League behavior rather
   than a generic playlist manager?

## Close Criteria for Product Changes

A product change is ready to hand off when:

- It satisfies the active SPEC contracts and acceptance criteria.
- It passes the relevant semantic checks above.
- It has focused tests for changed derivation, import, query, or navigation
  behavior.
- It does not introduce new dependencies unless the active spec or
  `package.json` already allows them.
- Any residual ambiguity is documented in the implementation notes or review,
  not hidden in code.
