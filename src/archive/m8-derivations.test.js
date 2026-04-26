const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildStatusNotice,
  compareSongAppearanceAscending,
  deriveArchiveSongFamiliarity,
  deriveGameRoundListItems,
  deriveGameTimeframe,
  deriveLeaderboardRows,
  deriveSongAppearanceFacts,
  getHeaderSearchSuggestions,
  getSongCatalog,
  mapVotesToRoundSubmissions,
  normalizeArchiveSearch,
  notFoundRouteData,
  readyRouteData,
  sparseRouteData,
} = require("./m8-derivations");
const {
  HEADER_SEARCH_QUERY_MAX_LENGTH,
  getArchiveSearchSuggestionsMethodNotAllowedResult,
  getArchiveSearchSuggestionsResult,
} = require("./search-suggestions-api");

test("normalizes archive search without throwing on empty punctuation", () => {
  assert.equal(normalizeArchiveSearch("  “Solar”  Static... "), "solar static");
  assert.equal(normalizeArchiveSearch(["  The Cure  "]), "the cure");
  assert.equal(normalizeArchiveSearch("  . , '\t\"  "), "");
  assert.equal(normalizeArchiveSearch(null), "");
});

test("derives event-only game timeframe labels and omits empty timeframes", () => {
  const roundStart = new Date("2026-02-01T00:00:00Z");
  const roundEnd = new Date("2026-02-08T00:00:00Z");
  const widenedEnd = new Date("2026-02-10T00:00:00Z");

  assert.deepEqual(deriveGameTimeframe({ rounds: [], submissions: [], votes: [] }), null);

  assert.deepEqual(
    deriveGameTimeframe({
      rounds: [{ occurredAt: roundStart }, { occurredAt: roundEnd }],
      submissions: [{ submittedAt: new Date("2026-02-02T00:00:00Z") }],
      votes: [{ votedAt: new Date("2026-02-07T00:00:00Z") }],
    }),
    {
      start: roundStart,
      end: roundEnd,
      label: "Feb 1, 2026 - Feb 8, 2026",
      source: "rounds",
    },
  );

  assert.deepEqual(
    deriveGameTimeframe({
      rounds: [{ occurredAt: roundStart }],
      submissions: [],
      votes: [{ votedAt: widenedEnd }],
    }),
    {
      start: roundStart,
      end: widenedEnd,
      label: "Feb 1, 2026 - Feb 10, 2026",
      source: "widened-events",
    },
  );
});

test("derives leaderboard ties by total points and round wins", () => {
  const result = deriveLeaderboardRows([
    { playerId: 1, playerName: "Ada", score: 10, rank: 1 },
    { playerId: 2, playerName: "Bea", score: 10, rank: 2 },
    { playerId: 3, playerName: "Cy", score: 8, rank: 1 },
    { playerId: 4, playerName: "Dana", score: 10, rank: 1 },
  ]);

  assert.equal(result.hasTies, true);
  assert.match(result.footnote, /share a rank/);
  assert.deepEqual(
    result.rows.map((row) => ({
      name: row.player.displayName,
      rank: row.rank,
      tied: row.tied,
      points: row.totalScore,
      wins: row.roundWins,
    })),
    [
      { name: "Ada", rank: 1, tied: true, points: 10, wins: 1 },
      { name: "Dana", rank: 1, tied: true, points: 10, wins: 1 },
      { name: "Bea", rank: 3, tied: false, points: 10, wins: 0 },
      { name: "Cy", rank: 4, tied: false, points: 8, wins: 1 },
    ],
  );
});

test("derives archive-wide exact-song familiarity", () => {
  assert.deepEqual(deriveArchiveSongFamiliarity(10, [{ songId: 10 }]), {
    kind: "first-time",
    label: "First-time",
    appearanceCount: 1,
    shortSummary: "1 archive appearance",
  });
  assert.equal(
    deriveArchiveSongFamiliarity(10, [{ songId: 10 }, { songId: 99 }, { songId: 10 }]).kind,
    "returning",
  );
});

