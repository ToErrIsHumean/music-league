const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { normalize } = require("../lib/normalize");
const { parseMusicLeagueBundle } = require("./parse-bundle");

const fixtureRoot = path.join(__dirname, "test-fixtures");
const manifestPath = path.join(fixtureRoot, "semantic-fixture-manifest.json");

const REQUIRED_FILES = [
  "competitors.csv",
  "rounds.csv",
  "submissions.csv",
  "votes.csv",
];

const REQUIRED_PATCHES = [
  "CP-01",
  "CP-02",
  "CP-03",
  "CP-04",
  "CP-05",
  "CP-06",
  "CP-07",
  "CP-08",
  "CP-09",
  "CP-10",
];

const REQUIRED_BEHAVIORS = [
  "overlapping-round-names-across-games",
  "repeat-canonical-song-across-rounds",
  "same-title-distinct-song-ids",
  "same-exported-artist-label-new-song",
  "lead-artist-alone-and-multi-artist-label",
  "negative-vote-points",
  "vote-breakdown-voter-target-points-comment",
  "submission-and-vote-comments-distinct",
  "standings-clear-leader",
  "standings-tie",
  "unvoted-submission-missing-score-rank",
  "completed-snapshot-legacy-visibility-flags",
  "sparse-player-history",
  "stale-origin-context-modal-route",
];

const SOURCE_SETTINGS_POSTURE = Object.freeze({
  absentSettingsState: "unknown",
  negativeVotePoints: "valid-source-facts",
  prohibitedExplanations: [
    "vote-budget-usage",
    "missed-deadlines",
    "disqualification",
    "low-stakes-behavior",
  ],
});

const PLAYER_PERFORMANCE_OVERVIEW_CONTRACT = Object.freeze({
  finishPercentileFormula: "(rank - 1) / max(scoredRoundSize - 1, 1)",
  denominator: "scored submissions",
  multiSubmitHandling:
    "submission claims count every scored submission; submitted-round claims use a distinct round count",
  scoreVariancePosture:
    "raw descriptive context only; never explains source settings",
  minimumSample: 1,
  smallSampleCopy:
    "one scored submission may describe that result without durable-tendency language",
});

const ARTIST_IDENTITY_CONTRACT = Object.freeze({
  identity: "normalized exported artist display string",
  prohibitedClaim: "collaborator-level identity from multi-artist labels",
});

const STALE_MODAL_ORIGIN_CONTEXTS = [
  {
    fixtureName: "semantic-game-alpha",
    sourceRoundId: "retired-alpha-round",
    spotifyUri: "spotify:track:semantic-repeat",
    expectedState: "unresolvable-origin-context",
  },
];

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function parseManifestFixtures() {
  return readManifest().map((entry) => ({
    entry,
    parsed: parseMusicLeagueBundle({
      bundlePath: path.join(fixtureRoot, entry.fixtureName),
    }),
  }));
}

function getSubmissionKey(row) {
  return `${row.sourceRoundId}\u0000${row.spotifyUri}`;
}

function getScoredSubmissions(parsed) {
  return parsed.files.submissions.rows.filter(
    (row) => row.score !== null && row.rank !== null,
  );
}

function deriveScoredStandings(parsed) {
  const standingsByPlayer = new Map();

  for (const submission of getScoredSubmissions(parsed)) {
    const row = standingsByPlayer.get(submission.sourceSubmitterId) ?? {
      sourceSubmitterId: submission.sourceSubmitterId,
      totalScore: 0,
      scoredSubmissionCount: 0,
      scoredRoundIds: new Set(),
    };

    row.totalScore += submission.score;
    row.scoredSubmissionCount += 1;
    row.scoredRoundIds.add(submission.sourceRoundId);
    standingsByPlayer.set(submission.sourceSubmitterId, row);
  }

  const rows = [...standingsByPlayer.values()]
    .map((row) => ({
      sourceSubmitterId: row.sourceSubmitterId,
      totalScore: row.totalScore,
      scoredSubmissionCount: row.scoredSubmissionCount,
      scoredRoundCount: row.scoredRoundIds.size,
    }))
    .sort(
      (left, right) =>
        right.totalScore - left.totalScore ||
        left.sourceSubmitterId.localeCompare(right.sourceSubmitterId),
    );

  let rank = 0;
  let previousScore = null;

  return rows.map((row) => {
    if (row.totalScore !== previousScore) {
      rank += 1;
      previousScore = row.totalScore;
    }

    return {
      ...row,
      rank,
      tied: rows.some(
        (candidate) =>
          candidate !== row && candidate.totalScore === row.totalScore,
      ),
    };
  });
}

