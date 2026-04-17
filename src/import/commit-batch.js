const { PrismaClient } = require("@prisma/client");
const { normalize } = require("../lib/normalize");
const {
  recomputeRoundResults: defaultRecomputeRoundResults,
} = require("./recompute-round-results");

class CommitPreconditionError extends Error {}

async function commitImportBatch(batchId, input = {}) {
  const prisma = input.prisma ?? new PrismaClient();
  const ownsPrismaClient = !input.prisma;
  const recomputeRoundResults =
    input.recomputeRoundResults ?? defaultRecomputeRoundResults;
  const committedAt = resolveCommittedAt(input.now);

  try {
    await assertCommitPreconditions(prisma, batchId);

    try {
      return await prisma.$transaction(async (tx) => {
        await assertCommitPreconditions(tx, batchId);

        const batch = await loadCommitBatch(tx, batchId);
        const playerRows = requireReadyRows(batch.playerRows, "competitor", batch.id);
        const roundRows = requireReadyRows(batch.roundRows, "round", batch.id);
        const submissionRows = requireReadyRows(
          batch.submissionRows,
          "submission",
          batch.id,
        );
        const voteRows = requireReadyRows(batch.voteRows, "vote", batch.id);

        const playerPayloads = buildPlayerPayloads(playerRows, batch.id);
        const roundPayloads = buildRoundPayloads(roundRows, batch.id, batch.gameKey);
        const artistPayloads = buildArtistPayloads(submissionRows, batch.id);
        const songPayloads = buildSongPayloads(submissionRows, batch.id);

        const { createdCount: playersCreated, bySourcePlayerId } =
          await upsertPlayers(tx, playerPayloads);
        const { createdCount: artistsCreated, byNormalizedName } =
          await upsertArtists(tx, artistPayloads);
        const { createdCount: songsCreated, bySpotifyUri } = await upsertSongs(
          tx,
          songPayloads,
          byNormalizedName,
        );
        const { createdCount: roundsCreated, bySourceRoundId } = await upsertRounds(
          tx,
          roundPayloads,
        );

        const submissionPayloads = buildSubmissionPayloads(
          submissionRows,
          batch.id,
          bySourcePlayerId,
          bySourceRoundId,
          bySpotifyUri,
        );
        const votePayloads = buildVotePayloads(
          voteRows,
          batch.id,
          bySourcePlayerId,
          bySourceRoundId,
          bySpotifyUri,
        );

        await upsertSubmissions(tx, submissionPayloads);
        await upsertVotes(tx, votePayloads);

        const affectedRoundIds = [...new Set(
          roundPayloads.map((payload) =>
            requireCanonicalId(
              bySourceRoundId,
              payload.sourceRoundId,
              "round",
              batch.id,
              payload.sourceRoundId,
            ),
          ),
        )].sort((left, right) => left - right);

        await deleteStaleVotes(tx, affectedRoundIds, votePayloads);
        await deleteStaleSubmissions(tx, affectedRoundIds, submissionPayloads);
        await deleteStaleRounds(tx, batch.gameKey, roundPayloads);
        await recomputeRoundResults(affectedRoundIds, { prisma: tx });

        await tx.importBatch.update({
          where: { id: batch.id },
          data: {
            status: "committed",
            createdPlayerCount: playersCreated,
            createdRoundCount: roundsCreated,
            createdArtistCount: artistsCreated,
            createdSongCount: songsCreated,
            submissionsUpsertedCount: submissionPayloads.length,
            votesUpsertedCount: votePayloads.length,
            committedAt,
            failureStage: null,
            failureSummary: null,
            issueCount: 0,
          },
        });

        return {
          batchId: batch.id,
          status: "committed",
          canonicalWrites: {
            playersCreated,
            roundsCreated,
            artistsCreated,
            songsCreated,
            submissionsUpserted: submissionPayloads.length,
            votesUpserted: votePayloads.length,
          },
          affectedRoundIds,
        };
      });
    } catch (error) {
      if (error instanceof CommitPreconditionError) {
        throw error;
      }

      await prisma.importBatch.update({
        where: { id: batchId },
        data: {
          status: "failed",
          failureStage: "commit",
          failureSummary: buildFailureSummary(error),
          committedAt: null,
        },
      });

      throw error;
    }
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function assertCommitPreconditions(prisma, batchId) {
  const [batch, openBlockingIssues] = await Promise.all([
    prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        status: true,
      },
    }),
    prisma.importIssue.count({
      where: {
        importBatchId: batchId,
        blocking: true,
      },
    }),
  ]);

  if (!batch) {
    throw new CommitPreconditionError(`commitImportBatch: batch not found: ${batchId}`);
  }

  if (batch.status !== "ready") {
    throw new CommitPreconditionError(
      `commitImportBatch: batch status is not ready: ${batchId}`,
    );
  }

  if (openBlockingIssues > 0) {
    throw new CommitPreconditionError(
      `commitImportBatch: open blocking issues remain: ${batchId}`,
    );
  }
}

