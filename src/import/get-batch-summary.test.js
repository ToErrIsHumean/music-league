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
const { commitImportBatch } = require("./commit-batch");
const { getImportBatchSummary } = require("./get-batch-summary");
const { listImportBatchIssues } = require("./list-batch-issues");
const { parseMusicLeagueBundle } = require("./parse-bundle");
const { stageImportBundle } = require("./stage-batch");

function createTempBundle(files) {
  const bundlePath = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-summary-bundle-"),
  );

  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(bundlePath, filename), contents, "utf8");
  }

  return bundlePath;
}

async function withTestDatabase(run) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-summary-db-"),
  );
  const databasePath = path.join(tempDir, "summary.sqlite");
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
      leagueSlug: "game-42",
      name: "Legacy Rediscovered",
      sourceRoundId: "game-42",
    },
  });

  return {
    matchedPlayer,
    matchedArtist,
    matchedSong,
    matchedRound,
  };
}

function createCleanBundle() {
  return createTempBundle({
    "competitors.csv": "ID,Name\nplayer-1,Alice Smith\nplayer-2,Bob Jones\n",
    "rounds.csv":
      "ID,Created,Name,Description,Playlist URL\ngame-42,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Wake Up,Switchfoot,player-1,2026-04-03T06:56:48Z,,game-42,Yes\nspotify:track:2,Second Song,Artist B,player-2,2026-04-03T06:57:48Z,Great pick,game-42,No\n",
    "votes.csv":
      "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:1,player-2,2026-04-04T06:18:48Z,3,,game-42\nspotify:track:2,player-1,2026-04-04T06:19:48Z,-1,Too loud,game-42\n",
  });
}

function createFailedBundle() {
  return createTempBundle({
    "competitors.csv": "ID,Name\nplayer-1,Alice Smith\nplayer-2,Bob Jones\n",
    "rounds.csv":
      "ID,Created,Name,Description,Playlist URL\ngame-42,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Wake Up,Switchfoot,player-1,2026-04-03T06:56:48Z,,game-42,Yes\n",
    "votes.csv":
      "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:2,player-2,2026-04-04T06:18:48Z,3,,game-42\nspotify:track:2,player-2,2026-04-04T06:19:48Z,5,Duplicate row,game-42\n",
  });
}

test(
  "summarizes a parsed batch with validation awaiting system work",
  { concurrency: false },
  async () => {
    const bundlePath = createCleanBundle();

    try {
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      await withTestDatabase(async (prisma) => {
        const staged = await stageImportBundle({ parsedBundle, prisma });
        const summary = await getImportBatchSummary(staged.batchId, { prisma });

        assert.deepEqual(summary, {
          batchId: staged.batchId,
          gameKey: "game-42",
          status: "parsed",
          workflow: {
            stages: {
              parse: "complete",
              stage: "complete",
              validate: "current",
              commit: "pending",
            },
            awaiting: "system",
          },
          rowCounts: {
            competitors: 2,
            rounds: 1,
            submissions: 2,
            votes: 2,
            total: 7,
          },
          matchCounts: {
            matched: 0,
            newEntities: 0,
            openIssues: 0,
          },
          createdEntityPlan: {
            players: 0,
            rounds: 0,
            artists: 0,
            songs: 0,
          },
          committedEntityCounts: {
            players: 0,
            rounds: 0,
            artists: 0,
            songs: 0,
            submissionsUpserted: 0,
            votesUpserted: 0,
          },
          affectedRounds: [],
          failureStage: null,
          failureSummary: null,
        });
      });
    } finally {
      fs.rmSync(bundlePath, { recursive: true, force: true });
    }
  },
);

test(
  "summarizes a ready batch with derived match counts and affected rounds",
  { concurrency: false },
  async () => {
    const bundlePath = createCleanBundle();

    try {
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      await withTestDatabase(async (prisma) => {
        const matched = await seedMatchedReferenceData(prisma);
        const staged = await stageImportBundle({ parsedBundle, prisma });

        await analyzeImportBatch(staged.batchId, { prisma });

        const summary = await getImportBatchSummary(staged.batchId, { prisma });

        assert.deepEqual(summary, {
          batchId: staged.batchId,
          gameKey: "game-42",
          status: "ready",
          workflow: {
            stages: {
              parse: "complete",
              stage: "complete",
              validate: "complete",
              commit: "pending",
            },
            awaiting: "none",
          },
          rowCounts: {
            competitors: 2,
            rounds: 1,
            submissions: 2,
            votes: 2,
            total: 7,
          },
          matchCounts: {
            matched: 4,
            newEntities: 3,
            openIssues: 0,
          },
          createdEntityPlan: {
            players: 1,
            rounds: 0,
            artists: 1,
            songs: 1,
          },
          committedEntityCounts: {
            players: 0,
            rounds: 0,
            artists: 0,
            songs: 0,
            submissionsUpserted: 0,
            votesUpserted: 0,
          },
          affectedRounds: [matched.matchedRound.id],
          failureStage: null,
          failureSummary: null,
        });
      });
    } finally {
      fs.rmSync(bundlePath, { recursive: true, force: true });
    }
  },
);

