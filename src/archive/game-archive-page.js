const React = require("react");
const { buildArchiveHref, listArchiveGames } = require("./archive-utils");

const archiveDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function normalizeQueryInteger(value) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate !== "string" || !/^\d+$/.test(candidate)) {
    return null;
  }

  const parsedValue = Number.parseInt(candidate, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function resolveRoundSelection(games, searchParams) {
  const requestedRoundId = normalizeQueryInteger(searchParams?.round);

  if (requestedRoundId === null) {
    return {
      openRoundId: null,
      notFoundNotice: null,
    };
  }

  const roundExists = games.some((game) =>
    game.rounds.some((round) => round.id === requestedRoundId),
  );

  return {
    openRoundId: roundExists ? requestedRoundId : null,
    notFoundNotice: roundExists ? null : "Round not found.",
  };
}

function withRoundHrefs(games) {
  return games.map((game) => ({
    ...game,
    rounds: game.rounds.map((round) => ({
      ...round,
      href: buildArchiveHref({ roundId: round.id }),
    })),
  }));
}

async function buildGameArchivePageProps(input = {}) {
  const searchParams = (await input.searchParams) ?? {};
  const games = withRoundHrefs(
    await listArchiveGames(input.prisma ? { prisma: input.prisma } : {}),
  );
  const roundSelection = resolveRoundSelection(games, searchParams);

  return {
    games,
    openRoundId: roundSelection.openRoundId,
    notFoundNotice: roundSelection.notFoundNotice,
  };
}

function formatRoundDate(occurredAt) {
  if (!occurredAt) {
    return "Date TBD";
  }

  return archiveDateFormatter.format(new Date(occurredAt));
}

function formatRoundOutcome(round) {
  if (round.winnerLabel) {
    return `Winner: ${round.winnerLabel}`;
  }

  if (round.statusLabel === "pending") {
    return "Awaiting votes";
  }

  return "Winner pending";
}

function formatSubmissionCount(submissionCount) {
  return `${submissionCount} submission${submissionCount === 1 ? "" : "s"}`;
}

function buildRoundSignals(round) {
  return [
    formatRoundDate(round.occurredAt),
    formatRoundOutcome(round),
    formatSubmissionCount(round.submissionCount),
  ];
}

function renderRoundCard(round, openRoundId) {
  const isOpen = round.id === openRoundId;

  return React.createElement(
    "li",
    { className: "archive-round-item", key: round.id },
    React.createElement(
      "a",
      {
        href: round.href,
        className: isOpen ? "archive-round-card is-open" : "archive-round-card",
        "aria-current": isOpen ? "page" : undefined,
      },
      React.createElement(
        "div",
        { className: "archive-round-copy" },
        React.createElement(
          "p",
          { className: "archive-round-kicker" },
          round.sequenceNumber === null ? "Round" : `Round ${round.sequenceNumber}`,
        ),
        React.createElement("h3", { className: "archive-round-title" }, round.name),
      ),
      React.createElement(
        "ul",
        { className: "archive-round-signals", "aria-label": `${round.name} summary` },
        buildRoundSignals(round).map((signal) =>
          React.createElement("li", { className: "archive-signal", key: signal }, signal),
        ),
      ),
    ),
  );
}

function renderGameSection(game, openRoundId) {
  return React.createElement(
    "section",
    {
      className: "archive-game-section",
      key: game.id,
      "aria-labelledby": `game-${game.id}-title`,
    },
    React.createElement(
      "div",
      { className: "archive-game-header" },
      React.createElement("p", { className: "archive-game-kicker" }, "Game archive"),
      React.createElement("h2", { className: "archive-game-title", id: `game-${game.id}-title` }, game.displayLabel),
      React.createElement(
        "p",
        { className: "archive-game-meta" },
        `${game.roundCount} round${game.roundCount === 1 ? "" : "s"}`,
      ),
    ),
    React.createElement(
      "ul",
      { className: "archive-round-list" },
      game.rounds.map((round) => renderRoundCard(round, openRoundId)),
    ),
  );
}

function renderEmptyState() {
  return React.createElement(
    "section",
    { className: "archive-empty-state" },
    React.createElement("p", { className: "archive-empty-kicker" }, "Nothing here yet"),
    React.createElement("h2", { className: "archive-empty-title" }, "Import a game to start the archive."),
    React.createElement(
      "p",
      { className: "archive-empty-body" },
      "The route is live, but there are no seeded or imported games to display yet.",
    ),
  );
}

function GameArchivePage({ games, openRoundId, notFoundNotice }) {
  return React.createElement(
    "main",
    { className: "archive-page-shell" },
    React.createElement(
      "header",
      { className: "archive-hero" },
      React.createElement("p", { className: "archive-hero-kicker" }, "Music League"),
      React.createElement("h1", { className: "archive-hero-title" }, "Archive by game"),
      React.createElement(
        "p",
        { className: "archive-hero-body" },
        "Browse every game as its own chapter, then dip into a round without losing the bigger picture.",
      ),
    ),
    notFoundNotice
      ? React.createElement(
          "aside",
          { className: "archive-notice", role: "status" },
          notFoundNotice,
        )
      : null,
    games.length === 0
      ? renderEmptyState()
      : React.createElement(
          "div",
          { className: "archive-game-grid" },
          games.map((game) => renderGameSection(game, openRoundId)),
        ),
  );
}

module.exports = {
  GameArchivePage,
  buildGameArchivePageProps,
};
