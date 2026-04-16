const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const nodeCommand = process.execPath;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "music-league-seed-"));
const databasePath = path.join(tempDir, "seed.sqlite");

process.env.DATABASE_URL = `file:${databasePath}`;

execFileSync(prismaCommand, ["prisma", "migrate", "deploy"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "pipe",
});

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function runSeed() {
  execFileSync(nodeCommand, ["prisma/seed.js"], {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
  });
}

async function loadCounts() {
  const [
    playerCount,
    artistCount,
    songCount,
    roundCount,
    submissionCount,
    voteCount,
    importBatchCount,
  ] = await Promise.all([
    prisma.player.count(),
    prisma.artist.count(),
    prisma.song.count(),
    prisma.round.count(),
    prisma.submission.count(),
    prisma.vote.count(),
    prisma.importBatch.count(),
  ]);

  return {
    playerCount,
    artistCount,
    songCount,
    roundCount,
    submissionCount,
    voteCount,
    importBatchCount,
  };
}

test(
  "seed script is idempotent for transactional records",
  { concurrency: false },
  async () => {
    runSeed();
    const countsAfterFirstRun = await loadCounts();

    assert.deepEqual(countsAfterFirstRun, {
      playerCount: 4,
      artistCount: 4,
      songCount: 6,
      roundCount: 2,
      submissionCount: 7,
      voteCount: 12,
      importBatchCount: 0,
    });

    runSeed();
    const countsAfterSecondRun = await loadCounts();

    assert.deepEqual(countsAfterSecondRun, countsAfterFirstRun);
  },
);

test(
  "seed data reuses at least one song across submissions in different rounds or players",
  { concurrency: false },
  async () => {
    const songs = await prisma.song.findMany({
      include: {
        submissions: {
          select: {
            roundId: true,
            playerId: true,
          },
        },
      },
    });

    const reusedSong = songs.find((song) => {
      if (song.submissions.length < 2) {
        return false;
      }

      const distinctRounds = new Set(
        song.submissions.map((submission) => submission.roundId),
      );
      const distinctPlayers = new Set(
        song.submissions.map((submission) => submission.playerId),
      );

      return distinctRounds.size > 1 || distinctPlayers.size > 1;
    });

    assert.ok(reusedSong);
  },
);

test(
  "seed data includes both fully scored and unscored rounds",
  { concurrency: false },
  async () => {
    const rounds = await prisma.round.findMany({
      include: {
        submissions: {
          select: {
            score: true,
            rank: true,
          },
        },
      },
      orderBy: {
        sequenceNumber: "asc",
      },
    });

    assert.ok(
      rounds.some(
        (round) =>
          round.submissions.length > 0 &&
          round.submissions.every(
            (submission) =>
              submission.score !== null && submission.rank !== null,
          ),
      ),
    );
    assert.ok(
      rounds.some((round) =>
        round.submissions.some(
          (submission) =>
            submission.score === null && submission.rank === null,
        ),
      ),
    );
  },
);

test(
  "seed votes cover a scored round with variable points and comments",
  { concurrency: false },
  async () => {
    const votes = await prisma.vote.findMany({
      select: {
        roundId: true,
        pointsAssigned: true,
        comment: true,
      },
    });

    assert.ok(votes.length > 0);
    assert.ok(new Set(votes.map((vote) => vote.roundId)).size >= 1);
    assert.ok(new Set(votes.map((vote) => vote.pointsAssigned)).size > 1);
    assert.ok(votes.some((vote) => vote.comment !== null));
  },
);

test.after(async () => {
  await prisma.$disconnect();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
