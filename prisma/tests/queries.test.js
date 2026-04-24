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
let task02FixtureCounter = 0;
let task04CoverageFixtureCounter = 0;

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

async function createTask02SameRoundArtistFixture() {
  task02FixtureCounter += 1;

  const suffix = `task-02-fixture-${task02FixtureCounter}`;
  const game = await prisma.game.create({
    data: {
      sourceGameId: suffix,
      displayName: `Task 02 Fixture ${task02FixtureCounter}`,
    },
  });
  const artist = await prisma.artist.create({
    data: {
      name: `Task 02 Artist ${task02FixtureCounter}`,
      normalizedName: `task-02-artist-${task02FixtureCounter}`,
    },
  });
  const firstPlayer = await prisma.player.create({
    data: {
      displayName: `Task 02 First Player ${task02FixtureCounter}`,
      normalizedName: `task-02-first-player-${task02FixtureCounter}`,
      sourcePlayerId: `task-02-first-player-${task02FixtureCounter}`,
    },
  });
  const secondPlayer = await prisma.player.create({
    data: {
      displayName: `Task 02 Second Player ${task02FixtureCounter}`,
      normalizedName: `task-02-second-player-${task02FixtureCounter}`,
      sourcePlayerId: `task-02-second-player-${task02FixtureCounter}`,
    },
  });
  const firstSong = await prisma.song.create({
    data: {
      title: `Task 02 First Song ${task02FixtureCounter}`,
      normalizedTitle: `task-02-first-song-${task02FixtureCounter}`,
      spotifyUri: `spotify:track:task-02-first-${task02FixtureCounter}`,
      artistId: artist.id,
    },
  });
  const secondSong = await prisma.song.create({
    data: {
      title: `Task 02 Second Song ${task02FixtureCounter}`,
      normalizedTitle: `task-02-second-song-${task02FixtureCounter}`,
      spotifyUri: `spotify:track:task-02-second-${task02FixtureCounter}`,
      artistId: artist.id,
    },
  });
  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      leagueSlug: game.sourceGameId,
      sourceRoundId: suffix,
      name: `Task 02 Same Round ${task02FixtureCounter}`,
      sequenceNumber: 1,
      occurredAt: new Date("2024-04-01T19:00:00.000Z"),
    },
  });

  await prisma.submission.create({
    data: {
      roundId: round.id,
      playerId: firstPlayer.id,
      songId: firstSong.id,
      createdAt: new Date("2024-04-01T18:00:00.000Z"),
    },
  });
  await prisma.submission.create({
    data: {
      roundId: round.id,
      playerId: secondPlayer.id,
      songId: secondSong.id,
      createdAt: new Date("2024-04-01T18:05:00.000Z"),
    },
  });

  return {
    roundId: round.id,
  };
}

