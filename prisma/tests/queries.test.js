const test = require("node:test");
const assert = require("node:assert/strict");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");
const {
  buildArchiveHref,
  getPlayerRoundModal,
  getRoundDetail,
  getSongRoundModal,
  listArchiveGames,
} = require("../../src/archive/archive-utils");

const { prisma, cleanup } = createTempPrismaDb({
  prefix: "music-league-queries-",
  filename: "queries.sqlite",
  seed: true,
});

function assertNonEmptyArray(value, message) {
  assert.ok(Array.isArray(value), message);
  assert.ok(value.length > 0, message);
}

async function findRoundIdBySourceId(sourceRoundId) {
  const round = await prisma.round.findFirst({
    where: {
      sourceRoundId,
    },
    select: {
      id: true,
    },
  });

  assert.ok(round, `expected seeded round ${sourceRoundId} to exist`);
  return round.id;
}

async function findSongIdBySpotifyUri(spotifyUri) {
  const song = await prisma.song.findUnique({
    where: {
      spotifyUri,
    },
    select: {
      id: true,
    },
  });

  assert.ok(song, `expected seeded song ${spotifyUri} to exist`);
  return song.id;
}

async function findVoteTarget() {
  const vote = await prisma.vote.findFirst({
    select: {
      roundId: true,
      songId: true,
      voterId: true,
    },
  });

  assert.ok(vote, "expected seeded votes to exist");
  return vote;
}

test(
  "archive loader returns ordered round summaries with fallback labels",
  { concurrency: false },
  async () => {
    await prisma.game.create({
      data: {
        sourceGameId: "archived-game-id-123456789",
        displayName: "   ",
        rounds: {
          create: {
            leagueSlug: "archived-game-id-123456789",
            sourceRoundId: "seed-r-extra",
            name: "Machine Dreams",
            occurredAt: new Date("2024-04-11T19:00:00.000Z"),
          },
        },
      },
    });

    const archiveGames = await listArchiveGames({ prisma });

    assert.deepEqual(
      archiveGames.map((game) => game.sourceGameId),
      ["archived-game-id-123456789", "afterparty", "main"],
    );
    assert.deepEqual(
      archiveGames.map((game) => game.displayLabel),
      ["Game archived", "After Party League", "main"],
    );
    assert.deepEqual(
      archiveGames[1].rounds.map((round) => round.name),
      ["Wildcard Waltz", "Sunset Static"],
    );
    assert.deepEqual(
      archiveGames[2].rounds.map((round) => round.name),
      ["Opening Night", "Second Spin"],
    );
    assert.deepEqual(
      archiveGames[2].rounds.map((round) => ({
        submissionCount: round.submissionCount,
        winnerLabel: round.winnerLabel,
        statusLabel: round.statusLabel,
      })),
      [
        {
          submissionCount: 4,
          winnerLabel: "Tied winners",
          statusLabel: "scored",
        },
        {
          submissionCount: 4,
          winnerLabel: null,
          statusLabel: "pending",
        },
      ],
    );
  },
);

test(
  "round detail loader returns deterministic highlights and ordered submissions",
  { concurrency: false },
  async () => {
    const roundId = await findRoundIdBySourceId("seed-r1");
    const round = await getRoundDetail(roundId, { prisma });

    assert.ok(round);
    assert.equal(round.game.displayLabel, "main");
    assert.deepEqual(
      round.highlights.map((highlight) => highlight.kind),
      ["winner", "lowest", "anomaly"],
    );
    assert.equal(round.highlights[2].label, "Tie for first");
    assert.match(round.highlights[2].value, /24 points/);
    assert.deepEqual(
      round.submissions.map((submission) => submission.rank),
      [1, 1, 1, 2],
    );
    assert.ok(
      round.submissions.every(
        (submission) =>
          submission.song.artistName.length > 0 &&
          submission.player.displayName.length > 0,
      ),
      "expected round detail submissions to include song and player labels",
    );
  },
);

test(
  "round detail loader preserves pending rounds and returns null when a round is missing",
  { concurrency: false },
  async () => {
    const roundId = await findRoundIdBySourceId("seed-r2");
    const round = await getRoundDetail(roundId, { prisma });

    assert.ok(round);
    assert.deepEqual(
      round.highlights.map((highlight) => highlight.kind),
      ["anomaly"],
    );
    assert.ok(
      round.submissions.every(
        (submission) => submission.score === null && submission.rank === null,
      ),
      "expected pending round detail to preserve unscored submissions",
    );
    assert.match(round.highlights[0].value, /Awaiting votes/);
    assert.equal(await getRoundDetail(999999, { prisma }), null);
  },
);

