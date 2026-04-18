const test = require("node:test");
const assert = require("node:assert/strict");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");
const {
  buildArchiveHref,
  derivePlayerTrait,
  getPlayerModalSubmission,
  getPlayerRoundModal,
  getRoundDetail,
  getSongRoundModal,
  listArchiveGames,
  selectPlayerNotablePicks,
} = require("../../src/archive/archive-utils");

const { prisma, cleanup } = createTempPrismaDb({
  prefix: "music-league-queries-",
  filename: "queries.sqlite",
  seed: true,
});

let task01FixtureCounter = 0;

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

async function createTask01Fixture() {
  task01FixtureCounter += 1;

  const suffix = `task-01-fixture-${task01FixtureCounter}`;
  const [originRound, laterRound, foreignRound] = await Promise.all([
    prisma.round.findFirst({
      where: {
        sourceRoundId: "seed-r1",
      },
      select: {
        id: true,
        gameId: true,
        name: true,
      },
    }),
    prisma.round.findFirst({
      where: {
        sourceRoundId: "seed-r2",
      },
      select: {
        id: true,
        gameId: true,
        name: true,
      },
    }),
    prisma.round.findFirst({
      where: {
        sourceRoundId: "seed-r3",
      },
      select: {
        id: true,
        gameId: true,
        name: true,
      },
    }),
  ]);

  assert.ok(originRound, "expected seeded origin round to exist");
  assert.ok(laterRound, "expected seeded later round to exist");
  assert.ok(foreignRound, "expected seeded foreign round to exist");

  const artist = await prisma.artist.create({
    data: {
      name: `Task 01 Artist ${task01FixtureCounter}`,
      normalizedName: `task01artist${task01FixtureCounter}`,
    },
  });

  const [ace, steady, rough, zero, outsider] = await Promise.all([
    prisma.player.create({
      data: {
        displayName: `Ace Aurora ${task01FixtureCounter}`,
        normalizedName: `aceaurora${task01FixtureCounter}`,
        sourcePlayerId: `${suffix}-ace`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Steady Signal ${task01FixtureCounter}`,
        normalizedName: `steadysignal${task01FixtureCounter}`,
        sourcePlayerId: `${suffix}-steady`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Rough Relay ${task01FixtureCounter}`,
        normalizedName: `roughrelay${task01FixtureCounter}`,
        sourcePlayerId: `${suffix}-rough`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Zero Zenith ${task01FixtureCounter}`,
        normalizedName: `zerozenith${task01FixtureCounter}`,
        sourcePlayerId: `${suffix}-zero`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Outside Orbit ${task01FixtureCounter}`,
        normalizedName: `outsideorbit${task01FixtureCounter}`,
        sourcePlayerId: `${suffix}-outsider`,
      },
    }),
  ]);

  const songTitles = [
    "Origin Flash",
    "Later Glow",
    "Steady Steps",
    "Steady Return",
    "Rough Start",
    "Rough Landing",
    "Zero Hour",
    "Zero Hour Again",
    "Foreign Signal",
  ];
  const songs = {};

  for (const [index, title] of songTitles.entries()) {
    const song = await prisma.song.create({
      data: {
        title: `${title} ${task01FixtureCounter}`,
        normalizedTitle: `${title.replace(/\s+/g, "").toLowerCase()}${task01FixtureCounter}`,
        artistId: artist.id,
        spotifyUri: `spotify:track:${suffix}-${index + 1}`,
      },
    });

    songs[title] = song;
  }

  const aceOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: ace.id,
      songId: songs["Origin Flash"].id,
      score: 30,
      rank: 1,
      comment: "Origin-round winner.",
      createdAt: new Date("2024-01-08T18:00:00.000Z"),
    },
  });
  const steadyOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: steady.id,
      songId: songs["Steady Steps"].id,
      score: 22,
      rank: 2,
      comment: "Reliable runner-up.",
      createdAt: new Date("2024-01-08T18:05:00.000Z"),
    },
  });
  const roughOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: rough.id,
      songId: songs["Rough Start"].id,
      score: 14,
      rank: 3,
      comment: "A rough first pass.",
      createdAt: new Date("2024-01-08T18:10:00.000Z"),
    },
  });
  const zeroOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: zero.id,
      songId: songs["Zero Hour"].id,
      score: null,
      rank: null,
      comment: "Still waiting on votes.",
      createdAt: new Date("2024-01-08T18:15:00.000Z"),
    },
  });

  const aceLater = await prisma.submission.create({
    data: {
      roundId: laterRound.id,
      playerId: ace.id,
      songId: songs["Later Glow"].id,
      score: 27,
      rank: 1,
      comment: "Won again in the follow-up round.",
      createdAt: new Date("2024-02-08T18:00:00.000Z"),
    },
  });
  const steadyLater = await prisma.submission.create({
    data: {
      roundId: laterRound.id,
      playerId: steady.id,
      songId: songs["Steady Return"].id,
      score: 24,
      rank: 2,
      comment: "Another solid finish.",
      createdAt: new Date("2024-02-08T18:05:00.000Z"),
    },
  });
  const roughLater = await prisma.submission.create({
    data: {
      roundId: laterRound.id,
      playerId: rough.id,
      songId: songs["Rough Landing"].id,
      score: 9,
      rank: 3,
      comment: "A tough landing.",
      createdAt: new Date("2024-02-08T18:10:00.000Z"),
    },
  });
  const zeroLater = await prisma.submission.create({
    data: {
      roundId: laterRound.id,
      playerId: zero.id,
      songId: songs["Zero Hour Again"].id,
      score: null,
      rank: null,
      comment: "Another pending pick.",
      createdAt: new Date("2024-02-08T18:15:00.000Z"),
    },
  });
  const aceForeign = await prisma.submission.create({
    data: {
      roundId: foreignRound.id,
      playerId: ace.id,
      songId: songs["Foreign Signal"].id,
      score: 31,
      rank: 1,
      comment: "Should stay out of origin-game history.",
      createdAt: new Date("2024-03-09T18:00:00.000Z"),
    },
  });
  const outsiderForeign = await prisma.submission.create({
    data: {
      roundId: foreignRound.id,
      playerId: outsider.id,
      songId: songs["Steady Steps"].id,
      score: 20,
      rank: 2,
      comment: "Outside the origin game.",
      createdAt: new Date("2024-03-09T18:05:00.000Z"),
    },
  });

  return {
    gameId: originRound.gameId,
    otherGameId: foreignRound.gameId,
    originRoundId: originRound.id,
    laterRoundId: laterRound.id,
    foreignRoundId: foreignRound.id,
    aceId: ace.id,
    steadyId: steady.id,
    zeroId: zero.id,
    outsiderId: outsider.id,
    aceOriginSubmissionId: aceOrigin.id,
    aceLaterSubmissionId: aceLater.id,
    steadyLaterSubmissionId: steadyLater.id,
    aceForeignSubmissionId: aceForeign.id,
    zeroOriginSubmissionId: zeroOrigin.id,
    zeroLaterSubmissionId: zeroLater.id,
  };
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

    const modal = await getPlayerRoundModal(roundThreeId, player.id, { prisma });

    assert.ok(modal);
    assert.equal(modal.originRoundId, roundThreeId);
    assert.equal(modal.playerId, player.id);
    assert.equal(modal.displayName, "Elena Echo");
    assert.equal(modal.songTitle, "Late Bloom");
    assert.equal(modal.artistName, "Aurora Static");
    assert.equal(modal.score, null);
    assert.equal(modal.rank, null);
    assert.equal(modal.traitLine, null);
    assert.equal(modal.traitKind, null);
    assert.deepEqual(modal.notablePicks, {
      best: null,
      worst: null,
    });
    assert.deepEqual(
      modal.history.map((submission) => submission.song.title),
      ["Late Bloom"],
    );
    assert.equal(await getPlayerRoundModal(roundOneId, player.id, { prisma }), null);
  },
);

