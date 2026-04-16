const fs = require("node:fs");
const path = require("node:path");

const FILE_SPECS = {
  competitors: {
    filename: "competitors.csv",
    requiredHeaders: ["ID", "Name"],
    buildRow(record) {
      return {
        sourceRowNumber: record.sourceRowNumber,
        sourcePlayerId: record.values.ID,
        displayName: record.values.Name,
      };
    },
  },
  rounds: {
    filename: "rounds.csv",
    requiredHeaders: ["ID", "Created", "Name", "Description", "Playlist URL"],
    buildRow(record, issues) {
      const occurredAt = coerceTimestamp(
        record,
        "Created",
        "occurredAt",
        "rounds",
        issues,
      );

      if (occurredAt === INVALID_ROW) {
        return INVALID_ROW;
      }

      return {
        sourceRowNumber: record.sourceRowNumber,
        sourceRoundId: record.values.ID,
        occurredAt,
        name: record.values.Name,
        description: nullableString(record.values.Description),
        playlistUrl: nullableString(record.values["Playlist URL"]),
      };
    },
  },
  submissions: {
    filename: "submissions.csv",
    requiredHeaders: [
      "Spotify URI",
      "Title",
      "Artist(s)",
      "Submitter ID",
      "Created",
      "Comment",
      "Round ID",
      "Visible To Voters",
    ],
    buildRow(record, issues) {
      const submittedAt = coerceTimestamp(
        record,
        "Created",
        "submittedAt",
        "submissions",
        issues,
      );
      const visibleToVoters = coerceVisibleToVoters(record, issues);

      if (submittedAt === INVALID_ROW || visibleToVoters === INVALID_ROW) {
        return INVALID_ROW;
      }

      return {
        sourceRowNumber: record.sourceRowNumber,
        spotifyUri: record.values["Spotify URI"],
        title: record.values.Title,
        artistName: record.values["Artist(s)"],
        sourceSubmitterId: record.values["Submitter ID"],
        submittedAt,
        comment: nullableString(record.values.Comment),
        sourceRoundId: record.values["Round ID"],
        visibleToVoters,
      };
    },
  },
  votes: {
    filename: "votes.csv",
    requiredHeaders: [
      "Spotify URI",
      "Voter ID",
      "Created",
      "Points Assigned",
      "Comment",
      "Round ID",
    ],
    buildRow(record, issues) {
      const votedAt = coerceTimestamp(
        record,
        "Created",
        "votedAt",
        "votes",
        issues,
      );
      const pointsAssigned = coerceInteger(
        record,
        "Points Assigned",
        "pointsAssigned",
        "votes",
        issues,
      );

      if (votedAt === INVALID_ROW || pointsAssigned === INVALID_ROW) {
        return INVALID_ROW;
      }

      return {
        sourceRowNumber: record.sourceRowNumber,
        spotifyUri: record.values["Spotify URI"],
        sourceVoterId: record.values["Voter ID"],
        votedAt,
        pointsAssigned,
        comment: nullableString(record.values.Comment),
        sourceRoundId: record.values["Round ID"],
      };
    },
  },
};

const ISO_8601_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const INVALID_ROW = Symbol("invalid-row");

