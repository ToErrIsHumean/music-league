const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");
const archivePageModule = require("../../src/archive/game-archive-page");
const {
  GameMemoryBoardPage,
  buildGameMemoryBoardPageProps,
  GameArchivePage,
  buildGameArchivePageProps,
} = archivePageModule;

const { prisma, cleanup } = createTempPrismaDb({
  prefix: "music-league-archive-page-",
  filename: "archive-page.sqlite",
  seed: true,
});

async function findRoundIdBySourceId(sourceRoundId) {
  const round = await prisma.round.findFirst({
    where: { sourceRoundId },
    select: { id: true },
  });

  assert.ok(round, `expected seeded round ${sourceRoundId} to exist`);

  return round.id;
}

async function findSongIdBySpotifyUri(spotifyUri) {
  const song = await prisma.song.findFirst({
    where: { spotifyUri },
    select: { id: true },
  });

  assert.ok(song, `expected seeded song ${spotifyUri} to exist`);

  return song.id;
}

async function findGameIdBySourceId(sourceGameId) {
  const game = await prisma.game.findUnique({
    where: { sourceGameId },
    select: { id: true },
  });

  assert.ok(game, `expected seeded game ${sourceGameId} to exist`);

  return game.id;
}

test.after(async () => {
  await cleanup();
});

test("route module compatibility aliases delegate to the memory board implementation", () => {
  assert.equal(GameArchivePage, GameMemoryBoardPage);
  assert.equal(buildGameArchivePageProps, buildGameMemoryBoardPageProps);
});

test(
  "archive page resolves one deterministic selected game with switcher and memory moments",
  { concurrency: false },
  async () => {
    const props = await buildGameArchivePageProps({ prisma });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.equal(props.selectedGame.displayLabel, "After Party League");
    assert.equal(props.selectedGame.selectionBasis, "round-occurred-at");
    assert.equal(props.selectedGame.selectionCopy, "Latest game");
    assert.deepEqual(
      props.games.map((game) => game.displayLabel),
      ["After Party League", "main"],
    );
    assert.deepEqual(
      props.games.map((game) => game.isSelected),
      [true, false],
    );
    assert.deepEqual(
      props.board.rounds.map((round) => round.name),
      ["Wildcard Waltz", "Sunset Static"],
    );
    assert.equal(props.board.competitiveAnchor.title, "Results need complete score evidence");
    assert.ok(props.board.moments.length >= 3);
    assert.ok(props.board.moments.length <= 6);
    assert.deepEqual(
      props.board.moments.slice(0, 3).map((moment) => moment.family),
      ["game-swing", "back-again-familiar-face", "participation-pulse"],
    );
    assert.equal(props.openRoundId, null);
    assert.equal(props.openRound, null);
    assert.deepEqual(props.notices, []);
    assert.match(markup, /After Party League/);
    assert.match(markup, /main/);
    assert.match(markup, /Wildcard Waltz/);
    assert.match(markup, /Competitive anchor/);
    assert.match(markup, /Results need complete score evidence/);
    assert.match(markup, /Runaway Pick/);
    assert.match(markup, /Participation pulse/);
    assert.ok(!markup.includes("Second Spin"), "default board must not blend another game");
    assert.ok(
      !markup.includes("Mr. Brightside"),
      "round summaries should stay concise and avoid inline submission lists",
    );

    const momentCount =
      (markup.match(/class=\"archive-memory-moment archive-memory-moment-/g) ?? []).length;

    assert.equal(momentCount, props.board.moments.length);
    assert.ok(
      props.board.rounds.every(
        (round) => round.href === `/games/${props.selectedGame.id}/rounds/${round.id}`,
      ),
    );
  },
);

test(
  "TASK-07 memory board render regression keeps board copy source-backed and comment-free",
  { concurrency: false },
  async () => {
    const props = await buildGameArchivePageProps({ prisma });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));
    const competitiveAnchorIndex = markup.indexOf("archive-competitive-anchor");
    const memoryGridIndex = markup.indexOf("archive-memory-grid");

    assert.ok(props.selectedGame, "expected the default route to select a game");
    assert.ok(props.board, "expected the default route to render a board");
    assert.match(markup, /archive-hero-title\">After Party League/);
    assert.match(markup, /Latest game/);
    assert.ok(competitiveAnchorIndex >= 0, "expected first viewport competitive anchor");
    assert.ok(memoryGridIndex >= 0, "expected first viewport memory moments");
    assert.ok(
      competitiveAnchorIndex < memoryGridIndex,
      "competitive anchor should precede ordinary moments",
    );
    assert.ok(!markup.includes("archive-submission-list"));
    assert.ok(!markup.includes("archive-round-dialog"));
    assert.ok(!markup.includes("<table"));
    assert.ok(!markup.includes("all-games"));

    for (const unsupportedBoardCopy of [
      /People Reacted/i,
      /Submission comment/i,
      /Vote comment/i,
      /Arcade-pop opener/i,
      /Bonus-round favorite/i,
      /genre/i,
      /mood/i,
      /audio feature/i,
      /popularity/i,
      /recommend/i,
      /personalization/i,
      /inferred taste/i,
      /deadline/i,
      /vote-budget/i,
      /low-stakes/i,
      /disqualification/i,
      /unsupported humor/i,
    ]) {
      assert.ok(
        !unsupportedBoardCopy.test(markup),
        `memory board should omit unsupported or deferred board copy: ${unsupportedBoardCopy}`,
      );
    }
  },
);

test(
  "archive page gracefully keeps the archive visible when a requested round is missing",
  { concurrency: false },
  async () => {
    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: "999999",
      }),
    });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.equal(props.openRoundId, null);
    assert.equal(props.openRound, null);
    assert.deepEqual(props.notices, []);
    assert.ok(!markup.includes("Round not found."));
    assert.match(markup, /After Party League/);
    assert.ok(!markup.includes("Second Spin"), "missing round should keep the selected board scoped");
  },
);

