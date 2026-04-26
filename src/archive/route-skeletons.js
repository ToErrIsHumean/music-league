const React = require("react");
const { PrismaClient } = require("@prisma/client");
const {
  derivePlayerPerformanceMetrics,
  isScoredSubmission,
} = require("./player-metrics");
const {
  buildGameHref,
  buildPlayerHref,
  buildRoundHref,
  buildRouteMetadata,
  buildSongHref,
  buildSongSearchHref,
  parsePositiveRouteId,
} = require("./route-utils");
const { deriveSongFamiliarity, sortSongMemoryHistory, sortSongMemoryHistoryNewestFirst } =
  require("./song-memory");
const {
  ARCHIVE_BADGE_VARIANTS,
  buildArchiveBadgeModel,
} = require("./archive-badges");
const {
  derivePlayerTrait,
  getSelectedGameMemoryBoard,
  selectPlayerNotablePicks,
} = require("./archive-utils");

const archiveDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function isPrismaClientLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.$disconnect === "function");
}

function resolveArchiveInput(input = {}) {
  if (isPrismaClientLike(input)) {
    return {
      prisma: input,
      ownsPrismaClient: false,
    };
  }

  return {
    prisma: input.prisma ?? new PrismaClient(),
    ownsPrismaClient: !input.prisma,
  };
}

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeQueryText(value) {
  const candidate = firstParam(value);

  return typeof candidate === "string" ? candidate.trim() : "";
}

function normalizeSearchParams(searchParams) {
  if (!searchParams || typeof searchParams !== "object") {
    return {};
  }

  return searchParams;
}

function resolveGameDisplayLabel(game) {
  return game?.displayName?.trim() || game?.sourceGameId || `Game ${game?.id ?? ""}`;
}

function compareNullableAscending(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNullableDescending(left, right) {
  return compareNullableAscending(right, left);
}

function compareRounds(left, right) {
  const sequenceComparison = compareNullableAscending(
    left.sequenceNumber ?? null,
    right.sequenceNumber ?? null,
  );

  if (sequenceComparison !== 0) {
    return sequenceComparison;
  }

  const occurredAtComparison = compareNullableAscending(
    left.occurredAt ?? null,
    right.occurredAt ?? null,
  );

  if (occurredAtComparison !== 0) {
    return occurredAtComparison;
  }

  return left.id - right.id;
}

function formatDate(value) {
  return value ? archiveDateFormatter.format(new Date(value)) : "Date TBD";
}

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatRank(rank) {
  return rank === null ? "Unranked" : `#${rank}`;
}

function formatScore(score) {
  return score === null ? "Score pending" : `${score} points`;
}

function formatRankBadgeLabel(rank, tied = false) {
  if (rank === null) {
    return "Unranked";
  }

  return tied ? `T${rank}` : `#${rank}`;
}

function getFamiliarityBadgeVariant(familiarity) {
  return familiarity?.kind === "debut" ? "familiarity-first-time" : "familiarity-returning";
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function getRoundDates(rounds) {
  const dates = rounds
    .map((round) => round.occurredAt)
    .filter((date) => date instanceof Date);

  if (dates.length === 0) {
    return {
      earliest: null,
      latest: null,
    };
  }

  return {
    earliest: dates.reduce((oldest, date) => (date < oldest ? date : oldest), dates[0]),
    latest: dates.reduce((newest, date) => (date > newest ? date : newest), dates[0]),
  };
}

function formatGameTimeframe(rounds) {
  const { earliest, latest } = getRoundDates(rounds);

  if (!earliest || !latest) {
    return "Imported round dates pending";
  }

  if (earliest.getTime() === latest.getTime()) {
    return formatDate(earliest);
  }

  return `${formatDate(earliest)} - ${formatDate(latest)}`;
}

function hasWinner(game, winnerFilter) {
  if (winnerFilter.length === 0) {
    return true;
  }

  const normalizedWinner = winnerFilter.toLocaleLowerCase();

  return game.rounds.some((round) =>
    round.submissions.some(
      (submission) =>
        submission.rank === 1 &&
        submission.player.displayName.toLocaleLowerCase().includes(normalizedWinner),
    ),
  );
}

function gameHasYear(game, yearFilter) {
  if (yearFilter === null) {
    return true;
  }

  return game.rounds.some((round) => round.occurredAt?.getUTCFullYear() === yearFilter);
}

function buildGameSummary(game) {
  const orderedRounds = [...game.rounds].sort(compareRounds);

  return {
    id: game.id,
    title: resolveGameDisplayLabel(game),
    finished: game.finished,
    timeframe: formatGameTimeframe(orderedRounds),
    roundCount: orderedRounds.length,
    href: buildGameHref(game.id),
  };
}

function flattenGameSubmissions(game) {
  return game.rounds.flatMap((round) =>
    round.submissions.map((submission) => ({
      ...submission,
      roundId: round.id,
      roundName: round.name,
      playerId: submission.player.id,
      playerName: submission.player.displayName,
    })),
  );
}

function buildGameLeaderboard(game) {
  const rowsByPlayer = new Map();

  for (const submission of flattenGameSubmissions(game)) {
    if (!isScoredSubmission(submission)) {
      continue;
    }

    const row = rowsByPlayer.get(submission.playerId) ?? {
      player: {
        id: submission.playerId,
        displayName: submission.playerName,
        href: buildPlayerHref(submission.playerId),
      },
      totalScore: 0,
      wins: 0,
      scoredSubmissionCount: 0,
      rank: null,
    };

    row.totalScore += submission.score;
    row.scoredSubmissionCount += 1;
    row.wins += submission.rank === 1 ? 1 : 0;
    rowsByPlayer.set(submission.playerId, row);
  }

  const rows = [...rowsByPlayer.values()].sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }

    return left.player.displayName.localeCompare(right.player.displayName);
  });

  let previousScore = null;
  let previousRank = 0;

  const scoreCounts = new Map();

  for (const row of rows) {
    scoreCounts.set(row.totalScore, (scoreCounts.get(row.totalScore) ?? 0) + 1);
  }

  return rows.map((row, index) => {
    const rank = previousScore === row.totalScore ? previousRank : index + 1;

    previousScore = row.totalScore;
    previousRank = rank;

    return {
      ...row,
      rank,
      tied: scoreCounts.get(row.totalScore) > 1,
    };
  });
}

