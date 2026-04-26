const { PrismaClient } = require("@prisma/client");
const { normalize } = require("../lib/normalize");
const {
  buildGameHref,
  buildPlayerHref,
  buildRoundHref,
  buildSongHref,
  buildSongSearchHref,
} = require("./route-utils");

const archiveDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const VALID_SONG_FAMILIARITY_FILTERS = new Set(["all", "first-time", "returning"]);
const VALID_SONG_SORTS = new Set([
  "most-appearances",
  "most-recent",
  "best-finish",
  "alphabetical",
]);
const HEADER_SEARCH_LIMIT = 8;

function isPrismaClientLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.$disconnect === "function");
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

function readyRouteData(props) {
  return {
    kind: "ready",
    props,
  };
}

function notFoundRouteData(statusNotice) {
  return {
    kind: "not-found",
    statusNotice,
  };
}

function sparseRouteData(props, statusNotice) {
  return {
    kind: "sparse",
    props,
    statusNotice,
  };
}

function buildStatusNotice({ title, body, href, hrefLabel }) {
  return {
    title,
    body,
    href,
    hrefLabel,
  };
}

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeArchiveSearch(value) {
  const candidate = firstParam(value);

  if (typeof candidate !== "string") {
    return "";
  }

  try {
    return normalize(candidate);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("normalize: empty output")) {
      return "";
    }

    throw error;
  }
}

function toUsableDate(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

function getDateTime(value) {
  const date = toUsableDate(value);

  return date === null ? null : date.getTime();
}

function getMinDate(dates) {
  return dates.reduce((oldest, date) => (date < oldest ? date : oldest), dates[0]);
}

function getMaxDate(dates) {
  return dates.reduce((newest, date) => (date > newest ? date : newest), dates[0]);
}

function formatArchiveDate(value) {
  return archiveDateFormatter.format(toUsableDate(value));
}

function formatTimeframeLabel(start, end) {
  if (start.getTime() === end.getTime()) {
    return formatArchiveDate(start);
  }

  return `${formatArchiveDate(start)} - ${formatArchiveDate(end)}`;
}

function deriveGameTimeframe({ rounds = [], submissions = [], votes = [] } = {}) {
  const roundDates = rounds.map((round) => toUsableDate(round.occurredAt)).filter(Boolean);
  const fallbackDates = [
    ...submissions.map((submission) => toUsableDate(submission.submittedAt)),
    ...votes.map((vote) => toUsableDate(vote.votedAt)),
  ].filter(Boolean);
  const eventDates = [...roundDates, ...fallbackDates];

  if (eventDates.length === 0) {
    return null;
  }

  const start = getMinDate(eventDates);
  const end = getMaxDate(eventDates);
  const roundStart = roundDates.length > 0 ? getMinDate(roundDates) : null;
  const roundEnd = roundDates.length > 0 ? getMaxDate(roundDates) : null;
  const source =
    roundStart !== null &&
    roundEnd !== null &&
    start.getTime() === roundStart.getTime() &&
    end.getTime() === roundEnd.getTime()
      ? "rounds"
      : "widened-events";

  return {
    start,
    end,
    label: formatTimeframeLabel(start, end),
    source,
  };
}

function getPlayerId(submission) {
  return submission.playerId ?? submission.player?.id ?? null;
}

function getPlayerDisplayName(submission) {
  return submission.playerName ?? submission.player?.displayName ?? "Unknown player";
}

function deriveLeaderboardRows(submissions = []) {
  const rowsByPlayer = new Map();

  for (const submission of submissions) {
    if (submission.score === null || submission.score === undefined) {
      continue;
    }

    const playerId = getPlayerId(submission);

    if (playerId === null) {
      continue;
    }

    const row = rowsByPlayer.get(playerId) ?? {
      player: {
        id: playerId,
        displayName: getPlayerDisplayName(submission),
        href: buildPlayerHref(playerId),
      },
      totalScore: 0,
      roundWins: 0,
      wins: 0,
      scoredSubmissionCount: 0,
      rank: null,
      tied: false,
    };

    row.totalScore += submission.score;
    row.scoredSubmissionCount += 1;
    row.roundWins += submission.rank === 1 ? 1 : 0;
    row.wins = row.roundWins;
    rowsByPlayer.set(playerId, row);
  }

  const rows = [...rowsByPlayer.values()].sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }

    if (right.roundWins !== left.roundWins) {
      return right.roundWins - left.roundWins;
    }

    return left.player.displayName.localeCompare(right.player.displayName);
  });
  const tieCounts = new Map();

  for (const row of rows) {
    const tieKey = `${row.totalScore}\u0000${row.roundWins}`;

    tieCounts.set(tieKey, (tieCounts.get(tieKey) ?? 0) + 1);
  }

  let previousTieKey = null;
  let previousRank = 0;

  const rankedRows = rows.map((row, index) => {
    const tieKey = `${row.totalScore}\u0000${row.roundWins}`;
    const rank = tieKey === previousTieKey ? previousRank : index + 1;
    const tied = tieCounts.get(tieKey) > 1;

    previousTieKey = tieKey;
    previousRank = rank;

    return {
      ...row,
      rank,
      tied,
    };
  });
  const hasTies = rankedRows.some((row) => row.tied);

  return {
    rows: rankedRows,
    hasTies,
    footnote: hasTies
      ? "Tied rows share a rank when total points and round wins are identical."
      : null,
  };
}

