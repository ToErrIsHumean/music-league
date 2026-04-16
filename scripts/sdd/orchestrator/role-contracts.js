'use strict';

const path = require('path');

const REVIEWER_VERDICT_RE = /\*\*Verdict:\*\*\s*`?(confirmed|contested|deferred)`?/;
const IMPLEMENTER_PROBLEMS_PREFIX = 'Problems:';
const IMPLEMENTER_WORKAROUND_PREFIX = 'Workaround:';
const IMPLEMENTER_PRE_SATISFIED_ACS_PREFIX = 'Pre-satisfied ACs:';
const NO_ABNORMALITIES = 'no abnormalities';
const NO_PRE_SATISFIED_ACS = 'none';
const REVIEWER_PRE_SATISFIED_ACS_INSTRUCTION_PREFIX = 'acceptance criteria already satisfied by existing code; diff may not reflect acceptance criteria. if no diff exists for an AC, use existing codebase to validate these ACs: ';
const LLM_FALLBACK_MODEL_LABEL = 'llm-fallback';
const CLASSIFY_MODEL = 'claude-haiku-4-5-20251001';
const CLASSIFY_MAX_OUTPUT_CHARS = 10000;

function resolveReasoningEffort({
  explicitReasoningEffort,
  reasoningEffort,
  overrides,
  taskId,
}) {
  if (explicitReasoningEffort) {
    return reasoningEffort;
  }

  return overrides.get(taskId) || reasoningEffort || 'high';
}

function stripAnsi(value) {
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 27 && value[index + 1] === '[') {
      index += 2;

      while (index < value.length) {
        const code = value.charCodeAt(index);
        const isDigit = code >= 48 && code <= 57;
        if (!isDigit && value[index] !== ';') break;
        index += 1;
      }

      if (index < value.length && value[index] === 'm') {
        continue;
      }

      index -= 1;
      continue;
    }

    result += value[index];
  }

  return result;
}

function normalizeSignalField(value) {
  return stripAnsi(value).trim().replace(/^`|`$/g, '').trim();
}

function parseSignalCandidate(line) {
  const normalizedLine = normalizeSignalField(line);
  if (!normalizedLine.includes('|')) return null;

  const fields = normalizedLine.split('|').map(normalizeSignalField);
  if (fields.length !== 5) return null;

  const [task, signal, discovery, model, reasoningEffort] = fields;
  if (!/^TASK-[0-9A-Za-z]+$/.test(task)) return null;
  if (!/^(pass|fail|blocked)$/.test(signal)) return null;
  if (!/^(null|D-[0-9]+)$/.test(discovery)) return null;
  if (!model) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(reasoningEffort)) return null;

  return {
    task,
    signal,
    discovery,
    model,
    reasoningEffort,
  };
}

function parseImplementerReportLine(line, prefix) {
  const normalized = stripAnsi(line).trim();
  if (!normalized.startsWith(prefix)) return null;
  const value = normalized.slice(prefix.length).trim();
  return value || NO_ABNORMALITIES;
}

