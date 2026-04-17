const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const { PrismaClient } = require("@prisma/client");

const { normalize } = require("../lib/normalize");
const { analyzeImportBatch } = require("./analyze-batch");
const { parseMusicLeagueBundle } = require("./parse-bundle");
const { stageImportBundle } = require("./stage-batch");

function createTempBundle(files) {
  const bundlePath = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-analyze-bundle-"),
  );

  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(bundlePath, filename), contents, "utf8");
  }

  return bundlePath;
}

async function withTestDatabase(run) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-analyze-db-"),
  );
  const databasePath = path.join(tempDir, "analyze.sqlite");
  const databaseUrl = `file:${databasePath}`;

  execFileSync(prismaCommand, ["prisma", "migrate", "deploy"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
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

async function seedMatchedReferenceData(prisma) {
  const matchedGame = await prisma.game.create({
    data: {
      sourceGameId: "game-42",
    },
  });
  const matchedPlayer = await prisma.player.create({
    data: {
      displayName: "Alice Smith",
      normalizedName: normalize("Alice Smith"),
      sourcePlayerId: "player-1",
    },
  });
  const matchedArtist = await prisma.artist.create({
    data: {
      name: "Switchfoot",
      normalizedName: normalize("Switchfoot"),
    },
  });
  const matchedSong = await prisma.song.create({
    data: {
      title: "Wake Up",
      normalizedTitle: normalize("Wake Up"),
      artistId: matchedArtist.id,
      spotifyUri: "spotify:track:1",
    },
  });
  const matchedRound = await prisma.round.create({
    data: {
      gameId: matchedGame.id,
      leagueSlug: "game-42",
      name: "Legacy Rediscovered",
      sourceRoundId: "game-42",
    },
  });

  return {
    matchedArtist,
    matchedGame,
    matchedPlayer,
    matchedRound,
    matchedSong,
  };
}

test(
  "analyzes a clean staged bundle to ready without canonical-table writes",
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

    try {
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      await withTestDatabase(async (prisma) => {
        const matched = await seedMatchedReferenceData(prisma);
        const staged = await stageImportBundle({ parsedBundle, prisma });
        const result = await analyzeImportBatch(staged.batchId, { prisma });

        assert.deepEqual(result, {
          batchId: staged.batchId,
          status: "ready",
          summary: {
            matchedPlayers: 1,
            createdPlayers: 1,
            matchedRounds: 1,
            createdRounds: 0,
            matchedSongs: 1,
            createdSongs: 1,
            matchedArtists: 1,
            createdArtists: 1,
            openBlockingIssues: 0,
          },
        });

        const [batch, playerRows, roundRows, submissionRows, voteRows, canonicalCounts] =
          await Promise.all([
            prisma.importBatch.findUniqueOrThrow({
              where: { id: staged.batchId },
            }),
            prisma.importPlayerRow.findMany({
              where: { importBatchId: staged.batchId },
              orderBy: { sourceRowNumber: "asc" },
            }),
            prisma.importRoundRow.findMany({
              where: { importBatchId: staged.batchId },
            }),
            prisma.importSubmissionRow.findMany({
              where: { importBatchId: staged.batchId },
              orderBy: { sourceRowNumber: "asc" },
            }),
            prisma.importVoteRow.findMany({
              where: { importBatchId: staged.batchId },
              orderBy: { sourceRowNumber: "asc" },
            }),
            Promise.all([
              prisma.player.count(),
              prisma.round.count(),
              prisma.artist.count(),
              prisma.song.count(),
              prisma.submission.count(),
              prisma.vote.count(),
            ]),
          ]);

        assert.equal(batch.status, "ready");
        assert.equal(batch.issueCount, 0);
        assert.equal(batch.failureStage, null);
        assert.equal(batch.failureSummary, null);
        assert.equal(batch.createdPlayerCount, 1);
        assert.equal(batch.createdRoundCount, 0);
        assert.equal(batch.createdArtistCount, 1);
        assert.equal(batch.createdSongCount, 1);
        assert.deepEqual(
          playerRows.map((row) => ({
            sourcePlayerId: row.sourcePlayerId,
            recordStatus: row.recordStatus,
            matchedPlayerId: row.matchedPlayerId,
          })),
          [
            {
              sourcePlayerId: "player-1",
              recordStatus: "ready",
              matchedPlayerId: matched.matchedPlayer.id,
            },
            {
              sourcePlayerId: "player-2",
              recordStatus: "ready",
              matchedPlayerId: null,
            },
          ],
        );
        assert.equal(roundRows[0].recordStatus, "ready");
        assert.equal(roundRows[0].matchedRoundId, matched.matchedRound.id);
        assert.deepEqual(
          submissionRows.map((row) => ({
            spotifyUri: row.spotifyUri,
            recordStatus: row.recordStatus,
            matchedSongId: row.matchedSongId,
            matchedArtistId: row.matchedArtistId,
          })),
          [
            {
              spotifyUri: "spotify:track:1",
              recordStatus: "ready",
              matchedSongId: matched.matchedSong.id,
              matchedArtistId: matched.matchedArtist.id,
            },
            {
              spotifyUri: "spotify:track:2",
              recordStatus: "ready",
              matchedSongId: null,
              matchedArtistId: null,
            },
          ],
        );
        assert.deepEqual(
          voteRows.map((row) => ({
            spotifyUri: row.spotifyUri,
            recordStatus: row.recordStatus,
            matchedSongId: row.matchedSongId,
          })),
          [
            {
              spotifyUri: "spotify:track:1",
              recordStatus: "ready",
              matchedSongId: matched.matchedSong.id,
            },
            {
              spotifyUri: "spotify:track:2",
              recordStatus: "ready",
              matchedSongId: null,
            },
          ],
        );
        assert.deepEqual(canonicalCounts, [1, 1, 1, 1, 0, 0]);
      });
    } finally {
      fs.rmSync(bundlePath, { recursive: true, force: true });
    }
  },
);

test(
  "fails validation when parser issues already recorded for missing files and headers",
  { concurrency: false },
  async () => {
    const bundlePath = createTempBundle({
      "competitors.csv": "ID,Wrong Name\nplayer-1,Alice\n",
      "rounds.csv": "ID,Created,Name,Description,Playlist URL\ngame-42,,Round 1,,\n",
      "submissions.csv":
        "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\n",
    });

    try {
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      await withTestDatabase(async (prisma) => {
        const staged = await stageImportBundle({ parsedBundle, prisma });
        const result = await analyzeImportBatch(staged.batchId, { prisma });

        assert.equal(result.status, "failed");
        assert.equal(result.summary.openBlockingIssues, 2);

        const [batch, issues, canonicalCounts] = await Promise.all([
          prisma.importBatch.findUniqueOrThrow({
            where: { id: staged.batchId },
          }),
          prisma.importIssue.findMany({
            where: { importBatchId: staged.batchId },
            orderBy: [{ sourceFileKind: "asc" }, { sourceRowNumber: "asc" }],
          }),
          Promise.all([
            prisma.player.count(),
            prisma.round.count(),
            prisma.artist.count(),
            prisma.song.count(),
            prisma.submission.count(),
            prisma.vote.count(),
          ]),
        ]);

        assert.equal(batch.status, "failed");
        assert.equal(batch.failureStage, "validate");
        assert.match(batch.failureSummary, /Validation found 2 blocking issue/);
        assert.deepEqual(
          issues.map((issue) => issue.issueCode),
          ["missing_header", "missing_file"],
        );
        assert.deepEqual(canonicalCounts, [0, 0, 0, 0, 0, 0]);

        const firstIssueIds = issues.map((issue) => issue.id);

        const repeatedResult = await analyzeImportBatch(staged.batchId, { prisma });
        assert.equal(repeatedResult.status, "failed");
        assert.equal(repeatedResult.summary.openBlockingIssues, 2);

        const repeatedIssues = await prisma.importIssue.findMany({
          where: { importBatchId: staged.batchId },
          orderBy: [{ sourceFileKind: "asc" }, { sourceRowNumber: "asc" }],
        });

        assert.deepEqual(
          repeatedIssues.map((issue) => issue.issueCode),
          ["missing_header", "missing_file"],
        );
        assert.notDeepEqual(
          repeatedIssues.map((issue) => issue.id),
          firstIssueIds,
        );
      });
    } finally {
      fs.rmSync(bundlePath, { recursive: true, force: true });
    }
  },
);

test(
  "fails validation when a vote cannot resolve to a submission and replaces that issue on re-analysis",
  { concurrency: false },
  async () => {
    const bundlePath = createTempBundle({
      "competitors.csv": "ID,Name\nplayer-1,Alice Smith\nplayer-2,Bob Jones\n",
      "rounds.csv":
        "ID,Created,Name,Description,Playlist URL\ngame-42,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
      "submissions.csv":
        "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Wake Up,Switchfoot,player-1,2026-04-03T06:56:48Z,,game-42,Yes\n",
      "votes.csv":
        "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:2,player-2,2026-04-04T06:18:48Z,3,,game-42\n",
    });

    try {
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      await withTestDatabase(async (prisma) => {
        const staged = await stageImportBundle({ parsedBundle, prisma });
        const failedResult = await analyzeImportBatch(staged.batchId, { prisma });

        assert.equal(failedResult.status, "failed");
        assert.equal(failedResult.summary.openBlockingIssues, 1);

        let issues = await prisma.importIssue.findMany({
          where: {
            importBatchId: staged.batchId,
            issueCode: "unresolved_ref",
          },
        });
        assert.equal(issues.length, 1);

        let voteRow = await prisma.importVoteRow.findFirstOrThrow({
          where: { importBatchId: staged.batchId },
        });
        assert.equal(voteRow.recordStatus, "blocked");

        await prisma.importVoteRow.update({
          where: { id: voteRow.id },
          data: {
            spotifyUri: "spotify:track:1",
          },
        });

        const readyResult = await analyzeImportBatch(staged.batchId, { prisma });

        assert.equal(readyResult.status, "ready");
        assert.equal(readyResult.summary.openBlockingIssues, 0);

        issues = await prisma.importIssue.findMany({
          where: {
            importBatchId: staged.batchId,
            issueCode: "unresolved_ref",
          },
        });
        assert.equal(issues.length, 0);

        voteRow = await prisma.importVoteRow.findFirstOrThrow({
          where: { importBatchId: staged.batchId },
        });
        assert.equal(voteRow.recordStatus, "ready");
      });
    } finally {
      fs.rmSync(bundlePath, { recursive: true, force: true });
    }
  },
);

test(
  "raises identity conflicts for player rows that collide with canonical normalized names",
  { concurrency: false },
  async () => {
    const bundlePath = createTempBundle({
      "competitors.csv": "ID,Name\nplayer-new,Alice Smith\n",
      "rounds.csv":
        "ID,Created,Name,Description,Playlist URL\ngame-42,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
      "submissions.csv":
        "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\n",
      "votes.csv": "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\n",
    });

    try {
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      await withTestDatabase(async (prisma) => {
        await prisma.player.create({
          data: {
            displayName: "Alice Smith",
            normalizedName: normalize("Alice Smith"),
            sourcePlayerId: "player-existing",
          },
        });

        const staged = await stageImportBundle({ parsedBundle, prisma });
        const result = await analyzeImportBatch(staged.batchId, { prisma });

        assert.equal(result.status, "failed");
        assert.equal(result.summary.openBlockingIssues, 1);

        const [playerRow, issue] = await Promise.all([
          prisma.importPlayerRow.findFirstOrThrow({
            where: { importBatchId: staged.batchId },
          }),
          prisma.importIssue.findFirstOrThrow({
            where: {
              importBatchId: staged.batchId,
              issueCode: "identity_conflict",
            },
          }),
        ]);

        assert.equal(playerRow.recordStatus, "blocked");
        assert.equal(issue.sourceFileKind, "competitors");
        assert.equal(issue.recordKind, "player");
      });
    } finally {
      fs.rmSync(bundlePath, { recursive: true, force: true });
    }
  },
);
