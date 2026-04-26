const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeSourcePlayerIdsForImport,
  resolveSourcePlayerId,
} = require("./source-player-id-remaps");

const TEST_RULES = [
  {
    reusedSourcePlayerId: "player-reused",
    historicalSourcePlayerId: "player-historical",
    historicalDisplayName: "Historical Helen",
    cutoffDate: "2025-01-15",
  },
];

test("remaps the reused source player ID before the cutoff date", () => {
  assert.equal(
    resolveSourcePlayerId({
      sourcePlayerId: "player-reused",
      occurredAt: new Date("2025-01-14T23:59:59.999Z"),
      rules: TEST_RULES,
    }),
    "player-historical",
  );
});

test("does not remap the reused source player ID on the cutoff date", () => {
  assert.equal(
    resolveSourcePlayerId({
      sourcePlayerId: "player-reused",
      occurredAt: new Date("2025-01-15T00:00:00.000Z"),
      rules: TEST_RULES,
    }),
    "player-reused",
  );
});

test("does not remap the reused source player ID after the cutoff date", () => {
  assert.equal(
    resolveSourcePlayerId({
      sourcePlayerId: "player-reused",
      occurredAt: new Date("2025-01-16T00:00:00.000Z"),
      rules: TEST_RULES,
    }),
    "player-reused",
  );
});

test("keeps ambiguous or missing round dates unchanged", () => {
  assert.equal(
    resolveSourcePlayerId({
      sourcePlayerId: "player-reused",
      occurredAt: null,
      rules: TEST_RULES,
    }),
    "player-reused",
  );
  assert.equal(
    resolveSourcePlayerId({
      sourcePlayerId: "player-reused",
      occurredAt: new Date("invalid"),
      rules: TEST_RULES,
    }),
    "player-reused",
  );
});

test("normalizes before-cutoff submission and vote references for staging", () => {
  const normalizedBundle = normalizeSourcePlayerIdsForImport(
    createParsedBundle({
      roundOccurredAt: new Date("2025-01-14T12:00:00.000Z"),
    }),
    TEST_RULES,
  );

  assert.deepEqual(
    normalizedBundle.files.competitors.rows.map((row) => ({
      sourcePlayerId: row.sourcePlayerId,
      displayName: row.displayName,
    })),
    [
      {
        sourcePlayerId: "player-historical",
        displayName: "Historical Helen",
      },
      {
        sourcePlayerId: "player-other",
        displayName: "Other Opal",
      },
    ],
  );
  assert.equal(
    normalizedBundle.files.submissions.rows[0].sourceSubmitterId,
    "player-historical",
  );
  assert.equal(normalizedBundle.files.votes.rows[0].sourceVoterId, "player-historical");
});

test("keeps on-cutoff submission and vote references unchanged for staging", () => {
  const normalizedBundle = normalizeSourcePlayerIdsForImport(
    createParsedBundle({
      roundOccurredAt: new Date("2025-01-15T00:00:00.000Z"),
    }),
    TEST_RULES,
  );

  assert.deepEqual(
    normalizedBundle.files.competitors.rows.map((row) => ({
      sourcePlayerId: row.sourcePlayerId,
      displayName: row.displayName,
    })),
    [
      {
        sourcePlayerId: "player-reused",
        displayName: "Legacy Lee",
      },
      {
        sourcePlayerId: "player-other",
        displayName: "Other Opal",
      },
    ],
  );
  assert.equal(
    normalizedBundle.files.submissions.rows[0].sourceSubmitterId,
    "player-reused",
  );
  assert.equal(normalizedBundle.files.votes.rows[0].sourceVoterId, "player-reused");
});

