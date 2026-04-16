# Slice: TASK-02 — Implement bundle parsing

> **Depends-on:** (none)
> **Universal:** SPEC-002-csv-import-pipeline-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-1. `parseMusicLeagueBundle(input)`

Suggested module: `src/import/parse-bundle.js`

```js
parseMusicLeagueBundle(input: {
  bundlePath: string,
  sourceLabel?: string
}): {
  sourceLabel: string,
  gameKey: string | null,
  issues: Array<{
    sourceFileKind: 'batch' | 'competitors' | 'rounds' | 'submissions' | 'votes',
    sourceRowNumber: number | null,
    issueCode: 'missing_file' | 'missing_header' | 'parse_error' | 'invalid_scalar',
    message: string,
    rowPreview: Record<string, string | number | boolean | null>
  }>,
  files: {
    competitors: {
      filename: string,
      rowCount: number,
      rows: Array<{
        sourceRowNumber: number,
        sourcePlayerId: string,
        displayName: string
      }>
    },
    rounds: {
      filename: string,
      rowCount: number,
      rows: Array<{
        sourceRowNumber: number,
        sourceRoundId: string,
        occurredAt: Date | null,
        name: string,
        description: string | null,
        playlistUrl: string | null
      }>
    },
    submissions: {
      filename: string,
      rowCount: number,
      rows: Array<{
        sourceRowNumber: number,
        spotifyUri: string,
        title: string,
        artistName: string,
        sourceSubmitterId: string,
        submittedAt: Date | null,
        comment: string | null,
        sourceRoundId: string,
        visibleToVoters: boolean | null
      }>
    },
    votes: {
      filename: string,
      rowCount: number,
      rows: Array<{
        sourceRowNumber: number,
        spotifyUri: string,
        sourceVoterId: string,
        votedAt: Date | null,
        pointsAssigned: number,
        comment: string | null,
        sourceRoundId: string
      }>
    }
  }
}

Errors:
  - unreadable bundle path
  - unreadable CSV file
```

**Contract rules:**

- The parser enforces the four-file bundle contract (INV-05).
- `bundlePath` is a directory path containing the required CSV filenames.
- The bundle is interpreted as exactly one game snapshot.
- The parser requires these source headers before header normalization:
  - `competitors.csv`: `ID`, `Name`
  - `rounds.csv`: `ID`, `Created`, `Name`, `Description`, `Playlist URL`
  - `submissions.csv`: `Spotify URI`, `Title`, `Artist(s)`, `Submitter ID`,
    `Created`, `Comment`, `Round ID`, `Visible To Voters`
  - `votes.csv`: `Spotify URI`, `Voter ID`, `Created`, `Points Assigned`,
    `Comment`, `Round ID`
- Header normalization is case-insensitive and whitespace-insensitive; extra
  source columns are ignored.
- Scalar coercion rules are:
  - timestamp fields (`Created`) parse as ISO-8601 timestamps to `Date`; blank
    values become `null` where the typed row allows null
  - `Visible To Voters`: `Yes` -> `true`, `No` -> `false`, blank -> `null`
  - `Points Assigned` parses as a base-10 integer and may be negative, zero, or
    positive; invalid values emit `invalid_scalar`
- The parser does not normalize or validate non-scalar string values beyond CSV
  decoding and header normalization.
- `rowCount` counts source data rows encountered in the file, even when a row
  also emits a parse issue.
- In an otherwise readable bundle, `missing_file`, `missing_header`,
  `parse_error`, and `invalid_scalar` are surfaced through `issues`, not thrown
  errors.
- Each parser-originated issue carries best-effort `rowPreview`; use `{}` when
  no row-level preview exists, such as `missing_file`.
- Invalid rows are not emitted in typed `rows`.
- `gameKey` is derived from the first valid typed round row in file order whose
  `sourceRoundId` is non-empty after trimming.
- If no such round row exists, `gameKey` is `null`; later analysis must treat
  missing `gameKey` as a blocking batch issue.

---

| ID | Condition | Verification |
|---|---|---|
| AC-02 | Missing any required source file or required header yields a blocking `ImportIssue` and the batch fails validation without canonical-table writes | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-04 | `listImportBatchIssues(batchId)` returns every blocking issue with row-level context sufficient for debugging | `test` |

---

| ID | Condition | Verification |
|---|---|---|
| AC-11 | The internal import workflow is adapter-neutral: a bundle-path ingest followed by issue listing, summary, and commit can be exercised entirely through the §4d service contracts | `test` |

---

2. **[TASK-02] Implement bundle parsing** — Enforce the four-file directory contract, emit typed rows with `sourceRowNumber`, and report parser-originated issues.
   `contracts: §4d-1` · `preserves: INV-05` · `validates: AC-02, AC-04, AC-11`

---
