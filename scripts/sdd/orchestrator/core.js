'use strict';

const fs = require('fs');
const path = require('path');
const projectConfig = require('../../lib/projectConfig');

const planDocument = require('./plan-document');
const roleContractsModule = require('./role-contracts');
const runtimeModule = require('./runtime');
const gateModule = require('./gate');
const promotionModule = require('./promotion');
const reviewerCheckpointModule = require('./reviewer-checkpoint');
const worktreeModule = require('./worktree');
const summaryModule = require('./summary');
const milestoneModule = require('./milestone');
const { runImplementerPhase } = require('./implementer-cycle');
const { runReviewerPhase } = require('./reviewer-cycle');
const { createSummary } = summaryModule;

function buildRetryCommand({
  repoRoot,
  specPath,
  specSlicePath,
  taskId,
  cycle,
  reviewFeedbackPath,
  useClaude,
  useCline,
  reasoningEffort,
}) {
  const args = [
    'scripts/sdd/implementer.sh',
  ];

  if (useClaude) {
    args.push('--cc', '--effort', reasoningEffort);
  } else if (useCline) {
    args.push('--cline');
  } else {
    args.push('--reasoning-effort', reasoningEffort);
  }

  args.push(
    '--task', taskId,
    '--spec', path.relative(repoRoot, specPath),
    '--cycle', String(cycle),
  );

  if (specSlicePath) {
    args.push('--spec-slice', path.relative(repoRoot, specSlicePath));
  }

  if (reviewFeedbackPath) {
    args.push('--review-feedback', path.relative(repoRoot, reviewFeedbackPath));
  }

  return args.join(' ');
}

function createRunContext(options) {
  const orchestratorLogPath = runtimeModule.resolveOrchestratorLogPath({
    repoRoot: options.repoRoot,
    planPath: options.planPath,
    logPath: options.logPath,
  });
  const progress = options.progressReporter || runtimeModule.createProgressReporter({
    logPath: orchestratorLogPath,
  });
  const stopController = options.stopController || runtimeModule.createGracefulStopController({
    onStopRequested(source) {
      progress.emit(`Graceful stop requested via ${source}; waiting for the current implementer/reviewer step to finish.`);
    },
  });
  const run = options.run || runtimeModule.runCommand;
  const worktreeOps = options.worktreeOps || worktreeModule.createDefaultWorktreeOps({ run });

  return {
    options: {
      ...options,
      implementerScript: options.implementerScript || path.join(options.repoRoot, 'scripts/sdd/implementer.sh'),
      reviewerScript: options.reviewerScript || path.join(options.repoRoot, 'scripts/sdd/reviewer.sh'),
      reviewsDir: options.reviewsDir || path.join(projectConfig.APP_SDD_DOCS_DIR_ABS, 'reviews'),
    },
    gate: {
      runDeterministicGate: options.gateRunner || gateModule.runDeterministicGate,
    },
    roleContracts: {
      classifyOutput: options.classifyOutput || roleContractsModule.classifyImplementerOutputWithLLM,
    },
    runtime: {
      appendOperatorLog: runtimeModule.appendOperatorLog,
      ensureCommandSucceeded: runtimeModule.ensureCommandSucceeded,
      ensureDirectoryExists: runtimeModule.ensureDirectoryExists,
      ensureFileExists: runtimeModule.ensureFileExists,
      now: options.now || runtimeModule.timestampNow,
      operatorStream: options.operatorStream || process.stdout,
      orchestratorLogPath,
      progress,
      promoteReviewedWorkspace: options.promoteReviewedWorkspace || promotionModule.promoteReviewedWorkspace,
      run,
      runTrackedCommand: options.runTrackedCommand || runtimeModule.runTrackedCommand,
      stopController,
      worktreeOps,
      logClassifierDiagnostic(message) {
        if (!orchestratorLogPath) return;
        runtimeModule.appendOperatorLog(orchestratorLogPath, `[${runtimeModule.formatClockTime()}] ${message}`);
      },
    },
  };
}

