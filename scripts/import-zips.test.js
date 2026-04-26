const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyCommittedGameMetadata,
  parseGameMetadataSidecar,
} = require("./import-zips");

function metadataEntries(csvText, zipFilenames) {
  return [...parseGameMetadataSidecar({ csvText, zipFilenames }).entries()];
}

test("parses valid game-metadata.csv rows for discovered zip basenames", () => {
  const entries = metadataEntries(
    [
      "\uFEFF ZIP_FILENAME , GAME_DISPLAY_NAME , GAME_DESCRIPTION , GAME_FINISHED , GAME_SPEED , LeagueMaster ",
      'spring-2024.zip, Spring 2024 ,"A two-line description',
      'with a preserved line break.",false,Accelerated, Alex ',
      "summer-2024.zip,, ,TRUE,Speedy,Sam",
    ].join("\n"),
    ["spring-2024.zip", "summer-2024.zip", "winter-2024.zip"],
  );

  assert.deepEqual(entries, [
    [
      "spring-2024.zip",
      {
        gameDisplayName: "Spring 2024",
        gameDescription: "A two-line description\nwith a preserved line break.",
        gameFinished: false,
        gameSpeed: "Accelerated",
        leagueMaster: "Alex",
      },
    ],
    [
      "summer-2024.zip",
      {
        gameDisplayName: null,
        gameDescription: null,
        gameFinished: true,
        gameSpeed: "Speedy",
        leagueMaster: "Sam",
      },
    ],
  ]);
});

test("rejects unsupported sidecar columns", () => {
  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          "zip_filename,game_display_name,game_description,game_finished,game_speed\nspring.zip,Spring,,true,Steady\n",
        zipFilenames: ["spring.zip"],
      }),
    /Missing required game-metadata\.csv header: LeagueMaster/,
  );

  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          "zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster,notes\nspring.zip,Spring,,true,Steady,Alex,ignored\n",
        zipFilenames: ["spring.zip"],
      }),
    /Unsupported game-metadata\.csv column: "notes"/,
  );
});

test("rejects duplicate and undiscovered zip_filename rows", () => {
  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          "zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster\nspring.zip,Spring,,true,Steady,Alex\nspring.zip,Spring replay,,true,Speedy,Alex\n",
        zipFilenames: ["spring.zip"],
      }),
    /duplicate zip_filename "spring\.zip"/,
  );

  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          "zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster\narchive/spring.zip,Spring,,true,Steady,Alex\n",
        zipFilenames: ["spring.zip"],
      }),
    /zip_filename must be a discovered zip basename/,
  );

  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          "zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster\nfall.zip,Fall,,true,Steady,Alex\n",
        zipFilenames: ["spring.zip"],
      }),
    /zip_filename "fall\.zip" was not discovered/,
  );
});

test("rejects rows without metadata, long descriptions, invalid speeds, and malformed CSV", () => {
  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          "zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster\nspring.zip,,,,,\n",
        zipFilenames: ["spring.zip"],
      }),
    /at least one metadata value is required/,
  );

  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText: `zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster\nspring.zip,,${"x".repeat(1001)},true,,Alex\n`,
        zipFilenames: ["spring.zip"],
      }),
    /game_description exceeds 1000 characters/,
  );

  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          "zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster\nspring.zip,Spring,,maybe,Steady,Alex\n",
        zipFilenames: ["spring.zip"],
      }),
    /game_finished must be true or false/,
  );

  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          "zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster\nspring.zip,Spring,,true,Fast,Alex\n",
        zipFilenames: ["spring.zip"],
      }),
    /game_speed must be Steady, Accelerated, or Speedy/,
  );

  assert.throws(
    () =>
      parseGameMetadataSidecar({
        csvText:
          'zip_filename,game_display_name,game_description,game_finished,game_speed,LeagueMaster\nspring.zip,Spring,"unterminated,true,Steady,Alex\n',
        zipFilenames: ["spring.zip"],
      }),
    /Malformed game-metadata\.csv: unterminated quoted field/,
  );
});

test("applies sidecar metadata to blank committed Game fields", async () => {
  const prisma = createGamePrismaStub({
    id: 7,
    sourceGameId: "spring-2024",
    displayName: "",
    description: null,
    finished: true,
    speed: null,
    leagueMaster: "   ",
  });

  const result = await applyCommittedGameMetadata({
    prisma,
    gameKey: " spring-2024 ",
    metadata: {
      gameDisplayName: "Spring 2024",
      gameDescription: "A preserved description",
      gameFinished: false,
      gameSpeed: "Accelerated",
      leagueMaster: "Alex",
    },
  });

  assert.deepEqual(prisma.calls, [
    {
      method: "findUnique",
      args: {
        where: {
          sourceGameId: "spring-2024",
        },
      },
    },
    {
      method: "update",
      args: {
        where: {
          id: 7,
        },
        data: {
          displayName: "Spring 2024",
          description: "A preserved description",
          finished: false,
          speed: "Accelerated",
          leagueMaster: "Alex",
        },
      },
    },
  ]);
  assert.deepEqual(result, {
    gameId: 7,
    displayName: "Spring 2024",
    description: "A preserved description",
    finished: false,
    speed: "Accelerated",
    leagueMaster: "Alex",
    displayNameUpdated: true,
    descriptionUpdated: true,
    finishedUpdated: true,
    speedUpdated: true,
    leagueMasterUpdated: true,
  });
});

