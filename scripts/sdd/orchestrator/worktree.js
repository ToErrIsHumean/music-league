'use strict';

const fs = require('fs');
const path = require('path');
const projectConfig = require('../../lib/projectConfig');

const SHARED_NODE_MODULE_PATHS = [
  'node_modules',
  path.join('backend', 'node_modules'),
  path.join('frontend', 'node_modules'),
];

function deriveTaskWorkspace({ taskId, milestone = 'M1' }) {
  const taskSlug = taskId.toLowerCase();
  const branchPrefix = projectConfig.APP_SDD_BRANCH_PREFIX || path.basename(projectConfig.REPO_ROOT);
  return {
    branchName: `${branchPrefix}/${milestone}-${taskSlug}`,
    worktreePath: path.join(projectConfig.APP_SDD_WORKTREE_ROOT_ABS, `${milestone}-${taskSlug}`),
  };
}

function createDefaultWorktreeOps({ run }) {
  const ops = {
    list({ repoRoot }) {
      return run('git', ['worktree', 'list', '--porcelain'], repoRoot);
    },
    prune({ repoRoot }) {
      return run('git', ['worktree', 'prune'], repoRoot);
    },
    branchExists({ repoRoot, branchName }) {
      return run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], repoRoot);
    },
    pathExists({ worktreePath }) {
      return fs.existsSync(worktreePath);
    },
    create({ repoRoot, branchName, worktreePath }) {
      return run('git', ['worktree', 'add', '-b', branchName, worktreePath], repoRoot);
    },
    addExistingBranch({ repoRoot, branchName, worktreePath }) {
      return run('git', ['worktree', 'add', worktreePath, branchName], repoRoot);
    },
    merge({ repoRoot, branchName }) {
      return run('git', ['merge', '--no-ff', branchName], repoRoot);
    },
    remove({ repoRoot, worktreePath }) {
      return run('git', ['worktree', 'remove', worktreePath], repoRoot);
    },
    deleteBranch({ repoRoot, branchName }) {
      return run('git', ['branch', '-d', branchName], repoRoot);
    },
    mergeAndCleanup({ repoRoot, branchName, worktreePath }) {
      const merge = ops.merge({ repoRoot, branchName });
      if (merge.status !== 0 || merge.error) return { merge, remove: null, deleteBranch: null };

      const remove = ops.remove({ repoRoot, worktreePath });
      if (remove.status !== 0 || remove.error) return { merge, remove, deleteBranch: null };

      return {
        merge,
        remove,
        deleteBranch: ops.deleteBranch({ repoRoot, branchName }),
      };
    },
  };

  return ops;
}

