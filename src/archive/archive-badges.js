const ARCHIVE_BADGE_VARIANT_ENTRIES = {
  "status-current": { tokenRole: "accent", defaultLabel: "Current" },
  "status-completed": { tokenRole: "primary", defaultLabel: "Completed" },
  "rank-tie": { tokenRole: "accent", defaultLabel: "T<rank>" },
  "rank-plain": { tokenRole: "neutral", defaultLabel: "<rank>" },
  "score": { tokenRole: "neutral", defaultLabel: "<score>" },
  "playlist-link": { tokenRole: "accent", defaultLabel: "Playlist" },
  "familiarity-first-time": { tokenRole: "secondary", defaultLabel: "First-time" },
  "familiarity-returning": { tokenRole: "primary", defaultLabel: "Returning" },
  "search-type-song": { tokenRole: "secondary", defaultLabel: "Song" },
  "search-type-artist": { tokenRole: "secondary", defaultLabel: "Artist" },
  trait: { tokenRole: "accent", defaultLabel: "<trait label>" },
};

const ARCHIVE_BADGE_VARIANTS = Object.freeze(
  Object.fromEntries(
    Object.entries(ARCHIVE_BADGE_VARIANT_ENTRIES).map(([variant, model]) => [
      variant,
      Object.freeze({ ...model }),
    ]),
  ),
);

function normalizeBadgeCopy(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildArchiveBadgeModel({ variant, label, ariaLabel } = {}) {
  const variantModel = ARCHIVE_BADGE_VARIANTS[variant];

  if (!variantModel) {
    throw new RangeError(`Unsupported archive badge variant: ${variant ?? "<missing>"}`);
  }

  return {
    variant,
    label: normalizeBadgeCopy(label) ?? variantModel.defaultLabel,
    ariaLabel: normalizeBadgeCopy(ariaLabel),
  };
}

module.exports = {
  ARCHIVE_BADGE_VARIANTS,
  buildArchiveBadgeModel,
};
