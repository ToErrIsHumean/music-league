const {
  buildGameHref,
  buildPlayerHref,
  buildRoundHref,
  buildSongHref,
  parsePositiveRouteId,
} = require("./route-utils");
const {
  buildStatusNotice,
  compareNullableAscending,
  compareNullableDescending,
  mapVotesToRoundSubmissions,
  notFoundRouteData,
  readyRouteData,
  resolveArchiveInput,
  sparseRouteData,
} = require("./m8-derivations");

const PLAYER_TRAIT_ORDER = [
  "consistent-finisher",
  "frequent-commenter",
  "high-variance-voter",
  "voting-twin",
];

function threshold(metric, operator, value) {
  return { metric, operator, value };
}

function meetsThreshold(value, rule) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return false;
  }

  return rule.operator === ">=" ? value >= rule.value : value <= rule.value;
}

function defaultQualify(evidence, thresholds) {
  return thresholds.every((rule) => meetsThreshold(evidence[rule.metric], rule));
}

const PLAYER_TRAIT_REGISTRY = Object.freeze({
  "consistent-finisher": Object.freeze({
    label: "Consistent finisher",
    thresholds: Object.freeze([
      threshold("averageFinishPercentile", "<=", 0.4),
      threshold("scoredSubmissionCount", ">=", 4),
    ]),
    computeEvidence: (facts) => ({
      averageFinishPercentile: facts.averageFinishPercentile,
      scoredSubmissionCount: facts.scoredSubmissionCount,
    }),
    qualify(evidence) {
      return defaultQualify(evidence, this.thresholds);
    },
  }),
  "frequent-commenter": Object.freeze({
    label: "Frequent commenter",
    thresholds: Object.freeze([
      threshold("commentRate", ">=", 0.6),
      threshold("commentOpportunityCount", ">=", 12),
    ]),
    computeEvidence: (facts) => ({
      commentRate: facts.commentRate,
      commentOpportunityCount: facts.commentOpportunityCount,
    }),
    qualify(evidence) {
      return defaultQualify(evidence, this.thresholds);
    },
  }),
  "high-variance-voter": Object.freeze({
    label: "High-variance voter",
    thresholds: Object.freeze([
      threshold("votePointStdDev", ">=", 3),
      threshold("voteCount", ">=", 24),
    ]),
    computeEvidence: (facts) => ({
      votePointStdDev: facts.votePointStdDev,
      voteCount: facts.voteCount,
    }),
    qualify(evidence) {
      return defaultQualify(evidence, this.thresholds);
    },
  }),
  "voting-twin": Object.freeze({
    label: (evidence) => `Voting twin with ${evidence.subjectPlayerDisplayName}`,
    thresholds: Object.freeze([
      threshold("votingSimilarity", ">=", 0.7),
      threshold("sharedVoteCount", ">=", 10),
    ]),
    computeEvidence: (facts) => ({
      votingSimilarity: facts.votingSimilarity,
      sharedVoteCount: facts.sharedVoteCount,
      subjectPlayerId: facts.subjectPlayerId,
      subjectPlayerDisplayName: facts.subjectPlayerDisplayName,
    }),
    qualify(evidence) {
      return (
        typeof evidence.subjectPlayerId === "number" &&
        typeof evidence.subjectPlayerDisplayName === "string" &&
        evidence.subjectPlayerDisplayName.trim().length > 0 &&
        defaultQualify(evidence, this.thresholds)
      );
    },
  }),
});

function getDateTime(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values) {
  return values.length === 0 ? null : sum(values) / values.length;
}

function standardDeviation(values) {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));

  return Math.sqrt(variance);
}

