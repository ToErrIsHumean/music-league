const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROHIBITED_M6_INSIGHT_FACTS,
  assertDispatchableInsightTemplate,
  assertSupportedInsightSourceFacts,
  normalizeExportedArtistIdentity,
} = require("./insight-guardrails");

test("normalizes artist identity as the exported display string", () => {
  assert.equal(
    normalizeExportedArtistIdentity(" Familiar Faces "),
    normalizeExportedArtistIdentity("Familiar Faces"),
  );
  assert.notEqual(
    normalizeExportedArtistIdentity("Familiar Faces"),
    normalizeExportedArtistIdentity("Familiar Faces feat. Guest Ray"),
  );
});

test("accepts dispatchable insight templates with named facts and denominators", () => {
  const template = {
    id: "player-finish-percentile",
    sourceFacts: ["players", "submissions", "scores", "ranks"],
    scope: "Player",
    denominator: "scored submissions",
    minimumSample: 1,
    omissionCondition: "omit when scoredSubmissionCount is 0",
    evidenceLink: {
      kind: "player",
      requiresGameContext: true,
    },
    copyGuardrails: [
      "name or expose the scored-submission denominator",
      "avoid durable tendency language for one scored submission",
    ],
  };

  assert.equal(assertDispatchableInsightTemplate(template), template);
});

test("rejects unsupported M6 insight source facts", () => {
  assert.throws(
    () => assertSupportedInsightSourceFacts(["players", "genre"]),
    /unsupported M6 insight source fact: genre/,
  );
  assert.throws(
    () => assertSupportedInsightSourceFacts(["voteBudget"]),
    /unsupported M6 insight source fact: voteBudget/,
  );
  assert.throws(
    () =>
      assertDispatchableInsightTemplate({
        id: "unsupported",
        sourceFacts: ["spotifyEnrichment"],
        scope: "Song",
        denominator: "songs",
        minimumSample: 1,
        omissionCondition: "omit",
        evidenceLink: {
          kind: "song",
          requiresGameContext: true,
        },
        copyGuardrails: [],
      }),
    /unsupported M6 insight source fact: spotifyEnrichment/,
  );
});

test("keeps the AC-10 prohibited claim surface explicit", () => {
  assert.deepEqual(PROHIBITED_M6_INSIGHT_FACTS, [
    "genre",
    "mood",
    "duration",
    "popularity",
    "album",
    "release-year",
    "audio-feature",
    "spotify-enrichment",
    "unsupported-funny-fallback",
    "vote-budget",
    "deadline",
    "low-stakes",
    "collaborator-level-artist",
  ]);
});