async function createTask02DuplicateSongFixture() {
  task02FixtureCounter += 1;

  const suffix = `task-02-duplicate-${task02FixtureCounter}`;
  const game = await prisma.game.create({
    data: {
      sourceGameId: suffix,
      displayName: `Task 02 Duplicate Fixture ${task02FixtureCounter}`,
    },
  });
  const artist = await prisma.artist.create({
    data: {
      name: `Task 02 Duplicate Artist ${task02FixtureCounter}`,
      normalizedName: `task-02-duplicate-artist-${task02FixtureCounter}`,
    },
  });
  const firstPlayer = await prisma.player.create({
    data: {
      displayName: `Task 02 Duplicate First ${task02FixtureCounter}`,
      normalizedName: `task-02-duplicate-first-${task02FixtureCounter}`,
      sourcePlayerId: `task-02-duplicate-first-${task02FixtureCounter}`,
    },
  });
  const secondPlayer = await prisma.player.create({
    data: {
      displayName: `Task 02 Duplicate Second ${task02FixtureCounter}`,
      normalizedName: `task-02-duplicate-second-${task02FixtureCounter}`,
      sourcePlayerId: `task-02-duplicate-second-${task02FixtureCounter}`,
    },
  });
  const song = await prisma.song.create({
    data: {
      title: `Task 02 Duplicate Song ${task02FixtureCounter}`,
      normalizedTitle: `task-02-duplicate-song-${task02FixtureCounter}`,
      spotifyUri: `spotify:track:task-02-duplicate-${task02FixtureCounter}`,
      artistId: artist.id,
    },
  });
  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      leagueSlug: game.sourceGameId,
      sourceRoundId: suffix,
      name: `Task 02 Duplicate Round ${task02FixtureCounter}`,
      sequenceNumber: 1,
      occurredAt: new Date("2024-04-08T19:00:00.000Z"),
    },
  });

  await prisma.submission.create({
    data: {
      roundId: round.id,
      playerId: firstPlayer.id,
      songId: song.id,
      createdAt: new Date("2024-04-08T18:05:00.000Z"),
    },
  });
  await prisma.submission.create({
    data: {
      roundId: round.id,
      playerId: secondPlayer.id,
      songId: song.id,
      createdAt: new Date("2024-04-08T18:10:00.000Z"),
    },
  });

  return {
    roundId: round.id,
    songId: song.id,
    representativeSubmitterName: firstPlayer.displayName,
  };
}

