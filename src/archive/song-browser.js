"use client";

const React = require("react");
const { ARCHIVE_BADGE_VARIANTS, buildArchiveBadgeModel } = require("./archive-badges");
const { buildSongSearchHref } = require("./route-utils");
const { normalizeArchiveSearch } = require("./search-normalization");

const SONG_BROWSER_DEBOUNCE_MS = 250;
const SONG_BROWSER_INPUT_ID = "archive-song-browser-search";
const SONG_BROWSER_STATUS_ID = "archive-song-browser-status";

function getSongId(song) {
  return song.songId ?? song.id;
}

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function getRowCount(data) {
  return Array.isArray(data.rows)
    ? data.rows.length
    : Array.isArray(data.songs)
      ? data.songs.length
      : 0;
}

function getRows(data) {
  return Array.isArray(data.rows) ? data.rows : data.songs ?? [];
}

function getTotalMatches(data) {
  return Number.isInteger(data.totalMatches) ? data.totalMatches : getRowCount(data);
}

function getTotalCatalogSize(data) {
  return Number.isInteger(data.totalCatalogSize) ? data.totalCatalogSize : getTotalMatches(data);
}

function getCurrentBrowserPath() {
  if (typeof window === "undefined") {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function getBrowserPath(href) {
  if (typeof window === "undefined") {
    return href;
  }

  const url = new URL(href, window.location.origin);

  return `${url.pathname}${url.search}`;
}

function buildBrowserHref({ query, familiarity, sort }) {
  return buildSongSearchHref({
    q: normalizeArchiveSearch(query),
    familiarity,
    sort,
  });
}

function navigateToBrowserState({ query, familiarity, sort }, mode = "replace") {
  if (typeof window === "undefined") {
    return;
  }

  const href = buildBrowserHref({ query, familiarity, sort });
  const currentPath = getCurrentBrowserPath();
  const nextPath = getBrowserPath(href);

  if (currentPath === nextPath) {
    return;
  }

  if (mode === "assign") {
    window.location.assign(href);
    return;
  }

  window.location.replace(href);
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

function getFamiliarityBadgeVariant(familiarity) {
  return familiarity?.kind === "first-time"
    ? "familiarity-first-time"
    : "familiarity-returning";
}

function formatBestFinish(bestFinish) {
  if (!bestFinish) {
    return "No ranked finish";
  }

  const rank = `#${bestFinish.rank}`;

  if (bestFinish.score === null || bestFinish.score === undefined) {
    return rank;
  }

  return `${rank}, ${formatCount(bestFinish.score, "point")}`;
}

function buildResultSummary(data) {
  const visibleCount = getRowCount(data);
  const totalMatches = getTotalMatches(data);
  const totalCatalogSize = getTotalCatalogSize(data);

  if (data.isEmpty) {
    return "Import songs to populate the archive browser.";
  }

  if (data.isZeroResult) {
    return "No songs match these filters.";
  }

  if (data.capped) {
    return `Showing ${visibleCount} of ${totalMatches} matching songs.`;
  }

  if (data.query.length === 0) {
    return `${formatCount(totalCatalogSize, "song")} in the archive.`;
  }

  return `${formatCount(totalMatches, "matching song")}.`;
}

function SongBrowserRow({ song }) {
  const songId = getSongId(song);
  const appearanceCount = song.appearanceCount ?? song.appearances ?? 0;

  return React.createElement(
    "li",
    { className: "archive-song-browser-row" },
    React.createElement(
      "div",
      { className: "archive-route-list-main archive-song-browser-row-heading" },
      React.createElement("a", { href: song.href, className: "archive-song-browser-title" }, song.title),
      React.createElement(ArchiveBadge, {
        variant: getFamiliarityBadgeVariant(song.familiarity),
        label: song.familiarity?.label,
        ariaLabel: `${song.title} is ${song.familiarity?.label ?? "familiarity classified"}`,
      }),
    ),
    React.createElement(
      "p",
      { className: "archive-song-browser-artist" },
      "by ",
      React.createElement("a", { href: song.artistSearchHref }, song.artistName),
    ),
    React.createElement(
      "dl",
      { className: "archive-song-browser-facts" },
      React.createElement(
        "div",
        null,
        React.createElement("dt", null, "Appearances"),
        React.createElement("dd", null, formatCount(appearanceCount, "appearance")),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("dt", null, "Most recent"),
        React.createElement(
          "dd",
          null,
          song.mostRecentAppearance
            ? React.createElement(
                "a",
                { href: song.mostRecentAppearance.href },
                `${song.mostRecentAppearance.gameName} - ${song.mostRecentAppearance.roundName}`,
              )
            : "No appearance evidence",
        ),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("dt", null, "Best finish"),
        React.createElement("dd", null, formatBestFinish(song.bestFinish)),
      ),
    ),
    React.createElement("span", { className: "archive-sr-only" }, `Song ID ${songId}`),
  );
}

function SongBrowser({ data }) {
  const [searchValue, setSearchValue] = React.useState(data.query ?? "");
  const normalizedSearchValue = normalizeArchiveSearch(searchValue);
  const rows = getRows(data);
  const resultSummary = buildResultSummary(data);

  React.useEffect(() => {
    setSearchValue(data.query ?? "");
  }, [data.query]);

  React.useEffect(() => {
    if (normalizedSearchValue === (data.query ?? "")) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      navigateToBrowserState({
        query: normalizedSearchValue,
        familiarity: data.familiarity,
        sort: data.sort,
      });
    }, SONG_BROWSER_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [data.familiarity, data.query, data.sort, normalizedSearchValue]);

  return React.createElement(
    "section",
    { className: "archive-song-browser", "aria-labelledby": "archive-song-browser-heading" },
    React.createElement("h2", { id: "archive-song-browser-heading", className: "archive-sr-only" }, "Song browser"),
    React.createElement(
      "form",
      {
        action: "/songs",
        method: "get",
        role: "search",
        "aria-label": "Archive song browser",
        className: "archive-route-controls archive-song-browser-controls",
        onSubmit: (event) => {
          event.preventDefault();
          navigateToBrowserState({
            query: normalizedSearchValue,
            familiarity: data.familiarity,
            sort: data.sort,
          }, "assign");
        },
      },
      React.createElement(
        "label",
        { htmlFor: SONG_BROWSER_INPUT_ID },
        "Search",
        React.createElement("input", {
          id: SONG_BROWSER_INPUT_ID,
          name: "q",
          type: "search",
          value: searchValue,
          onChange: (event) => setSearchValue(event.target.value),
          autoComplete: "off",
          "aria-describedby": SONG_BROWSER_STATUS_ID,
        }),
      ),
      React.createElement(
        "label",
        null,
        "Familiarity",
        React.createElement(
          "select",
          {
            name: "familiarity",
            value: data.familiarity,
            onChange: (event) =>
              navigateToBrowserState({
                query: normalizedSearchValue,
                familiarity: event.target.value,
                sort: data.sort,
              }, "assign"),
          },
          React.createElement("option", { value: "all" }, "All"),
          React.createElement("option", { value: "first-time" }, "First-time"),
          React.createElement("option", { value: "returning" }, "Returning"),
        ),
      ),
      React.createElement(
        "label",
        null,
        "Sort",
        React.createElement(
          "select",
          {
            name: "sort",
            value: data.sort,
            onChange: (event) =>
              navigateToBrowserState({
                query: normalizedSearchValue,
                familiarity: data.familiarity,
                sort: event.target.value,
              }, "assign"),
          },
          React.createElement("option", { value: "most-recent" }, "Most recent"),
          React.createElement("option", { value: "most-appearances" }, "Most appearances"),
          React.createElement("option", { value: "best-finish" }, "Best finish"),
          React.createElement("option", { value: "alphabetical" }, "Alphabetical"),
        ),
      ),
      React.createElement("button", { type: "submit" }, "Search"),
    ),
    React.createElement(
      "p",
      { id: SONG_BROWSER_STATUS_ID, className: "archive-song-browser-summary", "aria-live": "polite" },
      resultSummary,
    ),
    data.capped
      ? React.createElement(
          "p",
          { className: "archive-song-browser-refine" },
          "Refine the search to narrow the full catalog.",
        )
      : null,
    data.isZeroResult && !data.isEmpty
      ? React.createElement("a", { href: data.clearHref, className: "archive-song-browser-clear" }, "Clear filters")
      : null,
    rows.length === 0
      ? React.createElement(
          "p",
          { className: "archive-route-empty" },
          data.isEmpty ? "No songs imported yet." : "No songs match these filters.",
        )
      : React.createElement(
          "ul",
          { className: "archive-route-list archive-song-browser-list" },
          rows.map((song) => React.createElement(SongBrowserRow, { key: getSongId(song), song })),
        ),
  );
}

module.exports = { SongBrowser };
