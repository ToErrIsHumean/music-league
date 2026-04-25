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
    roundId: submission.roundId,
    roundSequenceNumber: submission.round.sequenceNumber,
    songId: submission.songId,
    playerId: submission.playerId,
    playerName: submission.player.displayName,
    createdAt: submission.createdAt,
    roundOccurredAt: submission.round.occurredAt,
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
      createdAt: true,
      round: {
        select: {
          occurredAt: true,
          sequenceNumber: true,
        },
      },
      song: {
        select: {
          artist: {
            select: {
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

function buildSelectedSubmissionFamiliarity(submission, memoryEvidence) {
  return deriveSongFamiliarity({
    songId: submission.songId,
    artistId: submission.artistId,
    originRoundId: submission.roundId,
    originSubmissionId: submission.id,
    exactSongSubmissions:
      memoryEvidence.exactSubmissionsBySongId.get(submission.songId) ?? [],
    artistSubmissions:
      memoryEvidence.artistSubmissionsByNormalizedName.get(submission.normalizedArtistName) ??
      [],
  });
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

function buildSelectedGameCompetitiveAnchor(submissions) {
  const standings = deriveGameStandings(submissions);

  if (standings.length === 0) {
    return null;
  }

  const leaderScore = standings[0].totalScore;
  const leaders = standings.filter((standing) => standing.totalScore === leaderScore);
  const incompleteSubmissionCount = submissions.filter(
    (submission) => submission.score === null || submission.rank === null,
  ).length;
  const scoredRoundCount = new Set(
    submissions
      .filter((submission) => isScoredSubmission(submission))
      .map((submission) => submission.roundId),
  ).size;
  const title =
    leaders.length === 1
      ? `${leaders[0].player.displayName} leads the game`
      : `Tied leaders: ${leaders
          .map((leader) => leader.player.displayName)
          .join(", ")}`;
  const baseBody =
    leaders.length === 1
      ? `${leaders[0].totalScore} points across ${formatGenericCount(
          leaders[0].scoredSubmissionCount,
          "scored pick",
        )}.`
      : `${leaderScore} points each across ${formatGenericCount(
          scoredRoundCount,
          "scored round",
        )}.`;
  const caveat =
    incompleteSubmissionCount > 0
      ? ` ${formatGenericCount(
          incompleteSubmissionCount,
          "unscored pick",
        )} omitted from outcome claims.`
      : "";

  return {
    title,
    body: `${baseBody}${caveat}`,
    leaders: leaders.map((leader) => ({
      ...leader,
      playerName: leader.player.displayName,
    })),
    scoredRoundCount,
    incompleteSubmissionCount,
    standings: standings.slice(0, 3).map((standing) => ({
      ...standing,
      playerName: standing.player.displayName,
    })),
  };
}

function buildMemoryBoardMoment(kind, label, title, body, href = null) {
  return {
    kind,
    label,
    title,
    body,
    href,
  };
}

function buildSelectedGameCompetitiveMoment(competitiveAnchor) {
  if (!competitiveAnchor) {
    return null;
  }

  return buildMemoryBoardMoment(
    "competitive",
    "Score evidence",
    `${formatGenericCount(competitiveAnchor.scoredRoundCount, "scored round")} counted`,
    competitiveAnchor.incompleteSubmissionCount > 0
      ? `${formatGenericCount(
          competitiveAnchor.incompleteSubmissionCount,
          "unscored pick",
        )} stayed out of result claims.`
      : "The board uses selected-game scored submissions for the result.",
  );
}

function buildSelectedGameSongMoment(submissions, roundsById, memoryEvidence, gameId) {
  const candidates = submissions
    .map((submission) => ({
      submission,
      familiarity: buildSelectedSubmissionFamiliarity(submission, memoryEvidence),
    }))
    .sort((left, right) => compareSelectedSubmissionOrder(left.submission, right.submission));
  const priority = {
    "brought-back": 0,
    "known-artist": 1,
    debut: 2,
  };
  const selectedCandidate = candidates.sort((left, right) => {
    const priorityComparison =
      priority[left.familiarity.kind] - priority[right.familiarity.kind];

    if (priorityComparison !== 0) {
      return priorityComparison;
    }

    return compareSelectedSubmissionOrder(left.submission, right.submission);
  })[0];

  if (!selectedCandidate) {
    return null;
  }

  const { submission, familiarity } = selectedCandidate;
  const roundName = roundsById.get(submission.roundId)?.name ?? "this round";
  const href = buildArchiveHref({
    gameId,
    roundId: submission.roundId,
    songId: submission.songId,
  });

  if (familiarity.kind === "brought-back") {
    return buildMemoryBoardMoment(
      "song",
      "Song memory",
      `${submission.songTitle} came back`,
      `${submission.playerName} brought it into ${roundName} after ${formatGenericCount(
        familiarity.priorExactSongSubmissionCount,
        "prior exact-song appearance",
      )}.`,
      href,
    );
  }

  if (familiarity.kind === "known-artist") {
    return buildMemoryBoardMoment(
      "song",
      "Discovery memory",
      `${submission.artistName} felt familiar`,
      `${submission.songTitle} had ${formatGenericCount(
        familiarity.priorArtistSubmissionCount,
        "prior exported-artist appearance",
      )} before ${roundName}.`,
      href,
    );
  }

  return buildMemoryBoardMoment(
    "song",
    "Discovery memory",
    `${submission.songTitle} was new to this archive`,
    `No earlier exact-song or exported-artist history appeared before ${roundName}.`,
    href,
  );
}

function buildSelectedGameParticipationMoment(rounds, submissions, votes) {
  if (submissions.length === 0) {
    return null;
  }

  const playerCount = new Set(submissions.map((submission) => submission.playerId)).size;

  return buildMemoryBoardMoment(
    "participation",
    "Participation pulse",
    `${formatGenericCount(submissions.length, "song")} submitted`,
    `${formatGenericCount(playerCount, "player")} shaped ${formatGenericCount(
      rounds.length,
      "round",
    )}; ${formatGenericCount(votes.length, "vote")} imported where scoring exists.`,
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

function buildSelectedGameSparseMoment(rounds) {
  if (rounds.length === 0) {
    return null;
  }

  return buildMemoryBoardMoment(
    "memory",
    "Round evidence",
    `${formatGenericCount(rounds.length, "round")} available`,
    `${rounds.map((round) => round.name).join(", ")} remains available as canonical round evidence.`,
    rounds[0].href,
  );
}

function buildSelectedGameBoard({ gameId, rounds, submissions, votes, memoryEvidence }) {
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
  const competitiveAnchor = buildSelectedGameCompetitiveAnchor(submissions);
  const coreMoments = [
    buildSelectedGameCompetitiveMoment(competitiveAnchor),
    buildSelectedGameSongMoment(submissions, roundsById, memoryEvidence, gameId),
    buildSelectedGameParticipationMoment(boardRounds, submissions, votes),
    buildSelectedGamePendingMoment(boardRounds),
    ...buildSelectedGameRoundWinnerMoments(boardRounds),
  ].filter(Boolean);
  const moments =
    coreMoments.length > 0
      ? coreMoments.slice(0, 6)
      : [buildSelectedGameSparseMoment(boardRounds)].filter(Boolean);

  return {
    competitiveAnchor,
    moments,
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
        votes,
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

function buildArchiveHref(input = {}) {
  const gameId = normalizePositiveInteger(input.gameId);
  const roundId = normalizePositiveInteger(input.roundId);
  const params = new URLSearchParams();

  if (gameId !== null) {
    params.set("game", String(gameId));
  }

  if (roundId === null) {
    const query = params.toString();

    return query ? `/?${query}` : "/";
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

  return `/?${params.toString()}`;
}

function buildCanonicalSongMemoryHref(input = {}) {
  return buildArchiveHref({
    gameId: input.gameId,
    roundId: input.roundId,
    songId: input.songId,
  });
}

module.exports = {
  buildArchiveHref,
  buildCanonicalSongMemoryHref,
  compareSongMemoryHistoryOrder,
  deriveSongFamiliarity,
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
  listSelectableGames,
  selectPlayerNotablePicks,
  sortSongMemoryHistory,
};
