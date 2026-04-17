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

async function findRoundIdBySourceId(sourceRoundId) {
  const round = await prisma.round.findFirst({
    where: { sourceRoundId },
    select: { id: true },
  });

  assert.ok(round, `expected seeded round ${sourceRoundId} to exist`);

  return round.id;
}

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
    assert.equal(props.openRound, null);
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
    assert.equal(props.openRound, null);
    assert.equal(props.notFoundNotice, "Round not found.");
    assert.match(markup, /Round not found\./);
    assert.match(markup, /After Party League/);
    assert.match(markup, /main/);
  },
);

test(
  "archive page direct entry opens the round detail overlay with highlights and ordered submissions",
  { concurrency: false },
  async () => {
    const roundId = await findRoundIdBySourceId("seed-r1");
    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: String(roundId),
      }),
    });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.equal(props.openRoundId, roundId);
    assert.ok(props.openRound, "expected direct entry to resolve an open round");
    assert.equal(props.openRound.game.displayLabel, "main");
    assert.equal(props.notFoundNotice, null);
    assert.match(markup, /role=\"dialog\"/);
    assert.match(markup, /Round detail/);
    assert.match(markup, /From main/);
    assert.match(markup, /Opening Night/);
    assert.equal((markup.match(/class=\"archive-highlight-card/g) ?? []).length, 3);

    const submissionMarkup = markup.slice(markup.indexOf('class="archive-submission-list"'));
    const orderedPlayers = props.openRound.submissions.map(
      (submission) => `Submitted by ${submission.player.displayName}`,
    );

    for (let index = 1; index < orderedPlayers.length; index += 1) {
      assert.ok(
        submissionMarkup.indexOf(orderedPlayers[index - 1]) <
          submissionMarkup.indexOf(orderedPlayers[index]),
        "expected submission titles to render in round detail order",
      );
    }
  },
);

test(
  "round detail submission links open a nested song shell without dismissing the round dialog",
  { concurrency: false },
  async () => {
    const roundId = await findRoundIdBySourceId("seed-r1");
    const baseProps = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: String(roundId),
      }),
    });
    const targetSubmission = baseProps.openRound.submissions[0];
    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: String(roundId),
        song: String(targetSubmission.song.id),
      }),
    });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.deepEqual(props.nestedEntity, {
      kind: "song",
      id: targetSubmission.song.id,
    });
    assert.ok(props.openRound, "expected nested modal state to preserve the round detail");
    assert.ok(props.openSongModal, "expected song modal content to load");
    assert.equal(props.openPlayerModal, null);
    assert.equal((markup.match(/role=\"dialog\"/g) ?? []).length, 2);
    assert.match(markup, new RegExp(`href=\"/\\?round=${roundId}&amp;song=${targetSubmission.song.id}\"`));
    assert.match(
      markup,
      new RegExp(`href=\"/\\?round=${roundId}&amp;player=${targetSubmission.player.id}\"`),
    );
    assert.match(markup, /Song detail/);
    assert.match(markup, /Back to round/);
    assert.match(markup, /Round detail/);
  },
);
