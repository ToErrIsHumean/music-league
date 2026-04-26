const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const inheritedEnvKeys = [
  "PATH",
  "Path",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "SystemRoot",
  "ComSpec",
  "TMPDIR",
  "TEMP",
  "TMP",
];

function createPrismaEnv(databaseUrl) {
  const env = { DATABASE_URL: databaseUrl };

  for (const key of inheritedEnvKeys) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }

  return env;
}

const { PrismaClient } = require("@prisma/client");

const { parseMusicLeagueBundle } = require("./parse-bundle");
const { stageImportBundle } = require("./stage-batch");

function createTempBundle(files) {
  const bundlePath = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-stage-bundle-"),
  );

  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(bundlePath, filename), contents, "utf8");
  }

  return bundlePath;
}

async function withTestDatabase(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "music-league-stage-db-"));
  const databasePath = path.join(tempDir, "stage.sqlite");
  const databaseUrl = `file:${databasePath}`;

  execFileSync(prismaCommand, ["migrate", "deploy"], {
    cwd: repoRoot,
    env: createPrismaEnv(databaseUrl),
    stdio: "pipe",
  });

  const prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
  });

  try {
    await run(prisma);
  } finally {
    await prisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test(
  "stages a valid parsed bundle into batch, source-file, and staged-row tables",
  { concurrency: false },
  async () => {
    const bundlePath = createTempBundle({
      "competitors.csv": "ID,Name\nplayer-1,Alice Smith\nplayer-2,Bob Jones\n",
      "rounds.csv":
        "ID,Created,Name,Description,Playlist URL\ngame-42,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
      "submissions.csv":
        "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Wake Up,Switchfoot,player-1,2026-04-03T06:56:48Z,,game-42,Yes\nspotify:track:2,Second Song,Artist B,player-2,2026-04-03T06:57:48Z,Great pick,game-42,No\n",
      "votes.csv":
        "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:1,player-2,2026-04-04T06:18:48Z,3,,game-42\nspotify:track:2,player-1,2026-04-04T06:19:48Z,-1,Too loud,game-42\n",
    });

    const parsedBundle = parseMusicLeagueBundle({ bundlePath });

    await withTestDatabase(async (prisma) => {
      const result = await stageImportBundle({ parsedBundle, prisma });

      assert.deepEqual(result, {
        batchId: 1,
        gameKey: "game-42",
        status: "parsed",
        rowCounts: {
          competitors: 2,
          rounds: 1,
          submissions: 2,
          votes: 2,
          total: 7,
        },
      });

      const batch = await prisma.importBatch.findUniqueOrThrow({
        where: { id: result.batchId },
        include: {
          sourceFiles: {
            orderBy: {
              fileKind: "asc",
            },
          },
          playerRows: {
            orderBy: {
              sourceRowNumber: "asc",
            },
          },
          roundRows: true,
          submissionRows: {
            orderBy: {
              sourceRowNumber: "asc",
            },
          },
          voteRows: {
            orderBy: {
              sourceRowNumber: "asc",
            },
          },
          issues: true,
        },
      });

      assert.equal(batch.sourceType, "music-league-csv");
      assert.equal(batch.sourceFilename, path.basename(bundlePath));
      assert.equal(batch.status, "parsed");
      assert.equal(batch.gameKey, "game-42");
      assert.equal(batch.rowCount, 7);
      assert.equal(batch.issueCount, 0);
      assert.deepEqual(
        batch.sourceFiles.map((file) => ({
          fileKind: file.fileKind,
          filename: file.filename,
          rowCount: file.rowCount,
        })),
        [
          {
            fileKind: "competitors",
            filename: "competitors.csv",
            rowCount: 2,
          },
          {
            fileKind: "rounds",
            filename: "rounds.csv",
            rowCount: 1,
          },
          {
            fileKind: "submissions",
            filename: "submissions.csv",
            rowCount: 2,
          },
          {
            fileKind: "votes",
            filename: "votes.csv",
            rowCount: 2,
          },
        ],
      );
      assert.deepEqual(
        batch.playerRows.map((row) => ({
          sourcePlayerId: row.sourcePlayerId,
          rawName: row.rawName,
          normalizedName: row.normalizedName,
          recordStatus: row.recordStatus,
        })),
        [
          {
            sourcePlayerId: "player-1",
            rawName: "Alice Smith",
            normalizedName: "alice smith",
            recordStatus: "pending",
          },
          {
            sourcePlayerId: "player-2",
            rawName: "Bob Jones",
            normalizedName: "bob jones",
            recordStatus: "pending",
          },
        ],
      );
      assert.equal(batch.roundRows[0].rawOccurredAt.toISOString(), "2026-04-02T22:39:07.000Z");
      assert.deepEqual(
        batch.submissionRows.map((row) => ({
          spotifyUri: row.spotifyUri,
          rawComment: row.rawComment,
          rawVisibleToVoters: row.rawVisibleToVoters,
        })),
        [
          {
            spotifyUri: "spotify:track:1",
            rawComment: null,
            rawVisibleToVoters: true,
          },
          {
            spotifyUri: "spotify:track:2",
            rawComment: "Great pick",
            rawVisibleToVoters: false,
          },
        ],
      );
      assert.deepEqual(
        batch.voteRows.map((row) => ({
          spotifyUri: row.spotifyUri,
          rawPointsAssigned: row.rawPointsAssigned,
          rawComment: row.rawComment,
        })),
        [
          {
            spotifyUri: "spotify:track:1",
            rawPointsAssigned: 3,
            rawComment: null,
          },
          {
            spotifyUri: "spotify:track:2",
            rawPointsAssigned: -1,
            rawComment: "Too loud",
          },
        ],
      );
      assert.deepEqual(batch.issues, []);
    });

    fs.rmSync(bundlePath, { recursive: true, force: true });
  },
);

test(
  "persists parser issues for missing files and headers without mutating canonical tables",
  { concurrency: false },
  async () => {
    const bundlePath = createTempBundle({
      "competitors.csv": "ID,Wrong Name\nplayer-1,Alice\n",
      "rounds.csv": "ID,Created,Name,Description,Playlist URL\ngame-42,,Round 1,,\n",
      "submissions.csv":
        "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\n",
    });

    const parsedBundle = parseMusicLeagueBundle({
      bundlePath,
      sourceLabel: "manual-label",
    });

    await withTestDatabase(async (prisma) => {
      const result = await stageImportBundle({ parsedBundle, prisma });

      assert.equal(result.status, "parsed");
      assert.deepEqual(result.rowCounts, {
        competitors: 0,
        rounds: 1,
        submissions: 0,
        votes: 0,
        total: 1,
      });

      const [batch, issues, canonicalCounts] = await Promise.all([
        prisma.importBatch.findUniqueOrThrow({
          where: { id: result.batchId },
          include: {
            sourceFiles: {
              orderBy: {
                fileKind: "asc",
              },
            },
          },
        }),
        prisma.importIssue.findMany({
          where: {
            importBatchId: result.batchId,
          },
          orderBy: [
            { sourceFileKind: "asc" },
            { sourceRowNumber: "asc" },
          ],
        }),
        Promise.all([
          prisma.player.count(),
          prisma.round.count(),
          prisma.submission.count(),
          prisma.vote.count(),
        ]),
      ]);

      assert.equal(batch.sourceFilename, "manual-label");
      assert.equal(batch.rowCount, 1);
      assert.equal(batch.issueCount, 2);
      assert.deepEqual(
        batch.sourceFiles.map((file) => ({
          fileKind: file.fileKind,
          rowCount: file.rowCount,
        })),
        [
          { fileKind: "competitors", rowCount: 1 },
          { fileKind: "rounds", rowCount: 1 },
          { fileKind: "submissions", rowCount: 0 },
          { fileKind: "votes", rowCount: 0 },
        ],
      );
      assert.deepEqual(
        issues.map((issue) => ({
          sourceFileKind: issue.sourceFileKind,
          sourceRowNumber: issue.sourceRowNumber,
          recordKind: issue.recordKind,
          issueCode: issue.issueCode,
          blocking: issue.blocking,
          message: issue.message,
        })),
        [
          {
            sourceFileKind: "competitors",
            sourceRowNumber: null,
            recordKind: "batch",
            issueCode: "missing_header",
            blocking: true,
            message: "Missing required header: Name",
          },
          {
            sourceFileKind: "votes",
            sourceRowNumber: null,
            recordKind: "batch",
            issueCode: "missing_file",
            blocking: true,
            message: "Missing required file: votes.csv",
          },
        ],
      );
      assert.deepEqual(canonicalCounts, [0, 0, 0, 0]);
    });

    fs.rmSync(bundlePath, { recursive: true, force: true });
  },
);

test(
  "turns duplicate source keys into blocking issues and skips duplicate staged rows",
  { concurrency: false },
  async () => {
    const bundlePath = createTempBundle({
      "competitors.csv":
        "ID,Name\nplayer-1,Alice\nplayer-1,Alice Duplicate\nplayer-2,Bob\n",
      "rounds.csv":
        "ID,Created,Name,Description,Playlist URL\ngame-42,2026-04-02T22:39:07Z,Round 1,,\ngame-42,2026-04-03T22:39:07Z,Round 1 duplicate,,\n",
      "submissions.csv":
        "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Song 1,Artist 1,player-1,2026-04-03T06:56:48Z,,game-42,Yes\nspotify:track:1,Song 1 duplicate,Artist 1,player-1,2026-04-03T06:57:48Z,Duplicate row,game-42,No\nspotify:track:2,Song 2,Artist 2,player-2,2026-04-03T06:58:48Z,,game-42,Yes\n",
      "votes.csv":
        "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:1,player-2,2026-04-04T06:18:48Z,3,,game-42\nspotify:track:1,player-2,2026-04-04T06:19:48Z,5,Duplicate row,game-42\nspotify:track:2,player-1,2026-04-04T06:20:48Z,2,,game-42\n",
    });

    const parsedBundle = parseMusicLeagueBundle({ bundlePath });

    await withTestDatabase(async (prisma) => {
      const result = await stageImportBundle({ parsedBundle, prisma });

      assert.deepEqual(result.rowCounts, {
        competitors: 2,
        rounds: 1,
        submissions: 2,
        votes: 2,
        total: 7,
      });

      const [batch, issues, stagedCounts] = await Promise.all([
        prisma.importBatch.findUniqueOrThrow({
          where: { id: result.batchId },
        }),
        prisma.importIssue.findMany({
          where: {
            importBatchId: result.batchId,
            issueCode: "duplicate_source_row",
          },
          orderBy: [
            { sourceFileKind: "asc" },
            { sourceRowNumber: "asc" },
          ],
        }),
        Promise.all([
          prisma.importPlayerRow.count(),
          prisma.importRoundRow.count(),
          prisma.importSubmissionRow.count(),
          prisma.importVoteRow.count(),
        ]),
      ]);

      assert.equal(batch.status, "parsed");
      assert.equal(batch.rowCount, 7);
      assert.equal(batch.issueCount, 4);
      assert.deepEqual(stagedCounts, [2, 1, 2, 2]);
      assert.deepEqual(
        issues.map((issue) => ({
          sourceFileKind: issue.sourceFileKind,
          sourceRowNumber: issue.sourceRowNumber,
          recordKind: issue.recordKind,
          issueCode: issue.issueCode,
        })),
        [
          {
            sourceFileKind: "competitors",
            sourceRowNumber: 3,
            recordKind: "player",
            issueCode: "duplicate_source_row",
          },
          {
            sourceFileKind: "rounds",
            sourceRowNumber: 3,
            recordKind: "round",
            issueCode: "duplicate_source_row",
          },
          {
            sourceFileKind: "submissions",
            sourceRowNumber: 3,
            recordKind: "submission",
            issueCode: "duplicate_source_row",
          },
          {
            sourceFileKind: "votes",
            sourceRowNumber: 3,
            recordKind: "vote",
            issueCode: "duplicate_source_row",
          },
        ],
      );
      assert.match(issues[0].message, /Duplicate source row for key:/);
    });

    fs.rmSync(bundlePath, { recursive: true, force: true });
  },
);

test(
  "detects duplicate source keys even when an earlier row was excluded from typed parse output",
  { concurrency: false },
  async () => {
    const bundlePath = createTempBundle({
      "competitors.csv": "ID,Name\nplayer-1,Alice\n",
      "rounds.csv":
        "ID,Created,Name,Description,Playlist URL\ngame-42,2026-04-02T22:39:07Z,Round 1,,\n",
      "submissions.csv":
        "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Song 1,Artist 1,player-1,2026-04-03T06:56:48Z,,game-42,Maybe\nspotify:track:1,Song 1 retry,Artist 1,player-1,2026-04-03T06:57:48Z,,game-42,Yes\nspotify:track:2,Song 2,Artist 2,player-1,2026-04-03T06:58:48Z,,game-42,Yes\n",
      "votes.csv":
        "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:2,player-1,2026-04-04T06:19:48Z,5,,game-42\n",
    });

    const parsedBundle = parseMusicLeagueBundle({ bundlePath });

    await withTestDatabase(async (prisma) => {
      const result = await stageImportBundle({ parsedBundle, prisma });

      assert.deepEqual(result.rowCounts, {
        competitors: 1,
        rounds: 1,
        submissions: 1,
        votes: 1,
        total: 4,
      });

      const [batch, issues, stagedSubmissionRows] = await Promise.all([
        prisma.importBatch.findUniqueOrThrow({
          where: { id: result.batchId },
        }),
        prisma.importIssue.findMany({
          where: {
            importBatchId: result.batchId,
            sourceFileKind: "submissions",
          },
          orderBy: [{ sourceRowNumber: "asc" }, { issueCode: "asc" }],
        }),
        prisma.importSubmissionRow.findMany({
          orderBy: {
            sourceRowNumber: "asc",
          },
        }),
      ]);

      assert.equal(batch.status, "parsed");
      assert.equal(batch.rowCount, 4);
      assert.equal(batch.issueCount, 2);
      assert.deepEqual(
        issues.map((issue) => ({
          sourceRowNumber: issue.sourceRowNumber,
          issueCode: issue.issueCode,
        })),
        [
          {
            sourceRowNumber: 2,
            issueCode: "invalid_scalar",
          },
          {
            sourceRowNumber: 3,
            issueCode: "duplicate_source_row",
          },
        ],
      );
      assert.deepEqual(
        stagedSubmissionRows.map((row) => ({
          sourceRowNumber: row.sourceRowNumber,
          spotifyUri: row.spotifyUri,
        })),
        [
          {
            sourceRowNumber: 4,
            spotifyUri: "spotify:track:2",
          },
        ],
      );
    });

    fs.rmSync(bundlePath, { recursive: true, force: true });
  },
);
