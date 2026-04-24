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
    const familiarityCueCount =
      (submissionMarkup.match(/class=\"archive-submission-familiarity\"/g) ?? []).length;

    for (let index = 1; index < orderedPlayers.length; index += 1) {
      assert.ok(
        submissionMarkup.indexOf(orderedPlayers[index - 1]) <
          submissionMarkup.indexOf(orderedPlayers[index]),
        "expected submission titles to render in round detail order",
      );
    }

    assert.equal(familiarityCueCount, props.openRound.submissions.length);
    assert.ok(
      props.openRound.submissions.every(
        (submission) => submission.song.familiarity.label === "New to us",
      ),
    );
    assert.match(submissionMarkup, /New to us/);
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
    assert.equal(props.openSongModal.familiarity.kind, targetSubmission.song.familiarity.kind);
    assert.equal(props.openSongModal.familiarity.label, targetSubmission.song.familiarity.label);
    assert.equal((markup.match(/role=\"dialog\"/g) ?? []).length, 2);
    assert.match(markup, new RegExp(`href=\"/\\?round=${roundId}&amp;song=${targetSubmission.song.id}\"`));
    assert.match(
      markup,
      new RegExp(`href=\"/\\?round=${roundId}&amp;player=${targetSubmission.player.id}\"`),
    );
    assert.match(markup, /Song detail/);
    assert.match(markup, /archive-song-modal-familiarity/);
    assert.match(markup, /New to us: No earlier song or artist history/);
    assert.match(markup, /Back to round/);
    assert.match(markup, /Round detail/);
  },
);

test(
  "round-scoped song URLs keep milestone 3 close behavior outside player flow",
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
    const songShellMarkup = markup.slice(markup.lastIndexOf('data-nested-kind="song"'));
    const closeHrefMatches = songShellMarkup.match(
      new RegExp(`href=\"/\\?round=${roundId}\"`, "g"),
    );

    assert.deepEqual(props.nestedEntity, {
      kind: "song",
      id: targetSubmission.song.id,
    });
    assert.ok(props.openSongModal, "expected the legacy round-scoped song shell to stay open");
    assert.equal(props.openPlayerModal, null);
    assert.deepEqual(closeHrefMatches, [`href="/?round=${roundId}"`, `href="/?round=${roundId}"`]);
    assert.ok(!songShellMarkup.includes("playerSubmission="));
    assert.ok(!songShellMarkup.includes(`player=${targetSubmission.player.id}`));
    assert.match(songShellMarkup, /Back to round/);
  },
);

test(
  "player flows keep control of nested selection and resolve player submissions inside the player modal state",
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
    const playerHistorySubmission = await prisma.submission.findFirst({
      where: {
        playerId: targetSubmission.player.id,
        round: {
          gameId: baseProps.openRound.game.id,
        },
        id: {
          not: targetSubmission.id,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    assert.ok(playerHistorySubmission, "expected a second same-game submission for the target player");

    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: String(roundId),
        player: String(targetSubmission.player.id),
        playerSubmission: String(playerHistorySubmission.id),
        song: String(targetSubmission.song.id),
      }),
    });

    assert.deepEqual(props.nestedEntity, {
      kind: "player",
      id: targetSubmission.player.id,
    });
    assert.equal(props.openSongModal, null);
    assert.ok(props.openPlayerModal, "expected player modal content to load");
    assert.equal(props.openPlayerModal.activeSubmissionId, playerHistorySubmission.id);
    assert.equal(props.openPlayerModal.activeSubmission?.submissionId, playerHistorySubmission.id);
    assert.ok(
      props.openPlayerModal.activeSubmission?.familiarity,
      "expected player-scoped song detail to include familiarity",
    );
  },
);

test(
  "direct player entry renders summary picks and cross-round history links inside the nested player shell",
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
    const playerHistorySubmission = await prisma.submission.findFirst({
      where: {
        playerId: targetSubmission.player.id,
        round: {
          gameId: baseProps.openRound.game.id,
        },
        id: {
          not: targetSubmission.id,
        },
      },
      select: {
        id: true,
        round: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    assert.ok(playerHistorySubmission, "expected a second same-game submission for history coverage");

    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: String(roundId),
        player: String(targetSubmission.player.id),
      }),
    });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));

    assert.ok(props.openPlayerModal, "expected direct player entry to load player detail");
    assert.equal(props.openPlayerModal.activeSubmissionId, null);
    assert.equal((markup.match(/role=\"dialog\"/g) ?? []).length, 2);
    assert.match(markup, /Player detail/);
    assert.match(markup, /Full history/);
    assert.match(
      markup,
      new RegExp(
        `href=\"/\\?round=${roundId}&amp;player=${targetSubmission.player.id}&amp;playerSubmission=${playerHistorySubmission.id}\"`,
      ),
    );
    assert.match(markup, new RegExp(`href=\"/\\?round=${playerHistorySubmission.round.id}\"`));
    assert.match(markup, new RegExp(playerHistorySubmission.round.name));
    assert.ok(!markup.includes("Round-scoped submission"));

    if (props.openPlayerModal.notablePicks.best) {
      assert.match(markup, /Best Pick/);
    }

    if (props.openPlayerModal.notablePicks.worst) {
      assert.match(markup, /Worst Pick/);
    }
  },
);

test(
  "player submission selection swaps in the player-scoped song view without deeper push links",
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
    const playerHistorySubmission = await prisma.submission.findFirst({
      where: {
        playerId: targetSubmission.player.id,
        round: {
          gameId: baseProps.openRound.game.id,
        },
        id: {
          not: targetSubmission.id,
        },
      },
      select: {
        id: true,
        round: {
          select: {
            id: true,
            name: true,
          },
        },
        song: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    assert.ok(playerHistorySubmission, "expected a second same-game submission for song-view coverage");

    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: String(roundId),
        player: String(targetSubmission.player.id),
        playerSubmission: String(playerHistorySubmission.id),
      }),
    });
    const markup = renderToStaticMarkup(React.createElement(GameArchivePage, props));
    const playerShellMarkup = markup.slice(
      markup.lastIndexOf('class="archive-nested-shell archive-player-shell"'),
    );

    assert.ok(props.openPlayerModal?.activeSubmission, "expected a player-scoped song view to load");
    assert.ok(props.openPlayerModal.activeSubmission.familiarity);
    assert.match(markup, new RegExp(`Back to ${targetSubmission.player.displayName} summary`));
    assert.ok(markup.includes(playerHistorySubmission.song.title));
    assert.ok(markup.includes(playerHistorySubmission.round.name));
    assert.match(markup, /archive-song-modal-familiarity/);
    assert.ok(!playerShellMarkup.includes(`href="/?round=${playerHistorySubmission.round.id}"`));
    assert.ok(!playerShellMarkup.includes("playerSubmission="));
    assert.equal((playerShellMarkup.match(/href=\"/g) ?? []).length, 2);
  },
);

test(
  "invalid player submissions fall back to the player summary without reopening the round song shell",
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
    const foreignSubmission = await prisma.submission.findFirst({
      where: {
        playerId: {
          not: targetSubmission.player.id,
        },
        round: {
          gameId: baseProps.openRound.game.id,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    assert.ok(foreignSubmission, "expected a different player's submission for fallback coverage");

    const props = await buildGameArchivePageProps({
      prisma,
      searchParams: Promise.resolve({
        round: String(roundId),
        player: String(targetSubmission.player.id),
        playerSubmission: String(foreignSubmission.id),
        song: String(targetSubmission.song.id),
      }),
    });

    assert.deepEqual(props.nestedEntity, {
      kind: "player",
      id: targetSubmission.player.id,
    });
    assert.equal(props.openSongModal, null);
    assert.ok(props.openPlayerModal, "expected player modal content to remain open");
    assert.equal(props.openPlayerModal.activeSubmissionId, null);
    assert.equal(props.openPlayerModal.activeSubmission, null);
  },
);
