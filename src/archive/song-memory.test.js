const test = require("node:test");
const assert = require("node:assert/strict");

const {
  deriveSongFamiliarity,
  sortSongMemoryHistory,
} = require("./song-memory");

function submission(overrides) {
  return {
    id: overrides.id,
    roundId: overrides.roundId,
    roundSequenceNumber: overrides.roundSequenceNumber ?? overrides.roundId,
    songId: overrides.songId,
    playerId: overrides.playerId,
    playerName: overrides.playerName,
    createdAt: overrides.createdAt ?? null,
    roundOccurredAt: overrides.roundOccurredAt ?? null,
  };
}

function derive(overrides) {
  return deriveSongFamiliarity({
    songId: 10,
    artistId: 20,
    originRoundId: 2,
    originSubmissionId: 200,
    exactSongSubmissions: [],
    artistSubmissions: [],
    ...overrides,
  });
}

test("derives a debut when no prior exact song or same-artist history exists", () => {
  const verdict = derive({
    exactSongSubmissions: [
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        createdAt: "2024-01-08T18:00:00.000Z",
        roundOccurredAt: "2024-01-08T19:00:00.000Z",
      }),
    ],
    artistSubmissions: [
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        createdAt: "2024-01-08T18:00:00.000Z",
        roundOccurredAt: "2024-01-08T19:00:00.000Z",
      }),
    ],
  });

  assert.equal(verdict.kind, "debut");
  assert.equal(verdict.label, "New to us");
  assert.equal(verdict.exactSongSubmissionCount, 1);
  assert.equal(verdict.priorExactSongSubmissionCount, 0);
  assert.equal(verdict.priorArtistSubmissionCount, 0);
  assert.equal(verdict.priorArtistSongCount, 0);
  assert.deepEqual(verdict.throughSubmitters, []);
});

