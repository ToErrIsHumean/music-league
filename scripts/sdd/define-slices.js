#!/usr/bin/env node
'use strict';

/**
 * define-slices.js
 *
 * Derives Appendix E.4 slice definition blocks from a spec's §6 Task
 * Decomposition section and dependency graph.
 *
 * Usage:
 *   node scripts/sdd/define-slices.js <spec-file> [--stdout] [--write]
 *
 * Examples:
 *   node scripts/sdd/define-slices.js docs/specs/SPEC-001-core-data-model.md
 *   node scripts/sdd/define-slices.js docs/specs/SPEC-001-core-data-model.md --write
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_APPENDIX_TEMPLATE_PATHS = [
  path.resolve(__dirname, '../../docs/templates/SPEC-Appendix-E-template.md'),
  path.resolve(__dirname, '../../docs/specs/templates/SPEC-Appendix-E-template.md'),
];

function parseArgs(argv) {
  const options = {
    specPath: null,
    stdout: false,
    write: false,
  };

  for (const argument of argv) {
    if (argument === '--stdout') {
      options.stdout = true;
      continue;
    }

    if (argument === '--write') {
      options.write = true;
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      printUsage();
      process.exit(0);
    }

    if (argument.startsWith('--')) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    if (options.specPath) {
      throw new Error(`Unexpected extra argument: ${argument}`);
    }

    options.specPath = argument;
  }

  if (!options.specPath) {
    printUsage();
    process.exit(1);
  }

  if (!options.stdout && !options.write) {
    options.stdout = true;
  }

  return options;
}

function printUsage() {
  console.error('Usage: node scripts/sdd/define-slices.js <spec-file> [--stdout] [--write]');
}

function extractTaskDecompositionSection(specText) {
  const headerMatch = specText.match(/^## 6(?: ?\.)?.*$/m);
  if (!headerMatch || headerMatch.index == null) {
    throw new Error('Task Decomposition section not found');
  }

  const sectionStart = headerMatch.index;
  const remainder = specText.slice(sectionStart);
  const nextH2Offset = remainder.slice(headerMatch[0].length).search(/^## /m);

  return nextH2Offset === -1
    ? remainder
    : remainder.slice(0, nextH2Offset + headerMatch[0].length);
}

function parseTaskEntries(sectionText) {
  const entryRe = /(?:^|\n)(\d+\.\s+\*\*\[(TASK-[\w]+)\][\s\S]*?)(?=\n\d+\.\s+\*\*\[TASK-|\n###\s|\n##\s|$)/g;
  const tasks = [];
  let match;

  while ((match = entryRe.exec(sectionText)) !== null) {
    const entryText = match[1].trim();
    const headerMatch = entryText.match(/^\d+\.\s+\*\*\[(TASK-[\w]+)\]\s+(.+?)\*\*\s+—/s);

    if (!headerMatch) {
      throw new Error(`Unable to parse task header from entry:\n${entryText}`);
    }

    const taskId = headerMatch[1];
    const label = headerMatch[2].replace(/\s+/g, ' ').trim();
    const contractsMatch = entryText.match(/`contracts:\s*([^`]+?)`/);
    const validatesMatch = entryText.match(/`validates:\s*([^`]+?)`/);

    tasks.push({
      taskId,
      label,
      contractRefs: parseContractRefs(contractsMatch ? contractsMatch[1] : '—'),
      acceptanceCriteria: parseAcceptanceCriteria(validatesMatch ? validatesMatch[1] : '—'),
    });
  }

  if (!tasks.length) {
    throw new Error('No task entries found in Task Decomposition section');
  }

  return tasks;
}

function parseDependencyGraph(sectionText) {
  const graphHeading = sectionText.match(/^### Dependency Graph$/m);
  if (!graphHeading || graphHeading.index == null) {
    throw new Error('Dependency Graph section not found');
  }

  const graphText = sectionText.slice(graphHeading.index);
  const dependencyMap = new Map();
  const lines = graphText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '```' || trimmed === '---') continue;

    const adjacencyMatch = trimmed.match(/^(TASK-[\w]+):\s*(.*)$/);
    if (adjacencyMatch) {
      const taskId = adjacencyMatch[1];
      const rawDependencies = adjacencyMatch[2].trim();
      const dependsOn = rawDependencies
        ? rawDependencies.split(',').map((dependency) => dependency.trim()).filter(Boolean)
        : [];

      dependencyMap.set(taskId, dependsOn);
      continue;
    }

    const edgeMatch = trimmed.match(
      /^(TASK-[\w]+(?:\s*\+\s*TASK-[\w]+)*)\s*(?:->|[-─\s]*►)\s*(TASK-[\w]+)(?:\s|$)/
    );

    if (!edgeMatch) continue;

    const upstreamTasks = edgeMatch[1].split(/\s*\+\s*/).map((taskId) => taskId.trim()).filter(Boolean);
    const downstreamTask = edgeMatch[2];
    const existingDependencies = dependencyMap.get(downstreamTask) || [];

    for (const upstreamTask of upstreamTasks) {
      if (!existingDependencies.includes(upstreamTask)) {
        existingDependencies.push(upstreamTask);
      }
    }

    dependencyMap.set(downstreamTask, existingDependencies);
  }

  if (!dependencyMap.size) {
    throw new Error('No dependency graph entries found');
  }

  return dependencyMap;
}

