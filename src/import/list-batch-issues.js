const { PrismaClient } = require("@prisma/client");

const FILE_KIND_ORDER = new Map([
  ["batch", 0],
  ["competitors", 1],
  ["rounds", 2],
  ["submissions", 3],
  ["votes", 4],
]);

async function listImportBatchIssues(batchId, input = {}) {
  const prisma = input.prisma ?? new PrismaClient();
  const ownsPrismaClient = !input.prisma;

  try {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      select: { id: true },
    });

    if (!batch) {
      throw new Error(`listImportBatchIssues: batch not found: ${batchId}`);
    }

    const issues = await prisma.importIssue.findMany({
      where: { importBatchId: batchId },
      select: {
        id: true,
        blocking: true,
        sourceFileKind: true,
        sourceRowNumber: true,
        recordKind: true,
        issueCode: true,
        message: true,
        rowPreviewJson: true,
      },
    });

    const previewMaps = await loadPreviewMaps(prisma, batchId, issues);

    return issues
      .slice()
      .sort(compareIssues)
      .map((issue) => ({
        issueId: issue.id,
        blocking: issue.blocking,
        sourceFileKind: issue.sourceFileKind,
        sourceRowNumber: issue.sourceRowNumber,
        recordKind: issue.recordKind,
        issueCode: issue.issueCode,
        message: issue.message,
        rowPreview:
          getPreviewFromMap(previewMaps, issue.sourceFileKind, issue.sourceRowNumber) ??
          decodeRowPreviewJson(issue.rowPreviewJson),
      }));
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function loadPreviewMaps(prisma, batchId, issues) {
  const rowNumbersByFileKind = {
    competitors: new Set(),
    rounds: new Set(),
    submissions: new Set(),
    votes: new Set(),
  };

  for (const issue of issues) {
    if (
      issue.sourceRowNumber != null &&
      Object.prototype.hasOwnProperty.call(rowNumbersByFileKind, issue.sourceFileKind)
    ) {
      rowNumbersByFileKind[issue.sourceFileKind].add(issue.sourceRowNumber);
    }
  }

  const [playerRows, roundRows, submissionRows, voteRows] = await Promise.all([
    loadPlayerRows(prisma, batchId, rowNumbersByFileKind.competitors),
    loadRoundRows(prisma, batchId, rowNumbersByFileKind.rounds),
    loadSubmissionRows(prisma, batchId, rowNumbersByFileKind.submissions),
    loadVoteRows(prisma, batchId, rowNumbersByFileKind.votes),
  ]);

  return {
    competitors: createPreviewMap(playerRows, buildPlayerPreview),
    rounds: createPreviewMap(roundRows, buildRoundPreview),
    submissions: createPreviewMap(submissionRows, buildSubmissionPreview),
    votes: createPreviewMap(voteRows, buildVotePreview),
  };
}

async function loadPlayerRows(prisma, batchId, rowNumbers) {
  if (rowNumbers.size === 0) {
    return [];
  }

  return prisma.importPlayerRow.findMany({
    where: {
      importBatchId: batchId,
      sourceRowNumber: {
        in: [...rowNumbers],
      },
    },
    select: {
      sourceRowNumber: true,
      sourcePlayerId: true,
      rawName: true,
      normalizedName: true,
      recordStatus: true,
      matchedPlayerId: true,
    },
  });
}

async function loadRoundRows(prisma, batchId, rowNumbers) {
  if (rowNumbers.size === 0) {
    return [];
  }

  return prisma.importRoundRow.findMany({
    where: {
      importBatchId: batchId,
      sourceRowNumber: {
        in: [...rowNumbers],
      },
    },
    select: {
      sourceRowNumber: true,
      sourceRoundId: true,
      rawName: true,
      rawDescription: true,
      rawPlaylistUrl: true,
      rawOccurredAt: true,
      recordStatus: true,
      matchedRoundId: true,
    },
  });
}

async function loadSubmissionRows(prisma, batchId, rowNumbers) {
  if (rowNumbers.size === 0) {
    return [];
  }

  return prisma.importSubmissionRow.findMany({
    where: {
      importBatchId: batchId,
      sourceRowNumber: {
        in: [...rowNumbers],
      },
    },
    select: {
      sourceRowNumber: true,
      sourceRoundId: true,
      sourceSubmitterId: true,
      spotifyUri: true,
      rawTitle: true,
      rawArtist: true,
      rawSubmittedAt: true,
      rawComment: true,
      rawVisibleToVoters: true,
      recordStatus: true,
      matchedArtistId: true,
      matchedSongId: true,
      matchedPlayerId: true,
      matchedRoundId: true,
    },
  });
}

