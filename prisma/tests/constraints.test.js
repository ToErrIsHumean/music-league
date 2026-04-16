const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "music-league-prisma-constraints-"),
);
const databasePath = path.join(tempDir, "constraints.sqlite");

process.env.DATABASE_URL = `file:${databasePath}`;

execFileSync(prismaCommand, ["prisma", "migrate", "deploy"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "pipe",
});

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const rollbackSignal = Symbol("rollback");

async function withRollback(run) {
  try {
    await prisma.$transaction(async (tx) => {
      await run(tx);
      throw rollbackSignal;
    });
  } catch (error) {
    if (error === rollbackSignal) {
      return;
    }

    throw error;
  }
}

async function createBaseRecords(tx, suffix) {
  const artist = await tx.artist.create({
    data: {
      name: `Artist ${suffix}`,
      normalizedName: `artist ${suffix}`,
    },
  });

  const song = await tx.song.create({
    data: {
      title: `Song ${suffix}`,
      normalizedTitle: `song ${suffix}`,
      artistId: artist.id,
      spotifyUri: `spotify:track:${suffix}`,
    },
  });

  const round = await tx.round.create({
    data: {
      leagueSlug: "main",
      name: `Round ${suffix}`,
      sourceRoundId: `round-${suffix}`,
    },
  });

  const player = await tx.player.create({
    data: {
      displayName: `Player ${suffix}`,
      normalizedName: `player ${suffix}`,
      sourcePlayerId: `player-${suffix}`,
    },
  });

  return { artist, song, round, player };
}

async function createImportBatch(tx, suffix) {
  return tx.importBatch.create({
    data: {
      sourceType: "csv",
      sourceFilename: `import-${suffix}.csv`,
      rowCount: 1,
      status: "parsed",
    },
  });
}

function isUniqueConstraintError(error, fields) {
  return (
    error &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    fields.every((field) => error.meta.target.includes(field))
  );
}

test("creates one record for each Prisma model", { concurrency: false }, async () => {
  await withRollback(async (tx) => {
    const { artist, song, round, player } = await createBaseRecords(tx, "ac02");
    const voter = await tx.player.create({
      data: {
        displayName: "Voter ac02",
        normalizedName: "voter ac02",
        sourcePlayerId: "voter-ac02",
      },
    });
    const importBatch = await createImportBatch(tx, "ac02");

    const submission = await tx.submission.create({
      data: {
        roundId: round.id,
        playerId: player.id,
        songId: song.id,
        sourceImportId: importBatch.id,
      },
    });

    const vote = await tx.vote.create({
      data: {
        roundId: round.id,
        voterId: voter.id,
        songId: song.id,
        pointsAssigned: 5,
        sourceImportId: importBatch.id,
      },
    });

    assert.ok(artist.id);
    assert.ok(song.id);
    assert.ok(round.id);
    assert.ok(player.id);
    assert.ok(voter.id);
    assert.ok(importBatch.id);
    assert.ok(submission.id);
    assert.ok(vote.id);
  });
});

test(
  "rejects duplicate submission round/player/song tuples",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      const { song, round, player } = await createBaseRecords(tx, "ac03");

      await tx.submission.create({
        data: {
          roundId: round.id,
          playerId: player.id,
          songId: song.id,
        },
      });

      await assert.rejects(
        tx.submission.create({
          data: {
            roundId: round.id,
            playerId: player.id,
            songId: song.id,
          },
        }),
        (error) =>
          isUniqueConstraintError(error, ["roundId", "playerId", "songId"]),
      );
    });
  },
);

test(
  "rejects duplicate vote round/voter/song tuples",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      const { song, round } = await createBaseRecords(tx, "ac04");
      const voter = await tx.player.create({
        data: {
          displayName: "Voter ac04",
          normalizedName: "voter ac04",
          sourcePlayerId: "voter-ac04",
        },
      });

      await tx.vote.create({
        data: {
          roundId: round.id,
          voterId: voter.id,
          songId: song.id,
          pointsAssigned: 7,
        },
      });

      await assert.rejects(
        tx.vote.create({
          data: {
            roundId: round.id,
            voterId: voter.id,
            songId: song.id,
            pointsAssigned: 3,
          },
        }),
        (error) => isUniqueConstraintError(error, ["roundId", "voterId", "songId"]),
      );
    });
  },
);

test(
  "rejects duplicate non-null round league/source ids",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      await tx.round.create({
        data: {
          leagueSlug: "main",
          name: "Round ac05 first",
          sourceRoundId: "shared-round-id",
        },
      });

      await assert.rejects(
        tx.round.create({
          data: {
            leagueSlug: "main",
            name: "Round ac05 second",
            sourceRoundId: "shared-round-id",
          },
        }),
        (error) => isUniqueConstraintError(error, ["leagueSlug", "sourceRoundId"]),
      );
    });
  },
);

test(
  "allows duplicate league slugs when sourceRoundId is null",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      const firstRound = await tx.round.create({
        data: {
          leagueSlug: "main",
          name: "Round ac06 first",
        },
      });

      const secondRound = await tx.round.create({
        data: {
          leagueSlug: "main",
          name: "Round ac06 second",
        },
      });

      assert.ok(firstRound.id);
      assert.ok(secondRound.id);
      assert.equal(firstRound.sourceRoundId, null);
      assert.equal(secondRound.sourceRoundId, null);
    });
  },
);

test.after(async () => {
  await prisma.$disconnect();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