test(
  "song modal loader stays scoped to the open round",
  { concurrency: false },
  async () => {
    const roundOneId = await findRoundIdBySourceId("seed-r1");
    const roundThreeId = await findRoundIdBySourceId("seed-r3");
    const songId = await findSongIdBySpotifyUri("spotify:track:seed-song-005");

    assert.deepEqual(
      await getSongRoundModal(roundThreeId, songId, { prisma }),
      {
        roundId: roundThreeId,
        songId,
        title: "The Long Way Home",
        artistName: "Solar Static",
        submitterName: "Casey Chorus",
        score: 21,
        rank: 2,
      },
    );
    assert.equal(await getSongRoundModal(roundOneId, songId, { prisma }), null);
  },
);

test(
  "player modal loader stays scoped to the open round",
  { concurrency: false },
  async () => {
    const roundOneId = await findRoundIdBySourceId("seed-r1");
    const roundThreeId = await findRoundIdBySourceId("seed-r3");
    const player = await prisma.player.create({
      data: {
        displayName: "Elena Echo",
        normalizedName: "elenaecho",
        sourcePlayerId: "task-04-player-elena",
      },
    });
    const artist = await prisma.artist.create({
      data: {
        name: "Aurora Static",
        normalizedName: "aurorastatic",
      },
    });
    const song = await prisma.song.create({
      data: {
        title: "Late Bloom",
        normalizedTitle: "latebloom",
        artistId: artist.id,
        spotifyUri: "spotify:track:task-04-player-scope",
      },
    });

    await prisma.submission.create({
      data: {
        roundId: roundThreeId,
        playerId: player.id,
        songId: song.id,
        comment: "Scoped modal fixture for TASK-04.",
      },
    });

    assert.deepEqual(
      await getPlayerRoundModal(roundThreeId, player.id, { prisma }),
      {
        roundId: roundThreeId,
        playerId: player.id,
        displayName: "Elena Echo",
        songTitle: "Late Bloom",
        artistName: "Aurora Static",
        score: null,
        rank: null,
      },
    );
    assert.equal(await getPlayerRoundModal(roundOneId, player.id, { prisma }), null);
  },
);

test("archive href helper canonicalizes round-first URL state", () => {
  assert.equal(buildArchiveHref({}), "/");
  assert.equal(buildArchiveHref({ songId: 2, playerId: 3 }), "/");
  assert.equal(
    buildArchiveHref({ roundId: 5, songId: 2, playerId: 3 }),
    "/?round=5&song=2",
  );
  assert.equal(buildArchiveHref({ roundId: 5, playerId: 3 }), "/?round=5&player=3");
  assert.equal(buildArchiveHref({ roundId: -1, playerId: 3 }), "/");
});

test(
  "overview artist aggregation query returns seeded submissions for app-layer grouping",
  { concurrency: false },
  async () => {
    const submissions = await prisma.submission.findMany({
      include: {
        song: {
          include: {
            artist: true,
          },
        },
      },
    });

    assertNonEmptyArray(
      submissions,
      "expected seeded submissions for most-submitted artist aggregation",
    );

    const countsByArtistId = submissions.reduce((counts, submission) => {
      const artistId = submission.song.artist.id;
      const current = counts.get(artistId);

      counts.set(artistId, {
        artist: submission.song.artist,
        count: (current?.count ?? 0) + 1,
      });

      return counts;
    }, new Map());

    const mostSubmittedArtist = [...countsByArtistId.values()].sort(
      (left, right) => right.count - left.count,
    )[0];

    assert.ok(mostSubmittedArtist);
    assert.ok(mostSubmittedArtist.count > 0);
  },
);

test(
  "overview player activity aggregation query groups seeded submissions by player",
  { concurrency: false },
  async () => {
    const groupedSubmissions = await prisma.submission.groupBy({
      by: ["playerId"],
      _count: {
        id: true,
      },
    });

    assertNonEmptyArray(
      groupedSubmissions,
      "expected seeded submission groups for most-active player aggregation",
    );
    assert.ok(
      groupedSubmissions.some((row) => row._count.id > 0),
      "expected grouped submissions to include at least one counted player",
    );
  },
);

test(
  "vote query by round and song returns seeded voters",
  { concurrency: false },
  async () => {
    const { roundId, songId } = await findVoteTarget();
    const votes = await prisma.vote.findMany({
      where: {
        roundId,
        songId,
      },
      include: {
        voter: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    assertNonEmptyArray(votes, "expected votes for a seeded round/song pair");
    assert.ok(
      votes.every((vote) => vote.voter),
      "expected vote query to include seeded voter details",
    );
  },
);

test(
  "vote query by voter returns seeded songs, artists, and rounds",
  { concurrency: false },
  async () => {
    const { voterId } = await findVoteTarget();
    const votes = await prisma.vote.findMany({
      where: {
        voterId,
      },
      include: {
        song: {
          include: {
            artist: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        round: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    assertNonEmptyArray(votes, "expected votes for a seeded voter");
    assert.ok(
      votes.every((vote) => vote.song && vote.song.artist && vote.round),
      "expected voter vote query to include song, artist, and round details",
    );
  },
);

test.after(async () => {
  await cleanup();
});
