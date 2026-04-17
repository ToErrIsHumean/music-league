const { PrismaClient } = require("@prisma/client");

const { normalize } = require("../lib/normalize");

const REQUIRED_FILE_KINDS = ["competitors", "rounds", "submissions", "votes"];
const REPLAYABLE_VALIDATION_ISSUE_CODES = [
  "missing_file",
  "missing_header",
  "parse_error",
  "invalid_scalar",
  "duplicate_source_row",
];
const DERIVED_VALIDATION_ISSUE_CODES = ["unresolved_ref", "identity_conflict"];
const VALIDATION_ISSUE_CODES = [
  ...REPLAYABLE_VALIDATION_ISSUE_CODES,
  ...DERIVED_VALIDATION_ISSUE_CODES,
];

async function analyzeImportBatch(batchId, input = {}) {
  const prisma = input.prisma ?? new PrismaClient();
  const ownsPrismaClient = !input.prisma;

  try {
    return await prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: batchId },
        include: {
          sourceFiles: true,
          issues: true,
          playerRows: {
            orderBy: {
              sourceRowNumber: "asc",
            },
          },
          roundRows: {
            orderBy: {
              sourceRowNumber: "asc",
            },
          },
          submissionRows: {
            orderBy: {
              sourceRowNumber: "asc",
            },
          },
          voteRows: {
            orderBy: {
              sourceRowNumber: "asc",
            },
          },
        },
      });

      if (!batch) {
        throw new Error(`analyzeImportBatch: batch not found: ${batchId}`);
      }

      if (batch.status === "committed") {
        throw new Error(`analyzeImportBatch: batch is not mutable: ${batchId}`);
      }

      const lookups = await loadCanonicalLookups(tx, batch);
      const replayableIssues = batch.issues
        .filter((issue) => REPLAYABLE_VALIDATION_ISSUE_CODES.includes(issue.issueCode))
        .map((issue) => ({
          sourceFileKind: issue.sourceFileKind,
          sourceRowNumber: issue.sourceRowNumber,
          recordKind: issue.recordKind,
          issueCode: issue.issueCode,
          blocking: issue.blocking,
          message: issue.message,
          rowPreviewJson: issue.rowPreviewJson,
        }));
      const derivedIssues = buildValidationIssues(lookups);
      const validationIssues = replayableIssues.concat(derivedIssues);
      const summary = buildSummary(lookups);
      const openBlockingIssues = validationIssues.filter((issue) => issue.blocking).length;
      const status = openBlockingIssues === 0 ? "ready" : "failed";

      await tx.importIssue.deleteMany({
        where: {
          importBatchId: batch.id,
          issueCode: {
            in: VALIDATION_ISSUE_CODES,
          },
        },
      });

      if (validationIssues.length > 0) {
        await tx.importIssue.createMany({
          data: validationIssues.map((issue) => ({
            ...issue,
            importBatchId: batch.id,
          })),
        });
      }

      await Promise.all([
        ...lookups.playerAnalyses.map((analysis) =>
          tx.importPlayerRow.update({
            where: { id: analysis.rowId },
            data: {
              recordStatus: analysis.recordStatus,
              matchedPlayerId: analysis.matchedPlayerId,
            },
          }),
        ),
        ...lookups.roundAnalyses.map((analysis) =>
          tx.importRoundRow.update({
            where: { id: analysis.rowId },
            data: {
              recordStatus: analysis.recordStatus,
              matchedRoundId: analysis.matchedRoundId,
            },
          }),
        ),
        ...lookups.submissionAnalyses.map((analysis) =>
          tx.importSubmissionRow.update({
            where: { id: analysis.rowId },
            data: {
              recordStatus: analysis.recordStatus,
              matchedArtistId: analysis.matchedArtistId,
              matchedSongId: analysis.matchedSongId,
              matchedPlayerId: analysis.matchedPlayerId,
              matchedRoundId: analysis.matchedRoundId,
            },
          }),
        ),
        ...lookups.voteAnalyses.map((analysis) =>
          tx.importVoteRow.update({
            where: { id: analysis.rowId },
            data: {
              recordStatus: analysis.recordStatus,
              matchedSongId: analysis.matchedSongId,
              matchedVoterId: analysis.matchedVoterId,
              matchedRoundId: analysis.matchedRoundId,
            },
          }),
        ),
      ]);

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status,
          issueCount: openBlockingIssues,
          createdPlayerCount: summary.createdPlayers,
          createdRoundCount: summary.createdRounds,
          createdArtistCount: summary.createdArtists,
          createdSongCount: summary.createdSongs,
          failureStage: status === "failed" ? "validate" : null,
          failureSummary:
            status === "failed"
              ? `Validation found ${openBlockingIssues} blocking issue(s)`
              : null,
        },
      });

      return {
        batchId: batch.id,
        status,
        summary: {
          ...summary,
          openBlockingIssues,
        },
      };
    });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function loadCanonicalLookups(tx, batch) {
  const gameKey = batch.gameKey && batch.gameKey.trim() !== "" ? batch.gameKey.trim() : null;
  const playerSourceIds = uniqueNonBlank(batch.playerRows.map((row) => row.sourcePlayerId));
  const playerNames = uniqueNormalized(batch.playerRows.map((row) => row.rawName));
  const roundSourceIds = uniqueNonBlank(batch.roundRows.map((row) => row.sourceRoundId));
  const submissionSpotifyUris = uniqueNonBlank(
    batch.submissionRows.map((row) => row.spotifyUri),
  );
  const submissionArtistNames = uniqueNormalized(
    batch.submissionRows.map((row) => row.rawArtist),
  );

  const [playersBySourceId, playersByNormalizedName, roundsByKey, songsByUri, artistsByName] =
    await Promise.all([
      loadPlayersBySourceId(tx, playerSourceIds),
      loadPlayersByNormalizedName(tx, playerNames),
      loadRoundsByKey(tx, gameKey, roundSourceIds),
      loadSongsByUri(tx, submissionSpotifyUris),
      loadArtistsByName(tx, submissionArtistNames),
    ]);

  const playerAnalyses = analyzePlayerRows(batch.playerRows, {
    playersBySourceId,
    playersByNormalizedName,
  });
  const roundAnalyses = analyzeRoundRows(batch.roundRows, {
    gameKey,
    roundsByKey,
  });
  const submissionAnalyses = analyzeSubmissionRows(batch.submissionRows, {
    playerAnalysesBySourceId: new Map(
      playerAnalyses.map((analysis) => [analysis.sourcePlayerId, analysis]),
    ),
    roundAnalysesBySourceId: new Map(
      roundAnalyses.map((analysis) => [analysis.sourceRoundId, analysis]),
    ),
    songsByUri,
    artistsByName,
  });
  const voteAnalyses = analyzeVoteRows(batch.voteRows, {
    playerAnalysesBySourceId: new Map(
      playerAnalyses.map((analysis) => [analysis.sourcePlayerId, analysis]),
    ),
    roundAnalysesBySourceId: new Map(
      roundAnalyses.map((analysis) => [analysis.sourceRoundId, analysis]),
    ),
    submissionAnalysesByKey: new Map(
      submissionAnalyses
        .filter((analysis) => analysis.recordStatus === "ready")
        .map((analysis) => [getRoundSongKey(analysis.sourceRoundId, analysis.spotifyUri), analysis]),
    ),
  });

  return {
    gameKey,
    playerAnalyses,
    roundAnalyses,
    submissionAnalyses,
    voteAnalyses,
  };
}

