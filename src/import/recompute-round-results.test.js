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
const { recomputeRoundResults } = require("./recompute-round-results");

async function withTestDatabase(run) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-recompute-db-"),
  );
  const databasePath = path.join(tempDir, "recompute.sqlite");
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

async function seedRoundFixture(prisma, leagueSlug, sourceRoundId) {
  const game = await prisma.game.create({
    data: {
      sourceGameId: leagueSlug,
    },
  });
  const [submitterOne, submitterTwo, submitterThree, voter] = await Promise.all([
    prisma.player.create({
      data: {
        displayName: `${leagueSlug} Submitter One`,
        normalizedName: normalize(`${leagueSlug} Submitter One`),
        sourcePlayerId: `${leagueSlug}-submitter-1`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `${leagueSlug} Submitter Two`,
        normalizedName: normalize(`${leagueSlug} Submitter Two`),
        sourcePlayerId: `${leagueSlug}-submitter-2`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `${leagueSlug} Submitter Three`,
        normalizedName: normalize(`${leagueSlug} Submitter Three`),
        sourcePlayerId: `${leagueSlug}-submitter-3`,
      },
    }),
    prisma.player.create({
      data: {
        displayName: `${leagueSlug} Voter`,
        normalizedName: normalize(`${leagueSlug} Voter`),
        sourcePlayerId: `${leagueSlug}-voter`,
      },
    }),
  ]);

  const [artistOne, artistTwo, artistThree, artistFour] = await Promise.all([
    prisma.artist.create({
      data: {
        name: `${leagueSlug} Artist One`,
        normalizedName: normalize(`${leagueSlug} Artist One`),
      },
    }),
    prisma.artist.create({
      data: {
        name: `${leagueSlug} Artist Two`,
        normalizedName: normalize(`${leagueSlug} Artist Two`),
      },
    }),
    prisma.artist.create({
      data: {
        name: `${leagueSlug} Artist Three`,
        normalizedName: normalize(`${leagueSlug} Artist Three`),
      },
    }),
    prisma.artist.create({
      data: {
        name: `${leagueSlug} Artist Four`,
        normalizedName: normalize(`${leagueSlug} Artist Four`),
      },
    }),
  ]);

  const [songOne, songTwo, songThree, songFour] = await Promise.all([
    prisma.song.create({
      data: {
        title: `${leagueSlug} Song One`,
        normalizedTitle: normalize(`${leagueSlug} Song One`),
        artistId: artistOne.id,
        spotifyUri: `spotify:track:${leagueSlug}:1`,
      },
    }),
    prisma.song.create({
      data: {
        title: `${leagueSlug} Song Two`,
        normalizedTitle: normalize(`${leagueSlug} Song Two`),
        artistId: artistTwo.id,
        spotifyUri: `spotify:track:${leagueSlug}:2`,
      },
    }),
    prisma.song.create({
      data: {
        title: `${leagueSlug} Song Three`,
        normalizedTitle: normalize(`${leagueSlug} Song Three`),
        artistId: artistThree.id,
        spotifyUri: `spotify:track:${leagueSlug}:3`,
      },
    }),
    prisma.song.create({
      data: {
        title: `${leagueSlug} Song Four`,
        normalizedTitle: normalize(`${leagueSlug} Song Four`),
        artistId: artistFour.id,
        spotifyUri: `spotify:track:${leagueSlug}:4`,
      },
    }),
  ]);

  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      leagueSlug,
      name: `${leagueSlug} Round`,
      sourceRoundId,
    },
  });

  const [submissionOne, submissionTwo, submissionThree, submissionFour] =
    await Promise.all([
      prisma.submission.create({
        data: {
          roundId: round.id,
          playerId: submitterOne.id,
          songId: songOne.id,
          score: 99,
          rank: 99,
        },
      }),
      prisma.submission.create({
        data: {
          roundId: round.id,
          playerId: submitterTwo.id,
          songId: songTwo.id,
          score: 98,
          rank: 98,
        },
      }),
      prisma.submission.create({
        data: {
          roundId: round.id,
          playerId: submitterThree.id,
          songId: songThree.id,
          score: 97,
          rank: 97,
        },
      }),
      prisma.submission.create({
        data: {
          roundId: round.id,
          playerId: submitterOne.id,
          songId: songFour.id,
          score: 96,
          rank: 96,
        },
      }),
    ]);

  return {
    players: {
      submitterOne,
      submitterTwo,
      submitterThree,
      voter,
    },
    round,
    songs: {
      songOne,
      songTwo,
      songThree,
      songFour,
    },
    submissions: {
      submissionOne,
      submissionTwo,
      submissionThree,
      submissionFour,
    },
  };
}

