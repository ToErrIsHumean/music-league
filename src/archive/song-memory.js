const SONG_FAMILIARITY_LABELS = {
  debut: "New to us",
  "known-artist": "Known artist",
  "brought-back": "Brought back",
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

function normalizeDateSortValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? String(value) : parsed;
}

function compareSongMemoryHistoryOrder(left, right) {
  const roundOccurredAtComparison = compareNullableAscending(
    normalizeDateSortValue(left.roundOccurredAt),
    normalizeDateSortValue(right.roundOccurredAt),
  );

  if (roundOccurredAtComparison !== 0) {
    return roundOccurredAtComparison;
  }

  const roundSequenceComparison = compareNullableAscending(
    left.roundSequenceNumber ?? null,
    right.roundSequenceNumber ?? null,
  );

  if (roundSequenceComparison !== 0) {
    return roundSequenceComparison;
  }

  const roundIdComparison = left.roundId - right.roundId;

  if (roundIdComparison !== 0) {
    return roundIdComparison;
  }

  const createdAtComparison = compareNullableAscending(
    normalizeDateSortValue(left.createdAt),
    normalizeDateSortValue(right.createdAt),
  );

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return left.id - right.id;
}

function sortSongMemoryHistory(submissions) {
  return [...submissions].sort(compareSongMemoryHistoryOrder);
}

function deriveSongFamiliarity(input) {
  const exactSongSubmissions = sortSongMemoryHistory(
    input.exactSongSubmissions.filter(
      (submission) => submission.songId === undefined || submission.songId === input.songId,
    ),
  );
  const artistSubmissions = sortSongMemoryHistory(
    input.artistSubmissions.filter((submission) => submission.songId !== undefined),
  );
  const originRoundId = input.originRoundId ?? null;
  const originRoundAnchor =
    originRoundId === null
      ? null
      : sortSongMemoryHistory(
          [...exactSongSubmissions, ...artistSubmissions].filter(
            (submission) => submission.roundId === originRoundId,
          ),
        )[0] ?? null;

  const priorExactSongSubmissions =
    originRoundAnchor === null
      ? []
      : exactSongSubmissions.filter(
          (submission) => compareSongMemoryHistoryOrder(submission, originRoundAnchor) < 0,
        );
  const otherArtistSubmissions = artistSubmissions.filter(
    (submission) => submission.songId !== input.songId,
  );
  const priorArtistSubmissions =
    originRoundAnchor === null
      ? []
      : otherArtistSubmissions.filter(
          (submission) => compareSongMemoryHistoryOrder(submission, originRoundAnchor) < 0,
        );

  const priorExactSongSubmissionCount =
    originRoundId === null ? Math.max(0, exactSongSubmissions.length - 1) : priorExactSongSubmissions.length;
  const priorArtistSubmissionCount =
    originRoundId === null ? otherArtistSubmissions.length : priorArtistSubmissions.length;
  const priorArtistSongCount = new Set(
    (originRoundId === null ? otherArtistSubmissions : priorArtistSubmissions).map(
      (submission) => submission.songId,
    ),
  ).size;
  const evidenceSubmitters =
    priorExactSongSubmissionCount > 0
      ? originRoundId === null
        ? exactSongSubmissions.slice(0, -1)
        : priorExactSongSubmissions
      : originRoundId === null
        ? otherArtistSubmissions
        : priorArtistSubmissions;

  if (priorExactSongSubmissionCount > 0) {
    return buildSongFamiliarityVerdict({
      kind: "brought-back",
      exactSongSubmissionCount: exactSongSubmissions.length,
      priorExactSongSubmissionCount,
      priorArtistSubmissionCount,
      priorArtistSongCount,
      throughSubmitters: buildThroughSubmitters(evidenceSubmitters),
    });
  }

  if (priorArtistSubmissionCount > 0) {
    return buildSongFamiliarityVerdict({
      kind: "known-artist",
      exactSongSubmissionCount: exactSongSubmissions.length,
      priorExactSongSubmissionCount,
      priorArtistSubmissionCount,
      priorArtistSongCount,
      throughSubmitters: buildThroughSubmitters(evidenceSubmitters),
    });
  }

  return buildSongFamiliarityVerdict({
    kind: "debut",
    exactSongSubmissionCount: exactSongSubmissions.length,
    priorExactSongSubmissionCount,
    priorArtistSubmissionCount,
    priorArtistSongCount,
    throughSubmitters: [],
  });
}

function buildSongFamiliarityVerdict({
  kind,
  exactSongSubmissionCount,
  priorExactSongSubmissionCount,
  priorArtistSubmissionCount,
  priorArtistSongCount,
  throughSubmitters,
}) {
  return {
    kind,
    label: SONG_FAMILIARITY_LABELS[kind],
    shortSummary: buildShortSummary({
      kind,
      priorExactSongSubmissionCount,
      priorArtistSubmissionCount,
      priorArtistSongCount,
    }),
    exactSongSubmissionCount,
    priorExactSongSubmissionCount,
    priorArtistSubmissionCount,
    priorArtistSongCount,
    throughSubmitters,
  };
}

function buildShortSummary({
  kind,
  priorExactSongSubmissionCount,
  priorArtistSubmissionCount,
  priorArtistSongCount,
}) {
  if (kind === "brought-back") {
    return `${formatCount(priorExactSongSubmissionCount, "earlier submission")} of this song`;
  }

  if (kind === "known-artist") {
    return `${formatCount(priorArtistSubmissionCount, "earlier submission")} across ${formatCount(
      priorArtistSongCount,
      "other song",
    )}`;
  }

  return "No earlier song or artist history";
}

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function buildThroughSubmitters(submissions) {
  const submitters = new Map();

  for (const submission of submissions) {
    if (!submitters.has(submission.playerId)) {
      submitters.set(submission.playerId, {
        id: submission.playerId,
        displayName: submission.playerName,
      });
    }
  }

  return Array.from(submitters.values());
}

module.exports = {
  compareSongMemoryHistoryOrder,
  deriveSongFamiliarity,
  sortSongMemoryHistory,
};