async function loadPlayersBySourceId(tx, sourceIds) {
  if (sourceIds.length === 0) {
    return new Map();
  }

  const players = await tx.player.findMany({
    where: {
      sourcePlayerId: {
        in: sourceIds,
      },
    },
  });

  return new Map(players.map((player) => [player.sourcePlayerId, player]));
}

async function loadPlayersByNormalizedName(tx, normalizedNames) {
  if (normalizedNames.length === 0) {
    return new Map();
  }

  const players = await tx.player.findMany({
    where: {
      normalizedName: {
        in: normalizedNames,
      },
    },
  });

  return new Map(players.map((player) => [player.normalizedName, player]));
}

async function loadRoundsByKey(tx, gameKey, roundSourceIds) {
  if (!gameKey || roundSourceIds.length === 0) {
    return new Map();
  }

  const rounds = await tx.round.findMany({
    where: {
      leagueSlug: gameKey,
      sourceRoundId: {
        in: roundSourceIds,
      },
    },
  });

  return new Map(
    rounds.map((round) => [getScopedRoundKey(gameKey, round.sourceRoundId), round]),
  );
}

async function loadSongsByUri(tx, spotifyUris) {
  if (spotifyUris.length === 0) {
    return new Map();
  }

  const songs = await tx.song.findMany({
    where: {
      spotifyUri: {
        in: spotifyUris,
      },
    },
    include: {
      artist: true,
    },
  });

  return new Map(songs.map((song) => [song.spotifyUri, song]));
}

