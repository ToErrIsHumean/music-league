'use strict';

const fs = require('fs');
const path = require('path');
const projectConfig = require('../../lib/projectConfig');

const {
  buildImplementerArgs,
  buildImplementerInstruction,
  emitImplementerReport,
  parseImplementerReportWithFallback,
  resolveReasoningEffort,
} = require('./role-contracts');
const {
  buildGateFeedbackFile,
} = require('./gate');

function resolveLastDiffPath({ worktreePath, taskId, lastDiffPath }) {
  return lastDiffPath || path.join(worktreePath, 'docs', 'sdd', `last-diff-${taskId.toLowerCase()}.md`);
}

function ensureNonEmptyPassDiffArtifact({ report, lastDiffPath, taskId }) {
  const hasPreSatisfiedAcs = Array.isArray(report.preSatisfiedAcs) && report.preSatisfiedAcs.length > 0;
  if (report.signal.signal !== 'pass' || hasPreSatisfiedAcs) {
    return;
  }

  const stats = fs.statSync(lastDiffPath);
  if (stats.size === 0) {
    throw new Error(
      `Implementer reported pass for ${taskId} without pre-satisfied ACs, but the diff artifact is empty: ${lastDiffPath}`,
    );
  }
}

function resolveEscalationBriefPath({ repoRoot, taskId, epoch, cycle, reviewFeedbackPath }) {
  const escalationPath = path.join(projectConfig.APP_SDD_DOCS_DIR_ABS, `escalation-${taskId}.md`);
  if (reviewFeedbackPath || epoch <= 1 || cycle !== 1 || !fs.existsSync(escalationPath)) {
    return null;
  }
  return escalationPath;
}

async function runImplementerPhase({
  context,
  state,
}) {
  const {
    options,
    runtime,
    roleContracts,
    gate,
  } = context;
  const {
    task,
    epoch,
    cycle,
    reviewFeedbackPath,
    worktree,
  } = state;

  const lastDiffPath = resolveLastDiffPath({
    worktreePath: worktree.worktreePath,
    taskId: task.id,
    lastDiffPath: options.lastDiffPath,
  });
  const reasoningEffort = resolveReasoningEffort({
    explicitReasoningEffort: options.reasoningEffortExplicit,
    reasoningEffort: options.reasoningEffort,
    overrides: state.plan.reasoningOverrides,
    taskId: task.id,
  });

  let deterministicFeedbackPath = null;

  for (;;) {
    const effectiveReviewFeedbackPath = deterministicFeedbackPath ? null : reviewFeedbackPath;

    const implementerArgs = buildImplementerArgs({
      taskId: task.id,
      specPath: options.specPath,
      specSlicePath: options.specSlicePath,
      cycle,
      reviewFeedbackPath: effectiveReviewFeedbackPath,
      deterministicFeedbackPath,
      escalationBriefPath: deterministicFeedbackPath
        ? null
        : resolveEscalationBriefPath({
          repoRoot: options.repoRoot,
          taskId: task.id,
          epoch,
          cycle,
          reviewFeedbackPath: effectiveReviewFeedbackPath,
        }),
      workdirPath: worktree.worktreePath,
      instruction: buildImplementerInstruction(task.id),
      reasoningEffort,
      useClaude: options.useClaude,
      useCline: options.useCline,
      passthroughArgs: options.passthroughArgs || [],
    });

    const implementerResult = await runtime.runTrackedCommand({
      label: `Implementer ${task.id} cycle ${cycle}`,
      command: 'bash',
      args: [options.implementerScript, ...implementerArgs],
      cwd: worktree.worktreePath,
      progress: runtime.progress,
    });
    runtime.ensureCommandSucceeded(implementerResult, `Implementer wrapper for ${task.id} cycle ${cycle}`);

    const report = await parseImplementerReportWithFallback(implementerResult.stdout, task.id, {
      classifyOutput: roleContracts.classifyOutput,
      log: runtime.logClassifierDiagnostic,
    });
    emitImplementerReport(report, runtime.operatorStream);
    runtime.ensureFileExists(lastDiffPath, 'Implementer diff artifact');
    ensureNonEmptyPassDiffArtifact({ report, lastDiffPath, taskId: task.id });

    const gateResult = gate.runDeterministicGate({
      repoRoot: options.repoRoot,
      worktreePath: worktree.worktreePath,
      diffPath: lastDiffPath,
      run: runtime.run,
    });

    if (gateResult.ok) {
      return {
        kind: 'continue',
        cycle,
        report,
        signal: { ...report.signal },
        reasoningEffort,
        lastDiffPath,
      };
    }

    if (runtime.stopController.isRequested()) {
      runtime.progress.emit(`Graceful stop requested after implementer ${task.id} cycle ${cycle}; reviewer was not reached because another implementer retry is required. The current cycle will rerun on the next launch.`);
      return {
        kind: 'graceful_stop',
        stoppedAfter: 'implementer',
        reasoningEffort,
      };
    }

    runtime.progress.emit(`Deterministic gate failed for ${task.id} cycle ${cycle}; retrying implementer.`);
    deterministicFeedbackPath = buildGateFeedbackFile(task.id, cycle, gateResult);
  }
}

module.exports = {
  ensureNonEmptyPassDiffArtifact,
  resolveLastDiffPath,
  runImplementerPhase,
};
