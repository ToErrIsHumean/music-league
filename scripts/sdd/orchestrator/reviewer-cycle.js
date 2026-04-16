'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildReviewerArgs,
  buildReviewerInstruction,
  parseReviewerVerdict,
} = require('./role-contracts');

async function runReviewerPhase({
  context,
  state,
  implementerReport,
  reasoningEffort,
  lastDiffPath,
}) {
  const {
    options,
    runtime,
  } = context;
  const {
    task,
    epoch,
    cycle,
  } = state;

  const verdictPath = path.join(options.reviewsDir, `${task.id}-epoch-${epoch}-cycle-${cycle}.md`);
  const priorVerdictPath = cycle > 1 ? path.join(options.reviewsDir, `${task.id}-epoch-${epoch}-cycle-${cycle - 1}.md`) : null;
  const resolvedPriorVerdictPath = priorVerdictPath && fs.existsSync(priorVerdictPath)
    ? priorVerdictPath
    : null;
  const reviewerArgs = buildReviewerArgs({
    taskId: task.id,
    specPath: options.specPath,
    specSlicePath: options.specSlicePath,
    epoch,
    cycle,
    diffPath: lastDiffPath,
    verdictPath,
    priorVerdictPath: resolvedPriorVerdictPath,
    instruction: buildReviewerInstruction(implementerReport),
    reasoningEffort,
    useClaude: options.useClaude,
    useCline: options.useCline,
    passthroughArgs: options.passthroughArgs || [],
  });

  const reviewerResult = await runtime.runTrackedCommand({
    label: `Reviewer ${task.id} cycle ${cycle}`,
    command: 'bash',
    args: [options.reviewerScript, ...reviewerArgs],
    cwd: options.repoRoot,
    progress: runtime.progress,
  });
  runtime.ensureCommandSucceeded(reviewerResult, `Reviewer wrapper for ${task.id} cycle ${cycle}`);

  runtime.ensureFileExists(verdictPath, 'Reviewer verdict');
  const verdict = parseReviewerVerdict(fs.readFileSync(verdictPath, 'utf8'));

  return {
    kind: 'verdict',
    verdict,
    verdictPath,
    reviewerStopRequested: runtime.stopController.isRequested(),
  };
}

module.exports = {
  runReviewerPhase,
};
