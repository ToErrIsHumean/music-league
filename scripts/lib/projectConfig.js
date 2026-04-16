'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_CONFIG_KEYS = [
  'APP_DEPLOY_ROOT',
  'APP_FRONTEND_DIST',
  'APP_DB_PATH',
  'APP_BACKUP_DIR',
  'APP_BACKUP_LOG',
  'APP_BACKUP_RETENTION_DAYS',
  'APP_NGINX_SERVER_NAME',
  'APP_BACKEND_PROXY_URL',
  'APP_PM_GUIDANCE_PATH',
  'APP_PM_PROCESS_PATH',
  'APP_PM_PROMPTS_DIR',
  'APP_PM_STATE_DIR',
  'APP_SDD_WORKTREE_ROOT',
  'APP_SDD_DOCS_DIR',
  'APP_SDD_BRANCH_PREFIX',
  'APP_SDD_GATE_CONFIG_PATH',
  'APP_CODEX_BIN',
  'APP_CLAUDE_BIN',
  'APP_CLINE_BIN',
];

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_CONFIG_DIR = path.join(DEFAULT_REPO_ROOT, 'config');

function parseEnvFile(filePath) {
  const values = {};

  if (!fs.existsSync(filePath)) {
    return values;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function resolveRepoPath(repoRoot, inputPath) {
  if (!inputPath) {
    return inputPath;
  }

  return path.isAbsolute(inputPath)
    ? path.normalize(inputPath)
    : path.resolve(repoRoot, inputPath);
}

function resolveDeployPath(deployRoot, inputPath) {
  if (!inputPath) {
    return inputPath;
  }

  return path.isAbsolute(inputPath)
    ? path.normalize(inputPath)
    : path.resolve(deployRoot, inputPath);
}

function toRepoRelative(repoRoot, inputPath) {
  if (!inputPath) {
    return inputPath;
  }

  if (!path.isAbsolute(inputPath)) {
    return inputPath.replace(/\\/g, '/');
  }

  const relativePath = path.relative(repoRoot, inputPath);
  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath.replace(/\\/g, '/');
  }

  return path.normalize(inputPath);
}

function loadProjectConfig(env = process.env, options = {}) {
  const repoRoot = path.resolve(
    options.repoRoot
      || env.PROJECT_CONFIG_REPO_ROOT_OVERRIDE
      || DEFAULT_REPO_ROOT,
  );
  const configDir = path.resolve(
    options.configDir
      || env.PROJECT_CONFIG_DIR_OVERRIDE
      || path.join(repoRoot, 'config'),
  );

  const defaultsPath = path.join(configDir, 'project.defaults.env');
  const localPath = path.join(configDir, 'project.local.env');

  const merged = {
    ...parseEnvFile(defaultsPath),
    ...parseEnvFile(localPath),
  };

  for (const key of PROJECT_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(env, key) && env[key] !== undefined) {
      merged[key] = env[key];
    }
  }

  const deployRootAbs = resolveRepoPath(repoRoot, merged.APP_DEPLOY_ROOT);
  const frontendDistAbs = resolveRepoPath(repoRoot, merged.APP_FRONTEND_DIST);
  const dbPathAbs = resolveRepoPath(repoRoot, merged.APP_DB_PATH);
  const backupDirAbs = resolveRepoPath(repoRoot, merged.APP_BACKUP_DIR);
  const backupLogAbs = resolveRepoPath(repoRoot, merged.APP_BACKUP_LOG);
  const pmGuidancePathAbs = resolveRepoPath(repoRoot, merged.APP_PM_GUIDANCE_PATH);
  const pmProcessPathAbs = resolveRepoPath(repoRoot, merged.APP_PM_PROCESS_PATH);
  const pmPromptsDirAbs = resolveRepoPath(repoRoot, merged.APP_PM_PROMPTS_DIR);
  const pmStateDirAbs = resolveRepoPath(repoRoot, merged.APP_PM_STATE_DIR);
  const sddDocsDirAbs = resolveRepoPath(repoRoot, merged.APP_SDD_DOCS_DIR);
  const sddWorktreeRootAbs = resolveRepoPath(repoRoot, merged.APP_SDD_WORKTREE_ROOT);
  const sddGateConfigPathAbs = resolveRepoPath(repoRoot, merged.APP_SDD_GATE_CONFIG_PATH);

  return {
    ...merged,
    REPO_ROOT: repoRoot,
    CONFIG_DIR: configDir,
    PROJECT_DEFAULTS_PATH: defaultsPath,
    PROJECT_LOCAL_PATH: localPath,
    APP_DEPLOY_ROOT_ABS: deployRootAbs,
    APP_FRONTEND_DIST_ABS: frontendDistAbs,
    APP_DEPLOY_FRONTEND_DIST: resolveDeployPath(deployRootAbs, merged.APP_FRONTEND_DIST),
    APP_DB_PATH_ABS: dbPathAbs,
    APP_DEPLOY_DB_PATH: resolveDeployPath(deployRootAbs, merged.APP_DB_PATH),
    APP_BACKUP_DIR_ABS: backupDirAbs,
    APP_BACKUP_LOG_ABS: backupLogAbs,
    APP_PM_GUIDANCE_PATH_ABS: pmGuidancePathAbs,
    APP_PM_GUIDANCE_PATH_REL: toRepoRelative(repoRoot, pmGuidancePathAbs),
    APP_PM_PROCESS_PATH_ABS: pmProcessPathAbs,
    APP_PM_PROCESS_PATH_REL: toRepoRelative(repoRoot, pmProcessPathAbs),
    APP_PM_PROMPTS_DIR_ABS: pmPromptsDirAbs,
    APP_PM_PROMPTS_DIR_REL: toRepoRelative(repoRoot, pmPromptsDirAbs),
    APP_PM_STATE_DIR_ABS: pmStateDirAbs,
    APP_PM_STATE_DIR_REL: toRepoRelative(repoRoot, pmStateDirAbs),
    APP_SDD_WORKTREE_ROOT_ABS: sddWorktreeRootAbs,
    APP_SDD_DOCS_DIR_ABS: sddDocsDirAbs,
    APP_SDD_DOCS_DIR_REL: toRepoRelative(repoRoot, sddDocsDirAbs),
    APP_SDD_GATE_CONFIG_PATH_ABS: sddGateConfigPathAbs,
    APP_SDD_GATE_CONFIG_PATH_REL: toRepoRelative(repoRoot, sddGateConfigPathAbs),
  };
}

const activeConfig = loadProjectConfig();

module.exports = {
  PROJECT_CONFIG_KEYS,
  DEFAULT_REPO_ROOT,
  DEFAULT_CONFIG_DIR,
  parseEnvFile,
  resolveRepoPath,
  resolveDeployPath,
  toRepoRelative,
  loadProjectConfig,
  ...activeConfig,
};
