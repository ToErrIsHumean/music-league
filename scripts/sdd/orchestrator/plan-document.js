'use strict';

const fs = require('fs');
const path = require('path');

const TASK_TABLE_HEADER = ['Task', 'Title', 'Status', 'Depends-on'];
const SIGNALS_TABLE_HEADER = [
  'Task',
  'Signal',
  'Discovery',
  'Cycle',
  'Model',
  'Reasoning-Effort',
  'Timestamp',
];
const REASONING_TABLE_HEADER = ['Task', 'Reasoning-effort', 'Why'];
const DISPATCHABLE_TASK_STATUSES = new Set(['pending', 'active']);
const REVIEW_NOTE_HEADER = '## Review Notes';
const REVIEW_NOTE_MARKER = '<!-- Orchestrator review notes append below. -->';

function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isDividerRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownTable(lines, startIndex, expectedHeader) {
  const headerCells = splitTableRow(lines[startIndex]);
  if (!headerCells || headerCells.join('\u0000') !== expectedHeader.join('\u0000')) {
    throw new Error(`Expected table header "${expectedHeader.join(' | ')}" at line ${startIndex + 1}`);
  }

  const separatorCells = splitTableRow(lines[startIndex + 1] || '');
  if (!separatorCells || !isDividerRow(separatorCells)) {
    throw new Error(`Missing table separator after line ${startIndex + 1}`);
  }

  const rows = [];
  let endIndex = startIndex + 2;

  while (endIndex < lines.length) {
    const rowCells = splitTableRow(lines[endIndex]);
    if (!rowCells) break;
    rows.push(rowCells);
    endIndex += 1;
  }

  return {
    startIndex,
    endIndex,
    header: headerCells,
    rows,
  };
}

function findTableStart(lines, expectedHeader, startIndex = 0) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const cells = splitTableRow(lines[index]);
    if (cells && cells.join('\u0000') === expectedHeader.join('\u0000')) {
      return index;
    }
  }

  return -1;
}

function cleanCellValue(value) {
  return value.replace(/^`|`$/g, '').trim();
}

function parseDependencies(value) {
  const normalized = cleanCellValue(value);
  if (!normalized || normalized === '—') return [];

  return normalized.split(',').map((dependency) => dependency.trim()).filter(Boolean);
}

function parsePlanDocument(content) {
  const lines = content.split('\n');
  const taskTableStart = findTableStart(lines, TASK_TABLE_HEADER);
  if (taskTableStart === -1) throw new Error('Task table not found in plan document');

  const taskTable = parseMarkdownTable(lines, taskTableStart, TASK_TABLE_HEADER);
  const tasks = taskTable.rows
    .map((cells) => ({
      id: cells[0],
      title: cells[1],
      status: cleanCellValue(cells[2]),
      dependsOn: parseDependencies(cells[3]),
    }))
    .filter((task) => task.id);

  const reasoningTableStart = findTableStart(lines, REASONING_TABLE_HEADER, taskTable.endIndex);
  let reasoningTable = null;
  const reasoningOverrides = new Map();

  if (reasoningTableStart !== -1) {
    reasoningTable = parseMarkdownTable(lines, reasoningTableStart, REASONING_TABLE_HEADER);
    for (const cells of reasoningTable.rows) {
      const taskId = cells[0];
      if (!taskId) continue;
      reasoningOverrides.set(taskId, cleanCellValue(cells[1]));
    }
  }

  const signalsHeadingIndex = lines.findIndex((line) => line.trim() === '## Signals Log');
  if (signalsHeadingIndex === -1) throw new Error('Signals Log section not found in plan document');

  const signalsTableStart = findTableStart(lines, SIGNALS_TABLE_HEADER, signalsHeadingIndex);
  let legacySignals = false;
  let signalsTable;

  if (signalsTableStart !== -1) {
    signalsTable = parseMarkdownTable(lines, signalsTableStart, SIGNALS_TABLE_HEADER);
  } else {
    const legacyHeader = ['Task', 'Signal', 'Discovery', 'Cycle', 'Timestamp'];
    const legacyStart = findTableStart(lines, legacyHeader, signalsHeadingIndex);
    if (legacyStart === -1) throw new Error('Signals table not found in plan document');
    const legacyTable = parseMarkdownTable(lines, legacyStart, legacyHeader);
    legacySignals = true;
    signalsTable = {
      startIndex: legacyTable.startIndex,
      endIndex: legacyTable.endIndex,
      rows: legacyTable.rows.map((cells) => [
        cells[0],
        cells[1],
        cells[2],
        cells[3],
        '',
        '',
        cells[4],
      ]),
    };
  }

  const signals = signalsTable.rows
    .map((cells) => ({
      task: cells[0],
      signal: cleanCellValue(cells[1]),
      discovery: cleanCellValue(cells[2]),
      cycle: Number.parseInt(cleanCellValue(cells[3]) || '0', 10),
      model: cleanCellValue(cells[4]),
      reasoningEffort: cleanCellValue(cells[5]),
      timestamp: cleanCellValue(cells[6]),
    }))
    .filter((row) => row.task);

  const reviewNotesHeadingIndex = lines.findIndex((line) => line.trim() === REVIEW_NOTE_HEADER);

  return {
    lines,
    tasks,
    taskTable,
    reasoningOverrides,
    reasoningTable,
    signals,
    signalsTable,
    signalsHeadingIndex,
    reviewNotesHeadingIndex,
    legacySignals,
  };
}