async function createTask04CoverageFixture() {
  task04CoverageFixtureCounter += 1;

  const suffix = `task-04-coverage-${task04CoverageFixtureCounter}`;
  const game = await prisma.game.create({
    data: {
      sourceGameId: `${suffix}-game`,
      displayName: `Task 04 Coverage ${task04CoverageFixtureCounter}`,
    },
  });
  const artist = await prisma.artist.create({
    data: {
      name: `Task 04 Coverage Artist ${task04CoverageFixtureCounter}`,
      normalizedName: `task04coverageartist${task04CoverageFixtureCounter}`,
    },
  });
  const [originRound, laterRound, finalRound, pendingRound] = await Promise.all([
    prisma.round.create({
      data: {
        gameId: game.id,
        leagueSlug: game.sourceGameId,
        sourceRoundId: `${suffix}-r1`,
        name: `Task 04 Origin ${task04CoverageFixtureCounter}`,
        sequenceNumber: 1,
        occurredAt: new Date("2024-04-01T19:00:00.000Z"),
      },
    }),
    prisma.round.create({
      data: {
        gameId: game.id,
        leagueSlug: game.sourceGameId,
        sourceRoundId: `${suffix}-r2`,
        name: `Task 04 Later ${task04CoverageFixtureCounter}`,
        sequenceNumber: 2,
        occurredAt: new Date("2024-04-08T19:00:00.000Z"),
      },
    }),
    prisma.round.create({
      data: {
        gameId: game.id,
        leagueSlug: game.sourceGameId,
        sourceRoundId: `${suffix}-r3`,
        name: `Task 04 Finale ${task04CoverageFixtureCounter}`,
        sequenceNumber: 3,
        occurredAt: new Date("2024-04-15T19:00:00.000Z"),
      },
    }),
    prisma.round.create({
      data: {
        gameId: game.id,
        leagueSlug: game.sourceGameId,
        sourceRoundId: `${suffix}-r4`,
        name: `Task 04 Pending ${task04CoverageFixtureCounter}`,
        sequenceNumber: 4,
        occurredAt: new Date("2024-04-22T19:00:00.000Z"),
      },
    }),
  ]);
  const [winRatePlayer, variancePlayer, topFinishPlayer, lowFinishPlayer, zeroPlayer] =
    await Promise.all([
      prisma.player.create({
        data: {
          displayName: `Win Rate Riley ${task04CoverageFixtureCounter}`,
          normalizedName: `winrateriley${task04CoverageFixtureCounter}`,
          sourcePlayerId: `${suffix}-win-rate`,
        },
      }),
      prisma.player.create({
        data: {
          displayName: `Variance Vega ${task04CoverageFixtureCounter}`,
          normalizedName: `variancevega${task04CoverageFixtureCounter}`,
          sourcePlayerId: `${suffix}-variance`,
        },
      }),
      prisma.player.create({
        data: {
          displayName: `Topline Tess ${task04CoverageFixtureCounter}`,
          normalizedName: `toplinetess${task04CoverageFixtureCounter}`,
          sourcePlayerId: `${suffix}-top-finish`,
        },
      }),
      prisma.player.create({
        data: {
          displayName: `Lowlight Lou ${task04CoverageFixtureCounter}`,
          normalizedName: `lowlightlou${task04CoverageFixtureCounter}`,
          sourcePlayerId: `${suffix}-low-finish`,
        },
      }),
      prisma.player.create({
        data: {
          displayName: `Zero Zara ${task04CoverageFixtureCounter}`,
          normalizedName: `zerozara${task04CoverageFixtureCounter}`,
          sourcePlayerId: `${suffix}-zero`,
        },
      }),
    ]);

  const songs = {};
  const songTitles = [
    "Win Rate Origin",
    "Win Rate Later",
    "Win Rate Finale",
    "Variance Origin",
    "Variance Later",
    "Variance Finale",
    "Top Finish Origin",
    "Low Finish Origin",
    "Low Finish Later",
    "Low Finish Finale",
    "Zero Origin",
    "Zero Pending",
  ];

  for (const [index, title] of songTitles.entries()) {
    const song = await prisma.song.create({
      data: {
        title: `${title} ${task04CoverageFixtureCounter}`,
        normalizedTitle: `${title.replace(/\s+/g, "").toLowerCase()}${task04CoverageFixtureCounter}`,
        artistId: artist.id,
        spotifyUri: `spotify:track:${suffix}-${index + 1}`,
      },
    });

    songs[title] = song;
  }

  const winRateOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: winRatePlayer.id,
      songId: songs["Win Rate Origin"].id,
      score: 20,
      rank: 1,
      comment: "Starts with a win.",
      createdAt: new Date("2024-03-29T18:00:00.000Z"),
    },
  });
  const varianceOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: variancePlayer.id,
      songId: songs["Variance Origin"].id,
      score: 14,
      rank: 3,
      comment: "The volatility starts low.",
      createdAt: new Date("2024-03-29T18:05:00.000Z"),
    },
  });
  const topFinishOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: topFinishPlayer.id,
      songId: songs["Top Finish Origin"].id,
      score: 18,
      rank: 2,
      comment: "Single scored runner-up.",
      createdAt: new Date("2024-03-29T18:10:00.000Z"),
    },
  });
  const lowFinishOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: lowFinishPlayer.id,
      songId: songs["Low Finish Origin"].id,
      score: 8,
      rank: 4,
      comment: "Starts at the bottom.",
      createdAt: new Date("2024-03-29T18:15:00.000Z"),
    },
  });
  const zeroOrigin = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: zeroPlayer.id,
      songId: songs["Zero Origin"].id,
      score: null,
      rank: null,
      comment: "Waiting on votes.",
      createdAt: new Date("2024-03-29T18:20:00.000Z"),
    },
  });
  const winRateLater = await prisma.submission.create({
    data: {
      roundId: laterRound.id,
      playerId: winRatePlayer.id,
      songId: songs["Win Rate Later"].id,
      score: 20,
      rank: 1,
      comment: "Wins again with the same score.",
      createdAt: new Date("2024-04-05T18:00:00.000Z"),
    },
  });
  const varianceLater = await prisma.submission.create({
    data: {
      roundId: laterRound.id,
      playerId: variancePlayer.id,
      songId: songs["Variance Later"].id,
      score: 16,
      rank: 2,
      comment: "A stable middle finish.",
      createdAt: new Date("2024-04-05T18:05:00.000Z"),
    },
  });
  const lowFinishLater = await prisma.submission.create({
    data: {
      roundId: laterRound.id,
      playerId: lowFinishPlayer.id,
      songId: songs["Low Finish Later"].id,
      score: 10,
      rank: 3,
      comment: "Still trailing the scored field.",
      createdAt: new Date("2024-04-05T18:10:00.000Z"),
    },
  });
  const winRateFinal = await prisma.submission.create({
    data: {
      roundId: finalRound.id,
      playerId: winRatePlayer.id,
      songId: songs["Win Rate Finale"].id,
      score: 20,
      rank: 2,
      comment: "A rare slip without losing the scoring profile.",
      createdAt: new Date("2024-04-12T18:00:00.000Z"),
    },
  });
  const varianceFinal = await prisma.submission.create({
    data: {
      roundId: finalRound.id,
      playerId: variancePlayer.id,
      songId: songs["Variance Finale"].id,
      score: 24,
      rank: 1,
      comment: "The ceiling shows up here.",
      createdAt: new Date("2024-04-12T18:05:00.000Z"),
    },
  });
  const lowFinishFinal = await prisma.submission.create({
    data: {
      roundId: finalRound.id,
      playerId: lowFinishPlayer.id,
      songId: songs["Low Finish Finale"].id,
      score: 9,
      rank: 3,
      comment: "And the floor stays familiar.",
      createdAt: new Date("2024-04-12T18:10:00.000Z"),
    },
  });
  const zeroPending = await prisma.submission.create({
    data: {
      roundId: pendingRound.id,
      playerId: zeroPlayer.id,
      songId: songs["Zero Pending"].id,
      score: null,
      rank: null,
      comment: "Still no score to work from.",
      createdAt: new Date("2024-04-19T18:00:00.000Z"),
    },
  });

  return {
    originRoundId: originRound.id,
    winRatePlayerId: winRatePlayer.id,
    variancePlayerId: variancePlayer.id,
    topFinishPlayerId: topFinishPlayer.id,
    lowFinishPlayerId: lowFinishPlayer.id,
    zeroPlayerId: zeroPlayer.id,
    winRateLaterSubmissionId: winRateLater.id,
    winRateFinalSubmissionId: winRateFinal.id,
    topFinishOriginSubmissionId: topFinishOrigin.id,
    zeroOriginSubmissionId: zeroOrigin.id,
    zeroPendingSubmissionId: zeroPending.id,
    scoredHistoryCounts: {
      winRate: 3,
      variance: 3,
      topFinish: 1,
      lowFinish: 3,
      zero: 0,
    },
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
          submission.song.familiarity.label === "New to us" &&
          submission.player.displayName.length > 0,
      ),
      "expected round detail submissions to include song, familiarity, and player labels",
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
    assert.deepEqual(
      round.submissions.map((submission) => submission.song.familiarity.label),
      ["Known artist", "Brought back", "Known artist", "Brought back"],
    );
    assert.match(round.highlights[0].value, /Awaiting votes/);
    assert.equal(await getRoundDetail(999999, { prisma }), null);
  },
);

