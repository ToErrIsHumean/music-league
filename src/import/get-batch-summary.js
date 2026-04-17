const { PrismaClient } = require("@prisma/client");

const WORKFLOW_STAGE_COMPLETE = "complete";
const WORKFLOW_STAGE_CURRENT = "current";
const WORKFLOW_STAGE_PENDING = "pending";

async function getImportBatchSummary(batchId, input = {}) {
  const prisma = input.prisma ?? new PrismaClient();
  const ownsPrismaClient = !input.prisma;

  try {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        sourceFiles: {
          select: {
            fileKind: true,
            rowCount: true,
          },
        },
        roundRows: {
          select: {
            sourceRoundId: true,
            recordStatus: true,
            matchedRoundId: true,
          },
        },
        playerRows: {
          select: {
            recordStatus: true,
            matchedPlayerId: true,
          },
        },
        submissionRows: {
          select: {
            recordStatus: true,
            matchedArtistId: true,
            matchedSongId: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error(`getImportBatchSummary: batch not found: ${batchId}`);
    }

    const affectedRounds = await loadAffectedRoundIds(prisma, batch);

    const matchedPlayers = batch.playerRows.filter(
      (row) => row.recordStatus === "ready" && row.matchedPlayerId != null,
    ).length;
    const matchedRounds = batch.roundRows.filter(
      (row) => row.recordStatus === "ready" && row.matchedRoundId != null,
    ).length;
    const matchedSongs = countDistinctMatchedIds(
      batch.submissionRows,
      "matchedSongId",
    );
    const matchedArtists = countDistinctMatchedIds(
      batch.submissionRows,
      "matchedArtistId",
    );

    return {
      batchId: batch.id,
      gameKey: batch.gameKey,
      status: batch.status,
      workflow: buildWorkflow(batch.status, batch.failureStage),
      rowCounts: buildRowCounts(batch),
      matchCounts: {
        matched:
          matchedPlayers +
          matchedRounds +
          matchedSongs +
          matchedArtists,
        newEntities:
          batch.createdPlayerCount +
          batch.createdRoundCount +
          batch.createdArtistCount +
          batch.createdSongCount,
        openIssues: batch.issueCount,
      },
      createdEntityPlan: {
        players: batch.createdPlayerCount,
        rounds: batch.createdRoundCount,
        artists: batch.createdArtistCount,
        songs: batch.createdSongCount,
      },
      committedEntityCounts: buildCommittedEntityCounts(batch),
      affectedRounds,
      failureStage: batch.failureStage,
      failureSummary: batch.failureSummary,
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function buildWorkflow(status, failureStage) {
  if (status === "parsed") {
    return {
      stages: {
        parse: WORKFLOW_STAGE_COMPLETE,
        stage: WORKFLOW_STAGE_COMPLETE,
        validate: WORKFLOW_STAGE_CURRENT,
        commit: WORKFLOW_STAGE_PENDING,
      },
      awaiting: "system",
    };
  }

  if (status === "ready") {
    return {
      stages: {
        parse: WORKFLOW_STAGE_COMPLETE,
        stage: WORKFLOW_STAGE_COMPLETE,
        validate: WORKFLOW_STAGE_COMPLETE,
        commit: WORKFLOW_STAGE_PENDING,
      },
      awaiting: "none",
    };
  }

  if (status === "committed") {
    return {
      stages: {
        parse: WORKFLOW_STAGE_COMPLETE,
        stage: WORKFLOW_STAGE_COMPLETE,
        validate: WORKFLOW_STAGE_COMPLETE,
        commit: WORKFLOW_STAGE_COMPLETE,
      },
      awaiting: "none",
    };
  }

  if (status === "failed" && failureStage === "stage") {
    return {
      stages: {
        parse: WORKFLOW_STAGE_COMPLETE,
        stage: WORKFLOW_STAGE_CURRENT,
        validate: WORKFLOW_STAGE_PENDING,
        commit: WORKFLOW_STAGE_PENDING,
      },
      awaiting: "none",
    };
  }

  if (status === "failed" && failureStage === "commit") {
    return {
      stages: {
        parse: WORKFLOW_STAGE_COMPLETE,
        stage: WORKFLOW_STAGE_COMPLETE,
        validate: WORKFLOW_STAGE_COMPLETE,
        commit: WORKFLOW_STAGE_CURRENT,
      },
      awaiting: "none",
    };
  }

  return {
    stages: {
      parse: WORKFLOW_STAGE_COMPLETE,
      stage: WORKFLOW_STAGE_COMPLETE,
      validate: WORKFLOW_STAGE_CURRENT,
      commit: WORKFLOW_STAGE_PENDING,
    },
    awaiting: "none",
  };
}

function buildRowCounts(batch) {
  const rowCounts = {
    competitors: 0,
    rounds: 0,
    submissions: 0,
    votes: 0,
    total: batch.rowCount,
  };

  for (const sourceFile of batch.sourceFiles) {
    if (Object.prototype.hasOwnProperty.call(rowCounts, sourceFile.fileKind)) {
      rowCounts[sourceFile.fileKind] = sourceFile.rowCount;
    }
  }

  return rowCounts;
}

function buildCommittedEntityCounts(batch) {
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

async function loadAffectedRoundIds(prisma, batch) {
  if (typeof batch.gameKey !== "string" || batch.gameKey.trim() === "") {
    return [];
  }

  const sourceRoundIds = [...new Set(
    batch.roundRows
      .map((row) => normalizeNonBlankString(row.sourceRoundId))
      .filter(Boolean),
  )];

  if (sourceRoundIds.length === 0) {
    return [];
  }

  const rounds = await prisma.round.findMany({
    where: {
      leagueSlug: batch.gameKey,
      sourceRoundId: {
        in: sourceRoundIds,
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return rounds.map((round) => round.id);
}

function countDistinctMatchedIds(rows, key) {
  const matchedIds = new Set();

  for (const row of rows) {
    if (row.recordStatus === "ready" && row[key] != null) {
      matchedIds.add(row[key]);
    }
  }

  return matchedIds.size;
}

function normalizeNonBlankString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

module.exports = {
  getImportBatchSummary,
};
