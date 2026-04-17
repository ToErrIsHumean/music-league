const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");
const {
  GameArchivePage,
  buildGameArchivePageProps,
} = require("../../src/archive/game-archive-page");

const { prisma, cleanup } = createTempPrismaDb({
  prefix: "music-league-archive-page-",
  filename: "archive-page.sqlite",
  seed: true,
});

test.after(async () => {
  await cleanup();
});

test(
  "archive page props and markup render grouped game summaries with concise signals",
  { concurrency: false },
  async () => {
    const props = await buildGameArchivePageProps({ prisma });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.deepEqual(
      props.games.map((game) => game.displayLabel),
      ["After Party League", "main"],
    );
    assert.equal(props.openRoundId, null);
    assert.equal(props.notFoundNotice, null);
    assert.match(markup, /After Party League/);
    assert.match(markup, /main/);
    assert.match(markup, /Wildcard Waltz/);
    assert.match(markup, /Second Spin/);
    assert.match(markup, /Date TBD/);
    assert.match(markup, /Awaiting votes/);
    assert.match(markup, /Winner: Tied winners/);
    assert.ok(
      !markup.includes("Mr. Brightside"),
      "round summaries should stay concise and avoid inline submission lists",
    );

    const signalCount = (markup.match(/class=\"archive-signal\"/g) ?? []).length;
    const roundCount = props.games.reduce((count, game) => count + game.rounds.length, 0);

    assert.equal(signalCount, roundCount * 3);
    assert.ok(props.games.every((game) => game.rounds.every((round) => round.href === `/?round=${round.id}`)));
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
    assert.equal(props.notFoundNotice, "Round not found.");
    assert.match(markup, /Round not found\./);
    assert.match(markup, /After Party League/);
    assert.match(markup, /main/);
  },
);
