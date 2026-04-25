const { normalize } = require("../lib/normalize");

const INSIGHT_SCOPES = Object.freeze([
  "Game",
  "Round",
  "Player",
  "Song",
  "Submission",
  "Vote",
  "mixed",
]);

const EVIDENCE_LINK_KINDS = Object.freeze([
  "round",
  "player",
  "song",
  "submission",
  "vote-breakdown",
]);

const CANONICAL_INSIGHT_SOURCE_FACTS = Object.freeze([
  "players",
  "games",
  "rounds",
  "submissions",
  "songs",
  "exported-artist-labels",
  "votes",
  "scores",
  "ranks",
  "dates",
  "playlist-urls",
  "visibility-flags",
  "comments",
]);

const PROHIBITED_M6_INSIGHT_FACTS = Object.freeze([
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

function normalizeExportedArtistIdentity(displayName) {
  return normalize(displayName);
}

function normalizeFactToken(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function assertSupportedInsightSourceFacts(sourceFacts) {
  const canonicalFacts = new Set(CANONICAL_INSIGHT_SOURCE_FACTS);
  const prohibitedFacts = new Set(PROHIBITED_M6_INSIGHT_FACTS);

  for (const sourceFact of sourceFacts) {
    const normalizedFact = normalizeFactToken(sourceFact);

    if (prohibitedFacts.has(normalizedFact) || !canonicalFacts.has(normalizedFact)) {
      throw new Error(`unsupported M6 insight source fact: ${sourceFact}`);
    }
  }
}

function assertDispatchableInsightTemplate(template) {
  if (!template || typeof template !== "object") {
    throw new Error("insight template must be an object");
  }

  if (typeof template.id !== "string" || template.id.trim() === "") {
    throw new Error("insight template id is required");
  }

  if (!Array.isArray(template.sourceFacts) || template.sourceFacts.length === 0) {
    throw new Error("insight template sourceFacts must be named");
  }

  assertSupportedInsightSourceFacts(template.sourceFacts);

  if (!INSIGHT_SCOPES.includes(template.scope)) {
    throw new Error(`unsupported M6 insight scope: ${template.scope}`);
  }

  if (typeof template.denominator !== "string" || template.denominator.trim() === "") {
    throw new Error("insight template denominator must be named");
  }

  if (!Number.isInteger(template.minimumSample) || template.minimumSample < 0) {
    throw new Error("insight template minimumSample must be a non-negative integer");
  }

  if (
    typeof template.omissionCondition !== "string" ||
    template.omissionCondition.trim() === ""
  ) {
    throw new Error("insight template omissionCondition must be named");
  }

  if (
    !template.evidenceLink ||
    typeof template.evidenceLink !== "object" ||
    !EVIDENCE_LINK_KINDS.includes(template.evidenceLink.kind) ||
    typeof template.evidenceLink.requiresGameContext !== "boolean"
  ) {
    throw new Error("insight template evidenceLink must name a supported destination");
  }

  if (
    !Array.isArray(template.copyGuardrails) ||
    template.copyGuardrails.some((guardrail) => typeof guardrail !== "string")
  ) {
    throw new Error("insight template copyGuardrails must be strings");
  }

  return template;
}

module.exports = {
  CANONICAL_INSIGHT_SOURCE_FACTS,
  EVIDENCE_LINK_KINDS,
  INSIGHT_SCOPES,
  PROHIBITED_M6_INSIGHT_FACTS,
  assertDispatchableInsightTemplate,
  assertSupportedInsightSourceFacts,
  normalizeExportedArtistIdentity,
};