test("derivePlayerTrait follows the dominance and fallback rules", () => {
  assert.equal(
    derivePlayerTrait({
      playerMetrics: {
        scoredCount: 0,
        wins: 0,
        averageFinishPercentile: 0,
        scoreStdDev: 0,
        winRate: 0,
      },
      gameBaselines: {
        playerCount: 3,
        averageFinishPercentile: 0.5,
        scoreStdDev: 0.3,
        winRate: 0.25,
      },
    }),
    null,
  );

  assert.deepEqual(
    derivePlayerTrait({
      playerMetrics: {
        scoredCount: 4,
        wins: 2,
        averageFinishPercentile: 0.4,
        scoreStdDev: 0.75,
        winRate: 0.75,
      },
      gameBaselines: {
        playerCount: 4,
        averageFinishPercentile: 0.4,
        scoreStdDev: 0.5,
        winRate: 0.5,
      },
    }),
    {
      kind: "win-rate",
      line: "Wins more rounds than anyone likes to admit.",
    },
  );

  assert.deepEqual(
    derivePlayerTrait({
      playerMetrics: {
        scoredCount: 1,
        wins: 0,
        averageFinishPercentile: 0.25,
        scoreStdDev: 0,
        winRate: 0,
      },
      gameBaselines: {
        playerCount: 4,
        averageFinishPercentile: 0.25,
        scoreStdDev: 0.2,
        winRate: 0.1,
      },
    }),
    {
      kind: "top-finish",
      line: "Consistently near the top - plays it safe, plays it well.",
    },
  );

  assert.deepEqual(
    derivePlayerTrait({
      playerMetrics: {
        scoredCount: 1,
        wins: 0,
        averageFinishPercentile: 0.8,
        scoreStdDev: 0,
        winRate: 0,
      },
      gameBaselines: {
        playerCount: 4,
        averageFinishPercentile: 0.3,
        scoreStdDev: 0.2,
        winRate: 0.1,
      },
    }),
    {
      kind: "low-finish",
      line: "Bravely marches to their own drummer.",
    },
  );
});