test(
  "exposes failed workflow state through issue, summary, and commit service contracts",
  { concurrency: false },
  async () => {
    const bundlePath = createFailedBundle();

    try {
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      await withTestDatabase(async (prisma) => {
        const staged = await stageImportBundle({ parsedBundle, prisma });

        assert.equal(staged.status, "parsed");

        const analyzed = await analyzeImportBatch(staged.batchId, { prisma });
        const issues = await listImportBatchIssues(staged.batchId, { prisma });
        const summary = await getImportBatchSummary(staged.batchId, { prisma });

        assert.equal(analyzed.status, "failed");
        assert.equal(issues.length, 2);
        assert.deepEqual(summary, {
          batchId: staged.batchId,
          gameKey: "game-42",
          status: "failed",
          workflow: {
            stages: {
              parse: "complete",
              stage: "complete",
              validate: "current",
              commit: "pending",
            },
            awaiting: "none",
          },
          rowCounts: {
            competitors: 2,
            rounds: 1,
            submissions: 1,
            votes: 2,
            total: 5,
          },
          matchCounts: {
            matched: 0,
            newEntities: 5,
            openIssues: 2,
          },
          createdEntityPlan: {
            players: 2,
            rounds: 1,
            artists: 1,
            songs: 1,
          },
          committedEntityCounts: {
            players: 0,
            rounds: 0,
            artists: 0,
            songs: 0,
            submissionsUpserted: 0,
            votesUpserted: 0,
          },
          affectedRounds: [],
          failureStage: "validate",
          failureSummary: "Validation found 2 blocking issue(s)",
        });

        await assert.rejects(
          () => commitImportBatch(staged.batchId, { prisma }),
          /commitImportBatch: batch status is not ready: /,
        );
      });
    } finally {
      fs.rmSync(bundlePath, { recursive: true, force: true });
    }
  },
);

test(
  "summarizes committed batches with persisted commit snapshots",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const roundOne = await prisma.round.create({
        data: {
          leagueSlug: "game-committed",
          name: "Round One",
          sourceRoundId: "round-one",
        },
      });
      const roundTwo = await prisma.round.create({
        data: {
          leagueSlug: "game-committed",
          name: "Round Two",
          sourceRoundId: "round-two",
        },
      });
      const batch = await prisma.importBatch.create({
        data: {
          sourceType: "music-league-csv",
          sourceFilename: "committed-bundle",
          gameKey: "game-committed",
          status: "committed",
          rowCount: 6,
          issueCount: 0,
          createdPlayerCount: 1,
          createdRoundCount: 2,
          createdArtistCount: 1,
          createdSongCount: 2,
          submissionsUpsertedCount: 2,
          votesUpsertedCount: 2,
          committedAt: new Date("2026-04-17T02:00:00.000Z"),
        },
      });

      await prisma.importSourceFile.createMany({
        data: [
          {
            importBatchId: batch.id,
            fileKind: "competitors",
            filename: "competitors.csv",
            rowCount: 1,
          },
          {
            importBatchId: batch.id,
            fileKind: "rounds",
            filename: "rounds.csv",
            rowCount: 2,
          },
          {
            importBatchId: batch.id,
            fileKind: "submissions",
            filename: "submissions.csv",
            rowCount: 2,
          },
          {
            importBatchId: batch.id,
            fileKind: "votes",
            filename: "votes.csv",
            rowCount: 1,
          },
        ],
      });

      await prisma.importRoundRow.createMany({
        data: [
          {
            importBatchId: batch.id,
            sourceRowNumber: 2,
            sourceRoundId: "round-one",
            rawName: "Round One",
            recordStatus: "ready",
            matchedRoundId: roundOne.id,
          },
          {
            importBatchId: batch.id,
            sourceRowNumber: 3,
            sourceRoundId: "round-two",
            rawName: "Round Two",
            recordStatus: "ready",
            matchedRoundId: roundTwo.id,
          },
        ],
      });

      const summary = await getImportBatchSummary(batch.id, { prisma });

      assert.deepEqual(summary, {
        batchId: batch.id,
        gameKey: "game-committed",
        status: "committed",
        workflow: {
          stages: {
            parse: "complete",
            stage: "complete",
            validate: "complete",
            commit: "complete",
          },
          awaiting: "none",
        },
        rowCounts: {
          competitors: 1,
          rounds: 2,
          submissions: 2,
          votes: 1,
          total: 6,
        },
        matchCounts: {
          matched: 2,
          newEntities: 6,
          openIssues: 0,
        },
        createdEntityPlan: {
          players: 1,
          rounds: 2,
          artists: 1,
          songs: 2,
        },
        committedEntityCounts: {
          players: 1,
          rounds: 2,
          artists: 1,
          songs: 2,
          submissionsUpserted: 2,
          votesUpserted: 2,
        },
        affectedRounds: [roundOne.id, roundTwo.id],
        failureStage: null,
        failureSummary: null,
      });
    });
  },
);

test(
  "throws when summarizing a batch that does not exist",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      await assert.rejects(
        () => getImportBatchSummary(9999, { prisma }),
        /getImportBatchSummary: batch not found: 9999/,
      );
    });
  },
);