function buildRoundHighlights(submissions) {
  const rankedSubmissions = submissions.filter((submission) => submission.rank !== null);
  const scoredSubmissions = submissions.filter((submission) => submission.score !== null);
  const highlights = [];

  if (rankedSubmissions.length > 0) {
    const winner = [...rankedSubmissions].sort((left, right) =>
      compareNullableAscending(left.rank, right.rank),
    )[0];

    highlights.push({
      id: "winner",
      label: "Winner",
      value: `${winner.player.displayName} with ${formatScore(winner.score)}`,
    });
  }

  if (scoredSubmissions.length > 0) {
    highlights.push({
      id: "scoring",
      label: "Scoring",
      value: `${formatCount(scoredSubmissions.length, "scored submission")} imported`,
    });
  }

  const unscoredCount = submissions.length - scoredSubmissions.length;

  if (unscoredCount > 0) {
    highlights.push({
      id: "pending",
      label: "Pending",
      value: `${formatCount(unscoredCount, "submission")} awaiting scoring`,
    });
  }

  return highlights.slice(0, 3);
}

function groupVotesBySongId(votes) {
  const votesBySongId = new Map();

  for (const vote of votes) {
    const songVotes = votesBySongId.get(vote.songId) ?? [];

    songVotes.push({
      id: vote.id,
      pointsAssigned: vote.pointsAssigned,
      comment: vote.comment,
      votedAt: vote.votedAt,
      voter: vote.voter,
    });
    votesBySongId.set(vote.songId, songVotes);
  }

  for (const songVotes of votesBySongId.values()) {
    songVotes.sort((left, right) => {
      if (right.pointsAssigned !== left.pointsAssigned) {
        return right.pointsAssigned - left.pointsAssigned;
      }

      return left.voter.displayName.localeCompare(right.voter.displayName);
    });
  }

  return votesBySongId;
}

function buildSongEvidenceRow(submission) {
  return {
    id: submission.id,
    songId: submission.song.id,
    artistId: submission.song.artist.id,
    playerId: submission.player.id,
    playerName: submission.player.displayName,
    roundId: submission.round.id,
    roundName: submission.round.name,
    roundOccurredAt: submission.round.occurredAt,
    roundSequenceNumber: submission.round.sequenceNumber,
    createdAt: submission.createdAt,
  };
}

function buildSongSummaryFacts(submissions) {
  const appearances = submissions.length;
  const games = new Set(submissions.map((submission) => submission.round.game.id));
  const submitters = new Set(submissions.map((submission) => submission.player.id));
  const rankedSubmissions = submissions.filter((submission) => submission.rank !== null);
  const bestFinish =
    rankedSubmissions.length === 0
      ? null
      : Math.min(...rankedSubmissions.map((submission) => submission.rank));

  return [
    `${formatCount(appearances, "appearance")} in the archive`,
    `${formatCount(games.size, "game")} represented`,
    `${formatCount(submitters.size, "submitter")} brought it`,
    bestFinish === null ? "Best finish pending" : `Best finish ${formatRank(bestFinish)}`,
  ];
}

function buildSongOriginLabels(exactSubmissions, artistSubmissions) {
  const orderedExact = sortSongMemoryHistory(exactSubmissions.map(buildSongEvidenceRow));
  const orderedArtist = sortSongMemoryHistory(artistSubmissions.map(buildSongEvidenceRow));
  const songOrigin = orderedExact[0] ?? null;
  const artistOrigin = orderedArtist[0] ?? null;
  const labels = [];

  if (songOrigin) {
    labels.push({
      id: "song-origin",
      label: "Song origin",
      value: `${songOrigin.playerName} in ${songOrigin.roundName}`,
    });
  }

  if (artistOrigin && artistOrigin.id !== songOrigin?.id) {
    labels.push({
      id: "artist-origin",
      label: "Artist origin",
      value: `${artistOrigin.playerName} first brought this artist in ${artistOrigin.roundName}`,
    });
  }

  return labels;
}

function buildRecallComment(submissions) {
  const orderedSubmissions = sortSongMemoryHistory(submissions.map(buildSongEvidenceRow));
  const originId = orderedSubmissions[0]?.id ?? null;
  const commentsById = new Map(
    submissions
      .filter((submission) => submission.comment)
      .map((submission) => [submission.id, submission.comment]),
  );
  const recall = sortSongMemoryHistoryNewestFirst(orderedSubmissions).find(
    (submission) => submission.id !== originId && commentsById.has(submission.id),
  );

  return recall ? commentsById.get(recall.id) : null;
}

function buildSongHistoryGroups(submissions) {
  const groupsByGameId = new Map();
  const orderedSubmissions = [...submissions].sort((left, right) => {
    const dateComparison = compareNullableDescending(
      left.round.occurredAt ?? null,
      right.round.occurredAt ?? null,
    );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return right.id - left.id;
  });

  for (const submission of orderedSubmissions) {
    const game = submission.round.game;
    const group = groupsByGameId.get(game.id) ?? {
      gameId: game.id,
      title: resolveGameDisplayLabel(game),
      href: buildGameHref(game.id),
      latestOccurredAt: submission.round.occurredAt ?? null,
      rows: [],
    };

    group.rows.push({
      id: submission.id,
      roundName: submission.round.name,
      roundHref: buildRoundHref(game.id, submission.round.id),
      submitterName: submission.player.displayName,
      submitterHref: buildPlayerHref(submission.player.id),
      rank: submission.rank,
      score: submission.score,
      comment: submission.comment,
      occurredAt: submission.round.occurredAt,
    });
    groupsByGameId.set(game.id, group);
  }

  return [...groupsByGameId.values()].sort((left, right) =>
    compareNullableDescending(left.latestOccurredAt, right.latestOccurredAt),
  );
}

