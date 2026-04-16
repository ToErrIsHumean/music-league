'use strict';

const path = require('path');

function normalizeMilestone(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^M?0*([1-9][0-9]*)$/i);
  if (match) {
    return `M${Number(match[1])}`;
  }

  return trimmed;
}

function deriveMilestoneFromPath(inputPath) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) return null;

  const basename = path.basename(inputPath);
  const match = basename.match(/\b(?:SPEC|PLAN)-0*([1-9][0-9]*)\b/i);
  if (!match) return null;

  return `M${Number(match[1])}`;
}

function resolveMilestoneLabel({
  milestone,
  envMilestone,
  specPath,
  planPath,
  fallback = 'M1',
} = {}) {
  return (
    normalizeMilestone(milestone)
    || normalizeMilestone(envMilestone)
    || deriveMilestoneFromPath(specPath)
    || deriveMilestoneFromPath(planPath)
    || fallback
  );
}

module.exports = {
  deriveMilestoneFromPath,
  normalizeMilestone,
  resolveMilestoneLabel,
};
