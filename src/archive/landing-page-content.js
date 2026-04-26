"use client";

const React = require("react");
const {
  ARCHIVE_BADGE_VARIANTS,
  buildArchiveBadgeModel,
} = require("./archive-badges");

const COMPLETED_GAME_BATCH_SIZE = 50;

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function ArchiveBadge({ variant, label, ariaLabel }) {
  const badge = buildArchiveBadgeModel({ variant, label, ariaLabel });

  return React.createElement(
    "span",
    {
      className: "archive-badge",
      "data-archive-badge-variant": badge.variant,
      "data-archive-badge-role": ARCHIVE_BADGE_VARIANTS[badge.variant].tokenRole,
      "aria-label": badge.ariaLabel ?? undefined,
    },
    badge.label,
  );
}

function LandingStatus({ children }) {
  return React.createElement(
    "p",
    { className: "archive-route-status", role: "status", "aria-live": "polite" },
    children,
  );
}

function GameCard({ game }) {
  const statusVariant = game.status === "Current" ? "status-current" : "status-completed";
  const facts = [
    formatCount(game.roundCount, "round"),
    formatCount(game.scoredRoundCount, "scored round"),
    game.timeframeLabel,
    game.winnerLabel ? `Winner: ${game.winnerLabel}` : null,
  ].filter(Boolean);

  return React.createElement(
    "li",
    { className: "archive-landing-card" },
    React.createElement(
      "div",
      { className: "archive-landing-card-heading" },
      React.createElement("a", { href: game.href }, game.displayName),
      React.createElement(ArchiveBadge, {
        variant: statusVariant,
        label: game.status,
      }),
    ),
    facts.length > 0
      ? React.createElement(
          "p",
          { className: "archive-landing-card-meta" },
          facts.map((fact, index) =>
            React.createElement(
              "span",
              { key: `${game.gameId}-${index}` },
              fact,
            ),
          ),
        )
      : null,
  );
}

function GameBand({ title, games, emptyCopy }) {
  return React.createElement(
    "section",
    { className: "archive-route-section archive-landing-band" },
    React.createElement("h2", null, title),
    games.length === 0
      ? React.createElement("p", { className: "archive-route-empty" }, emptyCopy)
      : React.createElement(
          "ul",
          { className: "archive-landing-grid" },
          games.map((game) => React.createElement(GameCard, { key: game.gameId, game })),
        ),
  );
}

function LandingFilters({ filters, hasActiveFilters }) {
  return React.createElement(
    "form",
    { action: "/", method: "get", className: "archive-route-controls archive-landing-filters" },
    React.createElement(
      "label",
      null,
      "Year",
      React.createElement("input", {
        name: "year",
        inputMode: "numeric",
        pattern: "\\d{4}",
        defaultValue: filters.year ?? "",
      }),
    ),
    React.createElement(
      "label",
      null,
      "Winner",
      React.createElement("input", {
        name: "winner",
        defaultValue: filters.winner ?? "",
      }),
    ),
    React.createElement("button", { type: "submit" }, "Apply filters"),
    hasActiveFilters ? React.createElement("a", { href: "/" }, "Clear filters") : null,
  );
}

function CompletedGamesBand({ data }) {
  const completedGames = data.completedGames ?? [];
  const initialVisibleCount = Math.min(
    data.completedVisibleCount ?? 100,
    completedGames.length,
  );
  const [visibleCount, setVisibleCount] = React.useState(initialVisibleCount);
  const visibleGames = completedGames.slice(0, visibleCount);
  const hasActiveFilters = Boolean(data.filters?.year || data.filters?.winner);
  const remainingCount = completedGames.length - visibleCount;

  React.useEffect(() => {
    setVisibleCount(initialVisibleCount);
  }, [initialVisibleCount]);

  return React.createElement(
    "section",
    { className: "archive-route-section archive-landing-band" },
    React.createElement(
      "div",
      { className: "archive-landing-section-heading" },
      React.createElement("h2", null, "Completed games"),
      React.createElement(
        "p",
        null,
        completedGames.length === 0
          ? "No completed games match these filters."
          : `Showing ${visibleGames.length} of ${data.completedTotal} completed games`,
      ),
    ),
    data.showCompletedFilters
      ? React.createElement(LandingFilters, {
          filters: data.filters ?? { year: null, winner: null },
          hasActiveFilters,
        })
      : null,
    visibleGames.length === 0
      ? React.createElement("p", { className: "archive-route-empty" }, "No completed games match these filters.")
      : React.createElement(
          "ul",
          { className: "archive-landing-grid", id: "archive-completed-games" },
          visibleGames.map((game) => React.createElement(GameCard, { key: game.gameId, game })),
        ),
    remainingCount > 0
      ? React.createElement(
          "button",
          {
            type: "button",
            className: "archive-landing-show-more",
            "aria-controls": "archive-completed-games",
            onClick: () => {
              setVisibleCount((count) =>
                Math.min(count + COMPLETED_GAME_BATCH_SIZE, completedGames.length),
              );
            },
          },
          `Show more (${Math.min(COMPLETED_GAME_BATCH_SIZE, remainingCount)})`,
        )
      : null,
  );
}

function LandingContent({ data }) {
  if (data.isEmpty) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", null, "Music League Archive"),
      React.createElement(
        LandingStatus,
        null,
        "No imported games yet. Search results will appear after songs are imported.",
      ),
    );
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("h1", null, "Music League Archive"),
    React.createElement(GameBand, {
      title: "Current games",
      games: data.currentGames ?? [],
      emptyCopy: "No current games in the archive.",
    }),
    React.createElement(CompletedGamesBand, { data }),
  );
}

module.exports = {
  COMPLETED_GAME_BATCH_SIZE,
  LandingContent,
};