async function loadArtistsByName(tx, normalizedNames) {
  if (normalizedNames.length === 0) {
    return new Map();
  }

  const artists = await tx.artist.findMany({
    where: {
      normalizedName: {
        in: normalizedNames,
      },
    },
  });

  return new Map(artists.map((artist) => [artist.normalizedName, artist]));
}

function analyzePlayerRows(rows, lookups) {
  return rows.map((row) => {
    const sourcePlayerId = normalizeRequiredKey(row.sourcePlayerId);
    const normalizedName = safeNormalize(row.rawName);
    const analysis = {
      rowId: row.id,
      sourceRowNumber: row.sourceRowNumber,
      sourcePlayerId: row.sourcePlayerId,
      recordStatus: "ready",
      matchedPlayerId: null,
      matchDisposition: "create",
      issues: [],
    };

    if (!sourcePlayerId) {
      analysis.recordStatus = "blocked";
      analysis.matchDisposition = null;
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "competitors",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "player",
          issueCode: "unresolved_ref",
          message: "Missing required sourcePlayerId for competitor row",
        }),
      );
      return analysis;
    }

    if (!normalizedName) {
      analysis.recordStatus = "blocked";
      analysis.matchDisposition = null;
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "competitors",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "player",
          issueCode: "unresolved_ref",
          message: `Missing resolvable player name for sourcePlayerId ${JSON.stringify(row.sourcePlayerId)}`,
        }),
      );
      return analysis;
    }

    const matchedPlayer = lookups.playersBySourceId.get(row.sourcePlayerId);

    if (matchedPlayer) {
      if (matchedPlayer.normalizedName !== normalizedName) {
        analysis.recordStatus = "blocked";
        analysis.matchDisposition = null;
        analysis.issues.push(
          createRowIssue({
            sourceFileKind: "competitors",
            sourceRowNumber: row.sourceRowNumber,
            recordKind: "player",
            issueCode: "identity_conflict",
            message: `Player sourcePlayerId ${JSON.stringify(row.sourcePlayerId)} conflicts with canonical normalizedName ${JSON.stringify(matchedPlayer.normalizedName)}`,
          }),
        );
        return analysis;
      }

      analysis.matchedPlayerId = matchedPlayer.id;
      analysis.matchDisposition = "matched";
      return analysis;
    }

    const conflictingPlayer = lookups.playersByNormalizedName.get(normalizedName);

    if (conflictingPlayer && conflictingPlayer.sourcePlayerId !== row.sourcePlayerId) {
      analysis.recordStatus = "blocked";
      analysis.matchDisposition = null;
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "competitors",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "player",
          issueCode: "identity_conflict",
          message: `Player normalizedName ${JSON.stringify(normalizedName)} already belongs to sourcePlayerId ${JSON.stringify(conflictingPlayer.sourcePlayerId)}`,
        }),
      );
      return analysis;
    }

    return analysis;
  });
}