test("selectPlayerNotablePicks sorts deterministically and omits duplicate worst picks", () => {
  const scoredHistory = [
    {
      submissionId: 10,
      roundId: 1,
      roundName: "Round One",
      occurredAt: "2024-01-01T00:00:00.000Z",
      song: {
        id: 101,
        title: "Alpha",
        artistName: "Artist",
      },
      score: 28,
      rank: 1,
      comment: "Best score",
    },
    {
      submissionId: 11,
      roundId: 2,
      roundName: "Round Two",
      occurredAt: "2024-02-01T00:00:00.000Z",
      song: {
        id: 102,
        title: "Beta",
        artistName: "Artist",
      },
      score: 28,
      rank: 1,
      comment: "Same rank and score, later round wins tie",
    },
    {
      submissionId: 12,
      roundId: 3,
      roundName: "Round Three",
      occurredAt: null,
      song: {
        id: 103,
        title: "Gamma",
        artistName: "Artist",
      },
      score: 10,
      rank: 3,
      comment: "Worst result",
    },
  ];

  assert.deepEqual(selectPlayerNotablePicks(scoredHistory), {
    best: scoredHistory[1],
    worst: scoredHistory[2],
  });
  assert.deepEqual(selectPlayerNotablePicks([scoredHistory[0]]), {
    best: scoredHistory[0],
    worst: null,
  });
});