async function loadVoteRows(prisma, batchId, rowNumbers) {
  if (rowNumbers.size === 0) {
    return [];
  }

  return prisma.importVoteRow.findMany({
    where: {
      importBatchId: batchId,
      sourceRowNumber: {
        in: [...rowNumbers],
      },
    },
    select: {
      sourceRowNumber: true,
      sourceRoundId: true,
      sourceVoterId: true,
      spotifyUri: true,
      rawPointsAssigned: true,
      rawComment: true,
      rawVotedAt: true,
      recordStatus: true,
      matchedSongId: true,
      matchedVoterId: true,
      matchedRoundId: true,
    },
  });
}

function createPreviewMap(rows, buildPreview) {
  return new Map(rows.map((row) => [row.sourceRowNumber, buildPreview(row)]));
}

function buildPlayerPreview(row) {
  return {
    sourcePlayerId: row.sourcePlayerId,
    rawName: row.rawName,
    normalizedName: row.normalizedName,
    recordStatus: row.recordStatus,
    matchedPlayerId: row.matchedPlayerId,
  };
}

function buildRoundPreview(row) {
  return {
    sourceRoundId: row.sourceRoundId,
    rawName: row.rawName,
    rawDescription: row.rawDescription,
    rawPlaylistUrl: row.rawPlaylistUrl,
    rawOccurredAt: formatDate(row.rawOccurredAt),
    recordStatus: row.recordStatus,
    matchedRoundId: row.matchedRoundId,
  };
}

function buildSubmissionPreview(row) {
  return {
    sourceRoundId: row.sourceRoundId,
    sourceSubmitterId: row.sourceSubmitterId,
    spotifyUri: row.spotifyUri,
    rawTitle: row.rawTitle,
    rawArtist: row.rawArtist,
    rawSubmittedAt: formatDate(row.rawSubmittedAt),
    rawComment: row.rawComment,
    rawVisibleToVoters: row.rawVisibleToVoters,
    recordStatus: row.recordStatus,
    matchedArtistId: row.matchedArtistId,
    matchedSongId: row.matchedSongId,
    matchedPlayerId: row.matchedPlayerId,
    matchedRoundId: row.matchedRoundId,
  };
}

function buildVotePreview(row) {
  return {
    sourceRoundId: row.sourceRoundId,
    sourceVoterId: row.sourceVoterId,
    spotifyUri: row.spotifyUri,
    rawPointsAssigned: row.rawPointsAssigned,
    rawComment: row.rawComment,
    rawVotedAt: formatDate(row.rawVotedAt),
    recordStatus: row.recordStatus,
    matchedSongId: row.matchedSongId,
    matchedVoterId: row.matchedVoterId,
    matchedRoundId: row.matchedRoundId,
  };
}

function getPreviewFromMap(previewMaps, sourceFileKind, sourceRowNumber) {
  if (sourceRowNumber == null) {
    return null;
  }

  const previewMap = previewMaps[sourceFileKind];
  return previewMap?.get(sourceRowNumber) ?? null;
}

function decodeRowPreviewJson(rowPreviewJson) {
  if (typeof rowPreviewJson !== "string" || rowPreviewJson.trim() === "") {
    return {};
  }

  try {
    const parsed = JSON.parse(rowPreviewJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        rawPreviewJson: rowPreviewJson,
      };
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(parsed)) {
      sanitized[key] = sanitizePreviewValue(value);
    }

    return sanitized;
  } catch {
    return {
      rawPreviewJson: rowPreviewJson,
    };
  }
}

function sanitizePreviewValue(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return JSON.stringify(value);
}

function formatDate(value) {
  return value instanceof Date ? value.toISOString() : null;
}

function compareIssues(left, right) {
  const fileOrderDifference =
    (FILE_KIND_ORDER.get(left.sourceFileKind) ?? Number.MAX_SAFE_INTEGER) -
    (FILE_KIND_ORDER.get(right.sourceFileKind) ?? Number.MAX_SAFE_INTEGER);

  if (fileOrderDifference !== 0) {
    return fileOrderDifference;
  }

  const leftRowNumber = left.sourceRowNumber ?? -1;
  const rightRowNumber = right.sourceRowNumber ?? -1;

  if (leftRowNumber !== rightRowNumber) {
    return leftRowNumber - rightRowNumber;
  }

  return left.id - right.id;
}

module.exports = {
  listImportBatchIssues,
};
