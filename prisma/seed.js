const { PrismaClient } = require("@prisma/client");
const { normalize } = require("../src/lib/normalize");

const prisma = new PrismaClient();

const players = [
  {
    displayName: "Alice Arcade",
    sourcePlayerId: "seed-player-alice",
  },
  {
    displayName: "Benny Beats",
    sourcePlayerId: "seed-player-benny",
  },
  {
    displayName: "Casey Chorus",
    sourcePlayerId: "seed-player-casey",
  },
  {
    displayName: "Drew Delay",
    sourcePlayerId: "seed-player-drew",
  },
];

const artists = [
  { name: "The Midnight Owls" },
  { name: "Solar Static" },
  { name: "Neon Harbor" },
  { name: "Juniper Sundays" },
];

const songs = [
  {
    title: "Mr. Brightside",
    artistName: "The Midnight Owls",
    spotifyUri: "spotify:track:seed-song-001",
  },
  {
    title: "Wake Up, Mr Crow",
    artistName: "Solar Static",
    spotifyUri: "spotify:track:seed-song-002",
  },
  {
    title: "It's a Trap",
    artistName: "Neon Harbor",
    spotifyUri: "spotify:track:seed-song-003",
  },
  {
    title: "Beyonce Nights",
    artistName: "Juniper Sundays",
    spotifyUri: "spotify:track:seed-song-004",
  },
  {
    title: "The Long Way Home",
    artistName: "Solar Static",
    spotifyUri: "spotify:track:seed-song-005",
  },
  {
    title: "Parallel Lines",
    artistName: "The Midnight Owls",
    spotifyUri: "spotify:track:seed-song-006",
  },
];

const games = [
  {
    sourceGameId: "main",
    displayName: null,
  },
  {
    sourceGameId: "afterparty",
    displayName: "After Party League",
  },
];

const rounds = [
  {
    leagueSlug: "main",
    sourceRoundId: "seed-r1",
    name: "Opening Night",
    description: "Seeded scored round for downstream query development.",
    playlistUrl: "https://open.spotify.com/playlist/seed-r1",
    sequenceNumber: 1,
    occurredAt: new Date("2024-01-18T19:00:00.000Z"),
  },
  {
    leagueSlug: "main",
    sourceRoundId: "seed-r2",
    name: "Second Spin",
    description: "Seeded partially scored round for downstream query development.",
    playlistUrl: "https://open.spotify.com/playlist/seed-r2",
    sequenceNumber: 2,
    occurredAt: new Date("2024-02-01T19:00:00.000Z"),
  },
  {
    leagueSlug: "afterparty",
    sourceRoundId: "seed-r3",
    name: "Wildcard Waltz",
    description: "Seeded scored bonus round for multi-game archive coverage.",
    playlistUrl: "https://open.spotify.com/playlist/seed-r3",
    sequenceNumber: 1,
    occurredAt: new Date("2024-03-07T19:00:00.000Z"),
  },
  {
    leagueSlug: "afterparty",
    sourceRoundId: "seed-r4",
    name: "Sunset Static",
    description: null,
    playlistUrl: null,
    sequenceNumber: 2,
    occurredAt: null,
  },
];

// TASK-04b extends this file to upsert submissions. Keeping the planned overlap
// here ensures the shared fixture has at least one song scheduled for both rounds.
const plannedRoundSongs = {
  "seed-r1": [
    "spotify:track:seed-song-001",
    "spotify:track:seed-song-002",
    "spotify:track:seed-song-003",
    "spotify:track:seed-song-004",
  ],
  "seed-r2": [
    "spotify:track:seed-song-001",
    "spotify:track:seed-song-005",
    "spotify:track:seed-song-006",
    "spotify:track:seed-song-003",
  ],
  "seed-r3": [
    "spotify:track:seed-song-002",
    "spotify:track:seed-song-004",
    "spotify:track:seed-song-005",
    "spotify:track:seed-song-006",
  ],
  "seed-r4": [
    "spotify:track:seed-song-001",
    "spotify:track:seed-song-002",
    "spotify:track:seed-song-005",
    "spotify:track:seed-song-006",
  ],
};

