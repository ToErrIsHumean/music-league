#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

loadEnvFile(path.join(__dirname, "..", ".env"));

const { PrismaClient } = require("@prisma/client");
const { parseMusicLeagueBundle } = require("../src/import/parse-bundle");
const { stageImportBundle } = require("../src/import/stage-batch");
const { analyzeImportBatch } = require("../src/import/analyze-batch");
const { commitImportBatch } = require("../src/import/commit-batch");
const { listImportBatchIssues } = require("../src/import/list-batch-issues");

const REQUIRED_CSV_FILENAMES = [
  "competitors.csv",
  "rounds.csv",
  "submissions.csv",
  "votes.csv",
];
const METADATA_SIDECAR_FILENAME = "game-metadata.csv";
const METADATA_SIDECAR_HEADERS = [
  "zip_filename",
  "game_display_name",
  "game_description",
  "game_finished",
  "game_speed",
  "LeagueMaster",
];
const GAME_SPEED_VALUES = new Set(["Steady", "Accelerated", "Speedy"]);
const GAME_DESCRIPTION_MAX_LENGTH = 1000;

async function main(argv) {
  const zipDirectory = resolveZipDirectory(argv);
  const zipFiles = listZipFiles(zipDirectory);

  if (zipFiles.length === 0) {
    throw new Error(`No .zip files found in ${zipDirectory}`);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. Example: DATABASE_URL=\"file:./dev.db\" npm run import:zips -- import",
    );
  }

  const metadataByZipFilename = readGameMetadataSidecar(zipDirectory, zipFiles);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "music-league-import-zips-"));
  const prisma = new PrismaClient();
  const stagedImports = [];
  const failures = [];

  console.log(`Found ${zipFiles.length} zip file(s) in ${zipDirectory}`);

  try {
    for (const zipFile of zipFiles) {
      const label = path.basename(zipFile);
      const extractDir = path.join(
        tempRoot,
        `${String(stagedImports.length + failures.length + 1).padStart(3, "0")}-${path.basename(zipFile, ".zip")}`,
      );

      try {
        extractZip(zipFile, extractDir);
        const bundlePath = resolveBundlePath(extractDir);
        const parsedBundle = parseMusicLeagueBundle({
          bundlePath,
          sourceLabel: label,
        });
        const staged = await stageImportBundle({ parsedBundle, prisma });
        const analyzed = await analyzeImportBatch(staged.batchId, { prisma });

        const result = {
          zipFile,
          label,
          parsedBundle,
          staged,
          analyzed,
          metadata: metadataByZipFilename.get(label) ?? null,
        };

        if (analyzed.status === "ready") {
          stagedImports.push(result);
          printReady(result);
          continue;
        }

        const issues = await listImportBatchIssues(staged.batchId, { prisma });
        failures.push({
          label,
          batchId: staged.batchId,
          status: analyzed.status,
          issues,
        });
        printFailed(label, staged.batchId, analyzed.status, issues);
      } catch (error) {
        failures.push({
          label,
          error,
        });
        printError(label, error);
      }
    }

    if (failures.length > 0) {
      console.error(
        `Import aborted: ${failures.length} zip file(s) failed validation or processing. No ready zip was committed by this run.`,
      );
      process.exitCode = 1;
      return;
    }

    for (const stagedImport of stagedImports) {
      const preCommitGameMetadata = await loadGameMetadataSnapshot({
        prisma,
        gameKey: stagedImport.staged.gameKey,
      });
      const committed = await commitImportBatch(stagedImport.staged.batchId, {
        prisma,
      });
      await applyCommittedGameMetadata({
        prisma,
        gameKey: stagedImport.staged.gameKey,
        metadata: stagedImport.metadata,
        preCommitGameMetadata,
      });
      printCommitted(stagedImport, committed);
    }

    console.log(`Imported ${stagedImports.length} zip file(s) successfully.`);
  } finally {
    await prisma.$disconnect();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function resolveZipDirectory(argv) {
  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: npm run import:zips -- <directory-containing-zip-files>");
    process.exit(0);
  }

  if (args.length !== 1) {
    throw new Error("Usage: npm run import:zips -- <directory-containing-zip-files>");
  }

  const zipDirectory = path.resolve(args[0]);
  const stats = fs.statSync(zipDirectory);

  if (!stats.isDirectory()) {
    throw new Error(`Import path is not a directory: ${zipDirectory}`);
  }

  return zipDirectory;
}

