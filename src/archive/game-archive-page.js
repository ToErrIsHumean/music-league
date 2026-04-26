const React = require("react");
const {
  buildArchiveHref,
  getSelectedGameMemoryBoard,
  listSelectableGames,
  parsePositiveRouteId,
  stripRetiredOverlayParams,
} = require("./archive-utils");

const archiveDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function findSelectableGame(games, gameId) {
  if (gameId === null) {
    return null;
  }

  return games.find((game) => game.id === gameId) ?? null;
}

function compareIsoDescending(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left < right ? 1 : left > right ? -1 : 0;
}

function compareNullableNumberDescending(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right - left;
}

function determineDefaultSelectionBasis(games) {
  const selectedGame = games[0] ?? null;
  const nextGame = games[1] ?? null;

  if (!selectedGame) {
    return "stable-source-game-id";
  }

  if (!nextGame) {
    if (selectedGame.latestOccurredAt !== null) {
      return "round-occurred-at";
    }

    if (selectedGame.highestSequenceNumber !== null) {
      return "round-sequence";
    }

    return selectedGame.createdAt !== null ? "game-created-at" : "stable-source-game-id";
  }

  if (compareIsoDescending(selectedGame.latestOccurredAt, nextGame.latestOccurredAt) !== 0) {
    return selectedGame.latestOccurredAt !== null ? "round-occurred-at" : "stable-source-game-id";
  }

  if (
    compareNullableNumberDescending(
      selectedGame.highestSequenceNumber,
      nextGame.highestSequenceNumber,
    ) !== 0
  ) {
    return selectedGame.highestSequenceNumber !== null
      ? "round-sequence"
      : "stable-source-game-id";
  }

  if (compareIsoDescending(selectedGame.createdAt, nextGame.createdAt) !== 0) {
    return selectedGame.createdAt !== null ? "game-created-at" : "stable-source-game-id";
  }

  return "stable-source-game-id";
}

function formatFrameDate(value) {
  return archiveDateFormatter.format(new Date(value));
}

function buildTimeframeLabel(game) {
  if (game.earliestOccurredAt && game.latestOccurredAt) {
    const earliest = formatFrameDate(game.earliestOccurredAt);
    const latest = formatFrameDate(game.latestOccurredAt);

    return earliest === latest ? earliest : `${earliest} - ${latest}`;
  }

  if (game.latestOccurredAt) {
    return formatFrameDate(game.latestOccurredAt);
  }

  if (game.highestSequenceNumber !== null) {
    return `Through round ${game.highestSequenceNumber}`;
  }

  return `${game.roundCount} round${game.roundCount === 1 ? "" : "s"}`;
}

function buildSelectionCopy(selectionBasis) {
  return selectionBasis === "round-occurred-at" ||
    selectionBasis === "round-sequence" ||
    selectionBasis === "game-created-at"
    ? "Latest game"
    : "Selected game";
}

function buildSelectedGameFrame(game, selectionBasis) {
  if (!game) {
    return null;
  }

  return {
    id: game.id,
    sourceGameId: game.sourceGameId,
    displayLabel: game.displayLabel,
    timeframeLabel: buildTimeframeLabel(game),
    roundCount: game.roundCount,
    scoredRoundCount: game.scoredRoundCount,
    selectionBasis,
    selectionCopy: buildSelectionCopy(selectionBasis),
  };
}

function buildGameSwitcherOptions(games, selectedGameId) {
  if (games.length < 2) {
    return [];
  }

  return games.map((game) => ({
    id: game.id,
    displayLabel: game.displayLabel,
    timeframeLabel: buildTimeframeLabel(game),
    isSelected: game.id === selectedGameId,
    href: buildArchiveHref({ gameId: game.id }),
  }));
}

function resolveSelectedGame({ selectableGames, requestedGameId, requestedRound }) {
  const explicitGame = findSelectableGame(selectableGames, requestedGameId);

  if (explicitGame) {
    return {
      selectedGame: explicitGame,
      selectionBasis: "explicit-query",
      invalidGameNotice: null,
    };
  }

  if (requestedRound) {
    const roundGame = findSelectableGame(selectableGames, requestedRound.game.id);

    if (roundGame) {
      return {
        selectedGame: roundGame,
        selectionBasis: "explicit-query",
        invalidGameNotice: requestedGameId === null ? null : "Game not found.",
      };
    }
  }

  return {
    selectedGame: selectableGames[0] ?? null,
    selectionBasis: determineDefaultSelectionBasis(selectableGames),
    invalidGameNotice: requestedGameId === null ? null : "Game not found.",
  };
}

