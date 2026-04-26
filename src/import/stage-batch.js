const { PrismaClient } = require("@prisma/client");

const { normalize } = require("../lib/normalize");
const {
  normalizeSourcePlayerIdsForImport,
} = require("./source-player-id-remaps");

const FILE_KINDS = ["competitors", "rounds", "submissions", "votes"];

const RECORD_KIND_BY_FILE_KIND = {
  batch: "batch",
  competitors: "player",
  rounds: "round",
  submissions: "submission",
  votes: "vote",
};

const DUPLICATE_KEY_BUILDERS = {
  competitors(row) {
    return row.sourcePlayerId;
  },
  rounds(row) {
    return row.sourceRoundId;
  },
  submissions(row) {
    return [row.sourceRoundId, row.sourceSubmitterId, row.spotifyUri].join("\u0000");
  },
  votes(row) {
    return [row.sourceRoundId, row.sourceVoterId, row.spotifyUri].join("\u0000");
  },
};

const DUPLICATE_ROW_NORMALIZERS = {
  competitors(row) {
    return {
      sourceRowNumber: row.sourceRowNumber,
      sourcePlayerId: row.sourcePlayerId ?? row.ID ?? "",
      rowPreview: row.rowPreview ?? row,
    };
  },
  rounds(row) {
    return {
      sourceRowNumber: row.sourceRowNumber,
      sourceRoundId: row.sourceRoundId ?? row.ID ?? "",
      rowPreview: row.rowPreview ?? row,
    };
  },
  submissions(row) {
    return {
      sourceRowNumber: row.sourceRowNumber,
      sourceRoundId: row.sourceRoundId ?? row["Round ID"] ?? "",
      sourceSubmitterId: row.sourceSubmitterId ?? row["Submitter ID"] ?? "",
      spotifyUri: row.spotifyUri ?? row["Spotify URI"] ?? "",
      rowPreview: row.rowPreview ?? row,
    };
  },
  votes(row) {
    return {
      sourceRowNumber: row.sourceRowNumber,
      sourceRoundId: row.sourceRoundId ?? row["Round ID"] ?? "",
      sourceVoterId: row.sourceVoterId ?? row["Voter ID"] ?? "",
      spotifyUri: row.spotifyUri ?? row["Spotify URI"] ?? "",
      rowPreview: row.rowPreview ?? row,
    };
  },
};

