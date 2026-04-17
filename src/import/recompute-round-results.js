const { PrismaClient } = require("@prisma/client");

function toUniqueRoundIds(roundIds) {
  return [...new Set(roundIds)];
}

function buildDenseRanks(scoreRows) {
  const rankedRows = scoreRows
    .filter((row) => row.score !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.songId - right.songId;
    });

  let currentRank = 0;
  let previousScore = null;

  return rankedRows.map((row) => {
    if (row.score !== previousScore) {
      currentRank += 1;
      previousScore = row.score;
    }

    return {
      songId: row.songId,
      score: row.score,
      rank: currentRank,
    };
  });
}

async function recomputeRoundResults(roundIds, input = {}) {
  const prisma = input.prisma ?? new PrismaClient();
  const ownsPrismaClient = !input.prisma;
  const targetRoundIds = toUniqueRoundIds(roundIds);

  try {
    if (targetRoundIds.length === 0) {
      return;
    }

    const [submissions, votes] = await Promise.all([
      prisma.submission.findMany({
        where: {
          roundId: {
            in: targetRoundIds,
          },
        },
        select: {
          id: true,
          roundId: true,
          songId: true,
        },
      }),
      prisma.vote.findMany({
        where: {
          roundId: {
            in: targetRoundIds,
          },
        },
        select: {
          id: true,
          roundId: true,
          songId: true,
          pointsAssigned: true,
        },
      }),
    ]);

    const submissionSongKeys = new Set(
      submissions.map((submission) => `${submission.roundId}:${submission.songId}`),
    );

    for (const vote of votes) {
      const submissionKey = `${vote.roundId}:${vote.songId}`;

      if (!submissionSongKeys.has(submissionKey)) {
        throw new Error(
          `recomputeRoundResults: vote ${vote.id} in round ${vote.roundId} has no matching submission for song ${vote.songId}`,
        );
      }
    }

    const scoresByRoundId = new Map();

    for (const vote of votes) {
      let scoresBySongId = scoresByRoundId.get(vote.roundId);

      if (!scoresBySongId) {
        scoresBySongId = new Map();
        scoresByRoundId.set(vote.roundId, scoresBySongId);
      }

      scoresBySongId.set(vote.songId, (scoresBySongId.get(vote.songId) ?? 0) + vote.pointsAssigned);
    }

    for (const roundId of targetRoundIds) {
      const scoresBySongId = scoresByRoundId.get(roundId) ?? new Map();
      const rankedRows = buildDenseRanks(
        [...scoresBySongId.entries()].map(([songId, score]) => ({
          songId,
          score,
        })),
      );

      await prisma.submission.updateMany({
        where: { roundId },
        data: {
          score: null,
          rank: null,
        },
      });

      for (const rankedRow of rankedRows) {
        await prisma.submission.updateMany({
          where: {
            roundId,
            songId: rankedRow.songId,
          },
          data: {
            score: rankedRow.score,
            rank: rankedRow.rank,
          },
        });
      }
    }
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

module.exports = {
  recomputeRoundResults,
};
