const { PrismaClient } = require("@prisma/client");
const {
  derivePlayerPerformanceMetrics,
  isScoredSubmission,
} = require("./player-metrics");
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

function compareRoundVoteOrder(left, right) {
  if (left.pointsAssigned !== right.pointsAssigned) {
    return right.pointsAssigned - left.pointsAssigned;
  }

  const voterNameComparison = left.voter.displayName.localeCompare(right.voter.displayName);

  if (voterNameComparison !== 0) {
    return voterNameComparison;
  }

  return left.id - right.id;
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

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildPlayerHistoryRow(submission) {
  return {
    submissionId: submission.id,
    gameId: submission.round.gameId,
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

function buildSubmissionSongIndex(submissions) {
  const submissionGroupsBySongId = new Map();

  for (const submission of submissions) {
    const submissionGroup = submissionGroupsBySongId.get(submission.song.id) ?? [];

    submissionGroup.push(submission);
    submissionGroupsBySongId.set(submission.song.id, submissionGroup);
  }

  return submissionGroupsBySongId;
}

function buildRoundVoteBreakdown(orderedSubmissions, votes) {
  const submissionGroupsBySongId = buildSubmissionSongIndex(orderedSubmissions);
  const votesBySongId = new Map();

  for (const vote of votes) {
    const submissionGroup = submissionGroupsBySongId.get(vote.songId);

    if (!submissionGroup) {
      throw new Error(
        `Round vote ${vote.id} targets song ${vote.songId} without a same-round submission`,
      );
    }

    if (submissionGroup.length > 1) {
      throw new Error(
        `Round vote ${vote.id} targets duplicate same-round song ${vote.songId}`,
      );
    }

    const songVotes = votesBySongId.get(vote.songId) ?? [];

    songVotes.push(vote);
    votesBySongId.set(vote.songId, songVotes);
  }

  return orderedSubmissions.map((submission) => ({
    submissionId: submission.id,
    song: {
      id: submission.song.id,
      title: submission.song.title,
      artistName: submission.song.artist.name,
    },
    submitter: {
      id: submission.player.id,
      displayName: submission.player.displayName,
    },
    rank: submission.rank,
    score: submission.score,
    submissionComment: submission.comment,
    votes: [...(votesBySongId.get(submission.song.id) ?? [])]
      .sort(compareRoundVoteOrder)
      .map((vote) => ({
        voter: {
          id: vote.voter.id,
          displayName: vote.voter.displayName,
        },
        pointsAssigned: vote.pointsAssigned,
        votedAt: toIsoString(vote.votedAt),
        voteComment: vote.comment,
      })),
  }));
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
  return derivePlayerPerformanceMetrics(gameSubmissions);
}

function deriveGameStandings(submissions) {
  const rowsByPlayer = new Map();
  const submissionsByRoundId = new Map();
  let scoredSubmissionCount = 0;

  for (const submission of submissions) {
    const roundSubmissions = submissionsByRoundId.get(submission.roundId) ?? [];

    roundSubmissions.push(submission);
    submissionsByRoundId.set(submission.roundId, roundSubmissions);

    if (isScoredSubmission(submission)) {
      scoredSubmissionCount += 1;
    }
  }

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

  const hasIncompleteSubmittedRound = [...submissionsByRoundId.values()].some(
    (roundSubmissions) =>
      roundSubmissions.length > 0 &&
      roundSubmissions.some((submission) => !isScoredSubmission(submission)),
  );
  const hasPartialScoreRankPair = submissions.some(
    (submission) =>
      (submission.score === null && submission.rank !== null) ||
      (submission.score !== null && submission.rank === null),
  );
  const completeness = hasIncompleteSubmittedRound
    ? "partial"
    : scoredSubmissionCount === 0 && !hasPartialScoreRankPair
      ? "none"
      : "complete";

  return {
    rows: standings,
    completeness,
  };
}

function formatGenericCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildSelectedGameFrame(game, rounds) {
  return {
    id: game.id,
    sourceGameId: game.sourceGameId,
    displayLabel: resolveGameDisplayLabel(game),
    roundCount: rounds.length,
    scoredRoundCount: rounds.filter((round) =>
      round.submissions.some((submission) => isScoredSubmission(submission)),
    ).length,
    earliestOccurredAt: toIsoString(findOldestOccurredAt(rounds)),
    latestOccurredAt: toIsoString(findNewestOccurredAt(rounds)),
    highestSequenceNumber: findHighestSequenceNumber(rounds),
    createdAt: toIsoString(game.createdAt),
  };
}

function compareRoundOrder(left, right) {
  const sequenceComparison = compareNullableAscending(
    left.sequenceNumber,
    right.sequenceNumber,
  );

  if (sequenceComparison !== 0) {
    return sequenceComparison;
  }

  const occurredAtComparison = compareNullableAscending(left.occurredAt, right.occurredAt);

  if (occurredAtComparison !== 0) {
    return occurredAtComparison;
  }

  return left.id - right.id;
}

function compareSelectedSubmissionOrder(left, right) {
  const rankComparison = compareNullableAscending(left.rank, right.rank);

  if (rankComparison !== 0) {
    return rankComparison;
  }

  const createdAtComparison = compareNullableAscending(left.createdAt, right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id - right.id;
}

function mapSelectedGameSubmission(submission) {
  return {
    id: submission.id,
    roundId: submission.roundId,
    playerId: submission.playerId,
    playerName: submission.player.displayName,
    songId: submission.songId,
    songTitle: submission.song.title,
    artistId: submission.song.artist.id,
    artistName: submission.song.artist.name,
    normalizedArtistName: submission.song.artist.normalizedName,
    score: submission.score,
    rank: submission.rank,
    submittedAt: toIsoString(submission.submittedAt),
    createdAt: toIsoString(submission.createdAt),
  };
}

function mapSelectedGameVote(vote) {
  return {
    id: vote.id,
    roundId: vote.roundId,
    voterId: vote.voterId,
    songId: vote.songId,
    pointsAssigned: vote.pointsAssigned,
    votedAt: toIsoString(vote.votedAt),
  };
}

function buildSelectedGameMemoryEvidenceRow(submission) {
  return {
    id: submission.id,
    submissionId: submission.id,
    gameId: submission.round.gameId,
    roundId: submission.roundId,
    roundSequenceNumber: submission.round.sequenceNumber,
    songId: submission.songId,
    playerId: submission.playerId,
    playerName: submission.player.displayName,
    artistId: submission.song.artist.id,
    artistName: submission.song.artist.name,
    createdAt: submission.createdAt,
    roundOccurredAt: submission.round.occurredAt,
    score: submission.score,
    rank: submission.rank,
    submittedAt: submission.submittedAt,
    normalizedArtistName: submission.song.artist.normalizedName,
  };
}

function groupSelectedGameMemoryEvidence(evidenceSubmissions) {
  const exactSubmissionsBySongId = new Map();
  const artistSubmissionsByNormalizedName = new Map();

  for (const submission of evidenceSubmissions) {
    const evidenceRow = buildSelectedGameMemoryEvidenceRow(submission);
    const exactSubmissions = exactSubmissionsBySongId.get(submission.songId) ?? [];
    const artistKey = submission.song.artist.normalizedName;
    const artistSubmissions = artistSubmissionsByNormalizedName.get(artistKey) ?? [];

    exactSubmissions.push(evidenceRow);
    artistSubmissions.push(evidenceRow);
    exactSubmissionsBySongId.set(submission.songId, exactSubmissions);
    artistSubmissionsByNormalizedName.set(artistKey, artistSubmissions);
  }

  return {
    exactSubmissionsBySongId,
    artistSubmissionsByNormalizedName,
  };
}

async function getSelectedGameMemoryEvidence(prisma, submissions) {
  const songIds = [...new Set(submissions.map((submission) => submission.songId))];
  const normalizedArtistNames = [
    ...new Set(submissions.map((submission) => submission.normalizedArtistName)),
  ];

  if (songIds.length === 0 && normalizedArtistNames.length === 0) {
    return groupSelectedGameMemoryEvidence([]);
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
            artist: {
              normalizedName: {
                in: normalizedArtistNames,
              },
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
      score: true,
      rank: true,
      submittedAt: true,
      createdAt: true,
      round: {
        select: {
          gameId: true,
          occurredAt: true,
          sequenceNumber: true,
        },
      },
      song: {
        select: {
          artistId: true,
          artist: {
            select: {
              id: true,
              name: true,
              normalizedName: true,
            },
          },
        },
      },
      player: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return groupSelectedGameMemoryEvidence(evidenceSubmissions);
}

function getArchiveEvidenceRows(archiveSongEvidence, mapName, legacyMapName, key) {
  const evidenceMap =
    archiveSongEvidence?.[mapName] ?? archiveSongEvidence?.[legacyMapName] ?? new Map();

  return (evidenceMap.get(key) ?? []).map((row) => ({
    ...row,
    id: row.id ?? row.submissionId,
    submissionId: row.submissionId ?? row.id,
  }));
}

function buildSelectedSubmissionHistoryRow(selectedGameId, submission) {
  return {
    id: submission.id,
    submissionId: submission.id,
    gameId: selectedGameId,
    roundId: submission.roundId,
    roundSequenceNumber: submission.roundSequenceNumber ?? null,
    songId: submission.songId,
    playerId: submission.playerId,
    playerName: submission.playerName,
    artistId: submission.artistId,
    artistName: submission.artistName,
    createdAt: submission.createdAt,
    roundOccurredAt: submission.roundOccurredAt ?? null,
    score: submission.score,
    rank: submission.rank,
    submittedAt: submission.submittedAt ?? null,
    normalizedArtistName: submission.normalizedArtistName,
  };
}

function getPriorEvidenceRows(evidenceRows, selectedRow) {
  return sortSongMemoryHistory(evidenceRows).filter(
    (row) =>
      row.submissionId !== selectedRow.submissionId &&
      compareSongMemoryHistoryOrder(row, selectedRow) < 0,
  );
}

function buildSelectedGameRoundScoringContext(submissions) {
  const submissionsByRoundId = new Map();

  for (const submission of submissions) {
    const roundSubmissions = submissionsByRoundId.get(submission.roundId) ?? [];

    roundSubmissions.push(submission);
    submissionsByRoundId.set(submission.roundId, roundSubmissions);
  }

  const contextByRoundId = new Map();

  for (const [roundId, roundSubmissions] of submissionsByRoundId.entries()) {
    const completeScoredSubmissions = getCompleteScoredSubmissions(roundSubmissions);

    contextByRoundId.set(roundId, {
      submissionCount: roundSubmissions.length,
      scoredSubmissionCount: completeScoredSubmissions.length,
      isCompleteScoredRound: completeScoredSubmissions.length === roundSubmissions.length,
      topHalfRankCutoff:
        completeScoredSubmissions.length === 0
          ? null
          : Math.ceil(completeScoredSubmissions.length / 2),
    });
  }

  return contextByRoundId;
}

function describeLandedFact(submission, roundScoringContext) {
  if (!isScoredSubmission(submission)) {
    return null;
  }

  const roundContext = roundScoringContext.get(submission.roundId);

  if (!roundContext?.isCompleteScoredRound) {
    return null;
  }

  if (submission.rank === 1) {
    return `ranked first across ${formatGenericCount(
      roundContext.scoredSubmissionCount,
      "scored submission",
    )}`;
  }

  if (submission.rank === 2) {
    return `placed second across ${formatGenericCount(
      roundContext.scoredSubmissionCount,
      "scored submission",
    )}`;
  }

  if (
    roundContext.topHalfRankCutoff !== null &&
    submission.rank <= roundContext.topHalfRankCutoff
  ) {
    return `finished in the top half across ${formatGenericCount(
      roundContext.scoredSubmissionCount,
      "scored submission",
    )}`;
  }

  return null;
}

function compareSongMemoryMomentCandidate(left, right) {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  const rankComparison = compareNullableAscending(
    left.submission.rank,
    right.submission.rank,
  );

  if (rankComparison !== 0) {
    return rankComparison;
  }

  const scoreComparison = compareNullableDescending(
    left.submission.score,
    right.submission.score,
  );

  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  const priorCountComparison = right.priorCount - left.priorCount;

  if (priorCountComparison !== 0) {
    return priorCountComparison;
  }

  return compareSelectedSubmissionOrder(left.submission, right.submission);
}

function buildSongMemoryEvidenceLinks(gameId, submission, roundName, includeRoundEvidence) {
  const songHref = buildMemoryBoardEvidenceHref({
    gameId,
    roundId: submission.roundId,
    songId: submission.songId,
  });

  if (!songHref) {
    return [];
  }

  const links = [
    {
      kind: "song",
      label: submission.songTitle,
      href: songHref,
      requiresGameContext: true,
      target: {
        gameId,
        roundId: submission.roundId,
        songId: submission.songId,
        submissionId: submission.id,
      },
    },
  ];

  if (includeRoundEvidence) {
    const roundHref = buildMemoryBoardEvidenceHref({
      gameId,
      roundId: submission.roundId,
    });

    if (!roundHref) {
      return [];
    }

    links.push({
      kind: "round",
      label: roundName,
      href: roundHref,
      requiresGameContext: true,
      target: {
        gameId,
        roundId: submission.roundId,
      },
    });
  }

  return links;
}

function buildSongDiscoveryMoment(candidate, selectedGameId, roundsById) {
  const { submission, landedFact } = candidate;
  const roundName = roundsById.get(submission.roundId)?.name ?? "this round";
  const evidence = buildSongMemoryEvidenceLinks(
    selectedGameId,
    submission,
    roundName,
    true,
  );

  if (evidence.length === 0) {
    return null;
  }

  return buildMemoryBoardMoment(
    "song",
    "Discovery memory",
    `${submission.songTitle} was new to us and landed`,
    `${submission.playerName} brought it into ${roundName}; it had no earlier exact-song or exported-artist history before this pick and ${landedFact}.`,
    evidence[0].href,
    {
      id: `new-to-us-that-landed-${submission.id}`,
      family: "new-to-us-that-landed",
      lens: "song-discovery",
      sourceFacts: [
        "games",
        "rounds",
        "submissions",
        "songs",
        "exported-artist-labels",
        "scores",
        "ranks",
      ],
      denominator: "archive history before the selected-game submission",
      evidence,
    },
  );
}

function buildSongRecurrenceMoment(candidate, selectedGameId, roundsById) {
  const { submission, recurrenceKind, priorCount } = candidate;
  const roundName = roundsById.get(submission.roundId)?.name ?? "this round";
  const evidence = buildSongMemoryEvidenceLinks(
    selectedGameId,
    submission,
    roundName,
    false,
  );

  if (evidence.length === 0) {
    return null;
  }

  if (recurrenceKind === "exact-song") {
    return buildMemoryBoardMoment(
      "song",
      "Song memory",
      `${submission.songTitle} came back`,
      `${submission.playerName} brought it into ${roundName} after ${formatGenericCount(
        priorCount,
        "prior exact-song appearance",
      )}.`,
      evidence[0].href,
      {
        id: `back-again-familiar-face-${submission.id}`,
        family: "back-again-familiar-face",
        lens: "song-discovery",
        sourceFacts: ["games", "rounds", "submissions", "songs", "exported-artist-labels"],
        denominator: "exact-song submissions across archive history",
        evidence,
      },
    );
  }

  return buildMemoryBoardMoment(
    "song",
    "Artist memory",
    `${submission.artistName} returned with a different song`,
    `${submission.playerName} brought ${submission.songTitle} into ${roundName} after ${formatGenericCount(
      priorCount,
      "prior exported-artist appearance",
    )}.`,
    evidence[0].href,
    {
      id: `back-again-familiar-face-${submission.id}`,
      family: "back-again-familiar-face",
      lens: "song-discovery",
      sourceFacts: ["games", "rounds", "submissions", "songs", "exported-artist-labels"],
      denominator: "exported-artist submissions across archive history",
      evidence,
    },
  );
}

function deriveSongMemoryMoments(input = {}) {
  const selectedGameId = normalizePositiveInteger(input.selectedGameId);
  const selectedGameSubmissions = input.selectedGameSubmissions ?? [];
  const archiveSongEvidence = input.archiveSongEvidence ?? {};

  if (selectedGameId === null || selectedGameSubmissions.length === 0) {
    return [];
  }

  const roundsById = new Map(
    (input.rounds ?? []).map((round) => [
      round.id,
      {
        name: round.name,
      },
    ]),
  );
  const roundScoringContext =
    input.roundScoringContext ?? buildSelectedGameRoundScoringContext(selectedGameSubmissions);
  const discoveryCandidates = [];
  const recurrenceCandidates = [];

  for (const submission of selectedGameSubmissions) {
    const selectedRow = buildSelectedSubmissionHistoryRow(selectedGameId, submission);
    const exactEvidenceRows = getArchiveEvidenceRows(
      archiveSongEvidence,
      "exactSongSubmissionsBySongId",
      "exactSubmissionsBySongId",
      submission.songId,
    ).filter((row) => row.songId === undefined || row.songId === submission.songId);
    const artistEvidenceRows = getArchiveEvidenceRows(
      archiveSongEvidence,
      "artistSubmissionsByNormalizedArtistName",
      "artistSubmissionsByNormalizedName",
      submission.normalizedArtistName,
    ).filter((row) => row.songId !== undefined);
    const priorExactRows = getPriorEvidenceRows(exactEvidenceRows, selectedRow);
    const priorArtistRows = getPriorEvidenceRows(artistEvidenceRows, selectedRow);
    const priorOtherArtistRows = priorArtistRows.filter(
      (row) => row.songId !== submission.songId,
    );
    const landedFact = describeLandedFact(submission, roundScoringContext);

    if (priorExactRows.length === 0 && priorArtistRows.length === 0 && landedFact) {
      discoveryCandidates.push({
        priority: 0,
        submission,
        landedFact,
        priorCount: 0,
      });
    }

    if (priorExactRows.length > 0) {
      recurrenceCandidates.push({
        priority: 1,
        submission,
        recurrenceKind: "exact-song",
        priorCount: priorExactRows.length,
      });
    } else if (priorOtherArtistRows.length > 0) {
      recurrenceCandidates.push({
        priority: 2,
        submission,
        recurrenceKind: "exported-artist",
        priorCount: priorOtherArtistRows.length,
      });
    }
  }

  return [
    ...discoveryCandidates
      .sort(compareSongMemoryMomentCandidate)
      .map((candidate) => buildSongDiscoveryMoment(candidate, selectedGameId, roundsById)),
    ...recurrenceCandidates
      .sort(compareSongMemoryMomentCandidate)
      .map((candidate) => buildSongRecurrenceMoment(candidate, selectedGameId, roundsById)),
  ].filter(Boolean);
}

function buildSelectedRoundSummary(round, submissions, gameId) {
  const orderedSubmissions = [...submissions].sort(compareSelectedSubmissionOrder);
  const winningSubmissions = orderedSubmissions.filter(
    (submission) => submission.rank === 1,
  );

  return {
    id: round.id,
    gameId: round.gameId,
    name: round.name,
    description: round.description,
    playlistUrl: round.playlistUrl,
    occurredAt: round.occurredAt,
    sequenceNumber: round.sequenceNumber,
    submissionCount: orderedSubmissions.length,
    href: buildArchiveHref({ gameId, roundId: round.id }),
    submissions: orderedSubmissions.map((submission) => ({
      id: submission.id,
      player: {
        id: submission.playerId,
        displayName: submission.playerName,
      },
      song: {
        id: submission.songId,
        title: submission.songTitle,
        artistName: submission.artistName,
      },
      score: submission.score,
      rank: submission.rank,
    })),
    winnerLabel:
      winningSubmissions.length === 1
        ? winningSubmissions[0].playerName
        : winningSubmissions.length > 1
          ? "Tied winners"
          : null,
    statusLabel: orderedSubmissions.every(
      (submission) => submission.rank === null && submission.score === null,
    )
      ? "pending"
      : orderedSubmissions.some(
            (submission) => submission.rank === null || submission.score === null,
          )
        ? "partial"
        : "scored",
  };
}

function buildCompetitiveLeaderHref(gameId, leader) {
  return buildMemoryBoardEvidenceHref({ gameId }) ?? "/";
}

function buildSelectedGameCompetitiveAnchor(submissions, gameId = null) {
  const standings = deriveGameStandings(submissions);

  if (standings.completeness === "none") {
    return null;
  }

  if (standings.completeness === "partial") {
    return {
      kind: "unavailable",
      title: "Results need complete score evidence",
      leaders: [],
      scoreContext: null,
      unavailableReason: "partial-score-rank-evidence",
      body:
        "At least one selected-game round has incomplete score or rank data, so game-level leader claims stay unavailable.",
      standings: [],
    };
  }

  const leaderScore = standings.rows[0].totalScore;
  const leaders = standings.rows.filter((standing) => standing.rank === 1);
  const scoredRoundCount = new Set(
    submissions
      .filter((submission) => isScoredSubmission(submission))
      .map((submission) => submission.roundId),
  ).size;
  const evidenceRoundId =
    submissions.find((submission) => isScoredSubmission(submission))?.roundId ?? null;
  const leaderLabel = leaders.map((leader) => leader.player.displayName).join(", ");
  const title =
    leaders.length === 1
      ? `${leaders[0].player.displayName} leads the game`
      : `Tied leaders: ${leaderLabel}`;
  const scoreContext =
    leaders.length === 1
      ? `${leaders[0].totalScore} points across ${formatGenericCount(
          leaders[0].scoredSubmissionCount,
          "scored pick",
        )}.`
      : `${leaderScore} points each across ${formatGenericCount(
          scoredRoundCount,
          "scored round",
        )}.`;

  return {
    kind: leaders.length === 1 ? "leader" : "tied-leaders",
    title,
    body: scoreContext,
    leaders: leaders.map((leader) => ({
      ...leader,
      rank: 1,
      href: buildCompetitiveLeaderHref(gameId, leader),
      playerName: leader.player.displayName,
    })),
    scoreContext,
    unavailableReason: null,
    scoredRoundCount,
    evidenceRoundId,
    incompleteSubmissionCount: 0,
    standings: standings.rows.slice(0, 3).map((standing) => ({
      ...standing,
      playerName: standing.player.displayName,
    })),
  };
}

function buildMemoryBoardMoment(kind, label, title, body, href = null, details = {}) {
  const family = details.family ?? kind;
  const lens =
    details.lens ??
    (kind === "competitive"
      ? "competitive"
      : kind === "song"
        ? "song-discovery"
        : "social-participation");
  const evidence =
    details.evidence ??
    (href
      ? [
          {
            kind: details.evidenceKind ?? "game",
            label,
            href,
            requiresGameContext: true,
            target: details.target,
          },
        ]
      : []);

  return {
    id: details.id ?? family,
    family,
    lens,
    kind,
    label,
    title,
    copy: body,
    body,
    sourceFacts: details.sourceFacts ?? [],
    denominator: details.denominator ?? "selected game",
    evidence,
    href,
  };
}

function buildSelectedGameCompetitiveMoment(competitiveAnchor, gameId) {
  if (
    !competitiveAnchor ||
    competitiveAnchor.kind === "unavailable" ||
    competitiveAnchor.unavailableReason !== null
  ) {
    return null;
  }

  const href =
    competitiveAnchor.evidenceRoundId === null
      ? buildMemoryBoardEvidenceHref({ gameId })
      : buildMemoryBoardEvidenceHref({
          gameId,
          roundId: competitiveAnchor.evidenceRoundId,
          section: "vote-breakdown",
        });

  return buildMemoryBoardMoment(
    "competitive",
    "Score evidence",
    `${formatGenericCount(competitiveAnchor.scoredRoundCount, "scored round")} counted`,
    "The board uses complete selected-game scored submissions for the result.",
    href,
    {
      id: "the-table",
      family: "the-table",
      lens: "competitive",
      sourceFacts: ["players", "games", "rounds", "submissions", "scores", "ranks"],
      denominator: "complete scored submissions in the selected game",
      evidenceKind: competitiveAnchor.evidenceRoundId === null ? "game" : "vote-breakdown",
      target:
        competitiveAnchor.evidenceRoundId === null
          ? { gameId }
          : {
              gameId,
              roundId: competitiveAnchor.evidenceRoundId,
              section: "vote-breakdown",
            },
    },
  );
}

function getCompleteScoredSubmissions(submissions) {
  if (submissions.length === 0) {
    return [];
  }

  return submissions.every((submission) => isScoredSubmission(submission))
    ? [...submissions].sort(compareSelectedSubmissionOrder)
    : [];
}

function getCompleteScoredRoundSubmissions(submissions) {
  if (submissions.length < 2) {
    return [];
  }

  return getCompleteScoredSubmissions(submissions);
}

function deriveGameSwingMoment(input) {
  const rounds = input?.rounds ?? [];
  const submissions = input?.submissions ?? [];
  const gameId =
    normalizePositiveInteger(input?.gameId) ??
    normalizePositiveInteger(rounds.find((round) => round?.gameId !== undefined)?.gameId);
  const submissionsByRoundId = new Map();

  for (const submission of submissions) {
    const roundSubmissions = submissionsByRoundId.get(submission.roundId) ?? [];

    roundSubmissions.push(submission);
    submissionsByRoundId.set(submission.roundId, roundSubmissions);
  }

  const candidates = [];

  for (const round of rounds) {
    const roundSubmissions = getCompleteScoredRoundSubmissions(
      submissionsByRoundId.get(round.id) ?? [],
    );

    if (roundSubmissions.length < 2) {
      continue;
    }

    const scoreGroups = new Map();

    for (const submission of roundSubmissions) {
      const group = scoreGroups.get(submission.score) ?? [];

      group.push(submission);
      scoreGroups.set(submission.score, group);
    }

    const scores = [...scoreGroups.keys()].sort((left, right) => right - left);
    const topScore = scores[0];
    const runnerUpScore = scores.find((score) => score < topScore) ?? null;
    const topSubmissions = scoreGroups.get(topScore) ?? [];
    const runnerUpSubmissions =
      runnerUpScore === null ? [] : (scoreGroups.get(runnerUpScore) ?? []);

    if (
      runnerUpScore === null ||
      topSubmissions.length !== 1 ||
      runnerUpSubmissions.length === 0
    ) {
      continue;
    }

    const margin = topScore - runnerUpScore;
    const winner = topSubmissions[0];
    const runnerUp = runnerUpSubmissions.sort(compareSelectedSubmissionOrder)[0];

    if (margin === 1) {
      candidates.push({
        type: "photo-finish",
        priority: 0,
        margin,
        round,
        winner,
        runnerUp,
        submissionCount: roundSubmissions.length,
      });
    } else if (margin >= 5) {
      candidates.push({
        type: "runaway-pick",
        priority: 1,
        margin,
        round,
        winner,
        runnerUp,
        submissionCount: roundSubmissions.length,
      });
    }
  }

  const selectedCandidate = candidates.sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    if (left.type === "runaway-pick" && left.margin !== right.margin) {
      return right.margin - left.margin;
    }

    return compareRoundOrder(left.round, right.round);
  })[0];

  if (!selectedCandidate || gameId === null) {
    return null;
  }

  const { type, margin, round, winner, runnerUp, submissionCount } = selectedCandidate;
  const href = buildMemoryBoardEvidenceHref({
    gameId,
    roundId: round.id,
    section: "vote-breakdown",
  });
  const title = type === "photo-finish" ? "Photo Finish" : "Runaway Pick";
  const copy =
    type === "photo-finish"
      ? `${winner.playerName}'s ${winner.songTitle} finished 1 point ahead of ${runnerUp.playerName}'s ${runnerUp.songTitle} in ${round.name}, across ${formatGenericCount(
          submissionCount,
          "scored submission",
        )}.`
      : `${winner.playerName}'s ${winner.songTitle} finished ${margin} points ahead of ${runnerUp.playerName}'s ${runnerUp.songTitle} in ${round.name}, across ${formatGenericCount(
          submissionCount,
          "scored submission",
        )}.`;

  return buildMemoryBoardMoment("competitive", title, title, copy, href, {
    id: `game-swing-${round.id}`,
    family: "game-swing",
    lens: "competitive",
    sourceFacts: ["rounds", "submissions", "scores", "ranks"],
    denominator: "scored submissions within one selected-game round",
    evidenceKind: "vote-breakdown",
    target: {
      gameId,
      roundId: round.id,
      section: "vote-breakdown",
    },
  });
}

function joinDisplayNames(names) {
  if (names.length <= 2) {
    return names.join(" and ");
  }

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function deriveParticipationPulse(input = {}) {
  const selectedGameId = normalizePositiveInteger(input.selectedGameId);
  const rounds = input.rounds ?? [];
  const submissions = input.submissions ?? [];

  if (selectedGameId === null || submissions.length === 0) {
    return null;
  }

  const playerIds = new Set(submissions.map((submission) => submission.playerId));
  const submittedRoundIds = new Set(submissions.map((submission) => submission.roundId));
  const submissionsByPlayerId = new Map();

  for (const submission of submissions) {
    const playerSubmissions = submissionsByPlayerId.get(submission.playerId) ?? {
      playerId: submission.playerId,
      playerName: submission.playerName,
      submissions: [],
    };

    playerSubmissions.submissions.push(submission);
    submissionsByPlayerId.set(submission.playerId, playerSubmissions);
  }

  const busiestCount = Math.max(
    ...[...submissionsByPlayerId.values()].map(
      (playerSubmissions) => playerSubmissions.submissions.length,
    ),
  );
  const busiestPlayers = [...submissionsByPlayerId.values()]
    .filter((playerSubmissions) => playerSubmissions.submissions.length === busiestCount)
    .sort((left, right) => left.playerName.localeCompare(right.playerName));
  const broadParticipation =
    rounds.length > 0 && submittedRoundIds.size === rounds.length
      ? `Submissions appeared in every selected-game round.`
      : `${formatGenericCount(
          submittedRoundIds.size,
          "round",
        )} had submitted songs.`;
  const busiestCopy =
    busiestPlayers.length === 1
      ? `${busiestPlayers[0].playerName} had the busiest slate with ${formatGenericCount(
          busiestCount,
          "submission",
        )}.`
      : `${joinDisplayNames(
          busiestPlayers.map((playerSubmissions) => playerSubmissions.playerName),
        )} shared the busiest slate with ${formatGenericCount(
          busiestCount,
          "submission",
        )} each.`;
  const gameHref = buildMemoryBoardEvidenceHref({ gameId: selectedGameId });

  if (!gameHref) {
    return null;
  }

  const evidence = [
    {
      kind: "game",
      label: "Selected game",
      href: gameHref,
      requiresGameContext: true,
      target: { gameId: selectedGameId },
    },
  ];

  for (const playerSubmissions of busiestPlayers.slice(0, 3)) {
    const evidenceSubmission = [...playerSubmissions.submissions].sort(
      compareSelectedSubmissionOrder,
    )[0];
    const playerHref = buildMemoryBoardEvidenceHref({
      gameId: selectedGameId,
      roundId: evidenceSubmission.roundId,
      playerId: playerSubmissions.playerId,
    });

    if (playerHref) {
      evidence.push({
        kind: "player",
        label: playerSubmissions.playerName,
        href: playerHref,
        requiresGameContext: true,
        target: {
          gameId: selectedGameId,
          roundId: evidenceSubmission.roundId,
          playerId: playerSubmissions.playerId,
        },
      });
    }
  }

  if (submissions.length === 0) {
    return null;
  }

  return buildMemoryBoardMoment(
    "participation",
    "Participation pulse",
    `${formatGenericCount(submissions.length, "song")} submitted`,
    `${formatGenericCount(playerIds.size, "player")} submitted ${formatGenericCount(
      submissions.length,
      "song",
    )} across ${formatGenericCount(
      submittedRoundIds.size,
      "round",
    )}. ${broadParticipation} ${busiestCopy}`,
    gameHref,
    {
      id: "participation-pulse",
      family: "participation-pulse",
      lens: "social-participation",
      sourceFacts: ["players", "rounds", "submissions"],
      denominator: "submitted songs, submitted rounds, and participating players in the selected game",
      evidence,
    },
  );
}

function buildSelectedGamePendingMoment(rounds) {
  const pendingRounds = rounds.filter((round) => round.statusLabel !== "scored");

  if (pendingRounds.length === 0) {
    return null;
  }

  return buildMemoryBoardMoment(
    "participation",
    "Still unfolding",
    `${formatGenericCount(pendingRounds.length, "round")} with incomplete scoring`,
    `${pendingRounds.map((round) => round.name).join(", ")} keeps outcome copy cautious.`,
    pendingRounds[0].href,
  );
}

function buildSelectedGameRoundWinnerMoments(rounds) {
  return rounds
    .filter((round) => round.winnerLabel)
    .slice(0, 2)
    .map((round) =>
      buildMemoryBoardMoment(
        "competitive",
        round.sequenceNumber === null ? "Round result" : `Round ${round.sequenceNumber}`,
        `${round.winnerLabel} took ${round.name}`,
        `${formatGenericCount(round.submissionCount, "submission")} counted in this selected game round.`,
        round.href,
      ),
    );
}

function buildSelectedGameSparseState(competitiveAnchor, submissions, momentsByFamily) {
  if (submissions.length === 0) {
    return {
      title: "No submissions yet",
      copy: "The selected game has rounds, but no submitted songs are available for board moments.",
      omittedFamilies: [
        "the-table",
        "game-swing",
        "new-to-us-that-landed",
        "back-again-familiar-face",
        "participation-pulse",
      ],
    };
  }

  const omittedFamilies = [];

  if (competitiveAnchor?.kind === "unavailable") {
    omittedFamilies.push("the-table");
  }

  for (const family of [
    "game-swing",
    "new-to-us-that-landed",
    "back-again-familiar-face",
    "participation-pulse",
  ]) {
    if (!momentsByFamily.has(family)) {
      omittedFamilies.push(family);
    }
  }

  if (omittedFamilies.length === 0) {
    return null;
  }

  return {
    title:
      omittedFamilies.length === 1 && omittedFamilies[0] === "the-table"
        ? "Some result claims are unavailable"
        : "Some memory angles are unavailable",
    copy:
      omittedFamilies.includes("the-table")
        ? "Incomplete score or rank evidence suppresses outcome-dependent claims while preserving unrelated selected-game memories."
        : "The board omits unsupported moment families instead of filling them with unevidenced recap copy.",
    omittedFamilies,
  };
}

function selectPriorityMemoryBoardMoments({
  competitiveMoment,
  swingMoment,
  songMoments,
  participationMoment,
}) {
  const selectedMoments = [];
  const selectedIds = new Set();
  const addMoment = (moment) => {
    if (!moment || selectedIds.has(moment.id) || selectedMoments.length >= 6) {
      return;
    }

    selectedMoments.push(moment);
    selectedIds.add(moment.id);
  };
  const discoveryMoment =
    songMoments.find((moment) => moment.family === "new-to-us-that-landed") ?? null;
  const recurrenceMoment =
    songMoments.find(
      (moment) =>
        moment.family === "back-again-familiar-face" && moment.id !== discoveryMoment?.id,
    ) ?? null;
  const songDiscoverySlot = discoveryMoment ?? recurrenceMoment;

  addMoment(competitiveMoment);
  addMoment(swingMoment);
  addMoment(songDiscoverySlot);
  addMoment(recurrenceMoment);
  addMoment(participationMoment);

  for (const moment of songMoments) {
    addMoment(moment);
  }

  return selectedMoments;
}

function buildSelectedGameBoard({ gameId, rounds, submissions, memoryEvidence }) {
  const roundsById = new Map(rounds.map((round) => [round.id, round]));
  const submissionsByRoundId = new Map();

  for (const submission of submissions) {
    const roundSubmissions = submissionsByRoundId.get(submission.roundId) ?? [];

    roundSubmissions.push(submission);
    submissionsByRoundId.set(submission.roundId, roundSubmissions);
  }

  const boardRounds = rounds.map((round) =>
    buildSelectedRoundSummary(round, submissionsByRoundId.get(round.id) ?? [], gameId),
  );
  const competitiveAnchor = buildSelectedGameCompetitiveAnchor(submissions, gameId);
  const submissionsWithRoundContext = submissions.map((submission) => {
    const round = roundsById.get(submission.roundId);

    return {
      ...submission,
      roundSequenceNumber: round?.sequenceNumber ?? null,
      roundOccurredAt: round?.occurredAt ?? null,
    };
  });
  const swingMoment = deriveGameSwingMoment({
    gameId,
    rounds,
    submissions,
  });
  const competitiveMoment = buildSelectedGameCompetitiveMoment(competitiveAnchor, gameId);
  const songMoments = deriveSongMemoryMoments({
    selectedGameId: gameId,
    selectedGameSubmissions: submissionsWithRoundContext,
    archiveSongEvidence: memoryEvidence,
    rounds,
  });
  const participationMoment = deriveParticipationPulse({
    selectedGameId: gameId,
    rounds: boardRounds,
    submissions,
  });
  const moments = selectPriorityMemoryBoardMoments({
    competitiveMoment,
    swingMoment,
    songMoments,
    participationMoment,
  });
  const momentsByFamily = new Set(moments.map((moment) => moment.family));

  return {
    selectedGameId: gameId,
    anchor: competitiveAnchor,
    competitiveAnchor,
    moments,
    sparseState: buildSelectedGameSparseState(competitiveAnchor, submissions, momentsByFamily),
    rounds: boardRounds,
  };
}

async function getSelectedGameMemoryBoard(gameId, input = {}) {
  const normalizedGameId = normalizePositiveInteger(gameId);
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    if (normalizedGameId === null) {
      return null;
    }

    const game = await prisma.game.findUnique({
      where: {
        id: normalizedGameId,
      },
      select: {
        id: true,
        sourceGameId: true,
        displayName: true,
        createdAt: true,
        rounds: {
          select: {
            id: true,
            gameId: true,
            name: true,
            description: true,
            playlistUrl: true,
            sequenceNumber: true,
            occurredAt: true,
            submissions: {
              select: {
                id: true,
                roundId: true,
                playerId: true,
                songId: true,
                score: true,
                rank: true,
                submittedAt: true,
                createdAt: true,
                player: {
                  select: {
                    displayName: true,
                  },
                },
                song: {
                  select: {
                    title: true,
                    artist: {
                      select: {
                        id: true,
                        name: true,
                        normalizedName: true,
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
                voterId: true,
                songId: true,
                pointsAssigned: true,
                votedAt: true,
              },
            },
          },
        },
      },
    });

    if (!game || game.rounds.length === 0) {
      return null;
    }

    const rounds = [...game.rounds].sort(compareRoundOrder).map((round) => ({
      id: round.id,
      gameId: round.gameId,
      name: round.name,
      description: round.description,
      playlistUrl: round.playlistUrl,
      sequenceNumber: round.sequenceNumber,
      occurredAt: toIsoString(round.occurredAt),
    }));
    const roundOrder = new Map(rounds.map((round, index) => [round.id, index]));
    const submissions = game.rounds
      .flatMap((round) => round.submissions.map(mapSelectedGameSubmission))
      .sort((left, right) => {
        const roundComparison = roundOrder.get(left.roundId) - roundOrder.get(right.roundId);

        if (roundComparison !== 0) {
          return roundComparison;
        }

        return compareSelectedSubmissionOrder(left, right);
      });
    const votes = game.rounds
      .flatMap((round) => round.votes.map(mapSelectedGameVote))
      .sort((left, right) => {
        const roundComparison = roundOrder.get(left.roundId) - roundOrder.get(right.roundId);

        if (roundComparison !== 0) {
          return roundComparison;
        }

        if (left.songId !== right.songId) {
          return left.songId - right.songId;
        }

        return left.id - right.id;
      });
    const memoryEvidence = await getSelectedGameMemoryEvidence(prisma, submissions);

    return {
      frame: buildSelectedGameFrame(game, game.rounds),
      rounds,
      submissions,
      votes,
      board: buildSelectedGameBoard({
        gameId: game.id,
        rounds,
        submissions,
        memoryEvidence,
      }),
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function buildGameBaselines(metricsByPlayer) {
  const playerMetrics = [...metricsByPlayer.values()].filter(
    (metrics) =>
      metrics.scoredSubmissionCount > 0 && metrics.averageFinishPercentile !== null,
  );

  return {
    playerCount: playerMetrics.length,
    averageFinishPercentile: average(
      playerMetrics.map((metrics) => metrics.averageFinishPercentile),
    ),
    scoreStdDev: average(playerMetrics.map((metrics) => metrics.rawScoreStdDev ?? 0)),
    winRate: average(playerMetrics.map((metrics) => metrics.winRate ?? 0)),
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

function formatScoredSubmissionCount(count) {
  return `${count} scored submission${count === 1 ? "" : "s"}`;
}

function buildPlayerTraitLine(kind, playerMetrics) {
  const scoredSubmissionCount =
    playerMetrics.scoredSubmissionCount ?? playerMetrics.scoredCount ?? 0;
  const countLabel = formatScoredSubmissionCount(scoredSubmissionCount);
  const winRate = playerMetrics.winRate ?? 0;
  const wins = playerMetrics.wins ?? Math.round(winRate * scoredSubmissionCount);

  if (kind === "win-rate") {
    return `Won ${wins} of ${countLabel}.`;
  }

  if (kind === "variance") {
    return `Scores varied widely across ${countLabel}.`;
  }

  if (kind === "top-finish" && scoredSubmissionCount === 1) {
    return "One scored submission landed near the top.";
  }

  if (kind === "top-finish") {
    return `Average finish stayed near the top across ${countLabel}.`;
  }

  if (scoredSubmissionCount === 1) {
    return "One scored submission landed lower in the table.";
  }

  return `Average finish sat lower in the table across ${countLabel}.`;
}

function derivePlayerTrait(input) {
  const { playerMetrics, gameBaselines } = input;
  const scoredSubmissionCount =
    playerMetrics.scoredSubmissionCount ?? playerMetrics.scoredCount ?? 0;
  const averageFinishPercentile = playerMetrics.averageFinishPercentile;
  const rawScoreStdDev = playerMetrics.rawScoreStdDev ?? playerMetrics.scoreStdDev ?? 0;
  const winRate = playerMetrics.winRate ?? 0;
  const wins =
    playerMetrics.wins ?? Math.round(winRate * Math.max(scoredSubmissionCount, 0));

  if (scoredSubmissionCount === 0 || averageFinishPercentile === null) {
    return null;
  }

  const candidates = [
    {
      kind: "win-rate",
      eligible: wins >= 2,
      dominanceDelta: winRate - gameBaselines.winRate,
      priority: 0,
    },
    {
      kind: "variance",
      eligible: scoredSubmissionCount >= 2,
      dominanceDelta: rawScoreStdDev - gameBaselines.scoreStdDev,
      priority: 1,
    },
    {
      kind: "top-finish",
      eligible: true,
      dominanceDelta:
        gameBaselines.averageFinishPercentile - averageFinishPercentile,
      priority: 2,
    },
    {
      kind: "low-finish",
      eligible: true,
      dominanceDelta:
        averageFinishPercentile - gameBaselines.averageFinishPercentile,
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
      line: buildPlayerTraitLine(dominantCandidate.kind, {
        ...playerMetrics,
        scoredSubmissionCount,
        winRate,
        wins,
      }),
    };
  }

  const fallbackCandidate =
    averageFinishPercentile <= gameBaselines.averageFinishPercentile
      ? candidates.find((candidate) => candidate.kind === "top-finish")
      : candidates.find((candidate) => candidate.kind === "low-finish");

  return fallbackCandidate
    ? {
        kind: fallbackCandidate.kind,
        line: buildPlayerTraitLine(fallbackCandidate.kind, {
          ...playerMetrics,
          scoredSubmissionCount,
          winRate,
          wins,
        }),
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

function findOldestOccurredAt(rounds) {
  return rounds.reduce((oldest, round) => {
    if (round.occurredAt === null) {
      return oldest;
    }

    if (oldest === null || round.occurredAt < oldest) {
      return round.occurredAt;
    }

    return oldest;
  }, null);
}

function findHighestSequenceNumber(rounds) {
  return rounds.reduce((highest, round) => {
    if (round.sequenceNumber === null) {
      return highest;
    }

    if (highest === null || round.sequenceNumber > highest) {
      return round.sequenceNumber;
    }

    return highest;
  }, null);
}

function isScoredRoundSummary(round) {
  return round.submissions.some(
    (submission) => submission.score !== null || submission.rank !== null,
  );
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
    submissions: orderedSubmissions.map((submission) => ({
      player: {
        id: submission.player.id,
        displayName: submission.player.displayName,
      },
      score: submission.score,
      rank: submission.rank,
    })),
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

function compareSelectableGameOrder(left, right) {
  const latestOccurredAtComparison = compareNullableDescending(
    left.latestOccurredAt,
    right.latestOccurredAt,
  );

  if (latestOccurredAtComparison !== 0) {
    return latestOccurredAtComparison;
  }

  const sequenceComparison = compareNullableDescending(
    left.highestSequenceNumber,
    right.highestSequenceNumber,
  );

  if (sequenceComparison !== 0) {
    return sequenceComparison;
  }

  const createdAtComparison = compareNullableDescending(left.createdAt, right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  const sourceGameIdComparison = left.sourceGameId.localeCompare(right.sourceGameId);

  if (sourceGameIdComparison !== 0) {
    return sourceGameIdComparison;
  }

  return left.id - right.id;
}

async function listSelectableGames(input = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const games = await prisma.game.findMany({
      select: {
        id: true,
        sourceGameId: true,
        displayName: true,
        createdAt: true,
        rounds: {
          select: {
            occurredAt: true,
            sequenceNumber: true,
            submissions: {
              select: {
                score: true,
                rank: true,
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
        scoredRoundCount: game.rounds.filter(isScoredRoundSummary).length,
        earliestOccurredAt: toIsoString(findOldestOccurredAt(game.rounds)),
        latestOccurredAt: toIsoString(findNewestOccurredAt(game.rounds)),
        highestSequenceNumber: findHighestSequenceNumber(game.rounds),
        createdAt: toIsoString(game.createdAt),
      }))
      .sort(compareSelectableGameOrder);
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
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
    const [{ exactSubmissionsBySongId, artistSubmissionsByArtistId }, votes] =
      await Promise.all([
        getRoundFamiliarityEvidence(prisma, orderedSubmissions),
        prisma.vote.findMany({
          where: {
            roundId: round.id,
          },
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
        }),
      ]);

    return {
      id: round.id,
      name: round.name,
      description: round.description,
      occurredAt: toIsoString(round.occurredAt),
      playlistUrl: round.playlistUrl,
      game: {
        id: round.game.id,
        sourceGameId: round.game.sourceGameId,
        displayName: round.game.displayName,
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
      voteBreakdown: buildRoundVoteBreakdown(orderedSubmissions, votes),
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

    const closeHref = buildArchiveHref({
      gameId: originRound.game.id,
      roundId: originRound.id,
    });
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
      playerId,
      scoredSubmissionCount: 0,
      submittedRoundCount: 0,
      averageFinishPercentile: 0,
      rawScoreStdDev: 0,
      winRate: null,
      minimumSampleMet: false,
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

function normalizeFragment(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function appendHrefFragment(href, fragment) {
  const normalizedFragment = normalizeFragment(fragment);

  return normalizedFragment ? `${href}#${encodeURIComponent(normalizedFragment)}` : href;
}

function buildArchiveHref(input = {}) {
  const gameId = normalizePositiveInteger(input.gameId);
  const roundId = normalizePositiveInteger(input.roundId);
  const params = new URLSearchParams();
  const fragment = normalizeFragment(input.fragment);

  if (gameId !== null) {
    params.set("game", String(gameId));
  }

  if (roundId === null) {
    const query = params.toString();

    return appendHrefFragment(query ? `/?${query}` : "/", fragment);
  }

  const songId = normalizePositiveInteger(input.songId);
  const playerId = normalizePositiveInteger(input.playerId);
  const playerSubmissionId =
    playerId === null ? null : normalizePositiveInteger(input.playerSubmissionId);

  params.set("round", String(roundId));

  if (playerId !== null) {
    params.set("player", String(playerId));

    if (playerSubmissionId !== null) {
      params.set("playerSubmission", String(playerSubmissionId));
    }
  } else if (songId !== null) {
    params.set("song", String(songId));
  }

  return appendHrefFragment(`/?${params.toString()}`, fragment);
}

function buildCanonicalSongMemoryHref(input = {}) {
  return buildArchiveHref({
    gameId: input.gameId,
    roundId: input.roundId,
    songId: input.songId,
  });
}

function buildMemoryBoardEvidenceHref(input = {}) {
  const gameId = normalizePositiveInteger(input.gameId);
  const roundId = normalizePositiveInteger(input.roundId);

  if (gameId === null) {
    return null;
  }

  if (roundId === null) {
    return buildArchiveHref({ gameId });
  }

  const songId = normalizePositiveInteger(input.songId);
  const playerId = normalizePositiveInteger(input.playerId);
  const submissionId = normalizePositiveInteger(input.submissionId);

  if (input.section === "vote-breakdown") {
    return buildArchiveHref({
      gameId,
      roundId,
      fragment: "vote-breakdown",
    });
  }

  if (submissionId !== null) {
    if (playerId !== null) {
      return buildArchiveHref({
        gameId,
        roundId,
        playerId,
        playerSubmissionId: submissionId,
      });
    }

    return buildArchiveHref({
      gameId,
      roundId,
      fragment: `submission-${submissionId}`,
    });
  }

  if (songId !== null) {
    return buildArchiveHref({ gameId, roundId, songId });
  }

  if (playerId !== null) {
    return buildArchiveHref({ gameId, roundId, playerId });
  }

  return buildArchiveHref({ gameId, roundId });
}

function buildSelectedGameRouteContext(context = {}) {
  const selectedGameId = normalizePositiveInteger(context.selectedGameId);
  const openRoundId = normalizePositiveInteger(context.openRoundId);
  const selectedGameHref =
    typeof context.selectedGameHref === "string" && context.selectedGameHref.length > 0
      ? context.selectedGameHref
      : selectedGameId === null
        ? "/"
        : buildArchiveHref({ gameId: selectedGameId });

  return {
    selectedGameId,
    openRoundId,
    selectedGameHref,
  };
}

function applySelectedGameRoundContext(round, routeContext) {
  const context = buildSelectedGameRouteContext(routeContext);

  if (!round || context.selectedGameId === null) {
    return round;
  }

  return {
    ...round,
    href: buildMemoryBoardEvidenceHref({
      gameId: context.selectedGameId,
      roundId: round.id,
    }),
    closeHref: context.selectedGameHref,
    submissions: (round.submissions ?? []).map((submission) => ({
      ...submission,
      href: buildMemoryBoardEvidenceHref({
        gameId: context.selectedGameId,
        roundId: round.id,
        submissionId: submission.id,
      }),
      songHref: buildMemoryBoardEvidenceHref({
        gameId: context.selectedGameId,
        roundId: round.id,
        songId: submission.song?.id,
      }),
      playerHref: buildMemoryBoardEvidenceHref({
        gameId: context.selectedGameId,
        roundId: round.id,
        playerId: submission.player?.id,
      }),
    })),
    voteBreakdownHref: buildMemoryBoardEvidenceHref({
      gameId: context.selectedGameId,
      roundId: round.id,
      section: "vote-breakdown",
    }),
    voteBreakdown: (round.voteBreakdown ?? []).map((group) => ({
      ...group,
      href: buildMemoryBoardEvidenceHref({
        gameId: context.selectedGameId,
        roundId: round.id,
        submissionId: group.submissionId,
      }),
    })),
  };
}

function applySelectedGameSongContext(songModal, routeContext) {
  const context = buildSelectedGameRouteContext(routeContext);

  if (!songModal || context.selectedGameId === null) {
    return songModal;
  }

  const originRoundId = normalizePositiveInteger(songModal.originRoundId);
  const closeHref =
    originRoundId === null
      ? context.selectedGameHref
      : buildMemoryBoardEvidenceHref({
          gameId: context.selectedGameId,
          roundId: originRoundId,
        });

  if (songModal.unavailable === true) {
    return {
      ...songModal,
      closeHref,
    };
  }

  return {
    ...songModal,
    closeHref,
    historyGroups: (songModal.historyGroups ?? []).map((group) => ({
      ...group,
      rows: (group.rows ?? []).map((row) => ({
        ...row,
        playerHref: buildMemoryBoardEvidenceHref({
          gameId: row.gameId,
          roundId: row.roundId,
          playerId: row.submitter?.id,
        }),
        roundHref: buildMemoryBoardEvidenceHref({
          gameId: row.gameId,
          roundId: row.roundId,
        }),
      })),
    })),
  };
}

function applySelectedGamePlayerContext(playerModal, routeContext) {
  const context = buildSelectedGameRouteContext(routeContext);

  if (!playerModal || context.selectedGameId === null) {
    return playerModal;
  }

  const originRoundId = normalizePositiveInteger(playerModal.originRoundId);
  const originGameId = normalizePositiveInteger(playerModal.originGameId) ?? context.selectedGameId;
  const closeHref =
    originRoundId === null
      ? context.selectedGameHref
      : buildMemoryBoardEvidenceHref({
          gameId: context.selectedGameId,
          roundId: originRoundId,
        });
  const playerHref =
    originRoundId === null
      ? null
      : buildMemoryBoardEvidenceHref({
          gameId: context.selectedGameId,
          roundId: originRoundId,
          playerId: playerModal.playerId,
        });
  const adaptSubmission = (submission) => ({
    ...submission,
    songHref: buildMemoryBoardEvidenceHref({
      gameId: submission.gameId ?? originGameId,
      roundId: submission.roundId,
      songId: submission.song?.id,
    }),
    roundHref: buildMemoryBoardEvidenceHref({
      gameId: submission.gameId ?? originGameId,
      roundId: submission.roundId,
    }),
  });

  return {
    ...playerModal,
    closeHref,
    backHref: playerHref,
    notablePicks: {
      best: playerModal.notablePicks?.best
        ? adaptSubmission(playerModal.notablePicks.best)
        : null,
      worst: playerModal.notablePicks?.worst
        ? adaptSubmission(playerModal.notablePicks.worst)
        : null,
    },
    history: (playerModal.history ?? []).map(adaptSubmission),
  };
}

function applySelectedGameRouteContext(payload, context) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if ("voteBreakdown" in payload && "submissions" in payload && "game" in payload) {
    return applySelectedGameRoundContext(payload, context);
  }

  if ("historyGroups" in payload || payload.unavailable === true) {
    return applySelectedGameSongContext(payload, context);
  }

  if ("playerId" in payload && "history" in payload) {
    return applySelectedGamePlayerContext(payload, context);
  }

  return payload;
}

module.exports = {
  applySelectedGameRouteContext,
  buildArchiveHref,
  buildCanonicalSongMemoryHref,
  buildMemoryBoardEvidenceHref,
  buildSelectedGameCompetitiveAnchor,
  compareSongMemoryHistoryOrder,
  deriveSongFamiliarity,
  deriveGameStandings,
  deriveGameSwingMoment,
  derivePlayerPerformanceMetrics,
  derivePlayerTrait,
  deriveParticipationPulse,
  deriveSongMemoryMoments,
  getPlayerModalSubmission,
  getPlayerRoundModal,
  getRoundDetail,
  getSelectedGameMemoryBoard,
  getSongMemoryModal,
  getSongRoundModal,
  listArchiveGames,
  listSelectableGames,
  selectPlayerNotablePicks,
  sortSongMemoryHistory,
};
