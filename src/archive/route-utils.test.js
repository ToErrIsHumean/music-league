const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildGameHref,
  buildPlayerHref,
  buildRoundHref,
  buildRouteMetadata,
  buildSongHref,
  buildSongSearchHref,
  parsePositiveRouteId,
  stripRetiredOverlayParams,
} = require("./route-utils");

test("parsePositiveRouteId accepts only positive integer route params", () => {
  assert.equal(parsePositiveRouteId("42"), 42);
  assert.equal(parsePositiveRouteId(["7", "8"]), 7);
  assert.equal(parsePositiveRouteId(9), 9);
  assert.equal(parsePositiveRouteId("0"), null);
  assert.equal(parsePositiveRouteId("-1"), null);
  assert.equal(parsePositiveRouteId("1.5"), null);
  assert.equal(parsePositiveRouteId("abc"), null);
  assert.equal(parsePositiveRouteId(undefined), null);
});

test("stripRetiredOverlayParams preserves non-overlay query state", () => {
  const params = stripRetiredOverlayParams({
    year: "2026",
    winner: "Ada",
    round: "10",
    song: "20",
    player: "30",
    playerSubmission: "40",
    sort: "alphabetical",
  });

  assert.equal(params.get("year"), "2026");
  assert.equal(params.get("winner"), "Ada");
  assert.equal(params.get("sort"), "alphabetical");
  assert.equal(params.has("round"), false);
  assert.equal(params.has("song"), false);
  assert.equal(params.has("player"), false);
  assert.equal(params.has("playerSubmission"), false);
});

test("route href builders emit stable M8 route URLs", () => {
  assert.equal(buildGameHref(7), "/games/7");
  assert.equal(buildGameHref("bad"), "/");
  assert.equal(buildRoundHref(7, 5), "/games/7/rounds/5");
  assert.equal(buildRoundHref(7, "bad"), "/games/7");
  assert.equal(buildRoundHref(null, 5), "/");
  assert.equal(buildSongHref(2), "/songs/2");
  assert.equal(buildSongHref(null), "/songs");
  assert.equal(buildPlayerHref(3), "/players/3");
  assert.equal(buildPlayerHref(null), "/");
});

test("song search href builder keeps canonical browser state only", () => {
  assert.equal(buildSongSearchHref({}), "/songs");
  assert.equal(
    buildSongSearchHref({
      q: " Solar Static ",
      familiarity: "returning",
      sort: "alphabetical",
    }),
    "/songs?q=Solar+Static&familiarity=returning&sort=alphabetical",
  );
  assert.equal(
    buildSongSearchHref({
      q: "",
      familiarity: "all",
      sort: "unsupported",
    }),
    "/songs",
  );
});

test("route metadata falls back to archive-specific copy", () => {
  assert.deepEqual(buildRouteMetadata({ title: "Songs", description: "Browse songs." }), {
    title: "Songs",
    description: "Browse songs.",
  });
  assert.deepEqual(buildRouteMetadata({}), {
    title: "Music League Archive",
    description: "Browse imported Music League games, rounds, songs, and players.",
  });
});