async function buildGameMemoryBoardPageProps(input = {}) {
  const searchParams = stripRetiredOverlayParams((await input.searchParams) ?? {});
  const archiveInput = input.prisma ? { prisma: input.prisma } : {};
  const requestedGameId = parsePositiveRouteId(searchParams.get("game"));
  const selectableGames = await listSelectableGames(archiveInput);

  if (selectableGames.length === 0) {
    return {
      selectedGame: null,
      games: [],
      board: null,
      notices: [],
      openRoundId: null,
      openRound: null,
      nestedEntity: null,
      openSongModal: null,
      openPlayerModal: null,
    };
  }

  const selected = resolveSelectedGame({
    selectableGames,
    requestedGameId,
    requestedRound: null,
  });
  const selectedGameFrame = buildSelectedGameFrame(
    selected.selectedGame,
    selected.selectionBasis,
  );
  const selectedGameMemoryBoard =
    selected.selectedGame === null
      ? null
      : await getSelectedGameMemoryBoard(selected.selectedGame.id, archiveInput);
  const notices = [selected.invalidGameNotice].filter(Boolean);

  return {
    selectedGame: selectedGameFrame,
    games: buildGameSwitcherOptions(selectableGames, selected.selectedGame?.id ?? null),
    board: selectedGameMemoryBoard?.board ?? null,
    openRoundId: null,
    openRound: null,
    notices,
    nestedEntity: null,
    openSongModal: null,
    openPlayerModal: null,
  };
}

const buildGameArchivePageProps = buildGameMemoryBoardPageProps;

function renderGameSwitcher(games) {
  if (games.length === 0) {
    return null;
  }

  return React.createElement(
    "nav",
    { className: "archive-game-switcher", "aria-label": "Select game" },
    games.map((game) =>
      React.createElement(
        "a",
        {
          href: game.href,
          className: game.isSelected
            ? "archive-game-switcher-link is-selected"
            : "archive-game-switcher-link",
          "aria-current": game.isSelected ? "page" : undefined,
          key: game.id,
        },
        React.createElement("span", { className: "archive-game-switcher-name" }, game.displayLabel),
        game.timeframeLabel
          ? React.createElement(
              "span",
              { className: "archive-game-switcher-timeframe" },
              game.timeframeLabel,
            )
          : null,
      ),
    ),
  );
}

function renderCompetitiveAnchor(anchor) {
  if (!anchor) {
    return React.createElement(
      "article",
      { className: "archive-competitive-anchor archive-competitive-anchor-sparse" },
      React.createElement("p", { className: "archive-moment-label" }, "Competitive anchor"),
      React.createElement("h3", { className: "archive-moment-title" }, "Scores still pending"),
      React.createElement(
        "p",
        { className: "archive-moment-body" },
        "No scored submissions are available yet, so the board omits game-level result claims.",
      ),
    );
  }

  return React.createElement(
    "article",
    { className: "archive-competitive-anchor" },
    React.createElement("p", { className: "archive-moment-label" }, "Competitive anchor"),
    React.createElement("h3", { className: "archive-moment-title" }, anchor.title),
    React.createElement("p", { className: "archive-moment-body" }, anchor.body),
    React.createElement(
      "ol",
      { className: "archive-anchor-standings", "aria-label": "Top selected-game standings" },
      anchor.standings.map((standing) =>
        React.createElement(
          "li",
          { className: "archive-anchor-standing", key: standing.playerName },
          React.createElement("span", null, standing.playerName),
          React.createElement("strong", null, `${standing.totalScore} pts`),
        ),
      ),
    ),
  );
}