test("maps votes to submissions through same-round song attribution", () => {
  const submissions = [
    { id: 101, roundId: 1, songId: 7, playerId: 1 },
    { id: 202, roundId: 2, songId: 7, playerId: 2 },
  ];
  const votes = [{ id: 1, roundId: 2, songId: 7, voterId: 3 }];
  const { votesBySubmissionId, submissionByVoteId } = mapVotesToRoundSubmissions({
    submissions,
    votes,
  });

  assert.deepEqual(votesBySubmissionId.get(101), []);
  assert.deepEqual(votesBySubmissionId.get(202), votes);
  assert.equal(submissionByVoteId.get(1), submissions[1]);
  assert.throws(
    () =>
      mapVotesToRoundSubmissions({
        submissions: [{ id: 1, roundId: 1, songId: 1, playerId: 1 }],
        votes: [{ id: 2, roundId: 2, songId: 1, voterId: 2 }],
      }),
    /without a same-round submission/,
  );
});

test("orders song appearances by submitted date, round date fallback, and stable id", () => {
  const game = { id: 1, sourceGameId: "main", displayName: "Main" };
  const player = { id: 1, displayName: "Ada" };
  const submissions = [
    {
      id: 20,
      songId: 5,
      rank: 2,
      score: 9,
      comment: null,
      submittedAt: new Date("2026-03-03T00:00:00Z"),
      createdAt: new Date("2020-01-01T00:00:00Z"),
      player,
      round: {
        id: 2,
        name: "Late",
        occurredAt: new Date("2026-03-01T00:00:00Z"),
        game,
      },
    },
    {
      id: 10,
      songId: 5,
      rank: 1,
      score: 12,
      comment: "Origin",
      submittedAt: null,
      createdAt: new Date("2030-01-01T00:00:00Z"),
      player,
      round: {
        id: 1,
        name: "Early",
        occurredAt: new Date("2026-03-02T00:00:00Z"),
        game,
      },
    },
  ];

  assert.equal([...submissions].sort(compareSongAppearanceAscending)[0].id, 10);

  const facts = deriveSongAppearanceFacts(submissions);

  assert.equal(facts.firstAppearance.id, 10);
  assert.equal(facts.mostRecentAppearance.id, 20);
  assert.equal(facts.historyGroups[0].rows[0].id, 20);
});

test("derives canonical game round list items", () => {
  const items = deriveGameRoundListItems({
    gameId: 7,
    rounds: [
      {
        id: 3,
        sequenceNumber: null,
        occurredAt: new Date("2026-04-03T00:00:00Z"),
        name: "Fallback",
        playlistUrl: null,
        submissions: [],
      },
      {
        id: 1,
        sequenceNumber: 1,
        occurredAt: null,
        name: "Opener",
        playlistUrl: "https://example.com/playlist",
        submissions: [
          {
            score: 5,
            rank: 1,
            playerId: 2,
            player: { id: 2, displayName: "Bea" },
            songId: 5,
          },
        ],
      },
      {
        id: 2,
        sequenceNumber: 2,
        occurredAt: new Date("2026-04-01T00:00:00Z"),
        name: "Partial",
        playlistUrl: null,
        submissions: [
          { score: 3, rank: 1, playerId: 1, player: { id: 1, displayName: "Ada" }, songId: 6 },
          { score: null, rank: 2, playerId: 2, player: { id: 2, displayName: "Bea" }, songId: 7 },
        ],
      },
    ],
  });

  assert.deepEqual(
    items.map((item) => item.id),
    [1, 2, 3],
  );
  assert.equal(items[0].href, "/games/7/rounds/1");
  assert.equal(items[0].playlistUrl, "https://example.com/playlist");
  assert.equal(items[0].status, "scored");
  assert.equal(items[0].winnerLabel, "Bea");
  assert.equal(items[1].status, "partial");
  assert.equal(items[2].status, "no-submissions");
});