function parseContractRefs(value) {
  if (isNoneToken(value)) return [];
  return compactSectionRefs(extractOrderedMatches(value, /§4e|§4[abcd]-\d+/g));
}

function parseAcceptanceCriteria(value) {
  if (isNoneToken(value)) return [];

  const numbers = extractOrderedMatches(value, /AC-(\d+)/g, 1)
    .map((raw) => Number(raw));

  return compactAcceptanceCriteria(numbers);
}

function extractOrderedMatches(value, regex, captureGroup = 0) {
  const matches = [];
  const seen = new Set();
  let match;

  while ((match = regex.exec(value)) !== null) {
    const extracted = match[captureGroup];
    if (seen.has(extracted)) continue;
    seen.add(extracted);
    matches.push(extracted);
  }

  regex.lastIndex = 0;
  return matches;
}

function compactSectionRefs(refs) {
  const tokens = [];
  let index = 0;

  while (index < refs.length) {
    const current = refs[index];

    if (current === '§4e') {
      tokens.push(current);
      index += 1;
      continue;
    }

    const parts = current.match(/^(§4[abcd])-(\d+)$/);
    if (!parts) {
      tokens.push(current);
      index += 1;
      continue;
    }

    const prefix = parts[1];
    let start = Number(parts[2]);
    let end = start;
    let cursor = index + 1;

    while (cursor < refs.length) {
      const nextParts = refs[cursor].match(/^(§4[abcd])-(\d+)$/);
      if (!nextParts) break;
      if (nextParts[1] !== prefix) break;

      const nextNumber = Number(nextParts[2]);
      if (nextNumber !== end + 1) break;

      end = nextNumber;
      cursor += 1;
    }

    tokens.push(start === end ? `${prefix}-${start}` : `${prefix}-${start}:${end}`);
    index = cursor;
  }

  return tokens;
}

function compactAcceptanceCriteria(numbers) {
  const tokens = [];
  let index = 0;

  while (index < numbers.length) {
    const start = numbers[index];
    let end = start;
    let cursor = index + 1;

    while (cursor < numbers.length && numbers[cursor] === end + 1) {
      end = numbers[cursor];
      cursor += 1;
    }

    if (start === end) {
      tokens.push(`§5:AC-${formatAcNumber(start)}`);
    } else {
      tokens.push(`§5:AC-${formatAcNumber(start)}:${formatAcNumber(end)}`);
    }

    index = cursor;
  }

  return tokens;
}

function formatAcNumber(number) {
  return String(number).padStart(2, '0');
}

function isNoneToken(value) {
  const normalized = value.trim();
  return normalized === '—' || normalized.toLowerCase() === '(none)' || normalized.toLowerCase() === 'none';
}