test(
  "malformed integer params are ignored without dismissing the selected board",
  { concurrency: false },
  async () => {
    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        game: "abc",
        round: "0",
        song: "-1",
        player: "not-a-player",
      }),
    });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.equal(props.selectedGame.displayLabel, "After Party League");
    assert.equal(props.openRound, null);
    assert.equal(props.nestedEntity, null);
    assert.deepEqual(props.notices, []);
    assert.match(markup, /After Party League/);
    assert.match(markup, /Selected memory board/);
    assert.ok(!markup.includes("Round not found"));
    assert.ok(!markup.includes("Game not found"));
  },
);

test(
  "selected game query switches the board without blending other games",
  { concurrency: false },
  async () => {
    const mainGameId = await findGameIdBySourceId("main");
    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        game: String(mainGameId),
      }),
    });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.equal(props.selectedGame.id, mainGameId);
    assert.equal(props.selectedGame.displayLabel, "main");
    assert.equal(props.selectedGame.selectionBasis, "explicit-query");
    assert.equal(props.selectedGame.selectionCopy, "Selected game");
    assert.deepEqual(
      props.board.rounds.map((round) => round.name),
      ["Opening Night", "Second Spin"],
    );
    assert.match(markup, /Second Spin/);
    assert.ok(!markup.includes("Wildcard Waltz"), "explicit game selection must not blend games");
  },
);

test(
  "single selectable game suppresses the switcher",
  { concurrency: false },
  async () => {
    const singleDb = createTempPrismaDb({
      prefix: "music-league-single-game-",
      filename: "single.sqlite",
      seed: false,
    });

    try {
      const game = await singleDb.prisma.game.create({
        data: {
          sourceGameId: "single",
          displayName: "Single Game",
          rounds: {
            create: {
              leagueSlug: "single",
              sourceRoundId: "single-r1",
              name: "Only Round",
            },
          },
        },
      });
      const props = await buildGameArchivePageProps({ prisma: singleDb.prisma });
      const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

      assert.equal(props.selectedGame.id, game.id);
      assert.deepEqual(props.games, []);
      assert.deepEqual(props.board.moments, []);
      assert.deepEqual(props.board.sparseState.omittedFamilies, [
        "the-table",
        "game-swing",
        "new-to-us-that-landed",
        "back-again-familiar-face",
        "participation-pulse",
      ]);
      assert.match(markup, /Single Game/);
      assert.match(markup, /No submissions yet/);
      assert.match(markup, /no submitted songs are available for board moments/);
      assert.ok(!markup.includes("Round evidence"));
      assert.ok(!markup.includes("archive-game-switcher"));
    } finally {
      await singleDb.cleanup();
    }
  },
);