test(
  "recomputes affected round scores and dense ranks from canonical votes",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const scoredRound = await seedRoundFixture(prisma, "game-score", "round-score");
      const untouchedRound = await seedRoundFixture(
        prisma,
        "game-untouched",
        "round-untouched",
      );

      await prisma.vote.createMany({
        data: [
          {
            roundId: scoredRound.round.id,
            voterId: scoredRound.players.voter.id,
            songId: scoredRound.songs.songOne.id,
            pointsAssigned: 10,
          },
          {
            roundId: scoredRound.round.id,
            voterId: scoredRound.players.submitterOne.id,
            songId: scoredRound.songs.songTwo.id,
            pointsAssigned: 10,
          },
          {
            roundId: scoredRound.round.id,
            voterId: scoredRound.players.submitterTwo.id,
            songId: scoredRound.songs.songThree.id,
            pointsAssigned: 4,
          },
        ],
      });

      await recomputeRoundResults([scoredRound.round.id], { prisma });

      const [updatedSubmissions, untouchedSubmissions] = await Promise.all([
        prisma.submission.findMany({
          where: { roundId: scoredRound.round.id },
          include: {
            song: {
              select: {
                title: true,
              },
            },
          },
          orderBy: {
            id: "asc",
          },
        }),
        prisma.submission.findMany({
          where: { roundId: untouchedRound.round.id },
          orderBy: {
            id: "asc",
          },
        }),
      ]);

      assert.deepEqual(
        Object.fromEntries(
          updatedSubmissions.map((submission) => [
            submission.song.title,
            {
              score: submission.score,
              rank: submission.rank,
            },
          ]),
        ),
        {
          "game-score Song One": {
            score: 10,
            rank: 1,
          },
          "game-score Song Two": {
            score: 10,
            rank: 1,
          },
          "game-score Song Three": {
            score: 4,
            rank: 2,
          },
          "game-score Song Four": {
            score: null,
            rank: null,
          },
        },
      );

      assert.deepEqual(
        untouchedSubmissions
          .map((submission) => ({
            score: submission.score,
            rank: submission.rank,
          }))
          .sort((left, right) => right.score - left.score),
        [
          { score: 99, rank: 99 },
          { score: 98, rank: 98 },
          { score: 97, rank: 97 },
          { score: 96, rank: 96 },
        ],
      );
    });
  },
);

test(
  "throws on votes without same-round submissions and rolls back the transaction",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const fixture = await seedRoundFixture(prisma, "game-rollback", "round-rollback");
      const orphanArtist = await prisma.artist.create({
        data: {
          name: "Rollback Orphan Artist",
          normalizedName: normalize("Rollback Orphan Artist"),
        },
      });
      const orphanSong = await prisma.song.create({
        data: {
          title: "Rollback Orphan Song",
          normalizedTitle: normalize("Rollback Orphan Song"),
          artistId: orphanArtist.id,
          spotifyUri: "spotify:track:rollback:orphan",
        },
      });
      const batch = await prisma.importBatch.create({
        data: {
          sourceType: "music-league-csv",
          sourceFilename: "rollback-bundle",
          gameKey: fixture.round.leagueSlug,
          status: "ready",
        },
      });

      await prisma.vote.create({
        data: {
          roundId: fixture.round.id,
          voterId: fixture.players.voter.id,
          songId: orphanSong.id,
          pointsAssigned: 5,
        },
      });

      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await tx.importBatch.update({
              where: { id: batch.id },
              data: { status: "committed" },
            });
            await tx.submission.update({
              where: { id: fixture.submissions.submissionOne.id },
              data: { comment: "should be rolled back" },
            });

            await recomputeRoundResults([fixture.round.id], { prisma: tx });
          }),
        /recomputeRoundResults: vote \d+ in round \d+ has no matching submission for song \d+/,
      );

      const [persistedBatch, persistedSubmission] = await Promise.all([
        prisma.importBatch.findUniqueOrThrow({
          where: { id: batch.id },
        }),
        prisma.submission.findUniqueOrThrow({
          where: { id: fixture.submissions.submissionOne.id },
        }),
      ]);

      assert.equal(persistedBatch.status, "ready");
      assert.equal(persistedSubmission.comment, null);
      assert.equal(persistedSubmission.score, 99);
      assert.equal(persistedSubmission.rank, 99);
    });
  },
);
