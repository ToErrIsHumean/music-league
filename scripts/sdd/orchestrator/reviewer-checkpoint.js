'use strict';

const fs = require('fs');
const path = require('path');

const REVIEWER_CHECKPOINT_SUFFIX = '.pending-reviewer.json';
const TERMINAL_TASK_STATUSES = new Set(['done', 'blocked', 'fail', 'skipped']);

function buildReviewerCheckpointPath({ reviewsDir, taskId }) {
  return path.join(reviewsDir, `${taskId}${REVIEWER_CHECKPOINT_SUFFIX}`);
}

function writeReviewerCheckpoint({
  reviewsDir,
  taskId,
  epoch,
  cycle,
  lastDiffPath,
  reasoningEffort,
  implementerReport,
}) {
  const checkpointPath = buildReviewerCheckpointPath({ reviewsDir, taskId });
  const payload = {
    taskId,
    epoch,
    cycle,
    lastDiffPath,
    reasoningEffort,
    implementerReport,
  };

  fs.mkdirSync(reviewsDir, { recursive: true });
  fs.writeFileSync(checkpointPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return checkpointPath;
}

function readReviewerCheckpoint({ reviewsDir, taskId }) {
  const checkpointPath = buildReviewerCheckpointPath({ reviewsDir, taskId });
  if (!fs.existsSync(checkpointPath)) {
    return null;
  }

  try {
    return {
      path: checkpointPath,
      ...JSON.parse(fs.readFileSync(checkpointPath, 'utf8')),
    };
  } catch (error) {
    throw new Error(`Failed to parse reviewer checkpoint for ${taskId}: ${error.message}`);
  }
}

function clearReviewerCheckpoint({ reviewsDir, taskId }) {
  const checkpointPath = buildReviewerCheckpointPath({ reviewsDir, taskId });
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }
}

function findPendingReviewerCheckpoint({ plan, reviewsDir }) {
  for (const task of plan.tasks) {
    if (TERMINAL_TASK_STATUSES.has(task.status)) {
      clearReviewerCheckpoint({ reviewsDir, taskId: task.id });
      continue;
    }

    const checkpoint = readReviewerCheckpoint({ reviewsDir, taskId: task.id });
    if (checkpoint) {
      return {
        task,
        checkpoint,
      };
    }
  }

  return null;
}

module.exports = {
  buildReviewerCheckpointPath,
  clearReviewerCheckpoint,
  findPendingReviewerCheckpoint,
  readReviewerCheckpoint,
  writeReviewerCheckpoint,
};