test("preserves non-empty committed Game metadata", async () => {
  const prisma = createGamePrismaStub({
    id: 9,
    sourceGameId: "summer-2024",
    displayName: "Existing Summer",
    description: "Existing description",
    finished: true,
    speed: "Steady",
    leagueMaster: "Sam",
  });

  const result = await applyCommittedGameMetadata({
    prisma,
    gameKey: "summer-2024",
    metadata: {
      gameDisplayName: "Summer 2024",
      gameDescription: "Replacement description",
      gameFinished: true,
      gameSpeed: "Speedy",
      leagueMaster: "Alex",
    },
  });

  assert.equal(
    prisma.calls.filter((call) => call.method === "update").length,
    0,
  );
  assert.deepEqual(result, {
    gameId: 9,
    displayName: "Existing Summer",
    description: "Existing description",
    finished: true,
    speed: "Steady",
    leagueMaster: "Sam",
    displayNameUpdated: false,
    descriptionUpdated: false,
    finishedUpdated: false,
    speedUpdated: false,
    leagueMasterUpdated: false,
  });
});

test("applies metadata over commit fallback when Game did not exist before commit", async () => {
  const prisma = createGamePrismaStub({
    id: 10,
    sourceGameId: "spring-2024",
    displayName: "spring-2024.zip",
    description: null,
    finished: true,
    speed: null,
    leagueMaster: null,
  });

  const result = await applyCommittedGameMetadata({
    prisma,
    gameKey: "spring-2024",
    metadata: {
      gameDisplayName: "Spring 2024",
      gameDescription: "Friendly description",
      gameFinished: false,
      gameSpeed: "Accelerated",
      leagueMaster: "Alex",
    },
    preCommitGameMetadata: null,
  });

  assert.deepEqual(result, {
    gameId: 10,
    displayName: "Spring 2024",
    description: "Friendly description",
    finished: false,
    speed: "Accelerated",
    leagueMaster: "Alex",
    displayNameUpdated: true,
    descriptionUpdated: true,
    finishedUpdated: true,
    speedUpdated: true,
    leagueMasterUpdated: true,
  });
});

test("preserves metadata that was non-empty before commit", async () => {
  const prisma = createGamePrismaStub({
    id: 12,
    sourceGameId: "spring-2024",
    displayName: "Existing Spring",
    description: null,
    finished: true,
    speed: null,
    leagueMaster: null,
  });

  const result = await applyCommittedGameMetadata({
    prisma,
    gameKey: "spring-2024",
    metadata: {
      gameDisplayName: "Spring 2024",
      gameDescription: "Friendly description",
      gameFinished: true,
      gameSpeed: "Accelerated",
      leagueMaster: "Alex",
    },
    preCommitGameMetadata: {
      displayName: "Existing Spring",
      description: null,
      finished: true,
      speed: null,
      leagueMaster: null,
    },
  });

  assert.deepEqual(result, {
    gameId: 12,
    displayName: "Existing Spring",
    description: "Friendly description",
    finished: true,
    speed: "Accelerated",
    leagueMaster: "Alex",
    displayNameUpdated: false,
    descriptionUpdated: true,
    finishedUpdated: false,
    speedUpdated: true,
    leagueMasterUpdated: true,
  });
});

test("returns committed Game unchanged when sidecar metadata is absent", async () => {
  const prisma = createGamePrismaStub({
    id: 11,
    sourceGameId: "winter-2024",
    displayName: "winter-2024.zip",
    description: null,
    finished: true,
    speed: null,
    leagueMaster: null,
  });

  const result = await applyCommittedGameMetadata({
    prisma,
    gameKey: "winter-2024",
    metadata: null,
  });

  assert.equal(
    prisma.calls.filter((call) => call.method === "update").length,
    0,
  );
  assert.deepEqual(result, {
    gameId: 11,
    displayName: "winter-2024.zip",
    description: null,
    finished: true,
    speed: null,
    leagueMaster: null,
    displayNameUpdated: false,
    descriptionUpdated: false,
    finishedUpdated: false,
    speedUpdated: false,
    leagueMasterUpdated: false,
  });
});

test("throws when committed Game metadata target is missing", async () => {
  const prisma = createGamePrismaStub(null);

  await assert.rejects(
    () =>
      applyCommittedGameMetadata({
        prisma,
        gameKey: "missing-game",
        metadata: {
          gameDisplayName: "Missing",
          gameDescription: null,
          gameFinished: null,
          gameSpeed: null,
          leagueMaster: null,
        },
      }),
    /committed game not found for gameKey "missing-game"/,
  );
});

function createGamePrismaStub(initialGame) {
  const calls = [];
  let game = initialGame ? { finished: true, ...initialGame } : null;

  return {
    calls,
    game: {
      async findUnique(args) {
        calls.push({
          method: "findUnique",
          args,
        });
        return game ? { ...game } : null;
      },
      async update(args) {
        calls.push({
          method: "update",
          args,
        });
        game = {
          ...game,
          ...args.data,
        };
        return { ...game };
      },
    },
  };
}
