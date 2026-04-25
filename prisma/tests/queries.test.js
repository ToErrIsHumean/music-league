const test = require("node:test");
const assert = require("node:assert/strict");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");
const {
  applySelectedGameRouteContext,
  buildArchiveHref,
  buildCanonicalSongMemoryHref,
  buildMemoryBoardEvidenceHref,
  deriveGameStandings,
  derivePlayerPerformanceMetrics,
  derivePlayerTrait,
  getPlayerModalSubmission,
  getPlayerRoundModal,
  getRoundDetail,
  getSelectedGameMemoryBoard,
  getSongMemoryModal,
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
let task01SameNameFixtureCounter = 0;
let task02FixtureCounter = 0;
let task03FixtureCounter = 0;
let task04CoverageFixtureCounter = 0;
let task06FixtureCounter = 0;

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

async function findRoundGameId(roundId) {
  const round = await prisma.round.findUnique({
    where: {
      id: roundId,
    },
    select: {
      gameId: true,
    },
  });

  assert.ok(round, `expected round ${roundId} to exist`);
  return round.gameId;
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

async function findGameIdBySourceId(sourceGameId) {
  const game = await prisma.game.findUnique({
    where: {
      sourceGameId,
    },
    select: {
      id: true,
    },
  });

  assert.ok(game, `expected seeded game ${sourceGameId} to exist`);
  return game.id;
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

  const firstSubmission = await prisma.submission.create({
    data: {
      roundId: round.id,
      playerId: firstPlayer.id,
      songId: song.id,
      createdAt: new Date("2024-04-08T18:05:00.000Z"),
    },
  });
  const secondSubmission = await prisma.submission.create({
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
    firstPlayerId: firstPlayer.id,
    secondPlayerId: secondPlayer.id,
    firstSubmissionId: firstSubmission.id,
    secondSubmissionId: secondSubmission.id,
    representativeSubmitterName: firstPlayer.displayName,
  };
}

async function createTask06VoteBreakdownFixture() {
  task06FixtureCounter += 1;

  const suffix = `task-06-vote-breakdown-${task06FixtureCounter}`;
  const game = await prisma.game.create({
    data: {
      sourceGameId: suffix,
      displayName: `Task 06 Vote Breakdown ${task06FixtureCounter}`,
    },
  });
  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      leagueSlug: game.sourceGameId,
      sourceRoundId: suffix,
      name: `Task 06 Vote Evidence ${task06FixtureCounter}`,
      sequenceNumber: 1,
      occurredAt: new Date("2024-08-01T19:00:00.000Z"),
    },
  });
  const artist = await prisma.artist.create({
    data: {
      name: `Task 06 Vote Artist ${task06FixtureCounter}`,
      normalizedName: `task06voteartist${task06FixtureCounter}`,
    },
  });
  const [targetSong, emptySong] = await Promise.all([
    prisma.song.create({
      data: {
        title: `Task 06 Voted Song ${task06FixtureCounter}`,
        normalizedTitle: `task06votedsong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-voted`,
        artistId: artist.id,
      },
    }),
    prisma.song.create({
      data: {
        title: `Task 06 Empty Song ${task06FixtureCounter}`,
        normalizedTitle: `task06emptysong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-empty`,
        artistId: artist.id,
      },
    }),
  ]);
  const [submitter, emptySubmitter, positiveVoter, negativeVoter] = await Promise.all([
    prisma.player.create({
      data: {
        displayName: `Task 06 Submitter ${task06FixtureCounter}`,
        normalizedName: `task06submitter${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-submitter`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Empty Submitter ${task06FixtureCounter}`,
        normalizedName: `task06emptysubmitter${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-empty-submitter`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Positive Voter ${task06FixtureCounter}`,
        normalizedName: `task06positivevoter${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-positive-voter`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Negative Voter ${task06FixtureCounter}`,
        normalizedName: `task06negativevoter${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-negative-voter`,
      },
    }),
  ]);
  const [targetSubmission, emptySubmission] = await Promise.all([
    prisma.submission.create({
      data: {
        roundId: round.id,
        playerId: submitter.id,
        songId: targetSong.id,
        score: 1,
        rank: 1,
        comment: "Submission comment stays separate.",
        createdAt: new Date("2024-08-01T18:00:00.000Z"),
      },
    }),
    prisma.submission.create({
      data: {
        roundId: round.id,
        playerId: emptySubmitter.id,
        songId: emptySong.id,
        score: null,
        rank: null,
        comment: null,
        createdAt: new Date("2024-08-01T18:05:00.000Z"),
      },
    }),
  ]);

  await prisma.vote.createMany({
    data: [
      {
        roundId: round.id,
        voterId: negativeVoter.id,
        songId: targetSong.id,
        pointsAssigned: -1,
        comment: "Downvote edge",
        votedAt: new Date("2024-08-02T09:05:00.000Z"),
      },
      {
        roundId: round.id,
        voterId: positiveVoter.id,
        songId: targetSong.id,
        pointsAssigned: 2,
        comment: "Positive edge",
        votedAt: new Date("2024-08-02T09:00:00.000Z"),
      },
    ],
  });

  return {
    roundId: round.id,
    targetSubmissionId: targetSubmission.id,
    emptySubmissionId: emptySubmission.id,
  };
}

async function createTask03SparseSongFixture() {
  task03FixtureCounter += 1;

  const suffix = `task-03-sparse-${task03FixtureCounter}`;
  const game = await prisma.game.create({
    data: {
      sourceGameId: suffix,
      displayName: `Task 03 Sparse ${task03FixtureCounter}`,
    },
  });
  const artist = await prisma.artist.create({
    data: {
      name: `Task 03 Sparse Artist ${task03FixtureCounter}`,
      normalizedName: `task03sparseartist${task03FixtureCounter}`,
    },
  });
  const player = await prisma.player.create({
    data: {
      displayName: `Task 03 Sparse Player ${task03FixtureCounter}`,
      normalizedName: `task03sparseplayer${task03FixtureCounter}`,
      sourcePlayerId: `${suffix}-player`,
    },
  });
  const song = await prisma.song.create({
    data: {
      title: `Task 03 Sparse Song ${task03FixtureCounter}`,
      normalizedTitle: `task03sparsesong${task03FixtureCounter}`,
      spotifyUri: `spotify:track:${suffix}`,
      artistId: artist.id,
    },
  });
  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      leagueSlug: game.sourceGameId,
      sourceRoundId: `${suffix}-round`,
      name: `Task 03 Sparse Round ${task03FixtureCounter}`,
      sequenceNumber: 1,
      occurredAt: new Date("2024-05-01T19:00:00.000Z"),
    },
  });
  const submission = await prisma.submission.create({
    data: {
      roundId: round.id,
      playerId: player.id,
      songId: song.id,
      score: null,
      rank: null,
      comment: null,
      createdAt: new Date("2024-05-01T18:00:00.000Z"),
    },
  });

  return {
    roundId: round.id,
    songId: song.id,
    submissionId: submission.id,
    playerId: player.id,
    playerName: player.displayName,
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

async function createTask06SongMemoryRegressionFixture() {
  task06FixtureCounter += 1;

  const suffix = `task-06-regression-${task06FixtureCounter}`;
  const [originGame, satelliteGame] = await Promise.all([
    prisma.game.create({
      data: {
        sourceGameId: `${suffix}-origin`,
        displayName: `Task 06 Origin ${task06FixtureCounter}`,
      },
    }),
    prisma.game.create({
      data: {
        sourceGameId: `${suffix}-satellite`,
        displayName: `Task 06 Satellite ${task06FixtureCounter}`,
      },
    }),
  ]);
  const [priorRound, originRound, satelliteRound] = await Promise.all([
    prisma.round.create({
      data: {
        gameId: originGame.id,
        leagueSlug: originGame.sourceGameId,
        sourceRoundId: `${suffix}-prior`,
        name: `Task 06 Prior ${task06FixtureCounter}`,
        sequenceNumber: 1,
        occurredAt: new Date("2024-06-01T19:00:00.000Z"),
      },
    }),
    prisma.round.create({
      data: {
        gameId: originGame.id,
        leagueSlug: originGame.sourceGameId,
        sourceRoundId: `${suffix}-origin-round`,
        name: `Task 06 Origin Round ${task06FixtureCounter}`,
        sequenceNumber: 2,
        occurredAt: new Date("2024-06-15T19:00:00.000Z"),
      },
    }),
    prisma.round.create({
      data: {
        gameId: satelliteGame.id,
        leagueSlug: satelliteGame.sourceGameId,
        sourceRoundId: `${suffix}-satellite-round`,
        name: `Task 06 Satellite Round ${task06FixtureCounter}`,
        sequenceNumber: 1,
        occurredAt: new Date("2024-07-01T19:00:00.000Z"),
      },
    }),
  ]);
  const [debutArtist, familiarArtist, repeatArtist, sparseArtist, staleArtist] =
    await Promise.all([
      prisma.artist.create({
        data: {
          name: `Task 06 Debut Artist ${task06FixtureCounter}`,
          normalizedName: `task06debutartist${task06FixtureCounter}`,
        },
      }),
      prisma.artist.create({
        data: {
          name: `Task 06 Familiar Artist ${task06FixtureCounter}`,
          normalizedName: `task06familiarartist${task06FixtureCounter}`,
        },
      }),
      prisma.artist.create({
        data: {
          name: `Task 06 Repeat Artist ${task06FixtureCounter}`,
          normalizedName: `task06repeatartist${task06FixtureCounter}`,
        },
      }),
      prisma.artist.create({
        data: {
          name: `Task 06 Sparse Artist ${task06FixtureCounter}`,
          normalizedName: `task06sparseartist${task06FixtureCounter}`,
        },
      }),
      prisma.artist.create({
        data: {
          name: `Task 06 Stale Artist ${task06FixtureCounter}`,
          normalizedName: `task06staleartist${task06FixtureCounter}`,
        },
      }),
    ]);
  const [
    debutPlayer,
    familiarPriorPlayer,
    familiarOriginPlayer,
    repeatPriorPlayer,
    repeatOriginPlayer,
    repeatRecentPlayer,
    repeatArtistPriorPlayer,
    sparsePlayer,
    stalePlayer,
  ] = await Promise.all([
    prisma.player.create({
      data: {
        displayName: `Task 06 Debut Player ${task06FixtureCounter}`,
        normalizedName: `task06debutplayer${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-debut-player`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Familiar Prior ${task06FixtureCounter}`,
        normalizedName: `task06familiarprior${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-familiar-prior`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Familiar Origin ${task06FixtureCounter}`,
        normalizedName: `task06familiarorigin${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-familiar-origin`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Repeat Prior ${task06FixtureCounter}`,
        normalizedName: `task06repeatprior${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-repeat-prior`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Repeat Origin ${task06FixtureCounter}`,
        normalizedName: `task06repeatorigin${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-repeat-origin`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Repeat Recent ${task06FixtureCounter}`,
        normalizedName: `task06repeatrecent${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-repeat-recent`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Repeat Artist Prior ${task06FixtureCounter}`,
        normalizedName: `task06repeatartistprior${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-repeat-artist-prior`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Sparse Player ${task06FixtureCounter}`,
        normalizedName: `task06sparseplayer${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-sparse-player`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `Task 06 Stale Player ${task06FixtureCounter}`,
        normalizedName: `task06staleplayer${task06FixtureCounter}`,
        sourcePlayerId: `${suffix}-stale-player`,
      },
    }),
  ]);
  const [
    debutSong,
    familiarPriorSong,
    familiarOriginSong,
    repeatSong,
    repeatArtistPriorSong,
    sparseSong,
    staleSong,
  ] = await Promise.all([
    prisma.song.create({
      data: {
        title: `Task 06 Debut Song ${task06FixtureCounter}`,
        normalizedTitle: `task06debutsong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-debut`,
        artistId: debutArtist.id,
      },
    }),
    prisma.song.create({
      data: {
        title: `Task 06 Familiar Prior Song ${task06FixtureCounter}`,
        normalizedTitle: `task06familiarpriorsong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-familiar-prior`,
        artistId: familiarArtist.id,
      },
    }),
    prisma.song.create({
      data: {
        title: `Task 06 Familiar Origin Song ${task06FixtureCounter}`,
        normalizedTitle: `task06familiaroriginsong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-familiar-origin`,
        artistId: familiarArtist.id,
      },
    }),
    prisma.song.create({
      data: {
        title: `Task 06 Repeat Song ${task06FixtureCounter}`,
        normalizedTitle: `task06repeatsong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-repeat`,
        artistId: repeatArtist.id,
      },
    }),
    prisma.song.create({
      data: {
        title: `Task 06 Repeat Artist Prior Song ${task06FixtureCounter}`,
        normalizedTitle: `task06repeatartistpriorsong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-repeat-artist-prior`,
        artistId: repeatArtist.id,
      },
    }),
    prisma.song.create({
      data: {
        title: `Task 06 Sparse Song ${task06FixtureCounter}`,
        normalizedTitle: `task06sparsesong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-sparse`,
        artistId: sparseArtist.id,
      },
    }),
    prisma.song.create({
      data: {
        title: `Task 06 Stale Song ${task06FixtureCounter}`,
        normalizedTitle: `task06stalesong${task06FixtureCounter}`,
        spotifyUri: `spotify:track:${suffix}-stale`,
        artistId: staleArtist.id,
      },
    }),
  ]);

  const familiarPriorSubmission = await prisma.submission.create({
    data: {
      roundId: priorRound.id,
      playerId: familiarPriorPlayer.id,
      songId: familiarPriorSong.id,
      score: 18,
      rank: 3,
      comment: "Earlier artist memory for the familiar origin song.",
      createdAt: new Date("2024-05-30T18:00:00.000Z"),
    },
  });
  const repeatPriorSubmission = await prisma.submission.create({
    data: {
      roundId: priorRound.id,
      playerId: repeatPriorPlayer.id,
      songId: repeatSong.id,
      score: 16,
      rank: 4,
      comment: "First exact-song appearance before the origin round.",
      createdAt: new Date("2024-05-30T18:05:00.000Z"),
    },
  });
  const repeatArtistPriorSubmission = await prisma.submission.create({
    data: {
      roundId: priorRound.id,
      playerId: repeatArtistPriorPlayer.id,
      songId: repeatArtistPriorSong.id,
      score: 25,
      rank: 1,
      comment: "Artist-only memory that must not enter exact-song history.",
      createdAt: new Date("2024-05-30T18:10:00.000Z"),
    },
  });
  await prisma.submission.create({
    data: {
      roundId: priorRound.id,
      playerId: stalePlayer.id,
      songId: staleSong.id,
      score: 11,
      rank: 5,
      comment: "A song that never appears in the origin round.",
      createdAt: new Date("2024-05-30T18:15:00.000Z"),
    },
  });
  const debutOriginSubmission = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: debutPlayer.id,
      songId: debutSong.id,
      score: 28,
      rank: 1,
      comment: "True debut with no prior artist memory.",
      createdAt: new Date("2024-06-13T18:00:00.000Z"),
    },
  });
  const familiarOriginSubmission = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: familiarOriginPlayer.id,
      songId: familiarOriginSong.id,
      score: 22,
      rank: 2,
      comment: "New exact song from a familiar artist.",
      createdAt: new Date("2024-06-13T18:05:00.000Z"),
    },
  });
  const repeatOriginSubmission = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: repeatOriginPlayer.id,
      songId: repeatSong.id,
      score: 19,
      rank: 3,
      comment: "Exact song returns in the route-visible origin round.",
      createdAt: new Date("2024-06-13T18:10:00.000Z"),
    },
  });
  const sparseOriginSubmission = await prisma.submission.create({
    data: {
      roundId: originRound.id,
      playerId: sparsePlayer.id,
      songId: sparseSong.id,
      score: null,
      rank: null,
      comment: null,
      createdAt: new Date("2024-06-13T18:15:00.000Z"),
    },
  });
  const repeatSatelliteSubmission = await prisma.submission.create({
    data: {
      roundId: satelliteRound.id,
      playerId: repeatRecentPlayer.id,
      songId: repeatSong.id,
      score: 30,
      rank: 1,
      comment: "Most recent cross-game exact-song appearance.",
      createdAt: new Date("2024-06-28T18:00:00.000Z"),
    },
  });

  return {
    originRoundId: originRound.id,
    satelliteRoundId: satelliteRound.id,
    originGameLabel: originGame.displayName,
    satelliteGameLabel: satelliteGame.displayName,
    debutSongId: debutSong.id,
    familiarSongId: familiarOriginSong.id,
    repeatSongId: repeatSong.id,
    sparseSongId: sparseSong.id,
    staleSongId: staleSong.id,
    debutOriginSubmissionId: debutOriginSubmission.id,
    familiarPriorSubmissionId: familiarPriorSubmission.id,
    familiarOriginSubmissionId: familiarOriginSubmission.id,
    repeatPriorSubmissionId: repeatPriorSubmission.id,
    repeatArtistPriorSubmissionId: repeatArtistPriorSubmission.id,
    repeatOriginSubmissionId: repeatOriginSubmission.id,
    repeatSatelliteSubmissionId: repeatSatelliteSubmission.id,
    sparseOriginSubmissionId: sparseOriginSubmission.id,
    debutPlayerId: debutPlayer.id,
    debutPlayerName: debutPlayer.displayName,
    familiarPriorPlayerName: familiarPriorPlayer.displayName,
    repeatPriorPlayerName: repeatPriorPlayer.displayName,
    repeatRecentPlayerName: repeatRecentPlayer.displayName,
    sparsePlayerId: sparsePlayer.id,
    sparsePlayerName: sparsePlayer.displayName,
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
  "archive loader keeps same-named rounds grouped under their parent games",
  { concurrency: false },
  async () => {
    task01SameNameFixtureCounter += 1;
    const suffix = `task-01-same-name-${task01SameNameFixtureCounter}`;
    const sharedRoundName = `Shared Theme ${task01SameNameFixtureCounter}`;

    await Promise.all([
      prisma.game.create({
        data: {
          sourceGameId: `${suffix}-alpha`,
          displayName: `Alpha Game ${task01SameNameFixtureCounter}`,
          rounds: {
            create: {
              leagueSlug: `${suffix}-alpha`,
              sourceRoundId: `${suffix}-round-alpha`,
              name: sharedRoundName,
              occurredAt: new Date("2024-05-01T18:00:00.000Z"),
            },
          },
        },
      }),
      prisma.game.create({
        data: {
          sourceGameId: `${suffix}-beta`,
          displayName: `Beta Game ${task01SameNameFixtureCounter}`,
          rounds: {
            create: {
              leagueSlug: `${suffix}-beta`,
              sourceRoundId: `${suffix}-round-beta`,
              name: sharedRoundName,
              occurredAt: new Date("2024-05-02T18:00:00.000Z"),
            },
          },
        },
      }),
    ]);

    const archiveGames = await listArchiveGames({ prisma });
    const alphaGame = archiveGames.find(
      (game) => game.sourceGameId === `${suffix}-alpha`,
    );
    const betaGame = archiveGames.find(
      (game) => game.sourceGameId === `${suffix}-beta`,
    );

    assert.ok(alphaGame, "expected alpha game in archive list");
    assert.ok(betaGame, "expected beta game in archive list");
    assert.deepEqual(
      alphaGame.rounds.map((round) => round.name),
      [sharedRoundName],
    );
    assert.deepEqual(
      betaGame.rounds.map((round) => round.name),
      [sharedRoundName],
    );
    assert.notEqual(alphaGame.id, betaGame.id);
  },
);

