"use client";

const React = require("react");
const {
  buildGameHref,
  buildRoundHref,
  buildSongSearchHref,
  parsePositiveRouteId,
} = require("./route-utils");

function acceptedArchiveGamePath(pathname) {
  if (typeof pathname !== "string") {
    return null;
  }

  const gameMatch = pathname.match(/^\/games\/(\d+)\/?$/);

  if (gameMatch) {
    const gameId = parsePositiveRouteId(gameMatch[1]);

    return gameId === null ? null : { gameId, href: buildGameHref(gameId) };
  }

  const roundMatch = pathname.match(/^\/games\/(\d+)\/rounds\/(\d+)\/?$/);

  if (roundMatch) {
    const gameId = parsePositiveRouteId(roundMatch[1]);
    const roundId = parsePositiveRouteId(roundMatch[2]);

    return gameId === null || roundId === null
      ? null
      : { gameId, href: buildGameHref(gameId), roundHref: buildRoundHref(gameId, roundId) };
  }

  return null;
}

function buildComparableUrl(value, baseOrigin) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return new URL(value, baseOrigin);
  } catch {
    return null;
  }
}

function resolveBackToGameContext({
  currentPath,
  documentReferrer,
  inTabNavigationState,
} = {}) {
  if (inTabNavigationState && typeof inTabNavigationState === "object") {
    const label =
      typeof inTabNavigationState.label === "string"
        ? inTabNavigationState.label.trim()
        : "";
    const acceptedStatePath = acceptedArchiveGamePath(inTabNavigationState.href);
    const stateGameId = parsePositiveRouteId(inTabNavigationState.gameId);

    if (label.length > 0 && acceptedStatePath && acceptedStatePath.gameId === stateGameId) {
      return {
        label,
        href: acceptedStatePath.href,
      };
    }
  }

  const currentUrl = buildComparableUrl(currentPath || "/", "http://archive.local");
  const referrerUrl = buildComparableUrl(
    documentReferrer,
    currentUrl?.origin ?? "http://archive.local",
  );

  if (!currentUrl || !referrerUrl || currentUrl.origin !== referrerUrl.origin) {
    return null;
  }

  const acceptedReferrerPath = acceptedArchiveGamePath(referrerUrl.pathname);

  if (!acceptedReferrerPath) {
    return null;
  }

  return {
    label: `Game ${acceptedReferrerPath.gameId}`,
    href: acceptedReferrerPath.href,
  };
}

function findSwitcherGameByHref(switcher, href) {
  const gameId = parsePositiveRouteId(href?.match(/^\/games\/(\d+)/)?.[1]);

  if (gameId === null) {
    return null;
  }

  return [...(switcher?.currentGames ?? []), ...(switcher?.completedGames ?? [])].find(
    (game) => game.gameId === gameId,
  ) ?? null;
}

function resolveDisplayBackContext(shell, resolvedContext) {
  if (!resolvedContext) {
    return null;
  }

  const switcherGame = findSwitcherGameByHref(shell.switcher, resolvedContext.href);

  if (!switcherGame) {
    return null;
  }

  return {
    label: switcherGame.displayName,
    href: switcherGame.href,
  };
}