function renderTable(header, rows, placeholderColumnCount = header.length) {
  const divider = `| ${header.map((column) => '-'.repeat(Math.max(3, column.length))).join(' | ')} |`;
  const renderedRows = rows.length > 0
    ? rows
    : [new Array(placeholderColumnCount).fill('')];

  return [
    `| ${header.join(' | ')} |`,
    divider,
    ...renderedRows.map((cells) => `| ${cells.join(' | ')} |`),
  ];
}

function formatTaskRow(task) {
  return [
    task.id,
    task.title,
    `\`${task.status}\``,
    task.dependsOn.length > 0 ? task.dependsOn.join(', ') : '—',
  ];
}

function formatSignalRow(signal) {
  return [
    signal.task,
    signal.signal,
    signal.discovery || 'null',
    String(signal.cycle),
    signal.model || '',
    signal.reasoningEffort || '',
    signal.timestamp,
  ];
}

function ensureReviewNotes(lines, reviewNotesHeadingIndex) {
  if (reviewNotesHeadingIndex !== -1) return lines;

  const output = lines.slice();
  if (output.length > 0 && output[output.length - 1] !== '') {
    output.push('');
  }
  output.push(REVIEW_NOTE_HEADER, '', REVIEW_NOTE_MARKER, '');
  return output;
}

function appendReviewNoteLines(lines, note) {
  const withSection = ensureReviewNotes(lines, lines.findIndex((line) => line.trim() === REVIEW_NOTE_HEADER));
  const output = withSection.slice();
  const markerIndex = output.findIndex((line) => line.trim() === REVIEW_NOTE_MARKER);
  const insertIndex = markerIndex === -1 ? output.length : markerIndex + 1;

  output.splice(insertIndex, 0, '', note);
  return output;
}

function queueReviewNote(plan, note) {
  plan.reviewNotes = plan.reviewNotes || [];
  plan.reviewNotes.push(note);
}

function serializePlanDocument(plan) {
  let lines = plan.lines.slice();

  const taskTableLines = renderTable(
    TASK_TABLE_HEADER,
    plan.tasks.map(formatTaskRow),
  );
  lines.splice(
    plan.taskTable.startIndex,
    plan.taskTable.endIndex - plan.taskTable.startIndex,
    ...taskTableLines,
  );

  const signalsStart = plan.signalsTable.startIndex + (taskTableLines.length - (plan.taskTable.endIndex - plan.taskTable.startIndex));
  const signalsEnd = plan.signalsTable.endIndex + (taskTableLines.length - (plan.taskTable.endIndex - plan.taskTable.startIndex));
  const signalTableLines = renderTable(
    SIGNALS_TABLE_HEADER,
    plan.signals.map(formatSignalRow),
  );
  lines.splice(
    signalsStart,
    signalsEnd - signalsStart,
    ...signalTableLines,
  );

  if (plan.reviewNotes && plan.reviewNotes.length > 0) {
    for (const note of plan.reviewNotes) {
      lines = appendReviewNoteLines(lines, note);
    }
  }

  return `${lines.join('\n').replace(/\n+$/, '\n')}`;
}

function selectNextTask(tasks) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  for (const task of tasks) {
    if (!DISPATCHABLE_TASK_STATUSES.has(task.status)) continue;

    const dependenciesSatisfied = task.dependsOn.every((dependency) => {
      const dependencyTask = taskMap.get(dependency);
      return dependencyTask && dependencyTask.status === 'done';
    });

    if (dependenciesSatisfied) return task;
  }

  return null;
}

function computeEpoch(signals, taskId) {
  return signals.filter((signal) => signal.task === taskId && signal.signal === 'blocked').length + 1;
}

function computeCycle(signals, taskId) {
  const taskSignals = signals.filter((signal) => signal.task === taskId);
  if (taskSignals.length === 0) return 1;

  let lastBlockedIndex = -1;
  for (let index = taskSignals.length - 1; index >= 0; index -= 1) {
    if (taskSignals[index].signal === 'blocked') {
      lastBlockedIndex = index;
      break;
    }
  }

  return taskSignals.length - (lastBlockedIndex + 1) + 1;
}

function appendSignal(plan, signal) {
  plan.signals.push(signal);
}

function writePlan(planPath, plan) {
  fs.writeFileSync(planPath, serializePlanDocument(plan), 'utf8');
}

function addReviewNote(plan, repoRoot, taskId, cycle, verdictPath, verdict) {
  const relativeVerdictPath = verdictPath.startsWith(repoRoot)
    ? path.relative(repoRoot, verdictPath)
    : verdictPath;

  queueReviewNote(plan, `- ${taskId} cycle ${cycle}: \`${verdict}\` -> \`${relativeVerdictPath}\``);
}

module.exports = {
  REASONING_TABLE_HEADER,
  REVIEW_NOTE_HEADER,
  REVIEW_NOTE_MARKER,
  SIGNALS_TABLE_HEADER,
  TASK_TABLE_HEADER,
  addReviewNote,
  appendSignal,
  appendReviewNoteLines,
  computeCycle,
  computeEpoch,
  parsePlanDocument,
  queueReviewNote,
  selectNextTask,
  serializePlanDocument,
  writePlan,
};
