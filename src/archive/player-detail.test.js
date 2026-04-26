const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PLAYER_TRAIT_REGISTRY,
  derivePlayerTraits,
} = require("./player-detail");

function traitIds(facts) {
  return derivePlayerTraits({ playerId: 1, ...facts }).map((trait) => trait.traitId);
}

test("player trait registry exposes the approved stable IDs in display order", () => {
  assert.deepEqual(Object.keys(PLAYER_TRAIT_REGISTRY), [
    "consistent-finisher",
    "frequent-commenter",
    "high-variance-voter",
    "voting-twin",
  ]);
});

test("derivePlayerTraits gates the OQ-01 threshold boundaries", () => {
  assert.deepEqual(
    traitIds({
      averageFinishPercentile: 0.4,
      scoredSubmissionCount: 4,
    }),
    ["consistent-finisher"],
  );
  assert.deepEqual(
    traitIds({
      averageFinishPercentile: 0.41,
      scoredSubmissionCount: 4,
    }),
    [],
  );
  assert.deepEqual(
    traitIds({
      averageFinishPercentile: 0.4,
      scoredSubmissionCount: 3,
    }),
    [],
  );

  assert.deepEqual(
    traitIds({
      commentRate: 0.6,
      commentOpportunityCount: 12,
    }),
    ["frequent-commenter"],
  );
  assert.deepEqual(
    traitIds({
      commentRate: 0.59,
      commentOpportunityCount: 12,
    }),
    [],
  );
  assert.deepEqual(
    traitIds({
      commentRate: 0.6,
      commentOpportunityCount: 11,
    }),
    [],
  );

  assert.deepEqual(
    traitIds({
      votePointStdDev: 3,
      voteCount: 24,
    }),
    ["high-variance-voter"],
  );
  assert.deepEqual(
    traitIds({
      votePointStdDev: 2.99,
      voteCount: 24,
    }),
    [],
  );
  assert.deepEqual(
    traitIds({
      votePointStdDev: 3,
      voteCount: 23,
    }),
    [],
  );

  const votingTwin = derivePlayerTraits({
    playerId: 1,
    votingSimilarity: 0.7,
    sharedVoteCount: 10,
    subjectPlayerId: 2,
    subjectPlayerDisplayName: "Bea",
  });

  assert.equal(votingTwin.length, 1);
  assert.equal(votingTwin[0].traitId, "voting-twin");
  assert.equal(votingTwin[0].label, "Voting twin with Bea");
  assert.deepEqual(votingTwin[0].subjectPlayer, {
    playerId: 2,
    displayName: "Bea",
    href: "/players/2",
  });
  assert.deepEqual(
    traitIds({
      votingSimilarity: 0.69,
      sharedVoteCount: 10,
      subjectPlayerId: 2,
      subjectPlayerDisplayName: "Bea",
    }),
    [],
  );
  assert.deepEqual(
    traitIds({
      votingSimilarity: 0.7,
      sharedVoteCount: 9,
      subjectPlayerId: 2,
      subjectPlayerDisplayName: "Bea",
    }),
    [],
  );
});