function buildRoundDetailVoteBreakdown(parsed, sourceRoundId) {
  const submissionByRoundSong = new Map(
    parsed.files.submissions.rows.map((row) => [getSubmissionKey(row), row]),
  );

  return parsed.files.votes.rows
    .filter((vote) => vote.sourceRoundId === sourceRoundId)
    .map((vote) => {
      const submission = submissionByRoundSong.get(getSubmissionKey(vote));

      return {
        sourceVoterId: vote.sourceVoterId,
        targetSubmission: {
          spotifyUri: submission.spotifyUri,
          title: submission.title,
          artistName: submission.artistName,
          sourceSubmitterId: submission.sourceSubmitterId,
          comment: submission.comment,
        },
        pointsAssigned: vote.pointsAssigned,
        voteComment: vote.comment,
      };
    });
}

function getScoredRoundSize(parsed, sourceRoundId) {
  return getScoredSubmissions(parsed).filter(
    (submission) => submission.sourceRoundId === sourceRoundId,
  ).length;
}

function getFinishPercentile(submission, scoredRoundSize) {
  return (submission.rank - 1) / Math.max(scoredRoundSize - 1, 1);
}

function summarizePlayerPerformanceEvidence(parsed, sourceSubmitterId) {
  const playerSubmissions = parsed.files.submissions.rows.filter(
    (submission) => submission.sourceSubmitterId === sourceSubmitterId,
  );
  const scoredSubmissions = playerSubmissions.filter(
    (submission) => submission.score !== null && submission.rank !== null,
  );

  return {
    sourceSubmitterId,
    denominator: PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.denominator,
    scoredSubmissionCount: scoredSubmissions.length,
    submittedRoundCount: new Set(
      playerSubmissions.map((submission) => submission.sourceRoundId),
    ).size,
    scoredRoundCount: new Set(
      scoredSubmissions.map((submission) => submission.sourceRoundId),
    ).size,
    finishPercentiles: scoredSubmissions.map((submission) =>
      getFinishPercentile(
        submission,
        getScoredRoundSize(parsed, submission.sourceRoundId),
      ),
    ),
    minimumSample: PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.minimumSample,
    scoreVariancePosture:
      PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.scoreVariancePosture,
    smallSampleCopy: PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.smallSampleCopy,
    multiSubmitHandling:
      PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.multiSubmitHandling,
  };
}

function resolveSubmissionOrigin(parsed, origin) {
  return (
    parsed.files.submissions.rows.find(
      (submission) =>
        submission.sourceRoundId === origin.sourceRoundId &&
        submission.spotifyUri === origin.spotifyUri,
    ) ?? null
  );
}

function normalizeArtistIdentity(artistName) {
  return normalize(artistName);
}

function assertNoPersistedStandingsTable() {
  const schema = fs.readFileSync(
    path.join(__dirname, "../../prisma/schema.prisma"),
    "utf8",
  );

  assert.doesNotMatch(
    schema,
    /^\s*model\s+(Standing|Leaderboard)\b/m,
    "standings remain a derived read model, not a persisted table",
  );
}

function findFixture(fixtures, fixtureName) {
  return fixtures.find(({ entry }) => entry.fixtureName === fixtureName).parsed;
}

function assertContractPostures() {
  assert.equal(SOURCE_SETTINGS_POSTURE.absentSettingsState, "unknown");
  assert.equal(
    SOURCE_SETTINGS_POSTURE.negativeVotePoints,
    "valid-source-facts",
  );
  assert.deepEqual(SOURCE_SETTINGS_POSTURE.prohibitedExplanations, [
    "vote-budget-usage",
    "missed-deadlines",
    "disqualification",
    "low-stakes-behavior",
  ]);

  assert.equal(
    PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.finishPercentileFormula,
    "(rank - 1) / max(scoredRoundSize - 1, 1)",
  );
  assert.equal(
    PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.denominator,
    "scored submissions",
  );
  assert.match(
    PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.multiSubmitHandling,
    /every scored submission/,
  );
  assert.match(
    PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.scoreVariancePosture,
    /never explains source settings/,
  );
  assert.equal(PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.minimumSample, 1);
  assert.match(
    PLAYER_PERFORMANCE_OVERVIEW_CONTRACT.smallSampleCopy,
    /without durable-tendency language/,
  );

  assert.deepEqual(ARTIST_IDENTITY_CONTRACT, {
    identity: "normalized exported artist display string",
    prohibitedClaim: "collaborator-level identity from multi-artist labels",
  });
}

