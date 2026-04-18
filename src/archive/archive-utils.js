const { PrismaClient } = require("@prisma/client");

const SHORT_GAME_ID_MAX_LENGTH = 16;

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

function compareByCreatedAtAscending(left, right) {
  const createdAtComparison = compareNullableAscending(
    left.createdAt ?? null,
    right.createdAt ?? null,
  );

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id - right.id;
}

function compareSubmissionOrder(left, right) {
  const rankComparison = compareNullableAscending(left.rank, right.rank);

  if (rankComparison !== 0) {
    return rankComparison;
  }

  return compareByCreatedAtAscending(left, right);
}

function comparePlayerHistoryOrder(left, right) {
  const occurredAtComparison = compareNullableDescending(
    left.round.occurredAt,
    right.round.occurredAt,
  );

  if (occurredAtComparison !== 0) {
    return occurredAtComparison;
  }

  const sequenceComparison = compareNullableDescending(
    left.round.sequenceNumber,
    right.round.sequenceNumber,
  );

  if (sequenceComparison !== 0) {
    return sequenceComparison;
  }

  const createdAtComparison = compareNullableDescending(left.createdAt, right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id - left.id;
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

function isPrismaClientLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.$disconnect === "function");
}

function normalizePositiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : null;
}

function isScoredSubmission(submission) {
  return submission.score !== null && submission.rank !== null;
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateScoreStdDev(scores) {
  if (scores.length < 2) {
    return 0;
  }

  const mean = average(scores);
  const variance = average(scores.map((score) => (score - mean) ** 2));

  return Math.sqrt(variance);
}

function buildPlayerHistoryRow(submission) {
  return {
    submissionId: submission.id,
    roundId: submission.round.id,
    roundName: submission.round.name,
    occurredAt: toIsoString(submission.round.occurredAt),
    song: {
      id: submission.song.id,
      title: submission.song.title,
      artistName: submission.song.artist.name,
    },
    score: submission.score,
    rank: submission.rank,
    comment: submission.comment,
  };
}

function buildGameMetricsByPlayer(gameSubmissions) {
  const scoredSubmissions = gameSubmissions.filter(isScoredSubmission);
  const scoredRoundSizes = new Map();

  for (const submission of scoredSubmissions) {
    scoredRoundSizes.set(submission.roundId, (scoredRoundSizes.get(submission.roundId) ?? 0) + 1);
  }

  const submissionsByPlayer = new Map();

  for (const submission of scoredSubmissions) {
    const scoredRoundSize = scoredRoundSizes.get(submission.roundId) ?? 0;
    const finishPercentile = (submission.rank - 1) / Math.max(scoredRoundSize - 1, 1);
    const playerSubmissions = submissionsByPlayer.get(submission.playerId) ?? [];

    playerSubmissions.push({
      finishPercentile,
      rank: submission.rank,
      score: submission.score,
    });
    submissionsByPlayer.set(submission.playerId, playerSubmissions);
  }

  const metricsByPlayer = new Map();

  for (const [playerId, playerSubmissions] of submissionsByPlayer.entries()) {
    const wins = playerSubmissions.filter((submission) => submission.rank === 1).length;
    const scores = playerSubmissions.map((submission) => submission.score);
    const finishPercentiles = playerSubmissions.map((submission) => submission.finishPercentile);

    metricsByPlayer.set(playerId, {
      scoredCount: playerSubmissions.length,
      wins,
      averageFinishPercentile: average(finishPercentiles),
      scoreStdDev: calculateScoreStdDev(scores),
      winRate: wins / playerSubmissions.length,
    });
  }

  return metricsByPlayer;
}

function buildGameBaselines(metricsByPlayer) {
  const playerMetrics = [...metricsByPlayer.values()];

  return {
    playerCount: playerMetrics.length,
    averageFinishPercentile: average(
      playerMetrics.map((metrics) => metrics.averageFinishPercentile),
    ),
    scoreStdDev: average(playerMetrics.map((metrics) => metrics.scoreStdDev)),
    winRate: average(playerMetrics.map((metrics) => metrics.winRate)),
  };
}

function selectPlayerNotablePicks(scoredHistory) {
  if (scoredHistory.length === 0) {
    return {
      best: null,
      worst: null,
    };
  }

  const best = [...scoredHistory].sort((left, right) => {
    const rankComparison = compareNullableAscending(left.rank, right.rank);

    if (rankComparison !== 0) {
      return rankComparison;
    }

    const scoreComparison = compareNullableDescending(left.score, right.score);

    if (scoreComparison !== 0) {
      return scoreComparison;
    }

    const occurredAtComparison = compareNullableDescending(left.occurredAt, right.occurredAt);

    if (occurredAtComparison !== 0) {
      return occurredAtComparison;
    }

    return right.submissionId - left.submissionId;
  })[0];

  if (scoredHistory.length === 1) {
    return {
      best,
      worst: null,
    };
  }

  const worst = [...scoredHistory]
    .sort((left, right) => {
      const rankComparison = compareNullableDescending(left.rank, right.rank);

      if (rankComparison !== 0) {
        return rankComparison;
      }

      const scoreComparison = compareNullableAscending(left.score, right.score);

      if (scoreComparison !== 0) {
        return scoreComparison;
      }

      const occurredAtComparison = compareNullableDescending(left.occurredAt, right.occurredAt);

      if (occurredAtComparison !== 0) {
        return occurredAtComparison;
      }

      return right.submissionId - left.submissionId;
    })
    .find((submission) => submission.submissionId !== best.submissionId);

  return {
    best,
    worst: worst ?? null,
  };
}

function derivePlayerTrait(input) {
  const { playerMetrics, gameBaselines } = input;

  if (playerMetrics.scoredCount === 0) {
    return null;
  }

  const candidates = [
    {
      kind: "win-rate",
      line: "Wins more rounds than anyone likes to admit.",
      eligible: playerMetrics.wins >= 2,
      dominanceDelta: playerMetrics.winRate - gameBaselines.winRate,
      priority: 0,
    },
    {
      kind: "variance",
      line: "Could be first, could be last. You never know.",
      eligible: playerMetrics.scoredCount >= 2,
      dominanceDelta: playerMetrics.scoreStdDev - gameBaselines.scoreStdDev,
      priority: 1,
    },
    {
      kind: "top-finish",
      line: "Consistently near the top - plays it safe, plays it well.",
      eligible: true,
      dominanceDelta:
        gameBaselines.averageFinishPercentile - playerMetrics.averageFinishPercentile,
      priority: 2,
    },
    {
      kind: "low-finish",
      line: "Bravely marches to their own drummer.",
      eligible: true,
      dominanceDelta:
        playerMetrics.averageFinishPercentile - gameBaselines.averageFinishPercentile,
      priority: 3,
    },
  ];

  const dominantCandidate = candidates
    .filter((candidate) => candidate.eligible && candidate.dominanceDelta > 0)
    .sort((left, right) => {
      if (left.dominanceDelta !== right.dominanceDelta) {
        return right.dominanceDelta - left.dominanceDelta;
      }

      return left.priority - right.priority;
    })[0];

  if (dominantCandidate) {
    return {
      kind: dominantCandidate.kind,
      line: dominantCandidate.line,
    };
  }

  const fallbackCandidate =
    playerMetrics.averageFinishPercentile <= gameBaselines.averageFinishPercentile
      ? candidates.find((candidate) => candidate.kind === "top-finish")
      : candidates.find((candidate) => candidate.kind === "low-finish");

  return fallbackCandidate
    ? {
        kind: fallbackCandidate.kind,
        line: fallbackCandidate.line,
      }
    : null;
}

async function getOriginPlayerContext(originRoundId, playerId, prisma) {
  const originSubmission = await prisma.submission.findFirst({
    where: {
      roundId: originRoundId,
      playerId,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      roundId: true,
      score: true,
      rank: true,
      round: {
        select: {
          gameId: true,
        },
      },
      player: {
        select: {
          id: true,
          displayName: true,
        },
      },
      song: {
        select: {
          title: true,
          artist: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!originSubmission) {
    return null;
  }

  return {
    originRoundId,
    originGameId: originSubmission.round.gameId,
    playerId: originSubmission.player.id,
    displayName: originSubmission.player.displayName,
    legacyRoundId: originSubmission.roundId,
    legacySongTitle: originSubmission.song.title,
    legacyArtistName: originSubmission.song.artist.name,
    legacyScore: originSubmission.score,
    legacyRank: originSubmission.rank,
  };
}

function resolveGameDisplayLabel(game) {
  const displayName = typeof game.displayName === "string" ? game.displayName.trim() : "";

  if (displayName.length > 0) {
    return displayName;
  }

  return buildShortGameIdentifier(game.sourceGameId);
}

function buildShortGameIdentifier(sourceGameId) {
  const trimmedSourceId = String(sourceGameId ?? "").trim();

  if (
    trimmedSourceId.length > 0 &&
    trimmedSourceId.length <= SHORT_GAME_ID_MAX_LENGTH &&
    /^[a-z0-9-]+$/i.test(trimmedSourceId)
  ) {
    return trimmedSourceId;
  }

  return `Game ${trimmedSourceId.slice(0, 8) || "unknown"}`;
}

function findNewestOccurredAt(rounds) {
  return rounds.reduce((newest, round) => {
    if (round.occurredAt === null) {
      return newest;
    }

    if (newest === null || round.occurredAt > newest) {
      return round.occurredAt;
    }

    return newest;
  }, null);
}

function buildRoundSummary(round) {
  const orderedSubmissions = [...round.submissions].sort(compareSubmissionOrder);
  const winningSubmissions = orderedSubmissions.filter(
    (submission) => submission.rank === 1,
  );

  return {
    id: round.id,
    name: round.name,
    occurredAt: toIsoString(round.occurredAt),
    sequenceNumber: round.sequenceNumber,
    submissionCount: orderedSubmissions.length,
    winnerLabel: resolveWinnerLabel(winningSubmissions),
    statusLabel: resolveRoundStatusLabel(orderedSubmissions),
  };
}

function resolveWinnerLabel(winningSubmissions) {
  if (winningSubmissions.length === 1) {
    return winningSubmissions[0].player.displayName;
  }

  if (winningSubmissions.length > 1) {
    return "Tied winners";
  }

  return null;
}

function resolveRoundStatusLabel(submissions) {
  return submissions.every(
    (submission) => submission.rank === null && submission.score === null,
  )
    ? "pending"
    : "scored";
}

async function listArchiveGames(input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const games = await prisma.game.findMany({
      select: {
        id: true,
        sourceGameId: true,
        displayName: true,
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
                createdAt: true,
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

    return games
      .filter((game) => game.rounds.length > 0)
      .map((game) => ({
        id: game.id,
        sourceGameId: game.sourceGameId,
        displayLabel: resolveGameDisplayLabel(game),
        roundCount: game.rounds.length,
        rounds: [...game.rounds]
          .sort((left, right) => {
            const sequenceComparison = compareNullableAscending(
              left.sequenceNumber,
              right.sequenceNumber,
            );

            if (sequenceComparison !== 0) {
              return sequenceComparison;
            }

            const occurredAtComparison = compareNullableAscending(
              left.occurredAt,
              right.occurredAt,
            );

            if (occurredAtComparison !== 0) {
              return occurredAtComparison;
            }

            return left.id - right.id;
          })
          .map(buildRoundSummary),
      }))
      .sort((left, right) => {
        const newestOccurredAtComparison = compareNullableDescending(
          findNewestOccurredAt(left.rounds),
          findNewestOccurredAt(right.rounds),
        );

        if (newestOccurredAtComparison !== 0) {
          return newestOccurredAtComparison;
        }

        return left.sourceGameId.localeCompare(right.sourceGameId);
      });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getRoundDetail(roundId, input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
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
            player: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!round) {
      return null;
    }

    const orderedSubmissions = [...round.submissions].sort(compareSubmissionOrder);

    return {
      id: round.id,
      name: round.name,
      description: round.description,
      occurredAt: toIsoString(round.occurredAt),
      playlistUrl: round.playlistUrl,
      game: {
        id: round.game.id,
        displayLabel: resolveGameDisplayLabel(round.game),
      },
      highlights: buildRoundHighlights(orderedSubmissions),
      submissions: orderedSubmissions.map((submission) => ({
        id: submission.id,
        song: {
          id: submission.song.id,
          title: submission.song.title,
          artistName: submission.song.artist.name,
        },
        player: {
          id: submission.player.id,
          displayName: submission.player.displayName,
        },
        score: submission.score,
        rank: submission.rank,
        comment: submission.comment,
      })),
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function buildRoundHighlights(submissions) {
  const highlights = [];
  const rankedSubmissions = submissions.filter((submission) => submission.rank !== null);
  const scoredSubmissions = submissions.filter((submission) => submission.score !== null);

  if (rankedSubmissions.length > 0) {
    highlights.push(buildWinnerHighlight(rankedSubmissions));
  }

  if (scoredSubmissions.length >= 2) {
    highlights.push(buildLowestHighlight(scoredSubmissions));
  }

  const anomalyHighlight = buildAnomalyHighlight({
    submissions,
    rankedSubmissions,
    scoredSubmissions,
  });

  if (anomalyHighlight) {
    highlights.push(anomalyHighlight);
  }

  return highlights.slice(0, 3);
}

function buildWinnerHighlight(rankedSubmissions) {
  const topRank = rankedSubmissions[0].rank;
  const winningSubmissions = rankedSubmissions.filter(
    (submission) => submission.rank === topRank,
  );

  if (winningSubmissions.length === 1) {
    const winner = winningSubmissions[0];
    const winnerScore = winner.score === null ? "top spot locked in" : `${winner.score} points`;

    return {
      kind: "winner",
      label: "Winner",
      value: `${winner.player.displayName} with ${winnerScore}`,
    };
  }

  const sharedScore =
    winningSubmissions.every((submission) => submission.score === winningSubmissions[0].score) &&
    winningSubmissions[0].score !== null
      ? `${winningSubmissions[0].score} points`
      : "the top spot";

  return {
    kind: "winner",
    label: "Top spot",
    value: `${winningSubmissions.length} songs tied on ${sharedScore}`,
  };
}

function buildLowestHighlight(scoredSubmissions) {
  const lowestSubmission = [...scoredSubmissions].sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return compareByCreatedAtAscending(left, right);
  })[0];

  return {
    kind: "lowest",
    label: "Lowest score",
    value: `${lowestSubmission.song.title} finished on ${lowestSubmission.score} points`,
  };
}

function buildAnomalyHighlight({
  submissions,
  rankedSubmissions,
  scoredSubmissions,
}) {
  if (rankedSubmissions.length > 0) {
    const topRank = rankedSubmissions[0].rank;
    const winningSubmissions = rankedSubmissions.filter(
      (submission) => submission.rank === topRank,
    );

    if (winningSubmissions.length > 1) {
      const sharedScore =
        winningSubmissions.every(
          (submission) => submission.score === winningSubmissions[0].score,
        ) && winningSubmissions[0].score !== null
          ? `${winningSubmissions[0].score} points`
          : "the same result";

      return {
        kind: "anomaly",
        label: "Tie for first",
        value: `${winningSubmissions.length} songs shared ${sharedScore}`,
      };
    }
  }

  const unscoredCount = submissions.filter(
    (submission) => submission.score === null || submission.rank === null,
  ).length;

  if (unscoredCount > 0) {
    return {
      kind: "anomaly",
      label: "Status",
      value: `Awaiting votes on ${unscoredCount} submission${
        unscoredCount === 1 ? "" : "s"
      }`,
    };
  }

  if (scoredSubmissions.length >= 2 && rankedSubmissions.length > 0) {
    const winningSubmission = rankedSubmissions.find(
      (submission) => submission.rank === rankedSubmissions[0].rank,
    );
    const runnerUpScore = [...scoredSubmissions]
      .filter((submission) => submission.id !== winningSubmission.id)
      .reduce(
        (highestScore, submission) =>
          highestScore === null || submission.score > highestScore
            ? submission.score
            : highestScore,
        null,
      );

    if (
      winningSubmission.score !== null &&
      runnerUpScore !== null &&
      winningSubmission.score - runnerUpScore === 1
    ) {
      return {
        kind: "anomaly",
        label: "Close finish",
        value: `${winningSubmission.player.displayName} won by 1 point`,
      };
    }
  }

  return null;
}

async function getSongRoundModal(roundId, songId, input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const submission = await prisma.submission.findFirst({
      where: {
        roundId,
        songId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        roundId: true,
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
        player: {
          select: {
            displayName: true,
          },
        },
        score: true,
        rank: true,
      },
    });

    if (!submission) {
      return null;
    }

    return {
      roundId: submission.roundId,
      songId: submission.song.id,
      title: submission.song.title,
      artistName: submission.song.artist.name,
      submitterName: submission.player.displayName,
      score: submission.score,
      rank: submission.rank,
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getPlayerRoundModal(roundId, playerId, input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const originContext = await getOriginPlayerContext(roundId, playerId, prisma);

    if (!originContext) {
      return null;
    }

    const [playerSubmissions, gameSubmissions] = await Promise.all([
      prisma.submission.findMany({
        where: {
          playerId,
          round: {
            gameId: originContext.originGameId,
          },
        },
        select: {
          id: true,
          score: true,
          rank: true,
          comment: true,
          createdAt: true,
          round: {
            select: {
              id: true,
              name: true,
              occurredAt: true,
              sequenceNumber: true,
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
        where: {
          round: {
            gameId: originContext.originGameId,
          },
        },
        select: {
          playerId: true,
          roundId: true,
          score: true,
          rank: true,
        },
      }),
    ]);

    const history = [...playerSubmissions]
      .sort(comparePlayerHistoryOrder)
      .map(buildPlayerHistoryRow);
    const scoredHistory = history.filter(isScoredSubmission);

    if (scoredHistory.length === 0) {
      return {
        originRoundId: originContext.originRoundId,
        originGameId: originContext.originGameId,
        playerId: originContext.playerId,
        displayName: originContext.displayName,
        traitLine: null,
        traitKind: null,
        notablePicks: {
          best: null,
          worst: null,
        },
        history,
        roundId: originContext.legacyRoundId,
        songTitle: originContext.legacySongTitle,
        artistName: originContext.legacyArtistName,
        score: originContext.legacyScore,
        rank: originContext.legacyRank,
      };
    }

    const metricsByPlayer = buildGameMetricsByPlayer(gameSubmissions);
    const playerMetrics = metricsByPlayer.get(playerId) ?? {
      scoredCount: 0,
      wins: 0,
      averageFinishPercentile: 0,
      scoreStdDev: 0,
      winRate: 0,
    };
    const trait = derivePlayerTrait({
      playerMetrics,
      gameBaselines: buildGameBaselines(metricsByPlayer),
    });

    return {
      originRoundId: originContext.originRoundId,
      originGameId: originContext.originGameId,
      playerId: originContext.playerId,
      displayName: originContext.displayName,
      traitLine: trait?.line ?? null,
      traitKind: trait?.kind ?? null,
      notablePicks: selectPlayerNotablePicks(scoredHistory),
      history,
      roundId: originContext.legacyRoundId,
      songTitle: originContext.legacySongTitle,
      artistName: originContext.legacyArtistName,
      score: originContext.legacyScore,
      rank: originContext.legacyRank,
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getPlayerModalSubmission(originRoundId, playerId, submissionId, input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const originContext = await getOriginPlayerContext(originRoundId, playerId, prisma);

    if (!originContext) {
      return null;
    }

    const submission = await prisma.submission.findUnique({
      where: {
        id: submissionId,
      },
      select: {
        id: true,
        playerId: true,
        score: true,
        rank: true,
        comment: true,
        round: {
          select: {
            id: true,
            gameId: true,
            name: true,
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
    });

    if (
      !submission ||
      submission.playerId !== playerId ||
      submission.round.gameId !== originContext.originGameId
    ) {
      return null;
    }

    return {
      originRoundId,
      playerId,
      submissionId: submission.id,
      playerName: originContext.displayName,
      roundId: submission.round.id,
      roundName: submission.round.name,
      title: submission.song.title,
      artistName: submission.song.artist.name,
      score: submission.score,
      rank: submission.rank,
      comment: submission.comment,
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function buildArchiveHref(input = {}) {
  const roundId = normalizePositiveInteger(input.roundId);

  if (roundId === null) {
    return "/";
  }

  const songId = normalizePositiveInteger(input.songId);
  const playerId = normalizePositiveInteger(input.playerId);
  const playerSubmissionId =
    playerId === null ? null : normalizePositiveInteger(input.playerSubmissionId);
  const params = new URLSearchParams();

  params.set("round", String(roundId));

  if (playerId !== null) {
    params.set("player", String(playerId));

    if (playerSubmissionId !== null) {
      params.set("playerSubmission", String(playerSubmissionId));
    }
  } else if (songId !== null) {
    params.set("song", String(songId));
  }

  return `/?${params.toString()}`;
}

module.exports = {
  buildArchiveHref,
  derivePlayerTrait,
  getPlayerModalSubmission,
  getPlayerRoundModal,
  getRoundDetail,
  getSongRoundModal,
  listArchiveGames,
  selectPlayerNotablePicks,
};
