'use strict';

const SUMMARY_LABELS = Object.freeze({
  selectedTask: 'Selected task:',
  cycle: 'Cycle:',
  verdict: 'Outcome:',
  gracefulStopRequested: 'Graceful stop requested:',
  stoppedAfter: 'Stopped after:',
  nextCommand: 'Next command:',
  humanGate: 'Human gate required:',
});

function createSummary({
  taskId,
  cycle,
  verdict,
  humanGate,
  gracefulStopRequested,
  stoppedAfter,
  nextCommand,
  note,
}) {
  const lines = [];

  if (taskId) {
    lines.push(`${SUMMARY_LABELS.selectedTask} ${taskId}`);
    lines.push(`${SUMMARY_LABELS.cycle} ${cycle}`);
  } else {
    lines.push(`${SUMMARY_LABELS.selectedTask} none`);
  }

  if (verdict) {
    lines.push(`${SUMMARY_LABELS.verdict} ${verdict}`);
  }

  if (note) {
    lines.push(note);
  }

  lines.push(`${SUMMARY_LABELS.gracefulStopRequested} ${gracefulStopRequested ? 'yes' : 'no'}`);

  if (gracefulStopRequested && stoppedAfter) {
    lines.push(`${SUMMARY_LABELS.stoppedAfter} ${stoppedAfter}`);
  }

  if (nextCommand) {
    lines.push(`${SUMMARY_LABELS.nextCommand} ${nextCommand}`);
  }

  lines.push(`${SUMMARY_LABELS.humanGate} ${humanGate ? 'yes' : 'no'}`);
  return `${lines.join('\n')}\n`;
}

function parseSummary(summaryText) {
  const lines = summaryText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const summary = {
    selectedTask: null,
    cycle: null,
    verdict: null,
    humanGate: false,
    gracefulStopRequested: false,
    stoppedAfter: null,
    nextCommand: null,
  };

  for (const line of lines) {
    if (line.startsWith(SUMMARY_LABELS.selectedTask)) {
      const value = line.slice(SUMMARY_LABELS.selectedTask.length).trim();
      summary.selectedTask = value === 'none' ? null : value;
      continue;
    }

    if (line.startsWith(SUMMARY_LABELS.cycle)) {
      summary.cycle = Number(line.slice(SUMMARY_LABELS.cycle.length).trim());
      continue;
    }

    if (line.startsWith(SUMMARY_LABELS.verdict)) {
      summary.verdict = line.slice(SUMMARY_LABELS.verdict.length).trim();
      continue;
    }

    if (line.startsWith(SUMMARY_LABELS.gracefulStopRequested)) {
      summary.gracefulStopRequested = line.slice(SUMMARY_LABELS.gracefulStopRequested.length).trim() === 'yes';
      continue;
    }

    if (line.startsWith(SUMMARY_LABELS.stoppedAfter)) {
      summary.stoppedAfter = line.slice(SUMMARY_LABELS.stoppedAfter.length).trim() || null;
      continue;
    }

    if (line.startsWith(SUMMARY_LABELS.nextCommand)) {
      summary.nextCommand = line.slice(SUMMARY_LABELS.nextCommand.length).trim() || null;
      continue;
    }

    if (line.startsWith(SUMMARY_LABELS.humanGate)) {
      summary.humanGate = line.slice(SUMMARY_LABELS.humanGate.length).trim() === 'yes';
    }
  }

  return summary;
}

module.exports = {
  SUMMARY_LABELS,
  createSummary,
  parseSummary,
};