function buildSliceDefinitions(specText) {
  const taskSection = extractTaskDecompositionSection(specText);
  const tasks = parseTaskEntries(taskSection);
  const dependencyMap = parseDependencyGraph(taskSection);

  return tasks.map((task) => {
    const dependsOn = dependencyMap.has(task.taskId)
      ? dependencyMap.get(task.taskId)
      : [];

    const sections = [
      ...task.contractRefs,
      ...task.acceptanceCriteria,
      `§6:${task.taskId}`,
    ];

    return [
      `<!-- SLICE:${task.taskId} -->`,
      `TASK:     ${task.taskId}`,
      `LABEL:    ${task.label}`,
      `DEPENDS:  ${dependsOn.length ? dependsOn.join(', ') : '(none)'}`,
      `SECTIONS:`,
      ...sections,
      `<!-- /SLICE:${task.taskId} -->`,
    ].join('\n');
  }).join('\n\n');
}

function normalizeEol(text, eol) {
  return text.replace(/\r?\n/g, eol);
}

function resolveAppendixTemplatePath() {
  const configuredPath = process.env.SDD_APPENDIX_E_TEMPLATE_PATH;
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  const existingDefault = DEFAULT_APPENDIX_TEMPLATE_PATHS.find((candidatePath) => fs.existsSync(candidatePath));
  return existingDefault || DEFAULT_APPENDIX_TEMPLATE_PATHS[0];
}

function loadAppendixTemplate() {
  const templatePath = resolveAppendixTemplatePath();

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Appendix E template not found at ${templatePath}. ` +
      'Set SDD_APPENDIX_E_TEMPLATE_PATH to override the default template location.'
    );
  }

  return fs.readFileSync(templatePath, 'utf8');
}

function ensureAppendixScaffold(specText, specPath) {
  if (/^### E\.4 Slice definitions$/m.test(specText)) {
    return specText;
  }

  if (/^## Appendix E: Context Slices$/m.test(specText)) {
    throw new Error(
      `Appendix E exists in ${path.basename(specPath)} but the E.4 slice scaffold is missing. ` +
      'Repair the appendix manually or replace it with the canonical template before using --write.'
    );
  }

  const eol = specText.includes('\r\n') ? '\r\n' : '\n';
  const templateText = normalizeEol(loadAppendixTemplate().trim(), eol);
  const endSpecRe = /<!-- END SPEC -->\s*$/;

  if (endSpecRe.test(specText)) {
    return specText.replace(endSpecRe, `${templateText}${eol}`);
  }

  const trimmedSpec = specText.trimEnd();
  return `${trimmedSpec}${eol}${eol}${templateText}${eol}`;
}

function replaceSliceDefinitions(specText, sliceDefinitions, specPath) {
  const eol = specText.includes('\r\n') ? '\r\n' : '\n';
  const blockRe = /(### E\.4 Slice definitions\s*\n)([\s\S]*?)(?=\n(?:### |\## |<!-- END SPEC -->))/;

  if (!blockRe.test(specText)) {
    throw new Error(
      `Appendix E.4 scaffold not found in ${path.basename(specPath)}. ` +
      'Use --stdout to print generated blocks or add the Appendix E scaffold before --write.'
    );
  }

  return specText.replace(blockRe, (_, heading) => {
    const normalizedHeading = heading.replace(/\n/g, eol);
    const normalizedDefinitions = sliceDefinitions.replace(/\n/g, eol);
    return `${normalizedHeading}${eol}${normalizedDefinitions}${eol}`;
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const specText = fs.readFileSync(options.specPath, 'utf8');
  const sliceDefinitions = buildSliceDefinitions(specText);

  if (options.stdout) {
    process.stdout.write(`${sliceDefinitions}\n`);
  }

  if (options.write) {
    const specWithAppendix = ensureAppendixScaffold(specText, options.specPath);
    const updatedSpecText = replaceSliceDefinitions(specWithAppendix, sliceDefinitions, options.specPath);
    fs.writeFileSync(options.specPath, updatedSpecText);
    console.error(`✓ Updated Appendix E.4 in ${options.specPath}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
