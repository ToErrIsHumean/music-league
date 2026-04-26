const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { PrismaClient } = require("@prisma/client");

const { analyzeImportBatch } = require("./analyze-batch");
const { commitImportBatch } = require("./commit-batch");
const { getImportBatchSummary } = require("./get-batch-summary");
const { listImportBatchIssues } = require("./list-batch-issues");
const { listImportBatches } = require("./list-batches");
const { parseMusicLeagueBundle } = require("./parse-bundle");
const { stageImportBundle } = require("./stage-batch");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const inheritedEnvKeys = [
  "PATH",
  "Path",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "SystemRoot",
  "ComSpec",
  "TMPDIR",
  "TEMP",
  "TMP",
];
const fixtureRoot = path.join(__dirname, "test-fixtures");
const semanticFixtureManifestPath = path.join(
  fixtureRoot,
  "semantic-fixture-manifest.json",
);

const SEMANTIC_FIXTURE_BEHAVIORS = [
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

function createPrismaEnv(databaseUrl) {
  const env = { DATABASE_URL: databaseUrl };

  for (const key of inheritedEnvKeys) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }

  return env;
}

function getFixturePath(name) {
  return path.join(fixtureRoot, name);
}

function readSemanticFixtureManifest() {
  return JSON.parse(fs.readFileSync(semanticFixtureManifestPath, "utf8"));
}

function deriveStandingsFromSubmissions(submissions) {
  const byPlayer = new Map();

  for (const submission of submissions) {
    if (submission.score === null || submission.rank === null) {
      continue;
    }

    const row = byPlayer.get(submission.player.sourcePlayerId) ?? {
      sourcePlayerId: submission.player.sourcePlayerId,
      totalScore: 0,
      scoredSubmissionCount: 0,
    };

    row.totalScore += submission.score;
    row.scoredSubmissionCount += 1;
    byPlayer.set(row.sourcePlayerId, row);
  }

  return [...byPlayer.values()].sort(
    (left, right) =>
      right.totalScore - left.totalScore ||
      left.sourcePlayerId.localeCompare(right.sourcePlayerId),
  );
}