test("derived game standings total scoped scored submissions with dense ties", () => {
  const standings = deriveGameStandings([
    {
      playerId: 2,
      playerName: "Beta Bridge",
      roundId: 10,
      score: 10,
      rank: 2,
    },
    {
      playerId: 2,
      playerName: "Beta Bridge",
      roundId: 11,
      score: 7,
      rank: 1,
    },
    {
      playerId: 2,
      playerName: "Beta Bridge",
      roundId: 11,
      score: 3,
      rank: 3,
    },
    {
      playerId: 1,
      playerName: "Alpha Array",
      roundId: 10,
      score: 12,
      rank: 1,
    },
    {
      playerId: 1,
      playerName: "Alpha Array",
      roundId: 12,
      score: 8,
      rank: 2,
    },
    {
      playerId: 3,
      playerName: "Gamma Grid",
      roundId: 12,
      score: 5,
      rank: 3,
    },
    {
      playerId: 4,
      playerName: "Pending Pulse",
      roundId: 10,
      score: null,
      rank: null,
    },
    {
      playerId: 4,
      playerName: "Pending Pulse",
      roundId: 11,
      score: 40,
      rank: null,
    },
  ]);

  assert.deepEqual(standings, [
    {
      player: {
        id: 1,
        displayName: "Alpha Array",
      },
      totalScore: 20,
      scoredSubmissionCount: 2,
      scoredRoundCount: 2,
      rank: 1,
      tied: true,
    },
    {
      player: {
        id: 2,
        displayName: "Beta Bridge",
      },
      totalScore: 20,
      scoredSubmissionCount: 3,
      scoredRoundCount: 2,
      rank: 1,
      tied: true,
    },
    {
      player: {
        id: 3,
        displayName: "Gamma Grid",
      },
      totalScore: 5,
      scoredSubmissionCount: 1,
      scoredRoundCount: 1,
      rank: 2,
      tied: false,
    },
  ]);
});