function parseMusicLeagueBundle(input) {
  const bundlePath = input?.bundlePath;
  const sourceLabel =
    input?.sourceLabel ?? path.basename(path.resolve(String(bundlePath ?? "")));

  assertReadableBundlePath(bundlePath);

  const parsedBundle = {
    sourceLabel,
    gameKey: null,
    issues: [],
    files: {},
  };

  for (const [fileKind, spec] of Object.entries(FILE_SPECS)) {
    const fileResult = {
      filename: spec.filename,
      rowCount: 0,
      rows: [],
    };

    parsedBundle.files[fileKind] = fileResult;

    const filePath = path.join(bundlePath, spec.filename);
    let fileText;

    try {
      fileText = fs.readFileSync(filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        parsedBundle.issues.push(
          createIssue({
            sourceFileKind: fileKind,
            sourceRowNumber: null,
            issueCode: "missing_file",
            message: `Missing required file: ${spec.filename}`,
            rowPreview: {},
          }),
        );
        continue;
      }

      throw new Error(`parseMusicLeagueBundle: unreadable CSV file: ${spec.filename}`, {
        cause: error,
      });
    }

    const parsedFile = parseCsvFile(fileText, fileKind);

    fileResult.rowCount = parsedFile.rowCount;
    parsedBundle.issues.push(...parsedFile.issues);

    const requiredHeaderLookup = new Map(
      spec.requiredHeaders.map((header) => [normalizeHeader(header), header]),
    );
    const resolvedHeaders = new Map();

    for (const header of parsedFile.header) {
      const normalizedHeader = normalizeHeader(header);

      if (
        requiredHeaderLookup.has(normalizedHeader) &&
        !resolvedHeaders.has(requiredHeaderLookup.get(normalizedHeader))
      ) {
        resolvedHeaders.set(requiredHeaderLookup.get(normalizedHeader), header);
      }
    }

    const missingHeaders = spec.requiredHeaders.filter(
      (header) => !resolvedHeaders.has(header),
    );

    for (const missingHeader of missingHeaders) {
      parsedBundle.issues.push(
        createIssue({
          sourceFileKind: fileKind,
          sourceRowNumber: null,
          issueCode: "missing_header",
          message: `Missing required header: ${missingHeader}`,
          rowPreview: {},
        }),
      );
    }

    if (missingHeaders.length > 0) {
      continue;
    }

    for (const record of parsedFile.records) {
      const canonicalValues = {};

      for (const header of spec.requiredHeaders) {
        canonicalValues[header] = record.values[resolvedHeaders.get(header)] ?? "";
      }

      const typedRecord = spec.buildRow(
        {
          sourceRowNumber: record.sourceRowNumber,
          values: canonicalValues,
          rowPreview: record.rowPreview,
        },
        parsedBundle.issues,
      );

      if (typedRecord === INVALID_ROW) {
        continue;
      }

      fileResult.rows.push(typedRecord);

      if (
        fileKind === "rounds" &&
        parsedBundle.gameKey === null &&
        typedRecord.sourceRoundId.trim() !== ""
      ) {
        parsedBundle.gameKey = typedRecord.sourceRoundId.trim();
      }
    }
  }

  return parsedBundle;
}

function assertReadableBundlePath(bundlePath) {
  try {
    const stats = fs.statSync(bundlePath);

    if (!stats.isDirectory()) {
      throw new Error("not a directory");
    }
  } catch (error) {
    throw new Error(`parseMusicLeagueBundle: unreadable bundle path: ${bundlePath}`, {
      cause: error,
    });
  }
}

function parseCsvFile(fileText, sourceFileKind) {
  const rows = splitCsvRows(fileText, sourceFileKind);
  const issues = [...rows.issues];
  const rowCount = Math.max(0, rows.encounteredRowCount - 1);

  if (rows.records.length === 0) {
    return {
      header: [],
      records: [],
      rowCount,
      issues,
    };
  }

  const headerResult = parseCsvRow(rows.records[0].text);

  if (headerResult.error) {
    issues.push(
      createIssue({
        sourceFileKind,
        sourceRowNumber: rows.records[0].rowNumber,
        issueCode: "parse_error",
        message: headerResult.error,
        rowPreview: { rawRow: rows.records[0].text },
      }),
    );

    return {
      header: [],
      records: [],
      rowCount,
      issues,
    };
  }

  const header = headerResult.fields;
  const records = [];

  for (const row of rows.records.slice(1)) {
    const rowResult = parseCsvRow(row.text);

    if (rowResult.error) {
      issues.push(
        createIssue({
          sourceFileKind,
          sourceRowNumber: row.rowNumber,
          issueCode: "parse_error",
          message: rowResult.error,
          rowPreview: { rawRow: row.text },
        }),
      );
      continue;
    }

    const values = {};

    for (let index = 0; index < header.length; index += 1) {
      values[header[index]] = rowResult.fields[index] ?? "";
    }

    records.push({
      sourceRowNumber: row.rowNumber,
      values,
      rowPreview: values,
    });
  }

  return {
    header,
    records,
    rowCount,
    issues,
  };
}

