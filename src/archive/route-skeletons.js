const React = require("react");
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
const {
  ARCHIVE_BADGE_VARIANTS,
  buildArchiveBadgeModel,
} = require("./archive-badges");
const { ArchiveShell } = require("./archive-shell");
const { LandingContent } = require("./landing-page-content");
const { RoundSubmissionsList } = require("./round-vote-disclosures");
const { SongBrowser } = require("./song-browser");
const {
  derivePlayerTrait,
  getSelectedGameMemoryBoard,
  selectPlayerNotablePicks,
} = require("./archive-utils");
const {
  buildStatusNotice,
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
  notFoundRouteData,
  readyRouteData,
  resolveArchiveInput,
  sparseRouteData,
} = require("./m8-derivations");

const archiveDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const SONG_FAMILIARITY_FILTERS = new Set(["all", "first-time", "returning"]);
const SONG_SORTS = new Set(["most-appearances", "most-recent", "best-finish", "alphabetical"]);

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

function countScoredRounds(rounds) {
  return rounds.filter((round) =>
    (round.submissions ?? []).some(
      (submission) => submission.score !== null && submission.score !== undefined,
    ),
  ).length;
}

function buildGameCompetitiveAnchor(leaderboardRows) {
  const leaders = leaderboardRows
    .filter((row) => row.rank === 1)
    .map((row) => ({
      playerId: row.playerId,
      displayName: row.displayName,
      totalPoints: row.totalPoints,
      href: row.href,
    }));

  if (leaders.length === 0) {
    return {
      headline: "Competitive standings need scored submissions.",
      leaders: [],
      closestRace: null,
      roundsWonLeader: null,
    };
  }

  const leaderPoints = leaders[0].totalPoints;
  const headline =
    leaders.length === 1
      ? `Leader: ${leaders[0].displayName} with ${leaderPoints} points`
      : leaders.length === 2
        ? `Tied leaders: ${leaders[0].displayName} & ${leaders[1].displayName} at ${leaderPoints} points`
        : `${leaders.length}-way tie at ${leaderPoints} points: ${leaders
            .map((leader) => leader.displayName)
            .join(", ")}`;
  let closestRace = null;

  for (let index = 1; index < leaderboardRows.length; index += 1) {
    const left = leaderboardRows[index - 1];
    const right = leaderboardRows[index];
    const pointGap = left.totalPoints - right.totalPoints;

    if (pointGap < 0) {
      continue;
    }

    if (!closestRace || pointGap < closestRace.pointGap) {
      closestRace = {
        label: `${left.displayName} over ${right.displayName}`,
        pointGap,
      };
    }
  }

  const highestRoundWins = Math.max(...leaderboardRows.map((row) => row.roundWins));
  const roundWinLeaders = leaderboardRows.filter(
    (row) => row.roundWins === highestRoundWins && row.roundWins > 0,
  );

  return {
    headline,
    leaders,
    closestRace,
    roundsWonLeader:
      roundWinLeaders.length === 1
        ? {
            playerId: roundWinLeaders[0].playerId,
            displayName: roundWinLeaders[0].displayName,
            roundWins: roundWinLeaders[0].roundWins,
            href: roundWinLeaders[0].href,
          }
        : null,
  };
}

function buildEmptyMemoryBoard(gameId, statusNotice) {
  return {
    selectedGameId: gameId,
    anchor: null,
    competitiveAnchor: null,
    moments: [],
    rounds: [],
    sparseState: {
      title: statusNotice.title,
      copy: statusNotice.body,
    },
  };
}