test(
  "selected game memory board read model scopes recap projections to one game",
  { concurrency: false },
  async () => {
    const afterpartyGameId = await findGameIdBySourceId("afterparty");
    const recap = await getSelectedGameMemoryBoard(afterpartyGameId, { prisma });

    assert.ok(recap);
    const roundIds = new Set(recap.rounds.map((round) => round.id));

    assert.equal(recap.frame.displayLabel, "After Party League");
    assert.deepEqual(
      recap.rounds.map((round) => round.name),
      ["Wildcard Waltz", "Sunset Static"],
    );
    assert.equal(recap.submissions.length, 8);
    assert.equal(recap.votes.length, 12);
    assert.ok(
      recap.submissions.every((submission) => roundIds.has(submission.roundId)),
      "selected-game submissions must not include another game's rounds",
    );
    assert.ok(
      recap.votes.every((vote) => roundIds.has(vote.roundId)),
      "selected-game votes must not include another game's rounds",
    );
    assert.ok(
      recap.submissions.every(
        (submission) =>
          typeof submission.normalizedArtistName === "string" &&
          submission.normalizedArtistName.length > 0,
      ),
      "selected-game submissions expose normalized exported artist labels",
    );
    assert.deepEqual(
      recap.board.rounds.map((round) => round.name),
      ["Wildcard Waltz", "Sunset Static"],
    );
    assert.equal(recap.board.competitiveAnchor.title, "Alice Arcade leads the game");
    assert.match(recap.board.competitiveAnchor.body, /30 points/);
    assert.match(recap.board.competitiveAnchor.body, /4 unscored picks omitted/);
    assert.deepEqual(
      recap.board.moments.slice(0, 3).map((moment) => moment.kind),
      ["competitive", "song", "participation"],
    );

    const songMoment = recap.board.moments.find((moment) => moment.kind === "song");

    assert.ok(songMoment, "expected selected-game song or discovery memory moment");
    assert.equal(songMoment.label, "Song memory");
    assert.match(songMoment.title, /came back/);
    assert.match(songMoment.body, /prior exact-song appearance/);
    assert.match(
      songMoment.href,
      new RegExp(`^/\\?game=${afterpartyGameId}&round=\\d+&song=\\d+$`),
    );
    assert.ok(
      !recap.board.rounds.some((round) => round.name === "Opening Night"),
      "selected board rounds must not blend the main game",
    );
  },
);

