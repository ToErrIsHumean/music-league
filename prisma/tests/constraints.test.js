const test = require("node:test");
const assert = require("node:assert/strict");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");

const { prisma, cleanup } = createTempPrismaDb({
  prefix: "music-league-prisma-constraints-",
  filename: "constraints.sqlite",
});
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
  const game = await tx.game.create({
    data: {
      sourceGameId: `game-${suffix}`,
      displayName: null,
    },
  });

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
      gameId: game.id,
      leagueSlug: game.sourceGameId,
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

  return { game, artist, song, round, player };
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

function isConstraintViolation(error) {
  return error && (error.code === "P2003" || error.code === "P2004");
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
  "stores game metadata without date or player relationship",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      const game = await tx.game.create({
        data: {
          sourceGameId: "game-metadata-ac08",
          displayName: null,
          description: "Imported operator description",
          finished: false,
          speed: "Accelerated",
          leagueMaster: "Alex",
        },
      });

      assert.equal(game.description, "Imported operator description");
      assert.equal(game.finished, false);
      assert.equal(game.speed, "Accelerated");
      assert.equal(game.leagueMaster, "Alex");

      const gameModel = prisma._runtimeDataModel.models.Game;
      const fieldNames = new Set(gameModel.fields.map((field) => field.name));
      const leagueMasterField = gameModel.fields.find(
        (field) => field.name === "leagueMaster",
      );
      const finishedField = gameModel.fields.find(
        (field) => field.name === "finished",
      );
      const speedField = gameModel.fields.find((field) => field.name === "speed");

      assert.equal(fieldNames.has("date"), false);
      assert.equal(fieldNames.has("occurredAt"), false);
      assert.equal(finishedField.kind, "scalar");
      assert.equal(finishedField.type, "Boolean");
      assert.equal(speedField.kind, "enum");
      assert.equal(speedField.type, "GameSpeed");
      assert.equal(leagueMasterField.kind, "scalar");
    });
  },
);

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
  "rejects duplicate non-null round game/source ids",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      const game = await tx.game.create({
        data: {
          sourceGameId: "main",
        },
      });

      await tx.round.create({
        data: {
          gameId: game.id,
          leagueSlug: game.sourceGameId,
          name: "Round ac05 first",
          sourceRoundId: "shared-round-id",
        },
      });

      await assert.rejects(
        tx.round.create({
          data: {
            gameId: game.id,
            leagueSlug: game.sourceGameId,
            name: "Round ac05 second",
            sourceRoundId: "shared-round-id",
          },
        }),
        (error) =>
          isUniqueConstraintError(error, ["gameId", "sourceRoundId"]) ||
          isUniqueConstraintError(error, ["leagueSlug", "sourceRoundId"]),
      );
    });
  },
);

test(
  "allows the same sourceRoundId in different games",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      const firstGame = await tx.game.create({
        data: {
          sourceGameId: "game-ac05-a",
        },
      });
      const secondGame = await tx.game.create({
        data: {
          sourceGameId: "game-ac05-b",
        },
      });

      const firstRound = await tx.round.create({
        data: {
          gameId: firstGame.id,
          leagueSlug: firstGame.sourceGameId,
          name: "Round shared first",
          sourceRoundId: "shared-round-id",
        },
      });
      const secondRound = await tx.round.create({
        data: {
          gameId: secondGame.id,
          leagueSlug: secondGame.sourceGameId,
          name: "Round shared second",
          sourceRoundId: "shared-round-id",
        },
      });

      assert.ok(firstRound.id);
      assert.ok(secondRound.id);
      assert.notEqual(firstRound.gameId, secondRound.gameId);
    });
  },
);

test(
  "rejects round writes when leagueSlug diverges from the owning game",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      const game = await tx.game.create({
        data: {
          sourceGameId: "game-ac05-c",
        },
      });

      await assert.rejects(
        tx.round.create({
          data: {
            gameId: game.id,
            leagueSlug: "mismatch",
            name: "Round mismatch",
            sourceRoundId: "round-mismatch",
          },
        }),
        isConstraintViolation,
      );
    });
  },
);

test(
  "allows duplicate league slugs when sourceRoundId is null",
  { concurrency: false },
  async () => {
    await withRollback(async (tx) => {
      const game = await tx.game.create({
        data: {
          sourceGameId: "main",
        },
      });

      const firstRound = await tx.round.create({
        data: {
          gameId: game.id,
          leagueSlug: game.sourceGameId,
          name: "Round ac06 first",
        },
      });

      const secondRound = await tx.round.create({
        data: {
          gameId: game.id,
          leagueSlug: game.sourceGameId,
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
  await cleanup();
});