const submissionPlan = {
  "seed-r1": [
    {
      playerSourceId: "seed-player-alice",
      songUri: "spotify:track:seed-song-001",
      comment: "Arcade-pop opener with a bright chorus.",
      submittedAt: new Date("2024-01-15T18:00:00.000Z"),
    },
    {
      playerSourceId: "seed-player-benny",
      songUri: "spotify:track:seed-song-002",
      comment: "Night-drive synths and a crooked grin.",
      submittedAt: new Date("2024-01-15T18:05:00.000Z"),
    },
    {
      playerSourceId: "seed-player-casey",
      songUri: "spotify:track:seed-song-003",
      comment: "Sharp hooks with a playful trapdoor lyric.",
      submittedAt: new Date("2024-01-15T18:10:00.000Z"),
    },
    {
      playerSourceId: "seed-player-drew",
      songUri: "spotify:track:seed-song-004",
      comment: "Late-night anthem with a glossy finish.",
      submittedAt: new Date("2024-01-15T18:15:00.000Z"),
    },
  ],
  "seed-r2": [
    {
      playerSourceId: "seed-player-alice",
      songUri: "spotify:track:seed-song-005",
      comment: "Road-trip comedown pick for an unscored round.",
      submittedAt: new Date("2024-01-29T18:00:00.000Z"),
    },
    {
      playerSourceId: "seed-player-benny",
      songUri: "spotify:track:seed-song-001",
      comment: "Repeat favorite to keep cross-round song overlap alive.",
      submittedAt: new Date("2024-01-29T18:05:00.000Z"),
    },
    {
      playerSourceId: "seed-player-casey",
      songUri: "spotify:track:seed-song-006",
      comment: "A softer closer waiting on votes.",
      submittedAt: new Date("2024-01-29T18:10:00.000Z"),
    },
    {
      playerSourceId: "seed-player-drew",
      songUri: "spotify:track:seed-song-003",
      comment: "Keeps the hooky chaos alive for a pending rematch.",
      submittedAt: new Date("2024-01-29T18:15:00.000Z"),
    },
  ],
  "seed-r3": [
    {
      playerSourceId: "seed-player-alice",
      songUri: "spotify:track:seed-song-002",
      comment: "Bonus-round favorite with enough sparkle to win twice.",
      submittedAt: new Date("2024-03-03T18:00:00.000Z"),
    },
    {
      playerSourceId: "seed-player-benny",
      songUri: "spotify:track:seed-song-004",
      comment: "A glossy anthem that plays bigger in the late game.",
      submittedAt: new Date("2024-03-03T18:05:00.000Z"),
    },
    {
      playerSourceId: "seed-player-casey",
      songUri: "spotify:track:seed-song-005",
      comment: "Melancholy drive-home pick with a huge middle eight.",
      submittedAt: new Date("2024-03-03T18:10:00.000Z"),
    },
    {
      playerSourceId: "seed-player-drew",
      songUri: "spotify:track:seed-song-006",
      comment: "Quietly devastating closer for the bonus table.",
      submittedAt: new Date("2024-03-03T18:15:00.000Z"),
    },
  ],
  "seed-r4": [
    {
      playerSourceId: "seed-player-alice",
      songUri: "spotify:track:seed-song-001",
      comment: "An intentionally unfinished cliffhanger of a finale.",
      submittedAt: new Date("2024-03-14T18:00:00.000Z"),
    },
    {
      playerSourceId: "seed-player-benny",
      songUri: "spotify:track:seed-song-002",
      comment: "Keeps the synth glow alive while votes trickle in.",
      submittedAt: new Date("2024-03-14T18:05:00.000Z"),
    },
    {
      playerSourceId: "seed-player-casey",
      songUri: "spotify:track:seed-song-005",
      comment: "A patient slow-burn for a date-less pending round.",
      submittedAt: new Date("2024-03-14T18:10:00.000Z"),
    },
    {
      playerSourceId: "seed-player-drew",
      songUri: "spotify:track:seed-song-006",
      comment: "Loose, dreamy, and still waiting on the reveal.",
      submittedAt: new Date("2024-03-14T18:15:00.000Z"),
    },
  ],
};

