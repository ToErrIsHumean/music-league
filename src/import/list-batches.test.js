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

const { normalize } = require("../lib/normalize");
const { analyzeImportBatch } = require("./analyze-batch");
const { listImportBatches } = require("./list-batches");
const { parseMusicLeagueBundle } = require("./parse-bundle");
const { stageImportBundle } = require("./stage-batch");

function createTempBundle(prefix, files) {
  const bundlePath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(bundlePath, filename), contents, "utf8");
  }

  return bundlePath;
}

async function withTestDatabase(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "music-league-history-db-"));
  const databasePath = path.join(tempDir, "history.sqlite");
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

async function seedMatchedReferenceData(prisma) {
  const matchedGame = await prisma.game.create({
    data: {
      sourceGameId: "game-ready",
    },
  });
  const matchedArtist = await prisma.artist.create({
    data: {
      name: "Switchfoot",
      normalizedName: normalize("Switchfoot"),
    },
  });

  await prisma.player.create({
    data: {
      displayName: "Alice Smith",
      normalizedName: normalize("Alice Smith"),
      sourcePlayerId: "player-1",
    },
  });

  await prisma.song.create({
    data: {
      title: "Wake Up",
      normalizedTitle: normalize("Wake Up"),
      artistId: matchedArtist.id,
      spotifyUri: "spotify:track:1",
    },
  });

  await prisma.round.create({
    data: {
      gameId: matchedGame.id,
      leagueSlug: "game-ready",
      name: "Legacy Rediscovered",
      sourceRoundId: "game-ready",
    },
  });
}

function createParsedBundle() {
  return createTempBundle("music-league-history-parsed-", {
    "competitors.csv": "ID,Name\nplayer-1,Alice Smith\n",
    "rounds.csv":
      "ID,Created,Name,Description,Playlist URL\ngame-parsed,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Wake Up,Switchfoot,player-1,2026-04-03T06:56:48Z,,game-parsed,Yes\n",
    "votes.csv":
      "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:1,player-1,2026-04-04T06:18:48Z,3,,game-parsed\n",
  });
}

function createFailedBundle() {
  return createTempBundle("music-league-history-failed-", {
    "competitors.csv": "ID,Name\nplayer-1,Alice Smith\nplayer-2,Bob Jones\n",
    "rounds.csv":
      "ID,Created,Name,Description,Playlist URL\ngame-failed,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Wake Up,Switchfoot,player-1,2026-04-03T06:56:48Z,,game-failed,Yes\n",
    "votes.csv":
      "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:2,player-2,2026-04-04T06:18:48Z,3,,game-failed\nspotify:track:2,player-2,2026-04-04T06:19:48Z,5,Duplicate row,game-failed\n",
  });
}

function createReadyBundle() {
  return createTempBundle("music-league-history-ready-", {
    "competitors.csv": "ID,Name\nplayer-1,Alice Smith\nplayer-2,Bob Jones\n",
    "rounds.csv":
      "ID,Created,Name,Description,Playlist URL\ngame-ready,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Wake Up,Switchfoot,player-1,2026-04-03T06:56:48Z,,game-ready,Yes\nspotify:track:2,Second Song,Artist B,player-2,2026-04-03T06:57:48Z,Great pick,game-ready,No\n",
    "votes.csv":
      "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:1,player-2,2026-04-04T06:18:48Z,3,,game-ready\nspotify:track:2,player-1,2026-04-04T06:19:48Z,-1,Too loud,game-ready\n",
  });
}

test(
  "lists import batches with filters, newest-first ordering, and zeroed uncommitted snapshots",
  { concurrency: false },
  async () => {
    const parsedBundlePath = createParsedBundle();
    const failedBundlePath = createFailedBundle();
    const readyBundlePath = createReadyBundle();

    try {
      await withTestDatabase(async (prisma) => {
        const parsedBatch = await stageImportBundle({
          parsedBundle: parseMusicLeagueBundle({ bundlePath: parsedBundlePath }),
          prisma,
        });
        const failedBatch = await stageImportBundle({
          parsedBundle: parseMusicLeagueBundle({ bundlePath: failedBundlePath }),
          prisma,
        });

        await analyzeImportBatch(failedBatch.batchId, { prisma });
        await seedMatchedReferenceData(prisma);

        const readyBatch = await stageImportBundle({
          parsedBundle: parseMusicLeagueBundle({ bundlePath: readyBundlePath }),
          prisma,
        });

        await analyzeImportBatch(readyBatch.batchId, { prisma });

        const committedAt = new Date("2026-04-17T03:00:00.000Z");
        const committedBatch = await prisma.importBatch.create({
          data: {
            sourceType: "music-league-csv",
            sourceFilename: "committed-history-bundle",
            gameKey: "game-committed",
            status: "committed",
            rowCount: 8,
            issueCount: 0,
            createdPlayerCount: 2,
            createdRoundCount: 2,
            createdArtistCount: 1,
            createdSongCount: 2,
            submissionsUpsertedCount: 3,
            votesUpsertedCount: 4,
            committedAt,
          },
        });

        const history = await listImportBatches({ prisma });

        assert.equal(history.length, 4);
        assert.deepEqual(
          history.map((batch) => ({
            batchId: batch.batchId,
            status: batch.status,
          })),
          [
            {
              batchId: committedBatch.id,
              status: "committed",
            },
            {
              batchId: readyBatch.batchId,
              status: "ready",
            },
            {
              batchId: failedBatch.batchId,
              status: "failed",
            },
            {
              batchId: parsedBatch.batchId,
              status: "parsed",
            },
          ],
        );

        assert.deepEqual(history[0].createdCounts, {
          players: 2,
          rounds: 2,
          artists: 1,
          songs: 2,
          submissionsUpserted: 3,
          votesUpserted: 4,
        });
        assert.equal(history[0].committedAt?.toISOString(), committedAt.toISOString());

        assert.deepEqual(history[1].createdCounts, {
          players: 0,
          rounds: 0,
          artists: 0,
          songs: 0,
          submissionsUpserted: 0,
          votesUpserted: 0,
        });
        assert.equal(history[1].issueCount, 0);

        assert.equal(history[2].failureStage, "validate");
        assert.equal(history[2].failureSummary, "Validation found 2 blocking issue(s)");
        assert.equal(history[2].issueCount, 2);
        assert.deepEqual(history[2].createdCounts, {
          players: 0,
          rounds: 0,
          artists: 0,
          songs: 0,
          submissionsUpserted: 0,
          votesUpserted: 0,
        });

        assert.equal(history[3].sourceFilename, path.basename(parsedBundlePath));
        assert.equal(history[3].rowCount, 4);
        assert.equal(history[3].createdAt instanceof Date, true);
        assert.equal(history[3].updatedAt instanceof Date, true);

        const failedOnly = await listImportBatches({
          statuses: ["failed"],
          prisma,
        });

        assert.deepEqual(
          failedOnly.map((batch) => batch.batchId),
          [failedBatch.batchId],
        );

        const limited = await listImportBatches({
          limit: 2,
          prisma,
        });

        assert.equal(limited.length, 2);
        assert.deepEqual(
          limited.map((batch) => batch.batchId),
          [committedBatch.id, readyBatch.batchId],
        );
      });
    } finally {
      fs.rmSync(parsedBundlePath, { recursive: true, force: true });
      fs.rmSync(failedBundlePath, { recursive: true, force: true });
      fs.rmSync(readyBundlePath, { recursive: true, force: true });
    }
  },
);
