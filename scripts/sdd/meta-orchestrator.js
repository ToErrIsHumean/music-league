#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const {
  createGracefulStopController,
  formatClockTime,
  formatElapsedDuration,
  resolveOrchestratorLogPath,
} = require('./orchestrator/runtime');
const {
  parsePlanDocument,
  queueReviewNote,
  selectNextTask,
  writePlan,
} = require('./orchestrator/plan-document');
const { parseSummary: parseOrchestratorSummary } = require('./orchestrator/summary');

const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_DELAY_SECONDS = 5;
const OUTPUT_TAIL_CHARS = 64 * 1024;
const TERMINAL_TASK_STATUSES = new Set(['done', 'blocked', 'fail', 'skipped']);

function parseArgs(argv) {
  const options = {
    useClaude: false,
    useCline: false,
    sandboxMode: '',
    modelName: '',
    reasoningEffort: '',
    effort: '',
    profileName: '',
    json: false,
    ephemeral: false,
    maxIterations: DEFAULT_MAX_ITERATIONS,
    maxRetries: DEFAULT_MAX_RETRIES,
    delaySeconds: DEFAULT_DELAY_SECONDS,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--repo-root':
        index = assignOption(argv, index, options, 'repoRoot');
        break;
      case '--spec':
        index = assignOption(argv, index, options, 'specPath');
        break;
      case '--spec-slice':
        index = assignOption(argv, index, options, 'specSlicePath');
        break;
      case '--plan':
        index = assignOption(argv, index, options, 'planPath');
        break;
      case '--cc':
        options.useClaude = true;
        break;
      case '--cline':
        options.useCline = true;
        break;
      case '--sandbox':
        index = assignOption(argv, index, options, 'sandboxMode');
        break;
      case '--model':
        index = assignOption(argv, index, options, 'modelName');
        break;
      case '--reasoning-effort':
        index = assignOption(argv, index, options, 'reasoningEffort');
        break;
      case '--effort':
        index = assignOption(argv, index, options, 'effort');
        break;
      case '--profile':
        index = assignOption(argv, index, options, 'profileName');
        break;
      case '--json':
        options.json = true;
        break;
      case '--ephemeral':
        options.ephemeral = true;
        break;
      case '--max-iterations':
        index = assignOption(argv, index, options, 'maxIterations');
        options.maxIterations = Number(options.maxIterations);
        break;
      case '--max-retries':
        index = assignOption(argv, index, options, 'maxRetries');
        options.maxRetries = Number(options.maxRetries);
        break;
      case '--delay':
        index = assignOption(argv, index, options, 'delaySeconds');
        options.delaySeconds = Number(options.delaySeconds);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.repoRoot) throw new Error('--repo-root is required');
  if (!options.specPath) throw new Error('--spec is required');
  if (!options.planPath) throw new Error('--plan is required');

  validateMetaOptions(options);
  return options;
}

