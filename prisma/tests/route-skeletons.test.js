const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");
const {
  ArchiveRoutePage,
  getGameRouteData,
  getLandingRouteData,
  getPlayerRouteData,
  getRoundRouteData,
  getSongRouteData,
  getSongsRouteData,
} = require("../../src/archive/route-skeletons");

const { prisma, cleanup } = createTempPrismaDb({
  prefix: "music-league-route-skeletons-",
  filename: "route-skeletons.sqlite",
  seed: true,
});

async function findGameIdBySourceId(sourceGameId) {
  const game = await prisma.game.findUnique({
    where: { sourceGameId },
    select: { id: true },
  });

  assert.ok(game, `expected seeded game ${sourceGameId} to exist`);

  return game.id;
}

async function findRoundIdBySourceId(sourceRoundId) {
  const round = await prisma.round.findFirst({
    where: { sourceRoundId },
    select: { id: true },
  });

  assert.ok(round, `expected seeded round ${sourceRoundId} to exist`);

  return round.id;
}

async function findSongIdBySpotifyUri(spotifyUri) {
  const song = await prisma.song.findUnique({
    where: { spotifyUri },
    select: { id: true },
  });

  assert.ok(song, `expected seeded song ${spotifyUri} to exist`);

  return song.id;
}

test.after(async () => {
  await cleanup();
});

test(
  "route skeleton loaders render stable route data and invalid-id status notices",
  { concurrency: false },
  async () => {
    const mainGameId = await findGameIdBySourceId("main");
    const afterpartyGameId = await findGameIdBySourceId("afterparty");
    const mainRoundId = await findRoundIdBySourceId("seed-r1");
    const songId = await findSongIdBySpotifyUri("spotify:track:seed-song-001");
    const player = await prisma.player.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });

    assert.ok(player, "expected a seeded player");

    const landing = await getLandingRouteData({
      prisma,
      searchParams: {
        round: String(mainRoundId),
        winner: "",
        year: "not-a-year",
      },
    });
    const game = await getGameRouteData(mainGameId, { prisma });
    const round = await getRoundRouteData(mainGameId, mainRoundId, { prisma });
    const songs = await getSongsRouteData({ prisma, searchParams: { q: "bright" } });
    const song = await getSongRouteData(songId, { prisma });
    const playerRoute = await getPlayerRouteData(player.id, { prisma });
    const missingGame = await getGameRouteData("not-an-id", { prisma });
    const wrongGameRound = await getRoundRouteData(afterpartyGameId, mainRoundId, { prisma });
    const invalidRoundForGame = await getRoundRouteData(mainGameId, "not-a-round", { prisma });
    const invalidRoundForMissingGame = await getRoundRouteData(
      Math.max(mainGameId, afterpartyGameId) + 100_000,
      "not-a-round",
      { prisma },
    );

    assert.equal(landing.kind, "landing");
    assert.equal(landing.shell.activeRoute, "landing");
    assert.equal(landing.shell.switcher.selectedGameId, null);
    assert.ok(landing.currentGames.length + landing.completedGames.length > 0);
    assert.equal(game.kind, "game");
    assert.equal(game.shell.activeRoute, "game");
    assert.equal(game.shell.gameContext.gameId, mainGameId);
    assert.equal(game.shell.switcher.selectedGameId, mainGameId);
    assert.ok(game.game.rounds.every((routeRound) => routeRound.href.startsWith("/games/")));
    assert.ok(game.game.leaderboard.length > 0);
    assert.ok(game.game.memoryBoard.moments.length > 0);
    assert.ok(game.game.competitiveAnchor);
    assert.equal(round.kind, "round");
    assert.equal(round.shell.gameContext.gameId, mainGameId);
    assert.equal(round.round.game.href, `/games/${mainGameId}`);
    assert.ok(round.round.highlights.length > 0);
    assert.ok(round.round.submissions.some((submission) => submission.votes.length > 0));
    assert.equal(songs.kind, "songs");
    assert.equal(songs.shell.activeRoute, "songs");
    assert.equal(songs.shell.search.value, "bright");
    assert.equal(songs.query, "bright");
    assert.equal(songs.familiarity, "all");
    assert.equal(songs.sort, "most-recent");
    assert.ok(songs.songs.every((routeSong) => routeSong.href.startsWith("/songs/")));
    assert.equal(
      songs.songs.find((routeSong) => routeSong.id === songId).familiarity.kind,
      song.song.familiarity.kind,
    );
    assert.equal(song.kind, "song");
    assert.equal(song.shell.gameContext, null);
    assert.ok(song.song.familiarity.label);
    assert.ok(song.song.summaryFacts.length > 0);
    assert.ok(song.song.originLabels.length > 0);
    const firstSongSubmission = song.song.submissions[song.song.submissions.length - 1];
    assert.equal(
      song.song.originLabels.find((origin) => origin.id === "song-origin")?.value,
      `${firstSongSubmission.player.displayName} in ${firstSongSubmission.round.name}`,
    );
    assert.ok(song.song.historyGroups.length > 0);
    assert.ok(song.song.submissions.every((submission) => submission.round.game.id));
    assert.equal(playerRoute.kind, "player");
    assert.equal(playerRoute.shell.gameContext, null);
    assert.ok(playerRoute.player.aggregate.submissionCount > 0);
    assert.ok(playerRoute.player.trait);
    assert.ok(playerRoute.player.notablePicks.best);
    assert.ok(playerRoute.player.votesGiven.length > 0);
    assert.ok(playerRoute.player.votesReceived.length > 0);
    assert.equal(missingGame.status, "Invalid game ID.");
    assert.equal(wrongGameRound.status, "Round belongs to another game.");
    assert.equal(wrongGameRound.statusHref, `/games/${mainGameId}`);
    assert.equal(invalidRoundForGame.status, "Invalid round ID.");
    assert.equal(invalidRoundForGame.statusHref, `/games/${mainGameId}`);
    assert.equal(invalidRoundForMissingGame.status, "Invalid round ID.");
    assert.equal(invalidRoundForMissingGame.statusHref, "/");
  },
);