test("semantic fixture manifest is traceable and references complete bundles", () => {
  const manifest = readManifest();
  const coveredPatches = new Set();
  const coveredBehaviors = new Set();

  assert.equal(Array.isArray(manifest), true);
  assert.equal(manifest.length >= 2, true);

  for (const entry of manifest) {
    assert.equal(typeof entry.fixtureName, "string");
    assert.deepEqual(entry.files, REQUIRED_FILES);
    assert.equal(Array.isArray(entry.covers), true);
    assert.equal(Array.isArray(entry.behaviors), true);

    for (const filename of REQUIRED_FILES) {
      assert.equal(
        fs.existsSync(path.join(fixtureRoot, entry.fixtureName, filename)),
        true,
        `${entry.fixtureName} is missing ${filename}`,
      );
    }

    for (const patchId of entry.covers) {
      coveredPatches.add(patchId);
    }

    for (const behavior of entry.behaviors) {
      coveredBehaviors.add(behavior);
    }
  }

  assert.deepEqual([...coveredPatches].sort(), REQUIRED_PATCHES);
  assert.deepEqual([...coveredBehaviors].sort(), REQUIRED_BEHAVIORS.sort());
});

test("semantic fixture rows exercise corrective game semantics", () => {
  const fixtures = parseManifestFixtures();

  for (const { entry, parsed } of fixtures) {
    assert.deepEqual(parsed.issues, [], `${entry.fixtureName} parses cleanly`);
    assert.equal(parsed.sourceLabel, entry.fixtureName);
  }

  const roundsByName = new Map();
  const allSubmissions = [];
  const allVotes = [];

  for (const { parsed } of fixtures) {
    for (const round of parsed.files.rounds.rows) {
      const gameKeys = roundsByName.get(round.name) ?? new Set();
      gameKeys.add(parsed.gameKey);
      roundsByName.set(round.name, gameKeys);
    }

    allSubmissions.push(...parsed.files.submissions.rows);
    allVotes.push(...parsed.files.votes.rows);
  }

  assert.equal(roundsByName.get("Night Drive").size, 2);
  assert.equal(roundsByName.get("Shared Finale").size, 2);

  const alpha = findFixture(fixtures, "semantic-game-alpha");
  const bravo = findFixture(fixtures, "semantic-game-bravo");

  const repeatRounds = new Set(
    alpha.files.submissions.rows
      .filter((row) => row.spotifyUri === "spotify:track:semantic-repeat")
      .map((row) => row.sourceRoundId),
  );
  assert.deepEqual([...repeatRounds].sort(), [
    "alpha-round-02",
    "semantic-game-alpha",
  ]);

  const openWindowUris = new Set(
    allSubmissions
      .filter((row) => row.title === "Open Window")
      .map((row) => row.spotifyUri),
  );
  assert.equal(openWindowUris.size, 2);

  const familiarFacesUris = new Set(
    allSubmissions
      .filter((row) => row.artistName === "Familiar Faces")
      .map((row) => row.spotifyUri),
  );
  assert.equal(familiarFacesUris.size, 2);
  assert.equal(
    allSubmissions.some(
      (row) => row.artistName === "Familiar Faces feat. Guest Ray",
    ),
    true,
  );

  assert.equal(allVotes.some((row) => row.pointsAssigned < 0), true);
  assert.equal(
    allVotes.some(
      (row) =>
        row.sourceVoterId &&
        row.spotifyUri &&
        Number.isInteger(row.pointsAssigned) &&
        row.comment,
    ),
    true,
  );
  assert.equal(allSubmissions.some((row) => row.comment), true);
  assert.equal(allVotes.some((row) => row.comment), true);
  assert.equal(allSubmissions.some((row) => row.visibleToVoters), true);
  assert.equal(allSubmissions.some((row) => !row.visibleToVoters), true);

  const votedSubmissionKeys = new Set(allVotes.map(getSubmissionKey));
  assert.equal(
    allSubmissions.some(
      (row) =>
        row.spotifyUri === "spotify:track:semantic-unvoted-alpha" &&
        !votedSubmissionKeys.has(getSubmissionKey(row)),
    ),
    true,
  );

  const alphaStandings = deriveScoredStandings(alpha);
  assert.deepEqual(alphaStandings[0], {
    sourceSubmitterId: "alpha-alice",
    totalScore: 11,
    scoredSubmissionCount: 2,
    scoredRoundCount: 2,
    rank: 1,
    tied: false,
  });
  assert.deepEqual(
    alphaStandings.find((row) => row.sourceSubmitterId === "alpha-cara"),
    {
      sourceSubmitterId: "alpha-cara",
      totalScore: 4,
      scoredSubmissionCount: 1,
      scoredRoundCount: 1,
      rank: 4,
      tied: false,
    },
  );

  const bravoStandings = deriveScoredStandings(bravo);
  assert.deepEqual(bravoStandings.slice(0, 2), [
    {
      sourceSubmitterId: "bravo-ava",
      totalScore: 4,
      scoredSubmissionCount: 1,
      scoredRoundCount: 1,
      rank: 1,
      tied: true,
    },
    {
      sourceSubmitterId: "bravo-ben",
      totalScore: 4,
      scoredSubmissionCount: 1,
      scoredRoundCount: 1,
      rank: 1,
      tied: true,
    },
  ]);
  assert.deepEqual(
    bravoStandings.find((row) => row.sourceSubmitterId === "bravo-dee"),
    {
      sourceSubmitterId: "bravo-dee",
      totalScore: 2,
      scoredSubmissionCount: 1,
      scoredRoundCount: 1,
      rank: 2,
      tied: false,
    },
  );
  assert.equal(
    bravoStandings.some((row) => row.sourceSubmitterId === "bravo-cy"),
    false,
  );
});

