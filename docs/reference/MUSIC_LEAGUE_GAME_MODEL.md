# Music League Game Model Reference

Purpose: give product, planning, implementation, and review agents a compact
reference for how the Music League game works, and how this repository currently
models that game. Use this before judging whether a feature, query, import rule,
or UI behavior is semantically aligned.

This file is descriptive grounding, not an implementation SPEC. Active specs
remain authoritative for contracts, invariants, and acceptance criteria.

## Source Hierarchy

When references disagree, use this precedence:

1. Active repo SPEC for the task or milestone.
2. This reference, for cross-milestone game semantics.
3. Accepted FSDs under `docs/specs/`, for product intent.
4. Official Music League public docs, for source-platform behavior.
5. Test fixtures and current code, for implemented behavior.

Do not silently change active spec contracts or acceptance criteria because this
reference says something broader.

## Core Game Loop

Music League is a recurring, theme-based music competition:

1. A league is made of rounds.
2. Each round has a theme or prompt.
3. Players submit one or more songs that fit the theme.
4. After submission closes, Music League produces a playlist of the submitted
   songs.
5. Players listen, vote by assigning points, and may comment.
6. After voting closes, results reveal song submitters, votes, comments, round
   winners, and league standings.
7. Points accumulate across rounds until the league winner is determined.

Important behavioral consequences:

- A round is not just a list of songs; it is a themed event with a submission
  phase, a listening/voting phase, and a revealed-results phase.
- A submission is a player bringing a song into a specific round.
- Within one round, the same canonical song is not submitted twice. Treat
  same-song/same-round duplicates as a non-case for product design, spec
  authoring, fixture planning, and review unless a human explicitly opens a
  future data-corruption investigation.
- A vote is a player assigning points to a song in a specific round.
- Score and rank are outcome data derived from votes, not independent source
  truths in this repo.
- Comments can belong to submissions and votes; they are social evidence, not
  scoring primitives.
- The source platform prevents self-voting. The repo treats that as source
  behavior unless a spec explicitly adds local enforcement.

## Source Platform Configuration

Music League games can vary by settings chosen outside this repo:

- Number of rounds in the league.
- Number of songs each player may submit per round.
- Submission and voting deadlines.
- Vote budget and whether downvotes are available.
- Whether missed deadlines affect voting eligibility or points received.
- Admin-created themes and descriptions.

Current repo implication: preserve imported facts that reveal these settings,
such as negative vote points or multiple submissions, but do not build local
gameplay controls for those settings unless an accepted spec introduces them.

Source-platform lifecycle facts that may matter later:

- Before voting closes, submitter identity is generally hidden from other
  voters. The repo has `Submission.visibleToVoters` because exports can encode
  visibility state.
- If a player misses the song-submission deadline, the source platform can
  prevent that player from voting in the round.
- If a player misses the voting deadline, points given to that player's song
  can be discarded unless the source league uses a low-stakes setting.

The current archive product should represent the imported outcome it receives.
It should not try to reconstruct alternate outcomes unless a future spec adds
that capability.

## League, Game, and Round Vocabulary

The public product usually says "league" for the whole competition. This repo
also has a canonical `Game` entity because imported exports can contain multiple
historical game snapshots. In repo-facing work:

- `Game` is the top-level archive object for one imported Music League game
  snapshot or source game identity.
- `Round` belongs to exactly one `Game`.
- `Round.leagueSlug` is compatibility metadata in current scope. Product
  grouping, standings, overview aggregation, song memory, and player history
  should use `Game` / `Round.gameId` semantics unless an active spec authorizes
  a legacy compatibility path.
- `Round.name` is usually the theme or prompt label.
- `Round.description` may contain extra prompt text or context.
- `Round.playlistUrl` points to the generated playlist when available.
- `Round.sequenceNumber` or `occurredAt` may support ordering, but stable
  identity comes from source IDs and parent game context.

Avoid flattening rounds from different games into one ambiguous list unless a
spec explicitly asks for global archive search or cross-game analysis.

## Source Export Shape

The supported import unit is one four-file Music League CSV bundle:

- `competitors.csv`: player identity and display name.
- `rounds.csv`: round identity, created/occurred timestamp, name, description,
  and playlist URL.
- `submissions.csv`: submitted song URI, title, artist display string,
  submitter identity, submitted timestamp, submission comment, round identity,
  and visibility flag.
- `votes.csv`: song URI, voter identity, vote timestamp, assigned points, vote
  comment, and round identity.

The repo optimizes for this trusted export shape. It should fail deterministically
on unsupported or internally inconsistent data rather than infer a plausible
answer.

Current supported imports are completed, post-vote, de-anonymized snapshots.
The `visibleToVoters` export field is preserved as source evidence and
compatibility data; current product surfaces must not use it as an active
privacy gate. If a future feature imports pre-reveal or in-progress data, that
feature needs a separate privacy/reveal-state contract before exposing
player-song associations.

### Canonical Non-Case: Same Song Twice In One Round

Do not spend architecture, implementation, or review effort looking for
same-canonical-song/same-round duplicate submissions. They do not occur in the
supported Music League product model for this repo.

The canonical rule is:

- A canonical `Song` may recur across different rounds and different games.
- A canonical `Song` does not appear twice as separate submissions inside the
  same round.