async function stageImportBundle(input) {
  const parsedBundle = input?.parsedBundle;
  const prisma = input?.prisma ?? new PrismaClient();
  const ownsPrismaClient = !input?.prisma;

  if (!parsedBundle || typeof parsedBundle !== "object") {
    throw new TypeError("stageImportBundle: parsedBundle is required");
  }

  const normalizedBundle = normalizeSourcePlayerIdsForImport(
    parsedBundle,
    input?.sourcePlayerIdRemapRules,
  );
  const duplicateResult = collectDuplicateRows(normalizedBundle);
  const stagedRows = buildStagedRows(
    normalizedBundle,
    duplicateResult.duplicateRowNumbers,
  );
  const issueRows = [
    ...parsedBundle.issues.map((issue) => toIssueCreateInput(issue)),
    ...duplicateResult.issues,
  ];

  const rowCounts = {
    competitors: stagedRows.playerRows.length,
    rounds: stagedRows.roundRows.length,
    submissions: stagedRows.submissionRows.length,
    votes: stagedRows.voteRows.length,
  };
  rowCounts.total =
    rowCounts.competitors +
    rowCounts.rounds +
    rowCounts.submissions +
    rowCounts.votes;

  let batch = null;

  try {
    batch = await prisma.importBatch.create({
      data: {
        sourceType: "music-league-csv",
        sourceFilename: parsedBundle.sourceLabel ?? null,
        gameKey: parsedBundle.gameKey ?? null,
        status: "parsed",
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.importSourceFile.createMany({
        data: FILE_KINDS.map((fileKind) => ({
          importBatchId: batch.id,
          fileKind,
          filename: parsedBundle.files[fileKind].filename,
          rowCount: parsedBundle.files[fileKind].rowCount,
        })),
      });

      if (issueRows.length > 0) {
        await tx.importIssue.createMany({
          data: issueRows.map((issue) => ({
            ...issue,
            importBatchId: batch.id,
          })),
        });
      }

      if (stagedRows.playerRows.length > 0) {
        await tx.importPlayerRow.createMany({
          data: stagedRows.playerRows.map((row) => ({
            ...row,
            importBatchId: batch.id,
          })),
        });
      }

      if (stagedRows.roundRows.length > 0) {
        await tx.importRoundRow.createMany({
          data: stagedRows.roundRows.map((row) => ({
            ...row,
            importBatchId: batch.id,
          })),
        });
      }

      if (stagedRows.submissionRows.length > 0) {
        await tx.importSubmissionRow.createMany({
          data: stagedRows.submissionRows.map((row) => ({
            ...row,
            importBatchId: batch.id,
          })),
        });
      }

      if (stagedRows.voteRows.length > 0) {
        await tx.importVoteRow.createMany({
          data: stagedRows.voteRows.map((row) => ({
            ...row,
            importBatchId: batch.id,
          })),
        });
      }

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          rowCount: rowCounts.total,
          issueCount: issueRows.filter((issue) => issue.blocking).length,
        },
      });
    });

    return {
      batchId: batch.id,
      gameKey: parsedBundle.gameKey ?? null,
      status: "parsed",
      rowCounts,
    };
  } catch (error) {
    if (batch !== null) {
      await markBatchFailed(prisma, batch.id, error);
    }

    throw error;
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function buildStagedRows(parsedBundle, duplicateRowNumbers) {
  return {
    playerRows: parsedBundle.files.competitors.rows
      .filter((row) => !duplicateRowNumbers.competitors.has(row.sourceRowNumber))
      .map((row) => ({
        sourceRowNumber: row.sourceRowNumber,
        sourcePlayerId: row.sourcePlayerId,
        rawName: row.displayName,
        normalizedName: normalize(row.displayName),
        recordStatus: "pending",
      })),
    roundRows: parsedBundle.files.rounds.rows
      .filter((row) => !duplicateRowNumbers.rounds.has(row.sourceRowNumber))
      .map((row) => ({
        sourceRowNumber: row.sourceRowNumber,
        sourceRoundId: row.sourceRoundId,
        rawName: row.name,
        rawDescription: row.description,
        rawPlaylistUrl: row.playlistUrl,
        rawOccurredAt: row.occurredAt,
        recordStatus: "pending",
      })),
    submissionRows: parsedBundle.files.submissions.rows
      .filter((row) => !duplicateRowNumbers.submissions.has(row.sourceRowNumber))
      .map((row) => ({
        sourceRowNumber: row.sourceRowNumber,
        sourceRoundId: row.sourceRoundId,
        sourceSubmitterId: row.sourceSubmitterId,
        spotifyUri: row.spotifyUri,
        rawTitle: row.title,
        rawArtist: row.artistName,
        rawSubmittedAt: row.submittedAt,
        rawComment: row.comment,
        rawVisibleToVoters: row.visibleToVoters,
        recordStatus: "pending",
      })),
    voteRows: parsedBundle.files.votes.rows
      .filter((row) => !duplicateRowNumbers.votes.has(row.sourceRowNumber))
      .map((row) => ({
        sourceRowNumber: row.sourceRowNumber,
        sourceRoundId: row.sourceRoundId,
        sourceVoterId: row.sourceVoterId,
        spotifyUri: row.spotifyUri,
        rawPointsAssigned: row.pointsAssigned,
        rawComment: row.comment,
        rawVotedAt: row.votedAt,
        recordStatus: "pending",
      })),
  };
}

function collectDuplicateRows(parsedBundle) {
  const duplicateRowNumbers = {
    competitors: new Set(),
    rounds: new Set(),
    submissions: new Set(),
    votes: new Set(),
  };
  const issues = [];

  for (const fileKind of FILE_KINDS) {
    const rows = getDuplicateSourceRows(parsedBundle.files[fileKind], fileKind);
    const keyBuilder = DUPLICATE_KEY_BUILDERS[fileKind];
    const firstRowByKey = new Map();

    for (const row of rows) {
      const key = keyBuilder(row);

      if (!firstRowByKey.has(key)) {
        firstRowByKey.set(key, row);
        continue;
      }

      duplicateRowNumbers[fileKind].add(row.sourceRowNumber);
      issues.push(
        toIssueCreateInput({
          sourceFileKind: fileKind,
          sourceRowNumber: row.sourceRowNumber,
          issueCode: "duplicate_source_row",
          message: `Duplicate source row for key: ${formatDuplicateKey(fileKind, row)}`,
          rowPreview: row.rowPreview ?? row,
        }),
      );
    }
  }

  return { duplicateRowNumbers, issues };
}

function getDuplicateSourceRows(fileResult, fileKind) {
  const rows = fileResult.sourceKeyRows ?? fileResult.rows;
  const normalizeRow = DUPLICATE_ROW_NORMALIZERS[fileKind];

  return rows.map((row) => normalizeRow(row));
}

function formatDuplicateKey(fileKind, row) {
  switch (fileKind) {
    case "competitors":
      return JSON.stringify({ sourcePlayerId: row.sourcePlayerId });
    case "rounds":
      return JSON.stringify({ sourceRoundId: row.sourceRoundId });
    case "submissions":
      return JSON.stringify({
        sourceRoundId: row.sourceRoundId,
        sourceSubmitterId: row.sourceSubmitterId,
        spotifyUri: row.spotifyUri,
      });
    case "votes":
      return JSON.stringify({
        sourceRoundId: row.sourceRoundId,
        sourceVoterId: row.sourceVoterId,
        spotifyUri: row.spotifyUri,
      });
    default:
      return JSON.stringify(row);
  }
}

function toIssueCreateInput(issue) {
  const rowPreview =
    issue.rowPreview === undefined || issue.rowPreview === null
      ? null
      : JSON.stringify(issue.rowPreview);

  return {
    sourceFileKind: issue.sourceFileKind,
    sourceRowNumber: issue.sourceRowNumber ?? null,
    recordKind: resolveRecordKind(issue),
    issueCode: issue.issueCode,
    blocking: true,
    message: issue.message,
    rowPreviewJson: rowPreview,
  };
}

function resolveRecordKind(issue) {
  if (issue.sourceRowNumber == null && issue.issueCode !== "duplicate_source_row") {
    return "batch";
  }

  return RECORD_KIND_BY_FILE_KIND[issue.sourceFileKind] ?? "batch";
}

async function markBatchFailed(prisma, batchId, error) {
  try {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "failed",
        failureStage: "stage",
        failureSummary: summarizeError(error),
      },
    });
  } catch {
    // Preserve the original staging error if the failure marker cannot be written.
  }
}

function summarizeError(error) {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

module.exports = {
  stageImportBundle,
};