test(
  "selected game memory board preserves tied leaders and partial-score caveats",
  { concurrency: false },
  async () => {
    const mainGameId = await findGameIdBySourceId("main");
    const recap = await getSelectedGameMemoryBoard(mainGameId, { prisma });

    assert.ok(recap);
    assert.deepEqual(
      recap.board.rounds.map((round) => [round.name, round.statusLabel]),
      [
        ["Opening Night", "scored"],
        ["Second Spin", "pending"],
      ],
    );
    assert.equal(
      recap.board.competitiveAnchor.title,
      "Tied leaders: Alice Arcade, Benny Beats, Casey Chorus",
    );
    assert.match(recap.board.competitiveAnchor.body, /24 points each/);
    assert.match(recap.board.competitiveAnchor.body, /4 unscored picks omitted/);
    assert.deepEqual(
      recap.board.competitiveAnchor.leaders.map((leader) => leader.player.displayName),
      ["Alice Arcade", "Benny Beats", "Casey Chorus"],
    );
    assert.ok(
      recap.board.moments.some((moment) => moment.label === "Still unfolding"),
      "partial score evidence should caveat outcome-dependent claims without removing other moments",
    );
    assert.ok(
      recap.board.moments.some((moment) => moment.kind === "song"),
      "unrelated song/discovery moments remain eligible when scores are partial",
    );
  },
);

