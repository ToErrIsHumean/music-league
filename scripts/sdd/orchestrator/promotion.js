'use strict';

const path = require('path');

function ensureCommandSucceeded(result, label) {
  if (result.status !== 0 || result.error) {
    throw new Error(`${
      label
    } failed (exit ${result.status}${
      result.error ? `, ${result.error.message}` : ''
    }):\n${result.stderr || result.stdout || '(no output)'}`);
  }
}

function parsePorcelainStatusPaths(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const statusPath = line.slice(3).trim();
      const renameSeparator = ' -> ';
      if (statusPath.includes(renameSeparator)) {
        return statusPath.slice(statusPath.lastIndexOf(renameSeparator) + renameSeparator.length);
      }
      return statusPath;
    });
}

function listChangedPaths({ cwd, run }) {
  const statusResult = run('git', ['status', '--porcelain'], cwd);
  ensureCommandSucceeded(statusResult, `Inspect git status in ${cwd}`);
  return parsePorcelainStatusPaths(statusResult.stdout);
}

function commitImplementationChanges({ worktreePath, taskId, taskTitle, run }) {
  const changedPaths = listChangedPaths({ cwd: worktreePath, run });
  if (changedPaths.length === 0) {
    return { committed: false, changedPaths };
  }

  const addResult = run('git', ['add', '--all'], worktreePath);
  ensureCommandSucceeded(addResult, `Stage implementation changes for ${taskId}`);

  const commitResult = run('git', ['commit', '-m', `${taskId}: ${taskTitle}`], worktreePath);
  ensureCommandSucceeded(commitResult, `Commit implementation changes for ${taskId}`);

  return { committed: true, changedPaths };
}

function listBranchChangedPaths({ repoRoot, branchName, run }) {
  const diffResult = run('git', ['diff', '--name-only', `HEAD...${branchName}`], repoRoot);
  ensureCommandSucceeded(diffResult, `Inspect promoted branch changes for ${branchName}`);
  return diffResult.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function assertRepoChangesDoNotOverlapBranch({ repoRoot, branchName, run }) {
  const repoChangedPaths = listChangedPaths({ cwd: repoRoot, run });
  if (repoChangedPaths.length === 0) {
    return { repoChangedPaths, branchChangedPaths: [] };
  }

  const branchChangedPaths = listBranchChangedPaths({ repoRoot, branchName, run });
  const branchChangedPathSet = new Set(branchChangedPaths);
  const overlappingPaths = repoChangedPaths.filter((repoChangedPath) => branchChangedPathSet.has(repoChangedPath));

  if (overlappingPaths.length > 0) {
    throw new Error(
      `Cannot merge ${branchName}; repo-root changes overlap with branch changes:\n`
      + overlappingPaths.map((changedPath) => `- ${changedPath}`).join('\n'),
    );
  }

  return { repoChangedPaths, branchChangedPaths };
}

function mergeImplementationBranch({ repoRoot, branchName, run }) {
  assertRepoChangesDoNotOverlapBranch({ repoRoot, branchName, run });

  const mergeResult = run('git', ['merge', '--no-ff', branchName], repoRoot);
  ensureCommandSucceeded(mergeResult, `Merge ${branchName}`);
}

function commitOperationalState({ repoRoot, taskId, planPath, run }) {
  const relativePlanPath = path.relative(repoRoot, planPath);
  const addResult = run('git', ['add', '--', relativePlanPath], repoRoot);
  ensureCommandSucceeded(addResult, `Stage orchestration state for ${taskId}`);

  const diffResult = run('git', ['diff', '--cached', '--quiet', '--', relativePlanPath], repoRoot);
  if (diffResult.status === 0) {
    return { committed: false };
  }

  if (diffResult.status !== 1 || diffResult.error) {
    ensureCommandSucceeded(diffResult, `Inspect staged orchestration state for ${taskId}`);
  }

  const commitResult = run('git', ['commit', '-m', `${taskId}: record orchestration state`], repoRoot);
  ensureCommandSucceeded(commitResult, `Commit orchestration state for ${taskId}`);

  return { committed: true };
}

function cleanupPromotedWorkspace({ repoRoot, branchName, worktreePath, run }) {
  const removeResult = run('git', ['worktree', 'remove', worktreePath], repoRoot);
  ensureCommandSucceeded(removeResult, `Remove worktree ${worktreePath}`);

  const deleteBranchResult = run('git', ['branch', '-d', branchName], repoRoot);
  ensureCommandSucceeded(deleteBranchResult, `Delete branch ${branchName}`);
}

function promoteReviewedWorkspace({
  repoRoot,
  worktreePath,
  branchName,
  taskId,
  taskTitle,
  planPath,
  run,
  writeOperationalState = null,
}) {
  const implementationCommit = commitImplementationChanges({
    worktreePath,
    taskId,
    taskTitle,
    run,
  });

  mergeImplementationBranch({
    repoRoot,
    branchName,
    run,
  });

  if (typeof writeOperationalState === 'function') {
    writeOperationalState();
  }

  const operationalCommit = commitOperationalState({
    repoRoot,
    taskId,
    planPath,
    run,
  });

  cleanupPromotedWorkspace({
    repoRoot,
    branchName,
    worktreePath,
    run,
  });

  return {
    implementationCommit,
    operationalCommit,
  };
}

module.exports = {
  assertRepoChangesDoNotOverlapBranch,
  cleanupPromotedWorkspace,
  commitImplementationChanges,
  commitOperationalState,
  ensureCommandSucceeded,
  listChangedPaths,
  mergeImplementationBranch,
  parsePorcelainStatusPaths,
  promoteReviewedWorkspace,
};
