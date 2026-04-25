const DEFAULT_MINIMUM_SAMPLE = 1;

function isScoredSubmission(submission) {
  return submission.score !== null && submission.rank !== null;
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateRawScoreStdDev(scores) {
  if (scores.length === 0) {
    return null;
  }

  if (scores.length === 1) {
    return 0;
  }

  const mean = average(scores);
  const variance = average(scores.map((score) => (score - mean) ** 2));

  return Math.sqrt(variance);
}

function derivePlayerPerformanceMetrics(submissions, input = {}) {
  const minimumSample = input.minimumSample ?? DEFAULT_MINIMUM_SAMPLE;
  const roundSizes = new Map();
  const submissionsByPlayer = new Map();

  for (const submission of submissions) {
    const playerBucket = submissionsByPlayer.get(submission.playerId) ?? {
      submittedRoundIds: new Set(),
      scoredSubmissions: [],
    };

    playerBucket.submittedRoundIds.add(submission.roundId);
    submissionsByPlayer.set(submission.playerId, playerBucket);

    if (isScoredSubmission(submission)) {
      roundSizes.set(submission.roundId, (roundSizes.get(submission.roundId) ?? 0) + 1);
    }
  }

  for (const submission of submissions) {
    if (!isScoredSubmission(submission)) {
      continue;
    }

    const scoredRoundSize = roundSizes.get(submission.roundId) ?? 0;
    const playerBucket = submissionsByPlayer.get(submission.playerId);

    playerBucket.scoredSubmissions.push({
      finishPercentile: (submission.rank - 1) / Math.max(scoredRoundSize - 1, 1),
      rank: submission.rank,
      score: submission.score,
    });
  }

  const metricsByPlayer = new Map();

  for (const [playerId, playerBucket] of submissionsByPlayer.entries()) {
    const scoredSubmissionCount = playerBucket.scoredSubmissions.length;
    const wins = playerBucket.scoredSubmissions.filter(
      (submission) => submission.rank === 1,
    ).length;
    const scores = playerBucket.scoredSubmissions.map((submission) => submission.score);
    const finishPercentiles = playerBucket.scoredSubmissions.map(
      (submission) => submission.finishPercentile,
    );

    metricsByPlayer.set(playerId, {
      playerId,
      scoredSubmissionCount,
      submittedRoundCount: playerBucket.submittedRoundIds.size,
      averageFinishPercentile:
        scoredSubmissionCount === 0 ? null : average(finishPercentiles),
      winRate: scoredSubmissionCount === 0 ? null : wins / scoredSubmissionCount,
      rawScoreStdDev: calculateRawScoreStdDev(scores),
      minimumSampleMet: scoredSubmissionCount >= minimumSample,
    });
  }

  return metricsByPlayer;
}

module.exports = {
  DEFAULT_MINIMUM_SAMPLE,
  derivePlayerPerformanceMetrics,
  isScoredSubmission,
};
