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
    const submission = await prisma.submission.findFirst({
      where: {
        roundId,
        playerId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        roundId: true,
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
        score: true,
        rank: true,
      },
    });

    if (!submission) {
      return null;
    }

    return {
      roundId: submission.roundId,
      playerId: submission.player.id,
      displayName: submission.player.displayName,
      songTitle: submission.song.title,
      artistName: submission.song.artist.name,
      score: submission.score,
      rank: submission.rank,
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
  const playerId = songId === null ? normalizePositiveInteger(input.playerId) : null;
  const params = new URLSearchParams();

  params.set("round", String(roundId));

  if (songId !== null) {
    params.set("song", String(songId));
  } else if (playerId !== null) {
    params.set("player", String(playerId));
  }

  return `/?${params.toString()}`;
}

module.exports = {
  buildArchiveHref,
  getPlayerRoundModal,
  getRoundDetail,
  getSongRoundModal,
  listArchiveGames,
};