test(
  "route skeleton page renders header and avoids dialog overlays",
  { concurrency: false },
  async () => {
    const mainGameId = await findGameIdBySourceId("main");
    const mainRoundId = await findRoundIdBySourceId("seed-r1");
    const songId = await findSongIdBySpotifyUri("spotify:track:seed-song-001");
    const player = await prisma.player.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });

    assert.ok(player, "expected a seeded player");

    const gameData = await getGameRouteData(mainGameId, { prisma });
    const roundData = await getRoundRouteData(mainGameId, mainRoundId, { prisma });
    const songsData = await getSongsRouteData({ prisma, searchParams: { q: "bright" } });
    const songData = await getSongRouteData(songId, { prisma });
    const playerData = await getPlayerRouteData(player.id, { prisma });
    const markup = [
      gameData,
      roundData,
      songsData,
      songData,
      playerData,
    ]
      .map((data) => renderToStaticMarkup(React.createElement(ArchiveRoutePage, { data })))
      .join("\n");

    assert.match(markup, /Music League Archive/);
    assert.match(markup, /Skip to content/);
    assert.match(markup, /role=\"search\"/);
    assert.match(markup, /aria-controls=\"archive-shell-game-switcher-panel\"/);
    assert.match(markup, /Back to /);
    assert.match(markup, /Music League archive project/);
    assert.match(markup, /<caption>Leaderboard<\/caption>/);
    assert.match(markup, /href=\"\/songs\"/);
    assert.match(markup, new RegExp(`href=\"/games/${mainGameId}/rounds/\\d+\"`));
    assert.match(markup, /Leaderboard/);
    assert.match(markup, /Memory board/);
    assert.match(markup, /Competitive anchor/);
    assert.match(markup, /Expand all votes/);
    assert.match(markup, /name=\"q\"/);
    assert.match(markup, /name=\"familiarity\"/);
    assert.match(markup, /name=\"sort\"/);
    assert.match(markup, /Familiarity/);
    assert.match(markup, /Submission history/);
    assert.match(markup, /Votes given/);
    assert.match(markup, /Votes received/);
    assert.match(markup, /data-archive-badge-variant="status-/);
    assert.match(markup, /data-archive-badge-variant="rank-/);
    assert.match(markup, /data-archive-badge-variant="score"/);
    assert.match(markup, /data-archive-badge-role="primary"/);
    assert.ok(!markup.includes("role=\"dialog\""));
    assert.ok(!markup.includes("archive-overlay"));
  },
);