function loadDispatchState(context) {
  const { options, runtime } = context;

  const planContent = fs.readFileSync(options.planPath, 'utf8');
  const plan = planDocument.parsePlanDocument(planContent);

  if (runtime.stopController.isRequested()) {
    runtime.progress.emit('Graceful stop already requested before task selection.');
    return {
      kind: 'graceful_stop',
      summary: createSummary({
        humanGate: false,
        gracefulStopRequested: true,
        stoppedAfter: null,
        nextCommand: null,
        note: 'Graceful stop requested before a new task was selected.',
      }),
    };
  }

  const pendingReviewerResume = reviewerCheckpointModule.findPendingReviewerCheckpoint({
    plan,
    reviewsDir: options.reviewsDir,
  });
  if (pendingReviewerResume) {
    runtime.progress.emit(`Resuming reviewer for ${pendingReviewerResume.task.id} cycle ${pendingReviewerResume.checkpoint.cycle}.`);
    return {
      kind: 'reviewer_checkpoint',
      plan,
      task: pendingReviewerResume.task,
      epoch: pendingReviewerResume.checkpoint.epoch,
      cycle: pendingReviewerResume.checkpoint.cycle,
      reviewerCheckpoint: pendingReviewerResume.checkpoint,
    };
  }

  const task = planDocument.selectNextTask(plan.tasks);

  if (!task) {
    const allBlockedOrWaiting = plan.tasks.every((candidateTask) =>
      candidateTask.status === 'blocked' || candidateTask.status === 'done'
    );

    if (allBlockedOrWaiting && plan.tasks.some((candidateTask) => candidateTask.status === 'blocked')) {
      runtime.progress.emit('[STALL] All tasks blocked or waiting; halting.');
      return {
        kind: 'idle',
        summary: createSummary({
          humanGate: false,
          gracefulStopRequested: false,
          stoppedAfter: null,
          nextCommand: null,
          note: 'All tasks blocked or waiting; halting.',
        }),
      };
    }

    runtime.progress.emit('No dispatchable tasks found.');
    return {
      kind: 'idle',
      summary: createSummary({
        humanGate: false,
        gracefulStopRequested: false,
        stoppedAfter: null,
        nextCommand: null,
        note: 'No dispatchable tasks found.',
      }),
    };
  }

  return {
    kind: 'task',
    plan,
    task,
    epoch: planDocument.computeEpoch(plan.signals, task.id),
    cycle: planDocument.computeCycle(plan.signals, task.id),
  };
}

function resolveReviewFeedbackPathForResume({ reviewsDir, taskId, epoch, cycle }) {
  if (cycle <= 1) return null;

  const priorVerdictPath = path.join(reviewsDir, `${taskId}-epoch-${epoch}-cycle-${cycle - 1}.md`);
  if (!fs.existsSync(priorVerdictPath)) return null;

  const priorVerdict = roleContractsModule.parseReviewerVerdict(fs.readFileSync(priorVerdictPath, 'utf8'));
  return priorVerdict === 'contested' ? priorVerdictPath : null;
}

function persistSignalAndCheckBlock({ context, state, signal }) {
  const { options, runtime } = context;

  planDocument.appendSignal(state.plan, {
    task: state.task.id,
    signal: signal.signal,
    discovery: signal.discovery,
    cycle: state.cycle,
    model: signal.model,
    reasoningEffort: signal.reasoningEffort,
    timestamp: runtime.now(),
  });

  if (signal.signal === 'blocked') {
    state.task.status = 'blocked';
    planDocument.writePlan(options.planPath, state.plan);
    runtime.progress.emit(`Human gate required: ${state.task.id} blocked in cycle ${state.cycle}.`);
    return {
      kind: 'task_blocked',
      verdict: 'blocked',
      humanGate: true,
    };
  }

  planDocument.writePlan(options.planPath, state.plan);
  return { kind: 'continue' };
}

function finalizeReviewedTask({ context, state, verdict }) {
  const { options, runtime } = context;

  if (options.allowCommit !== false) {
    runtime.promoteReviewedWorkspace({
      repoRoot: options.repoRoot,
      worktreePath: state.worktree.worktreePath,
      branchName: state.worktree.branchName,
      taskId: state.task.id,
      taskTitle: state.task.title,
      planPath: options.planPath,
      run: runtime.run,
      writeOperationalState() {
        state.task.status = 'done';
        planDocument.writePlan(options.planPath, state.plan);
      },
    });
  } else {
    state.task.status = 'done';
    planDocument.writePlan(options.planPath, state.plan);

    worktreeModule.finalizeTaskWorkspace({
      repoRoot: options.repoRoot,
      branchName: state.worktree.branchName,
      worktreePath: state.worktree.worktreePath,
      worktreeOps: runtime.worktreeOps,
    });
  }

  return {
    kind: 'task_done',
    verdict,
  };
}