function analyzeRoundRows(rows, lookups) {
  return rows.map((row) => {
    const analysis = {
      rowId: row.id,
      sourceRowNumber: row.sourceRowNumber,
      sourceRoundId: row.sourceRoundId,
      recordStatus: "ready",
      matchedRoundId: null,
      matchDisposition: "create",
      issues: [],
    };

    if (!lookups.gameKey) {
      analysis.recordStatus = "blocked";
      analysis.matchDisposition = null;
      return analysis;
    }

    if (!normalizeRequiredKey(row.sourceRoundId)) {
      analysis.recordStatus = "blocked";
      analysis.matchDisposition = null;
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "rounds",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "round",
          issueCode: "unresolved_ref",
          message: "Missing required sourceRoundId for round row",
        }),
      );
      return analysis;
    }

    const matchedRound = lookups.roundsByKey.get(
      getScopedRoundKey(lookups.gameKey, row.sourceRoundId),
    );

    if (matchedRound) {
      analysis.matchedRoundId = matchedRound.id;
      analysis.matchDisposition = "matched";
    }

    return analysis;
  });
}

function analyzeSubmissionRows(rows, lookups) {
  return rows.map((row) => {
    const analysis = {
      rowId: row.id,
      sourceRowNumber: row.sourceRowNumber,
      sourceRoundId: row.sourceRoundId,
      sourceSubmitterId: row.sourceSubmitterId,
      spotifyUri: row.spotifyUri,
      recordStatus: "ready",
      matchedArtistId: null,
      matchedSongId: null,
      matchedPlayerId: null,
      matchedRoundId: null,
      songDisposition: "create",
      artistDisposition: "create",
      normalizedArtistName: null,
      issues: [],
    };

    const roundAnalysis = lookups.roundAnalysesBySourceId.get(row.sourceRoundId);

    if (!normalizeRequiredKey(row.sourceRoundId)) {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "submissions",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "submission",
          issueCode: "unresolved_ref",
          message: "Missing required sourceRoundId for submission row",
        }),
      );
    } else if (!roundAnalysis || roundAnalysis.recordStatus !== "ready") {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "submissions",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "submission",
          issueCode: "unresolved_ref",
          message: `Submission row references unresolved sourceRoundId ${JSON.stringify(row.sourceRoundId)}`,
        }),
      );
    } else {
      analysis.matchedRoundId = roundAnalysis.matchedRoundId;
    }

    const playerAnalysis = lookups.playerAnalysesBySourceId.get(row.sourceSubmitterId);

    if (!normalizeRequiredKey(row.sourceSubmitterId)) {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "submissions",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "submission",
          issueCode: "unresolved_ref",
          message: "Missing required sourcePlayerId for submission row",
        }),
      );
    } else if (!playerAnalysis || playerAnalysis.recordStatus !== "ready") {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "submissions",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "submission",
          issueCode: "unresolved_ref",
          message: `Submission row references unresolved sourcePlayerId ${JSON.stringify(row.sourceSubmitterId)}`,
        }),
      );
    } else {
      analysis.matchedPlayerId = playerAnalysis.matchedPlayerId;
    }

    if (!normalizeRequiredKey(row.spotifyUri)) {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "submissions",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "submission",
          issueCode: "unresolved_ref",
          message: "Missing required spotifyUri for submission row",
        }),
      );
    }

    const normalizedArtistName = safeNormalize(row.rawArtist);

    if (!normalizedArtistName) {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "submissions",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "submission",
          issueCode: "unresolved_ref",
          message: `Submission row is missing a resolvable artist for spotifyUri ${JSON.stringify(row.spotifyUri)}`,
        }),
      );
    } else {
      analysis.normalizedArtistName = normalizedArtistName;
      const matchedArtist = lookups.artistsByName.get(normalizedArtistName);

      if (matchedArtist) {
        analysis.matchedArtistId = matchedArtist.id;
        analysis.artistDisposition = "matched";
      }
    }

    const normalizedTitle = safeNormalize(row.rawTitle);
    const matchedSong = lookups.songsByUri.get(row.spotifyUri);

    if (!normalizedTitle) {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "submissions",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "submission",
          issueCode: "unresolved_ref",
          message: `Submission row is missing a resolvable title for spotifyUri ${JSON.stringify(row.spotifyUri)}`,
        }),
      );
    } else if (matchedSong && normalizedArtistName) {
      if (
        matchedSong.normalizedTitle !== normalizedTitle ||
        matchedSong.artist.normalizedName !== normalizedArtistName
      ) {
        analysis.issues.push(
          createRowIssue({
            sourceFileKind: "submissions",
            sourceRowNumber: row.sourceRowNumber,
            recordKind: "submission",
            issueCode: "identity_conflict",
            message: `Song spotifyUri ${JSON.stringify(row.spotifyUri)} conflicts with canonical song identity`,
          }),
        );
      } else {
        analysis.matchedSongId = matchedSong.id;
        analysis.songDisposition = "matched";
      }
    }

    if (analysis.issues.length > 0) {
      analysis.recordStatus = "blocked";
    }

    return analysis;
  });
}