function parsePreSatisfiedAcsLine(line) {
  const normalized = stripAnsi(line).trim();
  if (!normalized.startsWith(IMPLEMENTER_PRE_SATISFIED_ACS_PREFIX)) return null;
  const value = normalized.slice(IMPLEMENTER_PRE_SATISFIED_ACS_PREFIX.length).trim();

  if (!value || value.toLowerCase() === NO_PRE_SATISFIED_ACS) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseImplementerReport(stdout, taskId) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => stripAnsi(line).trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const signal = parseSignalCandidate(lines[index]);
    if (signal) {
      if (signal.task !== taskId) {
        throw new Error(`Implementer emitted signal for ${signal.task} while ${taskId} was expected`);
      }

      const report = {
        signal,
        problems: NO_ABNORMALITIES,
        workaround: NO_ABNORMALITIES,
        preSatisfiedAcs: [],
      };

      const closingBlockStart = Math.max(0, index - 4);
      for (let cursor = closingBlockStart; cursor < index; cursor += 1) {
        const line = lines[cursor];
        const problems = parseImplementerReportLine(line, IMPLEMENTER_PROBLEMS_PREFIX);
        if (problems) {
          report.problems = problems;
          continue;
        }

        const workaround = parseImplementerReportLine(line, IMPLEMENTER_WORKAROUND_PREFIX);
        if (workaround) {
          report.workaround = workaround;
          continue;
        }

        const preSatisfiedAcs = parsePreSatisfiedAcsLine(line);
        if (preSatisfiedAcs) {
          report.preSatisfiedAcs = preSatisfiedAcs;
        }
      }

      return report;
    }
  }

  const lastLine = lines.length > 0 ? ` Last non-empty stdout line: ${JSON.stringify(lines[lines.length - 1])}` : ' Stdout was empty.';
  throw new Error(`No valid Implementer signal found for ${taskId}.${lastLine}`);
}

function truncateOutput(lines, maxChars) {
  let output = lines.join('\n');
  if (output.length <= maxChars) return output;
  output = output.slice(-maxChars);
  const newlineIndex = output.indexOf('\n');
  if (newlineIndex !== -1) {
    output = output.slice(newlineIndex + 1);
  }
  return `[...truncated...]\n${output}`;
}

function formatClassifierError(error) {
  if (!error) return 'unknown error';

  const parts = [];
  if (error.name) parts.push(error.name);
  if (error.status) parts.push(`status ${error.status}`);

  if (typeof error.message === 'string' && error.message.trim()) {
    parts.push(error.message.trim().replace(/\s+/g, ' '));
  }

  return parts.length > 0 ? parts.join(': ') : String(error);
}

function logClassifierEvent(log, taskId, message) {
  if (typeof log !== 'function') return;
  log(`LLM classifier ${taskId}: ${message}`);
}