function renderMemoryMoment(moment) {
  const content = React.createElement(
    React.Fragment,
    null,
    React.createElement("p", { className: "archive-moment-label" }, moment.label),
    React.createElement("h3", { className: "archive-moment-title" }, moment.title),
    React.createElement("p", { className: "archive-moment-body" }, moment.body),
  );

  if (moment.href) {
    return React.createElement(
      "li",
      { className: `archive-memory-moment archive-memory-moment-${moment.kind}`, key: moment.title },
      React.createElement("a", { href: moment.href, className: "archive-memory-moment-link" }, content),
    );
  }

  return React.createElement(
    "li",
    { className: `archive-memory-moment archive-memory-moment-${moment.kind}`, key: moment.title },
    content,
  );
}

function renderSparseState(sparseState) {
  if (!sparseState) {
    return null;
  }

  return React.createElement(
    "article",
    { className: "archive-memory-moment archive-memory-sparse-state" },
    React.createElement("p", { className: "archive-moment-label" }, "Sparse board"),
    React.createElement("h3", { className: "archive-moment-title" }, sparseState.title),
    React.createElement("p", { className: "archive-moment-body" }, sparseState.copy),
  );
}

function renderSelectedGameBoard(selectedGame, board) {
  const rounds = board?.rounds ?? [];
  const moments = board?.moments ?? [];

  return React.createElement(
    "section",
    {
      className: "archive-game-section archive-selected-game-board",
      "aria-labelledby": `game-${selectedGame.id}-title`,
    },
    React.createElement(
      "div",
      { className: "archive-game-header" },
      React.createElement("p", { className: "archive-game-kicker" }, "Selected memory board"),
      React.createElement(
        "h2",
        { className: "archive-game-title", id: `game-${selectedGame.id}-title` },
        selectedGame.displayLabel,
      ),
      React.createElement(
        "p",
        { className: "archive-game-meta" },
        [
          `${selectedGame.roundCount} round${selectedGame.roundCount === 1 ? "" : "s"}`,
          `${selectedGame.scoredRoundCount} scored`,
        ].join(" | "),
      ),
    ),
    rounds.length === 0
      ? React.createElement(
          "p",
          { className: "archive-game-meta" },
          "This selected game has no round evidence available.",
        )
      : React.createElement(
          React.Fragment,
          null,
          renderCompetitiveAnchor(board.competitiveAnchor),
          renderSparseState(board.sparseState),
          moments.length === 0
            ? null
            : React.createElement(
                "ul",
                { className: "archive-memory-grid", "aria-label": "Selected game memory moments" },
                moments.map(renderMemoryMoment),
              ),
        ),
  );
}

function renderEmptyState() {
  return React.createElement(
    "section",
    { className: "archive-empty-state" },
    React.createElement("p", { className: "archive-empty-kicker" }, "Archive unavailable"),
    React.createElement("h2", { className: "archive-empty-title" }, "No selectable game is available."),
    React.createElement(
      "p",
      { className: "archive-empty-body" },
      "Import a game with at least one round to open the selected-game memory board.",
    ),
  );
}

function GameMemoryBoardPage({ selectedGame, games, board, notices }) {
  return React.createElement(
    "main",
    { className: "archive-page-shell" },
    React.createElement(
      "header",
      { className: "archive-hero" },
      React.createElement("p", { className: "archive-hero-kicker" }, "Music League"),
      React.createElement(
        "h1",
        { className: "archive-hero-title" },
        selectedGame ? selectedGame.displayLabel : "Archive unavailable",
      ),
      React.createElement(
        "p",
        { className: "archive-hero-body" },
        selectedGame
          ? `${selectedGame.selectionCopy}${
              selectedGame.timeframeLabel ? ` | ${selectedGame.timeframeLabel}` : ""
            }`
          : "No selectable game has enough round evidence for the memory board.",
      ),
      renderGameSwitcher(games),
    ),
    notices?.length > 0
      ? notices.map((notice) =>
          React.createElement(
            "aside",
            { className: "archive-notice", role: "status", key: notice },
            notice,
          ),
        )
      : null,
    selectedGame ? renderSelectedGameBoard(selectedGame, board) : renderEmptyState(),
  );
}

const GameArchivePage = GameMemoryBoardPage;

module.exports = {
  GameMemoryBoardPage,
  buildGameMemoryBoardPageProps,
  GameArchivePage,
  buildGameArchivePageProps,
};