test("selected game memory board returns null for unselectable game ids", async () => {
  assert.equal(await getSelectedGameMemoryBoard(999999, { prisma }), null);
  assert.equal(await getSelectedGameMemoryBoard(null, { prisma }), null);
});

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
    assert.deepEqual(
      round.voteBreakdown.map((group) => group.submissionId),
      round.submissions.map((submission) => submission.id),
    );
    assert.equal(round.voteBreakdown.length, round.submissions.length);
    assert.equal(round.voteBreakdown[0].song.title, "Mr. Brightside");
    assert.equal(round.voteBreakdown[0].submissionComment, "Arcade-pop opener with a bright chorus.");
    assert.deepEqual(
      round.voteBreakdown[0].votes.map((vote) => ({
        voter: vote.voter.displayName,
        pointsAssigned: vote.pointsAssigned,
        voteComment: vote.voteComment,
      })),
      [
        {
          voter: "Benny Beats",
          pointsAssigned: 10,
          voteComment: "Bright and ridiculously replayable.",
        },
        {
          voter: "Casey Chorus",
          pointsAssigned: 7,
          voteComment: null,
        },
        {
          voter: "Drew Delay",
          pointsAssigned: 7,
          voteComment: "Massive chorus, no notes.",
        },
      ],
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
    assert.equal(round.voteBreakdown.length, round.submissions.length);
    assert.ok(
      round.voteBreakdown.every((group) => group.votes.length === 0),
      "expected pending submissions to remain visible with empty vote lists",
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
  "round detail vote breakdown preserves negative points and empty vote groups",
  { concurrency: false },
  async () => {
    const fixture = await createTask06VoteBreakdownFixture();
    const round = await getRoundDetail(fixture.roundId, { prisma });

    assert.ok(round);
    assert.deepEqual(
      round.voteBreakdown.map((group) => group.submissionId),
      [fixture.targetSubmissionId, fixture.emptySubmissionId],
    );

    const votedGroup = round.voteBreakdown[0];
    const emptyGroup = round.voteBreakdown[1];

    assert.equal(votedGroup.submissionComment, "Submission comment stays separate.");
    assert.deepEqual(
      votedGroup.votes.map((vote) => ({
        pointsAssigned: vote.pointsAssigned,
        voteComment: vote.voteComment,
      })),
      [
        {
          pointsAssigned: 2,
          voteComment: "Positive edge",
        },
        {
          pointsAssigned: -1,
          voteComment: "Downvote edge",
        },
      ],
    );
    assert.equal(emptyGroup.votes.length, 0);
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
  "TASK-06 contested familiarity coverage excludes same-round evidence from prior history",
  { concurrency: false },
  async () => {
    const sameArtistFixture = await createTask02SameRoundArtistFixture();
    const sameArtistRound = await getRoundDetail(sameArtistFixture.roundId, { prisma });

    assert.ok(sameArtistRound);
    assert.deepEqual(
      sameArtistRound.submissions.map((submission) => submission.song.familiarity.kind),
      ["debut", "debut"],
    );
    assert.ok(
      sameArtistRound.submissions.every(
        (submission) =>
          submission.song.familiarity.label === "New to us" &&
          submission.song.familiarity.priorArtistSubmissionCount === 0,
      ),
    );

    const duplicateFixture = await createTask02DuplicateSongFixture();
    const duplicateRound = await getRoundDetail(duplicateFixture.roundId, { prisma });
    const duplicateModal = await getSongMemoryModal(
      duplicateFixture.roundId,
      duplicateFixture.songId,
      { prisma },
    );

    assert.ok(duplicateRound);
    assert.ok(duplicateModal);
    assert.equal(
      duplicateModal.summary.firstSubmitter.displayName,
      duplicateFixture.representativeSubmitterName,
    );
    assert.equal(duplicateModal.familiarity.exactSongSubmissionCount, 2);
    assert.equal(duplicateModal.familiarity.priorExactSongSubmissionCount, 0);
    assert.deepEqual(
      duplicateModal.historyGroups.flatMap((group) =>
        group.rows.filter((row) => row.isOrigin).map((row) => row.submissionId),
      ),
      [duplicateFixture.firstSubmissionId],
    );
    assert.ok(
      duplicateRound.submissions.every(
        (submission) =>
          submission.song.id === duplicateFixture.songId &&
          submission.song.familiarity.kind === duplicateModal.familiarity.kind &&
          submission.song.familiarity.label === duplicateModal.familiarity.label,
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
  "song memory modal hydrates archive-wide exact history, artist footprint, shortcuts, and game groups",
  { concurrency: false },
  async () => {
    const originRoundId = await findRoundIdBySourceId("seed-r3");
    const songId = await findSongIdBySpotifyUri("spotify:track:seed-song-005");
    const exactSubmissions = await prisma.submission.findMany({
      where: {
        songId,
      },
      select: {
        id: true,
        round: {
          select: {
            sourceRoundId: true,
          },
        },
      },
    });
    const submissionIdByRound = new Map(
      exactSubmissions.map((submission) => [submission.round.sourceRoundId, submission.id]),
    );
    const modal = await getSongMemoryModal(originRoundId, songId, { prisma });
    const originGameId = await findRoundGameId(originRoundId);

    assert.ok(modal);
    assert.equal(modal.originRoundId, originRoundId);
    assert.deepEqual(modal.song, {
      id: songId,
      title: "The Long Way Home",
      artistName: "Solar Static",
    });
    assert.equal(modal.closeHref, `/?game=${originGameId}&round=${originRoundId}`);
    assert.equal(modal.familiarity.kind, "brought-back");
    assert.equal(modal.familiarity.label, "Brought back");
    assert.equal(modal.familiarity.priorExactSongSubmissionCount, 1);
    assert.equal(modal.familiarity.priorArtistSubmissionCount, 1);
    assert.equal(modal.summary.exactSongSubmissionCount, 3);
    assert.equal(modal.summary.firstSubmitter.displayName, "Alice Arcade");
    assert.equal(modal.summary.mostRecentSubmitter.displayName, "Casey Chorus");
    assert.deepEqual(modal.summary.bestExactSongFinish, {
      rank: 2,
      score: 21,
      submissionId: submissionIdByRound.get("seed-r3"),
    });
    assert.deepEqual(
      {
        songCount: modal.summary.artistFootprint.songCount,
        submitterCount: modal.summary.artistFootprint.submitterCount,
        submissionCount: modal.summary.artistFootprint.submissionCount,
      },
      {
        songCount: 1,
        submitterCount: 2,
        submissionCount: 3,
      },
    );
    assert.deepEqual(
      modal.summary.artistFootprint.notableSubmitters.map((submitter) => submitter.displayName),
      ["Alice Arcade", "Benny Beats"],
    );
    assert.equal(modal.summary.recallComment.submissionId, submissionIdByRound.get("seed-r3"));
    assert.match(modal.summary.recallComment.text, /Melancholy drive-home pick/);
    assert.deepEqual(modal.shortcuts, [
      {
        kind: "first-appearance",
        label: "First appearance",
        submissionId: submissionIdByRound.get("seed-r2"),
      },
      {
        kind: "most-recent-appearance",
        label: "Most recent appearance",
        submissionId: submissionIdByRound.get("seed-r3"),
      },
    ]);
    assert.deepEqual(
      modal.historyGroups.map((group) => group.gameLabel),
      ["After Party League", "main"],
    );
    assert.equal(modal.historyGroups[0].isOriginGame, true);
    assert.deepEqual(
      modal.historyGroups[0].rows.map((row) => row.roundName),
      ["Wildcard Waltz", "Sunset Static"],
    );
    assert.deepEqual(
      modal.historyGroups[1].rows.map((row) => row.roundName),
      ["Second Spin"],
    );
    assert.deepEqual(
      modal.historyGroups.flatMap((group) =>
        group.rows.filter((row) => row.isOrigin).map((row) => row.submissionId),
      ),
      [submissionIdByRound.get("seed-r3")],
    );
    assert.ok(
      modal.historyGroups.every((group) =>
        group.rows.every((row) => row.submitter.displayName && row.result),
      ),
    );
  },
);

test(
  "song memory modal shares the representative duplicate-origin verdict across round and player entry points",
  { concurrency: false },
  async () => {
    const fixture = await createTask02DuplicateSongFixture();
    const round = await getRoundDetail(fixture.roundId, { prisma });
    const modal = await getSongMemoryModal(fixture.roundId, fixture.songId, { prisma });
    const playerSubmission = await getPlayerModalSubmission(
      fixture.roundId,
      fixture.secondPlayerId,
      fixture.secondSubmissionId,
      { prisma },
    );

    assert.ok(round);
    assert.ok(modal);
    assert.ok(playerSubmission);

    const row = round.submissions.find(
      (submission) => submission.id === fixture.secondSubmissionId,
    );

    assert.ok(row);
    assert.equal(modal.summary.firstSubmitter.displayName, fixture.representativeSubmitterName);
    assert.equal(modal.familiarity.kind, row.song.familiarity.kind);
    assert.equal(modal.familiarity.kind, playerSubmission.familiarity.kind);
    assert.equal(modal.familiarity.label, playerSubmission.familiarity.label);
    assert.equal(modal.familiarity.exactSongSubmissionCount, 2);
    assert.equal(modal.familiarity.priorExactSongSubmissionCount, 0);
    assert.deepEqual(
      modal.historyGroups.flatMap((group) =>
        group.rows
          .filter((historyRow) => historyRow.isOrigin)
          .map((historyRow) => historyRow.submissionId),
      ),
      [fixture.firstSubmissionId],
    );
  },
);

test(
  "song memory modal returns sparse single-submission and unavailable origin-song states",
  { concurrency: false },
  async () => {
    const fixture = await createTask03SparseSongFixture();
    const sparseModal = await getSongMemoryModal(fixture.roundId, fixture.songId, { prisma });

    assert.ok(sparseModal);
    assert.equal(sparseModal.familiarity.kind, "debut");
    assert.equal(sparseModal.familiarity.label, "New to us");
    assert.equal(sparseModal.summary.exactSongSubmissionCount, 1);
    assert.deepEqual(sparseModal.summary.firstSubmitter, {
      id: fixture.playerId,
      displayName: fixture.playerName,
    });
    assert.deepEqual(sparseModal.summary.mostRecentSubmitter, {
      id: fixture.playerId,
      displayName: fixture.playerName,
    });
    assert.equal(sparseModal.summary.bestExactSongFinish, null);
    assert.deepEqual(sparseModal.summary.artistFootprint, {
      songCount: 0,
      submitterCount: 0,
      submissionCount: 0,
      notableSubmitters: [],
    });
    assert.equal(sparseModal.summary.recallComment, null);
    assert.deepEqual(sparseModal.shortcuts, []);
    assert.deepEqual(sparseModal.historyGroups, [
      {
        gameId: sparseModal.historyGroups[0].gameId,
        gameLabel: "Task 03 Sparse 1",
        isOriginGame: true,
        rows: [
          {
            submissionId: fixture.submissionId,
            gameId: sparseModal.historyGroups[0].gameId,
            gameLabel: "Task 03 Sparse 1",
            roundId: fixture.roundId,
            roundName: "Task 03 Sparse Round 1",
            occurredAt: "2024-05-01T19:00:00.000Z",
            submitter: {
              id: fixture.playerId,
              displayName: fixture.playerName,
            },
            result: {
              rank: null,
              score: null,
            },
            comment: null,
            isOrigin: true,
          },
        ],
      },
    ]);

    const staleRoundId = await findRoundIdBySourceId("seed-r1");
    const staleSongId = await findSongIdBySpotifyUri("spotify:track:seed-song-005");
    const staleGameId = await findRoundGameId(staleRoundId);

    assert.deepEqual(await getSongMemoryModal(staleRoundId, staleSongId, { prisma }), {
      unavailable: true,
      originRoundId: staleRoundId,
      requestedSongId: staleSongId,
      closeHref: `/?game=${staleGameId}&round=${staleRoundId}`,
    });
    assert.equal(await getSongMemoryModal(999999, staleSongId, { prisma }), null);
  },
);

test(
  "TASK-06 song-memory regression fixture covers familiarity, grouping, sparse history, and stale origins",
  { concurrency: false },
  async () => {
    const fixture = await createTask06SongMemoryRegressionFixture();
    const round = await getRoundDetail(fixture.originRoundId, { prisma });

    assert.ok(round);

    const rowBySubmissionId = new Map(
      round.submissions.map((submission) => [submission.id, submission]),
    );
    const debutRow = rowBySubmissionId.get(fixture.debutOriginSubmissionId);
    const familiarRow = rowBySubmissionId.get(fixture.familiarOriginSubmissionId);
    const repeatRow = rowBySubmissionId.get(fixture.repeatOriginSubmissionId);
    const sparseRow = rowBySubmissionId.get(fixture.sparseOriginSubmissionId);

    assert.ok(debutRow);
    assert.ok(familiarRow);
    assert.ok(repeatRow);
    assert.ok(sparseRow);
    assert.equal(debutRow.song.familiarity.kind, "debut");
    assert.equal(debutRow.song.familiarity.label, "New to us");
    assert.equal(familiarRow.song.familiarity.kind, "known-artist");
    assert.equal(familiarRow.song.familiarity.label, "Known artist");
    assert.equal(familiarRow.song.familiarity.priorArtistSubmissionCount, 1);
    assert.equal(repeatRow.song.familiarity.kind, "brought-back");
    assert.equal(repeatRow.song.familiarity.label, "Brought back");
    assert.equal(repeatRow.song.familiarity.priorExactSongSubmissionCount, 1);
    assert.equal(sparseRow.song.familiarity.kind, "debut");
    assert.equal(sparseRow.score, null);
    assert.equal(sparseRow.rank, null);
    assert.equal(sparseRow.comment, null);

    const [debutModal, familiarModal, repeatModal, sparseModal] = await Promise.all([
      getSongMemoryModal(fixture.originRoundId, fixture.debutSongId, { prisma }),
      getSongMemoryModal(fixture.originRoundId, fixture.familiarSongId, { prisma }),
      getSongMemoryModal(fixture.originRoundId, fixture.repeatSongId, { prisma }),
      getSongMemoryModal(fixture.originRoundId, fixture.sparseSongId, { prisma }),
    ]);

    assert.ok(debutModal);
    assert.ok(familiarModal);
    assert.ok(repeatModal);
    assert.ok(sparseModal);
    assert.equal(debutModal.familiarity.kind, debutRow.song.familiarity.kind);
    assert.equal(familiarModal.familiarity.kind, familiarRow.song.familiarity.kind);
    assert.equal(repeatModal.familiarity.kind, repeatRow.song.familiarity.kind);
    assert.equal(sparseModal.familiarity.kind, sparseRow.song.familiarity.kind);
    assert.equal(familiarModal.familiarity.throughSubmitters.length, 1);
    assert.equal(
      familiarModal.familiarity.throughSubmitters[0].displayName,
      fixture.familiarPriorPlayerName,
    );

    assert.equal(repeatModal.familiarity.kind, "brought-back");
    assert.equal(repeatModal.familiarity.priorExactSongSubmissionCount, 1);
    assert.equal(repeatModal.familiarity.priorArtistSubmissionCount, 1);
    assert.equal(repeatModal.summary.exactSongSubmissionCount, 3);
    assert.equal(repeatModal.summary.artistFootprint.submissionCount, 1);
    assert.equal(repeatModal.summary.artistFootprint.songCount, 1);
    assert.equal(repeatModal.summary.firstSubmitter.displayName, fixture.repeatPriorPlayerName);
    assert.equal(repeatModal.summary.mostRecentSubmitter.displayName, fixture.repeatRecentPlayerName);
    assert.deepEqual(repeatModal.summary.bestExactSongFinish, {
      rank: 1,
      score: 30,
      submissionId: fixture.repeatSatelliteSubmissionId,
    });
    assert.equal(repeatModal.summary.recallComment.submissionId, fixture.repeatSatelliteSubmissionId);
    assert.match(repeatModal.summary.recallComment.text, /Most recent cross-game/);
    assert.deepEqual(repeatModal.shortcuts, [
      {
        kind: "first-appearance",
        label: "First appearance",
        submissionId: fixture.repeatPriorSubmissionId,
      },
      {
        kind: "most-recent-appearance",
        label: "Most recent appearance",
        submissionId: fixture.repeatSatelliteSubmissionId,
      },
    ]);
    assert.deepEqual(
      repeatModal.historyGroups.map((group) => group.gameLabel),
      [fixture.originGameLabel, fixture.satelliteGameLabel],
    );
    assert.deepEqual(
      repeatModal.historyGroups[0].rows.map((row) => row.submissionId),
      [fixture.repeatOriginSubmissionId, fixture.repeatPriorSubmissionId],
    );
    assert.deepEqual(
      repeatModal.historyGroups[1].rows.map((row) => row.submissionId),
      [fixture.repeatSatelliteSubmissionId],
    );
    assert.deepEqual(
      repeatModal.historyGroups.flatMap((group) =>
        group.rows.filter((row) => row.isOrigin).map((row) => row.submissionId),
      ),
      [fixture.repeatOriginSubmissionId],
    );
    assert.ok(
      !repeatModal.historyGroups
        .flatMap((group) => group.rows)
        .some((row) => row.submissionId === fixture.repeatArtistPriorSubmissionId),
      "artist-only evidence must not be interleaved into exact-song history",
    );

    assert.equal(sparseModal.summary.exactSongSubmissionCount, 1);
    assert.deepEqual(sparseModal.summary.firstSubmitter, {
      id: fixture.sparsePlayerId,
      displayName: fixture.sparsePlayerName,
    });
    assert.deepEqual(sparseModal.summary.mostRecentSubmitter, {
      id: fixture.sparsePlayerId,
      displayName: fixture.sparsePlayerName,
    });
    assert.equal(sparseModal.summary.bestExactSongFinish, null);
    assert.equal(sparseModal.summary.recallComment, null);
    assert.deepEqual(sparseModal.shortcuts, []);
    assert.deepEqual(sparseModal.historyGroups[0].rows[0].result, {
      rank: null,
      score: null,
    });
    assert.equal(sparseModal.historyGroups[0].rows[0].comment, null);

    const fixtureOriginGameId = await findRoundGameId(fixture.originRoundId);

    assert.deepEqual(await getSongMemoryModal(fixture.originRoundId, fixture.staleSongId, { prisma }), {
      unavailable: true,
      originRoundId: fixture.originRoundId,
      requestedSongId: fixture.staleSongId,
      closeHref: `/?game=${fixtureOriginGameId}&round=${fixture.originRoundId}`,
    });
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
      line: "Won 2 of 4 scored submissions.",
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
      line: "Scores varied widely across 3 scored submissions.",
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
      line: "One scored submission landed near the top.",
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
      line: "One scored submission landed lower in the table.",
    },
  );
});

test("derivePlayerPerformanceMetrics follows the overview player metric contract", () => {
  const metricsByPlayer = derivePlayerPerformanceMetrics([
    { playerId: 1, roundId: 10, score: 12, rank: 1 },
    { playerId: 1, roundId: 10, score: 3, rank: 3 },
    { playerId: 2, roundId: 10, score: 8, rank: 2 },
    { playerId: 1, roundId: 20, score: null, rank: null },
    { playerId: 3, roundId: 20, score: null, rank: null },
    { playerId: 1, roundId: 30, score: 7, rank: 1 },
  ]);

  const playerOneMetrics = metricsByPlayer.get(1);

  assert.deepEqual(
    {
      ...playerOneMetrics,
      rawScoreStdDev: null,
    },
    {
      playerId: 1,
      scoredSubmissionCount: 3,
      submittedRoundCount: 3,
      averageFinishPercentile: 1 / 3,
      winRate: 2 / 3,
      rawScoreStdDev: null,
      minimumSampleMet: true,
    },
  );
  assert.ok(
    Math.abs(playerOneMetrics.rawScoreStdDev - Math.sqrt(122 / 9)) < 1e-12,
  );
  assert.deepEqual(metricsByPlayer.get(3), {
    playerId: 3,
    scoredSubmissionCount: 0,
    submittedRoundCount: 1,
    averageFinishPercentile: null,
    winRate: null,
    rawScoreStdDev: null,
    minimumSampleMet: false,
  });
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
      "Won 2 of 3 scored submissions.",
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
      "Scores varied widely across 3 scored submissions.",
    );
    assert.equal(varianceModal.history.length, fixture.scoredHistoryCounts.variance);

    assert.ok(topFinishModal);
    assert.equal(topFinishModal.traitKind, "top-finish");
    assert.equal(
      topFinishModal.traitLine,
      "One scored submission landed near the top.",
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
      "Average finish sat lower in the table across 3 scored submissions.",
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
  assert.equal(buildArchiveHref({ gameId: 7 }), "/?game=7");
  assert.equal(
    buildArchiveHref({ gameId: 7, roundId: 5, songId: 2 }),
    "/?game=7&round=5&song=2",
  );
  assert.equal(
    buildArchiveHref({ gameId: 7, roundId: 5, fragment: "vote-breakdown" }),
    "/?game=7&round=5#vote-breakdown",
  );
  assert.equal(buildArchiveHref({ roundId: -1, playerId: 3 }), "/");
  assert.equal(
    buildCanonicalSongMemoryHref({
      gameId: 7,
      roundId: 5,
      songId: 2,
      playerId: 3,
      playerSubmissionId: 9,
    }),
    "/?game=7&round=5&song=2",
  );
});

test("memory board evidence href helper targets canonical selected-game destinations", () => {
  assert.equal(buildMemoryBoardEvidenceHref({ gameId: 7 }), "/?game=7");
  assert.equal(
    buildMemoryBoardEvidenceHref({ gameId: 7, roundId: 5 }),
    "/?game=7&round=5",
  );
  assert.equal(
    buildMemoryBoardEvidenceHref({ gameId: 7, roundId: 5, songId: 2 }),
    "/?game=7&round=5&song=2",
  );
  assert.equal(
    buildMemoryBoardEvidenceHref({ gameId: 7, roundId: 5, playerId: 3 }),
    "/?game=7&round=5&player=3",
  );
  assert.equal(
    buildMemoryBoardEvidenceHref({
      gameId: 7,
      roundId: 5,
      playerId: 3,
      submissionId: 9,
    }),
    "/?game=7&round=5&player=3&playerSubmission=9",
  );
  assert.equal(
    buildMemoryBoardEvidenceHref({ gameId: 7, roundId: 5, submissionId: 9 }),
    "/?game=7&round=5#submission-9",
  );
  assert.equal(
    buildMemoryBoardEvidenceHref({ gameId: 7, roundId: 5, section: "vote-breakdown" }),
    "/?game=7&round=5#vote-breakdown",
  );
  assert.equal(buildMemoryBoardEvidenceHref({ roundId: 5, songId: 2 }), null);
});

test("selected-game route context adapter rewrites return and evidence hrefs without changing identity", () => {
  const roundPayload = {
    id: 5,
    game: {
      id: 7,
      displayLabel: "League",
    },
    submissions: [
      {
        id: 9,
        song: {
          id: 2,
        },
        player: {
          id: 3,
        },
      },
    ],
    voteBreakdown: [
      {
        submissionId: 9,
      },
    ],
  };

  const adaptedRound = applySelectedGameRouteContext(roundPayload, {
    selectedGameId: 7,
    openRoundId: 5,
    selectedGameHref: "/?game=7",
  });

  assert.notEqual(adaptedRound, roundPayload);
  assert.equal(adaptedRound.id, roundPayload.id);
  assert.equal(adaptedRound.closeHref, "/?game=7");
  assert.equal(adaptedRound.href, "/?game=7&round=5");
  assert.equal(adaptedRound.submissions[0].href, "/?game=7&round=5#submission-9");
  assert.equal(adaptedRound.submissions[0].songHref, "/?game=7&round=5&song=2");
  assert.equal(adaptedRound.submissions[0].playerHref, "/?game=7&round=5&player=3");
  assert.equal(adaptedRound.voteBreakdownHref, "/?game=7&round=5#vote-breakdown");
  assert.equal(adaptedRound.voteBreakdown[0].href, "/?game=7&round=5#submission-9");
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