function HeaderSearch({ activeRoute, search }) {
  const [expanded, setExpanded] = React.useState(false);
  const searchValue = typeof search?.value === "string" ? search.value : "";
  const suggestedCount = search?.suggestions?.length ?? 0;
  const searchFormId = "archive-shell-search-form";
  const liveRegionId = "archive-shell-search-status";

  return React.createElement(
    "div",
    { className: "archive-shell-search" },
    React.createElement(
      "button",
      {
        type: "button",
        className: "archive-shell-search-toggle",
        "aria-controls": searchFormId,
        "aria-expanded": expanded,
        onClick: () => setExpanded((value) => !value),
      },
      "Search",
    ),
    React.createElement(
      "form",
      {
        id: searchFormId,
        action: search?.submitHrefBase ?? "/songs",
        method: "get",
        role: "search",
        "aria-label": "Archive songs and artists",
        className: expanded
          ? "archive-shell-search-form is-expanded"
          : "archive-shell-search-form",
      },
      React.createElement(
        "label",
        { htmlFor: "archive-shell-search-input" },
        "Search songs and artists",
      ),
      React.createElement("input", {
        id: "archive-shell-search-input",
        name: "q",
        type: "search",
        defaultValue: searchValue,
        autoComplete: "off",
      }),
      React.createElement("button", { type: "submit" }, "Search"),
      React.createElement(
        "p",
        { id: liveRegionId, className: "archive-sr-only", "aria-live": "polite" },
        suggestedCount === 0
          ? "Search suggestions are available after typing."
          : `${suggestedCount} search suggestions available.`,
      ),
      suggestedCount > 0
        ? React.createElement(
            "ul",
            { className: "archive-shell-search-suggestions", "aria-labelledby": liveRegionId },
            search.suggestions.map((suggestion) =>
              React.createElement(
                "li",
                {
                  key:
                    suggestion.type === "song"
                      ? `song-${suggestion.songId}`
                      : `artist-${suggestion.artistName}`,
                },
                React.createElement(
                  "a",
                  { href: suggestion.href },
                  suggestion.type === "song"
                    ? `${suggestion.title} by ${suggestion.artistName}`
                    : suggestion.artistName,
                ),
              ),
            ),
          )
        : null,
    ),
    activeRoute === "songs" || activeRoute === "song"
      ? React.createElement("a", { className: "archive-shell-search-view-all", href: buildSongSearchHref({}) }, "All songs")
      : null,
  );
}

function isGameSwitcherItemTarget(target) {
  return (
    target &&
    typeof target.closest === "function" &&
    target.closest("[data-archive-switcher-item]")
  );
}

function GameSwitcherGroup({
  title,
  games,
  selectedGameId,
  activeGameId,
  itemRefs,
}) {
  if (!games || games.length === 0) {
    return null;
  }

  return React.createElement(
    "section",
    { className: "archive-shell-switcher-group" },
    React.createElement("h3", null, title),
    React.createElement(
      "ul",
      null,
      games.map((game) =>
        React.createElement(
          "li",
          { key: game.gameId },
          React.createElement(
            "a",
            {
              href: game.href,
              "aria-current": game.gameId === selectedGameId ? "page" : undefined,
              "data-archive-switcher-item": String(game.gameId),
              className:
                game.gameId === selectedGameId
                  ? "archive-shell-game-link is-selected"
                  : "archive-shell-game-link",
              ref: (element) => {
                itemRefs.current.set(game.gameId, element);
              },
              tabIndex: game.gameId === activeGameId ? 0 : -1,
            },
            React.createElement("span", null, game.displayName),
            game.timeframeLabel
              ? React.createElement("small", null, game.timeframeLabel)
              : null,
          ),
        ),
      ),
    ),
  );
}

