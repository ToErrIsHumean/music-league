const { normalize } = require("../lib/normalize");

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeArchiveSearch(value) {
  const candidate = firstParam(value);

  if (typeof candidate !== "string") {
    return "";
  }

  try {
    return normalize(candidate);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("normalize: empty output")) {
      return "";
    }

    throw error;
  }
}

module.exports = { normalizeArchiveSearch };