test("derives known artist from prior same-artist submissions for other songs", () => {
  const verdict = derive({
    exactSongSubmissions: [
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
    artistSubmissions: [
      submission({
        id: 100,
        roundId: 1,
        songId: 11,
        playerId: 2,
        playerName: "Prior Pat",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 101,
        roundId: 1,
        songId: 12,
        playerId: 3,
        playerName: "Earlier Eli",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
  });

  assert.equal(verdict.kind, "known-artist");
  assert.equal(verdict.label, "Known artist");
  assert.equal(verdict.priorExactSongSubmissionCount, 0);
  assert.equal(verdict.priorArtistSubmissionCount, 2);
  assert.equal(verdict.priorArtistSongCount, 2);
  assert.deepEqual(verdict.throughSubmitters, [
    { id: 2, displayName: "Prior Pat" },
    { id: 3, displayName: "Earlier Eli" },
  ]);
});

test("derives brought back from prior exact-song history", () => {
  const verdict = derive({
    exactSongSubmissions: [
      submission({
        id: 100,
        roundId: 1,
        songId: 10,
        playerId: 2,
        playerName: "Prior Pat",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
    artistSubmissions: [
      submission({
        id: 100,
        roundId: 1,
        songId: 10,
        playerId: 2,
        playerName: "Prior Pat",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
  });

  assert.equal(verdict.kind, "brought-back");
  assert.equal(verdict.label, "Brought back");
  assert.equal(verdict.exactSongSubmissionCount, 2);
  assert.equal(verdict.priorExactSongSubmissionCount, 1);
  assert.deepEqual(verdict.throughSubmitters, [{ id: 2, displayName: "Prior Pat" }]);
});

test("prior exact-song history outranks artist-only familiarity", () => {
  const verdict = derive({
    exactSongSubmissions: [
      submission({
        id: 100,
        roundId: 1,
        songId: 10,
        playerId: 2,
        playerName: "Prior Pat",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
    artistSubmissions: [
      submission({
        id: 90,
        roundId: 1,
        songId: 12,
        playerId: 3,
        playerName: "Earlier Eli",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 100,
        roundId: 1,
        songId: 10,
        playerId: 2,
        playerName: "Prior Pat",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
  });

  assert.equal(verdict.kind, "brought-back");
  assert.equal(verdict.priorExactSongSubmissionCount, 1);
  assert.equal(verdict.priorArtistSubmissionCount, 1);
  assert.equal(verdict.priorArtistSongCount, 1);
});

test("artist-only prior counts exclude the opened canonical song", () => {
  const verdict = derive({
    exactSongSubmissions: [
      submission({
        id: 100,
        roundId: 1,
        songId: 10,
        playerId: 2,
        playerName: "Prior Pat",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
    artistSubmissions: [
      submission({
        id: 100,
        roundId: 1,
        songId: 10,
        playerId: 2,
        playerName: "Prior Pat",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
  });

  assert.equal(verdict.kind, "brought-back");
  assert.equal(verdict.priorArtistSubmissionCount, 0);
  assert.equal(verdict.priorArtistSongCount, 0);
});

test("same-round co-occurrence alone does not create prior familiarity", () => {
  const verdict = derive({
    exactSongSubmissions: [
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        createdAt: "2024-02-01T19:05:00.000Z",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
    artistSubmissions: [
      submission({
        id: 199,
        roundId: 2,
        songId: 11,
        playerId: 2,
        playerName: "Same Round Sam",
        createdAt: "2024-02-01T19:00:00.000Z",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        createdAt: "2024-02-01T19:05:00.000Z",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
  });

  assert.equal(verdict.kind, "debut");
  assert.equal(verdict.priorArtistSubmissionCount, 0);
});

test("same-round exact-song duplicates share the representative origin verdict", () => {
  const exactSongSubmissions = [
    submission({
      id: 199,
      roundId: 2,
      songId: 10,
      playerId: 2,
      playerName: "Same Round Sam",
      createdAt: "2024-02-01T19:00:00.000Z",
      roundOccurredAt: "2024-02-01T19:00:00.000Z",
    }),
    submission({
      id: 200,
      roundId: 2,
      songId: 10,
      playerId: 1,
      playerName: "Origin Olive",
      createdAt: "2024-02-01T19:05:00.000Z",
      roundOccurredAt: "2024-02-01T19:00:00.000Z",
    }),
  ];
  const artistSubmissions = [...exactSongSubmissions];

  const fromRoundDetail = derive({
    originSubmissionId: 199,
    exactSongSubmissions,
    artistSubmissions,
  });
  const fromPlayerHistory = derive({
    originSubmissionId: 200,
    exactSongSubmissions,
    artistSubmissions,
  });

  assert.equal(fromRoundDetail.kind, "debut");
  assert.equal(fromRoundDetail.priorExactSongSubmissionCount, 0);
  assert.equal(fromRoundDetail.exactSongSubmissionCount, 2);
  assert.deepEqual(fromPlayerHistory, fromRoundDetail);
});

test("orders sparse history by round date, sequence, round, submission date, and id", () => {
  const orderedIds = sortSongMemoryHistory([
    submission({ id: 5, roundId: 3, songId: 10, playerId: 1, playerName: "A" }),
    submission({
      id: 3,
      roundId: 2,
      roundSequenceNumber: null,
      songId: 10,
      playerId: 1,
      playerName: "A",
      createdAt: null,
      roundOccurredAt: "2024-01-01T19:00:00.000Z",
    }),
    submission({
      id: 2,
      roundId: 2,
      roundSequenceNumber: 2,
      songId: 10,
      playerId: 1,
      playerName: "A",
      createdAt: null,
      roundOccurredAt: "2024-01-01T19:00:00.000Z",
    }),
    submission({
      id: 1,
      roundId: 1,
      roundSequenceNumber: 1,
      songId: 10,
      playerId: 1,
      playerName: "A",
      createdAt: "2024-01-01T18:00:00.000Z",
      roundOccurredAt: "2024-01-01T19:00:00.000Z",
    }),
    submission({
      id: 4,
      roundId: 2,
      roundSequenceNumber: 2,
      songId: 10,
      playerId: 1,
      playerName: "A",
      createdAt: "2024-01-01T18:30:00.000Z",
      roundOccurredAt: "2024-01-01T19:00:00.000Z",
    }),
  ]).map((row) => row.id);

  assert.deepEqual(orderedIds, [1, 4, 2, 3, 5]);
});

test("uses fallback archive counts when no single origin round is available", () => {
  const verdict = derive({
    originRoundId: null,
    originSubmissionId: null,
    exactSongSubmissions: [
      submission({
        id: 100,
        roundId: 1,
        songId: 10,
        playerId: 2,
        playerName: "Prior Pat",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
      submission({
        id: 200,
        roundId: 2,
        songId: 10,
        playerId: 1,
        playerName: "Origin Olive",
        roundOccurredAt: "2024-02-01T19:00:00.000Z",
      }),
    ],
    artistSubmissions: [
      submission({
        id: 50,
        roundId: 1,
        songId: 11,
        playerId: 3,
        playerName: "Earlier Eli",
        roundOccurredAt: "2024-01-01T19:00:00.000Z",
      }),
    ],
  });

  assert.equal(verdict.kind, "brought-back");
  assert.equal(verdict.priorExactSongSubmissionCount, 1);
  assert.equal(verdict.priorArtistSubmissionCount, 1);
});
