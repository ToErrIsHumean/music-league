function normalize(input) {
  const normalized = input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .toLowerCase()
    .replace(/[.,'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length === 0) {
    throw new Error(`normalize: empty output for input: "${input}"`);
  }

  return normalized;
}

module.exports = { normalize };