function trimComment(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveGameDisplayLabel(game) {
  return game?.displayName?.trim() || game?.sourceGameId || `Game ${game?.id ?? ""}`;
}

function getPlayerId(entity) {
  return entity?.playerId ?? entity?.player?.id ?? null;
}

function getVoterId(vote) {
  return vote?.voterId ?? vote?.voter?.id ?? null;
}

function getPointsAssigned(vote) {
  return typeof vote?.pointsAssigned === "number" ? vote.pointsAssigned : 0;
}

function getSubmissionAppearanceTime(submission) {
  return getDateTime(submission?.submittedAt) ?? getDateTime(submission?.round?.occurredAt);
}

function compareSubmissionHistoryDescending(left, right) {
  const appearanceComparison = compareNullableDescending(
    getSubmissionAppearanceTime(left),
    getSubmissionAppearanceTime(right),
  );

  if (appearanceComparison !== 0) {
    return appearanceComparison;
  }

  return (right.id ?? 0) - (left.id ?? 0);
}

function compareVoteChronologyAscending(left, right) {
  const voteComparison = compareNullableAscending(
    getDateTime(left.votedAt) ?? getDateTime(left.round?.occurredAt),
    getDateTime(right.votedAt) ?? getDateTime(right.round?.occurredAt),
  );

  if (voteComparison !== 0) {
    return voteComparison;
  }

  return (left.id ?? 0) - (right.id ?? 0);
}

function compareBestPick(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const rankComparison = compareNullableAscending(left.rank ?? null, right.rank ?? null);

  if (rankComparison !== 0) {
    return rankComparison;
  }

  const submittedComparison = compareNullableDescending(
    getDateTime(left.submittedAt),
    getDateTime(right.submittedAt),
  );

  if (submittedComparison !== 0) {
    return submittedComparison;
  }

  return left.id - right.id;
}

function compareWorstPick(left, right) {
  if (left.score !== right.score) {
    return left.score - right.score;
  }

  const rankComparison = compareNullableDescending(left.rank ?? null, right.rank ?? null);

  if (rankComparison !== 0) {
    return rankComparison;
  }

  const submittedComparison = compareNullableAscending(
    getDateTime(left.submittedAt),
    getDateTime(right.submittedAt),
  );

  if (submittedComparison !== 0) {
    return submittedComparison;
  }

  return left.id - right.id;
}

function buildPlayersById({ player, players = [], submissions = [], votes = [] } = {}) {
  const playersById = new Map();

  for (const candidate of [player, ...players]) {
    if (candidate?.id !== undefined) {
      playersById.set(candidate.id, {
        id: candidate.id,
        displayName: candidate.displayName,
      });
    }
  }

  for (const submission of submissions) {
    if (submission.player?.id !== undefined) {
      playersById.set(submission.player.id, submission.player);
    }
  }

  for (const vote of votes) {
    if (vote.voter?.id !== undefined) {
      playersById.set(vote.voter.id, vote.voter);
    }
  }

  return playersById;
}

function buildFinishFacts(playerId, submissions = []) {
  const roundSizes = new Map();
  const finishPercentiles = [];

  for (const submission of submissions) {
    if (submission.score === null || submission.score === undefined || submission.rank === null || submission.rank === undefined) {
      continue;
    }

    roundSizes.set(submission.roundId, (roundSizes.get(submission.roundId) ?? 0) + 1);
  }

  for (const submission of submissions) {
    if (
      getPlayerId(submission) !== playerId ||
      submission.score === null ||
      submission.score === undefined ||
      submission.rank === null ||
      submission.rank === undefined
    ) {
      continue;
    }

    const roundSize = roundSizes.get(submission.roundId) ?? 0;
    finishPercentiles.push((submission.rank - 1) / Math.max(roundSize - 1, 1));
  }

  return {
    averageFinishPercentile: average(finishPercentiles),
    scoredSubmissionCount: finishPercentiles.length,
  };
}

function buildCommentFacts(playerId, submissions = [], votes = []) {
  const playerSubmissions = submissions.filter((submission) => getPlayerId(submission) === playerId);
  const playerVotes = votes.filter((vote) => getVoterId(vote) === playerId);
  const commentOpportunityCount = playerSubmissions.length + playerVotes.length;
  const nonEmptyCommentCount =
    playerSubmissions.filter((submission) => trimComment(submission.comment)).length +
    playerVotes.filter((vote) => trimComment(vote.comment)).length;

  return {
    commentOpportunityCount,
    nonEmptyCommentCount,
    commentRate:
      commentOpportunityCount === 0 ? null : nonEmptyCommentCount / commentOpportunityCount,
  };
}

function buildVotingVarianceFacts(playerId, votes = []) {
  const votePoints = votes
    .filter((vote) => getVoterId(vote) === playerId)
    .map((vote) => getPointsAssigned(vote));

  return {
    voteCount: votePoints.length,
    votePointStdDev: standardDeviation(votePoints),
  };
}

function buildVotingTwinFacts(playerId, votes = [], submissionByVoteId = new Map(), playersById = new Map()) {
  const vectorsByPlayerId = new Map();

  for (const vote of votes) {
    const voterId = getVoterId(vote);
    const submission = submissionByVoteId.get(vote.id) ?? vote.submission ?? null;
    const submissionId = submission?.id ?? vote.submissionId ?? null;

    if (voterId === null || submissionId === null) {
      continue;
    }

    const vector = vectorsByPlayerId.get(voterId) ?? new Map();

    vector.set(submissionId, getPointsAssigned(vote));
    vectorsByPlayerId.set(voterId, vector);
  }

  const playerVector = vectorsByPlayerId.get(playerId);
  let bestTwin = null;

  if (!playerVector) {
    return {
      votingSimilarity: null,
      sharedVoteCount: 0,
      subjectPlayerId: null,
      subjectPlayerDisplayName: null,
    };
  }

  for (const [otherPlayerId, otherVector] of vectorsByPlayerId.entries()) {
    if (otherPlayerId === playerId) {
      continue;
    }

    const sharedSubmissionIds = [...playerVector.keys()].filter((submissionId) =>
      otherVector.has(submissionId),
    );

    if (sharedSubmissionIds.length === 0) {
      continue;
    }

    const dotProduct = sum(
      sharedSubmissionIds.map((submissionId) => playerVector.get(submissionId) * otherVector.get(submissionId)),
    );
    const playerMagnitude = Math.sqrt(
      sum(sharedSubmissionIds.map((submissionId) => playerVector.get(submissionId) ** 2)),
    );
    const otherMagnitude = Math.sqrt(
      sum(sharedSubmissionIds.map((submissionId) => otherVector.get(submissionId) ** 2)),
    );
    const similarity =
      playerMagnitude === 0 || otherMagnitude === 0
        ? 0
        : dotProduct / (playerMagnitude * otherMagnitude);
    const otherPlayer = playersById.get(otherPlayerId) ?? {
      id: otherPlayerId,
      displayName: `Player ${otherPlayerId}`,
    };
    const candidate = {
      subjectPlayerId: otherPlayerId,
      subjectPlayerDisplayName: otherPlayer.displayName,
      sharedVoteCount: sharedSubmissionIds.length,
      votingSimilarity: similarity,
    };

    if (
      !bestTwin ||
      candidate.votingSimilarity > bestTwin.votingSimilarity ||
      (candidate.votingSimilarity === bestTwin.votingSimilarity &&
        candidate.sharedVoteCount > bestTwin.sharedVoteCount) ||
      (candidate.votingSimilarity === bestTwin.votingSimilarity &&
        candidate.sharedVoteCount === bestTwin.sharedVoteCount &&
        candidate.subjectPlayerDisplayName.localeCompare(bestTwin.subjectPlayerDisplayName) < 0) ||
      (candidate.votingSimilarity === bestTwin.votingSimilarity &&
        candidate.sharedVoteCount === bestTwin.sharedVoteCount &&
        candidate.subjectPlayerDisplayName === bestTwin.subjectPlayerDisplayName &&
        candidate.subjectPlayerId < bestTwin.subjectPlayerId)
    ) {
      bestTwin = candidate;
    }
  }

  return (
    bestTwin ?? {
      votingSimilarity: null,
      sharedVoteCount: 0,
      subjectPlayerId: null,
      subjectPlayerDisplayName: null,
    }
  );
}

function buildPlayerArchiveFacts(input = {}) {
  const playerId = input.playerId ?? input.player?.id ?? null;
  const submissions = input.submissions ?? [];
  const votes = input.votes ?? [];
  const playersById =
    input.playersById instanceof Map
      ? input.playersById
      : buildPlayersById({
          player: input.player,
          players: input.players,
          submissions,
          votes,
        });
  const submissionByVoteId = input.submissionByVoteId ?? new Map();
  const finishFacts = buildFinishFacts(playerId, submissions);
  const commentFacts = buildCommentFacts(playerId, submissions, votes);
  const varianceFacts = buildVotingVarianceFacts(playerId, votes);
  const votingTwinFacts = buildVotingTwinFacts(playerId, votes, submissionByVoteId, playersById);

  return {
    ...input,
    playerId,
    averageFinishPercentile:
      input.averageFinishPercentile ?? finishFacts.averageFinishPercentile,
    scoredSubmissionCount: input.scoredSubmissionCount ?? finishFacts.scoredSubmissionCount,
    commentOpportunityCount:
      input.commentOpportunityCount ?? commentFacts.commentOpportunityCount,
    nonEmptyCommentCount: input.nonEmptyCommentCount ?? commentFacts.nonEmptyCommentCount,
    commentRate: input.commentRate ?? commentFacts.commentRate,
    voteCount: input.voteCount ?? varianceFacts.voteCount,
    votePointStdDev: input.votePointStdDev ?? varianceFacts.votePointStdDev,
    votingSimilarity: input.votingSimilarity ?? votingTwinFacts.votingSimilarity,
    sharedVoteCount: input.sharedVoteCount ?? votingTwinFacts.sharedVoteCount,
    subjectPlayerId: input.subjectPlayerId ?? votingTwinFacts.subjectPlayerId,
    subjectPlayerDisplayName:
      input.subjectPlayerDisplayName ?? votingTwinFacts.subjectPlayerDisplayName,
  };
}

function formatThreshold(rule) {
  return `${rule.operator} ${rule.value}`;
}

function buildTraitEvidence(entry, evidence) {
  return entry.thresholds.map((rule) => ({
    metric: rule.metric,
    value: evidence[rule.metric],
    threshold: formatThreshold(rule),
  }));
}

function derivePlayerTraits(playerArchiveFacts, registry = PLAYER_TRAIT_REGISTRY) {
  const facts = buildPlayerArchiveFacts(playerArchiveFacts);

  return PLAYER_TRAIT_ORDER.flatMap((traitId) => {
    const entry = registry[traitId];

    if (!entry) {
      return [];
    }

    const evidence = entry.computeEvidence(facts);
    const qualifies = entry.qualify
      ? entry.qualify(evidence, facts)
      : defaultQualify(evidence, entry.thresholds);

    if (!qualifies) {
      return [];
    }

    const label = typeof entry.label === "function" ? entry.label(evidence, facts) : entry.label;
    const subjectPlayer =
      typeof evidence.subjectPlayerId === "number"
        ? {
            playerId: evidence.subjectPlayerId,
            displayName: evidence.subjectPlayerDisplayName,
            href: buildPlayerHref(evidence.subjectPlayerId),
          }
        : undefined;

    return [
      {
        traitId,
        label,
        badgeVariant: "trait",
        evidence: buildTraitEvidence(entry, evidence),
        ...(subjectPlayer ? { subjectPlayer } : {}),
      },
    ];
  });
}

function buildPlayerVoteScope(playerId, voteGameId, evidenceGames) {
  const requestedGameId = parsePositiveRouteId(voteGameId);
  const gameOptions = [...evidenceGames.values()].sort((left, right) => {
    const labelComparison = resolveGameDisplayLabel(left).localeCompare(resolveGameDisplayLabel(right));

    if (labelComparison !== 0) {
      return labelComparison;
    }

    return left.id - right.id;
  });
  const selectedGame =
    requestedGameId === null ? null : gameOptions.find((game) => game.id === requestedGameId) ?? null;
  const active = selectedGame
    ? {
        kind: "game",
        gameId: selectedGame.id,
        gameName: resolveGameDisplayLabel(selectedGame),
        href: `${buildPlayerHref(playerId)}?voteGameId=${selectedGame.id}`,
      }
    : {
        kind: "all",
        label: "All games",
        href: buildPlayerHref(playerId),
      };

  return {
    active,
    options: [
      {
        kind: "all",
        label: "All games",
        href: buildPlayerHref(playerId),
        selected: active.kind === "all",
      },
      ...gameOptions.map((game) => ({
        kind: "game",
        gameId: game.id,
        gameName: resolveGameDisplayLabel(game),
        href: `${buildPlayerHref(playerId)}?voteGameId=${game.id}`,
        selected: active.kind === "game" && active.gameId === game.id,
      })),
    ],
  };
}

function getVoteScopeGameId(voteScope) {
  return voteScope.active.kind === "game" ? voteScope.active.gameId : null;
}

function buildEvidenceGames(playerId, submissions = [], votes = []) {
  const games = new Map();

  for (const submission of submissions) {
    if (getPlayerId(submission) === playerId && submission.round?.game?.id !== undefined) {
      games.set(submission.round.game.id, submission.round.game);
    }
  }

  for (const vote of votes) {
    if (getVoterId(vote) === playerId && vote.round?.game?.id !== undefined) {
      games.set(vote.round.game.id, vote.round.game);
    }
  }

  return games;
}

function createVoteAggregateRow(counterparty) {
  return {
    playerId: counterparty.id,
    displayName: counterparty.displayName,
    href: buildPlayerHref(counterparty.id),
    voteCount: 0,
    positivePoints: 0,
    negativePoints: 0,
    netPoints: 0,
    averagePoints: 0,
    comments: [],
  };
}

function addVoteToAggregate(row, vote) {
  const points = getPointsAssigned(vote);
  const comment = trimComment(vote.comment);

  row.voteCount += 1;
  row.positivePoints += points > 0 ? points : 0;
  row.negativePoints += points < 0 ? points : 0;
  row.netPoints += points;
  row.averagePoints = row.netPoints / row.voteCount;

  if (comment) {
    row.comments.push({
      voteId: vote.id,
      gameId: vote.round.game.id,
      gameName: resolveGameDisplayLabel(vote.round.game),
      roundId: vote.round.id,
      roundName: vote.round.name,
      roundHref: buildRoundHref(vote.round.game.id, vote.round.id),
      comment,
    });
  }
}

function sortVoteTableRows(rows) {
  return rows.sort((left, right) => {
    const pointsComparison = Math.abs(right.netPoints) - Math.abs(left.netPoints);

    if (pointsComparison !== 0) {
      return pointsComparison;
    }

    if (right.voteCount !== left.voteCount) {
      return right.voteCount - left.voteCount;
    }

    const nameComparison = left.displayName.localeCompare(right.displayName);

    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.playerId - right.playerId;
  });
}

function buildVoteTable(rowsByPlayerId) {
  const rows = sortVoteTableRows([...rowsByPlayerId.values()]);

  return {
    hasNegativeVotes: rows.some((row) => row.negativePoints < 0),
    rows,
  };
}

function buildPlayerVoteHistoryFromRows({
  playerId,
  voteGameId = null,
  submissions = [],
  votes = [],
  submissionByVoteId = new Map(),
} = {}) {
  const evidenceGames = buildEvidenceGames(playerId, submissions, votes);
  const voteScope = buildPlayerVoteScope(playerId, voteGameId, evidenceGames);
  const scopedGameId = getVoteScopeGameId(voteScope);
  const scopedVotes = [...votes]
    .filter((vote) => scopedGameId === null || vote.round?.game?.id === scopedGameId)
    .sort(compareVoteChronologyAscending);
  const givenRowsByPlayerId = new Map();
  const receivedRowsByPlayerId = new Map();

  for (const vote of scopedVotes) {
    const submission = submissionByVoteId.get(vote.id);

    if (!submission) {
      continue;
    }

    if (getVoterId(vote) === playerId && submission.playerId !== playerId) {
      const counterparty = submission.player ?? {
        id: submission.playerId,
        displayName: `Player ${submission.playerId}`,
      };
      const row = givenRowsByPlayerId.get(counterparty.id) ?? createVoteAggregateRow(counterparty);

      addVoteToAggregate(row, vote);
      givenRowsByPlayerId.set(counterparty.id, row);
    }

    if (submission.playerId === playerId && getVoterId(vote) !== playerId) {
      const counterparty = vote.voter ?? {
        id: getVoterId(vote),
        displayName: `Player ${getVoterId(vote)}`,
      };
      const row = receivedRowsByPlayerId.get(counterparty.id) ?? createVoteAggregateRow(counterparty);

      addVoteToAggregate(row, vote);
      receivedRowsByPlayerId.set(counterparty.id, row);
    }
  }

  return {
    voteScope,
    votesGiven: buildVoteTable(givenRowsByPlayerId),
    votesReceived: buildVoteTable(receivedRowsByPlayerId),
  };
}

function buildPlayerSubmissionGroups(submissions = []) {
  const groupsByGameId = new Map();

  for (const submission of [...submissions].sort(compareSubmissionHistoryDescending)) {
    const game = submission.round.game;
    const group = groupsByGameId.get(game.id) ?? {
      gameId: game.id,
      gameName: resolveGameDisplayLabel(game),
      href: buildGameHref(game.id),
      latestAppearanceAt: getSubmissionAppearanceTime(submission),
      rows: [],
    };

    group.rows.push({
      submissionId: submission.id,
      round: {
        id: submission.round.id,
        name: submission.round.name,
        href: buildRoundHref(game.id, submission.round.id),
      },
      song: {
        id: submission.song.id,
        title: submission.song.title,
        artistName: submission.song.artist.name,
        href: buildSongHref(submission.song.id),
      },
      rank: submission.rank,
      score: submission.score,
      comment: submission.comment,
    });

    groupsByGameId.set(game.id, group);
  }

  return [...groupsByGameId.values()]
    .sort((left, right) => {
      const appearanceComparison = compareNullableDescending(
        left.latestAppearanceAt,
        right.latestAppearanceAt,
      );

      if (appearanceComparison !== 0) {
        return appearanceComparison;
      }

      return left.gameId - right.gameId;
    })
    .map(({ latestAppearanceAt, ...group }) => group);
}

function buildPlayerNotablePicks(submissions = []) {
  const groupsByGameId = new Map();

  for (const submission of submissions) {
    if (submission.score === null || submission.score === undefined) {
      continue;
    }

    const gameId = submission.round.game.id;
    const rows = groupsByGameId.get(gameId) ?? [];

    rows.push(submission);
    groupsByGameId.set(gameId, rows);
  }

  return [...groupsByGameId.entries()]
    .sort(([leftGameId], [rightGameId]) => leftGameId - rightGameId)
    .flatMap(([, rows]) => {
      const best = [...rows].sort(compareBestPick)[0] ?? null;
      const worst = [...rows].sort(compareWorstPick)[0] ?? null;
      const picks = best ? [buildPlayerNotablePick("best", best)] : [];

      if (worst && (!best || worst.id !== best.id)) {
        picks.push(buildPlayerNotablePick("worst", worst));
      }

      return picks;
    });
}

function buildPlayerNotablePick(kind, submission) {
  const game = submission.round.game;

  return {
    kind,
    gameId: game.id,
    gameName: resolveGameDisplayLabel(game),
    submissionId: submission.id,
    song: {
      id: submission.song.id,
      title: submission.song.title,
      artistName: submission.song.artist.name,
      href: buildSongHref(submission.song.id),
    },
    round: {
      id: submission.round.id,
      name: submission.round.name,
      href: buildRoundHref(game.id, submission.round.id),
    },
    rank: submission.rank,
    score: submission.score,
  };
}

function buildPlayerDetailProps({
  player,
  allSubmissions,
  allVotes,
  voteGameId = null,
  submissionByVoteId,
}) {
  const playerSubmissions = allSubmissions.filter((submission) => submission.playerId === player.id);
  const playerVotes = allVotes.filter((vote) => getVoterId(vote) === player.id);
  const attributedReceivedVotes = allVotes.filter(
    (vote) => submissionByVoteId.get(vote.id)?.playerId === player.id,
  );
  const traits = derivePlayerTraits({
    player,
    playerId: player.id,
    submissions: allSubmissions,
    votes: allVotes,
    submissionByVoteId,
  });
  const voteHistory = buildPlayerVoteHistoryFromRows({
    playerId: player.id,
    voteGameId,
    submissions: allSubmissions,
    votes: allVotes,
    submissionByVoteId,
  });

  return {
    player: {
      id: player.id,
      displayName: player.displayName,
      totalSubmissions: playerSubmissions.length,
      totalVotesCast: playerVotes.length,
      totalPointsReceived: sum(attributedReceivedVotes.map((vote) => getPointsAssigned(vote))),
    },
    traits,
    notablePicks: buildPlayerNotablePicks(playerSubmissions),
    submissionGroups: buildPlayerSubmissionGroups(playerSubmissions),
    voteScope: voteHistory.voteScope,
    votesGiven: voteHistory.votesGiven,
    votesReceived: voteHistory.votesReceived,
  };
}

function selectAllSubmissionFields() {
  return {
    id: true,
    roundId: true,
    songId: true,
    playerId: true,
    score: true,
    rank: true,
    comment: true,
    submittedAt: true,
    player: {
      select: {
        id: true,
        displayName: true,
      },
    },
    song: {
      select: {
        id: true,
        title: true,
        artist: {
          select: {
            name: true,
          },
        },
      },
    },
    round: {
      select: {
        id: true,
        name: true,
        occurredAt: true,
        sequenceNumber: true,
        game: {
          select: {
            id: true,
            sourceGameId: true,
            displayName: true,
          },
        },
      },
    },
  };
}

function selectAllVoteFields() {
  return {
    id: true,
    roundId: true,
    songId: true,
    voterId: true,
    pointsAssigned: true,
    comment: true,
    votedAt: true,
    voter: {
      select: {
        id: true,
        displayName: true,
      },
    },
    round: {
      select: {
        id: true,
        name: true,
        occurredAt: true,
        sequenceNumber: true,
        game: {
          select: {
            id: true,
            sourceGameId: true,
            displayName: true,
          },
        },
      },
    },
  };
}

async function loadPlayerArchiveRows(prisma) {
  const [allSubmissions, allVotes] = await Promise.all([
    prisma.submission.findMany({
      select: selectAllSubmissionFields(),
    }),
    prisma.vote.findMany({
      select: selectAllVoteFields(),
    }),
  ]);
  const { submissionByVoteId } = mapVotesToRoundSubmissions({
    submissions: allSubmissions,
    votes: allVotes,
  });

  return {
    allSubmissions,
    allVotes,
    submissionByVoteId,
  };
}

function normalizeLoaderInput(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "input")) {
    return options.input;
  }

  return options;
}