function buildGamePageProps({ game, rounds, leaderboard, memoryBoard }) {
  const timeframe = deriveGameTimeframe({
    rounds,
    submissions: rounds.flatMap((round) => round.submissions ?? []),
    votes: rounds.flatMap((round) => round.votes ?? []),
  });
  const roundList = deriveGameRoundListItems({ gameId: game.id, rounds });
  const scoredRoundCount = countScoredRounds(rounds);

  return {
    game: {
      id: game.id,
      displayName: resolveGameDisplayLabel(game),
      title: resolveGameDisplayLabel(game),
      description: game.description ?? null,
      status: game.finished ? "Completed" : "Current",
      finished: game.finished,
      timeframeLabel: timeframe?.label ?? null,
      timeframe: timeframe?.label ?? null,
      roundCount: rounds.length,
      scoredRoundCount,
    },
    leaderboard,
    rounds: roundList,
    memoryBoard,
    competitiveAnchor: buildGameCompetitiveAnchor(leaderboard.rows),
    leaderboardFootnote: leaderboard.footnote,
    hasLeaderboardTies: leaderboard.hasTies,
    pendingScoringCopy:
      leaderboard.rows.length === 0
        ? "Scoring evidence has not been imported for this game yet, so standings stay pending."
        : null,
  };
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

function compareRoundSubmissions(left, right) {
  const rankComparison = compareNullableAscending(left.rank, right.rank);

  if (rankComparison !== 0) {
    return rankComparison;
  }

  const submittedAtComparison = compareNullableAscending(
    left.submittedAt ?? null,
    right.submittedAt ?? null,
  );

  if (submittedAtComparison !== 0) {
    return submittedAtComparison;
  }

  return left.id - right.id;
}

function hasTiedRoundRank(submission, rankCounts) {
  return (
    submission.rank !== null &&
    submission.rank !== undefined &&
    (rankCounts.get(submission.rank) ?? 0) > 1
  );
}

function buildRoundPageProps({ game, round, submissions, votesBySubmissionId, songAppearances }) {
  const rankCounts = submissions.reduce((counts, submission) => {
    if (submission.rank !== null) {
      counts.set(submission.rank, (counts.get(submission.rank) ?? 0) + 1);
    }

    return counts;
  }, new Map());

  return {
    round: {
      id: round.id,
      gameId: game.id,
      gameDisplayName: resolveGameDisplayLabel(game),
      name: round.name,
      description: round.description,
      sequenceNumber: round.sequenceNumber ?? null,
      occurredAtLabel: round.occurredAt ? archiveDateFormatter.format(round.occurredAt) : null,
      playlistUrl: round.playlistUrl,
    },
    highlights: buildRoundHighlights(submissions),
    submissions: submissions.map((submission) => {
      const isTiedRank = hasTiedRoundRank(submission, rankCounts);

      return {
        submissionId: submission.id,
        rankLabel: formatRankBadgeLabel(submission.rank, isTiedRank),
        scoreLabel: formatScore(submission.score),
        isTiedRank,
        song: {
          id: submission.song.id,
          title: submission.song.title,
          artistName: submission.song.artist.name,
          href: buildSongHref(submission.song.id),
        },
        submitter: {
          id: submission.player.id,
          displayName: submission.player.displayName,
          href: buildPlayerHref(submission.player.id),
        },
        familiarity: deriveArchiveSongFamiliarity(submission.songId, songAppearances),
        submissionComment: submission.comment,
        votes: [...(votesBySubmissionId.get(submission.id) ?? [])]
          .sort((left, right) => {
            if (right.pointsAssigned !== left.pointsAssigned) {
              return right.pointsAssigned - left.pointsAssigned;
            }

            const voterComparison = left.voter.displayName.localeCompare(right.voter.displayName);

            return voterComparison !== 0 ? voterComparison : left.id - right.id;
          })
          .map((vote) => ({
            voteId: vote.id,
            voter: {
              id: vote.voter.id,
              displayName: vote.voter.displayName,
              href: buildPlayerHref(vote.voter.id),
            },
            pointsAssigned: vote.pointsAssigned,
            votedAtLabel: vote.votedAt ? archiveDateFormatter.format(vote.votedAt) : null,
            comment: vote.comment,
          })),
      };
    }),
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

async function getGamePageData(gameId, input = {}) {
  const parsedGameId = parsePositiveRouteId(gameId);

  if (parsedGameId === null) {
    return notFoundRouteData(
      buildStatusNotice({
        title: "Invalid game ID.",
        body: "The requested Music League game could not be loaded.",
        href: "/",
        hrefLabel: "Back to archive",
      }),
    );
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const game = await prisma.game.findUnique({
      where: { id: parsedGameId },
      select: {
        id: true,
        sourceGameId: true,
        displayName: true,
        description: true,
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
      return notFoundRouteData(
        buildStatusNotice({
          title: "Game not found.",
          body: "The requested Music League game could not be found.",
          href: "/",
          hrefLabel: "Back to archive",
        }),
      );
    }

    const rounds = [...game.rounds].sort(compareRounds);
    const leaderboard = buildGameLeaderboard({ ...game, rounds });
    const sparseNotice =
      rounds.length === 0
        ? buildStatusNotice({
            title: "No round evidence.",
            body: "This game has no imported round evidence yet.",
            href: "/",
            hrefLabel: "Back to archive",
          })
        : null;
    const memoryBoardResult =
      rounds.length === 0 ? null : await getSelectedGameMemoryBoard(game.id, { prisma });
    const props = buildGamePageProps({
      game,
      rounds,
      leaderboard,
      memoryBoard: memoryBoardResult?.board ?? buildEmptyMemoryBoard(game.id, sparseNotice ?? {
        title: "Memory board pending.",
        body: "Memory-board evidence is not available for this game yet.",
      }),
    });

    return sparseNotice ? sparseRouteData(props, sparseNotice) : readyRouteData(props);
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getGameRouteData(gameId, input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const pageData = await getGamePageData(gameId, { prisma });

    if (pageData.kind === "not-found") {
      return await withArchiveShellData({
        kind: "game",
        title: "Game unavailable",
        description: pageData.statusNotice.body,
        status: pageData.statusNotice.title,
        statusHref: pageData.statusNotice.href,
        statusLinkLabel: pageData.statusNotice.hrefLabel,
      }, {
        activeRoute: "game",
        gameContext: null,
        input: { prisma },
      });
    }

    const { props } = pageData;

    return await withArchiveShellData({
      kind: "game",
      title: props.game.displayName,
      description: props.game.description ?? `${props.game.displayName} archive page.`,
      game: {
        ...props.game,
        title: props.game.displayName,
        timeframe: props.game.timeframeLabel,
        rounds: props.rounds,
        leaderboard: props.leaderboard.rows,
        leaderboardFootnote: props.leaderboardFootnote,
        hasLeaderboardTies: props.hasLeaderboardTies,
        pendingScoringCopy: props.pendingScoringCopy,
        competitiveAnchor: props.competitiveAnchor,
        memoryBoard: props.memoryBoard,
      },
      leaderboard: props.leaderboard,
      rounds: props.rounds,
      memoryBoard: props.memoryBoard,
      competitiveAnchor: props.competitiveAnchor,
      leaderboardFootnote: props.leaderboardFootnote,
      hasLeaderboardTies: props.hasLeaderboardTies,
      pendingScoringCopy: props.pendingScoringCopy,
      status: pageData.statusNotice?.body ?? null,
      statusHref: pageData.statusNotice?.href,
      statusLinkLabel: pageData.statusNotice?.hrefLabel,
    }, {
      activeRoute: "game",
      gameContext: {
        gameId: props.game.id,
        displayName: props.game.displayName,
        href: buildGameHref(props.game.id),
      },
      input: { prisma },
    });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getRoundPageData(gameId, roundId, input = {}) {
  const parsedGameId = parsePositiveRouteId(gameId);
  const parsedRoundId = parsePositiveRouteId(roundId);

  if (parsedGameId === null) {
    return notFoundRouteData(
      buildStatusNotice({
        title: "Invalid game ID.",
        body: "The requested Music League game could not be loaded.",
        href: "/",
        hrefLabel: "Back to archive",
      }),
    );
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    if (parsedRoundId === null) {
      const game = await prisma.game.findUnique({
        where: { id: parsedGameId },
        select: { id: true, sourceGameId: true, displayName: true },
      });

      return notFoundRouteData(
        buildStatusNotice({
          title: "Invalid round ID.",
          body: "The requested Music League round could not be loaded.",
          href: game ? buildGameHref(game.id) : "/",
          hrefLabel: game ? "Back to game" : "Back to archive",
        }),
      );
    }

    const [game, round, songAppearances] = await Promise.all([
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
          sequenceNumber: true,
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
              submittedAt: true,
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
      prisma.submission.findMany({
        select: {
          songId: true,
        },
      }),
    ]);

    if (!game) {
      return notFoundRouteData(
        buildStatusNotice({
          title: "Game not found.",
          body: "The requested Music League game could not be found.",
          href: "/",
          hrefLabel: "Back to archive",
        }),
      );
    }

    if (!round) {
      return notFoundRouteData(
        buildStatusNotice({
          title: "Round not found.",
          body: "The requested Music League round could not be found.",
          href: buildGameHref(game.id),
          hrefLabel: "Back to game",
        }),
      );
    }

    const owningGameTitle = resolveGameDisplayLabel(round.game);

    if (round.game.id !== game.id) {
      return notFoundRouteData(
        buildStatusNotice({
          title: "Round belongs to another game.",
          body: "This Music League round belongs to a different game.",
          href: buildGameHref(round.game.id),
          hrefLabel: `Open ${owningGameTitle}`,
        }),
      );
    }

    const orderedSubmissions = [...round.submissions].sort(compareRoundSubmissions);
    const { votesBySubmissionId } = mapVotesToRoundSubmissions({
      submissions: orderedSubmissions.map((submission) => ({
        id: submission.id,
        roundId: submission.roundId,
        songId: submission.songId,
        playerId: submission.playerId,
      })),
      votes: round.votes,
    });

    return readyRouteData(
      buildRoundPageProps({
        game,
        round,
        submissions: orderedSubmissions,
        votesBySubmissionId,
        songAppearances,
      }),
    );
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getRoundRouteData(gameId, roundId, input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const pageData = await getRoundPageData(gameId, roundId, { prisma });

    if (pageData.kind === "not-found") {
      return await withArchiveShellData({
        kind: "round",
        title: "Round unavailable",
        description: pageData.statusNotice.body,
        status: pageData.statusNotice.title,
        statusHref: pageData.statusNotice.href,
        statusLinkLabel: pageData.statusNotice.hrefLabel,
      }, {
        activeRoute: "round",
        gameContext: null,
        input: { prisma },
      });
    }

    const { props } = pageData;
    const gameContext = {
      gameId: props.round.gameId,
      displayName: props.round.gameDisplayName,
      href: buildGameHref(props.round.gameId),
    };

    return await withArchiveShellData({
      kind: "round",
      title: props.round.name,
      description: `${props.round.name} round page in ${props.round.gameDisplayName}.`,
      round: {
        ...props.round,
        game: {
          id: props.round.gameId,
          title: props.round.gameDisplayName,
          href: buildGameHref(props.round.gameId),
        },
        highlights: props.highlights,
        submissions: props.submissions,
      },
    }, {
      activeRoute: "round",
      gameContext,
      input: { prisma },
    });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function buildSongBrowserStatus({ invalidFamiliarity, invalidSort, catalog }) {
  const statusMessages = [
    invalidFamiliarity && catalog.totalMatchCount > 0
      ? "Invalid familiarity filter reset to all songs."
      : null,
    invalidSort ? "Invalid sort reset to most recent." : null,
  ].filter(Boolean);

  return statusMessages.join(" ");
}

async function getSongBrowserData({ q = "", familiarity = "all", sort = "most-recent", input = {} } = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);
  const rawFamiliarity = normalizeArchiveSearch(familiarity);
  const rawSort = normalizeArchiveSearch(sort);
  const invalidFamiliarity =
    rawFamiliarity.length > 0 && !SONG_FAMILIARITY_FILTERS.has(rawFamiliarity);
  const invalidSort =
    rawSort.length > 0 && !SONG_SORTS.has(rawSort);

  try {
    const catalog = await getSongCatalog({
      q,
      familiarity,
      sort,
      input: { prisma },
    });

    return {
      query: catalog.q,
      familiarity: catalog.familiarity,
      sort: catalog.sort,
      rows: catalog.rows,
      totalMatches: catalog.totalMatchCount,
      totalCatalogSize: catalog.totalSongCount,
      capped: catalog.capped,
      isEmpty: catalog.isEmpty,
      isZeroResult: catalog.isZeroResult,
      clearHref: buildSongSearchHref({}),
      status: buildSongBrowserStatus({ invalidFamiliarity, invalidSort, catalog }),
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

  try {
    const browserData = await getSongBrowserData({
      q: searchParams.q,
      familiarity: searchParams.familiarity,
      sort: searchParams.sort,
      input: { prisma },
    });

    return await withArchiveShellData({
      kind: "songs",
      title: "Songs",
      description: "Search songs and artists in the Music League archive.",
      ...browserData,
      songs: browserData.rows,
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
    React.createElement("h1", null, data.game.displayName ?? data.game.title),
    React.createElement(ArchiveBadge, {
      variant: data.game.status === "Completed" || data.game.finished ? "status-completed" : "status-current",
      label: data.game.status ?? (data.game.finished ? "Completed" : "Current"),
    }),
    data.game.description ? React.createElement("p", null, data.game.description) : null,
    data.game.timeframe ? React.createElement("p", null, data.game.timeframe) : null,
    React.createElement(StatusNotice, { status: data.status }),
    data.status
      ? null
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(SimpleTable, {
            caption: "Leaderboard",
            headers: ["Rank", "Player", "Points", "Round wins", "Rounds played"],
            rows: data.game.leaderboard.map((row) => ({
              id: row.playerId ?? row.player.id,
              cells: [
                React.createElement(ArchiveBadge, {
                  variant: row.isTiedRank || row.tied ? "rank-tie" : "rank-plain",
                  label: row.rankLabel ?? formatRankBadgeLabel(row.rank, row.tied),
                  ariaLabel: row.isTiedRank || row.tied ? `Tied rank ${row.rank}` : `Rank ${row.rank}`,
                }),
                React.createElement(
                  "a",
                  { href: row.href ?? row.player.href },
                  row.displayName ?? row.player.displayName,
                ),
                React.createElement(ArchiveBadge, {
                  variant: "score",
                  label: `${row.totalPoints ?? row.totalScore} points`,
                }),
                String(row.roundWins ?? row.wins),
                String(row.roundsPlayed ?? row.scoredSubmissionCount),
              ],
            })),
            emptyCopy: data.game.pendingScoringCopy ?? "No scored rounds imported for this game.",
          }),
          data.game.status === "Current" && data.game.leaderboard.length > 0
            ? React.createElement(
                "p",
                { className: "archive-route-footnote", role: "note" },
                "Standings are provisional while this game is in progress.",
              )
            : null,
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
            data.game.rounds.length === 0
              ? React.createElement("p", { className: "archive-route-empty" }, "No rounds imported for this game.")
              : React.createElement(
                  "ul",
                  { className: "archive-route-list archive-game-round-list" },
                  data.game.rounds.map((round) =>
                    React.createElement(
                      "li",
                      { key: round.roundId ?? round.id },
                      React.createElement(
                        "span",
                        { className: "archive-route-list-main" },
                        React.createElement("a", { href: round.href }, `${round.sequenceLabel}: ${round.name}`),
                        React.createElement(ArchiveBadge, {
                          variant: "score",
                          label: round.statusLabel,
                        }),
                        round.playlistUrl
                          ? React.createElement(ArchiveBadge, {
                              variant: "playlist-link",
                              label: "Playlist",
                              href: round.playlistUrl,
                              rel: "noopener",
                              target: "_blank",
                              ariaLabel: `Open playlist for ${round.name}`,
                            })
                          : null,
                      ),
                      React.createElement(
                        "span",
                        null,
                        [
                          round.occurredAtLabel ?? "Date TBD",
                          formatCount(round.submissionCount, "submission"),
                          round.winnerLabel ? `Winner: ${round.winnerLabel}` : null,
                        ]
                          .filter(Boolean)
                          .join(" - "),
                      ),
                    ),
                  ),
                ),
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
            data.game.competitiveAnchor?.headline
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement("p", null, data.game.competitiveAnchor.headline),
                  data.game.competitiveAnchor.closestRace
                    ? React.createElement(
                        "p",
                        null,
                        `Closest race: ${data.game.competitiveAnchor.closestRace.label}, ${data.game.competitiveAnchor.closestRace.pointGap} points apart.`,
                      )
                    : null,
                  data.game.competitiveAnchor.roundsWonLeader
                    ? React.createElement(
                        "p",
                        null,
                        React.createElement(
                          "a",
                          { href: data.game.competitiveAnchor.roundsWonLeader.href },
                          data.game.competitiveAnchor.roundsWonLeader.displayName,
                        ),
                        ` leads round wins with ${data.game.competitiveAnchor.roundsWonLeader.roundWins}.`,
                      )
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
    React.createElement(
      "p",
      { className: "archive-round-parent-link" },
      React.createElement("a", { href: data.round.game.href }, data.round.game.title),
    ),
    React.createElement("h1", null, data.round.name),
    data.round.description ? React.createElement("p", null, data.round.description) : null,
    data.round.occurredAtLabel ? React.createElement("p", null, data.round.occurredAtLabel) : null,
    data.round.playlistUrl
      ? React.createElement(ArchiveBadge, {
          variant: "playlist-link",
          label: "Playlist",
          href: data.round.playlistUrl,
          rel: "noopener",
          target: "_blank",
          ariaLabel: `Open playlist for ${data.round.name}`,
        })
      : null,
    data.round.highlights.length
      ? React.createElement(
          "section",
          { className: "archive-route-section", "aria-labelledby": "round-highlights-heading" },
          React.createElement("h2", { id: "round-highlights-heading" }, "Highlights"),
          React.createElement(DefinitionList, {
            items: data.round.highlights.map((highlight) => ({
              label: highlight.label,
              value: highlight.value,
            })),
          }),
        )
      : null,
    React.createElement(RoundSubmissionsList, { submissions: data.round.submissions }),
  );
}

function SongsContent({ data }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("h1", null, "Songs"),
    React.createElement(StatusNotice, { status: data.status }),
    React.createElement(SongBrowser, { data }),
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
  getGamePageData,
  getGameRouteData,
  getLandingRouteData,
  getPlayerRouteData,
  getRoundPageData,
  getRoundRouteData,
  getSongBrowserData,
  getSongRouteData,
  getSongsRouteData,
};