function deriveArchiveSongFamiliarity(songId, submissions = []) {
  const appearanceCount = submissions.filter((submission) => {
    if (submission.songId === undefined && submission.song?.id === undefined) {
      return true;
    }

    return (submission.songId ?? submission.song?.id) === songId;
  }).length;
  const kind = appearanceCount >= 2 ? "returning" : "first-time";

  return {
    kind,
    label: kind === "returning" ? "Returning" : "First-time",
    appearanceCount,
    shortSummary:
      appearanceCount === 1
        ? "1 archive appearance"
        : `${appearanceCount} archive appearances`,
  };
}

function getSubmissionRoundOccurredAt(submission) {
  return submission.roundOccurredAt ?? submission.round?.occurredAt ?? null;
}

function getSubmissionAppearanceAt(submission) {
  return toUsableDate(submission.submittedAt) ?? toUsableDate(getSubmissionRoundOccurredAt(submission));
}

function compareSongAppearanceAscending(left, right) {
  const appearanceComparison = compareNullableAscending(
    getDateTime(getSubmissionAppearanceAt(left)),
    getDateTime(getSubmissionAppearanceAt(right)),
  );

  if (appearanceComparison !== 0) {
    return appearanceComparison;
  }

  return (left.id ?? 0) - (right.id ?? 0);
}

function compareSongAppearanceDescending(left, right) {
  const appearanceComparison = compareNullableDescending(
    getDateTime(getSubmissionAppearanceAt(left)),
    getDateTime(getSubmissionAppearanceAt(right)),
  );

  if (appearanceComparison !== 0) {
    return appearanceComparison;
  }

  return (right.id ?? 0) - (left.id ?? 0);
}

function resolveGameDisplayLabel(game) {
  return game?.displayName?.trim() || game?.sourceGameId || `Game ${game?.id ?? ""}`;
}

function buildSongHistoryRow(submission) {
  const game = submission.round.game;

  return {
    id: submission.id,
    songId: submission.songId ?? submission.song?.id ?? null,
    gameId: game.id,
    gameTitle: resolveGameDisplayLabel(game),
    gameHref: buildGameHref(game.id),
    roundId: submission.round.id,
    roundName: submission.round.name,
    roundHref: buildRoundHref(game.id, submission.round.id),
    submitterId: submission.player.id,
    submitterName: submission.player.displayName,
    submitterHref: buildPlayerHref(submission.player.id),
    rank: submission.rank,
    score: submission.score,
    comment: submission.comment,
    submittedAt: submission.submittedAt ?? null,
    occurredAt: submission.round.occurredAt ?? null,
    appearanceAt: getSubmissionAppearanceAt(submission),
  };
}

