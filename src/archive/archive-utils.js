const { PrismaClient } = require("@prisma/client");
const {
  compareSongMemoryHistoryOrder,
  compareSongMemoryHistoryRecencyOrder,
  deriveSongFamiliarity,
  sortSongMemoryHistory,
  sortSongMemoryHistoryNewestFirst,
} = require("./song-memory");

const SHORT_GAME_ID_MAX_LENGTH = 16;
const SONG_RECALL_COMMENT_MAX_LENGTH = 140;
const SONG_MEMORY_MODAL_SUBMISSION_SELECT = {
  id: true,
  roundId: true,
  songId: true,
  playerId: true,
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
      artistId: true,
      artist: {
        select: {
          id: true,
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
};

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

function buildSongMemoryEvidenceRow(submission) {
  return {
    id: submission.id,
    roundId: submission.roundId,
    roundSequenceNumber: submission.round.sequenceNumber,
    songId: submission.songId,
    playerId: submission.playerId,
    playerName: submission.player.displayName,
    createdAt: submission.createdAt,
    roundOccurredAt: submission.round.occurredAt,
  };
}

function buildSongMemorySortRecord(submission) {
  return {
    ...buildSongMemoryEvidenceRow(submission),
    submission,
  };
}

function buildSongHistoryRow(submission, originSubmissionId) {
  return {
    submissionId: submission.id,
    gameId: submission.round.game.id,
    gameLabel: resolveGameDisplayLabel(submission.round.game),
    roundId: submission.round.id,
    roundName: submission.round.name,
    occurredAt: toIsoString(submission.round.occurredAt),
    submitter: {
      id: submission.player.id,
      displayName: submission.player.displayName,
    },
    result: {
      rank: submission.rank,
      score: submission.score,
    },
    comment: submission.comment,
    isOrigin: submission.id === originSubmissionId,
  };
}

function buildSongHistoryGroups(descendingRecords, originGameId, originSubmissionId) {
  const groupsByGameId = new Map();

  for (const record of descendingRecords) {
    const row = buildSongHistoryRow(record.submission, originSubmissionId);
    const group = groupsByGameId.get(row.gameId) ?? {
      gameId: row.gameId,
      gameLabel: row.gameLabel,
      isOriginGame: row.gameId === originGameId,
      rows: [],
    };

    group.rows.push(row);
    groupsByGameId.set(row.gameId, group);
  }

  const groups = Array.from(groupsByGameId.values());

  return [
    ...groups.filter((group) => group.isOriginGame),
    ...groups.filter((group) => !group.isOriginGame),
  ];
}

function buildSongEvidenceShortcuts(ascendingRecords, descendingRecords) {
  const firstAppearance = ascendingRecords[0] ?? null;
  const mostRecentAppearance = descendingRecords[0] ?? null;

  if (
    firstAppearance === null ||
    mostRecentAppearance === null ||
    firstAppearance.id === mostRecentAppearance.id
  ) {
    return [];
  }

  return [
    {
      kind: "first-appearance",
      label: "First appearance",
      submissionId: firstAppearance.id,
    },
    {
      kind: "most-recent-appearance",
      label: "Most recent appearance",
      submissionId: mostRecentAppearance.id,
    },
  ];
}

function compareNullableNumberDescending(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right - left;
}

function selectBestExactSongFinish(descendingRecords) {
  const rankedRecords = descendingRecords.filter((record) => record.submission.rank !== null);

  if (rankedRecords.length === 0) {
    return null;
  }

  const bestRecord = [...rankedRecords].sort((left, right) => {
    const rankComparison = left.submission.rank - right.submission.rank;

    if (rankComparison !== 0) {
      return rankComparison;
    }

    const scoreComparison = compareNullableNumberDescending(
      left.submission.score,
      right.submission.score,
    );

    if (scoreComparison !== 0) {
      return scoreComparison;
    }

    return compareSongMemoryHistoryRecencyOrder(left, right);
  })[0];

  return {
    rank: bestRecord.submission.rank,
    score: bestRecord.submission.score,
    submissionId: bestRecord.submission.id,
  };
}

function selectRecallComment(descendingRecords) {
  const commentRecord = descendingRecords.find((record) => {
    const comment = record.submission.comment;

    return typeof comment === "string" && comment.trim().length > 0;
  });

  if (!commentRecord) {
    return null;
  }

  const normalizedComment = commentRecord.submission.comment.trim().replace(/\s+/g, " ");
  const excerpt =
    normalizedComment.length <= SONG_RECALL_COMMENT_MAX_LENGTH
      ? normalizedComment
      : `${normalizedComment.slice(0, SONG_RECALL_COMMENT_MAX_LENGTH - 3).trimEnd()}...`;

  return {
    submissionId: commentRecord.submission.id,
    text: excerpt,
  };
}

function buildSongArtistFootprint(artistSubmissions, openedSongId) {
  const otherSongRecords = sortSongMemoryHistoryNewestFirst(
    artistSubmissions
      .filter((submission) => submission.songId !== openedSongId)
      .map(buildSongMemorySortRecord),
  );
  const songIds = new Set();
  const submittersById = new Map();

  for (const record of otherSongRecords) {
    songIds.add(record.songId);

    if (!submittersById.has(record.playerId)) {
      submittersById.set(record.playerId, {
        id: record.playerId,
        displayName: record.playerName,
      });
    }
  }

  return {
    songCount: songIds.size,
    submitterCount: submittersById.size,
    submissionCount: otherSongRecords.length,
    notableSubmitters: Array.from(submittersById.values()),
  };
}

function buildSongMemorySummary({ ascendingRecords, descendingRecords, artistSubmissions, songId }) {
  const firstRecord = ascendingRecords[0] ?? null;
  const mostRecentRecord = descendingRecords[0] ?? null;

  return {
    firstSubmitter: firstRecord
      ? {
          id: firstRecord.submission.player.id,
          displayName: firstRecord.submission.player.displayName,
        }
      : null,
    mostRecentSubmitter: mostRecentRecord
      ? {
          id: mostRecentRecord.submission.player.id,
          displayName: mostRecentRecord.submission.player.displayName,
        }
      : null,
    exactSongSubmissionCount: ascendingRecords.length,
    bestExactSongFinish: selectBestExactSongFinish(descendingRecords),
    artistFootprint: buildSongArtistFootprint(artistSubmissions, songId),
    recallComment: selectRecallComment(descendingRecords),
  };
}

function groupSongMemoryEvidence(evidenceSubmissions) {
  const exactSubmissionsBySongId = new Map();
  const artistSubmissionsByArtistId = new Map();

  for (const submission of evidenceSubmissions) {
    const evidenceRow = buildSongMemoryEvidenceRow(submission);
    const exactSubmissions = exactSubmissionsBySongId.get(submission.songId) ?? [];
    const artistSubmissions = artistSubmissionsByArtistId.get(submission.song.artistId) ?? [];

    exactSubmissions.push(evidenceRow);
    artistSubmissions.push(evidenceRow);
    exactSubmissionsBySongId.set(submission.songId, exactSubmissions);
    artistSubmissionsByArtistId.set(submission.song.artistId, artistSubmissions);
  }

  return {
    exactSubmissionsBySongId,
    artistSubmissionsByArtistId,
  };
}

function buildRepresentativeOriginSubmissions(submissions) {
  const representativeOriginsBySongId = new Map();

  for (const submission of [...submissions].sort(compareByCreatedAtAscending)) {
    if (!representativeOriginsBySongId.has(submission.song.id)) {
      representativeOriginsBySongId.set(submission.song.id, submission);
    }
  }

  return representativeOriginsBySongId;
}

async function getRoundFamiliarityEvidence(prisma, submissions) {
  const songIds = [...new Set(submissions.map((submission) => submission.song.id))];
  const artistIds = [...new Set(submissions.map((submission) => submission.song.artist.id))];

  if (songIds.length === 0 && artistIds.length === 0) {
    return groupSongMemoryEvidence([]);
  }

  const evidenceSubmissions = await prisma.submission.findMany({
    where: {
      OR: [
        {
          songId: {
            in: songIds,
          },
        },
        {
          song: {
            artistId: {
              in: artistIds,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      roundId: true,
      songId: true,
      playerId: true,
      createdAt: true,
      round: {
        select: {
          occurredAt: true,
          sequenceNumber: true,
        },
      },
      song: {
        select: {
          artistId: true,
        },
      },
      player: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return groupSongMemoryEvidence(evidenceSubmissions);
}

function buildRoundSubmissionFamiliarity({
  roundId,
  submission,
  representativeOriginsBySongId,
  exactSubmissionsBySongId,
  artistSubmissionsByArtistId,
}) {
  const representativeOrigin = representativeOriginsBySongId.get(submission.song.id) ?? submission;

  return deriveSongFamiliarity({
    songId: submission.song.id,
    artistId: submission.song.artist.id,
    originRoundId: roundId,
    originSubmissionId: representativeOrigin.id,
    exactSongSubmissions: exactSubmissionsBySongId.get(submission.song.id) ?? [],
    artistSubmissions: artistSubmissionsByArtistId.get(submission.song.artist.id) ?? [],
  });
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

function deriveGameStandings(submissions) {
  const rowsByPlayer = new Map();

  for (const submission of submissions) {
    if (!isScoredSubmission(submission)) {
      continue;
    }

    const row = rowsByPlayer.get(submission.playerId) ?? {
      player: {
        id: submission.playerId,
        displayName: submission.playerName,
      },
      totalScore: 0,
      scoredSubmissionCount: 0,
      scoredRoundIds: new Set(),
    };

    row.totalScore += submission.score;
    row.scoredSubmissionCount += 1;
    row.scoredRoundIds.add(submission.roundId);
    rowsByPlayer.set(submission.playerId, row);
  }

  const standings = [...rowsByPlayer.values()]
    .map((row) => ({
      player: row.player,
      totalScore: row.totalScore,
      scoredSubmissionCount: row.scoredSubmissionCount,
      scoredRoundCount: row.scoredRoundIds.size,
      rank: null,
      tied: false,
    }))
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      if (left.player.displayName !== right.player.displayName) {
        return left.player.displayName < right.player.displayName ? -1 : 1;
      }

      return left.player.id - right.player.id;
    });

  const rowsByTotalScore = new Map();
  let currentRank = 0;
  let previousScore = null;

  for (const [index, row] of standings.entries()) {
    if (row.totalScore !== previousScore) {
      currentRank += 1;
      previousScore = row.totalScore;
    }

    row.rank = currentRank;

    const tiedRows = rowsByTotalScore.get(row.totalScore) ?? [];
    tiedRows.push(index);
    rowsByTotalScore.set(row.totalScore, tiedRows);
  }

  for (const tiedRowIndexes of rowsByTotalScore.values()) {
    if (tiedRowIndexes.length < 2) {
      continue;
    }

    for (const index of tiedRowIndexes) {
      standings[index].tied = true;
    }
  }

  return standings;
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
                    id: true,
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
    const representativeOriginsBySongId = buildRepresentativeOriginSubmissions(orderedSubmissions);
    const { exactSubmissionsBySongId, artistSubmissionsByArtistId } =
      await getRoundFamiliarityEvidence(prisma, orderedSubmissions);

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
          familiarity: buildRoundSubmissionFamiliarity({
            roundId: round.id,
            submission,
            representativeOriginsBySongId,
            exactSubmissionsBySongId,
            artistSubmissionsByArtistId,
          }),
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
        id: true,
        roundId: true,
        songId: true,
        playerId: true,
        createdAt: true,
        round: {
          select: {
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
                id: true,
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

    const representativeOriginsBySongId = buildRepresentativeOriginSubmissions([submission]);
    const { exactSubmissionsBySongId, artistSubmissionsByArtistId } =
      await getRoundFamiliarityEvidence(prisma, [submission]);

    return {
      roundId: submission.roundId,
      songId: submission.song.id,
      title: submission.song.title,
      artistName: submission.song.artist.name,
      submitterName: submission.player.displayName,
      familiarity: buildRoundSubmissionFamiliarity({
        roundId: submission.roundId,
        submission,
        representativeOriginsBySongId,
        exactSubmissionsBySongId,
        artistSubmissionsByArtistId,
      }),
      score: submission.score,
      rank: submission.rank,
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getSongMemoryModal(originRoundId, songId, input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);
  const normalizedOriginRoundId = normalizePositiveInteger(originRoundId);
  const requestedSongId = normalizePositiveInteger(songId);

  try {
    if (normalizedOriginRoundId === null) {
      return null;
    }

    const originRound = await prisma.round.findUnique({
      where: {
        id: normalizedOriginRoundId,
      },
      select: {
        id: true,
        game: {
          select: {
            id: true,
            sourceGameId: true,
            displayName: true,
          },
        },
      },
    });

    if (!originRound) {
      return null;
    }

    const closeHref = buildArchiveHref({ roundId: originRound.id });
    const originSubmissions =
      requestedSongId === null
        ? []
        : await prisma.submission.findMany({
            where: {
              roundId: originRound.id,
              songId: requestedSongId,
            },
            select: SONG_MEMORY_MODAL_SUBMISSION_SELECT,
          });

    if (originSubmissions.length === 0) {
      return {
        unavailable: true,
        originRoundId: originRound.id,
        requestedSongId,
        closeHref,
      };
    }

    const originSubmission = [...originSubmissions].sort(compareByCreatedAtAscending)[0];
    const evidenceSubmissions = await prisma.submission.findMany({
      where: {
        OR: [
          {
            songId: originSubmission.song.id,
          },
          {
            song: {
              artistId: originSubmission.song.artist.id,
            },
          },
        ],
      },
      select: SONG_MEMORY_MODAL_SUBMISSION_SELECT,
    });
    const exactSongSubmissions = evidenceSubmissions.filter(
      (submission) => submission.songId === originSubmission.song.id,
    );
    const artistSubmissions = evidenceSubmissions.filter(
      (submission) => submission.song.artistId === originSubmission.song.artist.id,
    );
    const ascendingRecords = sortSongMemoryHistory(
      exactSongSubmissions.map(buildSongMemorySortRecord),
    );
    const descendingRecords = sortSongMemoryHistoryNewestFirst(
      exactSongSubmissions.map(buildSongMemorySortRecord),
    );

    return {
      originRoundId: originRound.id,
      song: {
        id: originSubmission.song.id,
        title: originSubmission.song.title,
        artistName: originSubmission.song.artist.name,
      },
      familiarity: deriveSongFamiliarity({
        songId: originSubmission.song.id,
        artistId: originSubmission.song.artist.id,
        originRoundId: originRound.id,
        originSubmissionId: originSubmission.id,
        exactSongSubmissions: exactSongSubmissions.map(buildSongMemoryEvidenceRow),
        artistSubmissions: artistSubmissions.map(buildSongMemoryEvidenceRow),
      }),
      summary: buildSongMemorySummary({
        ascendingRecords,
        descendingRecords,
        artistSubmissions,
        songId: originSubmission.song.id,
      }),
      shortcuts: buildSongEvidenceShortcuts(ascendingRecords, descendingRecords),
      historyGroups: buildSongHistoryGroups(
        descendingRecords,
        originRound.game.id,
        originSubmission.id,
      ),
      closeHref,
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
                id: true,
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

    const representativeOriginsBySongId = buildRepresentativeOriginSubmissions([submission]);
    const { exactSubmissionsBySongId, artistSubmissionsByArtistId } =
      await getRoundFamiliarityEvidence(prisma, [submission]);

    return {
      originRoundId,
      playerId,
      submissionId: submission.id,
      playerName: originContext.displayName,
      roundId: submission.round.id,
      roundName: submission.round.name,
      title: submission.song.title,
      artistName: submission.song.artist.name,
      familiarity: buildRoundSubmissionFamiliarity({
        roundId: submission.round.id,
        submission,
        representativeOriginsBySongId,
        exactSubmissionsBySongId,
        artistSubmissionsByArtistId,
      }),
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
  compareSongMemoryHistoryOrder,
  deriveSongFamiliarity,
  deriveGameStandings,
  derivePlayerTrait,
  getPlayerModalSubmission,
  getPlayerRoundModal,
  getRoundDetail,
  getSongMemoryModal,
  getSongRoundModal,
  listArchiveGames,
  selectPlayerNotablePicks,
  sortSongMemoryHistory,
};