async function classifyImplementerOutputWithLLM(lines, taskId, { log } = {}) {
  const truncatedOutput = truncateOutput(lines, CLASSIFY_MAX_OUTPUT_CHARS);
  logClassifierEvent(log, taskId, `fallback invoked with ${lines.length} non-empty stdout line(s).`);
  logClassifierEvent(log, taskId, `truncatedOutput:\n${truncatedOutput}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    logClassifierEvent(log, taskId, 'ANTHROPIC_API_KEY is not set; skipping Anthropic request.');
    return {
      signal: { task: taskId, signal: 'blocked', discovery: 'null', model: LLM_FALLBACK_MODEL_LABEL, reasoningEffort: 'unknown' },
      problems: 'LLM classification request failed: ANTHROPIC_API_KEY is not set',
      workaround: NO_ABNORMALITIES,
      preSatisfiedAcs: [],
    };
  }

  let client;
  try {
    const sdkPath = path.join(__dirname, '..', '..', '..', 'backend', 'node_modules', '@anthropic-ai', 'sdk');
    const Anthropic = require(sdkPath);
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (err) {
    logClassifierEvent(log, taskId, `Anthropic SDK unavailable: ${formatClassifierError(err)}`);
    return {
      signal: { task: taskId, signal: 'blocked', discovery: 'null', model: LLM_FALLBACK_MODEL_LABEL, reasoningEffort: 'unknown' },
      problems: `LLM fallback failed: SDK unavailable (${err.message})`,
      workaround: NO_ABNORMALITIES,
      preSatisfiedAcs: [],
    };
  }

  const systemPrompt = 'You are a classifier for SDD implementer agent output. Analyze the provided stdout and return ONLY valid JSON with no markdown fences.';
  const userPrompt = `Analyze this implementer agent stdout for task ${taskId} and classify the outcome.

Return ONLY a JSON object (no markdown fences, no commentary outside JSON) with this exact shape:
{"signal":"pass|fail|blocked","problems":"string or 'no abnormalities'","workaround":"string or 'no abnormalities'","preSatisfiedAcs":[],"classification":"success|failure|escalation-required","reasoning":"brief explanation"}

Classification rules:
- success: implementation appears complete and correct -> signal "pass"
- failure: implementation failed without escalation -> signal "fail"
- escalation-required: agent hit a blocking issue requiring human/spec intervention -> signal "blocked"
- If ambiguous, prefer "blocked"

Implementer stdout:
---
${truncatedOutput}`;

  let response;
  try {
    response = await client.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    const errorDetail = formatClassifierError(err);
    logClassifierEvent(log, taskId, `Anthropic request failed: ${errorDetail}`);
    return {
      signal: { task: taskId, signal: 'blocked', discovery: 'null', model: LLM_FALLBACK_MODEL_LABEL, reasoningEffort: 'unknown' },
      problems: `LLM classification request failed: ${errorDetail}`,
      workaround: NO_ABNORMALITIES,
      preSatisfiedAcs: [],
    };
  }

  try {
    const responseText = Array.isArray(response.content)
      ? response.content
        .filter((part) => part && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
      : '';
    const text = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    const classificationToSignal = { success: 'pass', failure: 'fail', 'escalation-required': 'blocked' };
    const resolvedSignal = parsed.signal && /^(pass|fail|blocked)$/.test(parsed.signal)
      ? parsed.signal
      : (classificationToSignal[parsed.classification] || 'blocked');

    logClassifierEvent(log, taskId, `Anthropic classification succeeded with signal "${resolvedSignal}".`);

    return {
      signal: {
        task: taskId,
        signal: resolvedSignal,
        discovery: 'null',
        model: LLM_FALLBACK_MODEL_LABEL,
        reasoningEffort: 'unknown',
      },
      problems: typeof parsed.problems === 'string' ? parsed.problems : NO_ABNORMALITIES,
      workaround: typeof parsed.workaround === 'string' ? parsed.workaround : NO_ABNORMALITIES,
      preSatisfiedAcs: Array.isArray(parsed.preSatisfiedAcs) ? parsed.preSatisfiedAcs : [],
    };
  } catch (err) {
    const responseText = Array.isArray(response.content)
      ? response.content
        .filter((part) => part && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
      : '';
    logClassifierEvent(log, taskId, `Anthropic response was unparseable: ${formatClassifierError(err)}`);
    if (responseText) {
      logClassifierEvent(log, taskId, `raw response text:\n${responseText}`);
    }
    return {
      signal: { task: taskId, signal: 'blocked', discovery: 'null', model: LLM_FALLBACK_MODEL_LABEL, reasoningEffort: 'unknown' },
      problems: 'LLM classification returned unparseable output',
      workaround: NO_ABNORMALITIES,
      preSatisfiedAcs: [],
    };
  }
}

async function parseImplementerReportWithFallback(stdout, taskId, { classifyOutput = classifyImplementerOutputWithLLM, log } = {}) {
  try {
    return parseImplementerReport(stdout, taskId);
  } catch (err) {
    if (!err.message || !err.message.startsWith('No valid Implementer signal found')) {
      throw err;
    }

    const lines = stdout
      .split(/\r?\n/)
      .map((line) => stripAnsi(line).trim())
      .filter(Boolean);

    if (typeof log === 'function') {
      return classifyOutput(lines, taskId, { log });
    }

    return classifyOutput(lines, taskId);
  }
}

function parseImplementerSignal(stdout, taskId) {
  return parseImplementerReport(stdout, taskId).signal;
}

function formatPreSatisfiedAcs(preSatisfiedAcs) {
  if (!Array.isArray(preSatisfiedAcs) || preSatisfiedAcs.length === 0) {
    return NO_PRE_SATISFIED_ACS;
  }

  return preSatisfiedAcs.join(', ');
}

function buildReviewerInstruction(report) {
  if (!report || !Array.isArray(report.preSatisfiedAcs) || report.preSatisfiedAcs.length === 0) {
    return null;
  }

  return `${REVIEWER_PRE_SATISFIED_ACS_INSTRUCTION_PREFIX} ${formatPreSatisfiedAcs(report.preSatisfiedAcs)}`;
}

function buildImplementerInstruction(taskId) {
  return `Implement only ${taskId}. Once ${taskId} is complete, immediately perform the exit contract and stop. Do not start dependent tasks, later plan tasks, adjacent cleanup, or opportunistic follow-up refactors unless they are required to complete ${taskId}.`;
}

function parseReviewerVerdict(content) {
  const match = content.match(REVIEWER_VERDICT_RE);
  if (!match) throw new Error('Reviewer verdict file is missing the final verdict line');
  return match[1];
}

function buildImplementerArgs({
  taskId,
  specPath,
  specSlicePath,
  cycle,
  reviewFeedbackPath,
  deterministicFeedbackPath,
  escalationBriefPath,
  workdirPath,
  instruction,
  reasoningEffort,
  useClaude,
  useCline,
  passthroughArgs,
}) {
  const args = [
    '--task', taskId,
    '--spec', specPath,
    '--cycle', String(cycle),
  ];

  if (specSlicePath) {
    args.push('--spec-slice', specSlicePath);
  }

  if (reviewFeedbackPath) {
    args.push('--review-feedback', reviewFeedbackPath);
  }

  if (deterministicFeedbackPath) {
    args.push('--deterministic-feedback', deterministicFeedbackPath);
  }

  if (escalationBriefPath) {
    args.push('--escalation-brief', escalationBriefPath);
  }

  if (workdirPath) {
    args.push('--workdir', workdirPath);
  }

  if (instruction) {
    args.push('--instruction', instruction);
  }

  if (useClaude) {
    args.push('--effort', reasoningEffort);
  } else if (!useCline) {
    args.push('--reasoning-effort', reasoningEffort);
  }

  args.push(...passthroughArgs);
  return args;
}

function buildReviewerArgs({
  taskId,
  specPath,
  specSlicePath,
  epoch,
  cycle,
  diffPath,
  verdictPath,
  priorVerdictPath,
  instruction,
  reasoningEffort,
  useClaude,
  useCline,
  passthroughArgs,
}) {
  const args = [
    '--task', taskId,
    '--spec', specPath,
    '--epoch', String(epoch),
    '--cycle', String(cycle),
    '--diff', diffPath,
    '--verdict-output', verdictPath,
    ...passthroughArgs,
  ];

  if (useClaude) {
    args.push('--effort', reasoningEffort);
  } else if (!useCline) {
    args.push('--reasoning-effort', reasoningEffort);
  }

  if (specSlicePath) {
    args.push('--spec-slice', specSlicePath);
  }

  if (priorVerdictPath) {
    args.push('--prior-verdict', priorVerdictPath);
  }

  if (instruction) {
    args.push('--instruction', instruction);
  }

  return args;
}

function emitImplementerReport(report, stream = process.stdout) {
  if (!stream || typeof stream.write !== 'function') return;
  stream.write(`${IMPLEMENTER_PROBLEMS_PREFIX} ${report.problems}\n`);
  stream.write(`${IMPLEMENTER_WORKAROUND_PREFIX} ${report.workaround}\n`);
  stream.write(`${IMPLEMENTER_PRE_SATISFIED_ACS_PREFIX} ${formatPreSatisfiedAcs(report.preSatisfiedAcs)}\n`);
}

module.exports = {
  buildImplementerArgs,
  buildImplementerInstruction,
  buildReviewerArgs,
  buildReviewerInstruction,
  classifyImplementerOutputWithLLM,
  emitImplementerReport,
  formatPreSatisfiedAcs,
  parseImplementerReport,
  parseImplementerReportWithFallback,
  parseImplementerSignal,
  parseReviewerVerdict,
  resolveReasoningEffort,
};
