const RETIRED_OVERLAY_PARAMS = ["round", "song", "player", "playerSubmission"];
const VALID_SONG_FAMILIARITY_FILTERS = new Set(["all", "first-time", "returning"]);
const VALID_SONG_SORTS = new Set([
  "most-appearances",
  "most-recent",
  "best-finish",
  "alphabetical",
]);

function parsePositiveRouteId(value) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate === "number") {
    return Number.isInteger(candidate) && candidate > 0 ? candidate : null;
  }

  if (typeof candidate !== "string" || !/^\d+$/.test(candidate)) {
    return null;
  }

  const parsedValue = Number.parseInt(candidate, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function appendParamEntries(params, key, value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry !== undefined && entry !== null) {
        params.append(key, String(entry));
      }
    }

    return;
  }

  if (value !== undefined && value !== null) {
    params.append(key, String(value));
  }
}

function toUrlSearchParams(searchParams) {
  if (searchParams instanceof URLSearchParams) {
    return new URLSearchParams(searchParams);
  }

  const params = new URLSearchParams();

  if (!searchParams || typeof searchParams !== "object") {
    return params;
  }

  for (const [key, value] of Object.entries(searchParams)) {
    appendParamEntries(params, key, value);
  }

  return params;
}

function stripRetiredOverlayParams(searchParams) {
  const params = toUrlSearchParams(searchParams);

  for (const key of RETIRED_OVERLAY_PARAMS) {
    params.delete(key);
  }

  return params;
}

function buildGameHref(gameId) {
  const parsedGameId = parsePositiveRouteId(gameId);

  return parsedGameId === null ? "/" : `/games/${parsedGameId}`;
}

function buildRoundHref(gameId, roundId) {
  const parsedGameId = parsePositiveRouteId(gameId);
  const parsedRoundId = parsePositiveRouteId(roundId);

  if (parsedGameId === null) {
    return "/";
  }

  return parsedRoundId === null
    ? buildGameHref(parsedGameId)
    : `/games/${parsedGameId}/rounds/${parsedRoundId}`;
}

function buildSongHref(songId) {
  const parsedSongId = parsePositiveRouteId(songId);

  return parsedSongId === null ? "/songs" : `/songs/${parsedSongId}`;
}

function buildPlayerHref(playerId) {
  const parsedPlayerId = parsePositiveRouteId(playerId);

  return parsedPlayerId === null ? "/" : `/players/${parsedPlayerId}`;
}

function normalizeSongSearchValue(value) {
  const candidate = Array.isArray(value) ? value[0] : value;

  return typeof candidate === "string" ? candidate.trim() : "";
}

function buildSongSearchHref(input = {}) {
  const params = new URLSearchParams();
  const query = normalizeSongSearchValue(input.q);
  const familiarity = normalizeSongSearchValue(input.familiarity);
  const sort = normalizeSongSearchValue(input.sort);

  if (query.length > 0) {
    params.set("q", query);
  }

  if (VALID_SONG_FAMILIARITY_FILTERS.has(familiarity) && familiarity !== "all") {
    params.set("familiarity", familiarity);
  }

  if (VALID_SONG_SORTS.has(sort) && sort !== "most-recent") {
    params.set("sort", sort);
  }

  const serialized = params.toString();

  return serialized ? `/songs?${serialized}` : "/songs";
}

function buildRouteMetadata(routeData = {}) {
  const title =
    typeof routeData.title === "string" && routeData.title.trim().length > 0
      ? routeData.title.trim()
      : "Music League Archive";
  const description =
    typeof routeData.description === "string" && routeData.description.trim().length > 0
      ? routeData.description.trim()
      : "Browse imported Music League games, rounds, songs, and players.";

  return { title, description };
}

module.exports = {
  buildGameHref,
  buildPlayerHref,
  buildRoundHref,
  buildRouteMetadata,
  buildSongHref,
  buildSongSearchHref,
  parsePositiveRouteId,
  stripRetiredOverlayParams,
};