function splitCsvRows(fileText, sourceFileKind) {
  const records = [];
  const issues = [];
  let encounteredRowCount = 0;
  let current = "";
  let currentRowNumber = 1;
  let inQuotes = false;
  let endedOnDelimiter = false;

  for (let index = 0; index < fileText.length; index += 1) {
    const character = fileText[index];

    if (character === '"') {
      current += character;

      if (inQuotes && fileText[index + 1] === '"') {
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
      encounteredRowCount += 1;
      records.push({
        rowNumber: currentRowNumber,
        text: current,
      });
      current = "";
      currentRowNumber += 1;
      endedOnDelimiter = true;

      if (character === "\r" && fileText[index + 1] === "\n") {
        index += 1;
      }

      continue;
    }

    current += character;
    endedOnDelimiter = false;
  }

  if (inQuotes) {
    encounteredRowCount += 1;
    issues.push(
      createIssue({
        sourceFileKind,
        sourceRowNumber: currentRowNumber,
        issueCode: "parse_error",
        message: "Unterminated quoted field",
        rowPreview: current === "" ? {} : { rawRow: current },
      }),
    );
  } else if (current.length > 0 || (!endedOnDelimiter && fileText.length > 0)) {
    encounteredRowCount += 1;
    records.push({
      rowNumber: currentRowNumber,
      text: current,
    });
  }

  return { records, issues, encounteredRowCount };
}

function parseCsvRow(rowText) {
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
        return { error: 'Unexpected quote in unquoted field' };
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

function coerceTimestamp(record, columnName, fieldName, sourceFileKind, issues) {
  const rawValue = record.values[columnName] ?? "";
  const trimmedValue = rawValue.trim();

  if (trimmedValue === "") {
    return null;
  }

  if (!ISO_8601_TIMESTAMP_PATTERN.test(trimmedValue)) {
    issues.push(
      createIssue({
        sourceFileKind,
        sourceRowNumber: record.sourceRowNumber,
        issueCode: "invalid_scalar",
        message: `Invalid ${fieldName} timestamp: ${JSON.stringify(rawValue)}`,
        rowPreview: record.rowPreview,
      }),
    );
    return INVALID_ROW;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    issues.push(
      createIssue({
        sourceFileKind,
        sourceRowNumber: record.sourceRowNumber,
        issueCode: "invalid_scalar",
        message: `Invalid ${fieldName} timestamp: ${JSON.stringify(rawValue)}`,
        rowPreview: record.rowPreview,
      }),
    );
    return INVALID_ROW;
  }

  return parsedDate;
}

function coerceVisibleToVoters(record, issues) {
  const rawValue = record.values["Visible To Voters"] ?? "";
  const trimmedValue = rawValue.trim();

  if (trimmedValue === "") {
    return null;
  }

  if (trimmedValue === "Yes") {
    return true;
  }

  if (trimmedValue === "No") {
    return false;
  }

  issues.push(
    createIssue({
      sourceFileKind: "submissions",
      sourceRowNumber: record.sourceRowNumber,
      issueCode: "invalid_scalar",
      message: `Invalid visibleToVoters value: ${JSON.stringify(rawValue)}`,
      rowPreview: record.rowPreview,
    }),
  );

  return INVALID_ROW;
}

function coerceInteger(record, columnName, fieldName, sourceFileKind, issues) {
  const rawValue = record.values[columnName] ?? "";
  const trimmedValue = rawValue.trim();

  if (!/^-?\d+$/.test(trimmedValue)) {
    issues.push(
      createIssue({
        sourceFileKind,
        sourceRowNumber: record.sourceRowNumber,
        issueCode: "invalid_scalar",
        message: `Invalid ${fieldName} integer: ${JSON.stringify(rawValue)}`,
        rowPreview: record.rowPreview,
      }),
    );
    return INVALID_ROW;
  }

  return Number.parseInt(trimmedValue, 10);
}

function nullableString(value) {
  return value === "" ? null : value;
}

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/\s+/g, "");
}

function createIssue({
  sourceFileKind,
  sourceRowNumber,
  issueCode,
  message,
  rowPreview,
}) {
  return {
    sourceFileKind,
    sourceRowNumber,
    issueCode,
    message,
    rowPreview,
  };
}

module.exports = {
  parseMusicLeagueBundle,
};