test(
  "no selectable game renders unavailable state and ignores nested params",
  { concurrency: false },
  async () => {
    const emptyDb = createTempPrismaDb({
      prefix: "music-league-empty-board-",
      filename: "empty.sqlite",
      seed: false,
    });

    try {
      await emptyDb.prisma.game.create({
        data: {
          sourceGameId: "roundless",
          displayName: "Roundless",
        },
      });
      const props = await buildGameArchivePageProps({
        prisma: emptyDb.prisma,
        searchParams: Promise.resolve({
          round: "1",
          song: "1",
          player: "1",
        }),
      });
      const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

      assert.equal(props.selectedGame, null);
      assert.equal(props.board, null);
      assert.deepEqual(props.games, []);
      assert.deepEqual(props.notices, []);
      assert.equal(props.openRound, null);
      assert.equal(props.nestedEntity, null);
      assert.match(markup, /No selectable game is available/);
      assert.ok(!markup.includes("Roundless"));
    } finally {
      await emptyDb.cleanup();
    }
  },
);

test(
  "weak fallback ordering uses cautious selected-game copy",
  { concurrency: false },
  async () => {
    const fallbackDb = createTempPrismaDb({
      prefix: "music-league-fallback-copy-",
      filename: "fallback.sqlite",
      seed: false,
    });

    try {
      const createdAt = new Date("2024-01-01T00:00:00.000Z");

      await fallbackDb.prisma.game.create({
        data: {
          sourceGameId: "bravo",
          displayName: "Bravo",
          createdAt,
          rounds: {
            create: {
              leagueSlug: "bravo",
              sourceRoundId: "bravo-r1",
              name: "Bravo Round",
            },
          },
        },
      });
      await fallbackDb.prisma.game.create({
        data: {
          sourceGameId: "alpha",
          displayName: "Alpha",
          createdAt,
          rounds: {
            create: {
              leagueSlug: "alpha",
              sourceRoundId: "alpha-r1",
              name: "Alpha Round",
            },
          },
        },
      });

      const props = await buildGameArchivePageProps({ prisma: fallbackDb.prisma });
      const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

      assert.equal(props.selectedGame.displayLabel, "Alpha");
      assert.equal(props.selectedGame.selectionBasis, "stable-source-game-id");
      assert.equal(props.selectedGame.selectionCopy, "Selected game");
      assert.ok(!markup.includes("Latest game"));
    } finally {
      await fallbackDb.cleanup();
    }
  },
);

test(
  "invalid game params are non-blocking and cross-game rounds do not open",
  { concurrency: false },
  async () => {
    const mainGameId = await findGameIdBySourceId("main");
    const afterpartyGameId = await findGameIdBySourceId("afterparty");
    const mainRoundId = await findRoundIdBySourceId("seed-r1");

    const invalidGameProps = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        game: "999999",
        round: String(mainRoundId),
      }),
    });

    assert.equal(invalidGameProps.selectedGame.id, afterpartyGameId);
    assert.equal(invalidGameProps.openRoundId, null);
    assert.deepEqual(invalidGameProps.notices, ["Game not found."]);

    const mismatchProps = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        game: String(afterpartyGameId),
        round: String(mainRoundId),
      }),
    });

    assert.equal(mismatchProps.selectedGame.id, afterpartyGameId);
    assert.equal(mismatchProps.openRound, null);
    assert.deepEqual(mismatchProps.notices, []);
  },
);

test(
  "retired overlay params are ignored by the legacy archive page compatibility entrypoint",
  { concurrency: false },
  async () => {
    const roundId = await findRoundIdBySourceId("seed-r1");
    const songId = await findSongIdBySpotifyUri("spotify:track:seed-song-005");
    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: String(roundId),
        song: String(songId),
        player: "1",
        playerSubmission: "1",
      }),
    });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.equal(props.openRoundId, null);
    assert.equal(props.openRound, null);
    assert.equal(props.nestedEntity, null);
    assert.equal(props.openSongModal, null);
    assert.equal(props.openPlayerModal, null);
    assert.deepEqual(props.notices, []);
    assert.ok(!markup.includes("archive-round-dialog"));
    assert.ok(!markup.includes("archive-nested-shell"));
    assert.ok(!markup.includes("role=\"dialog\""));
  },
);
