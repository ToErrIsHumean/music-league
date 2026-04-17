const test = require("node:test");
const assert = require("node:assert/strict");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");

const { prisma, runSeed, cleanup } = createTempPrismaDb({
  prefix: "music-league-seed-",
  filename: "seed.sqlite",
});

async function loadCounts() {
  const [
    gameCount,
    playerCount,
    artistCount,
    songCount,
    roundCount,
    submissionCount,
    voteCount,
    importBatchCount,
  ] = await Promise.all([
    prisma.game.count(),
    prisma.player.count(),
    prisma.artist.count(),
    prisma.song.count(),
    prisma.round.count(),
    prisma.submission.count(),
    prisma.vote.count(),
    prisma.importBatch.count(),
  ]);

  return {
    gameCount,
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
      gameCount: 2,
      playerCount: 4,
      artistCount: 4,
      songCount: 6,
      roundCount: 4,
      submissionCount: 16,
      voteCount: 24,
      importBatchCount: 0,
    });

    runSeed();
    const countsAfterSecondRun = await loadCounts();

    assert.deepEqual(countsAfterSecondRun, countsAfterFirstRun);
  },
);

test(
  "seed rounds all point at an explicit game and preserve the mirror slug",
  { concurrency: false },
  async () => {
    runSeed();

    const games = await prisma.game.findMany({
      include: {
        rounds: {
          select: {
            id: true,
            gameId: true,
            leagueSlug: true,
          },
        },
      },
    });

    assert.equal(games.length, 2);
    assert.ok(games.every((game) => game.rounds.length >= 2));
    assert.ok(
      games.every((game) =>
        game.rounds.every(
          (round) =>
            round.gameId === game.id &&
            round.leagueSlug === game.sourceGameId,
        ),
      ),
    );
  },
);

test(
  "seed data reuses at least one song across submissions in different rounds or players",
  { concurrency: false },
  async () => {
    runSeed();

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
    runSeed();

    const rounds = await prisma.round.findMany({
      select: {
        gameId: true,
        submissions: {
          select: {
            score: true,
            rank: true,
          },
        },
      },
    });

    assert.equal(new Set(rounds.map((round) => round.gameId)).size, 2);

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
    runSeed();

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
  await cleanup();
});