test(
  "round detail familiarity treats same-round same-artist co-occurrence as debut",
  { concurrency: false },
  async () => {
    const { roundId } = await createTask02SameRoundArtistFixture();
    const round = await getRoundDetail(roundId, { prisma });

    assert.ok(round);
    assert.deepEqual(
      round.submissions.map((submission) => submission.song.familiarity.kind),
      ["debut", "debut"],
    );
    assert.ok(
      round.submissions.every(
        (submission) =>
          submission.song.familiarity.priorArtistSubmissionCount === 0 &&
          submission.song.familiarity.exactSongSubmissionCount === 1,
      ),
    );
  },
);

test(
  "song modal loader stays scoped to the open round",
  { concurrency: false },
  async () => {
    const roundOneId = await findRoundIdBySourceId("seed-r1");
    const roundThreeId = await findRoundIdBySourceId("seed-r3");
    const songId = await findSongIdBySpotifyUri("spotify:track:seed-song-005");
    const round = await getRoundDetail(roundThreeId, { prisma });
    const modal = await getSongRoundModal(roundThreeId, songId, { prisma });

    assert.ok(round);
    const row = round.submissions.find((submission) => submission.song.id === songId);
    assert.ok(row);
    assert.ok(modal);
    assert.equal(modal.roundId, roundThreeId);
    assert.equal(modal.songId, songId);
    assert.equal(modal.title, "The Long Way Home");
    assert.equal(modal.artistName, "Solar Static");
    assert.equal(modal.submitterName, "Casey Chorus");
    assert.equal(modal.score, 21);
    assert.equal(modal.rank, 2);
    assert.equal(modal.familiarity.kind, row.song.familiarity.kind);
    assert.equal(modal.familiarity.label, row.song.familiarity.label);
    assert.equal(modal.familiarity.label, "Brought back");
    assert.equal(await getSongRoundModal(roundOneId, songId, { prisma }), null);
  },
);

