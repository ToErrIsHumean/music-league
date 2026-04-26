const SOURCE_PLAYER_ID_REMAP_RULES = [
  {
    reusedSourcePlayerId: "19957d9ac36645bf852a590e3811b3b9",
    historicalSourcePlayerId: "f2c7860442964a8aa327c08f81ce884e",
    historicalDisplayName: "Happy Lucky",
    cutoffDate: "2025-10-01",
  },
];

function resolveSourcePlayerId(input) {
  const sourcePlayerId = input?.sourcePlayerId;
  const occurredAt = input?.occurredAt;
  const rules = input?.rules ?? SOURCE_PLAYER_ID_REMAP_RULES;

  if (typeof sourcePlayerId !== "string" || sourcePlayerId.trim() === "") {
    return sourcePlayerId;
  }

  if (!(occurredAt instanceof Date) || Number.isNaN(occurredAt.getTime())) {
    return sourcePlayerId;
  }

  const rule = rules.find((candidate) => candidate.reusedSourcePlayerId === sourcePlayerId);

  if (!rule || occurredAt >= new Date(`${rule.cutoffDate}T00:00:00.000Z`)) {
    return sourcePlayerId;
  }

  return rule.historicalSourcePlayerId;
}

function normalizeSourcePlayerIdsForImport(parsedBundle, rules = SOURCE_PLAYER_ID_REMAP_RULES) {
  const roundRowsBySourceId = new Map(
    parsedBundle.files.rounds.rows.map((row) => [row.sourceRoundId, row]),
  );
  const referencedPlayerIds = new Set();
  const remappedIdsByOriginalId = new Map();

  const submissionRows = normalizeReferenceRows({
    rows: parsedBundle.files.submissions.rows,
    playerIdField: "sourceSubmitterId",
    roundRowsBySourceId,
    referencedPlayerIds,
    remappedIdsByOriginalId,
    rules,
    trackReferences: true,
  });
  const voteRows = normalizeReferenceRows({
    rows: parsedBundle.files.votes.rows,
    playerIdField: "sourceVoterId",
    roundRowsBySourceId,
    referencedPlayerIds,
    remappedIdsByOriginalId,
    rules,
    trackReferences: true,
  });
  const playerRows = normalizePlayerRows({
    rows: parsedBundle.files.competitors.rows,
    referencedPlayerIds,
    remappedIdsByOriginalId,
    rules,
  });

  return {
    ...parsedBundle,
    files: {
      ...parsedBundle.files,
      competitors: withRows(parsedBundle.files.competitors, playerRows),
      submissions: withRows(
        parsedBundle.files.submissions,
        submissionRows,
        normalizeReferenceRows({
          rows: parsedBundle.files.submissions.sourceKeyRows,
          playerIdField: "sourceSubmitterId",
          roundRowsBySourceId,
          rules,
        }),
      ),
      votes: withRows(
        parsedBundle.files.votes,
        voteRows,
        normalizeReferenceRows({
          rows: parsedBundle.files.votes.sourceKeyRows,
          playerIdField: "sourceVoterId",
          roundRowsBySourceId,
          rules,
        }),
      ),
    },
  };
}

function normalizeReferenceRows(input) {
  if (!Array.isArray(input.rows)) {
    return input.rows;
  }

  return input.rows.map((row) => {
    const sourcePlayerId = row[input.playerIdField];
    const resolvedPlayerId = resolveSourcePlayerId({
      sourcePlayerId,
      occurredAt: input.roundRowsBySourceId.get(row.sourceRoundId)?.occurredAt,
      rules: input.rules,
    });

    if (input.trackReferences) {
      if (resolvedPlayerId) {
        input.referencedPlayerIds.add(resolvedPlayerId);
      }

      if (resolvedPlayerId !== sourcePlayerId) {
        const remappedIds = input.remappedIdsByOriginalId.get(sourcePlayerId) ?? new Set();
        remappedIds.add(resolvedPlayerId);
        input.remappedIdsByOriginalId.set(sourcePlayerId, remappedIds);
      }
    }

    return {
      ...row,
      [input.playerIdField]: resolvedPlayerId,
    };
  });
}

function normalizePlayerRows(input) {
  const displayNameOverridesBySourceId = new Map();

  for (const rule of input.rules) {
    if (
      typeof rule.historicalSourcePlayerId === "string" &&
      typeof rule.historicalDisplayName === "string" &&
      rule.historicalDisplayName.trim() !== ""
    ) {
      displayNameOverridesBySourceId.set(
        rule.historicalSourcePlayerId,
        rule.historicalDisplayName,
      );
    }
  }

  const rows = input.rows.map((row) => {
    const remappedIds = input.remappedIdsByOriginalId.get(row.sourcePlayerId) ?? new Set();
    const sourcePlayerId =
      remappedIds.size === 1 && !input.referencedPlayerIds.has(row.sourcePlayerId)
        ? [...remappedIds][0]
        : row.sourcePlayerId;

    return {
      ...row,
      sourcePlayerId,
      displayName: displayNameOverridesBySourceId.get(sourcePlayerId) ?? row.displayName,
    };
  });
  const sourcePlayerIds = new Set(rows.map((row) => row.sourcePlayerId));
  let syntheticSourceRowNumber = -1;

  for (const [originalPlayerId, remappedIds] of input.remappedIdsByOriginalId) {
    const sourceRow = input.rows.find((row) => row.sourcePlayerId === originalPlayerId);

    for (const remappedId of remappedIds) {
      if (!sourceRow || sourcePlayerIds.has(remappedId)) {
        continue;
      }

      rows.push({
        ...sourceRow,
        sourceRowNumber: syntheticSourceRowNumber,
        sourcePlayerId: remappedId,
        displayName:
          displayNameOverridesBySourceId.get(remappedId) ?? sourceRow.displayName,
      });
      syntheticSourceRowNumber -= 1;
      sourcePlayerIds.add(remappedId);
    }
  }

  return rows;
}

function withRows(fileResult, rows, sourceKeyRows = fileResult.sourceKeyRows) {
  const nextFileResult = {
    ...fileResult,
    rows,
  };

  Object.defineProperty(nextFileResult, "sourceKeyRows", {
    value: sourceKeyRows,
    enumerable: false,
    writable: true,
  });

  return nextFileResult;
}

module.exports = {
  SOURCE_PLAYER_ID_REMAP_RULES,
  normalizeSourcePlayerIdsForImport,
  resolveSourcePlayerId,
};
