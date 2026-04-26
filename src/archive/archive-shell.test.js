const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const {
  ArchiveShell,
  resolveBackToGameContext,
} = require("./archive-shell");

function buildShell(overrides = {}) {
  return {
    activeRoute: "songs",
    gameContext: null,
    search: {
      value: "",
      submitHrefBase: "/songs",
      suggestions: [],
    },
    switcher: {
      currentGames: [
        {
          gameId: 1,
          displayName: "Current League",
          status: "Current",
          timeframeLabel: "Jan 1, 2026 - Jan 8, 2026",
          href: "/games/1",
        },
      ],
      completedGames: [
        {
          gameId: 2,
          displayName: "Completed League",
          status: "Completed",
          timeframeLabel: "Dec 1, 2025 - Dec 8, 2025",
          href: "/games/2",
        },
      ],
      selectedGameId: null,
      backToGame: null,
    },
    ...overrides,
  };
}

test("resolveBackToGameContext accepts only same-origin game and round archive paths", () => {
  assert.deepEqual(
    resolveBackToGameContext({
      currentPath: "https://archive.example/songs",
      documentReferrer: "https://archive.example/games/12/rounds/34",
    }),
    { label: "Game 12", href: "/games/12" },
  );
  assert.deepEqual(
    resolveBackToGameContext({
      currentPath: "/songs",
      inTabNavigationState: {
        gameId: 7,
        label: "Seed League",
        href: "/games/7",
      },
    }),
    { label: "Seed League", href: "/games/7" },
  );
  assert.equal(
    resolveBackToGameContext({
      currentPath: "https://archive.example/songs",
      documentReferrer: "https://external.example/games/12",
    }),
    null,
  );
  assert.equal(
    resolveBackToGameContext({
      currentPath: "https://archive.example/songs",
      documentReferrer: "https://archive.example/players/9",
    }),
    null,
  );
});

test("ArchiveShell renders persistent landmarks, search, switcher control, and explicit game chip", () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      ArchiveShell,
      buildShell({
        activeRoute: "round",
        gameContext: {
          gameId: 1,
          displayName: "Current League",
          href: "/games/1",
        },
      }),
      React.createElement("h1", null, "Round page"),
    ),
  );

  assert.match(markup, /href="#archive-main"/);
  assert.match(markup, /role="search"/);
  assert.match(markup, /Search songs and artists/);
  assert.match(markup, /aria-controls="archive-shell-game-switcher-panel"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /data-archive-switcher-item="1"[^>]*tabindex="0"/);
  assert.match(markup, /data-archive-switcher-item="2"[^>]*tabindex="-1"/);
  assert.match(markup, /Back to Current League/);
  assert.match(markup, /Music League archive project/);
  assert.match(markup, /https:\/\/github.com\/ToErrIsHumean\/music-league/);
});