async function runOrchestrator(options) {
  const context = createRunContext(options);
  const { runtime } = context;

  try {
    const dispatchState = loadDispatchState(context);
    if (dispatchState.kind !== 'task' && dispatchState.kind !== 'reviewer_checkpoint') {
      return {
        humanGate: false,
        gracefulStopRequested: dispatchState.kind === 'graceful_stop',
        stoppedAfter: null,
        summary: dispatchState.summary,
      };
    }

    const state = {
      ...dispatchState,
      reviewFeedbackPath: resolveReviewFeedbackPathForResume({
        reviewsDir: context.options.reviewsDir,
        taskId: dispatchState.task.id,
        epoch: dispatchState.epoch,
        cycle: dispatchState.cycle,
      }),
      humanGate: false,
      gracefulStopRequested: false,
      stoppedAfter: null,
      lastVerdict: null,
      lastReasoningEffort: dispatchState.kind === 'reviewer_checkpoint'
        ? dispatchState.reviewerCheckpoint.reasoningEffort
        : options.reasoningEffort,
      resumeWithReviewer: dispatchState.kind === 'reviewer_checkpoint',
      worktree: null,
    };

    runtime.ensureFileExists(context.options.implementerScript, 'Implementer wrapper');
    runtime.ensureFileExists(context.options.reviewerScript, 'Reviewer wrapper');
    if (context.options.specSlicePath) {
      runtime.ensureDirectoryExists(context.options.specSlicePath, 'Spec slice directory');
    }
    fs.mkdirSync(context.options.reviewsDir, { recursive: true });

    state.worktree = worktreeModule.prepareTaskWorkspace({
      repoRoot: context.options.repoRoot,
      taskId: state.task.id,
      milestone: milestoneModule.resolveMilestoneLabel({
        milestone: context.options.milestone,
        envMilestone: process.env.SDD_MILESTONE,
        specPath: context.options.specPath,
        planPath: context.options.planPath,
      }),
      progress: runtime.progress,
      worktreeOps: runtime.worktreeOps,
    });

    runtime.progress.emit(`Selected ${state.task.id} (epoch ${state.epoch}, cycle ${state.cycle})`);
    state.task.status = 'active';

    for (;;) {
      if (runtime.stopController.isRequested()) {
        state.gracefulStopRequested = true;
        runtime.progress.emit(`Graceful stop requested before starting ${state.task.id} cycle ${state.cycle}; no new implementer step will start.`);
        break;
      }

      let reviewerInput;

      if (state.resumeWithReviewer) {
        runtime.ensureFileExists(state.reviewerCheckpoint.lastDiffPath, 'Reviewer diff artifact');
        reviewerInput = {
          report: state.reviewerCheckpoint.implementerReport,
          reasoningEffort: state.reviewerCheckpoint.reasoningEffort,
          lastDiffPath: state.reviewerCheckpoint.lastDiffPath,
        };
      } else {
        const implementerPhase = await runImplementerPhase({
          context,
          state,
        });
        state.lastReasoningEffort = implementerPhase.reasoningEffort;

        if (implementerPhase.kind === 'graceful_stop') {
          state.gracefulStopRequested = true;
          state.stoppedAfter = implementerPhase.stoppedAfter;
          break;
        }

        const signalResult = persistSignalAndCheckBlock({
          context,
          state,
          signal: implementerPhase.signal,
        });

        if (signalResult.kind === 'task_blocked') {
          state.humanGate = true;
          state.lastVerdict = signalResult.verdict;
          break;
        }

        if (runtime.stopController.isRequested()) {
          reviewerCheckpointModule.writeReviewerCheckpoint({
            reviewsDir: context.options.reviewsDir,
            taskId: state.task.id,
            epoch: state.epoch,
            cycle: state.cycle,
            lastDiffPath: implementerPhase.lastDiffPath,
            reasoningEffort: implementerPhase.reasoningEffort,
            implementerReport: implementerPhase.report,
          });
          state.gracefulStopRequested = true;
          state.stoppedAfter = 'implementer';
          state.resumeWithReviewer = true;
          runtime.progress.emit(`Graceful stop requested after implementer ${state.task.id} cycle ${state.cycle}; reviewer checkpoint persisted and reviewer will resume on the next launch.`);
          break;
        }

        reviewerInput = {
          report: implementerPhase.report,
          reasoningEffort: implementerPhase.reasoningEffort,
          lastDiffPath: implementerPhase.lastDiffPath,
        };
      }

      const reviewerPhase = await runReviewerPhase({
        context,
        state,
        implementerReport: reviewerInput.report,
        reasoningEffort: reviewerInput.reasoningEffort,
        lastDiffPath: reviewerInput.lastDiffPath,
      });
      reviewerCheckpointModule.clearReviewerCheckpoint({
        reviewsDir: context.options.reviewsDir,
        taskId: state.task.id,
      });
      state.resumeWithReviewer = false;

      planDocument.addReviewNote(
        state.plan,
        context.options.repoRoot,
        state.task.id,
        state.cycle,
        reviewerPhase.verdictPath,
        reviewerPhase.verdict,
      );
      planDocument.writePlan(context.options.planPath, state.plan);
      state.lastVerdict = reviewerPhase.verdict;

      if (reviewerPhase.verdict === 'confirmed' || reviewerPhase.verdict === 'deferred') {
        finalizeReviewedTask({
          context,
          state,
          verdict: reviewerPhase.verdict,
        });

        if (reviewerPhase.reviewerStopRequested) {
          state.gracefulStopRequested = true;
          state.stoppedAfter = 'reviewer';
          runtime.progress.emit(`Graceful stop requested after reviewer ${state.task.id} cycle ${state.cycle}; reviewer results have been finalized and no new implementer step will start until the next launch.`);
        }

        break;
      }

      if (reviewerPhase.verdict === 'contested') {
        const maxCycles = context.options.useCline ? 4 : 3;
        if (state.cycle >= maxCycles) {
          state.humanGate = true;
          planDocument.writePlan(context.options.planPath, state.plan);
          runtime.progress.emit(`Human gate required: ${state.task.id} exhausted ${maxCycles} review cycles.`);
          break;
        }

        state.reviewFeedbackPath = reviewerPhase.verdictPath;

        if (reviewerPhase.reviewerStopRequested) {
          state.gracefulStopRequested = true;
          state.stoppedAfter = 'reviewer';
          runtime.progress.emit(`Graceful stop requested after reviewer ${state.task.id} cycle ${state.cycle}; reviewer notes are recorded and the next implementer cycle will not start until the next launch.`);
          break;
        }

        state.cycle += 1;
        continue;
      }
    }

    return {
      humanGate: state.humanGate,
      selectedTask: state.task.id,
      cycle: state.cycle,
      verdict: state.lastVerdict,
      gracefulStopRequested: state.gracefulStopRequested,
      stoppedAfter: state.stoppedAfter,
      summary: createSummary({
        taskId: state.task.id,
        cycle: state.cycle,
        verdict: state.lastVerdict,
        humanGate: state.humanGate,
        gracefulStopRequested: state.gracefulStopRequested,
        stoppedAfter: state.stoppedAfter,
        nextCommand: state.humanGate
          ? buildRetryCommand({
            repoRoot: context.options.repoRoot,
            specPath: context.options.specPath,
            specSlicePath: context.options.specSlicePath,
            taskId: state.task.id,
            cycle: state.cycle,
            reviewFeedbackPath: state.reviewFeedbackPath,
            useClaude: context.options.useClaude,
            useCline: context.options.useCline,
            reasoningEffort: state.lastReasoningEffort,
          })
          : null,
        note: state.gracefulStopRequested
          ? (state.stoppedAfter === 'implementer'
            ? (state.resumeWithReviewer
              ? 'Graceful stop requested after implementer; reviewer checkpoint was persisted and reviewer will resume on the next launch.'
              : 'Graceful stop requested after implementer; reviewer was not reached because another implementer retry was required, so the current cycle will rerun on the next launch.')
            : 'Graceful stop requested after reviewer; reviewer results were finalized and no new implementer cycle will start until the next launch.')
          : (state.humanGate && state.lastVerdict === 'blocked'
            ? 'Implementer escalated; wait for a human gate and spec amendment before retrying.'
            : (state.humanGate ? 'Cycle limit reached without a confirmed or deferred review.' : null)),
      }),
    };
  } finally {
    runtime.stopController.cleanup();
  }
}

module.exports = {
  buildRetryCommand,
  createRunContext,
  createSummary,
  runOrchestrator,
};