test(
  "player modal loader returns origin-game history, trait data, and notable picks",
  { concurrency: false },
  async () => {
    const fixture = await createTask01Fixture();
    const modal = await getPlayerRoundModal(fixture.originRoundId, fixture.aceId, { prisma });

    assert.ok(modal);
    assert.equal(modal.originRoundId, fixture.originRoundId);
    assert.equal(modal.originGameId, fixture.gameId);
    assert.equal(modal.playerId, fixture.aceId);
    assert.equal(modal.displayName, "Ace Aurora 1");
    assert.ok(modal.traitLine);
    assert.ok(["top-finish", "win-rate", "variance", "low-finish"].includes(modal.traitKind));
    assert.deepEqual(
      modal.history.map((submission) => submission.submissionId),
      [fixture.aceLaterSubmissionId, fixture.aceOriginSubmissionId],
    );
    assert.deepEqual(
      modal.history.map((submission) => submission.roundId),
      [fixture.laterRoundId, fixture.originRoundId],
    );
    assert.equal(modal.notablePicks.best?.submissionId, fixture.aceOriginSubmissionId);
    assert.equal(modal.notablePicks.worst?.submissionId, fixture.aceLaterSubmissionId);
    assert.equal(
      modal.history.some((submission) => submission.roundId === fixture.foreignRoundId),
      false,
    );

    const zeroModal = await getPlayerRoundModal(fixture.originRoundId, fixture.zeroId, { prisma });

    assert.ok(zeroModal);
    assert.equal(zeroModal.traitLine, null);
    assert.equal(zeroModal.traitKind, null);
    assert.deepEqual(zeroModal.notablePicks, {
      best: null,
      worst: null,
    });
    assert.deepEqual(
      zeroModal.history.map((submission) => submission.submissionId),
      [fixture.zeroLaterSubmissionId, fixture.zeroOriginSubmissionId],
    );
    assert.equal(await getPlayerRoundModal(fixture.originRoundId, fixture.outsiderId, { prisma }), null);
  },
);

test(
  "player modal submission loader stays player-scoped within the origin game",
  { concurrency: false },
  async () => {
    const fixture = await createTask01Fixture();

    assert.deepEqual(
      await getPlayerModalSubmission(
        fixture.originRoundId,
        fixture.aceId,
        fixture.aceLaterSubmissionId,
        { prisma },
      ),
      {
        originRoundId: fixture.originRoundId,
        playerId: fixture.aceId,
        submissionId: fixture.aceLaterSubmissionId,
        playerName: "Ace Aurora 2",
        roundId: fixture.laterRoundId,
        roundName: "Second Spin",
        title: "Later Glow 2",
        artistName: "Task 01 Artist 2",
        rank: 1,
        score: 27,
        comment: "Won again in the follow-up round.",
      },
    );
    assert.equal(
      await getPlayerModalSubmission(
        fixture.originRoundId,
        fixture.aceId,
        fixture.steadyLaterSubmissionId,
        { prisma },
      ),
      null,
    );
    assert.equal(
      await getPlayerModalSubmission(
        fixture.originRoundId,
        fixture.aceId,
        fixture.aceForeignSubmissionId,
        { prisma },
      ),
      null,
    );
    assert.equal(
      await getPlayerModalSubmission(
        fixture.originRoundId,
        fixture.outsiderId,
        fixture.aceLaterSubmissionId,
        { prisma },
      ),
      null,
    );
  },
);

test("archive href helper canonicalizes round-first URL state", () => {
  assert.equal(buildArchiveHref({}), "/");
  assert.equal(buildArchiveHref({ songId: 2, playerId: 3 }), "/");
  assert.equal(
    buildArchiveHref({ roundId: 5, songId: 2, playerId: 3 }),
    "/?round=5&player=3",
  );
  assert.equal(buildArchiveHref({ roundId: 5, playerId: 3 }), "/?round=5&player=3");
  assert.equal(
    buildArchiveHref({ roundId: 5, playerId: 3, playerSubmissionId: 9 }),
    "/?round=5&player=3&playerSubmission=9",
  );
  assert.equal(buildArchiveHref({ roundId: 5, playerSubmissionId: 9 }), "/?round=5");
  assert.equal(buildArchiveHref({ roundId: 5, songId: 2 }), "/?round=5&song=2");
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