async function withTestDatabase(run) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-workflow-db-"),
  );
  const databasePath = path.join(tempDir, "workflow.sqlite");
  const databaseUrl = `file:${databasePath}`;

  execFileSync(prismaCommand, ["migrate", "deploy"], {
    cwd: repoRoot,
    env: createPrismaEnv(databaseUrl),
    stdio: "pipe",
  });

  const prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
  });

  try {
    await run(prisma);
  } finally {
    await prisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function parseStageAnalyzeBundle(bundleName, prisma) {
  const bundlePath = getFixturePath(bundleName);
  const parsedBundle = parseMusicLeagueBundle({ bundlePath });
  const staged = await stageImportBundle({ parsedBundle, prisma });
  const analyzed = await analyzeImportBatch(staged.batchId, { prisma });

  return {
    bundlePath,
    parsedBundle,
    staged,
    analyzed,
  };
}

async function commitReadyBundle(bundleName, prisma, committedAt) {
  const stagedBundle = await parseStageAnalyzeBundle(bundleName, prisma);

  assert.equal(stagedBundle.analyzed.status, "ready");

  const committed = await commitImportBatch(stagedBundle.staged.batchId, {
    prisma,
    now: () => committedAt,
  });

  return {
    ...stagedBundle,
    committed,
  };
}

async function getCanonicalCounts(prisma) {
  const [players, rounds, artists, songs, submissions, votes] = await Promise.all([
    prisma.player.count(),
    prisma.round.count(),
    prisma.artist.count(),
    prisma.song.count(),
    prisma.submission.count(),
    prisma.vote.count(),
  ]);

  return {
    players,
    rounds,
    artists,
    songs,
    submissions,
    votes,
  };
}

test(
  "runs a clean fixture bundle through parse, stage, analyze, summary, history, and commit",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const bundlePath = getFixturePath("clean-bundle");
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      assert.equal(parsedBundle.sourceLabel, path.basename(bundlePath));
      assert.equal(parsedBundle.gameKey, "game-clean");
      assert.deepEqual(parsedBundle.issues, []);
      assert.deepEqual(
        {
          competitors: parsedBundle.files.competitors.rowCount,
          rounds: parsedBundle.files.rounds.rowCount,
          submissions: parsedBundle.files.submissions.rowCount,
          votes: parsedBundle.files.votes.rowCount,
        },
        {
          competitors: 3,
          rounds: 1,
          submissions: 3,
          votes: 2,
        },
      );

      const staged = await stageImportBundle({ parsedBundle, prisma });

      assert.deepEqual(staged, {
        batchId: staged.batchId,
        gameKey: "game-clean",
        status: "parsed",
        rowCounts: {
          competitors: 3,
          rounds: 1,
          submissions: 3,
          votes: 2,
          total: 9,
        },
      });

      const [parsedSummary, sourceFiles] = await Promise.all([
        getImportBatchSummary(staged.batchId, { prisma }),
        prisma.importSourceFile.findMany({
          where: {
            importBatchId: staged.batchId,
          },
          orderBy: {
            fileKind: "asc",
          },
        }),
      ]);

      assert.equal(parsedSummary.status, "parsed");
      assert.deepEqual(parsedSummary.workflow, {
        stages: {
          parse: "complete",
          stage: "complete",
          validate: "current",
          commit: "pending",
        },
        awaiting: "system",
      });
      assert.deepEqual(parsedSummary.rowCounts, {
        competitors: 3,
        rounds: 1,
        submissions: 3,
        votes: 2,
        total: 9,
      });
      assert.deepEqual(
        sourceFiles.map((file) => ({
          fileKind: file.fileKind,
          filename: file.filename,
          rowCount: file.rowCount,
        })),
        [
          {
            fileKind: "competitors",
            filename: "competitors.csv",
            rowCount: 3,
          },
          {
            fileKind: "rounds",
            filename: "rounds.csv",
            rowCount: 1,
          },
          {
            fileKind: "submissions",
            filename: "submissions.csv",
            rowCount: 3,
          },
          {
            fileKind: "votes",
            filename: "votes.csv",
            rowCount: 2,
          },
        ],
      );

      const analyzed = await analyzeImportBatch(staged.batchId, { prisma });
      const [issues, readySummary, readyHistory, preCommitCounts] = await Promise.all([
        listImportBatchIssues(staged.batchId, { prisma }),
        getImportBatchSummary(staged.batchId, { prisma }),
        listImportBatches({ prisma }),
        getCanonicalCounts(prisma),
      ]);

      assert.deepEqual(analyzed, {
        batchId: staged.batchId,
        status: "ready",
        summary: {
          matchedPlayers: 0,
          createdPlayers: 3,
          matchedRounds: 0,
          createdRounds: 1,
          matchedSongs: 0,
          createdSongs: 3,
          matchedArtists: 0,
          createdArtists: 3,
          openBlockingIssues: 0,
        },
      });
      assert.deepEqual(issues, []);
      assert.equal(readySummary.status, "ready");
      assert.deepEqual(readySummary.workflow, {
        stages: {
          parse: "complete",
          stage: "complete",
          validate: "complete",
          commit: "pending",
        },
        awaiting: "none",
      });
      assert.deepEqual(readySummary.committedEntityCounts, {
        players: 0,
        rounds: 0,
        artists: 0,
        songs: 0,
        submissionsUpserted: 0,
        votesUpserted: 0,
      });
      assert.deepEqual(preCommitCounts, {
        players: 0,
        rounds: 0,
        artists: 0,
        songs: 0,
        submissions: 0,
        votes: 0,
      });
      assert.deepEqual(readyHistory, [
        {
          batchId: staged.batchId,
          gameKey: "game-clean",
          sourceFilename: "clean-bundle",
          status: "ready",
          rowCount: 9,
          issueCount: 0,
          createdCounts: {
            players: 0,
            rounds: 0,
            artists: 0,
            songs: 0,
            submissionsUpserted: 0,
            votesUpserted: 0,
          },
          committedAt: null,
          failureStage: null,
          failureSummary: null,
          createdAt: readyHistory[0].createdAt,
          updatedAt: readyHistory[0].updatedAt,
        },
      ]);
      assert.equal(readyHistory[0].createdAt instanceof Date, true);
      assert.equal(readyHistory[0].updatedAt instanceof Date, true);

      const committedAt = new Date("2026-04-17T09:00:00.000Z");
      const committed = await commitImportBatch(staged.batchId, {
        prisma,
        now: () => committedAt,
      });

      const [committedSummary, committedHistory, counts, game, round, submissions, votes] =
        await Promise.all([
          getImportBatchSummary(staged.batchId, { prisma }),
          listImportBatches({
            statuses: ["committed"],
            prisma,
          }),
          getCanonicalCounts(prisma),
          prisma.game.findUniqueOrThrow({
            where: {
              sourceGameId: "game-clean",
            },
          }),
          prisma.round.findFirstOrThrow({
            where: {
              leagueSlug: "game-clean",
              sourceRoundId: "game-clean",
            },
            include: {
              game: {
                select: {
                  sourceGameId: true,
                },
              },
            },
          }),
          prisma.submission.findMany({
            include: {
              player: {
                select: {
                  sourcePlayerId: true,
                },
              },
              song: {
                select: {
                  spotifyUri: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          }),
          prisma.vote.findMany({
            include: {
              voter: {
                select: {
                  sourcePlayerId: true,
                },
              },
              song: {
                select: {
                  spotifyUri: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          }),
        ]);

      assert.deepEqual(committed, {
        batchId: staged.batchId,
        status: "committed",
        canonicalWrites: {
          playersCreated: 3,
          roundsCreated: 1,
          artistsCreated: 3,
          songsCreated: 3,
          submissionsUpserted: 3,
          votesUpserted: 2,
        },
        affectedRoundIds: [round.id],
      });
      assert.equal(committedSummary.status, "committed");
      assert.deepEqual(committedSummary.workflow, {
        stages: {
          parse: "complete",
          stage: "complete",
          validate: "complete",
          commit: "complete",
        },
        awaiting: "none",
      });
      assert.deepEqual(committedSummary.committedEntityCounts, {
        players: 3,
        rounds: 1,
        artists: 3,
        songs: 3,
        submissionsUpserted: 3,
        votesUpserted: 2,
      });
      assert.deepEqual(committedSummary.affectedRounds, [round.id]);
      assert.deepEqual(committedHistory[0].createdCounts, {
        players: 3,
        rounds: 1,
        artists: 3,
        songs: 3,
        submissionsUpserted: 3,
        votesUpserted: 2,
      });
      assert.equal(
        committedHistory[0].committedAt?.toISOString(),
        committedAt.toISOString(),
      );
      assert.deepEqual(counts, {
        players: 3,
        rounds: 1,
        artists: 3,
        songs: 3,
        submissions: 3,
        votes: 2,
      });
      assert.deepEqual(
        {
          sourceGameId: game.sourceGameId,
          displayName: game.displayName,
        },
        {
          sourceGameId: "game-clean",
          displayName: "clean-bundle",
        },
      );
      assert.equal(round.game.sourceGameId, round.leagueSlug);
      assert.deepEqual(
        Object.fromEntries(
          submissions.map((submission) => [
            submission.song.spotifyUri,
            {
              player: submission.player.sourcePlayerId,
              score: submission.score,
              rank: submission.rank,
              sourceImportId: submission.sourceImportId,
            },
          ]),
        ),
        {
          "spotify:track:1": {
            player: "player-1",
            score: 3,
            rank: 1,
            sourceImportId: staged.batchId,
          },
          "spotify:track:2": {
            player: "player-2",
            score: -1,
            rank: 2,
            sourceImportId: staged.batchId,
          },
          "spotify:track:3": {
            player: "player-3",
            score: null,
            rank: null,
            sourceImportId: staged.batchId,
          },
        },
      );
      assert.deepEqual(
        Object.fromEntries(
          votes.map((vote) => [
            vote.song.spotifyUri,
            {
              voter: vote.voter.sourcePlayerId,
              pointsAssigned: vote.pointsAssigned,
              sourceImportId: vote.sourceImportId,
            },
          ]),
        ),
        {
          "spotify:track:1": {
            voter: "player-2",
            pointsAssigned: 3,
            sourceImportId: staged.batchId,
          },
          "spotify:track:2": {
            voter: "player-1",
            pointsAssigned: -1,
            sourceImportId: staged.batchId,
          },
        },
      );
    });
  },
);

test(
  "surfaces missing required files and headers through issues, summary, history, and commit rejection",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const bundlePath = getFixturePath("missing-required-bundle");
      const parsedBundle = parseMusicLeagueBundle({ bundlePath });

      assert.equal(parsedBundle.gameKey, "game-missing");
      assert.deepEqual(
        parsedBundle.issues.map((issue) => issue.issueCode),
        ["missing_header", "missing_file"],
      );

      const staged = await stageImportBundle({ parsedBundle, prisma });
      const analyzed = await analyzeImportBatch(staged.batchId, { prisma });
      const issues = await listImportBatchIssues(staged.batchId, { prisma });
      const summary = await getImportBatchSummary(staged.batchId, { prisma });
      const history = await listImportBatches({ prisma });

      assert.deepEqual(staged.rowCounts, {
        competitors: 0,
        rounds: 1,
        submissions: 0,
        votes: 0,
        total: 1,
      });
      assert.equal(analyzed.status, "failed");
      assert.equal(analyzed.summary.openBlockingIssues, 2);
      assert.deepEqual(
        issues.map((issue) => ({
          sourceFileKind: issue.sourceFileKind,
          issueCode: issue.issueCode,
          blocking: issue.blocking,
          rowPreview: issue.rowPreview,
        })),
        [
          {
            sourceFileKind: "competitors",
            issueCode: "missing_header",
            blocking: true,
            rowPreview: {},
          },
          {
            sourceFileKind: "votes",
            issueCode: "missing_file",
            blocking: true,
            rowPreview: {},
          },
        ],
      );
      assert.equal(summary.status, "failed");
      assert.deepEqual(summary.workflow, {
        stages: {
          parse: "complete",
          stage: "complete",
          validate: "current",
          commit: "pending",
        },
        awaiting: "none",
      });
      assert.deepEqual(summary.rowCounts, {
        competitors: 1,
        rounds: 1,
        submissions: 0,
        votes: 0,
        total: 1,
      });
      assert.equal(summary.failureStage, "validate");
      assert.equal(summary.failureSummary, "Validation found 2 blocking issue(s)");
      assert.equal(history.length, 1);
      assert.equal(history[0].status, "failed");
      assert.equal(history[0].issueCount, 2);
      assert.equal(history[0].failureStage, "validate");
      assert.equal(history[0].failureSummary, "Validation found 2 blocking issue(s)");

      await assert.rejects(
        () => commitImportBatch(staged.batchId, { prisma }),
        /commitImportBatch: batch status is not ready: /,
      );

      assert.deepEqual(await getCanonicalCounts(prisma), {
        players: 0,
        rounds: 0,
        artists: 0,
        songs: 0,
        submissions: 0,
        votes: 0,
      });
    });
  },
);

test(
  "surfaces duplicate-source-row and unresolved vote failures through the service boundaries",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const { staged, analyzed } = await parseStageAnalyzeBundle(
        "unresolved-duplicate-bundle",
        prisma,
      );
      const issues = await listImportBatchIssues(staged.batchId, { prisma });
      const summary = await getImportBatchSummary(staged.batchId, { prisma });
      const history = await listImportBatches({
        statuses: ["failed"],
        prisma,
      });

      assert.equal(analyzed.status, "failed");
      assert.equal(analyzed.summary.openBlockingIssues, 2);
      assert.deepEqual(
        issues.map((issue) => ({
          sourceRowNumber: issue.sourceRowNumber,
          issueCode: issue.issueCode,
          rowPreview: issue.rowPreview,
        })),
        [
          {
            sourceRowNumber: 2,
            issueCode: "unresolved_ref",
            rowPreview: {
              sourceRoundId: "game-failed",
              sourceVoterId: "player-2",
              spotifyUri: "spotify:track:2",
              rawPointsAssigned: 3,
              rawComment: null,
              rawVotedAt: "2026-04-04T06:18:48.000Z",
              recordStatus: "blocked",
              matchedSongId: null,
              matchedVoterId: null,
              matchedRoundId: null,
            },
          },
          {
            sourceRowNumber: 3,
            issueCode: "duplicate_source_row",
            rowPreview: {
              "Spotify URI": "spotify:track:2",
              "Voter ID": "player-2",
              Created: "2026-04-04T06:19:48Z",
              "Points Assigned": "5",
              Comment: "Duplicate row",
              "Round ID": "game-failed",
            },
          },
        ],
      );
      assert.equal(summary.status, "failed");
      assert.deepEqual(summary.rowCounts, {
        competitors: 2,
        rounds: 1,
        submissions: 1,
        votes: 2,
        total: 5,
      });
      assert.equal(summary.failureStage, "validate");
      assert.equal(summary.failureSummary, "Validation found 2 blocking issue(s)");
      assert.equal(history.length, 1);
      assert.equal(history[0].status, "failed");
      assert.equal(history[0].issueCount, 2);

      await assert.rejects(
        () => commitImportBatch(staged.batchId, { prisma }),
        /commitImportBatch: batch status is not ready: /,
      );

      assert.deepEqual(await getCanonicalCounts(prisma), {
        players: 0,
        rounds: 0,
        artists: 0,
        songs: 0,
        submissions: 0,
        votes: 0,
      });
    });
  },
);

