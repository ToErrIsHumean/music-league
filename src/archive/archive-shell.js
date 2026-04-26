"use client";

const React = require("react");
const { ARCHIVE_BADGE_VARIANTS, buildArchiveBadgeModel } = require("./archive-badges");
const {
  buildGameHref,
  buildRoundHref,
  buildSongSearchHref,
  parsePositiveRouteId,
} = require("./route-utils");
const { normalizeArchiveSearch } = require("./search-normalization");

const HEADER_SEARCH_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_FORM_ID = "archive-shell-search-form";
const SEARCH_INPUT_ID = "archive-shell-search-input";
const SEARCH_LIVE_REGION_ID = "archive-shell-search-status";
const SEARCH_SUGGESTIONS_ID = "archive-shell-search-suggestions";

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

function isEditableShortcutTarget(target) {
  if (!target || typeof target !== "object") {
    return false;
  }

  const tagName = typeof target.tagName === "string" ? target.tagName.toLowerCase() : "";

  return (
    target.isContentEditable === true ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function isSearchShortcutEvent(event) {
  return (
    event?.key === "/" &&
    event.ctrlKey !== true &&
    event.metaKey !== true &&
    event.altKey !== true &&
    !isEditableShortcutTarget(event.target)
  );
}

function normalizeHeaderSuggestions(suggestions) {
  if (!Array.isArray(suggestions)) {
    return [];
  }

  return suggestions
    .filter((suggestion) => {
      if (!suggestion || typeof suggestion !== "object") {
        return false;
      }

      if (suggestion.type === "song") {
        return (
          Number.isInteger(suggestion.songId) &&
          typeof suggestion.title === "string" &&
          typeof suggestion.artistName === "string" &&
          typeof suggestion.href === "string"
        );
      }

      return (
        suggestion.type === "artist" &&
        typeof suggestion.artistName === "string" &&
        typeof suggestion.href === "string"
      );
    })
    .slice(0, HEADER_SEARCH_LIMIT);
}

function getInitialSwitcherIndex(switcherItems, selectedGameId) {
  if (!Array.isArray(switcherItems) || switcherItems.length === 0) {
    return null;
  }

  const selectedIndex = switcherItems.findIndex((game) => game.gameId === selectedGameId);

  return selectedIndex >= 0 ? selectedIndex : 0;
}

function useArchiveHeaderInteractions({
  activeRoute,
  initialSearchValue = "",
  initialSuggestions = [],
  suggestionEndpoint = "/api/archive/search-suggestions",
  switcherItems = [],
  selectedSwitcherGameId = null,
} = {}) {
  const [searchValue, setSearchValue] = React.useState(() =>
    normalizeArchiveSearch(initialSearchValue),
  );
  const [suggestions, setSuggestions] = React.useState(() =>
    normalizeHeaderSuggestions(initialSuggestions),
  );
  const [suggestionStatus, setSuggestionStatus] = React.useState(
    suggestions.length > 0 ? "ready" : "idle",
  );
  const initialSwitcherIndex = React.useMemo(
    () => getInitialSwitcherIndex(switcherItems, selectedSwitcherGameId),
    [selectedSwitcherGameId, switcherItems],
  );
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const [switcherActiveIndex, setSwitcherActiveIndex] = React.useState(initialSwitcherIndex);
  const normalizedSearchValue = normalizeArchiveSearch(searchValue);

  React.useEffect(() => {
    setSearchValue(normalizeArchiveSearch(initialSearchValue));
  }, [initialSearchValue]);

  React.useEffect(() => {
    setSwitcherActiveIndex((currentIndex) => {
      if (switcherItems.length === 0) {
        return null;
      }

      if (currentIndex === null || currentIndex >= switcherItems.length) {
        return initialSwitcherIndex;
      }

      return currentIndex;
    });
  }, [initialSwitcherIndex, switcherItems.length]);

  React.useEffect(() => {
    if (normalizedSearchValue.length === 0) {
      setSuggestions([]);
      setSuggestionStatus("idle");
      return undefined;
    }

    if (typeof window === "undefined" || typeof window.fetch !== "function") {
      return undefined;
    }

    setSuggestionStatus("loading");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const url = new URL(suggestionEndpoint, window.location.origin);
        url.searchParams.set("q", normalizedSearchValue);
        const response = await window.fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`suggestions request failed: ${response.status}`);
        }

        const payload = await response.json();
        setSuggestions(normalizeHeaderSuggestions(payload?.data?.suggestions));
        setSuggestionStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setSuggestionStatus("error");
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [normalizedSearchValue, suggestionEndpoint]);

  const suggestionCountAnnouncement = React.useMemo(() => {
    if (suggestionStatus === "loading") {
      return "Loading search suggestions.";
    }

    if (suggestionStatus === "error") {
      return "Search suggestions are unavailable.";
    }

    if (normalizedSearchValue.length === 0) {
      return "Search suggestions are available after typing.";
    }

    if (suggestions.length === 0) {
      return "No search suggestions found.";
    }

    return `${suggestions.length} search suggestion${suggestions.length === 1 ? "" : "s"} available.`;
  }, [normalizedSearchValue, suggestionStatus, suggestions.length]);

  const submitSearch = React.useCallback(() => {
    const href = buildSongSearchHref({ q: normalizeArchiveSearch(searchValue) });

    setSuggestions([]);
    setSuggestionStatus("idle");

    if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  }, [searchValue]);

  const clearSuggestions = React.useCallback(() => {
    setSuggestions([]);
    setSuggestionStatus("idle");
  }, []);

  const focusSearchFromShortcut = React.useCallback((event) => {
    if (!isSearchShortcutEvent(event)) {
      return;
    }

    event.preventDefault();

    if (typeof document !== "undefined") {
      const input = document.getElementById(SEARCH_INPUT_ID);
      input?.focus();
      input?.select();
    }
  }, []);

  const moveSwitcherFocus = React.useCallback(
    (direction) => {
      if (switcherItems.length === 0) {
        setSwitcherActiveIndex(null);
        return;
      }

      setSwitcherOpen(true);
      setSwitcherActiveIndex((currentIndex) => {
        if (currentIndex === null) {
          return direction === "previous" ? switcherItems.length - 1 : (initialSwitcherIndex ?? 0);
        }

        return direction === "previous"
          ? (currentIndex - 1 + switcherItems.length) % switcherItems.length
          : (currentIndex + 1) % switcherItems.length;
      });
    },
    [initialSwitcherIndex, switcherItems.length],
  );

  const selectActiveSwitcherItem = React.useCallback(() => {
    const activeItem =
      switcherActiveIndex === null ? null : switcherItems[switcherActiveIndex] ?? null;

    if (activeItem?.href && typeof window !== "undefined") {
      window.location.assign(activeItem.href);
    }
  }, [switcherActiveIndex, switcherItems]);

  return {
    searchValue,
    setSearchValue,
    suggestions,
    suggestionStatus,
    suggestionCountAnnouncement,
    submitSearch,
    clearSuggestions,
    focusSearchFromShortcut,
    switcherOpen,
    switcherActiveIndex,
    setSwitcherOpen,
    moveSwitcherFocus,
    selectActiveSwitcherItem,
  };
}

function buildSearchSuggestionBadge(type) {
  const badge = buildArchiveBadgeModel({
    variant: type === "song" ? "search-type-song" : "search-type-artist",
    label: type === "song" ? "Song" : "Artist",
  });

  return React.createElement(
    "span",
    {
      className: "archive-badge archive-shell-search-suggestion-type",
      "data-archive-badge-variant": badge.variant,
      "data-archive-badge-role": ARCHIVE_BADGE_VARIANTS[badge.variant].tokenRole,
    },
    badge.label,
  );
}

function getSuggestionKey(suggestion) {
  return suggestion.type === "song"
    ? `song-${suggestion.songId}`
    : `artist-${normalizeArchiveSearch(suggestion.artistName)}`;
}

function HeaderSearch({ activeRoute, search, interactions }) {
  const [expanded, setExpanded] = React.useState(false);
  const suggestions = interactions.suggestions;

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handleShortcut(event) {
      if (!isSearchShortcutEvent(event)) {
        return;
      }

      setExpanded(true);
      interactions.focusSearchFromShortcut(event);
      window.requestAnimationFrame(() => {
        document.getElementById(SEARCH_INPUT_ID)?.focus();
      });
    }

    window.addEventListener("keydown", handleShortcut);

    return () => window.removeEventListener("keydown", handleShortcut);
  }, [interactions.focusSearchFromShortcut]);

  return React.createElement(
    "div",
    { className: "archive-shell-search" },
    React.createElement(
      "button",
      {
        type: "button",
        className: "archive-shell-search-toggle",
        "aria-controls": SEARCH_FORM_ID,
        "aria-expanded": expanded,
        onClick: () => setExpanded((value) => !value),
      },
      "Search",
    ),
    React.createElement(
      "form",
      {
        id: SEARCH_FORM_ID,
        action: search?.submitHrefBase ?? "/songs",
        method: "get",
        role: "search",
        "aria-label": "Archive songs and artists",
        className: expanded
          ? "archive-shell-search-form is-expanded"
          : "archive-shell-search-form",
        onSubmit: (event) => {
          event.preventDefault();
          interactions.submitSearch();
        },
        onKeyDown: (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            interactions.clearSuggestions();
          }
        },
      },
      React.createElement(
        "label",
        { htmlFor: SEARCH_INPUT_ID },
        "Search songs and artists",
      ),
      React.createElement("input", {
        id: SEARCH_INPUT_ID,
        name: "q",
        type: "search",
        value: interactions.searchValue,
        onChange: (event) => interactions.setSearchValue(event.target.value),
        autoComplete: "off",
        "aria-controls": SEARCH_SUGGESTIONS_ID,
        "aria-describedby": SEARCH_LIVE_REGION_ID,
        "aria-expanded": suggestions.length > 0,
      }),
      React.createElement("button", { type: "submit" }, "Search"),
      React.createElement(
        "p",
        { id: SEARCH_LIVE_REGION_ID, className: "archive-sr-only", "aria-live": "polite" },
        interactions.suggestionCountAnnouncement,
      ),
      suggestions.length > 0
        ? React.createElement(
            "ul",
            {
              id: SEARCH_SUGGESTIONS_ID,
              className: "archive-shell-search-suggestions",
              "aria-labelledby": SEARCH_LIVE_REGION_ID,
            },
            suggestions.map((suggestion) =>
              React.createElement(
                "li",
                { key: getSuggestionKey(suggestion) },
                React.createElement(
                  "a",
                  { href: suggestion.href },
                  buildSearchSuggestionBadge(suggestion.type),
                  React.createElement(
                    "span",
                    { className: "archive-shell-search-suggestion-copy" },
                    suggestion.type === "song"
                      ? React.createElement(
                          React.Fragment,
                          null,
                          React.createElement("span", null, suggestion.title),
                          React.createElement("small", null, `by ${suggestion.artistName}`),
                        )
                      : React.createElement("span", null, suggestion.artistName),
                  ),
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

function GameSwitcher({ switcher, interactions }) {
  const triggerRef = React.useRef(null);
  const itemRefs = React.useRef(new Map());
  const panelId = "archive-shell-game-switcher-panel";
  const currentGames = switcher?.currentGames ?? [];
  const completedGames = switcher?.completedGames ?? [];
  const orderedGames = React.useMemo(
    () => [...currentGames, ...completedGames],
    [currentGames, completedGames],
  );
  const activeGameId =
    interactions.switcherActiveIndex === null
      ? null
      : orderedGames[interactions.switcherActiveIndex]?.gameId ?? null;

  React.useEffect(() => {
    if (!interactions.switcherOpen || activeGameId === null) {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      itemRefs.current.get(activeGameId)?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeGameId, interactions.switcherOpen]);

  return React.createElement(
    "div",
    {
      className: "archive-shell-switcher",
      onKeyDown: (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          interactions.setSwitcherOpen(false);
          triggerRef.current?.focus();
          return;
        }

        if (orderedGames.length === 0) {
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          interactions.moveSwitcherFocus("next");
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          interactions.moveSwitcherFocus("previous");
          return;
        }

        if (
          interactions.switcherOpen &&
          (event.key === "Enter" || event.key === " ") &&
          isGameSwitcherItemTarget(event.target)
        ) {
          event.preventDefault();
          interactions.selectActiveSwitcherItem();
        }
      },
    },
    React.createElement(
      "button",
      {
        type: "button",
        "aria-expanded": interactions.switcherOpen,
        "aria-controls": panelId,
        ref: triggerRef,
        onClick: () => interactions.setSwitcherOpen(!interactions.switcherOpen),
      },
      "Games",
    ),
    React.createElement(
      "div",
      {
        id: panelId,
        className: "archive-shell-switcher-panel",
        hidden: !interactions.switcherOpen,
      },
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
  const switcherItems = React.useMemo(
    () => [...(switcher?.currentGames ?? []), ...(switcher?.completedGames ?? [])],
    [switcher?.completedGames, switcher?.currentGames],
  );
  const headerInteractions = useArchiveHeaderInteractions({
    activeRoute,
    initialSearchValue: search?.value ?? "",
    initialSuggestions: search?.suggestions ?? [],
    selectedSwitcherGameId: switcher?.selectedGameId ?? null,
    switcherItems,
  });
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
        React.createElement(HeaderSearch, {
          activeRoute,
          search,
          interactions: headerInteractions,
        }),
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
        React.createElement(GameSwitcher, { switcher, interactions: headerInteractions }),
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
  useArchiveHeaderInteractions,
};
