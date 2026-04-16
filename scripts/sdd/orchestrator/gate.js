'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const projectConfig = require('../../lib/projectConfig');

function parseChangedFilesFromDiff(diffContent) {
  const files = new Set();
  const diffRegex = /^diff --git a\/(.+?) b\/(.+)$/gm;
  let match;

  while ((match = diffRegex.exec(diffContent)) !== null) {
    const oldPath = match[1];
    const newPath = match[2];
    if (newPath && newPath !== '/dev/null') {
      files.add(newPath);
    } else if (oldPath && oldPath !== '/dev/null') {
      files.add(oldPath);
    }
  }

  return Array.from(files);
}

function buildBackendLintArgs() {
  return null;
}

function buildFrontendLintArgs() {
  return null;
}

function normalizeGateCommands(rawConfig, configPath) {
  const commands = Array.isArray(rawConfig) ? rawConfig : rawConfig && rawConfig.commands;

  if (!commands) {
    return [];
  }

  if (!Array.isArray(commands)) {
    throw new Error(`Invalid deterministic gate config at ${configPath}: commands must be an array.`);
  }

  return commands.map((commandConfig, index) => {
    if (!commandConfig || typeof commandConfig !== 'object') {
      throw new Error(`Invalid deterministic gate config at ${configPath}: command ${index + 1} must be an object.`);
    }

    if (typeof commandConfig.label !== 'string' || !commandConfig.label.trim()) {
      throw new Error(`Invalid deterministic gate config at ${configPath}: command ${index + 1} is missing a label.`);
    }

    if (typeof commandConfig.command !== 'string' || !commandConfig.command.trim()) {
      throw new Error(`Invalid deterministic gate config at ${configPath}: command ${index + 1} is missing a command.`);
    }

    if (commandConfig.args && !Array.isArray(commandConfig.args)) {
      throw new Error(`Invalid deterministic gate config at ${configPath}: args for ${commandConfig.label} must be an array.`);
    }

    if (commandConfig.whenChangedPrefixes && !Array.isArray(commandConfig.whenChangedPrefixes)) {
      throw new Error(`Invalid deterministic gate config at ${configPath}: whenChangedPrefixes for ${commandConfig.label} must be an array.`);
    }

    return {
      label: commandConfig.label.trim(),
      command: commandConfig.command.trim(),
      args: Array.isArray(commandConfig.args) ? commandConfig.args.map((value) => String(value)) : [],
      whenChangedPrefixes: Array.isArray(commandConfig.whenChangedPrefixes)
        ? commandConfig.whenChangedPrefixes.map((value) => String(value))
        : [],
    };
  });
}

function loadGateCommands({ repoRoot }) {
  const configuredPath = projectConfig.APP_SDD_GATE_CONFIG_PATH_ABS;
  const configPath = configuredPath || path.join(repoRoot, 'config', 'sdd-gates.json');

  if (!configPath || !fs.existsSync(configPath)) {
    return [];
  }

  let parsedConfig;

  try {
    parsedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse deterministic gate config ${configPath}: ${error.message}`);
  }

  return normalizeGateCommands(parsedConfig, configPath);
}

function shouldRunCommand(commandConfig, changedFiles) {
  if (!commandConfig.whenChangedPrefixes.length) {
    return true;
  }

  return changedFiles.some((filePath) =>
    commandConfig.whenChangedPrefixes.some((prefix) => filePath.startsWith(prefix))
  );
}

function expandGateCommandArgs(args, changedFiles) {
  const expandedArgs = [];

  for (const arg of args) {
    if (arg === '{changed_files}') {
      expandedArgs.push(...changedFiles);
      continue;
    }

    expandedArgs.push(arg);
  }

  return expandedArgs;
}

function runDeterministicGate({ repoRoot, worktreePath, diffPath, run }) {
  const diffContent = fs.readFileSync(diffPath, 'utf8');
  const changedFiles = parseChangedFilesFromDiff(diffContent);
  const gateCwd = worktreePath || repoRoot;
  const commands = loadGateCommands({ repoRoot })
    .filter((commandConfig) => shouldRunCommand(commandConfig, changedFiles))
    .map((commandConfig) => ({
      label: commandConfig.label,
      command: commandConfig.command,
      args: expandGateCommandArgs(commandConfig.args, changedFiles),
    }));

  const outputs = [];

  for (const command of commands) {
    const result = run(command.command, command.args, gateCwd);
    outputs.push({ ...command, ...result });
    if (result.status !== 0) {
      return {
        ok: false,
        changedFiles,
        outputs,
      };
    }
  }

  return {
    ok: true,
    changedFiles,
    outputs,
  };
}

function buildGateFeedbackFile(taskId, cycle, gateResult) {
  const feedbackPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-deterministic-gate-')),
    `${taskId}-cycle-${cycle}-gate.txt`,
  );
  const parts = [
    `Deterministic gate failed for ${taskId} cycle ${cycle}.`,
    '',
  ];

  for (const output of gateResult.outputs) {
    parts.push(`$ ${output.command} ${output.args.join(' ')}`);
    if (output.stdout.trim()) {
      parts.push(output.stdout.trim());
    }
    if (output.stderr.trim()) {
      parts.push(output.stderr.trim());
    }
    parts.push('');
  }

  fs.writeFileSync(feedbackPath, `${parts.join('\n').trim()}\n`, 'utf8');
  return feedbackPath;
}

module.exports = {
  buildBackendLintArgs,
  buildFrontendLintArgs,
  buildGateFeedbackFile,
  expandGateCommandArgs,
  loadGateCommands,
  parseChangedFilesFromDiff,
  runDeterministicGate,
};