async function loadCommitBatch(tx, batchId) {
  const batch = await tx.importBatch.findUnique({
    where: { id: batchId },
    include: {
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
    throw new CommitPreconditionError(`commitImportBatch: batch not found: ${batchId}`);
  }

  if (typeof batch.gameKey !== "string" || batch.gameKey.trim() === "") {
    throw new Error(`commitImportBatch: ready batch is missing gameKey: ${batchId}`);
  }

  return batch;
}

function requireReadyRows(rows, recordKind, batchId) {
  const firstNonReadyRow = rows.find((row) => row.recordStatus !== "ready");

  if (firstNonReadyRow) {
    throw new Error(
      `commitImportBatch: ${recordKind} row ${firstNonReadyRow.id} is not ready in batch ${batchId}`,
    );
  }

  return rows;
}

function buildPlayerPayloads(rows, batchId) {
  return rows.map((row) => ({
    sourcePlayerId: requireNonBlankString(
      row.sourcePlayerId,
      "sourcePlayerId",
      batchId,
      row.id,
    ),
    displayName: requireNonBlankString(row.rawName, "player name", batchId, row.id),
    normalizedName: requireNonBlankString(
      row.normalizedName,
      "normalized player name",
      batchId,
      row.id,
    ),
  }));
}

function buildRoundPayloads(rows, batchId, gameKey) {
  return rows.map((row) => ({
    leagueSlug: gameKey,
    sourceRoundId: requireNonBlankString(
      row.sourceRoundId,
      "sourceRoundId",
      batchId,
      row.id,
    ),
    name: requireNonBlankString(row.rawName, "round name", batchId, row.id),
    description: row.rawDescription,
    playlistUrl: row.rawPlaylistUrl,
    occurredAt: row.rawOccurredAt,
  }));
}

function buildArtistPayloads(rows, batchId) {
  const payloadsByNormalizedName = new Map();

  for (const row of rows) {
    const artistName = requireNonBlankString(row.rawArtist, "artist name", batchId, row.id);
    const normalizedName = normalizeForCommit(artistName, "artist name", batchId, row.id);

    if (!payloadsByNormalizedName.has(normalizedName)) {
      payloadsByNormalizedName.set(normalizedName, {
        name: artistName,
        normalizedName,
      });
    }
  }

  return [...payloadsByNormalizedName.values()];
}

function buildSongPayloads(rows, batchId) {
  const payloadsBySpotifyUri = new Map();

  for (const row of rows) {
    const spotifyUri = requireNonBlankString(row.spotifyUri, "spotifyUri", batchId, row.id);
    const title = requireNonBlankString(row.rawTitle, "song title", batchId, row.id);
    const artistName = requireNonBlankString(row.rawArtist, "artist name", batchId, row.id);

    if (!payloadsBySpotifyUri.has(spotifyUri)) {
      payloadsBySpotifyUri.set(spotifyUri, {
        spotifyUri,
        title,
        normalizedTitle: normalizeForCommit(title, "song title", batchId, row.id),
        artistNormalizedName: normalizeForCommit(
          artistName,
          "artist name",
          batchId,
          row.id,
        ),
      });
    }
  }

  return [...payloadsBySpotifyUri.values()];
}

async function upsertPlayers(tx, payloads) {
  if (payloads.length === 0) {
    return {
      createdCount: 0,
      bySourcePlayerId: new Map(),
    };
  }

  const existingPlayers = await tx.player.findMany({
    where: {
      sourcePlayerId: {
        in: payloads.map((payload) => payload.sourcePlayerId),
      },
    },
  });
  const bySourcePlayerId = new Map(
    existingPlayers.map((player) => [player.sourcePlayerId, player]),
  );
  let createdCount = 0;

  for (const payload of payloads) {
    const existing = bySourcePlayerId.get(payload.sourcePlayerId);
    const player = existing
      ? await tx.player.update({
          where: { id: existing.id },
          data: payload,
        })
      : await tx.player.create({
          data: payload,
        });

    if (!existing) {
      createdCount += 1;
    }

    bySourcePlayerId.set(payload.sourcePlayerId, player);
  }

  return {
    createdCount,
    bySourcePlayerId,
  };
}

async function upsertArtists(tx, payloads) {
  if (payloads.length === 0) {
    return {
      createdCount: 0,
      byNormalizedName: new Map(),
    };
  }

  const existingArtists = await tx.artist.findMany({
    where: {
      normalizedName: {
        in: payloads.map((payload) => payload.normalizedName),
      },
    },
  });
  const byNormalizedName = new Map(
    existingArtists.map((artist) => [artist.normalizedName, artist]),
  );
  let createdCount = 0;

  for (const payload of payloads) {
    const existing = byNormalizedName.get(payload.normalizedName);
    const artist = existing
      ? await tx.artist.update({
          where: { id: existing.id },
          data: {
            name: payload.name,
          },
        })
      : await tx.artist.create({
          data: payload,
        });

    if (!existing) {
      createdCount += 1;
    }

    byNormalizedName.set(payload.normalizedName, artist);
  }

  return {
    createdCount,
    byNormalizedName,
  };
}

async function upsertSongs(tx, payloads, artistsByNormalizedName) {
  if (payloads.length === 0) {
    return {
      createdCount: 0,
      bySpotifyUri: new Map(),
    };
  }

  const existingSongs = await tx.song.findMany({
    where: {
      spotifyUri: {
        in: payloads.map((payload) => payload.spotifyUri),
      },
    },
  });
  const bySpotifyUri = new Map(existingSongs.map((song) => [song.spotifyUri, song]));
  let createdCount = 0;

  for (const payload of payloads) {
    const artist = artistsByNormalizedName.get(payload.artistNormalizedName);

    if (!artist) {
      throw new Error(
        `commitImportBatch: missing canonical artist for song ${JSON.stringify(payload.spotifyUri)}`,
      );
    }

    const songData = {
      title: payload.title,
      normalizedTitle: payload.normalizedTitle,
      artistId: artist.id,
      spotifyUri: payload.spotifyUri,
    };
    const existing = bySpotifyUri.get(payload.spotifyUri);
    const song = existing
      ? await tx.song.update({
          where: { id: existing.id },
          data: songData,
        })
      : await tx.song.create({
          data: songData,
        });

    if (!existing) {
      createdCount += 1;
    }

    bySpotifyUri.set(payload.spotifyUri, song);
  }

  return {
    createdCount,
    bySpotifyUri,
  };
}

async function upsertRounds(tx, payloads) {
  if (payloads.length === 0) {
    return {
      createdCount: 0,
      bySourceRoundId: new Map(),
    };
  }

  const existingRounds = await tx.round.findMany({
    where: {
      leagueSlug: payloads[0].leagueSlug,
      sourceRoundId: {
        in: payloads.map((payload) => payload.sourceRoundId),
      },
    },
  });
  const bySourceRoundId = new Map(
    existingRounds.map((round) => [round.sourceRoundId, round]),
  );
  let createdCount = 0;

  for (const payload of payloads) {
    const existing = bySourceRoundId.get(payload.sourceRoundId);
    const round = existing
      ? await tx.round.update({
          where: { id: existing.id },
          data: payload,
        })
      : await tx.round.create({
          data: payload,
        });

    if (!existing) {
      createdCount += 1;
    }

    bySourceRoundId.set(payload.sourceRoundId, round);
  }

  return {
    createdCount,
    bySourceRoundId,
  };
}

function buildSubmissionPayloads(
  rows,
  batchId,
  playersBySourcePlayerId,
  roundsBySourceRoundId,
  songsBySpotifyUri,
) {
  return rows.map((row) => ({
    roundId: requireCanonicalId(
      roundsBySourceRoundId,
      row.sourceRoundId,
      "round",
      batchId,
      row.id,
    ),
    playerId: requireCanonicalId(
      playersBySourcePlayerId,
      row.sourceSubmitterId,
      "player",
      batchId,
      row.id,
    ),
    songId: requireCanonicalId(songsBySpotifyUri, row.spotifyUri, "song", batchId, row.id),
    submittedAt: row.rawSubmittedAt,
    comment: row.rawComment,
    visibleToVoters: row.rawVisibleToVoters,
    sourceImportId: batchId,
  }));
}

function buildVotePayloads(
  rows,
  batchId,
  playersBySourcePlayerId,
  roundsBySourceRoundId,
  songsBySpotifyUri,
) {
  return rows.map((row) => ({
    roundId: requireCanonicalId(
      roundsBySourceRoundId,
      row.sourceRoundId,
      "round",
      batchId,
      row.id,
    ),
    voterId: requireCanonicalId(
      playersBySourcePlayerId,
      row.sourceVoterId,
      "player",
      batchId,
      row.id,
    ),
    songId: requireCanonicalId(songsBySpotifyUri, row.spotifyUri, "song", batchId, row.id),
    pointsAssigned: row.rawPointsAssigned,
    comment: row.rawComment,
    votedAt: row.rawVotedAt,
    sourceImportId: batchId,
  }));
}

async function upsertSubmissions(tx, payloads) {
  for (const payload of payloads) {
    await tx.submission.upsert({
      where: {
        roundId_playerId_songId: {
          roundId: payload.roundId,
          playerId: payload.playerId,
          songId: payload.songId,
        },
      },
      update: {
        submittedAt: payload.submittedAt,
        comment: payload.comment,
        visibleToVoters: payload.visibleToVoters,
        sourceImportId: payload.sourceImportId,
      },
      create: payload,
    });
  }
}

async function upsertVotes(tx, payloads) {
  for (const payload of payloads) {
    await tx.vote.upsert({
      where: {
        roundId_voterId_songId: {
          roundId: payload.roundId,
          voterId: payload.voterId,
          songId: payload.songId,
        },
      },
      update: {
        pointsAssigned: payload.pointsAssigned,
        comment: payload.comment,
        votedAt: payload.votedAt,
        sourceImportId: payload.sourceImportId,
      },
      create: payload,
    });
  }
}

async function deleteStaleVotes(tx, affectedRoundIds, incomingVotePayloads) {
  if (affectedRoundIds.length === 0) {
    return;
  }

  const existingVotes = await tx.vote.findMany({
    where: {
      roundId: {
        in: affectedRoundIds,
      },
    },
    select: {
      id: true,
      roundId: true,
      voterId: true,
      songId: true,
    },
  });
  const incomingKeys = new Set(incomingVotePayloads.map(getVoteKey));
  const staleVoteIds = existingVotes
    .filter((vote) => !incomingKeys.has(getVoteKey(vote)))
    .map((vote) => vote.id);

  if (staleVoteIds.length > 0) {
    await tx.vote.deleteMany({
      where: {
        id: {
          in: staleVoteIds,
        },
      },
    });
  }
}

async function deleteStaleSubmissions(tx, affectedRoundIds, incomingSubmissionPayloads) {
  if (affectedRoundIds.length === 0) {
    return;
  }

  const existingSubmissions = await tx.submission.findMany({
    where: {
      roundId: {
        in: affectedRoundIds,
      },
    },
    select: {
      id: true,
      roundId: true,
      playerId: true,
      songId: true,
    },
  });
  const incomingKeys = new Set(incomingSubmissionPayloads.map(getSubmissionKey));
  const staleSubmissionIds = existingSubmissions
    .filter((submission) => !incomingKeys.has(getSubmissionKey(submission)))
    .map((submission) => submission.id);

  if (staleSubmissionIds.length > 0) {
    await tx.submission.deleteMany({
      where: {
        id: {
          in: staleSubmissionIds,
        },
      },
    });
  }
}

async function deleteStaleRounds(tx, gameKey, incomingRoundPayloads) {
  const existingRounds = await tx.round.findMany({
    where: {
      leagueSlug: gameKey,
    },
    select: {
      id: true,
      sourceRoundId: true,
    },
  });
  const incomingRoundIds = new Set(
    incomingRoundPayloads.map((payload) => payload.sourceRoundId),
  );
  const staleRoundIds = existingRounds
    .filter((round) => !incomingRoundIds.has(round.sourceRoundId))
    .map((round) => round.id);

  if (staleRoundIds.length === 0) {
    return;
  }

  await tx.vote.deleteMany({
    where: {
      roundId: {
        in: staleRoundIds,
      },
    },
  });
  await tx.submission.deleteMany({
    where: {
      roundId: {
        in: staleRoundIds,
      },
    },
  });
  await tx.round.deleteMany({
    where: {
      id: {
        in: staleRoundIds,
      },
    },
  });
}

function getSubmissionKey(submission) {
  return `${submission.roundId}:${submission.playerId}:${submission.songId}`;
}

function getVoteKey(vote) {
  return `${vote.roundId}:${vote.voterId}:${vote.songId}`;
}

function requireCanonicalId(lookup, sourceKey, recordKind, batchId, rowId) {
  const value = lookup.get(sourceKey)?.id;

  if (!Number.isInteger(value)) {
    throw new Error(
      `commitImportBatch: missing canonical ${recordKind} for source key ${JSON.stringify(sourceKey)} in row ${rowId} of batch ${batchId}`,
    );
  }

  return value;
}

function requireNonBlankString(value, fieldName, batchId, rowId) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `commitImportBatch: row ${rowId} in batch ${batchId} is missing ${fieldName}`,
    );
  }

  return value;
}

function normalizeForCommit(value, fieldName, batchId, rowId) {
  try {
    return normalize(value);
  } catch (error) {
    throw new Error(
      `commitImportBatch: row ${rowId} in batch ${batchId} has invalid ${fieldName}`,
      { cause: error },
    );
  }
}

function buildFailureSummary(error) {
  return `Commit failed: ${getErrorMessage(error)}`;
}

function getErrorMessage(error) {
  if (error instanceof Error && typeof error.message === "string" && error.message !== "") {
    return error.message;
  }

  return String(error);
}

function resolveCommittedAt(nowInput) {
  if (typeof nowInput === "function") {
    return nowInput();
  }

  return new Date();
}

module.exports = {
  commitImportBatch,
};