function listZipFiles(zipDirectory) {
  return fs
    .readdirSync(zipDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
    .map((entry) => path.join(zipDirectory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function readGameMetadataSidecar(zipDirectory, zipFiles) {
  const sidecarPath = path.join(zipDirectory, METADATA_SIDECAR_FILENAME);

  if (!fs.existsSync(sidecarPath)) {
    return new Map();
  }

  const zipFilenames = zipFiles.map((zipFile) => path.basename(zipFile));

  return parseGameMetadataSidecar({
    csvText: fs.readFileSync(sidecarPath, "utf8"),
    zipFilenames,
  });
}

function parseGameMetadataSidecar(input) {
  const csvText = input?.csvText;
  const zipFilenames = input?.zipFilenames;

  if (typeof csvText !== "string") {
    throw new TypeError("parseGameMetadataSidecar: csvText is required");
  }

  if (!Array.isArray(zipFilenames)) {
    throw new TypeError("parseGameMetadataSidecar: zipFilenames is required");
  }

  const discoveredZipFilenames = new Set(zipFilenames);
  const parsedCsv = parseMetadataCsvFile(csvText);
  const headerResolution = resolveMetadataHeaders(parsedCsv.header);
  const metadataByZipFilename = new Map();

  for (const record of parsedCsv.records) {
    const values = {};

    for (const header of METADATA_SIDECAR_HEADERS) {
      values[header] = record.values[headerResolution.get(header)] ?? "";
    }

    const zipFilename = values.zip_filename.trim();

    if (zipFilename === "") {
      throw new Error(
        `Invalid ${METADATA_SIDECAR_FILENAME} row ${record.sourceRowNumber}: zip_filename is required`,
      );
    }

    if (/[\\/]/.test(zipFilename) || path.basename(zipFilename) !== zipFilename) {
      throw new Error(
        `Invalid ${METADATA_SIDECAR_FILENAME} row ${record.sourceRowNumber}: zip_filename must be a discovered zip basename`,
      );
    }

    if (!discoveredZipFilenames.has(zipFilename)) {
      throw new Error(
        `Invalid ${METADATA_SIDECAR_FILENAME} row ${record.sourceRowNumber}: zip_filename ${JSON.stringify(zipFilename)} was not discovered`,
      );
    }

    if (metadataByZipFilename.has(zipFilename)) {
      throw new Error(
        `Invalid ${METADATA_SIDECAR_FILENAME} row ${record.sourceRowNumber}: duplicate zip_filename ${JSON.stringify(zipFilename)}`,
      );
    }

    const metadata = normalizeGameMetadata(values, record.sourceRowNumber);

    if (
      metadata.gameDisplayName === null &&
      metadata.gameDescription === null &&
      metadata.gameFinished === null &&
      metadata.gameSpeed === null &&
      metadata.leagueMaster === null
    ) {
      throw new Error(
        `Invalid ${METADATA_SIDECAR_FILENAME} row ${record.sourceRowNumber}: at least one metadata value is required`,
      );
    }

    metadataByZipFilename.set(zipFilename, metadata);
  }

  return metadataByZipFilename;
}

function resolveMetadataHeaders(header) {
  const requiredHeaderLookup = new Map(
    METADATA_SIDECAR_HEADERS.map((name) => [normalizeMetadataHeader(name), name]),
  );
  const resolvedHeaders = new Map();

  for (const rawHeader of header) {
    const normalizedHeader = normalizeMetadataHeader(rawHeader);
    const requiredHeader = requiredHeaderLookup.get(normalizedHeader);

    if (!requiredHeader) {
      throw new Error(
        `Unsupported ${METADATA_SIDECAR_FILENAME} column: ${JSON.stringify(rawHeader)}`,
      );
    }

    if (resolvedHeaders.has(requiredHeader)) {
      throw new Error(
        `Duplicate ${METADATA_SIDECAR_FILENAME} column: ${JSON.stringify(rawHeader)}`,
      );
    }

    resolvedHeaders.set(requiredHeader, rawHeader);
  }

  for (const requiredHeader of METADATA_SIDECAR_HEADERS) {
    if (!resolvedHeaders.has(requiredHeader)) {
      throw new Error(`Missing required ${METADATA_SIDECAR_FILENAME} header: ${requiredHeader}`);
    }
  }

  return resolvedHeaders;
}

function normalizeGameMetadata(values, sourceRowNumber) {
  const gameDisplayName = nullableTrimmedMetadata(values.game_display_name);
  const gameDescription =
    values.game_description.trim() === "" ? null : values.game_description;
  const gameFinished = nullableBooleanMetadata(
    values.game_finished,
    "game_finished",
    sourceRowNumber,
  );
  const gameSpeed = nullableTrimmedMetadata(values.game_speed);
  const leagueMaster = nullableTrimmedMetadata(values.LeagueMaster);

  if (
    gameDescription !== null &&
    gameDescription.length > GAME_DESCRIPTION_MAX_LENGTH
  ) {
    throw new Error(
      `Invalid ${METADATA_SIDECAR_FILENAME} row ${sourceRowNumber}: game_description exceeds ${GAME_DESCRIPTION_MAX_LENGTH} characters`,
    );
  }

  if (gameSpeed !== null && !GAME_SPEED_VALUES.has(gameSpeed)) {
    throw new Error(
      `Invalid ${METADATA_SIDECAR_FILENAME} row ${sourceRowNumber}: game_speed must be Steady, Accelerated, or Speedy`,
    );
  }

  return {
    gameDisplayName,
    gameDescription,
    gameFinished,
    gameSpeed,
    leagueMaster,
  };
}

function parseMetadataCsvFile(csvText) {
  const rows = splitMetadataCsvRows(csvText);

  if (rows.records.length === 0) {
    throw new Error(`Malformed ${METADATA_SIDECAR_FILENAME}: missing header row`);
  }

  const parsedHeader = parseMetadataCsvRow(rows.records[0].text);

  if (parsedHeader.error) {
    throw new Error(
      `Malformed ${METADATA_SIDECAR_FILENAME} header: ${parsedHeader.error}`,
    );
  }

  const header = parsedHeader.fields;
  const records = [];

  for (const row of rows.records.slice(1)) {
    const parsedRow = parseMetadataCsvRow(row.text);

    if (parsedRow.error) {
      throw new Error(
        `Malformed ${METADATA_SIDECAR_FILENAME} row ${row.rowNumber}: ${parsedRow.error}`,
      );
    }

    if (parsedRow.fields.length > header.length) {
      throw new Error(
        `Malformed ${METADATA_SIDECAR_FILENAME} row ${row.rowNumber}: expected ${header.length} field(s), got ${parsedRow.fields.length}`,
      );
    }

    const values = {};

    for (let index = 0; index < header.length; index += 1) {
      values[header[index]] = parsedRow.fields[index] ?? "";
    }

    records.push({
      sourceRowNumber: row.rowNumber,
      values,
    });
  }

  return {
    header,
    records,
  };
}

function splitMetadataCsvRows(csvText) {
  const records = [];
  let current = "";
  let currentRowNumber = 1;
  let inQuotes = false;
  let endedOnDelimiter = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      current += character;

      if (inQuotes && csvText[index + 1] === '"') {
        current += '"';
        index += 1;
        endedOnDelimiter = false;
        continue;
      }

      inQuotes = !inQuotes;
      endedOnDelimiter = false;
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      records.push({
        rowNumber: currentRowNumber,
        text: current,
      });
      current = "";
      currentRowNumber += 1;
      endedOnDelimiter = true;

      if (character === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }

      continue;
    }

    current += character;
    endedOnDelimiter = false;
  }

  if (inQuotes) {
    throw new Error(`Malformed ${METADATA_SIDECAR_FILENAME}: unterminated quoted field`);
  }

  if (current.length > 0 || (!endedOnDelimiter && csvText.length > 0)) {
    records.push({
      rowNumber: currentRowNumber,
      text: current,
    });
  }

  return { records };
}

function parseMetadataCsvRow(rowText) {
  const fields = [];
  let current = "";
  let state = "start";

  for (let index = 0; index < rowText.length; index += 1) {
    const character = rowText[index];

    if (state === "start") {
      if (character === ",") {
        fields.push("");
        continue;
      }

      if (character === '"') {
        state = "quoted";
        continue;
      }

      current += character;
      state = "unquoted";
      continue;
    }

    if (state === "unquoted") {
      if (character === ",") {
        fields.push(current);
        current = "";
        state = "start";
        continue;
      }

      if (character === '"') {
        return { error: "Unexpected quote in unquoted field" };
      }

      current += character;
      continue;
    }

    if (state === "quoted") {
      if (character === '"') {
        if (rowText[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          state = "after-quoted";
        }

        continue;
      }

      current += character;
      continue;
    }

    if (character === ",") {
      fields.push(current);
      current = "";
      state = "start";
      continue;
    }

    return { error: "Unexpected character after closing quote" };
  }

  if (state === "quoted") {
    return { error: "Unterminated quoted field" };
  }

  fields.push(current);

  return { fields };
}

function nullableTrimmedMetadata(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

async function applyCommittedGameMetadata(input) {
  const prisma = input?.prisma;
  const gameKey = input?.gameKey;
  const metadata = input?.metadata ?? null;
  const preCommitGameMetadata = input?.preCommitGameMetadata;

  if (!prisma) {
    throw new TypeError("applyCommittedGameMetadata: prisma is required");
  }

  if (typeof gameKey !== "string" || gameKey.trim() === "") {
    throw new TypeError("applyCommittedGameMetadata: gameKey is required");
  }

  const sourceGameId = gameKey.trim();
  const game = await prisma.game.findUnique({
    where: {
      sourceGameId,
    },
  });

  if (!game) {
    throw new Error(
      `applyCommittedGameMetadata: committed game not found for gameKey ${JSON.stringify(sourceGameId)}`,
    );
  }

  const updateData = {};

  if (metadata) {
    addMetadataUpdate(
      updateData,
      game,
      "displayName",
      metadata.gameDisplayName,
      preCommitGameMetadata,
    );
    addMetadataUpdate(
      updateData,
      game,
      "description",
      metadata.gameDescription,
      preCommitGameMetadata,
    );
    addBooleanMetadataUpdate(updateData, game, "finished", metadata.gameFinished);
    addMetadataUpdate(
      updateData,
      game,
      "speed",
      metadata.gameSpeed,
      preCommitGameMetadata,
    );
    addMetadataUpdate(
      updateData,
      game,
      "leagueMaster",
      metadata.leagueMaster,
      preCommitGameMetadata,
    );
  }

  const updatedGame =
    Object.keys(updateData).length === 0
      ? game
      : await prisma.game.update({
          where: {
            id: game.id,
          },
          data: updateData,
        });

  return {
    gameId: updatedGame.id,
    displayName: updatedGame.displayName,
    description: updatedGame.description,
    finished: updatedGame.finished,
    speed: updatedGame.speed,
    leagueMaster: updatedGame.leagueMaster,
    displayNameUpdated: Object.prototype.hasOwnProperty.call(
      updateData,
      "displayName",
    ),
    descriptionUpdated: Object.prototype.hasOwnProperty.call(
      updateData,
      "description",
    ),
    finishedUpdated: Object.prototype.hasOwnProperty.call(updateData, "finished"),
    speedUpdated: Object.prototype.hasOwnProperty.call(updateData, "speed"),
    leagueMasterUpdated: Object.prototype.hasOwnProperty.call(
      updateData,
      "leagueMaster",
    ),
  };
}

async function loadGameMetadataSnapshot(input) {
  const prisma = input?.prisma;
  const gameKey = input?.gameKey;

  if (!prisma) {
    throw new TypeError("loadGameMetadataSnapshot: prisma is required");
  }

  if (typeof gameKey !== "string" || gameKey.trim() === "") {
    throw new TypeError("loadGameMetadataSnapshot: gameKey is required");
  }

  return prisma.game.findUnique({
    where: {
      sourceGameId: gameKey.trim(),
    },
    select: {
      displayName: true,
      description: true,
      finished: true,
      speed: true,
      leagueMaster: true,
    },
  });
}

function addMetadataUpdate(
  updateData,
  game,
  fieldName,
  metadataValue,
  preCommitGameMetadata,
) {
  if (metadataValue === null || metadataValue === undefined) {
    return;
  }

  const comparisonValue =
    preCommitGameMetadata === undefined
      ? game[fieldName]
      : preCommitGameMetadata?.[fieldName] ?? null;

  if (isNonBlankString(comparisonValue)) {
    return;
  }

  updateData[fieldName] = metadataValue;
}

function addBooleanMetadataUpdate(updateData, game, fieldName, metadataValue) {
  if (metadataValue === null || metadataValue === undefined) {
    return;
  }

  if (game[fieldName] === metadataValue) {
    return;
  }

  updateData[fieldName] = metadataValue;
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function nullableBooleanMetadata(value, fieldName, sourceRowNumber) {
  const normalized = nullableTrimmedMetadata(value);

  if (normalized === null) {
    return null;
  }

  if (normalized.toLowerCase() === "true") {
    return true;
  }

  if (normalized.toLowerCase() === "false") {
    return false;
  }

  throw new Error(
    `Invalid ${METADATA_SIDECAR_FILENAME} row ${sourceRowNumber}: ${fieldName} must be true or false`,
  );
}

function normalizeMetadataHeader(header) {
  return String(header).replace(/^\uFEFF/, "").toLowerCase().replace(/\s+/g, "");
}

function extractZip(zipFile, extractDir) {
  fs.mkdirSync(extractDir, { recursive: true });

  const result = spawnSync("unzip", ["-q", zipFile, "-d", extractDir], {
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `unzip failed for ${zipFile}: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }
}

function resolveBundlePath(extractDir) {
  if (containsRequiredCsvFiles(extractDir)) {
    return extractDir;
  }

  const childBundleDirectories = fs
    .readdirSync(extractDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(extractDir, entry.name))
    .filter(containsRequiredCsvFiles);

  if (childBundleDirectories.length === 1) {
    return childBundleDirectories[0];
  }

  return extractDir;
}

function containsRequiredCsvFiles(directory) {
  return REQUIRED_CSV_FILENAMES.every((filename) =>
    fs.existsSync(path.join(directory, filename)),
  );
}

function printReady(result) {
  console.log(
    [
      `READY ${result.label}`,
      `batch=${result.staged.batchId}`,
      `gameKey=${result.staged.gameKey}`,
      `rows=${result.staged.rowCounts.total}`,
      `issues=${result.analyzed.summary.openBlockingIssues}`,
    ].join(" "),
  );
}

function printFailed(label, batchId, status, issues) {
  console.error(`FAILED ${label} batch=${batchId} status=${status}`);

  for (const issue of issues) {
    console.error(
      [
        "  issue",
        `file=${issue.sourceFileKind}`,
        `row=${issue.sourceRowNumber ?? "n/a"}`,
        `code=${issue.issueCode}`,
        issue.message,
      ].join(" "),
    );
  }
}

function printError(label, error) {
  console.error(`ERROR ${label} ${getErrorMessage(error)}`);
}

function printCommitted(result, committed) {
  console.log(
    [
      `COMMITTED ${result.label}`,
      `batch=${committed.batchId}`,
      `gameKey=${result.staged.gameKey}`,
      `rounds=${committed.affectedRoundIds.join(",") || "none"}`,
      `submissions=${committed.canonicalWrites.submissionsUpserted}`,
      `votes=${committed.canonicalWrites.votesUpserted}`,
    ].join(" "),
  );
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = parseEnvValue(trimmed.slice(separatorIndex + 1).trim());
    process.env[key] = value;
  }
}

function parseEnvValue(rawValue) {
  if (rawValue.startsWith('"')) {
    const endIndex = rawValue.indexOf('"', 1);
    return endIndex === -1 ? rawValue.slice(1) : rawValue.slice(1, endIndex);
  }

  if (rawValue.startsWith("'")) {
    const endIndex = rawValue.indexOf("'", 1);
    return endIndex === -1 ? rawValue.slice(1) : rawValue.slice(1, endIndex);
  }

  return rawValue.split(/\s+#/)[0].trim();
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

if (require.main === module) {
  main(process.argv).catch((error) => {
    console.error(getErrorMessage(error));
    process.exit(1);
  });
}

module.exports = {
  applyCommittedGameMetadata,
  loadGameMetadataSnapshot,
  parseGameMetadataSidecar,
  readGameMetadataSidecar,
};