test("builds song catalog rows and header suggestions from normalized song and artist matches", async () => {
  const prisma = {
    song: {
      async findMany() {
        return [
          {
            id: 1,
            title: "Solar Static",
            artist: { name: "The Comets" },
            submissions: [
              {
                id: 1,
                songId: 1,
                rank: 1,
                score: 12,
                submittedAt: new Date("2026-04-01T00:00:00Z"),
                round: {
                  id: 11,
                  name: "Sun Round",
                  occurredAt: new Date("2026-04-02T00:00:00Z"),
                  game: { id: 7, sourceGameId: "solar-game", displayName: "Solar Game" },
                },
              },
              {
                id: 2,
                songId: 1,
                rank: 2,
                score: 8,
                submittedAt: new Date("2026-04-10T00:00:00Z"),
                round: {
                  id: 12,
                  name: "Finale",
                  occurredAt: null,
                  game: { id: 7, sourceGameId: "solar-game", displayName: "Solar Game" },
                },
              },
            ],
          },
          {
            id: 2,
            title: "Moon Song",
            artist: { name: "Solar Fields" },
            submissions: [
              {
                id: 3,
                songId: 2,
                rank: null,
                score: null,
                submittedAt: null,
                round: {
                  id: 13,
                  name: "Moon Round",
                  occurredAt: new Date("2026-03-01T00:00:00Z"),
                  game: { id: 8, sourceGameId: "moon-game", displayName: "Moon Game" },
                },
              },
            ],
          },
        ];
      },
    },
  };
  const catalog = await getSongCatalog({
    q: "solar",
    familiarity: "returning",
    sort: "most-appearances",
    input: { prisma },
  });
  const suggestions = await getHeaderSearchSuggestions("solar", { limit: 10, input: { prisma } });

  assert.equal(catalog.q, "solar");
  assert.equal(catalog.rows.length, 1);
  assert.equal(catalog.rows[0].familiarity.kind, "returning");
  assert.equal(catalog.rows[0].songId, 1);
  assert.equal(catalog.rows[0].artistSearchHref, "/songs?q=The+Comets");
  assert.deepEqual(catalog.rows[0].mostRecentAppearance, {
    gameName: "Solar Game",
    roundName: "Finale",
    href: "/games/7/rounds/12",
  });
  assert.deepEqual(catalog.rows[0].bestFinish, { rank: 1, score: 12 });
  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.type),
    ["song", "artist"],
  );
  assert.deepEqual(suggestions[0], {
    type: "song",
    songId: 1,
    title: "Solar Static",
    artistName: "The Comets",
    href: "/songs/1",
  });
  assert.deepEqual(suggestions[1], {
    type: "artist",
    artistName: "Solar Fields",
    href: "/songs?q=Solar+Fields",
  });
  assert.ok(suggestions.length <= 8);
  assert.equal(suggestions.some((suggestion) => suggestion.type === "player"), false);

  const apiResult = await getArchiveSearchSuggestionsResult({
    q: "solar",
    input: { prisma },
  });

  assert.equal(apiResult.status, 200);
  assert.deepEqual(apiResult.body.error, null);
  assert.deepEqual(apiResult.body.data.suggestions, suggestions);
  assert.deepEqual(await getArchiveSearchSuggestionsResult({ q: "   " }), {
    status: 200,
    body: { data: { suggestions: [] }, error: null },
  });
  assert.deepEqual(
    await getArchiveSearchSuggestionsResult({
      q: "x".repeat(HEADER_SEARCH_QUERY_MAX_LENGTH + 1),
    }),
    {
      status: 400,
      body: {
        data: null,
        error: "validation: q exceeds 200 characters",
      },
    },
  );
  assert.deepEqual(getArchiveSearchSuggestionsMethodNotAllowedResult(), {
    status: 405,
    headers: { Allow: "GET" },
    body: {
      data: null,
      error: "method not allowed",
    },
  });
});

test("caps empty-query song catalog results at 100 rows", async () => {
  const songs = Array.from({ length: 101 }, (_, index) => ({
    id: index + 1,
    title: `Catalog Song ${String(index + 1).padStart(3, "0")}`,
    artist: { name: "Catalog Artist" },
    submissions: [],
  }));
  const prisma = {
    song: {
      async findMany() {
        return songs;
      },
    },
  };
  const catalog = await getSongCatalog({ input: { prisma } });

  assert.equal(catalog.q, "");
  assert.equal(catalog.totalSongCount, 101);
  assert.equal(catalog.totalMatchCount, 101);
  assert.equal(catalog.rows.length, 100);
  assert.equal(catalog.capped, true);
  assert.equal(catalog.rows[0].href, "/songs/1");
});

test("constructs shared route data result shapes", () => {
  const notice = buildStatusNotice({
    title: "Missing",
    body: "Nothing found.",
    href: "/",
    hrefLabel: "Back",
  });

  assert.deepEqual(readyRouteData({ id: 1 }), { kind: "ready", props: { id: 1 } });
  assert.deepEqual(notFoundRouteData(notice), { kind: "not-found", statusNotice: notice });
  assert.deepEqual(sparseRouteData({ id: 1 }, notice), {
    kind: "sparse",
    props: { id: 1 },
    statusNotice: notice,
  });
});