- Same-title songs, same-name songs, covers, remixes, or tracks with similar
  display metadata are not the same canonical song when their Spotify URIs
  differ.
- Multiple songs per player per round can happen when source settings allow it;
  that does not imply the same canonical song appears twice in the round.

Agent instruction: do not create open questions, schema work, import fixtures,
validation projects, anomaly paths, task scope, or acceptance criteria for
same-song/same-round duplicates. If current code has generic uniqueness shapes
that appear broader than this rule, read them as schema mechanics, not as a
product invitation to investigate an impossible gameplay case.

## Canonical Entities

Use these meanings consistently:

| Entity | Meaning | Identity posture |
| --- | --- | --- |
| `Player` | A Music League participant as represented in exports. | Match by stable source player ID; display names are labels. |
| `Artist` | The exported artist display string for a song. | Match by normalized artist name in current v1 scope. Multi-artist splitting is deferred. |
| `Song` | A canonical Spotify track in the archive. | Match by Spotify URI. Title and artist are display metadata and fallback context, not primary identity. |
| `Game` | One source game identity in the archive. | Match by source game ID or derived game key per import spec. |
| `Round` | One theme/prompt event inside a game. | Match by source round ID scoped to game. |
| `Submission` | A player submitting a song to a round. | Product-semantically unique by round and canonical song; current schema also records the submitter relation. Do not treat same-song/same-round duplicates as expected data. |
| `Vote` | A player assigning points to a song in a round. | Unique by round, voter, and song in current schema. |
| `ImportBatch` | Operational record for parsing, staging, validating, and committing one bundle. | Audit object, not game semantics. |

## Scoring Semantics

Repo scoring rules:

- `Vote.pointsAssigned` is the source of truth for score computation.
- `Submission.score` is the sum of points assigned to that song in that round.
- `Submission.rank` is the ordinal placement by score within the round.
- Scores and ranks are recomputed during import/commit workflows.
- Missing score or rank means an unscored or partially imported state, not an
  automatic loss.
- Negative vote points are valid when downvotes are enabled in the source game.
- A voter casts at most one vote per song per round.
- Because the same canonical song does not appear twice in one round, scoring,
  vote display, standings, and result evidence should not branch into
  per-submitter disambiguation for duplicate same-song targets.

Feature implication: analytics, highlights, traits, and standings must be
derived from canonical votes or stored derived fields whose provenance is votes.
Do not introduce features that treat imported rank/score copy as authoritative
unless an active spec explicitly revises the model.

## Archive Product Posture

This repository is currently building an archive and import-backed browsing
experience, not a full replacement for live Music League gameplay.

In scope for the current product direction:

- Importing completed, post-vote, de-anonymized source snapshots.
- Browsing games, rounds, submissions, songs, players, scores, ranks, and
  comments.
- Preserving source identity so refreshes are replay-safe.
- Showing group memory: prior song appearances, familiar artists, notable
  picks, player tendencies, and round highlights.

Out of scope unless a future spec says otherwise:

- Hosting live submission deadlines.
- Creating or editing Music League rounds.
- Running voting sessions.
- Exposing pre-reveal player-song associations without a new reveal-state
  contract.
- Managing league invitations, membership, or platform accounts.
- Syncing live Spotify playlist state outside the provided import data.
- Arbitrating ambiguous imports through a manual review UI.

## Social Memory Semantics

Many features in this repo should optimize for "what will participants remember
from the game?" rather than generic music-library behavior.

Useful memory anchors:

- Who submitted the song.
- Which round/theme made it relevant.
- Whether the song won, placed, or failed memorably.
- Whether the exact song has appeared before.
- Whether the artist is familiar even when the exact song is new.
- Comments that explain why a pick landed socially.

Avoid replacing these anchors with external metadata such as genre, tempo,
release year, audio features, or recommendation logic unless an accepted spec
adds those data sources.

## Feature Alignment Questions

Before implementing product behavior, answer:

1. What game object is this feature about: game, round, player, song,
   submission, vote, import, or archive memory?
2. Is the feature respecting the source hierarchy: game -> round -> submission
   and round -> vote?
3. Does the feature distinguish source data from derived data?
4. Does it preserve source identity and replay safety?
5. Does it make incomplete outcome data intelligible without inventing results?
6. Does it improve league memory or operational trust, rather than merely
   adding generic music-app chrome?

Do not add a checklist item, risk finding, or HITL escalation for
same-canonical-song/same-round duplicate submissions. The canonical answer is
already settled: they are outside the supported game model and should not be a
planning axis.

If any answer is unclear, inspect the active spec and
`docs/reference/FEATURE_ALIGNMENT_CHECKLIST.md` before changing code.

## Provenance

Repo sources:

- `docs/specs/FSD-001-core-data-model.md`
- `docs/specs/SPEC-001-core-data-model.md`
- `docs/specs/FSD-002-csv-import-pipeline.md`
- `docs/specs/FSD-003-round-page.md`
- `docs/specs/FSD-004-player-modal.md`
- `docs/specs/FSD-005-song-modal.md`
- `prisma/schema.prisma`
- `src/import/test-fixtures/clean-bundle/*.csv`

External public sources checked on 2026-04-24:

- Music League home page: https://musicleague.com/
- Music League user guide: https://musicleague.com/user-guide/
