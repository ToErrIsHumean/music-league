const { PrismaClient } = require("@prisma/client");

const DEFAULT_LIMIT = 50;

async function listImportBatches(input = {}) {
  const prisma = input.prisma ?? new PrismaClient();
  const ownsPrismaClient = !input.prisma;
  const statuses = Array.isArray(input.statuses) ? input.statuses : undefined;

  try {
    const batches = await prisma.importBatch.findMany({
      where:
        statuses === undefined
          ? undefined
          : {
              status: {
                in: statuses,
              },
            },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: resolveLimit(input.limit),
    });

    return batches.map((batch) => ({
      batchId: batch.id,
      gameKey: batch.gameKey,
      sourceFilename: batch.sourceFilename,
      status: batch.status,
      rowCount: batch.rowCount,
      issueCount: batch.issueCount,
      createdCounts: buildCreatedCounts(batch),
      committedAt: batch.committedAt,
      failureStage: batch.failureStage,
      failureSummary: batch.failureSummary,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    }));
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function buildCreatedCounts(batch) {
  if (batch.status !== "committed") {
    return {
      players: 0,
      rounds: 0,
      artists: 0,
      songs: 0,
      submissionsUpserted: 0,
      votesUpserted: 0,
    };
  }

  return {
    players: batch.createdPlayerCount,
    rounds: batch.createdRoundCount,
    artists: batch.createdArtistCount,
    songs: batch.createdSongCount,
    submissionsUpserted: batch.submissionsUpsertedCount,
    votesUpserted: batch.votesUpsertedCount,
  };
}

function resolveLimit(limit) {
  if (!Number.isInteger(limit) || limit < 0) {
    return DEFAULT_LIMIT;
  }

  return limit;
}

module.exports = {
  listImportBatches,
};