test("synthesizes a historical player row when one bundle references both canonical IDs", () => {
  const parsedBundle = createParsedBundle({
    roundOccurredAt: new Date("2025-01-14T12:00:00.000Z"),
  });
  parsedBundle.files.rounds.rows.push({
    sourceRowNumber: 3,
    sourceRoundId: "round-after",
    occurredAt: new Date("2025-01-15T00:00:00.000Z"),
  });
  parsedBundle.files.submissions.rows.push({
    sourceRowNumber: 3,
    sourceRoundId: "round-after",
    sourceSubmitterId: "player-reused",
    spotifyUri: "spotify:track:after",
  });

  const normalizedBundle = normalizeSourcePlayerIdsForImport(parsedBundle, TEST_RULES);

  assert.deepEqual(
    normalizedBundle.files.competitors.rows.map((row) => ({
      sourceRowNumber: row.sourceRowNumber,
      sourcePlayerId: row.sourcePlayerId,
      displayName: row.displayName,
    })),
    [
      {
        sourceRowNumber: 2,
        sourcePlayerId: "player-reused",
        displayName: "Legacy Lee",
      },
      {
        sourceRowNumber: 3,
        sourcePlayerId: "player-other",
        displayName: "Other Opal",
      },
      {
        sourceRowNumber: -1,
        sourcePlayerId: "player-historical",
        displayName: "Historical Helen",
      },
    ],
  );
});

test("normalizes source key rows so duplicate detection sees post-remap keys", () => {
  const parsedBundle = createParsedBundle({
    roundOccurredAt: new Date("2025-01-14T12:00:00.000Z"),
  });
  parsedBundle.files.submissions.sourceKeyRows.push({
    sourceRowNumber: 3,
    sourceRoundId: "round-1",
    sourceSubmitterId: "player-historical",
    spotifyUri: "spotify:track:legacy",
  });
  parsedBundle.files.votes.sourceKeyRows.push({
    sourceRowNumber: 3,
    sourceRoundId: "round-1",
    sourceVoterId: "player-historical",
    spotifyUri: "spotify:track:other",
  });

  const normalizedBundle = normalizeSourcePlayerIdsForImport(parsedBundle, TEST_RULES);

  assert.deepEqual(
    normalizedBundle.files.submissions.sourceKeyRows.map((row) => [
      row.sourceRoundId,
      row.sourceSubmitterId,
      row.spotifyUri,
    ]),
    [
      ["round-1", "player-historical", "spotify:track:legacy"],
      ["round-1", "player-historical", "spotify:track:legacy"],
    ],
  );
  assert.deepEqual(
    normalizedBundle.files.votes.sourceKeyRows.map((row) => [
      row.sourceRoundId,
      row.sourceVoterId,
      row.spotifyUri,
    ]),
    [
      ["round-1", "player-historical", "spotify:track:other"],
      ["round-1", "player-historical", "spotify:track:other"],
    ],
  );
});

function createParsedBundle(input) {
  return {
    files: {
      competitors: defineSourceKeyRows(
        {
          rows: [
            {
              sourceRowNumber: 2,
              sourcePlayerId: "player-reused",
              displayName: "Legacy Lee",
            },
            {
              sourceRowNumber: 3,
              sourcePlayerId: "player-other",
              displayName: "Other Opal",
            },
          ],
        },
        [
          { sourceRowNumber: 2, sourcePlayerId: "player-reused" },
          { sourceRowNumber: 3, sourcePlayerId: "player-other" },
        ],
      ),
      rounds: {
        rows: [
          {
            sourceRowNumber: 2,
            sourceRoundId: "round-1",
            occurredAt: input.roundOccurredAt,
          },
        ],
      },
      submissions: defineSourceKeyRows(
        {
          rows: [
            {
              sourceRowNumber: 2,
              sourceRoundId: "round-1",
              sourceSubmitterId: "player-reused",
              spotifyUri: "spotify:track:legacy",
            },
          ],
        },
        [
          {
            sourceRowNumber: 2,
            sourceRoundId: "round-1",
            sourceSubmitterId: "player-reused",
            spotifyUri: "spotify:track:legacy",
          },
        ],
      ),
      votes: defineSourceKeyRows(
        {
          rows: [
            {
              sourceRowNumber: 2,
              sourceRoundId: "round-1",
              sourceVoterId: "player-reused",
              spotifyUri: "spotify:track:other",
            },
          ],
        },
        [
          {
            sourceRowNumber: 2,
            sourceRoundId: "round-1",
            sourceVoterId: "player-reused",
            spotifyUri: "spotify:track:other",
          },
        ],
      ),
    },
  };
}

function defineSourceKeyRows(fileResult, sourceKeyRows) {
  Object.defineProperty(fileResult, "sourceKeyRows", {
    value: sourceKeyRows,
    enumerable: false,
    writable: true,
  });

  return fileResult;
}
