const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createTempPrismaDb } = require("./helpers/temp-prisma-db");
const {
  ArchiveRoutePage,
  getGamePageData,
  getGameRouteData,
  getLandingPageData,
  getLandingRouteData,
  getPlayerDetailData,
  getPlayerRouteData,
  getRoundPageData,
  getRoundRouteData,
  getSongBrowserData,
  getSongDetailData,
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

test("song browser loader normalizes filters and exposes zero-state metadata", async () => {
  const prismaStub = {
    song: {
      async findMany() {
        return [
          {
            id: 1,
            title: "Bright Signal",
            artist: { name: "Signal Choir" },
            submissions: [
              {
                id: 1,
                songId: 1,
                rank: 1,
                score: 10,
                submittedAt: new Date("2026-01-02T00:00:00Z"),
                round: {
                  id: 3,
                  name: "Opening Night",
                  occurredAt: null,
                  game: { id: 2, sourceGameId: "browser-game", displayName: "Browser Game" },
                },
              },
            ],
          },
        ];
      },
    },
  };

  const invalidVisible = await getSongBrowserData({
    familiarity: "unsupported",
    sort: "unknown-sort",
    input: { prisma: prismaStub },
  });
  const zeroResult = await getSongBrowserData({
    q: "missing",
    familiarity: "unsupported",
    input: { prisma: prismaStub },
  });
  const emptyArchive = await getSongBrowserData({
    input: { prisma: { song: { async findMany() { return []; } } } },
  });

  assert.equal(invalidVisible.familiarity, "all");
  assert.equal(invalidVisible.sort, "most-recent");
  assert.match(invalidVisible.status, /Invalid familiarity filter reset/);
  assert.match(invalidVisible.status, /Invalid sort reset/);
  assert.equal(invalidVisible.rows[0].artistSearchHref, "/songs?q=Signal+Choir");
  assert.deepEqual(invalidVisible.rows[0].mostRecentAppearance, {
    gameName: "Browser Game",
    roundName: "Opening Night",
    href: "/games/2/rounds/3",
  });

  assert.equal(zeroResult.isZeroResult, true);
  assert.equal(zeroResult.status, "");
  assert.equal(zeroResult.clearHref, "/songs");
  assert.equal(emptyArchive.isEmpty, true);
  assert.equal(emptyArchive.totalCatalogSize, 0);
});

test(
  "landing page data partitions games, filters completed games, and caps initial completed visibility",
  { concurrency: false },
  async () => {
    const landingDb = createTempPrismaDb({
      prefix: "music-league-landing-route-",
      filename: "landing-route.sqlite",
      seed: false,
    });

    try {
      const alpha = await landingDb.prisma.player.create({
        data: {
          displayName: "Alpha Ace",
          normalizedName: "alpha ace",
          sourcePlayerId: "landing-alpha",
        },
      });
      const beta = await landingDb.prisma.player.create({
        data: {
          displayName: "Beta Bard",
          normalizedName: "beta bard",
          sourcePlayerId: "landing-beta",
        },
      });
      const artist = await landingDb.prisma.artist.create({
        data: {
          name: "Landing Band",
          normalizedName: "landing band",
        },
      });
      const song = await landingDb.prisma.song.create({
        data: {
          title: "Landing Song",
          normalizedTitle: "landing song",
          spotifyUri: "spotify:track:landing-song",
          artistId: artist.id,
        },
      });

      async function createLandingGame(index, overrides = {}) {
        const winner = overrides.winner ?? alpha;
        const occurredAt =
          overrides.occurredAt === undefined
            ? new Date(Date.UTC(2025, 0, 1 + index))
            : overrides.occurredAt;
        const game = await landingDb.prisma.game.create({
          data: {
            sourceGameId: overrides.sourceGameId ?? `landing-${String(index).padStart(3, "0")}`,
            displayName: overrides.displayName ?? `Landing Game ${index}`,
            finished: overrides.finished ?? true,
          },
        });
        const round = await landingDb.prisma.round.create({
          data: {
            gameId: game.id,
            leagueSlug: game.sourceGameId,
            sourceRoundId: `${game.sourceGameId}-round`,
            name: `Round ${index}`,
            sequenceNumber: 1,
            occurredAt,
          },
        });

        await landingDb.prisma.submission.create({
          data: {
            roundId: round.id,
            playerId: winner.id,
            songId: song.id,
            score: overrides.scored === false ? null : 12,
            rank: overrides.scored === false ? null : 1,
            submittedAt: overrides.submittedAt ?? occurredAt,
          },
        });

        return game;
      }

      for (let index = 0; index < 102; index += 1) {
        await createLandingGame(index);
      }

      await createLandingGame(200, {
        displayName: "Filtered 2024 Winner",
        sourceGameId: "landing-2024-beta",
        winner: beta,
        occurredAt: new Date("2024-06-01T00:00:00.000Z"),
      });
      await createLandingGame(300, {
        displayName: "Current Filter Bypass",
        sourceGameId: "landing-current",
        finished: false,
        winner: beta,
        occurredAt: new Date("2023-06-01T00:00:00.000Z"),
      });
      await createLandingGame(400, {
        displayName: "Undated Completed",
        sourceGameId: "landing-undated",
        occurredAt: null,
        submittedAt: null,
        scored: false,
      });

      const filtered = await getLandingPageData({
        year: "2025",
        winner: "alpha",
        input: { prisma: landingDb.prisma },
      });

      assert.equal(filtered.currentGames.length, 1);
      assert.equal(filtered.currentGames[0].displayName, "Current Filter Bypass");
      assert.equal(filtered.completedTotal, 102);
      assert.equal(filtered.completedVisibleCount, 100);
      assert.equal(filtered.completedGames.length, 102);
      assert.equal(filtered.showCompletedFilters, true);
      assert.deepEqual(filtered.filters, { year: "2025", winner: "alpha" });
      assert.equal(filtered.completedGames[0].displayName, "Landing Game 101");
      assert.equal(filtered.completedGames[0].winnerLabel, "Alpha Ace");
      assert.match(filtered.completedGames[0].timeframeLabel, /Apr 12, 2025/);
      assert.ok(
        filtered.completedGames.every((game) => game.status === "Completed"),
        "filtered completed grid should contain completed games only",
      );
      assert.ok(
        filtered.currentGames.every((game) => game.status === "Current"),
        "current band should contain current games only",
      );

      const invalidYear = await getLandingPageData({
        year: "not-a-year",
        winner: "",
        input: { prisma: landingDb.prisma },
      });

      assert.deepEqual(invalidYear.filters, { year: null, winner: null });
      assert.equal(invalidYear.completedTotal, 104);
      assert.equal(
        invalidYear.completedGames.find((game) => game.displayName === "Undated Completed").timeframeLabel,
        null,
      );

      const routeData = await getLandingRouteData({
        prisma: landingDb.prisma,
        searchParams: { year: "2025", winner: "alpha", round: "999" },
      });
      const markup = renderToStaticMarkup(React.createElement(ArchiveRoutePage, { data: routeData }));

      assert.match(markup, /name="year"/);
      assert.match(markup, /name="winner"/);
      assert.match(markup, /Showing 100 of 102 completed games/);
      assert.match(markup, /Show more \(2\)/);
      assert.match(markup, /data-archive-badge-variant="status-current"/);
      assert.match(markup, /data-archive-badge-variant="status-completed"/);
      assert.equal(markup.match(/class="archive-landing-card"/g)?.length, 101);
      assert.ok(!markup.includes("role=\"dialog\""));
      assert.ok(!markup.includes("archive-overlay"));
    } finally {
      await landingDb.cleanup();
    }
  },
);

test(
  "game page loader renders ordered rounds, playlist links, provisional ties, and pending scoring",
  { concurrency: false },
  async () => {
    const gameDb = createTempPrismaDb({
      prefix: "music-league-game-route-",
      filename: "game-route.sqlite",
      seed: false,
    });

    try {
      const ada = await gameDb.prisma.player.create({
        data: {
          displayName: "Ada",
          normalizedName: "ada",
          sourcePlayerId: "game-route-ada",
        },
      });
      const bea = await gameDb.prisma.player.create({
        data: {
          displayName: "Bea",
          normalizedName: "bea",
          sourcePlayerId: "game-route-bea",
        },
      });
      const artist = await gameDb.prisma.artist.create({
        data: {
          name: "Game Route Band",
          normalizedName: "game route band",
        },
      });
      const songA = await gameDb.prisma.song.create({
        data: {
          title: "Tie Song A",
          normalizedTitle: "tie song a",
          spotifyUri: "spotify:track:game-route-a",
          artistId: artist.id,
        },
      });
      const songB = await gameDb.prisma.song.create({
        data: {
          title: "Tie Song B",
          normalizedTitle: "tie song b",
          spotifyUri: "spotify:track:game-route-b",
          artistId: artist.id,
        },
      });
      const game = await gameDb.prisma.game.create({
        data: {
          sourceGameId: "game-route-current",
          displayName: "Game Route Current",
          description: "A current game for route coverage.",
          finished: false,
        },
      });
      const lateRound = await gameDb.prisma.round.create({
        data: {
          gameId: game.id,
          leagueSlug: game.sourceGameId,
          sourceRoundId: "game-route-late",
          name: "Late Round",
          sequenceNumber: 2,
          occurredAt: new Date("2026-03-02T00:00:00.000Z"),
        },
      });
      const opener = await gameDb.prisma.round.create({
        data: {
          gameId: game.id,
          leagueSlug: game.sourceGameId,
          sourceRoundId: "game-route-opener",
          name: "Opener",
          sequenceNumber: 1,
          occurredAt: new Date("2026-03-01T00:00:00.000Z"),
          playlistUrl: "https://example.com/game-route-playlist",
        },
      });

      await gameDb.prisma.submission.createMany({
        data: [
          {
            roundId: opener.id,
            playerId: ada.id,
            songId: songA.id,
            score: 10,
            rank: 1,
            submittedAt: new Date("2026-03-01T01:00:00.000Z"),
          },
          {
            roundId: lateRound.id,
            playerId: bea.id,
            songId: songB.id,
            score: 10,
            rank: 1,
            submittedAt: new Date("2026-03-02T01:00:00.000Z"),
          },
        ],
      });

      const pageData = await getGamePageData(game.id, { prisma: gameDb.prisma });
      const routeData = await getGameRouteData(game.id, { prisma: gameDb.prisma });
      const markup = renderToStaticMarkup(React.createElement(ArchiveRoutePage, { data: routeData }));

      assert.equal(pageData.kind, "ready");
      assert.equal(pageData.props.game.status, "Current");
      assert.equal(pageData.props.game.scoredRoundCount, 2);
      assert.deepEqual(
        pageData.props.rounds.map((round) => round.roundId),
        [opener.id, lateRound.id],
      );
      assert.equal(pageData.props.rounds[0].playlistUrl, "https://example.com/game-route-playlist");
      assert.deepEqual(
        pageData.props.leaderboard.rows.map((row) => [row.displayName, row.rankLabel, row.isTiedRank]),
        [
          ["Ada", "T1", true],
          ["Bea", "T1", true],
        ],
      );
      assert.equal(pageData.props.competitiveAnchor.headline, "Tied leaders: Ada & Bea at 10 points");
      assert.match(markup, /Standings are provisional while this game is in progress/);
      assert.match(markup, /href="\/players\//);
      assert.match(markup, /href="\/games\/\d+\/rounds\/\d+"/);
      assert.match(markup, /href="https:\/\/example.com\/game-route-playlist"/);
      assert.match(markup, /target="_blank"/);
      assert.match(markup, /rel="noopener"/);

      const pendingGame = await gameDb.prisma.game.create({
        data: {
          sourceGameId: "game-route-pending",
          displayName: "Pending Game",
          finished: true,
        },
      });
      await gameDb.prisma.round.create({
        data: {
          gameId: pendingGame.id,
          leagueSlug: pendingGame.sourceGameId,
          sourceRoundId: "game-route-pending-round",
          name: "Pending Round",
          sequenceNumber: 1,
        },
      });
      const pendingRoute = await getGameRouteData(pendingGame.id, { prisma: gameDb.prisma });
      const pendingMarkup = renderToStaticMarkup(React.createElement(ArchiveRoutePage, { data: pendingRoute }));

      assert.equal(pendingRoute.game.leaderboard.length, 0);
      assert.match(pendingMarkup, /Scoring evidence has not been imported/);
      assert.ok(!pendingMarkup.includes("<table>"));
    } finally {
      await gameDb.cleanup();
    }
  },
);

test(
  "player detail loader aggregates scoped voting history through same-round submission attribution",
  { concurrency: false },
  async () => {
    const playerDb = createTempPrismaDb({
      prefix: "music-league-player-route-",
      filename: "player-route.sqlite",
      seed: false,
    });

    try {
      const target = await playerDb.prisma.player.create({
        data: {
          displayName: "Target Taylor",
          normalizedName: "target taylor",
          sourcePlayerId: "player-route-target",
        },
      });
      const giver = await playerDb.prisma.player.create({
        data: {
          displayName: "Giver Gia",
          normalizedName: "giver gia",
          sourcePlayerId: "player-route-giver",
        },
      });
      const other = await playerDb.prisma.player.create({
        data: {
          displayName: "Other Omar",
          normalizedName: "other omar",
          sourcePlayerId: "player-route-other",
        },
      });
      const sparse = await playerDb.prisma.player.create({
        data: {
          displayName: "Sparse Sam",
          normalizedName: "sparse sam",
          sourcePlayerId: "player-route-sparse",
        },
      });
      const artist = await playerDb.prisma.artist.create({
        data: {
          name: "Attribution Band",
          normalizedName: "attribution band",
        },
      });
      const recurringSong = await playerDb.prisma.song.create({
        data: {
          title: "Recurring Signal",
          normalizedTitle: "recurring signal",
          spotifyUri: "spotify:track:player-route-recurring",
          artistId: artist.id,
        },
      });
      const giverSong = await playerDb.prisma.song.create({
        data: {
          title: "Giver Tune",
          normalizedTitle: "giver tune",
          spotifyUri: "spotify:track:player-route-giver",
          artistId: artist.id,
        },
      });
      const targetSong = await playerDb.prisma.song.create({
        data: {
          title: "Target Followup",
          normalizedTitle: "target followup",
          spotifyUri: "spotify:track:player-route-target-followup",
          artistId: artist.id,
        },
      });
      const gameA = await playerDb.prisma.game.create({
        data: {
          sourceGameId: "player-route-a",
          displayName: "Attribution A",
        },
      });
      const gameB = await playerDb.prisma.game.create({
        data: {
          sourceGameId: "player-route-b",
          displayName: "Attribution B",
        },
      });
      const roundA = await playerDb.prisma.round.create({
        data: {
          gameId: gameA.id,
          leagueSlug: "player-route-a",
          sourceRoundId: "player-route-a-round",
          name: "Round A",
          sequenceNumber: 1,
          occurredAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      });
      const roundB = await playerDb.prisma.round.create({
        data: {
          gameId: gameB.id,
          leagueSlug: "player-route-b",
          sourceRoundId: "player-route-b-round",
          name: "Round B",
          sequenceNumber: 1,
          occurredAt: new Date("2024-02-01T00:00:00.000Z"),
        },
      });

      await playerDb.prisma.submission.createMany({
        data: [
          {
            roundId: roundA.id,
            playerId: target.id,
            songId: recurringSong.id,
            score: 10,
            rank: 1,
            comment: "Target brought the first signal.",
            submittedAt: new Date("2024-01-01T12:00:00.000Z"),
          },
          {
            roundId: roundA.id,
            playerId: giver.id,
            songId: giverSong.id,
            score: 5,
            rank: 2,
            submittedAt: new Date("2024-01-01T12:05:00.000Z"),
          },
          {
            roundId: roundB.id,
            playerId: other.id,
            songId: recurringSong.id,
            score: 7,
            rank: 1,
            submittedAt: new Date("2024-02-01T12:00:00.000Z"),
          },
          {
            roundId: roundB.id,
            playerId: target.id,
            songId: targetSong.id,
            score: 4,
            rank: 2,
            submittedAt: new Date("2024-02-01T12:05:00.000Z"),
          },
        ],
      });
      await playerDb.prisma.vote.createMany({
        data: [
          {
            roundId: roundA.id,
            voterId: giver.id,
            songId: recurringSong.id,
            pointsAssigned: 5,
            comment: "Target hit.",
            votedAt: new Date("2024-01-02T00:00:00.000Z"),
          },
          {
            roundId: roundA.id,
            voterId: target.id,
            songId: giverSong.id,
            pointsAssigned: 4,
            comment: "Returned the favor.",
            votedAt: new Date("2024-01-02T00:05:00.000Z"),
          },
          {
            roundId: roundB.id,
            voterId: giver.id,
            songId: recurringSong.id,
            pointsAssigned: 7,
            comment: "Same song elsewhere.",
            votedAt: new Date("2024-02-02T00:00:00.000Z"),
          },
          {
            roundId: roundB.id,
            voterId: target.id,
            songId: recurringSong.id,
            pointsAssigned: -2,
            comment: "Downbeat repeat.",
            votedAt: new Date("2024-02-02T00:05:00.000Z"),
          },
        ],
      });

      const detail = await getPlayerDetailData(target.id, {
        input: { prisma: playerDb.prisma },
      });
      const scoped = await getPlayerDetailData(target.id, {
        voteGameId: gameA.id,
        input: { prisma: playerDb.prisma },
      });
      const invalidScope = await getPlayerDetailData(target.id, {
        voteGameId: 99999,
        input: { prisma: playerDb.prisma },
      });
      const sparseDetail = await getPlayerDetailData(sparse.id, {
        input: { prisma: playerDb.prisma },
      });
      const routeData = await getPlayerRouteData(target.id, {
        prisma: playerDb.prisma,
        searchParams: { voteGameId: String(gameA.id) },
      });
      const markup = renderToStaticMarkup(React.createElement(ArchiveRoutePage, { data: routeData }));

      assert.equal(detail.kind, "ready");
      assert.equal(detail.props.player.totalSubmissions, 2);
      assert.equal(detail.props.player.totalVotesCast, 2);
      assert.equal(detail.props.player.totalPointsReceived, 5);
      assert.equal(detail.props.notablePicks.length, 2);
      assert.equal(detail.props.submissionGroups.length, 2);
      assert.equal(detail.props.votesGiven.hasNegativeVotes, true);
      assert.deepEqual(
        detail.props.votesGiven.rows.map((row) => [row.displayName, row.netPoints, row.voteCount]),
        [
          ["Giver Gia", 4, 1],
          ["Other Omar", -2, 1],
        ],
      );
      assert.equal(detail.props.votesReceived.rows.length, 1);
      assert.equal(detail.props.votesReceived.rows[0].displayName, "Giver Gia");
      assert.equal(detail.props.votesReceived.rows[0].netPoints, 5);
      assert.equal(detail.props.votesReceived.rows[0].comments[0].roundHref, `/games/${gameA.id}/rounds/${roundA.id}`);
      assert.ok(
        detail.props.voteScope.options.some(
          (option) => option.kind === "game" && option.gameId === gameB.id,
        ),
      );

      assert.equal(scoped.props.voteScope.active.kind, "game");
      assert.equal(scoped.props.voteScope.active.gameId, gameA.id);
      assert.equal(scoped.props.votesGiven.hasNegativeVotes, false);
      assert.deepEqual(
        scoped.props.votesGiven.rows.map((row) => [row.displayName, row.netPoints]),
        [["Giver Gia", 4]],
      );
      assert.deepEqual(
        scoped.props.votesReceived.rows.map((row) => [row.displayName, row.netPoints]),
        [["Giver Gia", 5]],
      );

      assert.equal(invalidScope.props.voteScope.active.kind, "all");
      assert.equal(sparseDetail.kind, "sparse");
      assert.equal(sparseDetail.props.player.totalSubmissions, 0);
      assert.match(sparseDetail.statusNotice.body, /No submissions or votes/);
      assert.match(markup, /<caption>Votes given - Attribution A<\/caption>/);
      assert.match(markup, /aria-current="page"/);
      assert.ok(!markup.includes("role=\"dialog\""));
    } finally {
      await playerDb.cleanup();
    }
  },
);

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
    const roundPage = await getRoundPageData(mainGameId, mainRoundId, { prisma });
    const round = await getRoundRouteData(mainGameId, mainRoundId, { prisma });
    const songs = await getSongsRouteData({ prisma, searchParams: { q: "bright" } });
    const songDetail = await getSongDetailData(songId, { prisma });
    const song = await getSongRouteData(songId, { prisma });
    const playerRoute = await getPlayerRouteData(player.id, { prisma });
    const missingSong = await getSongDetailData("not-a-song", { prisma });
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
    assert.equal(roundPage.kind, "ready");
    assert.equal(roundPage.props.round.gameId, mainGameId);
    assert.ok(roundPage.props.round.gameDisplayName);
    assert.ok(roundPage.props.round.occurredAtLabel || roundPage.props.round.occurredAtLabel === null);
    assert.ok(roundPage.props.highlights.length <= 3);
    assert.ok(
      roundPage.props.submissions.every(
        (submission) =>
          submission.song.href === `/songs/${submission.song.id}` &&
          submission.submitter.href === `/players/${submission.submitter.id}` &&
          submission.familiarity.kind,
      ),
    );
    assert.ok(
      roundPage.props.submissions
        .flatMap((submission) => submission.votes)
        .every((vote) => vote.voter.href === `/players/${vote.voter.id}`),
    );
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
    assert.equal(songDetail.kind, "ready");
    assert.equal(songDetail.props.song.songId, songId);
    assert.equal(songDetail.props.song.familiarity.kind, song.song.familiarity.kind);
    assert.equal(songDetail.props.song.href, `/songs/${songId}`);
    assert.equal(songDetail.props.song.artistSearchHref.startsWith("/songs?q="), true);
    assert.equal(songDetail.props.backHref, "/songs");
    assert.equal(missingSong.kind, "not-found");
    assert.equal(missingSong.statusNotice.href, "/songs");
    assert.equal(song.kind, "song");
    assert.equal(song.shell.gameContext, null);
    assert.ok(song.song.familiarity.label);
    assert.ok(song.summaryFacts.some((fact) => fact.label === "First appearance"));
    assert.ok(song.summaryFacts.some((fact) => fact.label === "Most recent appearance"));
    assert.ok(song.summaryFacts.some((fact) => fact.label === "Artist footprint"));
    assert.ok(song.summaryFacts.some((fact) => fact.label === "Best finish"));
    assert.ok(song.originLabels.some((origin) => origin.startsWith("Song origin: ")));
    assert.ok(song.historyGroups.length > 0);
    assert.ok(
      song.historyGroups.every((group) =>
        group.rows.every(
          (row) =>
            row.round.href === `/games/${group.gameId}/rounds/${row.round.id}` &&
            row.submitter.href === `/players/${row.submitter.id}` &&
            Object.prototype.hasOwnProperty.call(row, "isOrigin"),
        ),
      ),
    );
    assert.equal(playerRoute.kind, "player");
    assert.equal(playerRoute.shell.gameContext, null);
    assert.ok(playerRoute.player.aggregate.submissionCount > 0);
    assert.ok(Array.isArray(playerRoute.traits));
    assert.ok(playerRoute.notablePicks.some((pick) => pick.song.href === `/songs/${pick.song.id}`));
    assert.ok(playerRoute.submissionGroups.every((group) => group.rows.every((row) => row.round.href.startsWith("/games/"))));
    assert.ok(playerRoute.votesGiven.rows.length > 0);
    assert.ok(playerRoute.votesReceived.rows.length > 0);
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
    const pendingRoundId = await findRoundIdBySourceId("seed-r2");
    const songId = await findSongIdBySpotifyUri("spotify:track:seed-song-001");
    const player = await prisma.player.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });

    assert.ok(player, "expected a seeded player");

    const gameData = await getGameRouteData(mainGameId, { prisma });
    const roundData = await getRoundRouteData(mainGameId, mainRoundId, { prisma });
    const pendingRound = await getRoundRouteData(mainGameId, pendingRoundId, { prisma });
    const songsData = await getSongsRouteData({ prisma, searchParams: { q: "bright" } });
    const songData = await getSongRouteData(songId, { prisma });
    const playerData = await getPlayerRouteData(player.id, { prisma });
    const markup = [
      gameData,
      roundData,
      pendingRound,
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
    assert.match(markup, /aria-expanded="false"/);
    assert.match(markup, /Show \d+ votes?/);
    assert.match(markup, /No imported votes/);
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
    assert.ok(!markup.includes("<details"));
  },
);