function parseGitWorktreeList(output) {
  const entries = [];
  let current = null;

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current) {
        entries.push(current);
        current = null;
      }
      continue;
    }

    if (line.startsWith('worktree ')) {
      if (current) {
        entries.push(current);
      }
      current = {
        worktreePath: line.slice('worktree '.length).trim(),
        branchName: null,
        prunable: false,
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('branch ')) {
      const refName = line.slice('branch '.length).trim();
      current.branchName = refName.startsWith('refs/heads/')
        ? refName.slice('refs/heads/'.length)
        : refName;
    } else if (line.startsWith('prunable')) {
      current.prunable = true;
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function isExpectedWorktreePath(actualPath, expectedPath) {
  return path.resolve(actualPath) === path.resolve(expectedPath);
}

function listGitWorktrees({ repoRoot, worktreeOps }) {
  const listResult = worktreeOps.list({ repoRoot });
  if (listResult.status !== 0) {
    throw new Error(`Failed to inspect git worktrees:\n${listResult.stderr || listResult.stdout}`);
  }

  return parseGitWorktreeList(listResult.stdout);
}

function pruneStaleTaskWorktree({ repoRoot, branchName, worktreePath, worktrees, worktreeOps }) {
  const staleTaskWorktree = worktrees.find((entry) => {
    return entry.prunable
      && (
        isExpectedWorktreePath(entry.worktreePath, worktreePath)
        || entry.branchName === branchName
      );
  });

  if (!staleTaskWorktree) return worktrees;

  const pruneResult = worktreeOps.prune({ repoRoot });
  if (pruneResult.status !== 0) {
    throw new Error(`Failed to prune stale git worktrees:\n${pruneResult.stderr || pruneResult.stdout}`);
  }

  return listGitWorktrees({ repoRoot, worktreeOps });
}

function inspectExistingWorkspace({ repoRoot, branchName, worktreePath, worktreeOps }) {
  let worktrees = listGitWorktrees({ repoRoot, worktreeOps });
  worktrees = pruneStaleTaskWorktree({
    repoRoot,
    branchName,
    worktreePath,
    worktrees,
    worktreeOps,
  });

  const worktreeAtPath = worktrees.find((entry) => isExpectedWorktreePath(entry.worktreePath, worktreePath));

  if (worktreeAtPath && !worktreeAtPath.prunable && worktreeOps.pathExists({ worktreePath })) {
    if (worktreeAtPath.branchName === branchName) {
      return { action: 'reuse' };
    }

    throw new Error(
      `Worktree path already exists for a different branch: ${worktreePath}\n`
      + `Expected branch: ${branchName}\n`
      + `Actual branch: ${worktreeAtPath.branchName || '(detached)'}`,
    );
  }

  const checkedOutBranch = worktrees.find((entry) => entry.branchName === branchName && !entry.prunable);
  if (checkedOutBranch) {
    throw new Error(
      `Branch ${branchName} is already checked out at ${checkedOutBranch.worktreePath}; `
      + `expected ${worktreePath}`,
    );
  }

  const branchExistsResult = worktreeOps.branchExists({ repoRoot, branchName });
  if (branchExistsResult.status === 0) {
    return { action: 'add_existing_branch' };
  }

  if (branchExistsResult.status !== 1) {
    throw new Error(`Failed to inspect branch ${branchName}:\n${branchExistsResult.stderr || branchExistsResult.stdout}`);
  }

  return { action: 'create' };
}

function ensureSharedNodeModulesLink({ repoRoot, worktreePath, relativePath }) {
  const sourcePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const targetPath = path.join(worktreePath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (fs.existsSync(targetPath)) {
    const targetStats = fs.lstatSync(targetPath);
    if (!targetStats.isSymbolicLink()) {
      return;
    }

    const linkedTarget = fs.readlinkSync(targetPath);
    const resolvedTarget = path.resolve(path.dirname(targetPath), linkedTarget);

    if (resolvedTarget === sourcePath) {
      return;
    }

    fs.unlinkSync(targetPath);
  }

  fs.symlinkSync(sourcePath, targetPath, 'dir');
}

function provisionWorktreeTooling({ repoRoot, worktreePath }) {
  for (const relativePath of SHARED_NODE_MODULE_PATHS) {
    ensureSharedNodeModulesLink({ repoRoot, worktreePath, relativePath });
  }
}

function prepareTaskWorkspace({ repoRoot, taskId, milestone, progress, worktreeOps }) {
  const workspace = deriveTaskWorkspace({ taskId, milestone });
  const inspection = inspectExistingWorkspace({
    repoRoot,
    branchName: workspace.branchName,
    worktreePath: workspace.worktreePath,
    worktreeOps,
  });

  if (inspection.action === 'reuse') {
    provisionWorktreeTooling({ repoRoot, worktreePath: workspace.worktreePath });
    progress.emit(`Reusing worktree: ${workspace.worktreePath} (branch: ${workspace.branchName})`);
    return workspace;
  }

  if (inspection.action === 'add_existing_branch') {
    progress.emit(`Adding existing branch to worktree: ${workspace.worktreePath} (branch: ${workspace.branchName})`);
    const addResult = worktreeOps.addExistingBranch({
      repoRoot,
      branchName: workspace.branchName,
      worktreePath: workspace.worktreePath,
    });

    if (addResult.status !== 0) {
      throw new Error(`Failed to add existing worktree for ${taskId}:\n${addResult.stderr || addResult.stdout}`);
    }

    provisionWorktreeTooling({ repoRoot, worktreePath: workspace.worktreePath });
    return workspace;
  }

  progress.emit(`Creating worktree: ${workspace.worktreePath} (branch: ${workspace.branchName})`);
  const createResult = worktreeOps.create({
    repoRoot,
    branchName: workspace.branchName,
    worktreePath: workspace.worktreePath,
  });

  if (createResult.status !== 0) {
    throw new Error(`Failed to create worktree for ${taskId}:\n${createResult.stderr || createResult.stdout}`);
  }

  provisionWorktreeTooling({ repoRoot, worktreePath: workspace.worktreePath });
  return workspace;
}

function finalizeTaskWorkspace({ repoRoot, branchName, worktreePath, worktreeOps }) {
  if (!worktreeOps.merge || !worktreeOps.remove || !worktreeOps.deleteBranch) {
    const results = worktreeOps.mergeAndCleanup({
      repoRoot,
      branchName,
      worktreePath,
    });
    ensureWorktreeStepSucceeded('Merge worktree branch', results.merge);
    ensureWorktreeStepSucceeded('Remove worktree', results.remove);
    ensureWorktreeStepSucceeded('Delete worktree branch', results.deleteBranch);
    return;
  }

  const steps = [
    ['Merge worktree branch', () => worktreeOps.merge({ repoRoot, branchName })],
    ['Remove worktree', () => worktreeOps.remove({ repoRoot, worktreePath })],
    ['Delete worktree branch', () => worktreeOps.deleteBranch({ repoRoot, branchName })],
  ];

  for (const [label, runStep] of steps) {
    const result = runStep();
    ensureWorktreeStepSucceeded(label, result);
  }
}

function ensureWorktreeStepSucceeded(label, result) {
  if (!result || result.status !== 0 || result.error) {
    throw new Error(`${
      label
    } failed (exit ${result ? result.status : 'unknown'}${
      result && result.error ? `, ${result.error.message}` : ''
    }):\n${result ? (result.stderr || result.stdout || '(no output)') : '(no output)'}`);
  }
}

module.exports = {
  createDefaultWorktreeOps,
  deriveTaskWorkspace,
  finalizeTaskWorkspace,
  parseGitWorktreeList,
  prepareTaskWorkspace,
  provisionWorktreeTooling,
};