function deriveSongAppearanceFacts(submissions = []) {
  const orderedAscending = [...submissions].sort(compareSongAppearanceAscending);
  const orderedDescending = [...submissions].sort(compareSongAppearanceDescending);
  const rowsDescending = orderedDescending.map(buildSongHistoryRow);
  const groupsByGameId = new Map();

  for (const row of rowsDescending) {
    const group = groupsByGameId.get(row.gameId) ?? {
      gameId: row.gameId,
      title: row.gameTitle,
      href: row.gameHref,
      latestAppearanceAt: row.appearanceAt,
      latestOccurredAt: row.occurredAt,
      rows: [],
    };

    group.rows.push({
      id: row.id,
      roundName: row.roundName,
      roundHref: row.roundHref,
      submitterName: row.submitterName,
      submitterHref: row.submitterHref,
      rank: row.rank,
      score: row.score,
      comment: row.comment,
      submittedAt: row.submittedAt,
      occurredAt: row.occurredAt,
      appearanceAt: row.appearanceAt,
    });

    if (compareNullableDescending(getDateTime(row.appearanceAt), getDateTime(group.latestAppearanceAt)) < 0) {
      group.latestAppearanceAt = row.appearanceAt;
      group.latestOccurredAt = row.occurredAt;
    }

    groupsByGameId.set(row.gameId, group);
  }

  return {
    firstAppearance: orderedAscending[0] ? buildSongHistoryRow(orderedAscending[0]) : null,
    mostRecentAppearance: orderedDescending[0] ? buildSongHistoryRow(orderedDescending[0]) : null,
    historyGroups: [...groupsByGameId.values()].sort((left, right) => {
      const dateComparison = compareNullableDescending(
        getDateTime(left.latestAppearanceAt),
        getDateTime(right.latestAppearanceAt),
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return left.gameId - right.gameId;
    }),
  };
}

function mapVotesToRoundSubmissions({ submissions = [], votes = [] } = {}) {
  const submissionsByRoundSong = new Map();
  const votesBySubmissionId = new Map();
  const submissionByVoteId = new Map();

  for (const submission of submissions) {
    const key = `${submission.roundId}\u0000${submission.songId}`;

    if (submissionsByRoundSong.has(key)) {
      throw new Error(
        `mapVotesToRoundSubmissions: duplicate submission target for round ${submission.roundId} song ${submission.songId}`,
      );
    }

    submissionsByRoundSong.set(key, submission);
    votesBySubmissionId.set(submission.id, []);
  }

  for (const vote of votes) {
    const key = `${vote.roundId}\u0000${vote.songId}`;
    const submission = submissionsByRoundSong.get(key);

    if (!submission) {
      throw new Error(
        `mapVotesToRoundSubmissions: vote ${vote.id} targets round ${vote.roundId} song ${vote.songId} without a same-round submission`,
      );
    }

    votesBySubmissionId.get(submission.id).push(vote);
    submissionByVoteId.set(vote.id, submission);
  }

  return {
    votesBySubmissionId,
    submissionByVoteId,
  };
}

function compareGameRoundAscending(left, right) {
  const sequenceComparison = compareNullableAscending(
    left.sequenceNumber ?? null,
    right.sequenceNumber ?? null,
  );

  if (sequenceComparison !== 0) {
    return sequenceComparison;
  }

  const occurredAtComparison = compareNullableAscending(
    getDateTime(left.occurredAt ?? null),
    getDateTime(right.occurredAt ?? null),
  );

  if (occurredAtComparison !== 0) {
    return occurredAtComparison;
  }

  return left.id - right.id;
}

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function resolveRoundStatus(submissions) {
  const hasValue = (value) => value !== null && value !== undefined;
  const completeScoredSubmissionCount = submissions.filter(
    (submission) => hasValue(submission.score) && hasValue(submission.rank),
  ).length;
  const scoringEvidenceCount = submissions.filter(
    (submission) => hasValue(submission.score) || hasValue(submission.rank),
  ).length;

  if (submissions.length === 0) {
    return {
      status: "no-submissions",
      statusLabel: "No submissions",
      scoredSubmissionCount: completeScoredSubmissionCount,
    };
  }

  if (scoringEvidenceCount === 0) {
    return {
      status: "unscored",
      statusLabel: "Unscored",
      scoredSubmissionCount: completeScoredSubmissionCount,
    };
  }

  if (completeScoredSubmissionCount === submissions.length) {
    return {
      status: "scored",
      statusLabel: "Scored",
      scoredSubmissionCount: completeScoredSubmissionCount,
    };
  }

  return {
    status: "partial",
    statusLabel: "Partially scored",
    scoredSubmissionCount: completeScoredSubmissionCount,
  };
}

function deriveGameRoundListItems({ gameId, rounds = [] } = {}) {
  return [...rounds].sort(compareGameRoundAscending).map((round, index) => {
    const submissions = round.submissions ?? [];
    const roundStatus = resolveRoundStatus(submissions);
    const winners = submissions
      .filter((submission) => submission.rank === 1)
      .sort((left, right) =>
        getPlayerDisplayName(left).localeCompare(getPlayerDisplayName(right)),
      );
    const winnerLabels = winners.map((submission) => getPlayerDisplayName(submission));

    return {
      id: round.id,
      name: round.name,
      sequenceNumber: round.sequenceNumber ?? null,
      sequenceLabel:
        round.sequenceNumber === null || round.sequenceNumber === undefined
          ? `Round ${index + 1}`
          : `Round ${round.sequenceNumber}`,
      occurredAt: round.occurredAt ?? null,
      playlistUrl: round.playlistUrl ?? null,
      href: buildRoundHref(gameId, round.id),
      submissionCount: submissions.length,
      scoredSubmissionCount: roundStatus.scoredSubmissionCount,
      unscoredSubmissionCount: submissions.length - roundStatus.scoredSubmissionCount,
      status: roundStatus.status,
      statusLabel: roundStatus.statusLabel,
      isScored: roundStatus.status === "scored",
      winnerLabels,
      winnerLabel:
        winnerLabels.length === 0 ? null : winnerLabels.join(", "),
      summary: `${formatCount(submissions.length, "submission")} - ${roundStatus.statusLabel}`,
    };
  });
}

function normalizeFamiliarityFilter(value) {
  const normalized = normalizeArchiveSearch(value);

  return VALID_SONG_FAMILIARITY_FILTERS.has(normalized) ? normalized : "all";
}

function normalizeSongSort(value) {
  const normalized = normalizeArchiveSearch(value);

  return VALID_SONG_SORTS.has(normalized) ? normalized : "most-recent";
}

function getMostRecentAppearance(submissions) {
  const mostRecent = [...submissions].sort(compareSongAppearanceDescending)[0] ?? null;

  return mostRecent ? getSubmissionAppearanceAt(mostRecent) : null;
}

function getBestFinish(submissions) {
  const rankedSubmissions = submissions.filter(
    (submission) => submission.rank !== null && submission.rank !== undefined,
  );

  return rankedSubmissions.length === 0
    ? null
    : Math.min(...rankedSubmissions.map((submission) => submission.rank));
}

function buildSongCatalogRow(song) {
  const familiarity = deriveArchiveSongFamiliarity(song.id, song.submissions);

  return {
    id: song.id,
    title: song.title,
    normalizedTitle: normalizeArchiveSearch(song.title),
    artistName: song.artist.name,
    normalizedArtistName: normalizeArchiveSearch(song.artist.name),
    href: buildSongHref(song.id),
    appearanceCount: familiarity.appearanceCount,
    appearances: familiarity.appearanceCount,
    mostRecentAppearance: getMostRecentAppearance(song.submissions),
    bestFinish: getBestFinish(song.submissions),
    familiarity,
  };
}

function compareSongCatalogRows(sort) {
  return (left, right) => {
    if (sort === "most-appearances" && left.appearanceCount !== right.appearanceCount) {
      return right.appearanceCount - left.appearanceCount;
    }

    if (sort === "best-finish") {
      const finishComparison = compareNullableAscending(left.bestFinish, right.bestFinish);

      if (finishComparison !== 0) {
        return finishComparison;
      }
    }

    if (sort === "alphabetical") {
      const titleComparison = left.title.localeCompare(right.title);

      if (titleComparison !== 0) {
        return titleComparison;
      }

      const artistComparison = left.artistName.localeCompare(right.artistName);

      if (artistComparison !== 0) {
        return artistComparison;
      }
    } else {
      const recentComparison = compareNullableDescending(
        getDateTime(left.mostRecentAppearance),
        getDateTime(right.mostRecentAppearance),
      );

      if (recentComparison !== 0) {
        return recentComparison;
      }
    }

    return left.id - right.id;
  };
}

async function getSongCatalog({
  q = "",
  familiarity = "all",
  sort = "most-recent",
  limit,
  input = {},
} = {}) {
  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);
  const normalizedQuery = normalizeArchiveSearch(q);
  const normalizedFamiliarity = normalizeFamiliarityFilter(familiarity);
  const normalizedSort = normalizeSongSort(sort);

  try {
    const songs = await prisma.song.findMany({
      select: {
        id: true,
        title: true,
        artist: {
          select: {
            name: true,
          },
        },
        submissions: {
          select: {
            id: true,
            songId: true,
            rank: true,
            submittedAt: true,
            round: {
              select: {
                occurredAt: true,
              },
            },
          },
        },
      },
    });
    const requestedLimit =
      limit === null || limit === undefined ? (normalizedQuery.length === 0 ? 100 : null) : limit;
    const boundedLimit =
      Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : null;
    const matchingRows = songs
      .map(buildSongCatalogRow)
      .filter((song) => {
        if (normalizedQuery.length === 0) {
          return true;
        }

        return (
          song.normalizedTitle.includes(normalizedQuery) ||
          song.normalizedArtistName.includes(normalizedQuery)
        );
      })
      .filter((song) => {
        if (normalizedFamiliarity === "first-time") {
          return song.familiarity.kind === "first-time";
        }

        if (normalizedFamiliarity === "returning") {
          return song.familiarity.kind === "returning";
        }

        return true;
      })
      .sort(compareSongCatalogRows(normalizedSort));
    const rows = boundedLimit === null ? matchingRows : matchingRows.slice(0, boundedLimit);

    return {
      q: normalizedQuery,
      familiarity: normalizedFamiliarity,
      sort: normalizedSort,
      rows,
      totalSongCount: songs.length,
      totalMatchCount: matchingRows.length,
      isEmpty: songs.length === 0,
      isZeroResult: songs.length > 0 && matchingRows.length === 0,
      capped: boundedLimit !== null && matchingRows.length > boundedLimit,
      limit: boundedLimit,
    };
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

function normalizeHeaderSuggestionLimit(limit) {
  if (!Number.isInteger(limit) || limit <= 0) {
    return HEADER_SEARCH_LIMIT;
  }

  return Math.min(limit, HEADER_SEARCH_LIMIT);
}

async function getHeaderSearchSuggestions(q, { limit = HEADER_SEARCH_LIMIT, input = {} } = {}) {
  const normalizedQuery = normalizeArchiveSearch(q);

  if (normalizedQuery.length === 0) {
    return [];
  }

  const suggestionLimit = normalizeHeaderSuggestionLimit(limit);
  const catalog = await getSongCatalog({
    q: normalizedQuery,
    sort: "most-recent",
    limit: null,
    input,
  });
  const suggestions = [];
  const artistSuggestions = new Set();

  for (const row of catalog.rows) {
    if (row.normalizedTitle.includes(normalizedQuery)) {
      suggestions.push({
        id: `song-${row.id}`,
        type: "song",
        label: row.title,
        meta: row.artistName,
        href: buildSongHref(row.id),
      });
    }

    if (suggestions.length >= suggestionLimit) {
      break;
    }

    if (
      row.normalizedArtistName.includes(normalizedQuery) &&
      !artistSuggestions.has(row.normalizedArtistName)
    ) {
      artistSuggestions.add(row.normalizedArtistName);
      suggestions.push({
        id: `artist-${row.normalizedArtistName}`,
        type: "artist",
        label: row.artistName,
        meta: "Artist",
        href: buildSongSearchHref({ q: row.artistName }),
      });
    }

    if (suggestions.length >= suggestionLimit) {
      break;
    }
  }

  return suggestions.slice(0, suggestionLimit);
}

module.exports = {
  buildStatusNotice,
  compareGameRoundAscending,
  compareNullableAscending,
  compareNullableDescending,
  compareSongAppearanceAscending,
  compareSongAppearanceDescending,
  deriveArchiveSongFamiliarity,
  deriveGameRoundListItems,
  deriveGameTimeframe,
  deriveLeaderboardRows,
  deriveSongAppearanceFacts,
  getHeaderSearchSuggestions,
  getSongCatalog,
  mapVotesToRoundSubmissions,
  normalizeArchiveSearch,
  notFoundRouteData,
  readyRouteData,
  resolveArchiveInput,
  sparseRouteData,
};
