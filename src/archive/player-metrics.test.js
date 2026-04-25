const test = require("node:test");
const assert = require("node:assert/strict");

const { derivePlayerPerformanceMetrics } = require("./player-metrics");

test("derives normalized player performance metrics with scored-submission denominators", () => {
  const metricsByPlayer = derivePlayerPerformanceMetrics([
    { playerId: 1, roundId: 10, score: 12, rank: 1 },
    { playerId: 1, roundId: 10, score: 3, rank: 3 },
    { playerId: 2, roundId: 10, score: 8, rank: 2 },
    { playerId: 1, roundId: 20, score: null, rank: null },
    { playerId: 3, roundId: 20, score: null, rank: null },
    { playerId: 1, roundId: 30, score: 7, rank: 1 },
  ]);

  const playerOneMetrics = metricsByPlayer.get(1);

  assert.deepEqual(
    {
      ...playerOneMetrics,
      rawScoreStdDev: null,
    },
    {
      playerId: 1,
      scoredSubmissionCount: 3,
      submittedRoundCount: 3,
      averageFinishPercentile: 1 / 3,
      winRate: 2 / 3,
      rawScoreStdDev: null,
      minimumSampleMet: true,
    },
  );
  assert.ok(
    Math.abs(playerOneMetrics.rawScoreStdDev - Math.sqrt(122 / 9)) < 1e-12,
  );
  assert.deepEqual(metricsByPlayer.get(2), {
    playerId: 2,
    scoredSubmissionCount: 1,
    submittedRoundCount: 1,
    averageFinishPercentile: 0.5,
    winRate: 0,
    rawScoreStdDev: 0,
    minimumSampleMet: true,
  });
  assert.deepEqual(metricsByPlayer.get(3), {
    playerId: 3,
    scoredSubmissionCount: 0,
    submittedRoundCount: 1,
    averageFinishPercentile: null,
    winRate: null,
    rawScoreStdDev: null,
    minimumSampleMet: false,
  });
});

test("respects explicit minimum samples without hiding small factual samples", () => {
  const metricsByPlayer = derivePlayerPerformanceMetrics(
    [{ playerId: 1, roundId: 10, score: 7, rank: 1 }],
    { minimumSample: 2 },
  );

  assert.deepEqual(metricsByPlayer.get(1), {
    playerId: 1,
    scoredSubmissionCount: 1,
    submittedRoundCount: 1,
    averageFinishPercentile: 0,
    winRate: 1,
    rawScoreStdDev: 0,
    minimumSampleMet: false,
  });
});
