const { getHeaderSearchSuggestions } = require("./m8-derivations");

const HEADER_SEARCH_QUERY_MAX_LENGTH = 200;

function normalizeRawQuery(value) {
  return typeof value === "string" ? value : "";
}

async function getArchiveSearchSuggestionsResult({ q, input = {} } = {}) {
  const rawQuery = normalizeRawQuery(q);

  if (rawQuery.length > HEADER_SEARCH_QUERY_MAX_LENGTH) {
    return {
      status: 400,
      body: {
        data: null,
        error: "validation: q exceeds 200 characters",
      },
    };
  }

  return {
    status: 200,
    body: {
      data: {
        suggestions: await getHeaderSearchSuggestions(rawQuery, { limit: 8, input }),
      },
      error: null,
    },
  };
}

function getArchiveSearchSuggestionsMethodNotAllowedResult() {
  return {
    status: 405,
    headers: {
      Allow: "GET",
    },
    body: {
      data: null,
      error: "method not allowed",
    },
  };
}

module.exports = {
  HEADER_SEARCH_QUERY_MAX_LENGTH,
  getArchiveSearchSuggestionsMethodNotAllowedResult,
  getArchiveSearchSuggestionsResult,
};
