const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  ARCHIVE_BADGE_VARIANTS,
  buildArchiveBadgeModel,
} = require("./archive-badges");

test("archive badge variants expose stable token roles and fallback labels", () => {
  assert.deepEqual(Object.keys(ARCHIVE_BADGE_VARIANTS), [
    "status-current",
    "status-completed",
    "rank-tie",
    "rank-plain",
    "score",
    "playlist-link",
    "familiarity-first-time",
    "familiarity-returning",
    "search-type-song",
    "search-type-artist",
    "trait",
  ]);
  assert.equal(ARCHIVE_BADGE_VARIANTS["status-current"].tokenRole, "accent");
  assert.equal(ARCHIVE_BADGE_VARIANTS["status-completed"].tokenRole, "primary");
  assert.equal(ARCHIVE_BADGE_VARIANTS["rank-tie"].defaultLabel, "T<rank>");
});

test("buildArchiveBadgeModel keeps styling variant separate from visible copy", () => {
  assert.deepEqual(
    buildArchiveBadgeModel({
      variant: "rank-tie",
      label: "T1",
      ariaLabel: "Tied rank 1",
    }),
    {
      variant: "rank-tie",
      label: "T1",
      ariaLabel: "Tied rank 1",
    },
  );
  assert.deepEqual(buildArchiveBadgeModel({ variant: "playlist-link", label: "  " }), {
    variant: "playlist-link",
    label: "Playlist",
    ariaLabel: null,
  });
});

test("buildArchiveBadgeModel rejects unregistered variants", () => {
  assert.throws(
    () => buildArchiveBadgeModel({ variant: "Current", label: "Current" }),
    /Unsupported archive badge variant/,
  );
});

test("archive CSS defines M8 tokens and does not retain alpha warm palette literals", () => {
  const css = fs.readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");

  for (const token of [
    "--brand-purple",
    "--accent-gold",
    "--surface-paper",
    "--surface-secondary",
    "--ink-primary",
    "--ink-muted",
    "--focus-ring",
    "--font-display",
    "--font-body",
  ]) {
    assert.match(css, new RegExp(`${token}:`));
  }

  const retiredAlphaHexes = ["a43f2f", "f7f0e1", "fefaf2", "e4d4bb", "1f1b18", "685a4d"];

  for (const retiredLiteral of retiredAlphaHexes.map((hex) => `#${hex}`)) {
    assert.equal(css.includes(retiredLiteral), false, `retired alpha color ${retiredLiteral} should be tokenized`);
  }
});