test(
  "song modal familiarity matches round detail cues for duplicate same-round origins",
  { concurrency: false },
  async () => {
    const { roundId, songId, representativeSubmitterName } = await createTask02DuplicateSongFixture();
    const round = await getRoundDetail(roundId, { prisma });
    const modal = await getSongRoundModal(roundId, songId, { prisma });

    assert.ok(round);
    assert.ok(modal);
    assert.equal(modal.submitterName, representativeSubmitterName);
    assert.deepEqual(
      round.submissions.map((submission) => submission.song.familiarity.kind),
      ["debut", "debut"],
    );
    assert.ok(
      round.submissions.every(
        (submission) =>
          submission.song.id === songId &&
          submission.song.familiarity.kind === modal.familiarity.kind &&
          submission.song.familiarity.label === modal.familiarity.label,
      ),
    );
    assert.equal(modal.familiarity.exactSongSubmissionCount, 2);
    assert.equal(modal.familiarity.priorExactSongSubmissionCount, 0);
  },
);

test(
  "player-scoped song view familiarity matches round song modal for duplicate same-round origins",
  { concurrency: false },
  async () => {
    const { roundId, songId } = await createTask02DuplicateSongFixture();
    const round = await getRoundDetail(roundId, { prisma });
    const modal = await getSongRoundModal(roundId, songId, { prisma });

    assert.ok(round);
    assert.ok(modal);

    const row = round.submissions.find((submission) => submission.song.id === songId);
    assert.ok(row);

    const playerSubmission = await getPlayerModalSubmission(roundId, row.player.id, row.id, {
      prisma,
    });

    assert.ok(playerSubmission);
    assert.equal(playerSubmission.familiarity.kind, modal.familiarity.kind);
    assert.equal(playerSubmission.familiarity.label, modal.familiarity.label);
    assert.equal(playerSubmission.familiarity.shortSummary, modal.familiarity.shortSummary);
    assert.equal(playerSubmission.familiarity.exactSongSubmissionCount, 2);
    assert.equal(playerSubmission.familiarity.priorExactSongSubmissionCount, 0);
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
        scoredCount: 3,
        wins: 1,
        averageFinishPercentile: 0.35,
        scoreStdDev: 0.8,
        winRate: 1 / 3,
      },
      gameBaselines: {
        playerCount: 4,
        averageFinishPercentile: 0.45,
        scoreStdDev: 0.35,
        winRate: 0.25,
      },
    }),
    {
      kind: "variance",
      line: "Could be first, could be last. You never know.",
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
  "player modal integration coverage spans zero/single/multi-scored players, every trait branch, and notable-pick tiebreaks",
  { concurrency: false },
  async () => {
    const fixture = await createTask04CoverageFixture();
    const [winRateModal, varianceModal, topFinishModal, lowFinishModal, zeroModal] =
      await Promise.all([
        getPlayerRoundModal(fixture.originRoundId, fixture.winRatePlayerId, { prisma }),
        getPlayerRoundModal(fixture.originRoundId, fixture.variancePlayerId, { prisma }),
        getPlayerRoundModal(fixture.originRoundId, fixture.topFinishPlayerId, { prisma }),
        getPlayerRoundModal(fixture.originRoundId, fixture.lowFinishPlayerId, { prisma }),
        getPlayerRoundModal(fixture.originRoundId, fixture.zeroPlayerId, { prisma }),
      ]);

    assert.ok(winRateModal);
    assert.equal(winRateModal.traitKind, "win-rate");
    assert.equal(
      winRateModal.traitLine,
      "Wins more rounds than anyone likes to admit.",
    );
    assert.equal(winRateModal.history.length, fixture.scoredHistoryCounts.winRate);
    assert.equal(
      winRateModal.notablePicks.best?.submissionId,
      fixture.winRateLaterSubmissionId,
    );
    assert.equal(
      winRateModal.notablePicks.worst?.submissionId,
      fixture.winRateFinalSubmissionId,
    );

    assert.ok(varianceModal);
    assert.equal(varianceModal.traitKind, "variance");
    assert.equal(
      varianceModal.traitLine,
      "Could be first, could be last. You never know.",
    );
    assert.equal(varianceModal.history.length, fixture.scoredHistoryCounts.variance);

    assert.ok(topFinishModal);
    assert.equal(topFinishModal.traitKind, "top-finish");
    assert.equal(
      topFinishModal.traitLine,
      "Consistently near the top - plays it safe, plays it well.",
    );
    assert.equal(topFinishModal.history.length, fixture.scoredHistoryCounts.topFinish);
    assert.equal(
      topFinishModal.notablePicks.best?.submissionId,
      fixture.topFinishOriginSubmissionId,
    );
    assert.equal(topFinishModal.notablePicks.worst, null);

    assert.ok(lowFinishModal);
    assert.equal(lowFinishModal.traitKind, "low-finish");
    assert.equal(
      lowFinishModal.traitLine,
      "Bravely marches to their own drummer.",
    );
    assert.equal(lowFinishModal.history.length, fixture.scoredHistoryCounts.lowFinish);

    assert.ok(zeroModal);
    assert.equal(zeroModal.traitKind, null);
    assert.equal(zeroModal.traitLine, null);
    assert.equal(zeroModal.history.length, 2);
    assert.deepEqual(zeroModal.notablePicks, {
      best: null,
      worst: null,
    });
    assert.deepEqual(
      zeroModal.history.map((submission) => submission.submissionId),
      [fixture.zeroPendingSubmissionId, fixture.zeroOriginSubmissionId],
    );
  },
);