function analyzeVoteRows(rows, lookups) {
  return rows.map((row) => {
    const analysis = {
      rowId: row.id,
      sourceRowNumber: row.sourceRowNumber,
      sourceRoundId: row.sourceRoundId,
      sourceVoterId: row.sourceVoterId,
      spotifyUri: row.spotifyUri,
      recordStatus: "ready",
      matchedSongId: null,
      matchedVoterId: null,
      matchedRoundId: null,
      issues: [],
    };

    const roundAnalysis = lookups.roundAnalysesBySourceId.get(row.sourceRoundId);

    if (!normalizeRequiredKey(row.sourceRoundId)) {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "votes",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "vote",
          issueCode: "unresolved_ref",
          message: "Missing required sourceRoundId for vote row",
        }),
      );
    } else if (!roundAnalysis || roundAnalysis.recordStatus !== "ready") {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "votes",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "vote",
          issueCode: "unresolved_ref",
          message: `Vote row references unresolved sourceRoundId ${JSON.stringify(row.sourceRoundId)}`,
        }),
      );
    } else {
      analysis.matchedRoundId = roundAnalysis.matchedRoundId;
    }

    const voterAnalysis = lookups.playerAnalysesBySourceId.get(row.sourceVoterId);

    if (!normalizeRequiredKey(row.sourceVoterId)) {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "votes",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "vote",
          issueCode: "unresolved_ref",
          message: "Missing required sourcePlayerId for vote row",
        }),
      );
    } else if (!voterAnalysis || voterAnalysis.recordStatus !== "ready") {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "votes",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "vote",
          issueCode: "unresolved_ref",
          message: `Vote row references unresolved sourcePlayerId ${JSON.stringify(row.sourceVoterId)}`,
        }),
      );
    } else {
      analysis.matchedVoterId = voterAnalysis.matchedPlayerId;
    }

    if (!normalizeRequiredKey(row.spotifyUri)) {
      analysis.issues.push(
        createRowIssue({
          sourceFileKind: "votes",
          sourceRowNumber: row.sourceRowNumber,
          recordKind: "vote",
          issueCode: "unresolved_ref",
          message: "Missing required spotifyUri for vote row",
        }),
      );
    } else {
      const submissionAnalysis = lookups.submissionAnalysesByKey.get(
        getRoundSongKey(row.sourceRoundId, row.spotifyUri),
      );

      if (!submissionAnalysis) {
        analysis.issues.push(
          createRowIssue({
            sourceFileKind: "votes",
            sourceRowNumber: row.sourceRowNumber,
            recordKind: "vote",
            issueCode: "unresolved_ref",
            message: `Vote row has no resolvable submission for round/song ${JSON.stringify({ sourceRoundId: row.sourceRoundId, spotifyUri: row.spotifyUri })}`,
          }),
        );
      } else {
        analysis.matchedSongId = submissionAnalysis.matchedSongId;
      }
    }

    if (analysis.issues.length > 0) {
      analysis.recordStatus = "blocked";
    }

    return analysis;
  });
}