function assignOption(argv, index, options, key) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${argv[index]} requires a value`);
  }
  options[key] = value;
  return index + 1;
}

function parseIntegerOption(value, flag, minimum) {
  const parsedValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < minimum) {
    throw new Error(`${flag} must be an integer >= ${minimum}`);
  }
  return parsedValue;
}

function parseNumberOption(value, flag, minimum) {
  const parsedValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < minimum) {
    throw new Error(`${flag} must be a number >= ${minimum}`);
  }
  return parsedValue;
}

function validateMetaOptions(options) {
  if (options.useClaude && options.useCline) {
    throw new Error('--cc and --cline are mutually exclusive');
  }

  if (options.useClaude) {
    if (options.sandboxMode || options.profileName || options.json || options.ephemeral || options.reasoningEffort) {
      throw new Error('--sandbox, --reasoning-effort, --profile, --json, and --ephemeral are not compatible with --cc');
    }
  }

  if (options.useCline) {
    if (options.sandboxMode || options.profileName || options.json || options.ephemeral || options.reasoningEffort || options.effort) {
      throw new Error('--sandbox, --reasoning-effort, --profile, --json, --ephemeral, and --effort are not compatible with --cline');
    }
  }

  if (!options.useClaude && !options.useCline && options.effort) {
    throw new Error('--effort requires --cc');
  }

  options.maxIterations = parseIntegerOption(options.maxIterations, '--max-iterations', 1);
  options.maxRetries = parseIntegerOption(options.maxRetries, '--max-retries', 0);
  options.delaySeconds = parseNumberOption(options.delaySeconds, '--delay', 0);
}

function createMetaLogger({ repoRoot, planPath, logPath }) {
  const resolvedLogPath = logPath || resolveOrchestratorLogPath({ repoRoot, planPath });

  function emit(message) {
    const line = `[META ${formatClockTime()}] ${message}`;
    fs.mkdirSync(path.dirname(resolvedLogPath), { recursive: true });
    fs.appendFileSync(resolvedLogPath, `${line}\n`, 'utf8');
    process.stderr.write(`${line}\n`);
    return line;
  }

  return { emit, logPath: resolvedLogPath };
}

function markTaskBlocked(planPath, plan, taskId, reason) {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.status = 'blocked';
  queueReviewNote(plan, `- META: ${taskId} marked blocked — ${reason}`);
  writePlan(planPath, plan);
}

function findTransitivelyBlocked(tasks, additionalBlockedIds = new Set()) {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const blocked = new Set(additionalBlockedIds);

  for (const task of tasks) {
    if (task.status === 'blocked' || task.status === 'fail') {
      blocked.add(task.id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) {
      if (blocked.has(task.id)) continue;
      if (TERMINAL_TASK_STATUSES.has(task.status)) continue;

      const hasBlockedDep = task.dependsOn.some((dep) => blocked.has(dep) || !taskMap.has(dep));
      if (hasBlockedDep) {
        blocked.add(task.id);
        changed = true;
      }
    }
  }

  const directlyBlocked = new Set([
    ...additionalBlockedIds,
    ...tasks.filter((t) => t.status === 'blocked' || t.status === 'fail').map((t) => t.id),
  ]);

  return new Set([...blocked].filter((id) => !directlyBlocked.has(id)));
}

function buildOrchestratorArgs(options, outputLastMessagePath) {
  const args = [];

  args.push(path.join(options.repoRoot, 'scripts/sdd/orchestrator.sh'));
  args.push('--spec', options.specPath);
  args.push('--plan', options.planPath);

  if (options.specSlicePath) {
    args.push('--spec-slice', options.specSlicePath);
  }

  if (options.useClaude) {
    args.push('--cc');
  } else if (options.useCline) {
    args.push('--cline');
  }

  if (options.sandboxMode) {
    args.push('--sandbox', options.sandboxMode);
  }

  if (options.modelName) {
    args.push('--model', options.modelName);
  }

  if (options.useClaude && options.effort) {
    args.push('--effort', options.effort);
  } else if (!options.useClaude && !options.useCline && options.reasoningEffort) {
    args.push('--reasoning-effort', options.reasoningEffort);
  }

  if (options.profileName) {
    args.push('--profile', options.profileName);
  }

  if (options.json) {
    args.push('--json');
  }

  if (options.ephemeral) {
    args.push('--ephemeral');
  }

  if (outputLastMessagePath) {
    args.push('--output-last-message', outputLastMessagePath);
  }

  return args;
}

function appendOutputTail(output, chunk) {
  const combined = output + chunk;
  if (combined.length <= OUTPUT_TAIL_CHARS) {
    return combined;
  }
  return combined.slice(-OUTPUT_TAIL_CHARS);
}

function spawnOrchestrator(args, cwd, { onSpawn = null } = {}) {
  const startedAtMs = Date.now();
  const stdoutStream = process.stdout;
  const stderrStream = process.stderr;

  return new Promise((resolve) => {
    const child = spawn('bash', args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (typeof onSpawn === 'function') {
      onSpawn(child);
    }

    let stdout = '';
    let stderr = '';
    let childError = null;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout = appendOutputTail(stdout, chunk);
      stdoutStream.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = appendOutputTail(stderr, chunk);
      stderrStream.write(chunk);
    });
    child.on('error', (error) => { childError = error; });
    child.on('close', (code) => {
      if (typeof onSpawn === 'function') {
        onSpawn(null);
      }
      resolve({
        status: code === null ? 1 : code,
        stdout,
        stderr,
        error: childError,
        elapsedMs: Date.now() - startedAtMs,
      });
    });
  });
}

function dryRun(planPath) {
  const content = fs.readFileSync(planPath, 'utf8');
  const plan = parsePlanDocument(content);

  process.stdout.write('=== Meta-orchestrator dry-run ===\n\n');

  const tasks = plan.tasks.map((t) => ({ ...t }));
  const dispatchable = tasks.filter((t) => !TERMINAL_TASK_STATUSES.has(t.status));
  if (dispatchable.length === 0) {
    process.stdout.write('All tasks are already settled (done, blocked, fail, or skipped).\n');
    process.stdout.write('Nothing to dispatch.\n\n');
    return;
  }

  process.stdout.write('Simulated dispatch order (tasks with satisfied dependencies):\n\n');

  let step = 0;
  for (;;) {
    const next = selectNextTask(tasks);
    if (!next) break;

    step += 1;
    process.stdout.write(`  ${step}. ${next.id}: ${next.title} (status was: ${next.status})\n`);

    const task = tasks.find((t) => t.id === next.id);
    task.status = 'done';
  }

  process.stdout.write('\n');

  const remaining = tasks.filter((t) => !TERMINAL_TASK_STATUSES.has(t.status));
  if (remaining.length > 0) {
    process.stdout.write('Tasks that would remain undispatched (transitively blocked):\n\n');
    for (const task of remaining) {
      const deps = task.dependsOn.length > 0 ? task.dependsOn.join(', ') : '—';
      process.stdout.write(`  - ${task.id}: ${task.title} (status: ${task.status}, depends-on: ${deps})\n`);
    }
  } else {
    process.stdout.write('All tasks would be dispatched.\n');
  }

  process.stdout.write('\n');
}

function sleep(ms, stopController) {
  if (ms <= 0) {
    return Promise.resolve('timer');
  }

  if (!stopController) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve('timer'), ms);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    });
  }

  if (stopController.isRequested()) {
    return Promise.resolve('stop');
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => finish('timer'), ms);
    const unsubscribe = stopController.onRequest(() => finish('stop'));

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    }
  });
}

function readPlan(planPath) {
  return parsePlanDocument(fs.readFileSync(planPath, 'utf8'));
}

function readSummaryText(summaryPath, fallbackOutput) {
  if (fs.existsSync(summaryPath)) {
    return fs.readFileSync(summaryPath, 'utf8');
  }
  return fallbackOutput;
}

function cleanupSummaryArtifacts(tmpDir, summaryPath) {
  try {
    fs.unlinkSync(summaryPath);
    fs.rmdirSync(tmpDir);
  } catch {
    // Ignore temp cleanup failures.
  }
}

function buildExecutionErrorSnippet(result) {
  return (result.stderr || result.stdout || '(no output)').split('\n').slice(0, 3).join(' | ');
}

function enrichTaskEntries(entries, taskMap) {
  for (const entry of entries) {
    const task = taskMap.get(entry.id);
    if (task) {
      entry.title = task.title;
    }
  }
}

function buildFinalSummary({
  iteration,
  maxIterations,
  gracefulStopRequested,
  completedTasks,
  executionBlockedTasks,
  humanGateTasks,
  finalPlan,
}) {
  const taskMap = new Map(finalPlan.tasks.map((task) => [task.id, task]));
  const humanGateTaskIds = new Set(humanGateTasks.map((entry) => entry.id));
  const transitivelyBlocked = findTransitivelyBlocked(finalPlan.tasks, humanGateTaskIds);
  const skippedTasks = finalPlan.tasks.filter((task) => task.status === 'skipped');
  const activeAutomationBlocks = new Set([...humanGateTaskIds, ...transitivelyBlocked]);

  enrichTaskEntries(completedTasks, taskMap);
  enrichTaskEntries(executionBlockedTasks, taskMap);
  enrichTaskEntries(humanGateTasks, taskMap);

  const lines = [];
  lines.push('');
  lines.push('=== Meta-orchestrator final summary ===');
  lines.push(`  Iterations used: ${iteration}/${maxIterations}`);
  lines.push(`  Graceful stop requested: ${gracefulStopRequested ? 'yes' : 'no'}`);
  lines.push('');

  if (completedTasks.length > 0) {
    lines.push(`  Completed (${completedTasks.length}):`);
    for (const entry of completedTasks) {
      lines.push(`    ✓ ${entry.id}: ${entry.title}`);
    }
    lines.push('');
  }

  if (executionBlockedTasks.length > 0) {
    lines.push(`  Blocked/failed after execution errors (${executionBlockedTasks.length}):`);
    for (const entry of executionBlockedTasks) {
      lines.push(`    ! ${entry.id}: ${entry.title} — ${entry.reason}`);
    }
    lines.push('');
  }

  if (humanGateTasks.length > 0) {
    lines.push(`  Human gate required (${humanGateTasks.length}):`);
    for (const entry of humanGateTasks) {
      lines.push(`    ? ${entry.id}: ${entry.title} — ${entry.reason}`);
    }
    lines.push('');
  }

  if (transitivelyBlocked.size > 0) {
    lines.push(`  Transitively blocked (dependency is blocked, failed, or human-gated) (${transitivelyBlocked.size}):`);
    for (const taskId of transitivelyBlocked) {
      const task = taskMap.get(taskId);
      if (!task) continue;
      lines.push(`    - ${task.id}: ${task.title}`);
    }
    lines.push('');
  }

  if (skippedTasks.length > 0) {
    lines.push(`  Skipped (${skippedTasks.length}):`);
    for (const task of skippedTasks) {
      lines.push(`    - ${task.id}: ${task.title}`);
    }
    lines.push('');
  }

  if (activeAutomationBlocks.size === 0) {
    lines.push('  All tasks settled or halted behind a human gate.');
  } else {
    lines.push('  Remaining unsettled automation paths require human intervention.');
  }

  return `${lines.join('\n')}\n`;
}

async function runMetaOrchestrator(options) {
  if (options.dryRun) {
    dryRun(options.planPath);
    return { status: 0, summary: '' };
  }

  const logger = createMetaLogger({
    repoRoot: options.repoRoot,
    planPath: options.planPath,
  });
  logger.emit(
    `Meta-orchestrator started (max-iterations: ${options.maxIterations}, max-retries: ${options.maxRetries}, delay: ${options.delaySeconds}s)`,
  );

  const completedTasks = [];
  const executionBlockedTasks = [];
  const humanGateTasks = [];
  const retryCounts = new Map();
  let gracefulStopRequested = false;
  let currentChild = null;

  const stopController = createGracefulStopController({
    onStopRequested() {
      gracefulStopRequested = true;
      logger.emit('Graceful stop requested; waiting for current orchestrator cycle.');
      if (currentChild && currentChild.pid) {
        try {
          currentChild.kill('SIGUSR1');
        } catch (error) {
          logger.emit(`Unable to forward graceful stop signal: ${error.message}`);
        }
      }
    },
    onHardAbort() {
      logger.emit('Hard abort requested; interrupting meta-orchestrator.');
      if (currentChild && currentChild.pid) {
        try {
          currentChild.kill('SIGINT');
        } catch (error) {
          logger.emit(`Unable to interrupt child process: ${error.message}`);
        }
      }
      process.kill(process.pid, 'SIGINT');
    },
  });

  let iteration = 0;
  try {
    for (; iteration < options.maxIterations; iteration += 1) {
      const plan = readPlan(options.planPath);
      const nextTask = selectNextTask(plan.tasks);

      if (!nextTask) {
        logger.emit('No dispatchable tasks found — terminating.');
        break;
      }

      const count = retryCounts.get(nextTask.id) || 0;
      logger.emit(
        `#${iteration + 1} dispatching orchestrator for ${nextTask.id} (${nextTask.title})`,
      );

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-orchestrator-'));
      const summaryPath = path.join(tmpDir, 'summary.txt');
      const args = buildOrchestratorArgs(options, summaryPath);

      const result = await spawnOrchestrator(args, options.repoRoot, {
        onSpawn(child) {
          currentChild = child;
        },
      });

      cleanupSummaryArtifacts(tmpDir, summaryPath);

      if (result.error || result.status !== 0) {
        const errorSnippet = result.error
          ? result.error.message
          : buildExecutionErrorSnippet(result);
        retryCounts.set(nextTask.id, count + 1);

        if (count + 1 > options.maxRetries) {
          const updatedPlan = readPlan(options.planPath);
          markTaskBlocked(
            options.planPath,
            updatedPlan,
            nextTask.id,
            `execution error after ${count + 1} attempts (${errorSnippet})`,
          );
          executionBlockedTasks.push({
            id: nextTask.id,
            reason: `execution error after ${count + 1} attempts (${errorSnippet})`,
          });
          logger.emit(
            `#${iteration + 1} ${nextTask.id} marked blocked after ${count + 1} execution errors.`,
          );
        } else {
          logger.emit(
            `#${iteration + 1} ${nextTask.id} execution failed (attempt ${count + 1}/${options.maxRetries + 1}): ${errorSnippet}`,
          );
        }

        const waitResult = await sleep(options.delaySeconds * 1000, stopController);
        if (waitResult === 'stop') {
          logger.emit(
            `#${iteration + 1} graceful stop acknowledged with no task selected (${formatElapsedDuration(result.elapsedMs)}).`,
          );
          break;
        }
        continue;
      }

      const summaryText = readSummaryText(summaryPath, result.stdout);
      const summary = parseOrchestratorSummary(summaryText);
      const elapsedLabel = formatElapsedDuration(result.elapsedMs);

      if (summary.selectedTask && summary.humanGate) {
        const reason = summary.verdict === 'blocked'
          ? 'escalation (blocked signal)'
          : `review cycle exhaustion (${summary.verdict || 'human gate'})`;
        humanGateTasks.push({
          id: summary.selectedTask,
          reason,
        });
        logger.emit(
          `#${iteration + 1} graceful stop acknowledged after current work`,
        );
      } else if (summary.selectedTask) {
        completedTasks.push({ id: summary.selectedTask });
        logger.emit(
          `#${iteration + 1} ${summary.selectedTask} done (${elapsedLabel})`,
        );
      } else {
        logger.emit(
          `#${iteration + 1} graceful stop acknowledged after ${summary.stoppedAfter || 'current work'} (${elapsedLabel})`,
        );
      }

      if (summary.gracefulStopRequested) {
        gracefulStopRequested = true;
        break;
      }

      const waitResult = await sleep(options.delaySeconds * 1000, stopController);
      if (waitResult === 'stop') {
        break;
      }
    }
  } finally {
    stopController.cleanup();
  }

  logger.emit('Meta-orchestrator finished.');
  const finalPlan = readPlan(options.planPath);
  const summary = buildFinalSummary({
    iteration: iteration + (iteration < options.maxIterations ? 1 : 0),
    maxIterations: options.maxIterations,
    gracefulStopRequested,
    completedTasks,
    executionBlockedTasks,
    humanGateTasks,
    finalPlan,
  });

  process.stdout.write(summary);
  return { status: 0, summary };
}

module.exports = {
  markTaskBlocked,
  parseArgs,
  runMetaOrchestrator,
};

if (require.main === module) {
  runMetaOrchestrator(parseArgs(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