test(
  "commits semantic fixtures as game-scoped completed snapshots without source-setting inference",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const semanticManifest = readSemanticFixtureManifest();
      const coveredBehaviors = new Set();

      assert.deepEqual(
        semanticManifest.map((entry) => entry.fixtureName).sort(),
        ["semantic-game-alpha", "semantic-game-bravo"],
      );

      for (const entry of semanticManifest) {
        assert.deepEqual(entry.files, [
          "competitors.csv",
          "rounds.csv",
          "submissions.csv",
          "votes.csv",
        ]);
        assert.deepEqual(entry.covers.sort(), [
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
        ]);

        for (const behavior of entry.behaviors) {
          coveredBehaviors.add(behavior);
        }
      }

      assert.deepEqual(
        [...coveredBehaviors].sort(),
        [...SEMANTIC_FIXTURE_BEHAVIORS].sort(),
      );

      const alphaFirst = await commitReadyBundle(
        "semantic-game-alpha",
        prisma,
        new Date("2026-04-24T10:00:00.000Z"),
      );
      const alphaCounts = await getCanonicalCounts(prisma);
      const alphaReplay = await commitReadyBundle(
        "semantic-game-alpha",
        prisma,
        new Date("2026-04-24T10:30:00.000Z"),
      );
      const alphaReplayCounts = await getCanonicalCounts(prisma);
      const bravo = await commitReadyBundle(
        "semantic-game-bravo",
        prisma,
        new Date("2026-04-24T11:00:00.000Z"),
      );

      assert.deepEqual(alphaFirst.committed.canonicalWrites, {
        playersCreated: 5,
        roundsCreated: 2,
        artistsCreated: 6,
        songsCreated: 7,
        submissionsUpserted: 8,
        votesUpserted: 15,
      });
      assert.deepEqual(alphaReplay.committed.canonicalWrites, {
        playersCreated: 0,
        roundsCreated: 0,
        artistsCreated: 0,
        songsCreated: 0,
        submissionsUpserted: 8,
        votesUpserted: 15,
      });
      assert.deepEqual(alphaReplayCounts, alphaCounts);
      assert.deepEqual(bravo.committed.canonicalWrites, {
        playersCreated: 4,
        roundsCreated: 2,
        artistsCreated: 4,
        songsCreated: 4,
        submissionsUpserted: 4,
        votesUpserted: 4,
      });

      const [games, overlappingRounds, hiddenSubmissions, unscoredSubmissions, negativeVotes, finalCounts] =
        await Promise.all([
          prisma.game.findMany({
            include: {
              rounds: {
                orderBy: {
                  sourceRoundId: "asc",
                },
                select: {
                  id: true,
                  gameId: true,
                  leagueSlug: true,
                  sourceRoundId: true,
                  name: true,
                },
              },
            },
            orderBy: {
              sourceGameId: "asc",
            },
          }),
          prisma.round.findMany({
            where: {
              name: {
                in: ["Night Drive", "Shared Finale"],
              },
            },
            include: {
              game: {
                select: {
                  sourceGameId: true,
                },
              },
            },
            orderBy: [
              {
                name: "asc",
              },
              {
                leagueSlug: "asc",
              },
            ],
          }),
          prisma.submission.findMany({
            where: {
              visibleToVoters: false,
            },
            include: {
              player: {
                select: {
                  sourcePlayerId: true,
                },
              },
              round: {
                select: {
                  leagueSlug: true,
                  sourceRoundId: true,
                },
              },
              song: {
                select: {
                  spotifyUri: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          }),
          prisma.submission.findMany({
            where: {
              score: null,
              rank: null,
            },
            include: {
              player: {
                select: {
                  sourcePlayerId: true,
                },
              },
              song: {
                select: {
                  spotifyUri: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          }),
          prisma.vote.findMany({
            where: {
              pointsAssigned: {
                lt: 0,
              },
            },
            include: {
              round: {
                select: {
                  leagueSlug: true,
                  sourceRoundId: true,
                },
              },
              voter: {
                select: {
                  sourcePlayerId: true,
                },
              },
              song: {
                select: {
                  spotifyUri: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          }),
          getCanonicalCounts(prisma),
        ]);

      assert.deepEqual(finalCounts, {
        players: 9,
        rounds: 4,
        artists: 10,
        songs: 11,
        submissions: 12,
        votes: 19,
      });
      assert.deepEqual(
        games.map((game) => ({
          sourceGameId: game.sourceGameId,
          rounds: game.rounds.map((round) => ({
            gameIdMatchesParent: round.gameId === game.id,
            leagueSlug: round.leagueSlug,
            sourceRoundId: round.sourceRoundId,
            name: round.name,
          })),
        })),
        [
          {
            sourceGameId: "semantic-game-alpha",
            rounds: [
              {
                gameIdMatchesParent: true,
                leagueSlug: "semantic-game-alpha",
                sourceRoundId: "alpha-round-02",
                name: "Shared Finale",
              },
              {
                gameIdMatchesParent: true,
                leagueSlug: "semantic-game-alpha",
                sourceRoundId: "semantic-game-alpha",
                name: "Night Drive",
              },
            ],
          },
          {
            sourceGameId: "semantic-game-bravo",
            rounds: [
              {
                gameIdMatchesParent: true,
                leagueSlug: "semantic-game-bravo",
                sourceRoundId: "bravo-round-02",
                name: "Shared Finale",
              },
              {
                gameIdMatchesParent: true,
                leagueSlug: "semantic-game-bravo",
                sourceRoundId: "semantic-game-bravo",
                name: "Night Drive",
              },
            ],
          },
        ],
      );
      assert.deepEqual(
        overlappingRounds.map((round) => ({
          gameSourceGameId: round.game.sourceGameId,
          leagueSlug: round.leagueSlug,
          sourceRoundId: round.sourceRoundId,
          name: round.name,
        })),
        [
          {
            gameSourceGameId: "semantic-game-alpha",
            leagueSlug: "semantic-game-alpha",
            sourceRoundId: "semantic-game-alpha",
            name: "Night Drive",
          },
          {
            gameSourceGameId: "semantic-game-bravo",
            leagueSlug: "semantic-game-bravo",
            sourceRoundId: "semantic-game-bravo",
            name: "Night Drive",
          },
          {
            gameSourceGameId: "semantic-game-alpha",
            leagueSlug: "semantic-game-alpha",
            sourceRoundId: "alpha-round-02",
            name: "Shared Finale",
          },
          {
            gameSourceGameId: "semantic-game-bravo",
            leagueSlug: "semantic-game-bravo",
            sourceRoundId: "bravo-round-02",
            name: "Shared Finale",
          },
        ],
      );
      assert.deepEqual(
        hiddenSubmissions.map((submission) => ({
          gameKey: submission.round.leagueSlug,
          sourceRoundId: submission.round.sourceRoundId,
          sourcePlayerId: submission.player.sourcePlayerId,
          spotifyUri: submission.song.spotifyUri,
        })),
        [
          {
            gameKey: "semantic-game-alpha",
            sourceRoundId: "semantic-game-alpha",
            sourcePlayerId: "alpha-bob",
            spotifyUri: "spotify:track:semantic-title-a",
          },
          {
            gameKey: "semantic-game-alpha",
            sourceRoundId: "alpha-round-02",
            sourcePlayerId: "alpha-alice",
            spotifyUri: "spotify:track:semantic-multi-label",
          },
          {
            gameKey: "semantic-game-bravo",
            sourceRoundId: "semantic-game-bravo",
            sourcePlayerId: "bravo-ben",
            spotifyUri: "spotify:track:bravo-tie-two",
          },
        ],
      );
      assert.deepEqual(
        unscoredSubmissions.map((submission) => ({
          sourcePlayerId: submission.player.sourcePlayerId,
          spotifyUri: submission.song.spotifyUri,
        })),
        [
          {
            sourcePlayerId: "alpha-cara",
            spotifyUri: "spotify:track:semantic-unvoted-alpha",
          },
          {
            sourcePlayerId: "bravo-cy",
            spotifyUri: "spotify:track:bravo-unvoted",
          },
        ],
      );
      assert.deepEqual(
        negativeVotes.map((vote) => ({
          gameKey: vote.round.leagueSlug,
          sourceRoundId: vote.round.sourceRoundId,
          sourceVoterId: vote.voter.sourcePlayerId,
          spotifyUri: vote.song.spotifyUri,
          pointsAssigned: vote.pointsAssigned,
          comment: vote.comment,
        })),
        [
          {
            gameKey: "semantic-game-alpha",
            sourceRoundId: "semantic-game-alpha",
            sourceVoterId: "alpha-dev",
            spotifyUri: "spotify:track:semantic-repeat",
            pointsAssigned: -1,
            comment: "Downvote edge",
          },
          {
            gameKey: "semantic-game-alpha",
            sourceRoundId: "alpha-round-02",
            sourceVoterId: "alpha-cara",
            spotifyUri: "spotify:track:semantic-artist-b",
            pointsAssigned: -1,
            comment: "Negative points remain source fact",
          },
        ],
      );

      const [
        titleCollisionSongs,
        familiarFacesArtists,
        submissionComment,
        voteComment,
        alphaScoredSubmissions,
        bravoScoredSubmissions,
        sparseHistorySubmissions,
        staleOriginRound,
        staleOriginSong,
      ] = await Promise.all([
        prisma.song.findMany({
          where: {
            title: "Open Window",
          },
          include: {
            artist: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            spotifyUri: "asc",
          },
        }),
        prisma.artist.findMany({
          where: {
            name: {
              in: ["Familiar Faces", "Familiar Faces feat. Guest Ray"],
            },
          },
          include: {
            songs: {
              select: {
                spotifyUri: true,
                title: true,
              },
              orderBy: {
                spotifyUri: "asc",
              },
            },
          },
          orderBy: {
            name: "asc",
          },
        }),
        prisma.submission.findFirst({
          where: {
            comment: "Submission comment repeat",
          },
          include: {
            song: {
              select: {
                spotifyUri: true,
              },
            },
            player: {
              select: {
                sourcePlayerId: true,
              },
            },
          },
        }),
        prisma.vote.findFirst({
          where: {
            comment: "Downvote edge",
          },
          include: {
            song: {
              select: {
                spotifyUri: true,
              },
            },
            voter: {
              select: {
                sourcePlayerId: true,
              },
            },
          },
        }),
        prisma.submission.findMany({
          where: {
            score: {
              not: null,
            },
            rank: {
              not: null,
            },
            round: {
              game: {
                sourceGameId: "semantic-game-alpha",
              },
            },
          },
          include: {
            player: {
              select: {
                sourcePlayerId: true,
              },
            },
          },
        }),
        prisma.submission.findMany({
          where: {
            score: {
              not: null,
            },
            rank: {
              not: null,
            },
            round: {
              game: {
                sourceGameId: "semantic-game-bravo",
              },
            },
          },
          include: {
            player: {
              select: {
                sourcePlayerId: true,
              },
            },
          },
        }),
        prisma.submission.findMany({
          where: {
            player: {
              sourcePlayerId: "bravo-dee",
            },
          },
          select: {
            score: true,
            rank: true,
            song: {
              select: {
                spotifyUri: true,
              },
            },
          },
        }),
        prisma.round.findFirst({
          where: {
            sourceRoundId: "retired-alpha-round",
          },
        }),
        prisma.song.findUnique({
          where: {
            spotifyUri: "spotify:track:semantic-repeat",
          },
        }),
      ]);

      assert.deepEqual(
        titleCollisionSongs.map((song) => ({
          idPresent: Number.isInteger(song.id),
          spotifyUri: song.spotifyUri,
          title: song.title,
          artistName: song.artist.name,
        })),
        [
          {
            idPresent: true,
            spotifyUri: "spotify:track:semantic-title-a",
            title: "Open Window",
            artistName: "The Lanterns",
          },
          {
            idPresent: true,
            spotifyUri: "spotify:track:semantic-title-b",
            title: "Open Window",
            artistName: "North Pier",
          },
        ],
      );
      assert.notEqual(titleCollisionSongs[0].id, titleCollisionSongs[1].id);
      assert.deepEqual(
        familiarFacesArtists.map((artist) => ({
          name: artist.name,
          songs: artist.songs,
        })),
        [
          {
            name: "Familiar Faces",
            songs: [
              {
                spotifyUri: "spotify:track:semantic-artist-a",
                title: "Paper Signal",
              },
              {
                spotifyUri: "spotify:track:semantic-artist-b",
                title: "Paper Signal Two",
              },
            ],
          },
          {
            name: "Familiar Faces feat. Guest Ray",
            songs: [
              {
                spotifyUri: "spotify:track:semantic-multi-label",
                title: "Signal Boost",
              },
            ],
          },
        ],
      );
      assert.deepEqual(
        {
          submissionComment: {
            sourcePlayerId: submissionComment.player.sourcePlayerId,
            spotifyUri: submissionComment.song.spotifyUri,
            comment: submissionComment.comment,
          },
          voteComment: {
            sourceVoterId: voteComment.voter.sourcePlayerId,
            spotifyUri: voteComment.song.spotifyUri,
            comment: voteComment.comment,
          },
        },
        {
          submissionComment: {
            sourcePlayerId: "alpha-alice",
            spotifyUri: "spotify:track:semantic-repeat",
            comment: "Submission comment repeat",
          },
          voteComment: {
            sourceVoterId: "alpha-dev",
            spotifyUri: "spotify:track:semantic-repeat",
            comment: "Downvote edge",
          },
        },
      );
      assert.notEqual(submissionComment.comment, voteComment.comment);

      const alphaStandings = deriveStandingsFromSubmissions(
        alphaScoredSubmissions,
      );
      const bravoStandings = deriveStandingsFromSubmissions(
        bravoScoredSubmissions,
      );

      assert.deepEqual(alphaStandings.slice(0, 2), [
        {
          sourcePlayerId: "alpha-alice",
          totalScore: 11,
          scoredSubmissionCount: 2,
        },
        {
          sourcePlayerId: "alpha-erin",
          totalScore: 7,
          scoredSubmissionCount: 1,
        },
      ]);
      assert.equal(
        alphaStandings[0].totalScore > alphaStandings[1].totalScore,
        true,
      );
      assert.deepEqual(bravoStandings.slice(0, 2), [
        {
          sourcePlayerId: "bravo-ava",
          totalScore: 4,
          scoredSubmissionCount: 1,
        },
        {
          sourcePlayerId: "bravo-ben",
          totalScore: 4,
          scoredSubmissionCount: 1,
        },
      ]);
      assert.equal(bravoStandings[0].totalScore, bravoStandings[1].totalScore);
      assert.deepEqual(
        sparseHistorySubmissions.map((submission) => ({
          spotifyUri: submission.song.spotifyUri,
          score: submission.score,
          rank: submission.rank,
        })),
        [
          {
            spotifyUri: "spotify:track:bravo-single",
            score: 2,
            rank: 1,
          },
        ],
      );
      assert.equal(staleOriginRound, null);
      assert.equal(staleOriginSong.spotifyUri, "spotify:track:semantic-repeat");

      for (const batch of [alphaFirst, alphaReplay, bravo]) {
        assert.equal(batch.parsedBundle.gameKey, batch.staged.gameKey);
        assert.equal("voteBudget" in batch.parsedBundle, false);
        assert.equal("deadlinePenalty" in batch.parsedBundle, false);
        assert.equal("lowStakes" in batch.parsedBundle, false);
        assert.equal("downvotesEnabled" in batch.parsedBundle, false);
      }
    });
  },
);

test(
  "replays a later fixture snapshot for the same game without duplicating globals and removes stale game rows",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const first = await parseStageAnalyzeBundle("replay-snapshot-one", prisma);

      assert.equal(first.analyzed.status, "ready");

      const firstCommittedAt = new Date("2026-04-17T10:00:00.000Z");
      const firstCommit = await commitImportBatch(first.staged.batchId, {
        prisma,
        now: () => firstCommittedAt,
      });

      assert.deepEqual(firstCommit.canonicalWrites, {
        playersCreated: 3,
        roundsCreated: 2,
        artistsCreated: 3,
        songsCreated: 3,
        submissionsUpserted: 3,
        votesUpserted: 3,
      });

      const second = await parseStageAnalyzeBundle("replay-snapshot-two", prisma);

      assert.equal(second.analyzed.status, "ready");

      const secondCommittedAt = new Date("2026-04-17T11:00:00.000Z");
      const secondCommit = await commitImportBatch(second.staged.batchId, {
        prisma,
        now: () => secondCommittedAt,
      });

      const [games, rounds, submissions, votes, counts, history, summary] =
        await Promise.all([
          prisma.game.findMany({
            orderBy: {
              sourceGameId: "asc",
            },
          }),
          prisma.round.findMany({
            where: {
              leagueSlug: "game-77",
            },
            include: {
              game: {
                select: {
                  sourceGameId: true,
                },
              },
            },
            orderBy: {
              sourceRoundId: "asc",
            },
          }),
          prisma.submission.findMany({
            include: {
              round: {
                select: {
                  sourceRoundId: true,
                },
              },
              player: {
                select: {
                  sourcePlayerId: true,
                },
              },
              song: {
                select: {
                  spotifyUri: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          }),
          prisma.vote.findMany({
            include: {
              round: {
                select: {
                  sourceRoundId: true,
                },
              },
              voter: {
                select: {
                  sourcePlayerId: true,
                },
              },
              song: {
                select: {
                  spotifyUri: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          }),
          getCanonicalCounts(prisma),
          listImportBatches({
            statuses: ["committed"],
            prisma,
          }),
          getImportBatchSummary(second.staged.batchId, { prisma }),
        ]);

      assert.deepEqual(secondCommit, {
        batchId: second.staged.batchId,
        status: "committed",
        canonicalWrites: {
          playersCreated: 0,
          roundsCreated: 0,
          artistsCreated: 1,
          songsCreated: 1,
          submissionsUpserted: 2,
          votesUpserted: 2,
        },
        affectedRoundIds: [rounds[0].id],
      });
      assert.deepEqual(counts, {
        players: 3,
        rounds: 1,
        artists: 4,
        songs: 4,
        submissions: 2,
        votes: 2,
      });
      assert.deepEqual(
        games.map((game) => ({
          sourceGameId: game.sourceGameId,
          displayName: game.displayName,
        })),
        [
          {
            sourceGameId: "game-77",
            displayName: "replay-snapshot-one",
          },
        ],
      );
      assert.deepEqual(
        rounds.map((round) => ({
          gameSourceGameId: round.game.sourceGameId,
          sourceRoundId: round.sourceRoundId,
          name: round.name,
          description: round.description,
        })),
        [
          {
            gameSourceGameId: "game-77",
            sourceRoundId: "game-77",
            name: "Round A Remix",
            description: "Refreshed round",
          },
        ],
      );
      assert.deepEqual(
        submissions.map((submission) => ({
          round: submission.round.sourceRoundId,
          player: submission.player.sourcePlayerId,
          spotifyUri: submission.song.spotifyUri,
          score: submission.score,
          rank: submission.rank,
          sourceImportId: submission.sourceImportId,
        })),
        [
          {
            round: "game-77",
            player: "player-2",
            spotifyUri: "spotify:track:2",
            score: 7,
            rank: 1,
            sourceImportId: second.staged.batchId,
          },
          {
            round: "game-77",
            player: "player-1",
            spotifyUri: "spotify:track:4",
            score: 1,
            rank: 2,
            sourceImportId: second.staged.batchId,
          },
        ],
      );
      assert.deepEqual(
        votes.map((vote) => ({
          round: vote.round.sourceRoundId,
          voter: vote.voter.sourcePlayerId,
          spotifyUri: vote.song.spotifyUri,
          pointsAssigned: vote.pointsAssigned,
          sourceImportId: vote.sourceImportId,
        })),
        [
          {
            round: "game-77",
            voter: "player-1",
            spotifyUri: "spotify:track:2",
            pointsAssigned: 7,
            sourceImportId: second.staged.batchId,
          },
          {
            round: "game-77",
            voter: "player-2",
            spotifyUri: "spotify:track:4",
            pointsAssigned: 1,
            sourceImportId: second.staged.batchId,
          },
        ],
      );
      assert.deepEqual(
        Object.fromEntries(
          history.map((batch) => [
            batch.batchId,
            {
              status: batch.status,
              createdCounts: batch.createdCounts,
            },
          ]),
        ),
        {
          [first.staged.batchId]: {
            status: "committed",
            createdCounts: {
              players: 3,
              rounds: 2,
              artists: 3,
              songs: 3,
              submissionsUpserted: 3,
              votesUpserted: 3,
            },
          },
          [second.staged.batchId]: {
            status: "committed",
            createdCounts: {
              players: 0,
              rounds: 0,
              artists: 1,
              songs: 1,
              submissionsUpserted: 2,
              votesUpserted: 2,
            },
          },
        },
      );
      assert.equal(summary.status, "committed");
      assert.deepEqual(summary.affectedRounds, [rounds[0].id]);
    });
  },
);

test(
  "marks a batch failed and rolls back canonical writes when a canonical write fails during commit",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const { staged, analyzed } = await parseStageAnalyzeBundle(
        "clean-bundle",
        prisma,
      );

      assert.equal(analyzed.status, "ready");

      const originalTransaction = prisma.$transaction.bind(prisma);
      let canonicalWriteAttempted = false;

      prisma.$transaction = (input, ...args) => {
        if (typeof input !== "function") {
          return originalTransaction(input, ...args);
        }

        return originalTransaction(
          (tx) =>
            input(
              new Proxy(tx, {
                get(target, property, receiver) {
                  if (property === "player") {
                    return new Proxy(target.player, {
                      get(playerTarget, playerProperty, playerReceiver) {
                        if (playerProperty === "create") {
                          return async () => {
                            canonicalWriteAttempted = true;
                            throw new Error("simulated canonical write failure");
                          };
                        }

                        const value = Reflect.get(
                          playerTarget,
                          playerProperty,
                          playerReceiver,
                        );

                        return typeof value === "function"
                          ? value.bind(playerTarget)
                          : value;
                      },
                    });
                  }

                  const value = Reflect.get(target, property, receiver);

                  return typeof value === "function" ? value.bind(target) : value;
                },
              }),
            ),
          ...args,
        );
      };

      try {
        await assert.rejects(
          () => commitImportBatch(staged.batchId, { prisma }),
          /simulated canonical write failure/,
        );
      } finally {
        prisma.$transaction = originalTransaction;
      }

      const [summary, history, counts] = await Promise.all([
        getImportBatchSummary(staged.batchId, { prisma }),
        listImportBatches({
          statuses: ["failed"],
          prisma,
        }),
        getCanonicalCounts(prisma),
      ]);

      assert.equal(canonicalWriteAttempted, true);
      assert.equal(summary.status, "failed");
      assert.deepEqual(summary.workflow, {
        stages: {
          parse: "complete",
          stage: "complete",
          validate: "complete",
          commit: "current",
        },
        awaiting: "none",
      });
      assert.equal(summary.failureStage, "commit");
      assert.equal(summary.failureSummary, "Commit failed: simulated canonical write failure");
      assert.equal(history.length, 1);
      assert.equal(history[0].status, "failed");
      assert.equal(history[0].failureStage, "commit");
      assert.equal(
        history[0].failureSummary,
        "Commit failed: simulated canonical write failure",
      );
      assert.deepEqual(counts, {
        players: 0,
        rounds: 0,
        artists: 0,
        songs: 0,
        submissions: 0,
        votes: 0,
      });
    });
  },
);

test(
  "marks a batch failed and rolls back canonical writes when recompute fails during commit",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const { staged, analyzed } = await parseStageAnalyzeBundle(
        "clean-bundle",
        prisma,
      );

      assert.equal(analyzed.status, "ready");

      await assert.rejects(
        () =>
          commitImportBatch(staged.batchId, {
            prisma,
            recomputeRoundResults: async () => {
              throw new Error("simulated recompute failure");
            },
          }),
        /simulated recompute failure/,
      );

      const [summary, history, counts] = await Promise.all([
        getImportBatchSummary(staged.batchId, { prisma }),
        listImportBatches({
          statuses: ["failed"],
          prisma,
        }),
        getCanonicalCounts(prisma),
      ]);

      assert.equal(summary.status, "failed");
      assert.deepEqual(summary.workflow, {
        stages: {
          parse: "complete",
          stage: "complete",
          validate: "complete",
          commit: "current",
        },
        awaiting: "none",
      });
      assert.equal(summary.failureStage, "commit");
      assert.equal(summary.failureSummary, "Commit failed: simulated recompute failure");
      assert.equal(history.length, 1);
      assert.equal(history[0].status, "failed");
      assert.equal(history[0].failureStage, "commit");
      assert.equal(
        history[0].failureSummary,
        "Commit failed: simulated recompute failure",
      );
      assert.deepEqual(counts, {
        players: 0,
        rounds: 0,
        artists: 0,
        songs: 0,
        submissions: 0,
        votes: 0,
      });
    });
  },
);