async function getPlayerDetailData(playerId, options = {}) {
  const parsedPlayerId = parsePositiveRouteId(playerId);
  const voteGameId = Object.prototype.hasOwnProperty.call(options, "voteGameId")
    ? options.voteGameId
    : null;

  if (parsedPlayerId === null) {
    return notFoundRouteData(
      buildStatusNotice({
        title: "Invalid player ID.",
        body: "The requested Music League player could not be loaded.",
        href: "/",
        hrefLabel: "Back to archive",
      }),
    );
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(normalizeLoaderInput(options));

  try {
    const player = await prisma.player.findUnique({
      where: { id: parsedPlayerId },
      select: {
        id: true,
        displayName: true,
      },
    });

    if (!player) {
      return notFoundRouteData(
        buildStatusNotice({
          title: "Player not found.",
          body: "The requested Music League player could not be found.",
          href: "/",
          hrefLabel: "Back to archive",
        }),
      );
    }

    const archiveRows = await loadPlayerArchiveRows(prisma);
    const props = buildPlayerDetailProps({
      player,
      allSubmissions: archiveRows.allSubmissions,
      allVotes: archiveRows.allVotes,
      voteGameId,
      submissionByVoteId: archiveRows.submissionByVoteId,
    });
    const hasEvidence =
      props.player.totalSubmissions > 0 ||
      props.player.totalVotesCast > 0 ||
      props.votesReceived.rows.length > 0;

    if (!hasEvidence) {
      return sparseRouteData(
        props,
        buildStatusNotice({
          title: "No player evidence yet.",
          body: "No submissions or votes have been imported for this player yet.",
          href: "/",
          hrefLabel: "Back to archive",
        }),
      );
    }

    return readyRouteData(props);
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

async function getPlayerVoteHistory({ playerId, voteGameId = null, input } = {}) {
  const parsedPlayerId = parsePositiveRouteId(playerId);

  if (parsedPlayerId === null) {
    return {
      voteScope: buildPlayerVoteScope(0, null, new Map()),
      votesGiven: { hasNegativeVotes: false, rows: [] },
      votesReceived: { hasNegativeVotes: false, rows: [] },
    };
  }

  const { prisma, ownsPrismaClient } = resolveArchiveInput(input);

  try {
    const archiveRows = await loadPlayerArchiveRows(prisma);

    return buildPlayerVoteHistoryFromRows({
      playerId: parsedPlayerId,
      voteGameId,
      submissions: archiveRows.allSubmissions,
      votes: archiveRows.allVotes,
      submissionByVoteId: archiveRows.submissionByVoteId,
    });
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

module.exports = {
  PLAYER_TRAIT_ORDER,
  PLAYER_TRAIT_REGISTRY,
  buildPlayerArchiveFacts,
  buildPlayerDetailProps,
  buildPlayerVoteHistoryFromRows,
  derivePlayerTraits,
  getPlayerDetailData,
  getPlayerVoteHistory,
};