test("semantic fixtures define contested M6 read-model contracts", () => {
  const fixtures = parseManifestFixtures();
  const alpha = findFixture(fixtures, "semantic-game-alpha");
  const bravo = findFixture(fixtures, "semantic-game-bravo");

  assertContractPostures();
  assertNoPersistedStandingsTable();

  const alphaBreakdown = buildRoundDetailVoteBreakdown(
    alpha,
    "semantic-game-alpha",
  );
  assert.deepEqual(
    alphaBreakdown.find((row) => row.voteComment === "Downvote edge"),
    {
      sourceVoterId: "alpha-dev",
      targetSubmission: {
        spotifyUri: "spotify:track:semantic-repeat",
        title: "Silver Lines",
        artistName: "Mono Echo",
        sourceSubmitterId: "alpha-alice",
        comment: "Submission comment repeat",
      },
      pointsAssigned: -1,
      voteComment: "Downvote edge",
    },
  );
  assert.notEqual(
    alphaBreakdown.find((row) => row.voteComment === "Downvote edge")
      .targetSubmission.comment,
    alphaBreakdown.find((row) => row.voteComment === "Downvote edge")
      .voteComment,
  );

  assert.deepEqual(summarizePlayerPerformanceEvidence(alpha, "alpha-alice"), {
    sourceSubmitterId: "alpha-alice",
    denominator: "scored submissions",
    scoredSubmissionCount: 2,
    submittedRoundCount: 2,
    scoredRoundCount: 2,
    finishPercentiles: [0, 0.5],
    minimumSample: 1,
    scoreVariancePosture:
      "raw descriptive context only; never explains source settings",
    smallSampleCopy:
      "one scored submission may describe that result without durable-tendency language",
    multiSubmitHandling:
      "submission claims count every scored submission; submitted-round claims use a distinct round count",
  });
  assert.deepEqual(summarizePlayerPerformanceEvidence(bravo, "bravo-dee"), {
    sourceSubmitterId: "bravo-dee",
    denominator: "scored submissions",
    scoredSubmissionCount: 1,
    submittedRoundCount: 1,
    scoredRoundCount: 1,
    finishPercentiles: [0],
    minimumSample: 1,
    scoreVariancePosture:
      "raw descriptive context only; never explains source settings",
    smallSampleCopy:
      "one scored submission may describe that result without durable-tendency language",
    multiSubmitHandling:
      "submission claims count every scored submission; submitted-round claims use a distinct round count",
  });

  assert.equal(
    normalizeArtistIdentity("Familiar Faces"),
    normalizeArtistIdentity(" Familiar Faces "),
  );
  assert.notEqual(
    normalizeArtistIdentity("Familiar Faces"),
    normalizeArtistIdentity("Familiar Faces feat. Guest Ray"),
  );

  for (const origin of STALE_MODAL_ORIGIN_CONTEXTS) {
    const parsed = findFixture(fixtures, origin.fixtureName);

    assert.equal(resolveSubmissionOrigin(parsed, origin), null);
    assert.equal(origin.expectedState, "unresolvable-origin-context");
    assert.equal(
      parsed.files.submissions.rows.some(
        (submission) => submission.spotifyUri === origin.spotifyUri,
      ),
      true,
    );
  }
});
