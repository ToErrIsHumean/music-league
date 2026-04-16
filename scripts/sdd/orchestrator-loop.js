#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const planDocument = require('./orchestrator/plan-document');
const roleContracts = require('./orchestrator/role-contracts');
const runtime = require('./orchestrator/runtime');
const gate = require('./orchestrator/gate');
const core = require('./orchestrator/core');

function parseArgs(argv) {
  const options = {
    json: false,
    ephemeral: false,
    useClaude: false,
    useCline: false,
    reasoningEffort: 'high',
    reasoningEffortExplicit: false,
    codexReasoningEffortExplicit: false,
    claudeEffortExplicit: false,
    passthroughArgs: [],
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
      case '--milestone':
        index = assignOption(argv, index, options, 'milestone');
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
      case '--output-last-message':
        index = assignOption(argv, index, options, 'outputLastMessagePath');
        break;
      case '--model':
        index = assignOption(argv, index, options, 'modelName');
        break;
      case '--reasoning-effort':
        index = assignOption(argv, index, options, 'reasoningEffort');
        options.reasoningEffortExplicit = true;
        options.codexReasoningEffortExplicit = true;
        break;
      case '--effort':
        index = assignOption(argv, index, options, 'reasoningEffort');
        options.reasoningEffortExplicit = true;
        options.claudeEffortExplicit = true;
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
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.repoRoot) throw new Error('--repo-root is required');
  if (!options.specPath) throw new Error('--spec is required');
  if (!options.planPath) throw new Error('--plan is required');

  if (options.useClaude && options.useCline) {
    throw new Error('--cc and --cline are mutually exclusive');
  }

  if (options.useClaude) {
    if (options.sandboxMode || options.profileName || options.json || options.ephemeral || options.codexReasoningEffortExplicit) {
      throw new Error('--sandbox, --reasoning-effort, --profile, --json, and --ephemeral are not compatible with --cc');
    }
  }

  if (options.useCline) {
    if (options.sandboxMode || options.profileName || options.json || options.ephemeral || options.codexReasoningEffortExplicit || options.claudeEffortExplicit) {
      throw new Error('--sandbox, --reasoning-effort, --profile, --json, --ephemeral, and --effort are not compatible with --cline');
    }
  }

  if (!options.useClaude && !options.useCline && options.claudeEffortExplicit) {
    throw new Error('--effort requires --cc');
  }

  options.passthroughArgs = buildPassthroughArgs(options);

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

function buildPassthroughArgs(options) {
  const args = [];

  if (options.useClaude) {
    args.push('--cc');
    if (options.modelName) args.push('--model', options.modelName);
  } else if (options.useCline) {
    args.push('--cline');
  } else {
    if (options.sandboxMode) args.push('--sandbox', options.sandboxMode);
    if (options.modelName) args.push('--model', options.modelName);
    if (options.profileName) args.push('--profile', options.profileName);
    if (options.json) args.push('--json');
    if (options.ephemeral) args.push('--ephemeral');
  }

  return args;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await core.runOrchestrator({
      repoRoot: path.resolve(options.repoRoot),
      specPath: path.resolve(options.specPath),
      specSlicePath: options.specSlicePath
        ? path.resolve(options.specSlicePath)
        : undefined,
      planPath: path.resolve(options.planPath),
      milestone: options.milestone,
      passthroughArgs: options.passthroughArgs,
      useClaude: options.useClaude,
      useCline: options.useCline,
      reasoningEffort: options.reasoningEffort,
      reasoningEffortExplicit: options.reasoningEffortExplicit,
      outputLastMessagePath: options.outputLastMessagePath,
      allowCommit: process.env.SDD_ORCHESTRATOR_SKIP_COMMIT !== '1',
      implementerScript: process.env.SDD_IMPLEMENTER_SCRIPT
        ? path.resolve(process.env.SDD_IMPLEMENTER_SCRIPT)
        : undefined,
      reviewerScript: process.env.SDD_REVIEWER_SCRIPT
        ? path.resolve(process.env.SDD_REVIEWER_SCRIPT)
        : undefined,
      lastDiffPath: process.env.SDD_LAST_DIFF_PATH
        ? path.resolve(process.env.SDD_LAST_DIFF_PATH)
        : undefined,
      reviewsDir: process.env.SDD_REVIEWS_DIR
        ? path.resolve(process.env.SDD_REVIEWS_DIR)
        : undefined,
      logPath: process.env.SDD_ORCHESTRATOR_LOG_PATH
        ? path.resolve(process.env.SDD_ORCHESTRATOR_LOG_PATH)
        : undefined,
    });

    if (options.outputLastMessagePath) {
      fs.writeFileSync(path.resolve(options.outputLastMessagePath), result.summary, 'utf8');
    }

    process.stdout.write(result.summary);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  buildBackendLintArgs: gate.buildBackendLintArgs,
  buildFrontendLintArgs: gate.buildFrontendLintArgs,
  buildImplementerArgs: roleContracts.buildImplementerArgs,
  buildImplementerInstruction: roleContracts.buildImplementerInstruction,
  buildReviewerArgs: roleContracts.buildReviewerArgs,
  buildReviewerInstruction: roleContracts.buildReviewerInstruction,
  classifyImplementerOutputWithLLM: roleContracts.classifyImplementerOutputWithLLM,
  computeCycle: planDocument.computeCycle,
  computeEpoch: planDocument.computeEpoch,
  createGracefulStopController: runtime.createGracefulStopController,
  emitImplementerReport: roleContracts.emitImplementerReport,
  formatPreSatisfiedAcs: roleContracts.formatPreSatisfiedAcs,
  parseChangedFilesFromDiff: gate.parseChangedFilesFromDiff,
  parseImplementerReport: roleContracts.parseImplementerReport,
  parseImplementerReportWithFallback: roleContracts.parseImplementerReportWithFallback,
  parseImplementerSignal: roleContracts.parseImplementerSignal,
  parsePlanDocument: planDocument.parsePlanDocument,
  parseReviewerVerdict: roleContracts.parseReviewerVerdict,
  resolveOrchestratorLogPath: runtime.resolveOrchestratorLogPath,
  runDeterministicGate: gate.runDeterministicGate,
  runOrchestrator: core.runOrchestrator,
  selectNextTask: planDocument.selectNextTask,
  serializePlanDocument: planDocument.serializePlanDocument,
};

if (require.main === module) {
  main();
}