function GameSwitcher({ switcher }) {
  const [expanded, setExpanded] = React.useState(false);
  const triggerRef = React.useRef(null);
  const itemRefs = React.useRef(new Map());
  const panelId = "archive-shell-game-switcher-panel";
  const currentGames = switcher?.currentGames ?? [];
  const completedGames = switcher?.completedGames ?? [];
  const orderedGames = React.useMemo(
    () => [...currentGames, ...completedGames],
    [currentGames, completedGames],
  );
  const selectedIndex = orderedGames.findIndex(
    (game) => game.gameId === switcher?.selectedGameId,
  );
  const initialActiveIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const [activeIndex, setActiveIndex] = React.useState(initialActiveIndex);
  const activeGameId = orderedGames[activeIndex]?.gameId ?? null;

  React.useEffect(() => {
    setActiveIndex(initialActiveIndex);
  }, [initialActiveIndex]);

  function focusGameAt(index) {
    const game = orderedGames[index];

    if (!game) {
      return;
    }

    setActiveIndex(index);
    itemRefs.current.get(game.gameId)?.focus();
  }

  function openAndFocus(index = initialActiveIndex) {
    setExpanded(true);
    window.requestAnimationFrame(() => focusGameAt(index));
  }

  return React.createElement(
    "div",
    {
      className: "archive-shell-switcher",
      onKeyDown: (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setExpanded(false);
          triggerRef.current?.focus();
          return;
        }

        if (
          !expanded &&
          orderedGames.length > 0 &&
          (event.key === "ArrowDown" || event.key === "ArrowUp")
        ) {
          event.preventDefault();
          openAndFocus(event.key === "ArrowUp" ? orderedGames.length - 1 : initialActiveIndex);
          return;
        }

        if (!expanded || orderedGames.length === 0) {
          return;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          focusGameAt((activeIndex + 1) % orderedGames.length);
          return;
        }

        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          focusGameAt((activeIndex - 1 + orderedGames.length) % orderedGames.length);
          return;
        }

        if (event.key === "Home") {
          event.preventDefault();
          focusGameAt(0);
          return;
        }

        if (event.key === "End") {
          event.preventDefault();
          focusGameAt(orderedGames.length - 1);
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          const selectedItem = isGameSwitcherItemTarget(event.target);

          if (selectedItem) {
            event.preventDefault();
            selectedItem.click();
          }
        }
      },
    },
    React.createElement(
      "button",
      {
        type: "button",
        "aria-expanded": expanded,
        "aria-controls": panelId,
        ref: triggerRef,
        onClick: () => setExpanded((value) => !value),
      },
      "Games",
    ),
    React.createElement(
      "div",
      { id: panelId, className: "archive-shell-switcher-panel", hidden: !expanded },
      React.createElement(GameSwitcherGroup, {
        title: "Current games",
        games: currentGames,
        selectedGameId: switcher?.selectedGameId ?? null,
        activeGameId,
        itemRefs,
      }),
      React.createElement(GameSwitcherGroup, {
        title: "Completed games",
        games: completedGames,
        selectedGameId: switcher?.selectedGameId ?? null,
        activeGameId,
        itemRefs,
      }),
      currentGames.length === 0 && completedGames.length === 0
        ? React.createElement("p", null, "No games imported yet.")
        : null,
    ),
  );
}

function ArchiveShell({ activeRoute, gameContext, search, switcher, children }) {
  const shell = {
    activeRoute,
    gameContext,
    search,
    switcher,
  };
  const [clientBackContext, setClientBackContext] = React.useState(null);
  const explicitBackContext = gameContext
    ? { label: gameContext.displayName, href: gameContext.href }
    : null;
  const backContext = explicitBackContext ?? clientBackContext;

  React.useEffect(() => {
    if (explicitBackContext || typeof window === "undefined") {
      return;
    }

    const resolvedContext = resolveBackToGameContext({
      currentPath: window.location.href,
      documentReferrer: document.referrer,
    });

    setClientBackContext(resolveDisplayBackContext(shell, resolvedContext));
  }, [explicitBackContext, shell.switcher]);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("a", { href: "#archive-main", className: "archive-skip-link" }, "Skip to content"),
    React.createElement(
      "header",
      { className: "archive-shell-header", "aria-label": "Archive header" },
      React.createElement(
        "div",
        { className: "archive-shell-header-inner" },
        React.createElement(
          "a",
          {
            href: "/",
            className: "archive-shell-brand",
            "aria-current": activeRoute === "landing" ? "page" : undefined,
          },
          "Music League Archive",
        ),
        React.createElement(HeaderSearch, { activeRoute, search }),
        React.createElement(
          "nav",
          { "aria-label": "Archive navigation", className: "archive-shell-nav" },
          React.createElement(
            "a",
            {
              href: "/songs",
              "aria-current": activeRoute === "songs" || activeRoute === "song" ? "page" : undefined,
            },
            "Songs",
          ),
        ),
        React.createElement(GameSwitcher, { switcher }),
        backContext
          ? React.createElement(
              "a",
              { href: backContext.href, className: "archive-shell-back-chip" },
              `Back to ${backContext.label}`,
            )
          : null,
      ),
    ),
    React.createElement(
      "main",
      { id: "archive-main", className: "archive-route-page", tabIndex: -1 },
      children,
    ),
    React.createElement(
      "footer",
      { className: "archive-shell-footer", "aria-label": "Archive footer" },
      React.createElement(
        "p",
        null,
        "Music League archive project. ",
        React.createElement(
          "a",
          { href: "https://github.com/ToErrIsHumean/music-league" },
          "View the repository",
        ),
        ".",
      ),
    ),
  );
}

module.exports = {
  ArchiveShell,
  resolveBackToGameContext,
};
