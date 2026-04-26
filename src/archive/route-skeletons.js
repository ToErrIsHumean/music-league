const React = require("react");
const {
  derivePlayerPerformanceMetrics,
  isScoredSubmission,
} = require("./player-metrics");
const {
  buildGameHref,
  buildRoundHref,
  buildRouteMetadata,
  buildSongHref,
  buildSongSearchHref,
  parsePositiveRouteId,
} = require("./route-utils");
const {
  ARCHIVE_BADGE_VARIANTS,
  buildArchiveBadgeModel,
} = require("./archive-badges");
const { ArchiveShell } = require("./archive-shell");
const { LandingContent } = require("./landing-page-content");
const {
  derivePlayerTrait,
  getSelectedGameMemoryBoard,
  selectPlayerNotablePicks,
} = require("./archive-utils");
const {
  compareGameRoundAscending,
  compareNullableAscending,
  compareNullableDescending,
  compareSongAppearanceDescending,
  deriveArchiveSongFamiliarity,
  deriveGameRoundListItems,
  deriveGameTimeframe,
  deriveLeaderboardRows,
  deriveSongAppearanceFacts,
  getSongCatalog,
  mapVotesToRoundSubmissions,
  normalizeArchiveSearch,
  resolveArchiveInput,
} = require("./m8-derivations");

const archiveDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

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

