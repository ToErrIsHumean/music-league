#!/usr/bin/env node
/**
 * extract-slices.js
 *
 * Reads a spec file containing Appendix E slice definitions and emits:
 *   <base>-universal.md          — §1, §2, §3, §7, §8, Appendix D
 *   <base>-slice-TASK-NN.md      — one file per slice definition
 *
 * Usage:
 *   node scripts/sdd/extract-slices.js <spec-file> [output-dir]
 *
 * Example:
 *   node scripts/sdd/extract-slices.js docs/specs/SPEC-001-core-data-model.md ./docs/specs/slices-001
 */

'use strict';

const fs = require('fs');
const path = require('path');

const [, , specPath, outDir = '.'] = process.argv;

if (!specPath) {
  console.error('Usage: node scripts/sdd/extract-slices.js <spec-file> [output-dir]');
  process.exit(1);
}

const spec = fs.readFileSync(specPath, 'utf8')
  .replace(/\\([.*|_`\-\[\]#\\])/g, '$1');

const specBase = path.basename(specPath, path.extname(specPath));

// Universal = §1 + §2 + §3 + §7 + §8 + Appendix D
// Excluded:   §4 (contracts), §5 (ACs), §6 (task hints), Appendix E (slices)
const UNIVERSAL_SECTIONS = [
  '## 1.',
  '## 2.',
  '## 3.',
  '## 7.',
  '## 8.',
  '## Appendix D:',
];

function extractUniversal(specText) {
  const h2Re = /^(## .+)$/m;
  const parts = [];
  let lastIndex = 0;
  let lastHeader = null;

  for (const match of specText.matchAll(new RegExp(h2Re.source, 'gm'))) {
    if (lastHeader !== null) {
      parts.push({ header: lastHeader, body: specText.slice(lastIndex, match.index) });
    }
    lastHeader = match[1];
    lastIndex = match.index;
  }

  if (lastHeader !== null) {
    parts.push({ header: lastHeader, body: specText.slice(lastIndex) });
  }

  const kept = parts
    .filter(({ header }) => UNIVERSAL_SECTIONS.some((prefix) => header.startsWith(prefix)))
    .map(({ body }) => body.trimEnd());

  if (!kept.length) {
    throw new Error('No universal sections matched — check UNIVERSAL_SECTIONS prefixes');
  }

  return `${kept.join('\n\n')}\n`;
}

function resolveToken(specText, token) {
  if (/^§4e$/.test(token)) {
    return extractLevel3Section(specText, '### 4e.');
  }

  const taskHint = token.match(/^§6:(TASK-[\w]+)$/);
  if (taskHint) {
    return extractTaskHint(specText, taskHint[1]);
  }

  const acRange = token.match(/^§5:AC-(\d+):(\d+)$/);
  const acSingle = token.match(/^§5:AC-(\d+)$/);
  if (acRange) return extractACRows(specText, Number(acRange[1]), Number(acRange[2]));
  if (acSingle) return extractACRows(specText, Number(acSingle[1]), Number(acSingle[1]));

  const range = token.match(/^§(4[abcd])-([\d]+):([\d]+)$/);
  if (range) {
    const [, part, from, to] = range;
    return intRange(Number(from), Number(to))
      .map((number) => extractLevel4Section(specText, `§${part}-${number}`))
      .join('\n\n');
  }

  const single = token.match(/^§(4[abcde])-([\d]+)$/);
  if (single) {
    const [, part, number] = single;
    return extractLevel4Section(specText, `§${part}-${number}`);
  }

  throw new Error(`Unrecognised token: "${token}"`);
}

function extractLevel4Section(specText, sectionId) {
  const escaped = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(#### ${escaped}\\.[\\s\\S]*?)(?=\\n#### |\\n### |\\n## |$)`);
  const match = specText.match(re);
  if (!match) {
    throw new Error(`Section not found: ${sectionId}`);
  }
  return match[1].trimEnd();
}

function extractLevel3Section(specText, headerPrefix) {
  const start = specText.indexOf(headerPrefix);
  if (start === -1) {
    throw new Error(`Header not found: "${headerPrefix}"`);
  }

  const rest = specText.slice(start);
  const endIdx = rest.slice(headerPrefix.length).search(/^## /m);
  const content = endIdx === -1 ? rest : rest.slice(0, endIdx + headerPrefix.length);
  return content.trimEnd();
}

function extractTaskHint(specText, taskId) {
  const sectionHeader = specText.match(/^## 6(?: ?\.)?.*$/m);
  if (!sectionHeader || sectionHeader.index == null) {
    throw new Error('Task Decomposition section not found');
  }

  const sectionStart = sectionHeader.index;
  const sectionRest = specText.slice(sectionStart);
  const nextH2Index = sectionRest.slice(sectionHeader[0].length).search(/^## /m);
  const sectionBlock = nextH2Index === -1
    ? sectionRest
    : sectionRest.slice(0, nextH2Index + sectionHeader[0].length);

  const escapedTaskId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entryRe = new RegExp(
    `(?:^|\\n)(\\d+\\.\\s+\\*\\*\\[${escapedTaskId}\\][\\s\\S]*?)(?=\\n\\d+\\.\\s+\\*\\*\\[TASK-|\\n###\\s|\\n##\\s|$)`
  );
  const entryMatch = sectionBlock.match(entryRe);

  if (!entryMatch) {
    throw new Error(`Task hint not found: ${taskId}`);
  }
  return entryMatch[1].trimEnd();
}

function extractACRows(specText, from, to) {
  const tableHeader = '| ID | Condition | Verification |';
  const tableSeparator = '|---|---|---|';

  const tableStart = specText.indexOf(tableHeader);
  if (tableStart === -1) {
    throw new Error('AC table header not found');
  }

  const tableEnd = specText.indexOf('\n## ', tableStart);
  const tableBlock = tableEnd === -1 ? specText.slice(tableStart) : specText.slice(tableStart, tableEnd);

  const rows = tableBlock
    .split('\n')
    .filter((line) => {
      const match = line.match(/^\| AC-(\d+) \|/);
      if (!match) return false;
      const number = Number(match[1]);
      return number >= from && number <= to;
    });

  if (!rows.length) {
    throw new Error(`No AC rows found in range AC-${from}–AC-${to}`);
  }

  return [tableHeader, tableSeparator, ...rows].join('\n');
}

function intRange(from, to) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function parseSlices(specText) {
  const sliceRe = /<!-- SLICE:(TASK-[\w]+) -->([\s\S]*?)<!-- \/SLICE:\1 -->/g;
  const slices = [];
  let match;

  while ((match = sliceRe.exec(specText)) !== null) {
    const [, taskId, body] = match;

    const labelMatch = body.match(/^LABEL:\s+(.+)$/m);
    const dependsMatch = body.match(/^DEPENDS:\s+(.+)$/m);
    const tokens = (body.match(/^\s*§[\w\-:]+/gm) ?? []).map((token) => token.trim());

    slices.push({
      taskId,
      label: labelMatch?.[1]?.trim() ?? '',
      depends: dependsMatch?.[1]?.trim() ?? '',
      tokens,
    });
  }

  return slices;
}

function assembleSlice(specText, slice) {
  const lines = [
    `# Slice: ${slice.taskId} — ${slice.label}`,
    '',
    `> **Depends-on:** ${slice.depends}`,
    `> **Universal:** ${specBase}-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)`,
    '',
    '---',
    '',
  ];

  for (const token of slice.tokens) {
    try {
      lines.push(resolveToken(specText, token));
    } catch (error) {
      console.warn(`  ⚠  ${slice.taskId} / ${token}: ${error.message}`);
      lines.push(`<!-- EXTRACT ERROR: ${token} — ${error.message} -->`);
    }
    lines.push('', '---', '');
  }

  return lines.join('\n');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const universalContent = extractUniversal(spec);
  const universalFile = path.join(outDir, `${specBase}-universal.md`);
  fs.writeFileSync(universalFile, universalContent);
  console.log(`✓ ${path.basename(universalFile)}  (${universalContent.length} chars)`);

  const slices = parseSlices(spec);
  if (!slices.length) {
    console.warn('⚠  No slice definitions found in Appendix E — check SLICE comment delimiters');
    process.exit(1);
  }

  let errors = 0;
  for (const slice of slices) {
    const content = assembleSlice(spec, slice);
    const fileName = `${specBase}-slice-${slice.taskId}.md`;
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, content);

    const hasError = content.includes('EXTRACT ERROR');
    if (hasError) errors += 1;
    const flag = hasError ? '⚠' : '✓';
    console.log(`${flag} ${fileName}  (${content.length} chars, ${slice.tokens.length} tokens)`);
  }

  console.log(`\n${slices.length} slices + 1 universal → ${outDir}/`);
  if (errors) {
    console.warn(`${errors} slice(s) had extraction errors — check output for <!-- EXTRACT ERROR --> markers`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