function buildPlayerHistoryRows(submissions) {
  return [...submissions]
    .sort((left, right) => {
      const dateComparison = compareNullableDescending(
        left.round.occurredAt ?? null,
        right.round.occurredAt ?? null,
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return right.id - left.id;
    })
    .map((submission) => ({
      submissionId: submission.id,
      gameId: submission.round.game.id,
      gameTitle: resolveGameDisplayLabel(submission.round.game),
      gameHref: buildGameHref(submission.round.game.id),
      roundId: submission.round.id,
      roundName: submission.round.name,
      roundHref: buildRoundHref(submission.round.game.id, submission.round.id),
      occurredAt: submission.round.occurredAt,
      song: {
        id: submission.song.id,
        title: submission.song.title,
        artistName: submission.song.artist.name,
        href: buildSongHref(submission.song.id),
      },
      score: submission.score,
      rank: submission.rank,
      comment: submission.comment,
    }));
}

function buildPlayerMetricBaselines(metricsByPlayer) {
  const metricRows = [...metricsByPlayer.values()].filter(
    (metrics) =>
      metrics.scoredSubmissionCount > 0 && metrics.averageFinishPercentile !== null,
  );

  return {
    playerCount: metricRows.length,
    averageFinishPercentile:
      metricRows.length === 0
        ? 0
        : sum(metricRows.map((metrics) => metrics.averageFinishPercentile)) / metricRows.length,
    scoreStdDev:
      metricRows.length === 0
        ? 0
        : sum(metricRows.map((metrics) => metrics.rawScoreStdDev ?? 0)) / metricRows.length,
    winRate:
      metricRows.length === 0
        ? 0
        : sum(metricRows.map((metrics) => metrics.winRate ?? 0)) / metricRows.length,
  };
}

function buildPlayerTrait(playerId, allSubmissions) {
  const metricsByPlayer = derivePlayerPerformanceMetrics(
    allSubmissions.map((submission) => ({
      playerId: submission.playerId,
      roundId: submission.roundId,
      score: submission.score,
      rank: submission.rank,
    })),
  );
  const playerMetrics = metricsByPlayer.get(playerId);

  if (!playerMetrics || !playerMetrics.minimumSampleMet) {
    return null;
  }

  return derivePlayerTrait({
    playerMetrics,
    gameBaselines: buildPlayerMetricBaselines(metricsByPlayer),
  });
}

async function getLandingRouteData(input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);
  const searchParams = normalizeSearchParams(await input.searchParams);
  const requestedYear = normalizeQueryText(searchParams.year);
  const winnerFilter = normalizeQueryText(searchParams.winner);
  const yearFilter = /^\d{4}$/.test(requestedYear) ? Number.parseInt(requestedYear, 10) : null;

  try {
    const games = await prisma.game.findMany({
      select: {
        id: true,
        sourceGameId: true,
        displayName: true,
        finished: true,
        createdAt: true,
        rounds: {
          select: {
            id: true,
            occurredAt: true,
            sequenceNumber: true,
            submissions: {
              select: {
                rank: true,
                player: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const visibleGames = games
      .filter((game) => gameHasYear(game, yearFilter))
      .filter((game) => hasWinner(game, winnerFilter))
      .sort((left, right) => {
        const leftDates = getRoundDates(left.rounds);
        const rightDates = getRoundDates(right.rounds);
        const dateComparison = compareNullableDescending(leftDates.latest, rightDates.latest);

        if (dateComparison !== 0) {
          return dateComparison;
        }

        const createdAtComparison = compareNullableDescending(left.createdAt, right.createdAt);

        if (createdAtComparison !== 0) {
          return createdAtComparison;
        }

        return left.id - right.id;
      })
      .map(buildGameSummary);

    return {
      kind: "landing",
      title: "Music League Archive",
      description: "Browse current and completed Music League games.",
      currentGames: visibleGames.filter((game) => !game.finished),
      completedGames: visibleGames.filter((game) => game.finished),
      isEmpty: games.length === 0,
      filters: {
        year: yearFilter,
        winner: winnerFilter,
      },
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getGameRouteData(gameId, input = {}) {
  const parsedGameId = parsePositiveRouteId(gameId);

  if (parsedGameId === null) {
    return {
      kind: "game",
      title: "Game unavailable",
      description: "The requested Music League game could not be loaded.",
      status: "Invalid game ID.",
      statusHref: "/",
      statusLinkLabel: "Back to archive",
    };
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const game = await prisma.game.findUnique({
      where: { id: parsedGameId },
      select: {
        id: true,
        sourceGameId: true,
        displayName: true,
        finished: true,
        rounds: {
          select: {
            id: true,
            name: true,
            occurredAt: true,
            sequenceNumber: true,
            submissions: {
              select: {
                id: true,
                score: true,
                rank: true,
                player: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!game) {
      return {
        kind: "game",
        title: "Game unavailable",
        description: "The requested Music League game could not be found.",
        status: "Game not found.",
        statusHref: "/",
        statusLinkLabel: "Back to archive",
      };
    }

    const title = resolveGameDisplayLabel(game);
    const rounds = [...game.rounds].sort(compareRounds);
    const leaderboard = buildGameLeaderboard({ ...game, rounds });
    const memoryBoard = rounds.length === 0 ? null : await getSelectedGameMemoryBoard(game.id, { prisma });

    return {
      kind: "game",
      title,
      description: `${title} archive page.`,
      game: {
        id: game.id,
        title,
        finished: game.finished,
        timeframe: formatGameTimeframe(rounds),
        rounds: rounds.map((round) => ({
          id: round.id,
          name: round.name,
          occurredAt: round.occurredAt,
          href: buildRoundHref(game.id, round.id),
          submissionCount: round.submissions.length,
          isScored: round.submissions.some(
            (submission) => submission.score !== null || submission.rank !== null,
          ),
        })),
        leaderboard,
        pendingScoringCopy:
          leaderboard.length === 0
            ? "Scoring is pending for this game, so the leaderboard stays hidden until scored rounds are imported."
            : null,
        competitiveAnchor: memoryBoard?.board?.competitiveAnchor ?? null,
        memoryBoard: memoryBoard?.board ?? null,
      },
      status: rounds.length === 0 ? "This game has no imported round evidence yet." : null,
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getRoundRouteData(gameId, roundId, input = {}) {
  const parsedGameId = parsePositiveRouteId(gameId);
  const parsedRoundId = parsePositiveRouteId(roundId);

  if (parsedGameId === null) {
    return {
      kind: "round",
      title: "Round unavailable",
      description: "The requested Music League round could not be loaded.",
      status: "Invalid game ID.",
      statusHref: "/",
      statusLinkLabel: "Back to archive",
    };
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    if (parsedRoundId === null) {
      const game = await prisma.game.findUnique({
        where: { id: parsedGameId },
        select: { id: true },
      });

      return {
        kind: "round",
        title: "Round unavailable",
        description: "The requested Music League round could not be loaded.",
        status: "Invalid round ID.",
        statusHref: game ? buildGameHref(game.id) : "/",
        statusLinkLabel: game ? "Back to game" : "Back to archive",
      };
    }

    const [game, round] = await Promise.all([
      prisma.game.findUnique({
        where: { id: parsedGameId },
        select: {
          id: true,
          sourceGameId: true,
          displayName: true,
        },
      }),
      prisma.round.findUnique({
        where: { id: parsedRoundId },
        select: {
          id: true,
          name: true,
          description: true,
          occurredAt: true,
          playlistUrl: true,
          game: {
            select: {
              id: true,
              sourceGameId: true,
              displayName: true,
            },
          },
          submissions: {
            select: {
              id: true,
              score: true,
              rank: true,
              comment: true,
              player: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
              song: {
                select: {
                  id: true,
                  title: true,
                  artist: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          votes: {
            select: {
              id: true,
              songId: true,
              pointsAssigned: true,
              comment: true,
              votedAt: true,
              voter: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!game) {
      return {
        kind: "round",
        title: "Round unavailable",
        description: "The requested Music League round could not be loaded.",
        status: "Game not found.",
        statusHref: "/",
        statusLinkLabel: "Back to archive",
      };
    }

    if (!round) {
      return {
        kind: "round",
        title: "Round unavailable",
        description: "The requested Music League round could not be found.",
        status: "Round not found.",
        statusHref: buildGameHref(game.id),
        statusLinkLabel: "Back to game",
      };
    }

    const owningGameTitle = resolveGameDisplayLabel(round.game);

    if (round.game.id !== game.id) {
      return {
        kind: "round",
        title: "Round belongs to another game",
        description: "This Music League round belongs to a different game.",
        status: "Round belongs to another game.",
        statusHref: buildGameHref(round.game.id),
        statusLinkLabel: `Open ${owningGameTitle}`,
      };
    }

    const orderedSubmissions = [...round.submissions].sort((left, right) => {
      const rankComparison = compareNullableAscending(left.rank, right.rank);

      if (rankComparison !== 0) {
        return rankComparison;
      }

      return left.id - right.id;
    });
    const votesBySongId = groupVotesBySongId(round.votes);

    return {
      kind: "round",
      title: round.name,
      description: `${round.name} round page in ${resolveGameDisplayLabel(game)}.`,
      round: {
        id: round.id,
        name: round.name,
        description: round.description,
        occurredAt: round.occurredAt,
        playlistUrl: round.playlistUrl,
        game: {
          id: game.id,
          title: resolveGameDisplayLabel(game),
          href: buildGameHref(game.id),
        },
        highlights: buildRoundHighlights(orderedSubmissions),
        submissions: orderedSubmissions.map((submission) => ({
          ...submission,
          votes: votesBySongId.get(submission.song.id) ?? [],
        })),
      },
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getSongsRouteData(input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);
  const searchParams = normalizeSearchParams(await input.searchParams);
  const query = normalizeQueryText(searchParams.q);
  const rawFamiliarity = normalizeQueryText(searchParams.familiarity);
  const rawSort = normalizeQueryText(searchParams.sort);
  const familiarity = ["first-time", "returning"].includes(rawFamiliarity)
    ? rawFamiliarity
    : "all";
  const sort = ["most-appearances", "best-finish", "alphabetical"].includes(rawSort)
    ? rawSort
    : "most-recent";
  const invalidFamiliarity = rawFamiliarity.length > 0 && rawFamiliarity !== "all" && familiarity === "all";
  const invalidSort = rawSort.length > 0 && sort === "most-recent" && rawSort !== "most-recent";
  const normalizedQuery = query.toLocaleLowerCase();

  try {
    const songs = await prisma.song.findMany({
      select: {
        id: true,
        title: true,
        artist: {
          select: {
            name: true,
          },
        },
        submissions: {
          select: {
            rank: true,
            submittedAt: true,
            round: {
              select: {
                occurredAt: true,
              },
            },
          },
        },
      },
    });
    const rows = songs
      .map((song) => {
        const appearances = song.submissions.length;
        const mostRecentAppearance = song.submissions
          .map((submission) => submission.submittedAt ?? submission.round.occurredAt)
          .filter(Boolean)
          .sort((left, right) => right - left)[0];
        const rankedSubmissions = song.submissions.filter((submission) => submission.rank !== null);

        return {
          id: song.id,
          title: song.title,
          artistName: song.artist.name,
          href: buildSongHref(song.id),
          appearances,
          mostRecentAppearance,
          bestFinish:
            rankedSubmissions.length === 0
              ? null
              : Math.min(...rankedSubmissions.map((submission) => submission.rank)),
        };
      })
      .filter((song) => {
        if (normalizedQuery.length === 0) {
          return true;
        }

        return (
          song.title.toLocaleLowerCase().includes(normalizedQuery) ||
          song.artistName.toLocaleLowerCase().includes(normalizedQuery)
        );
      })
      .filter((song) => {
        if (familiarity === "first-time") {
          return song.appearances <= 1;
        }

        if (familiarity === "returning") {
          return song.appearances > 1;
        }

        return true;
      })
      .sort((left, right) => {
        if (sort === "most-appearances" && left.appearances !== right.appearances) {
          return right.appearances - left.appearances;
        }

        if (sort === "best-finish") {
          const finishComparison = compareNullableAscending(left.bestFinish, right.bestFinish);

          if (finishComparison !== 0) {
            return finishComparison;
          }
        }

        if (sort === "alphabetical") {
          const titleComparison = left.title.localeCompare(right.title);

          if (titleComparison !== 0) {
            return titleComparison;
          }
        } else {
          const recentComparison = compareNullableDescending(
            left.mostRecentAppearance ?? null,
            right.mostRecentAppearance ?? null,
          );

          if (recentComparison !== 0) {
            return recentComparison;
          }
        }

        return left.id - right.id;
      });

    return {
      kind: "songs",
      title: "Songs",
      description: "Search songs and artists in the Music League archive.",
      query,
      familiarity,
      sort,
      status: [
        invalidFamiliarity ? "Invalid familiarity filter reset to all songs." : null,
        invalidSort ? "Invalid sort reset to most recent." : null,
      ]
        .filter(Boolean)
        .join(" "),
      songs: rows,
      isEmpty: songs.length === 0,
      clearHref: buildSongSearchHref({}),
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getSongRouteData(songId, input = {}) {
  const parsedSongId = parsePositiveRouteId(songId);

  if (parsedSongId === null) {
    return {
      kind: "song",
      title: "Song unavailable",
      description: "The requested Music League song could not be loaded.",
      status: "Invalid song ID.",
      statusHref: "/songs",
      statusLinkLabel: "Back to songs",
    };
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const song = await prisma.song.findUnique({
      where: { id: parsedSongId },
      select: {
        id: true,
        title: true,
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
        submissions: {
          select: {
            id: true,
            rank: true,
            score: true,
            comment: true,
            submittedAt: true,
            createdAt: true,
            player: {
              select: {
                id: true,
                displayName: true,
              },
            },
            round: {
              select: {
                id: true,
                name: true,
                occurredAt: true,
                sequenceNumber: true,
                game: {
                  select: {
                    id: true,
                    sourceGameId: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!song || song.submissions.length === 0) {
      return {
        kind: "song",
        title: "Song unavailable",
        description: "The requested Music League song has no archive evidence.",
        status: "Song not found with submission evidence.",
        statusHref: "/songs",
        statusLinkLabel: "Back to songs",
      };
    }

    const artistSubmissions = await prisma.submission.findMany({
      where: {
        song: {
          artistId: song.artist.id,
        },
      },
      select: {
        id: true,
        rank: true,
        score: true,
        comment: true,
        submittedAt: true,
        createdAt: true,
        player: {
          select: {
            id: true,
            displayName: true,
          },
        },
        song: {
          select: {
            id: true,
            title: true,
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
            occurredAt: true,
            sequenceNumber: true,
            game: {
              select: {
                id: true,
                sourceGameId: true,
                displayName: true,
              },
            },
          },
        },
      },
    });
    const exactSubmissions = song.submissions.map((submission) => ({
      ...submission,
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
      },
    }));

    return {
      kind: "song",
      title: song.title,
      description: `${song.title} by ${song.artist.name} in the Music League archive.`,
      song: {
        id: song.id,
        title: song.title,
        artistName: song.artist.name,
        familiarity: deriveSongFamiliarity({
          songId: song.id,
          artistId: song.artist.id,
          originRoundId: null,
          originSubmissionId: null,
          exactSongSubmissions: exactSubmissions.map(buildSongEvidenceRow),
          artistSubmissions: artistSubmissions.map(buildSongEvidenceRow),
        }),
        summaryFacts: buildSongSummaryFacts(exactSubmissions),
        originLabels: buildSongOriginLabels(exactSubmissions, artistSubmissions),
        recallComment: buildRecallComment(exactSubmissions),
        historyGroups: buildSongHistoryGroups(exactSubmissions),
        submissions: exactSubmissions.sort((left, right) => {
          const leftDate = left.round.occurredAt ?? null;
          const rightDate = right.round.occurredAt ?? null;
          const dateComparison = compareNullableDescending(leftDate, rightDate);

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return right.id - left.id;
        }),
      },
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getPlayerRouteData(playerId, input = {}) {
  const parsedPlayerId = parsePositiveRouteId(playerId);
  const searchParams = normalizeSearchParams(await input.searchParams);
  const voteGameId = parsePositiveRouteId(searchParams.voteGameId);

  if (parsedPlayerId === null) {
    return {
      kind: "player",
      title: "Player unavailable",
      description: "The requested Music League player could not be loaded.",
      status: "Invalid player ID.",
      statusHref: "/",
      statusLinkLabel: "Back to archive",
    };
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const player = await prisma.player.findUnique({
      where: { id: parsedPlayerId },
      select: {
        id: true,
        displayName: true,
        submissions: {
          select: {
            id: true,
            rank: true,
            score: true,
            comment: true,
            createdAt: true,
            song: {
              select: {
                id: true,
                title: true,
                artist: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            round: {
              select: {
                id: true,
                name: true,
                occurredAt: true,
                sequenceNumber: true,
                game: {
                  select: {
                    id: true,
                    sourceGameId: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
        votes: {
          select: {
            id: true,
            pointsAssigned: true,
            round: {
              select: {
                id: true,
                gameId: true,
                name: true,
                occurredAt: true,
                game: {
                  select: {
                    id: true,
                    sourceGameId: true,
                    displayName: true,
                  },
                },
              },
            },
            song: {
              select: {
                id: true,
                title: true,
                artist: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!player) {
      return {
        kind: "player",
        title: "Player unavailable",
        description: "The requested Music League player could not be found.",
        status: "Player not found.",
        statusHref: "/",
        statusLinkLabel: "Back to archive",
      };
    }

    const submissionVoteTargets = player.submissions.map((submission) => ({
      roundId: submission.round.id,
      songId: submission.song.id,
    }));
    const [receivedVotes, allSubmissions] = await Promise.all([
      submissionVoteTargets.length === 0
        ? []
        : prisma.vote.findMany({
            where: {
              OR: submissionVoteTargets,
            },
            select: {
              id: true,
              pointsAssigned: true,
              comment: true,
              votedAt: true,
              voter: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
              round: {
                select: {
                  id: true,
                  gameId: true,
                  name: true,
                  occurredAt: true,
                  game: {
                    select: {
                      id: true,
                      sourceGameId: true,
                      displayName: true,
                    },
                  },
                },
              },
              song: {
                select: {
                  id: true,
                  title: true,
                  artist: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          }),
      prisma.submission.findMany({
        select: {
          playerId: true,
          roundId: true,
          score: true,
          rank: true,
        },
      }),
    ]);

    const hasScopedVoteEvidence =
      voteGameId !== null &&
      (player.submissions.some((submission) => submission.round.game.id === voteGameId) ||
        player.votes.some((vote) => vote.round.gameId === voteGameId) ||
        receivedVotes.some((vote) => vote.round.gameId === voteGameId));
    const visibleVotesGiven = hasScopedVoteEvidence
      ? player.votes.filter((vote) => vote.round.gameId === voteGameId)
      : player.votes;
    const visibleVotesReceived = hasScopedVoteEvidence
      ? receivedVotes.filter((vote) => vote.round.gameId === voteGameId)
      : receivedVotes;
    const history = buildPlayerHistoryRows(player.submissions);
    const scoredHistory = history.filter((submission) => isScoredSubmission(submission));
    const gameIds = new Set(player.submissions.map((submission) => submission.round.game.id));

    return {
      kind: "player",
      title: player.displayName,
      description: `${player.displayName} in the Music League archive.`,
      player: {
        id: player.id,
        displayName: player.displayName,
        voteGameId: hasScopedVoteEvidence ? voteGameId : null,
        aggregate: {
          submissionCount: player.submissions.length,
          scoredSubmissionCount: scoredHistory.length,
          gameCount: gameIds.size,
          votesGivenCount: player.votes.length,
          votesReceivedCount: receivedVotes.length,
          totalPointsGiven: sum(player.votes.map((vote) => vote.pointsAssigned)),
          totalPointsReceived: sum(receivedVotes.map((vote) => vote.pointsAssigned)),
        },
        trait: buildPlayerTrait(player.id, allSubmissions),
        notablePicks: selectPlayerNotablePicks(scoredHistory),
        submissions: history,
        votesGiven: [...visibleVotesGiven].sort((left, right) => {
          const dateComparison = compareNullableDescending(
            left.round.occurredAt ?? null,
            right.round.occurredAt ?? null,
          );

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return right.id - left.id;
        }),
        votesReceived: [...visibleVotesReceived].sort((left, right) => {
          const dateComparison = compareNullableDescending(
            left.round.occurredAt ?? null,
            right.round.occurredAt ?? null,
          );

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return right.id - left.id;
        }),
      },
      status:
        player.submissions.length === 0 && player.votes.length === 0 && receivedVotes.length === 0
          ? "No submissions or votes have been imported for this player yet."
          : null,
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function ArchiveHeader() {
  return React.createElement(
    "header",
    { className: "archive-route-header" },
    React.createElement("a", { href: "/", className: "archive-route-brand" }, "Music League Archive"),
    React.createElement(
      "nav",
      { "aria-label": "Archive routes" },
      React.createElement("a", { href: "/" }, "Games"),
      React.createElement("a", { href: "/songs" }, "Songs"),
    ),
  );
}

function ArchiveBadge({ variant, label, ariaLabel, href, rel, target }) {
  const badge = buildArchiveBadgeModel({ variant, label, ariaLabel });
  const props = {
    className: "archive-badge",
    "data-archive-badge-variant": badge.variant,
    "data-archive-badge-role": ARCHIVE_BADGE_VARIANTS[badge.variant].tokenRole,
    "aria-label": badge.ariaLabel ?? undefined,
  };

  if (href) {
    return React.createElement("a", { ...props, href, rel, target }, badge.label);
  }

  return React.createElement("span", props, badge.label);
}

function StatusNotice({ status, href, linkLabel }) {
  if (!status) {
    return null;
  }

  return React.createElement(
    "section",
    { className: "archive-route-status", "aria-live": "polite" },
    React.createElement("p", null, status),
    href
      ? React.createElement("a", { href }, linkLabel ?? "Continue")
      : null,
  );
}

function RouteList({ items, emptyCopy }) {
  if (items.length === 0) {
    return React.createElement("p", { className: "archive-route-empty" }, emptyCopy);
  }

  return React.createElement(
    "ul",
    { className: "archive-route-list" },
    items.map((item) =>
      React.createElement(
        "li",
        { key: item.id },
        React.createElement(
          "span",
          { className: "archive-route-list-main" },
          React.createElement("a", { href: item.href }, item.title ?? item.name),
          item.badge ? React.createElement(ArchiveBadge, item.badge) : null,
        ),
        item.meta ? React.createElement("span", null, item.meta) : null,
      ),
    ),
  );
}

function DefinitionList({ items }) {
  return React.createElement(
    "dl",
    { className: "archive-route-facts" },
    items.map((item) =>
      React.createElement(
        React.Fragment,
        { key: item.label },
        React.createElement("dt", null, item.label),
        React.createElement("dd", null, item.value),
      ),
    ),
  );
}

function SimpleTable({ caption, headers, rows, emptyCopy }) {
  if (rows.length === 0) {
    return React.createElement(
      "section",
      { className: "archive-route-section" },
      React.createElement("h2", null, caption),
      React.createElement("p", { className: "archive-route-empty" }, emptyCopy),
    );
  }

  return React.createElement(
    "section",
    { className: "archive-route-section" },
    React.createElement("h2", null, caption),
    React.createElement(
      "table",
      null,
      React.createElement(
        "thead",
        null,
        React.createElement(
          "tr",
          null,
          headers.map((header) => React.createElement("th", { key: header }, header)),
        ),
      ),
      React.createElement(
        "tbody",
        null,
        rows.map((row, index) =>
          React.createElement(
            "tr",
            { key: row.id ?? index },
            row.cells.map((cell, cellIndex) => React.createElement("td", { key: cellIndex }, cell)),
          ),
        ),
      ),
    ),
  );
}

function LandingContent({ data }) {
  if (data.isEmpty) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", null, "Music League Archive"),
      React.createElement(StatusNotice, {
        status: "No imported games yet. Search results will appear after songs are imported.",
      }),
    );
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("h1", null, "Music League Archive"),
    React.createElement(
      "section",
      { className: "archive-route-section" },
      React.createElement("h2", null, "Current games"),
      React.createElement(RouteList, {
        items: data.currentGames.map((game) => ({
          id: game.id,
          title: game.title,
          href: game.href,
          badge: { variant: "status-current" },
          meta: `${game.roundCount} rounds - ${game.timeframe}`,
        })),
        emptyCopy: "No current games in the archive.",
      }),
    ),
    React.createElement(
      "section",
      { className: "archive-route-section" },
      React.createElement("h2", null, "Completed games"),
      React.createElement(RouteList, {
        items: data.completedGames.map((game) => ({
          id: game.id,
          title: game.title,
          href: game.href,
          badge: { variant: "status-completed" },
          meta: `${game.roundCount} rounds - ${game.timeframe}`,
        })),
        emptyCopy: "No completed games match these filters.",
      }),
    ),
  );
}

function GameContent({ data }) {
  if (!data.game) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", null, data.title),
      React.createElement(StatusNotice, {
        status: data.status,
        href: data.statusHref,
        linkLabel: data.statusLinkLabel,
      }),
    );
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("h1", null, data.game.title),
    React.createElement(ArchiveBadge, {
      variant: data.game.finished ? "status-completed" : "status-current",
      label: data.game.finished ? "Completed game" : "Current game",
    }),
    React.createElement("p", null, data.game.timeframe),
    React.createElement(StatusNotice, { status: data.status }),
    data.status
      ? null
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(SimpleTable, {
            caption: "Leaderboard",
            headers: ["Rank", "Player", "Score", "Wins"],
            rows: data.game.leaderboard.map((row) => ({
              id: row.player.id,
              cells: [
                React.createElement(ArchiveBadge, {
                  variant: row.tied ? "rank-tie" : "rank-plain",
                  label: formatRankBadgeLabel(row.rank, row.tied),
                  ariaLabel: row.tied ? `Tied rank ${row.rank}` : `Rank ${row.rank}`,
                }),
                React.createElement("a", { href: row.player.href }, row.player.displayName),
                React.createElement(ArchiveBadge, {
                  variant: "score",
                  label: `${row.totalScore} points`,
                }),
                String(row.wins),
              ],
            })),
            emptyCopy: data.game.pendingScoringCopy ?? "No scored rounds imported for this game.",
          }),
          React.createElement(
            "section",
            { className: "archive-route-section" },
            React.createElement("h2", null, "Rounds"),
            React.createElement(RouteList, {
              items: data.game.rounds.map((round) => ({
                id: round.id,
                title: round.name,
                href: round.href,
                meta: `${round.submissionCount} submissions - ${formatDate(round.occurredAt)}`,
              })),
              emptyCopy: "No rounds imported for this game.",
            }),
          ),
          React.createElement(
            "section",
            { className: "archive-route-section" },
            React.createElement("h2", null, "Memory board"),
            data.game.memoryBoard?.moments?.length
              ? React.createElement(RouteList, {
                  items: data.game.memoryBoard.moments.map((moment) => ({
                    id: moment.id,
                    title: moment.title,
                    href: moment.href ?? buildGameHref(data.game.id),
                    meta: moment.copy,
                  })),
                  emptyCopy: "No memory-board moments are available.",
                })
              : React.createElement(
                  "p",
                  { className: "archive-route-empty" },
                  data.game.memoryBoard?.sparseState?.copy ??
                    "Memory-board evidence is not available for this game yet.",
                ),
          ),
          React.createElement(
            "section",
            { className: "archive-route-section" },
            React.createElement("h2", null, "Competitive anchor"),
            data.game.competitiveAnchor?.title
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement("p", null, data.game.competitiveAnchor.title),
                  data.game.competitiveAnchor.body
                    ? React.createElement("p", null, data.game.competitiveAnchor.body)
                    : null,
                )
              : React.createElement("p", null, "Competitive claims need complete scored evidence."),
          ),
        ),
  );
}

function RoundContent({ data }) {
  if (!data.round) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", null, data.title),
      React.createElement(StatusNotice, {
        status: data.status,
        href: data.statusHref,
        linkLabel: data.statusLinkLabel,
      }),
    );
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("p", null, React.createElement("a", { href: data.round.game.href }, data.round.game.title)),
    React.createElement("h1", null, data.round.name),
    data.round.description ? React.createElement("p", null, data.round.description) : null,
    React.createElement("p", null, formatDate(data.round.occurredAt)),
    data.round.playlistUrl
      ? React.createElement(ArchiveBadge, {
          variant: "playlist-link",
          label: "Open playlist",
          href: data.round.playlistUrl,
          rel: "noreferrer",
          target: "_blank",
        })
      : null,
    data.round.highlights.length
      ? React.createElement(DefinitionList, {
          items: data.round.highlights.map((highlight) => ({
            label: highlight.label,
            value: highlight.value,
          })),
        })
      : null,
    React.createElement("button", { type: "button" }, "Expand all votes"),
    React.createElement(
      "ol",
      { className: "archive-route-ranked-list" },
      data.round.submissions.map((submission) =>
        React.createElement(
          "li",
          { key: submission.id, id: `submission-${submission.id}` },
          React.createElement(
            "a",
            { href: buildSongHref(submission.song.id) },
            `${formatRank(submission.rank)} - ${submission.song.title}`,
          ),
          React.createElement(
            "p",
            null,
            `${submission.song.artist.name} - ${submission.player.displayName} - `,
            React.createElement(ArchiveBadge, {
              variant: "score",
              label: formatScore(submission.score),
            }),
          ),
          submission.comment ? React.createElement("p", null, submission.comment) : null,
          React.createElement(
            "details",
            null,
            React.createElement("summary", null, `${formatCount(submission.votes.length, "vote")} disclosed`),
            submission.votes.length === 0
              ? React.createElement("p", null, "No votes imported for this submission.")
              : React.createElement(
                  "ul",
                  null,
                  submission.votes.map((vote) =>
                    React.createElement(
                      "li",
                      { key: vote.id },
                      `${vote.voter.displayName}: ${vote.pointsAssigned} points${
                        vote.comment ? ` - ${vote.comment}` : ""
                      }`,
                    ),
                  ),
                ),
          ),
        ),
      ),
    ),
  );
}

function SongsContent({ data }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("h1", null, "Songs"),
    React.createElement(StatusNotice, { status: data.status }),
    React.createElement(
      "form",
      { action: "/songs", method: "get", className: "archive-route-controls" },
      React.createElement("label", null, "Search", React.createElement("input", { name: "q", defaultValue: data.query })),
      React.createElement(
        "label",
        null,
        "Familiarity",
        React.createElement(
          "select",
          { name: "familiarity", defaultValue: data.familiarity },
          React.createElement("option", { value: "all" }, "All"),
          React.createElement("option", { value: "first-time" }, "First-time"),
          React.createElement("option", { value: "returning" }, "Returning"),
        ),
      ),
      React.createElement(
        "label",
        null,
        "Sort",
        React.createElement(
          "select",
          { name: "sort", defaultValue: data.sort },
          React.createElement("option", { value: "most-recent" }, "Most recent"),
          React.createElement("option", { value: "most-appearances" }, "Most appearances"),
          React.createElement("option", { value: "best-finish" }, "Best finish"),
          React.createElement("option", { value: "alphabetical" }, "Alphabetical"),
        ),
      ),
      React.createElement("button", { type: "submit" }, "Apply"),
    ),
    React.createElement(
      "p",
      null,
      data.isEmpty
        ? "Import songs to populate the archive browser."
        : `${data.songs.length} matching songs - ${data.familiarity} - ${data.sort}`,
    ),
    data.songs.length === 0 && !data.isEmpty
      ? React.createElement("a", { href: data.clearHref }, "Clear filters")
      : null,
    React.createElement(RouteList, {
      items: data.songs.map((song) => ({
        id: song.id,
        title: song.title,
        href: song.href,
        badge: {
          variant: song.appearances <= 1 ? "familiarity-first-time" : "familiarity-returning",
        },
        meta: `${song.artistName} - ${song.appearances} appearances`,
      })),
      emptyCopy: data.isEmpty ? "No songs imported yet." : "No songs match these filters.",
    }),
  );
}

function SongContent({ data }) {
  if (!data.song) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", null, data.title),
      React.createElement(StatusNotice, {
        status: data.status,
        href: data.statusHref,
        linkLabel: data.statusLinkLabel,
      }),
    );
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("h1", null, data.song.title),
    React.createElement("p", null, data.song.artistName),
    React.createElement(
      "section",
      { className: "archive-route-section" },
      React.createElement("h2", null, "Familiarity"),
      React.createElement(
        "p",
        null,
        React.createElement(ArchiveBadge, {
          variant: getFamiliarityBadgeVariant(data.song.familiarity),
          label: data.song.familiarity.label,
        }),
        ` ${data.song.familiarity.shortSummary}`,
      ),
    ),
    React.createElement(DefinitionList, {
      items: data.song.summaryFacts.map((fact, index) => ({
        label: `Fact ${index + 1}`,
        value: fact,
      })),
    }),
    React.createElement(
      "section",
      { className: "archive-route-section" },
      React.createElement("h2", null, "Origins"),
      React.createElement(RouteList, {
        items: data.song.originLabels.map((origin) => ({
          id: origin.id,
          title: origin.label,
          href: buildSongHref(data.song.id),
          meta: origin.value,
        })),
        emptyCopy: "No origin labels are available.",
      }),
    ),
    data.song.recallComment
      ? React.createElement(
          "section",
          { className: "archive-route-section" },
          React.createElement("h2", null, "Recall comment"),
          React.createElement("p", null, data.song.recallComment),
        )
      : null,
    React.createElement(
      "section",
      { className: "archive-route-section" },
      React.createElement("h2", null, "Submission history"),
      data.song.historyGroups.map((group) =>
        React.createElement(
          "section",
          { key: group.gameId, className: "archive-route-subsection" },
          React.createElement("h3", null, React.createElement("a", { href: group.href }, group.title)),
          React.createElement(RouteList, {
            items: group.rows.map((row) => ({
              id: row.id,
              title: row.roundName,
              href: row.roundHref,
              meta: `${row.submitterName} - ${formatRank(row.rank)} - ${formatScore(row.score)}`,
            })),
            emptyCopy: "No rows in this game.",
          }),
        ),
      ),
    ),
  );
}

function PlayerContent({ data }) {
  if (!data.player) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", null, data.title),
      React.createElement(StatusNotice, {
        status: data.status,
        href: data.statusHref,
        linkLabel: data.statusLinkLabel,
      }),
    );
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("h1", null, data.player.displayName),
    React.createElement(StatusNotice, { status: data.status }),
    React.createElement(DefinitionList, {
      items: [
        {
          label: "Submissions",
          value: `${data.player.aggregate.submissionCount} total, ${data.player.aggregate.scoredSubmissionCount} scored`,
        },
        {
          label: "Games",
          value: String(data.player.aggregate.gameCount),
        },
        {
          label: "Votes given",
          value: `${data.player.aggregate.votesGivenCount} votes, ${data.player.aggregate.totalPointsGiven} points`,
        },
        {
          label: "Votes received",
          value: `${data.player.aggregate.votesReceivedCount} votes, ${data.player.aggregate.totalPointsReceived} points`,
        },
      ],
    }),
    data.player.trait
      ? React.createElement(
          "section",
          { className: "archive-route-section" },
          React.createElement("h2", null, "Trait"),
          React.createElement(
            "p",
            null,
            React.createElement(ArchiveBadge, {
              variant: "trait",
              label: "Trait",
              ariaLabel: data.player.trait.line,
            }),
            ` ${data.player.trait.line}`,
          ),
        )
      : null,
    React.createElement(
      "section",
      { className: "archive-route-section" },
      React.createElement("h2", null, "Notable picks"),
      data.player.notablePicks.best || data.player.notablePicks.worst
        ? React.createElement(RouteList, {
            items: [data.player.notablePicks.best, data.player.notablePicks.worst]
              .filter(Boolean)
              .map((submission, index) => ({
                id: `${index}-${submission.submissionId}`,
                title: index === 0 ? "Best pick" : "Toughest finish",
                href: submission.song.href,
                meta: `${submission.song.title} - ${formatRank(submission.rank)} - ${formatScore(submission.score)}`,
              })),
            emptyCopy: "No notable picks available.",
          })
        : React.createElement("p", { className: "archive-route-empty" }, "Notable picks need scored submissions."),
    ),
    React.createElement(
      "section",
      { className: "archive-route-section" },
      React.createElement("h2", null, "Submission history"),
      React.createElement(RouteList, {
        items: data.player.submissions.map((submission) => ({
          id: submission.submissionId,
          title: submission.song.title,
          href: submission.song.href,
          meta: `${submission.song.artistName} - ${submission.roundName} - ${formatRank(submission.rank)} - ${formatScore(submission.score)}`,
        })),
        emptyCopy: "No submissions imported for this player.",
      }),
    ),
    React.createElement(SimpleTable, {
      caption: data.player.voteGameId ? "Votes given in selected game" : "Votes given",
      headers: ["Round", "Song", "Points", "Comment"],
      rows: data.player.votesGiven.map((vote) => ({
        id: vote.id,
        cells: [
          React.createElement("a", { href: buildRoundHref(vote.round.game.id, vote.round.id) }, vote.round.name),
          React.createElement("a", { href: buildSongHref(vote.song.id) }, vote.song.title),
          String(vote.pointsAssigned),
          vote.comment ?? "",
        ],
      })),
      emptyCopy: "No votes given in this scope.",
    }),
    React.createElement(SimpleTable, {
      caption: data.player.voteGameId ? "Votes received in selected game" : "Votes received",
      headers: ["Round", "Song", "Points", "Voter"],
      rows: data.player.votesReceived.map((vote) => ({
        id: vote.id,
        cells: [
          React.createElement("a", { href: buildRoundHref(vote.round.game.id, vote.round.id) }, vote.round.name),
          React.createElement("a", { href: buildSongHref(vote.song.id) }, vote.song.title),
          String(vote.pointsAssigned),
          vote.voter.displayName,
        ],
      })),
      emptyCopy: "No votes received in this scope.",
    }),
  );
}

function ArchiveRoutePage({ data }) {
  const contentByKind = {
    landing: LandingContent,
    game: GameContent,
    round: RoundContent,
    songs: SongsContent,
    song: SongContent,
    player: PlayerContent,
  };
  const Content = contentByKind[data.kind] ?? LandingContent;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(ArchiveHeader),
    React.createElement(
      "main",
      { className: "archive-route-page" },
      React.createElement(Content, { data }),
    ),
  );
}

module.exports = {
  ArchiveRoutePage,
  buildRouteMetadata,
  getGameRouteData,
  getLandingRouteData,
  getPlayerRouteData,
  getRoundRouteData,
  getSongRouteData,
  getSongsRouteData,
};