const roundBallots = {
  "seed-r1": {
    "seed-player-alice": [
      {
        targetPlayerSourceId: "seed-player-benny",
        pointsAssigned: 10,
        comment: "Immediate hook, huge chorus.",
        votedAt: new Date("2024-01-18T19:05:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-casey",
        pointsAssigned: 7,
        comment: "Clever title, even better payoff.",
        votedAt: new Date("2024-01-18T19:06:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-drew",
        pointsAssigned: 4,
        comment: null,
        votedAt: new Date("2024-01-18T19:07:00.000Z"),
      },
    ],
    "seed-player-benny": [
      {
        targetPlayerSourceId: "seed-player-alice",
        pointsAssigned: 10,
        comment: "Bright and ridiculously replayable.",
        votedAt: new Date("2024-01-18T19:08:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-casey",
        pointsAssigned: 7,
        comment: null,
        votedAt: new Date("2024-01-18T19:09:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-drew",
        pointsAssigned: 4,
        comment: "Sticks the landing.",
        votedAt: new Date("2024-01-18T19:10:00.000Z"),
      },
    ],
    "seed-player-casey": [
      {
        targetPlayerSourceId: "seed-player-alice",
        pointsAssigned: 7,
        comment: null,
        votedAt: new Date("2024-01-18T19:11:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-benny",
        pointsAssigned: 10,
        comment: "Ridiculous earworm in the best way.",
        votedAt: new Date("2024-01-18T19:12:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-drew",
        pointsAssigned: 4,
        comment: null,
        votedAt: new Date("2024-01-18T19:13:00.000Z"),
      },
    ],
    "seed-player-drew": [
      {
        targetPlayerSourceId: "seed-player-alice",
        pointsAssigned: 7,
        comment: "Massive chorus, no notes.",
        votedAt: new Date("2024-01-18T19:14:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-benny",
        pointsAssigned: 4,
        comment: null,
        votedAt: new Date("2024-01-18T19:15:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-casey",
        pointsAssigned: 10,
        comment: "Best slow-burn reveal in the round.",
        votedAt: new Date("2024-01-18T19:16:00.000Z"),
      },
    ],
  },
  "seed-r3": {
    "seed-player-alice": [
      {
        targetPlayerSourceId: "seed-player-benny",
        pointsAssigned: 7,
        comment: "Huge finish, even better on repeat.",
        votedAt: new Date("2024-03-07T19:05:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-casey",
        pointsAssigned: 10,
        comment: "Sneaks up and lands perfectly.",
        votedAt: new Date("2024-03-07T19:06:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-drew",
        pointsAssigned: 4,
        comment: null,
        votedAt: new Date("2024-03-07T19:07:00.000Z"),
      },
    ],
    "seed-player-benny": [
      {
        targetPlayerSourceId: "seed-player-alice",
        pointsAssigned: 10,
        comment: "Instant late-round classic.",
        votedAt: new Date("2024-03-07T19:08:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-casey",
        pointsAssigned: 7,
        comment: null,
        votedAt: new Date("2024-03-07T19:09:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-drew",
        pointsAssigned: 4,
        comment: "Quietly elegant.",
        votedAt: new Date("2024-03-07T19:10:00.000Z"),
      },
    ],
    "seed-player-casey": [
      {
        targetPlayerSourceId: "seed-player-alice",
        pointsAssigned: 10,
        comment: "The hook wins immediately.",
        votedAt: new Date("2024-03-07T19:11:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-benny",
        pointsAssigned: 4,
        comment: null,
        votedAt: new Date("2024-03-07T19:12:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-drew",
        pointsAssigned: 7,
        comment: "Grows on every listen.",
        votedAt: new Date("2024-03-07T19:13:00.000Z"),
      },
    ],
    "seed-player-drew": [
      {
        targetPlayerSourceId: "seed-player-alice",
        pointsAssigned: 10,
        comment: "Easy winner for me.",
        votedAt: new Date("2024-03-07T19:14:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-benny",
        pointsAssigned: 7,
        comment: null,
        votedAt: new Date("2024-03-07T19:15:00.000Z"),
      },
      {
        targetPlayerSourceId: "seed-player-casey",
        pointsAssigned: 4,
        comment: "Sharp writing, great restraint.",
        votedAt: new Date("2024-03-07T19:16:00.000Z"),
      },
    ],
  },
};

function validateSeedPlan() {
  if (games.length < 2) {
    throw new Error("seed plan must include at least two games");
  }

  if (rounds.length < 4) {
    throw new Error("seed plan must include at least four rounds");
  }

  const songRoundCounts = new Map();

  for (const roundSongUris of Object.values(plannedRoundSongs)) {
    const uniqueRoundUris = new Set(roundSongUris);

    for (const uri of uniqueRoundUris) {
      songRoundCounts.set(uri, (songRoundCounts.get(uri) ?? 0) + 1);
    }
  }

  const hasCrossRoundSongReuse = [...songRoundCounts.values()].some(
    (count) => count > 1,
  );

  if (!hasCrossRoundSongReuse) {
    throw new Error("seed plan must reuse at least one song across rounds");
  }

  if (
    Object.keys(roundBallots).length === 0 ||
    Object.keys(roundBallots).length >= rounds.length
  ) {
    throw new Error(
      "seed plan must include both scored and pending rounds in the archive",
    );
  }

  for (const [roundSourceId, submissions] of Object.entries(submissionPlan)) {
    const plannedSongs = plannedRoundSongs[roundSourceId] || [];
    const plannedSongSet = new Set(plannedSongs);

    if (submissions.length !== plannedSongs.length) {
      throw new Error(
        `submission plan count mismatch for round: ${roundSourceId}`,
      );
    }

    for (const submission of submissions) {
      if (!plannedSongSet.has(submission.songUri)) {
        throw new Error(
          `submission plan song missing from planned round songs: ${submission.songUri}`,
        );
      }
    }
  }

  for (const [roundSourceId, ballots] of Object.entries(roundBallots)) {
    const roundPlayers = new Set(
      (submissionPlan[roundSourceId] || []).map(
        (submission) => submission.playerSourceId,
      ),
    );

    for (const [voterSourceId, ballot] of Object.entries(ballots)) {
      if (!roundPlayers.has(voterSourceId)) {
        throw new Error(
          `scored round voter missing submission: ${roundSourceId}/${voterSourceId}`,
        );
      }

      if (ballot.length !== roundPlayers.size - 1) {
        throw new Error(
          `scored round ballot count mismatch for voter: ${roundSourceId}/${voterSourceId}`,
        );
      }

      const votedPlayers = new Set();

      for (const vote of ballot) {
        if (vote.targetPlayerSourceId === voterSourceId) {
          throw new Error(
            `scored round ballot includes self vote: ${roundSourceId}/${voterSourceId}`,
          );
        }

        votedPlayers.add(vote.targetPlayerSourceId);
      }

      if (votedPlayers.size !== ballot.length) {
        throw new Error(
          `scored round ballot has duplicate targets: ${roundSourceId}/${voterSourceId}`,
        );
      }

      for (const playerSourceId of roundPlayers) {
        if (
          playerSourceId !== voterSourceId &&
          !votedPlayers.has(playerSourceId)
        ) {
          throw new Error(
            `scored round ballot missing target ${playerSourceId} for voter: ${roundSourceId}/${voterSourceId}`,
          );
        }
      }
    }
  }
}

async function seedGames() {
  const gamesBySourceId = new Map();

  for (const game of games) {
    const record = await prisma.game.upsert({
      where: {
        sourceGameId: game.sourceGameId,
      },
      update: {
        displayName: game.displayName,
      },
      create: game,
    });

    gamesBySourceId.set(record.sourceGameId, record);
  }

  return gamesBySourceId;
}

async function seedPlayers() {
  for (const player of players) {
    const normalizedName = normalize(player.displayName);

    await prisma.player.upsert({
      where: { normalizedName },
      update: {
        displayName: player.displayName,
        normalizedName,
        sourcePlayerId: player.sourcePlayerId,
      },
      create: {
        displayName: player.displayName,
        normalizedName,
        sourcePlayerId: player.sourcePlayerId,
      },
    });
  }
}

async function seedArtists() {
  const artistMap = new Map();

  for (const artist of artists) {
    const normalizedName = normalize(artist.name);
    const record = await prisma.artist.upsert({
      where: { normalizedName },
      update: {
        name: artist.name,
        normalizedName,
      },
      create: {
        name: artist.name,
        normalizedName,
      },
    });

    artistMap.set(artist.name, record);
  }

  return artistMap;
}

async function seedSongs(artistMap) {
  for (const song of songs) {
    const artist = artistMap.get(song.artistName);

    if (!artist) {
      throw new Error(`missing artist for song: ${song.title}`);
    }

    await prisma.song.upsert({
      where: { spotifyUri: song.spotifyUri },
      update: {
        title: song.title,
        normalizedTitle: normalize(song.title),
        artistId: artist.id,
      },
      create: {
        title: song.title,
        normalizedTitle: normalize(song.title),
        artistId: artist.id,
        spotifyUri: song.spotifyUri,
      },
    });
  }
}

async function seedRounds(gamesBySourceId) {
  for (const round of rounds) {
    const game = gamesBySourceId.get(round.leagueSlug);

    if (!game) {
      throw new Error(`missing game for seeded round: ${round.leagueSlug}`);
    }

    await prisma.round.upsert({
      where: {
        gameId_sourceRoundId: {
          gameId: game.id,
          sourceRoundId: round.sourceRoundId,
        },
      },
      update: {
        gameId: game.id,
        leagueSlug: game.sourceGameId,
        name: round.name,
        description: round.description,
        playlistUrl: round.playlistUrl,
        sequenceNumber: round.sequenceNumber,
        occurredAt: round.occurredAt,
      },
      create: {
        ...round,
        gameId: game.id,
        leagueSlug: game.sourceGameId,
      },
    });
  }
}

async function loadSeedLookups() {
  const [playerRecords, songRecords, roundRecords] = await Promise.all([
    prisma.player.findMany({
      where: {
        sourcePlayerId: {
          in: players.map((player) => player.sourcePlayerId),
        },
      },
    }),
    prisma.song.findMany({
      where: {
        spotifyUri: {
          in: songs.map((song) => song.spotifyUri),
        },
      },
    }),
    prisma.round.findMany({
      where: {
        sourceRoundId: {
          in: rounds.map((round) => round.sourceRoundId),
        },
      },
    }),
  ]);

  const playersBySourceId = new Map(
    playerRecords.map((player) => [player.sourcePlayerId, player]),
  );
  const songsByUri = new Map(songRecords.map((song) => [song.spotifyUri, song]));
  const roundsBySourceId = new Map(
    roundRecords.map((round) => [round.sourceRoundId, round]),
  );

  for (const player of players) {
    if (!playersBySourceId.has(player.sourcePlayerId)) {
      throw new Error(`missing seeded player lookup: ${player.sourcePlayerId}`);
    }
  }

  for (const song of songs) {
    if (!songsByUri.has(song.spotifyUri)) {
      throw new Error(`missing seeded song lookup: ${song.spotifyUri}`);
    }
  }

  for (const round of rounds) {
    if (!roundsBySourceId.has(round.sourceRoundId)) {
      throw new Error(`missing seeded round lookup: ${round.sourceRoundId}`);
    }
  }

  return { playersBySourceId, songsByUri, roundsBySourceId };
}

function buildRoundVoteRows(roundSourceId, seedLookups) {
  const round = seedLookups.roundsBySourceId.get(roundSourceId);
  const roundSubmissions = submissionPlan[roundSourceId] || [];
  const ballots = roundBallots[roundSourceId];
  const songUriByPlayerSourceId = new Map(
    roundSubmissions.map((submission) => [
      submission.playerSourceId,
      submission.songUri,
    ]),
  );

  if (!round) {
    throw new Error(`missing round lookup for votes: ${roundSourceId}`);
  }

  if (!ballots) {
    throw new Error(`missing ballot plan for votes: ${roundSourceId}`);
  }

  return Object.entries(ballots).flatMap(([voterSourceId, ballot]) => {
    const voter = seedLookups.playersBySourceId.get(voterSourceId);

    if (!voter) {
      throw new Error(`missing voter lookup: ${voterSourceId}`);
    }

    return ballot.map((vote) => {
      const songUri = songUriByPlayerSourceId.get(vote.targetPlayerSourceId);
      const song = seedLookups.songsByUri.get(songUri);

      if (!songUri || !song) {
        throw new Error(
          `missing target song lookup for vote target: ${vote.targetPlayerSourceId}`,
        );
      }

      return {
        roundId: round.id,
        voterId: voter.id,
        songId: song.id,
        pointsAssigned: vote.pointsAssigned,
        comment: vote.comment,
        votedAt: vote.votedAt,
        sourceImportId: null,
      };
    });
  });
}

async function seedScoredRoundVotes(roundSourceId, seedLookups) {
  const votes = buildRoundVoteRows(roundSourceId, seedLookups);

  for (const vote of votes) {
    await prisma.vote.upsert({
      where: {
        roundId_voterId_songId: {
          roundId: vote.roundId,
          voterId: vote.voterId,
          songId: vote.songId,
        },
      },
      update: {
        pointsAssigned: vote.pointsAssigned,
        comment: vote.comment,
        votedAt: vote.votedAt,
        sourceImportId: null,
      },
      create: vote,
    });
  }
}

async function computeRoundScoresAndRanks(roundId) {
  const scoreRows = await prisma.vote.groupBy({
    by: ["songId"],
    where: { roundId },
    _sum: {
      pointsAssigned: true,
    },
  });

  const rankedRows = scoreRows
    .map((row) => ({
      songId: row.songId,
      score: row._sum.pointsAssigned ?? null,
    }))
    .filter((row) => row.score !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.songId - right.songId;
    });

  const scoresAndRanksBySongId = new Map();
  let currentRank = 0;
  let previousScore = null;

  for (const row of rankedRows) {
    if (row.score !== previousScore) {
      currentRank += 1;
      previousScore = row.score;
    }

    scoresAndRanksBySongId.set(row.songId, {
      score: row.score,
      rank: currentRank,
    });
  }

  return scoresAndRanksBySongId;
}

async function seedSubmissionsForRound(roundSourceId, seedLookups, scoreMap) {
  const round = seedLookups.roundsBySourceId.get(roundSourceId);
  const roundSubmissions = submissionPlan[roundSourceId] || [];

  if (!round) {
    throw new Error(`missing round lookup for submissions: ${roundSourceId}`);
  }

  for (const submission of roundSubmissions) {
    const player = seedLookups.playersBySourceId.get(submission.playerSourceId);
    const song = seedLookups.songsByUri.get(submission.songUri);
    const computedScore = scoreMap.get(song?.id);
    const requiresComputedScore = Boolean(roundBallots[roundSourceId]);

    if (!player) {
      throw new Error(`missing player lookup: ${submission.playerSourceId}`);
    }

    if (!song) {
      throw new Error(`missing song lookup: ${submission.songUri}`);
    }

    if (requiresComputedScore && !computedScore) {
      throw new Error(
        `missing computed score for seeded scored round song: ${roundSourceId}/${song.id}`,
      );
    }

    await prisma.submission.upsert({
      where: {
        roundId_playerId_songId: {
          roundId: round.id,
          playerId: player.id,
          songId: song.id,
        },
      },
      update: {
        score: computedScore?.score ?? null,
        rank: computedScore?.rank ?? null,
        comment: submission.comment,
        visibleToVoters: false,
        submittedAt: submission.submittedAt,
        sourceImportId: null,
      },
      create: {
        roundId: round.id,
        playerId: player.id,
        songId: song.id,
        score: computedScore?.score ?? null,
        rank: computedScore?.rank ?? null,
        comment: submission.comment,
        visibleToVoters: false,
        submittedAt: submission.submittedAt,
        sourceImportId: null,
      },
    });
  }
}

async function main() {
  validateSeedPlan();
  const gamesBySourceId = await seedGames();
  await seedPlayers();
  const artistMap = await seedArtists();
  await seedSongs(artistMap);
  await seedRounds(gamesBySourceId);

  const seedLookups = await loadSeedLookups();

  for (const roundSourceId of Object.keys(roundBallots)) {
    await seedScoredRoundVotes(roundSourceId, seedLookups);
  }

  for (const round of rounds) {
    const seededRound = seedLookups.roundsBySourceId.get(round.sourceRoundId);
    const scoreMap = roundBallots[round.sourceRoundId]
      ? await computeRoundScoresAndRanks(seededRound.id)
      : new Map();

    await seedSubmissionsForRound(round.sourceRoundId, seedLookups, scoreMap);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