test(
  "player modal submission loader stays player-scoped within the origin game",
  { concurrency: false },
  async () => {
    const fixture = await createTask01Fixture();
    const activeSubmission = await getPlayerModalSubmission(
      fixture.originRoundId,
      fixture.aceId,
      fixture.aceLaterSubmissionId,
      { prisma },
    );

    assert.ok(activeSubmission);
    assert.equal(activeSubmission.originRoundId, fixture.originRoundId);
    assert.equal(activeSubmission.playerId, fixture.aceId);
    assert.equal(activeSubmission.submissionId, fixture.aceLaterSubmissionId);
    assert.equal(activeSubmission.playerName, "Ace Aurora 2");
    assert.equal(activeSubmission.roundId, fixture.laterRoundId);
    assert.equal(activeSubmission.roundName, "Second Spin");
    assert.equal(activeSubmission.title, "Later Glow 2");
    assert.equal(activeSubmission.artistName, "Task 01 Artist 2");
    assert.equal(activeSubmission.rank, 1);
    assert.equal(activeSubmission.score, 27);
    assert.equal(activeSubmission.comment, "Won again in the follow-up round.");
    assert.equal(activeSubmission.familiarity.kind, "known-artist");
    assert.equal(activeSubmission.familiarity.label, "Known artist");
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
