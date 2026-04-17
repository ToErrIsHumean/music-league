const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const { PrismaClient } = require("@prisma/client");

const { analyzeImportBatch } = require("./analyze-batch");
const { commitImportBatch } = require("./commit-batch");
const { listImportBatchIssues } = require("./list-batch-issues");
const { parseMusicLeagueBundle } = require("./parse-bundle");
const { stageImportBundle } = require("./stage-batch");

function createTempBundle(files) {
  const bundlePath = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-list-issues-bundle-"),
  );

  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(bundlePath, filename), contents, "utf8");
  }

  return bundlePath;
}

async function withTestDatabase(run) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-list-issues-db-"),
  );
  const databasePath = path.join(tempDir, "list-issues.sqlite");
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

test(
  "lists staged-row previews when available and falls back to stored preview JSON otherwise",
  { concurrency: false },
  async () => {
    const bundlePath = createTempBundle({
      "competitors.csv": "ID,Name\nplayer-1,Alice Smith\nplayer-2,Bob Jones\n",
      "rounds.csv":
        "ID,Created,Name,Description,Playlist URL\ngame-42,2026-04-02T22:39:07Z,Rediscovered,Find old favorites,https://example.com/playlist\n",
      "submissions.csv":
        "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Wake Up,Switchfoot,player-1,2026-04-03T06:56:48Z,,game-42,Yes\n",
      "votes.csv":
        "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:2,player-2,2026-04-04T06:18:48Z,3,,game-42\nspotify:track:2,player-2,2026-04-04T06:19:48Z,5,Duplicate row,game-42\n",
    });

    try {
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      await withTestDatabase(async (prisma) => {
        const staged = await stageImportBundle({ parsedBundle, prisma });

        assert.equal(staged.status, "parsed");

        const analyzed = await analyzeImportBatch(staged.batchId, { prisma });

        assert.equal(analyzed.status, "failed");
        assert.equal(analyzed.summary.openBlockingIssues, 2);

        const issues = await listImportBatchIssues(staged.batchId, { prisma });

        assert.deepEqual(
          issues.map((issue) => ({
            sourceFileKind: issue.sourceFileKind,
            sourceRowNumber: issue.sourceRowNumber,
            issueCode: issue.issueCode,
            blocking: issue.blocking,
          })),
          [
            {
              sourceFileKind: "votes",
              sourceRowNumber: 2,
              issueCode: "unresolved_ref",
              blocking: true,
            },
            {
              sourceFileKind: "votes",
              sourceRowNumber: 3,
              issueCode: "duplicate_source_row",
              blocking: true,
            },
          ],
        );

        assert.equal(typeof issues[0].issueId, "number");
        assert.match(issues[0].message, /no resolvable submission/);
        assert.deepEqual(issues[0].rowPreview, {
          sourceRoundId: "game-42",
          sourceVoterId: "player-2",
          spotifyUri: "spotify:track:2",
          rawPointsAssigned: 3,
          rawComment: null,
          rawVotedAt: "2026-04-04T06:18:48.000Z",
          recordStatus: "blocked",
          matchedSongId: null,
          matchedVoterId: null,
          matchedRoundId: null,
        });

        assert.deepEqual(issues[1].rowPreview, {
          "Spotify URI": "spotify:track:2",
          "Voter ID": "player-2",
          Created: "2026-04-04T06:19:48Z",
          "Points Assigned": "5",
          Comment: "Duplicate row",
          "Round ID": "game-42",
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
  "throws when listing issues for a batch that does not exist",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      await assert.rejects(
        () => listImportBatchIssues(9999, { prisma }),
        /listImportBatchIssues: batch not found: 9999/,
      );
    });
  },
);