function compareRounds(left, right) {
  return compareGameRoundAscending(left, right);
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
  return familiarity?.kind === "first-time" || familiarity?.kind === "debut"
    ? "familiarity-first-time"
    : "familiarity-returning";
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function getRoundDates(rounds) {
  const timeframe = deriveGameTimeframe({
    rounds,
    submissions: rounds.flatMap((round) => {
      return (round.submissions ?? []).map((submission) => ({
        submittedAt: submission.submittedAt ?? null,
      }));
    }),
    votes: rounds.flatMap((round) => {
      return (round.votes ?? []).map((vote) => ({
        votedAt: vote.votedAt ?? null,
      }));
    }),
  });

  return {
    earliest: timeframe?.start ?? null,
    latest: timeframe?.end ?? null,
  };
}

function formatGameTimeframe(rounds) {
  return deriveGameTimeframe({
    rounds,
    submissions: rounds.flatMap((round) => round.submissions ?? []),
    votes: rounds.flatMap((round) => round.votes ?? []),
  })?.label ?? null;
}

function getGameTimeframe(game) {
  return deriveGameTimeframe({
    rounds: game.rounds ?? [],
    submissions: (game.rounds ?? []).flatMap((round) => round.submissions ?? []),
    votes: (game.rounds ?? []).flatMap((round) => round.votes ?? []),
  });
}

function compareStableGameFallback(left, right) {
  const leftSourceId = typeof left.sourceGameId === "string" ? left.sourceGameId : "";
  const rightSourceId = typeof right.sourceGameId === "string" ? right.sourceGameId : "";

  if (leftSourceId && rightSourceId && leftSourceId !== rightSourceId) {
    return leftSourceId.localeCompare(rightSourceId);
  }

  if (leftSourceId && !rightSourceId) {
    return -1;
  }

  if (!leftSourceId && rightSourceId) {
    return 1;
  }

  return left.id - right.id;
}

function compareLandingGames(left, right) {
  let dateComparison = 0;

  if (left.timeframeEnd && right.timeframeEnd) {
    dateComparison = right.timeframeEnd.getTime() - left.timeframeEnd.getTime();
  } else if (left.timeframeEnd) {
    dateComparison = -1;
  } else if (right.timeframeEnd) {
    dateComparison = 1;
  }

  return dateComparison !== 0 ? dateComparison : compareStableGameFallback(left, right);
}

function normalizeLandingYearFilter(value) {
  const requestedYear = normalizeQueryText(value);

  return /^\d{4}$/.test(requestedYear) ? requestedYear : null;
}

function normalizeLandingWinnerFilter(value) {
  const requestedWinner = normalizeQueryText(value);

  return normalizeArchiveSearch(requestedWinner).length > 0 ? requestedWinner : null;
}

function timeframeIntersectsYear(timeframe, year) {
  if (year === null) {
    return year === null;
  }

  if (!timeframe?.start || !timeframe?.end) {
    return false;
  }

  const numericYear = Number.parseInt(year, 10);

  return (
    timeframe.start.getUTCFullYear() <= numericYear &&
    timeframe.end.getUTCFullYear() >= numericYear
  );
}

function getGameWinnerRows(game) {
  const leaderboard = deriveLeaderboardRows(
    (game.rounds ?? []).flatMap((round) =>
      (round.submissions ?? []).map((submission) => ({
        playerId: submission.player?.id ?? submission.playerId ?? null,
        playerName: submission.player?.displayName ?? submission.playerName ?? "Unknown player",
        score: submission.score,
        rank: submission.rank,
      })),
    ),
  );

  return leaderboard.rows.filter((row) => row.rank === 1);
}

function formatWinnerLabel(game) {
  const winnerRows = getGameWinnerRows(game);

  if (winnerRows.length === 0) {
    return null;
  }

  const winnerNames = winnerRows.map((row) => row.player.displayName);

  return winnerNames.length === 1 ? winnerNames[0] : `${winnerNames.join(", ")} tied`;
}

function buildLandingGameCard(game) {
  const timeframe = getGameTimeframe(game);
  const rounds = game.rounds ?? [];
  const winnerLabel = formatWinnerLabel(game);

  return {
    gameId: game.id,
    displayName: resolveGameDisplayLabel(game),
    status: game.finished ? "Completed" : "Current",
    timeframeLabel: timeframe?.label ?? null,
    timeframeStart: timeframe?.start ?? null,
    timeframeEnd: timeframe?.end ?? null,
    roundCount: rounds.length,
    scoredRoundCount: rounds.filter((round) =>
      (round.submissions ?? []).some((submission) => submission.score !== null),
    ).length,
    winnerLabel,
    winnerSearchText: normalizeArchiveSearch(winnerLabel ?? ""),
    href: buildGameHref(game.id),
    sourceGameId: game.sourceGameId,
  };
}

function stripLandingSortFields(card) {
  const { timeframeStart, timeframeEnd, sourceGameId, winnerSearchText, ...serializableCard } = card;

  return serializableCard;
}

function applyCompletedGameFilters(games, filters) {
  const normalizedWinner = normalizeArchiveSearch(filters.winner ?? "");

  return games
    .filter((game) => timeframeIntersectsYear({ start: game.timeframeStart, end: game.timeframeEnd }, filters.year))
    .filter((game) =>
      normalizedWinner.length === 0 ? true : game.winnerSearchText.includes(normalizedWinner),
    );
}

function buildGameContext(game) {
  if (!game?.id) {
    return null;
  }

  return {
    gameId: game.id,
    displayName: resolveGameDisplayLabel(game),
    href: buildGameHref(game.id),
  };
}

function buildGameSwitcherItem(game) {
  const orderedRounds = [...(game.rounds ?? [])].sort(compareRounds);

  return {
    gameId: game.id,
    displayName: resolveGameDisplayLabel(game),
    status: game.finished ? "Completed" : "Current",
    timeframeLabel: formatGameTimeframe(orderedRounds),
    href: buildGameHref(game.id),
  };
}

function compareGameSwitcherItems(left, right) {
  const leftLatest = getRoundDates(left.rounds ?? []).latest;
  const rightLatest = getRoundDates(right.rounds ?? []).latest;
  const latestComparison = compareNullableDescending(leftLatest, rightLatest);

  if (latestComparison !== 0) {
    return latestComparison;
  }

  return resolveGameDisplayLabel(left).localeCompare(resolveGameDisplayLabel(right));
}

async function getArchiveShellData({
  activeRoute,
  gameContext = null,
  searchParams,
  input = {},
} = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);
  const normalizedParams = normalizeSearchParams(await searchParams);

  try {
    const games = await prisma.game.findMany({
      select: {
        id: true,
        sourceGameId: true,
        displayName: true,
        finished: true,
        rounds: {
          select: {
            id: true,
            occurredAt: true,
            sequenceNumber: true,
            submissions: {
              select: {
                submittedAt: true,
              },
            },
            votes: {
              select: {
                votedAt: true,
              },
            },
          },
        },
      },
    });
    const switcherItems = [...games].sort(compareGameSwitcherItems).map(buildGameSwitcherItem);

    return {
      activeRoute,
      gameContext,
      search: {
        value: normalizeArchiveSearch(normalizedParams.q),
        submitHrefBase: "/songs",
        suggestions: [],
      },
      switcher: {
        currentGames: switcherItems.filter((game) => game.status === "Current"),
        completedGames: switcherItems.filter((game) => game.status === "Completed"),
        selectedGameId: gameContext?.gameId ?? null,
        backToGame: null,
      },
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function withArchiveShellData(routeData, shellOptions) {
  return {
    ...routeData,
    shell: await getArchiveShellData(shellOptions),
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
  return deriveLeaderboardRows(flattenGameSubmissions(game));
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
  const songOrigin = deriveSongAppearanceFacts(exactSubmissions).firstAppearance;
  const artistOrigin = deriveSongAppearanceFacts(artistSubmissions).firstAppearance;
  const labels = [];

  if (songOrigin) {
    labels.push({
      id: "song-origin",
      label: "Song origin",
      value: `${songOrigin.submitterName} in ${songOrigin.roundName}`,
    });
  }

  if (artistOrigin && artistOrigin.id !== songOrigin?.id) {
    labels.push({
      id: "artist-origin",
      label: "Artist origin",
      value: `${artistOrigin.submitterName} first brought this artist in ${artistOrigin.roundName}`,
    });
  }

  return labels;
}

function buildRecallComment(submissions) {
  const appearanceFacts = deriveSongAppearanceFacts(submissions);
  const originId = appearanceFacts.firstAppearance?.id ?? null;
  const commentsById = new Map(
    submissions
      .filter((submission) => submission.comment)
      .map((submission) => [submission.id, submission.comment]),
  );
  const recall = [...submissions].sort(compareSongAppearanceDescending).find(
    (submission) => submission.id !== originId && commentsById.has(submission.id),
  );

  return recall ? commentsById.get(recall.id) : null;
}

function buildSongHistoryGroups(submissions) {
  return deriveSongAppearanceFacts(submissions).historyGroups;
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

  try {
    const landingPageData = await loadLandingPageData({
      prisma,
      year: searchParams.year,
      winner: searchParams.winner,
    });

    return await withArchiveShellData({
      kind: "landing",
      title: "Music League Archive",
      description: "Browse current and completed Music League games.",
      ...landingPageData,
    }, {
      activeRoute: "landing",
      gameContext: null,
      searchParams,
      input: { prisma },
    });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function loadLandingPageData({ prisma, year, winner }) {
  const filters = {
    year: normalizeLandingYearFilter(year),
    winner: normalizeLandingWinnerFilter(winner),
  };
  const games = await prisma.game.findMany({
    select: {
      id: true,
      sourceGameId: true,
      displayName: true,
      finished: true,
      rounds: {
        select: {
          id: true,
          occurredAt: true,
          sequenceNumber: true,
          submissions: {
            select: {
              score: true,
              rank: true,
              submittedAt: true,
              playerId: true,
              player: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
          votes: {
            select: {
              votedAt: true,
            },
          },
        },
      },
    },
  });
  const cards = games.map(buildLandingGameCard);
  const currentGames = cards
    .filter((game) => game.status === "Current")
    .sort(compareLandingGames)
    .map(stripLandingSortFields);
  const completedCorpus = cards
    .filter((game) => game.status === "Completed")
    .sort(compareLandingGames);
  const filteredCompletedGames = applyCompletedGameFilters(completedCorpus, filters);
  const completedTotal = filteredCompletedGames.length;

  return {
    currentGames,
    completedGames: filteredCompletedGames.map(stripLandingSortFields),
    completedTotal,
    completedVisibleCount: Math.min(100, completedTotal),
    completedCorpusCount: completedCorpus.length,
    showCompletedFilters: completedCorpus.length > 30,
    filters,
    isEmpty: games.length === 0,
  };
}

async function getLandingPageData({ year, winner, input } = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input ?? {});

  try {
    return await loadLandingPageData({ prisma, year, winner });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getGameRouteData(gameId, input = {}) {
  const parsedGameId = parsePositiveRouteId(gameId);

  if (parsedGameId === null) {
    return await withArchiveShellData({
      kind: "game",
      title: "Game unavailable",
      description: "The requested Music League game could not be loaded.",
      status: "Invalid game ID.",
      statusHref: "/",
      statusLinkLabel: "Back to archive",
    }, {
      activeRoute: "game",
      gameContext: null,
      input,
    });
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
            playlistUrl: true,
            sequenceNumber: true,
            submissions: {
              select: {
                id: true,
                songId: true,
                playerId: true,
                score: true,
                rank: true,
                submittedAt: true,
                player: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            },
            votes: {
              select: {
                votedAt: true,
              },
            },
          },
        },
      },
    });

    if (!game) {
      return await withArchiveShellData({
        kind: "game",
        title: "Game unavailable",
        description: "The requested Music League game could not be found.",
        status: "Game not found.",
        statusHref: "/",
        statusLinkLabel: "Back to archive",
      }, {
        activeRoute: "game",
        gameContext: null,
        input: { prisma },
      });
    }

    const title = resolveGameDisplayLabel(game);
    const rounds = [...game.rounds].sort(compareRounds);
    const leaderboard = buildGameLeaderboard({ ...game, rounds });
    const memoryBoard = rounds.length === 0 ? null : await getSelectedGameMemoryBoard(game.id, { prisma });

    return await withArchiveShellData({
      kind: "game",
      title,
      description: `${title} archive page.`,
      game: {
        id: game.id,
        title,
        finished: game.finished,
        timeframe: formatGameTimeframe(rounds),
        rounds: deriveGameRoundListItems({ gameId: game.id, rounds }),
        leaderboard: leaderboard.rows,
        leaderboardFootnote: leaderboard.footnote,
        hasLeaderboardTies: leaderboard.hasTies,
        pendingScoringCopy:
          leaderboard.rows.length === 0
            ? "Scoring is pending for this game, so the leaderboard stays hidden until scored rounds are imported."
            : null,
        competitiveAnchor: memoryBoard?.board?.competitiveAnchor ?? null,
        memoryBoard: memoryBoard?.board ?? null,
      },
      status: rounds.length === 0 ? "This game has no imported round evidence yet." : null,
    }, {
      activeRoute: "game",
      gameContext: buildGameContext(game),
      input: { prisma },
    });
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
    return await withArchiveShellData({
      kind: "round",
      title: "Round unavailable",
      description: "The requested Music League round could not be loaded.",
      status: "Invalid game ID.",
      statusHref: "/",
      statusLinkLabel: "Back to archive",
    }, {
      activeRoute: "round",
      gameContext: null,
      input,
    });
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    if (parsedRoundId === null) {
      const game = await prisma.game.findUnique({
        where: { id: parsedGameId },
        select: { id: true, sourceGameId: true, displayName: true },
      });

      return await withArchiveShellData({
        kind: "round",
        title: "Round unavailable",
        description: "The requested Music League round could not be loaded.",
        status: "Invalid round ID.",
        statusHref: game ? buildGameHref(game.id) : "/",
        statusLinkLabel: game ? "Back to game" : "Back to archive",
      }, {
        activeRoute: "round",
        gameContext: buildGameContext(game),
        input: { prisma },
      });
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
              roundId: true,
              songId: true,
              playerId: true,
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
              roundId: true,
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
      return await withArchiveShellData({
        kind: "round",
        title: "Round unavailable",
        description: "The requested Music League round could not be loaded.",
        status: "Game not found.",
        statusHref: "/",
        statusLinkLabel: "Back to archive",
      }, {
        activeRoute: "round",
        gameContext: null,
        input: { prisma },
      });
    }

    if (!round) {
      return await withArchiveShellData({
        kind: "round",
        title: "Round unavailable",
        description: "The requested Music League round could not be found.",
        status: "Round not found.",
        statusHref: buildGameHref(game.id),
        statusLinkLabel: "Back to game",
      }, {
        activeRoute: "round",
        gameContext: buildGameContext(game),
        input: { prisma },
      });
    }

    const owningGameTitle = resolveGameDisplayLabel(round.game);

    if (round.game.id !== game.id) {
      return await withArchiveShellData({
        kind: "round",
        title: "Round belongs to another game",
        description: "This Music League round belongs to a different game.",
        status: "Round belongs to another game.",
        statusHref: buildGameHref(round.game.id),
        statusLinkLabel: `Open ${owningGameTitle}`,
      }, {
        activeRoute: "round",
        gameContext: buildGameContext(round.game),
        input: { prisma },
      });
    }

    const orderedSubmissions = [...round.submissions].sort((left, right) => {
      const rankComparison = compareNullableAscending(left.rank, right.rank);

      if (rankComparison !== 0) {
        return rankComparison;
      }

      return left.id - right.id;
    });
    const { votesBySubmissionId } = mapVotesToRoundSubmissions({
      submissions: orderedSubmissions.map((submission) => ({
        id: submission.id,
        roundId: submission.roundId,
        songId: submission.songId,
        playerId: submission.playerId,
      })),
      votes: round.votes,
    });
    const formatSubmissionVotes = (submission) => {
      return [...(votesBySubmissionId.get(submission.id) ?? [])]
        .sort((left, right) => {
          if (right.pointsAssigned !== left.pointsAssigned) {
            return right.pointsAssigned - left.pointsAssigned;
          }

          return left.voter.displayName.localeCompare(right.voter.displayName);
        })
        .map((vote) => ({
          id: vote.id,
          pointsAssigned: vote.pointsAssigned,
          comment: vote.comment,
          votedAt: vote.votedAt,
          voter: vote.voter,
        }));
    };

    return await withArchiveShellData({
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
          votes: formatSubmissionVotes(submission),
        })),
      },
    }, {
      activeRoute: "round",
      gameContext: buildGameContext(game),
      input: { prisma },
    });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getSongsRouteData(input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);
  const searchParams = normalizeSearchParams(await input.searchParams);
  const rawFamiliarity = normalizeArchiveSearch(searchParams.familiarity);
  const rawSort = normalizeArchiveSearch(searchParams.sort);
  const invalidFamiliarity =
    rawFamiliarity.length > 0 && !["all", "first-time", "returning"].includes(rawFamiliarity);
  const invalidSort =
    rawSort.length > 0 &&
    !["most-appearances", "most-recent", "best-finish", "alphabetical"].includes(rawSort);

  try {
    const catalog = await getSongCatalog({
      q: searchParams.q,
      familiarity: searchParams.familiarity,
      sort: searchParams.sort,
      input: { prisma },
    });

    return await withArchiveShellData({
      kind: "songs",
      title: "Songs",
      description: "Search songs and artists in the Music League archive.",
      query: catalog.q,
      familiarity: catalog.familiarity,
      sort: catalog.sort,
      status: [
        invalidFamiliarity ? "Invalid familiarity filter reset to all songs." : null,
        invalidSort ? "Invalid sort reset to most recent." : null,
      ]
        .filter(Boolean)
        .join(" "),
      songs: catalog.rows,
      isEmpty: catalog.isEmpty,
      isZeroResult: catalog.isZeroResult,
      clearHref: buildSongSearchHref({}),
    }, {
      activeRoute: "songs",
      gameContext: null,
      searchParams,
      input: { prisma },
    });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getSongRouteData(songId, input = {}) {
  const parsedSongId = parsePositiveRouteId(songId);

  if (parsedSongId === null) {
    return await withArchiveShellData({
      kind: "song",
      title: "Song unavailable",
      description: "The requested Music League song could not be loaded.",
      status: "Invalid song ID.",
      statusHref: "/songs",
      statusLinkLabel: "Back to songs",
    }, {
      activeRoute: "song",
      gameContext: null,
      input,
    });
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
            roundId: true,
            songId: true,
            playerId: true,
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
      return await withArchiveShellData({
        kind: "song",
        title: "Song unavailable",
        description: "The requested Music League song has no archive evidence.",
        status: "Song not found with submission evidence.",
        statusHref: "/songs",
        statusLinkLabel: "Back to songs",
      }, {
        activeRoute: "song",
        gameContext: null,
        input: { prisma },
      });
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

    return await withArchiveShellData({
      kind: "song",
      title: song.title,
      description: `${song.title} by ${song.artist.name} in the Music League archive.`,
      song: {
        id: song.id,
        title: song.title,
        artistName: song.artist.name,
        familiarity: deriveArchiveSongFamiliarity(song.id, exactSubmissions),
        summaryFacts: buildSongSummaryFacts(exactSubmissions),
        originLabels: buildSongOriginLabels(exactSubmissions, artistSubmissions),
        recallComment: buildRecallComment(exactSubmissions),
        historyGroups: buildSongHistoryGroups(exactSubmissions),
        submissions: exactSubmissions.sort(compareSongAppearanceDescending),
      },
    }, {
      activeRoute: "song",
      gameContext: null,
      input: { prisma },
    });
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
    return await withArchiveShellData({
      kind: "player",
      title: "Player unavailable",
      description: "The requested Music League player could not be loaded.",
      status: "Invalid player ID.",
      statusHref: "/",
      statusLinkLabel: "Back to archive",
    }, {
      activeRoute: "player",
      gameContext: null,
      searchParams,
      input,
    });
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
            roundId: true,
            songId: true,
            playerId: true,
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
      return await withArchiveShellData({
        kind: "player",
        title: "Player unavailable",
        description: "The requested Music League player could not be found.",
        status: "Player not found.",
        statusHref: "/",
        statusLinkLabel: "Back to archive",
      }, {
        activeRoute: "player",
        gameContext: null,
        searchParams,
        input: { prisma },
      });
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
              roundId: true,
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
          id: true,
          playerId: true,
          roundId: true,
          songId: true,
          score: true,
          rank: true,
        },
      }),
    ]);
    const { submissionByVoteId } = mapVotesToRoundSubmissions({
      submissions: player.submissions.map((submission) => ({
        id: submission.id,
        roundId: submission.roundId,
        songId: submission.songId,
        playerId: submission.playerId,
      })),
      votes: receivedVotes,
    });
    const attributedReceivedVotes = receivedVotes.map((vote) => ({
      ...vote,
      submissionId: submissionByVoteId.get(vote.id).id,
    }));

    const hasScopedVoteEvidence =
      voteGameId !== null &&
      (player.submissions.some((submission) => submission.round.game.id === voteGameId) ||
        player.votes.some((vote) => vote.round.gameId === voteGameId) ||
        attributedReceivedVotes.some((vote) => vote.round.gameId === voteGameId));
    const visibleVotesGiven = hasScopedVoteEvidence
      ? player.votes.filter((vote) => vote.round.gameId === voteGameId)
      : player.votes;
    const visibleVotesReceived = hasScopedVoteEvidence
      ? attributedReceivedVotes.filter((vote) => vote.round.gameId === voteGameId)
      : attributedReceivedVotes;
    const history = buildPlayerHistoryRows(player.submissions);
    const scoredHistory = history.filter((submission) => isScoredSubmission(submission));
    const gameIds = new Set(player.submissions.map((submission) => submission.round.game.id));

    return await withArchiveShellData({
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
          votesReceivedCount: attributedReceivedVotes.length,
          totalPointsGiven: sum(player.votes.map((vote) => vote.pointsAssigned)),
          totalPointsReceived: sum(attributedReceivedVotes.map((vote) => vote.pointsAssigned)),
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
        player.submissions.length === 0 && player.votes.length === 0 && attributedReceivedVotes.length === 0
          ? "No submissions or votes have been imported for this player yet."
          : null,
    }, {
      activeRoute: "player",
      gameContext: null,
      searchParams,
      input: { prisma },
    });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
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
      React.createElement("caption", null, caption),
      React.createElement(
        "thead",
        null,
        React.createElement(
          "tr",
          null,
          headers.map((header) => React.createElement("th", { key: header, scope: "col" }, header)),
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
    data.game.timeframe ? React.createElement("p", null, data.game.timeframe) : null,
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
          data.game.leaderboardFootnote
            ? React.createElement(
                "p",
                { className: "archive-route-footnote", role: "note" },
                data.game.leaderboardFootnote,
              )
            : null,
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
          variant: getFamiliarityBadgeVariant(song.familiarity),
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
    ArchiveShell,
    {
      ...(data.shell ?? {
        activeRoute: data.kind,
        gameContext: null,
        search: { value: "", submitHrefBase: "/songs", suggestions: [] },
        switcher: { currentGames: [], completedGames: [], selectedGameId: null, backToGame: null },
      }),
    },
    React.createElement(Content, { data }),
  );
}

module.exports = {
  ArchiveRoutePage,
  getArchiveShellData,
  buildRouteMetadata,
  getLandingPageData,
  getGameRouteData,
  getLandingRouteData,
  getPlayerRouteData,
  getRoundRouteData,
  getSongRouteData,
  getSongsRouteData,
};