function buildValidationIssues(lookups) {
  const issues = [];

  if (!lookups.gameKey) {
    issues.push(
      createBatchIssue({
        issueCode: "unresolved_ref",
        message: "Missing derived gameKey from rounds.csv",
        rowPreviewJson: JSON.stringify({
          sourceFiles: REQUIRED_FILE_KINDS,
        }),
      }),
    );
  }

  for (const analysis of [
    ...lookups.playerAnalyses,
    ...lookups.roundAnalyses,
    ...lookups.submissionAnalyses,
    ...lookups.voteAnalyses,
  ]) {
    issues.push(...analysis.issues);
  }

  return issues;
}

function buildSummary(lookups) {
  const summary = {
    matchedPlayers: 0,
    createdPlayers: 0,
    matchedRounds: 0,
    createdRounds: 0,
    matchedSongs: 0,
    createdSongs: 0,
    matchedArtists: 0,
    createdArtists: 0,
  };

  for (const analysis of lookups.playerAnalyses) {
    if (analysis.recordStatus !== "ready") {
      continue;
    }

    if (analysis.matchDisposition === "matched") {
      summary.matchedPlayers += 1;
    } else {
      summary.createdPlayers += 1;
    }
  }

  for (const analysis of lookups.roundAnalyses) {
    if (analysis.recordStatus !== "ready") {
      continue;
    }

    if (analysis.matchDisposition === "matched") {
      summary.matchedRounds += 1;
    } else {
      summary.createdRounds += 1;
    }
  }

  const songDispositions = new Map();
  const artistDispositions = new Map();

  for (const analysis of lookups.submissionAnalyses) {
    if (analysis.recordStatus !== "ready") {
      continue;
    }

    if (!songDispositions.has(analysis.spotifyUri)) {
      songDispositions.set(analysis.spotifyUri, analysis.songDisposition);
    }

    if (
      analysis.normalizedArtistName &&
      !artistDispositions.has(analysis.normalizedArtistName)
    ) {
      artistDispositions.set(
        analysis.normalizedArtistName,
        analysis.artistDisposition,
      );
    }
  }

  for (const disposition of songDispositions.values()) {
    if (disposition === "matched") {
      summary.matchedSongs += 1;
    } else {
      summary.createdSongs += 1;
    }
  }

  for (const disposition of artistDispositions.values()) {
    if (disposition === "matched") {
      summary.matchedArtists += 1;
    } else {
      summary.createdArtists += 1;
    }
  }

  return summary;
}

function createBatchIssue({ issueCode, message, rowPreviewJson }) {
  return {
    sourceFileKind: "batch",
    sourceRowNumber: null,
    recordKind: "batch",
    issueCode,
    blocking: true,
    message,
    rowPreviewJson,
  };
}

function createRowIssue({
  sourceFileKind,
  sourceRowNumber,
  recordKind,
  issueCode,
  message,
}) {
  return {
    sourceFileKind,
    sourceRowNumber,
    recordKind,
    issueCode,
    blocking: true,
    message,
    rowPreviewJson: null,
  };
}

function uniqueNonBlank(values) {
  return [...new Set(values.filter((value) => normalizeRequiredKey(value)))];
}

function uniqueNormalized(values) {
  const normalizedValues = values
    .map((value) => safeNormalize(value))
    .filter((value) => value !== null);

  return [...new Set(normalizedValues)];
}

function normalizeRequiredKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() === "" ? null : value;
}

function safeNormalize(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    return normalize(value);
  } catch {
    return null;
  }
}

function getScopedRoundKey(gameKey, sourceRoundId) {
  return `${gameKey}\u0000${sourceRoundId}`;
}

function getRoundSongKey(sourceRoundId, spotifyUri) {
  return `${sourceRoundId}\u0000${spotifyUri}`;
}

module.exports = {
  analyzeImportBatch,
};
