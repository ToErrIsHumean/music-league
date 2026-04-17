const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const { PrismaClient } = require("@prisma/client");

const { normalize } = require("../lib/normalize");
const { analyzeImportBatch } = require("./analyze-batch");
const { commitImportBatch } = require("./commit-batch");
const { parseMusicLeagueBundle } = require("./parse-bundle");
const { stageImportBundle } = require("./stage-batch");

function createTempBundle(files) {
  const bundlePath = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-commit-bundle-"),
  );

  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(bundlePath, filename), contents, "utf8");
  }

  return bundlePath;
}

async function withTestDatabase(run) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-commit-db-"),
  );
  const databasePath = path.join(tempDir, "commit.sqlite");
  const databaseUrl = `file:${databasePath}`;

  execFileSync(prismaCommand, ["prisma", "migrate", "deploy"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
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

function buildBundleFiles(snapshot) {
  return {
    "competitors.csv": buildCompetitorsCsv(snapshot.competitors),
    "rounds.csv": buildRoundsCsv(snapshot.rounds),
    "submissions.csv": buildSubmissionsCsv(snapshot.submissions),
    "votes.csv": buildVotesCsv(snapshot.votes),
  };
}

function buildCompetitorsCsv(rows) {
  return [
    "ID,Name",
    ...rows.map((row) => `${row.id},${row.name}`),
    "",
  ].join("\n");
}

function buildRoundsCsv(rows) {
  return [
    "ID,Created,Name,Description,Playlist URL",
    ...rows.map(
      (row) =>
        `${row.id},${row.createdAt},${row.name},${row.description ?? ""},${row.playlistUrl ?? ""}`,
    ),
    "",
  ].join("\n");
}

function buildSubmissionsCsv(rows) {
  return [
    "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters",
    ...rows.map(
      (row) =>
        [
          row.spotifyUri,
          row.title,
          row.artist,
          row.submitterId,
          row.createdAt,
          row.comment ?? "",
          row.roundId,
          row.visibleToVoters ? "Yes" : "No",
        ].join(","),
    ),
    "",
  ].join("\n");
}

function buildVotesCsv(rows) {
  return [
    "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID",
    ...rows.map(
      (row) =>
        [
          row.spotifyUri,
          row.voterId,
          row.createdAt,
          row.pointsAssigned,
          row.comment ?? "",
          row.roundId,
        ].join(","),
    ),
    "",
  ].join("\n");
}

async function stageAndAnalyzeSnapshot(prisma, snapshot) {
  const bundlePath = createTempBundle(buildBundleFiles(snapshot));

  try {
    const parsedBundle = parseMusicLeagueBundle({ bundlePath });
    const staged = await stageImportBundle({ parsedBundle, prisma });
    const analyzed = await analyzeImportBatch(staged.batchId, { prisma });

    return {
      bundlePath,
      staged,
      analyzed,
    };
  } catch (error) {
    fs.rmSync(bundlePath, { recursive: true, force: true });
    throw error;
  }
}

async function seedMatchedReferenceData(prisma) {
  const matchedPlayer = await prisma.player.create({
    data: {
      displayName: "ALICE SMITH",
      normalizedName: normalize("Alice Smith"),
      sourcePlayerId: "player-1",
    },
  });
  const matchedArtist = await prisma.artist.create({
    data: {
      name: "SWITCHFOOT",
      normalizedName: normalize("Switchfoot"),
    },
  });
  const matchedSong = await prisma.song.create({
    data: {
      title: "WAKE UP",
      normalizedTitle: normalize("Wake Up"),
      artistId: matchedArtist.id,
      spotifyUri: "spotify:track:1",
    },
  });
  const matchedRound = await prisma.round.create({
    data: {
      leagueSlug: "game-42",
      name: "Legacy Rediscovered",
      description: "Old description",
      playlistUrl: "https://example.com/legacy-playlist",
      occurredAt: new Date("2026-03-01T00:00:00.000Z"),
      sourceRoundId: "game-42",
    },
  });

  return {
    matchedArtist,
    matchedPlayer,
    matchedRound,
    matchedSong,
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

function createSingleRoundSnapshot() {
  return {
    competitors: [
      { id: "player-1", name: "Alice Smith" },
      { id: "player-2", name: "Bob Jones" },
    ],
    rounds: [
      {
        id: "game-42",
        createdAt: "2026-04-02T22:39:07Z",
        name: "Rediscovered",
        description: "Find old favorites",
        playlistUrl: "https://example.com/playlist",
      },
    ],
    submissions: [
      {
        spotifyUri: "spotify:track:1",
        title: "Wake Up",
        artist: "Switchfoot",
        submitterId: "player-1",
        createdAt: "2026-04-03T06:56:48Z",
        comment: "",
        roundId: "game-42",
        visibleToVoters: true,
      },
      {
        spotifyUri: "spotify:track:2",
        title: "Second Song",
        artist: "Artist B",
        submitterId: "player-2",
        createdAt: "2026-04-03T06:57:48Z",
        comment: "Great pick",
        roundId: "game-42",
        visibleToVoters: false,
      },
    ],
    votes: [
      {
        spotifyUri: "spotify:track:1",
        voterId: "player-2",
        createdAt: "2026-04-04T06:18:48Z",
        pointsAssigned: 3,
        comment: "",
        roundId: "game-42",
      },
      {
        spotifyUri: "spotify:track:2",
        voterId: "player-1",
        createdAt: "2026-04-04T06:19:48Z",
        pointsAssigned: -1,
        comment: "Too loud",
        roundId: "game-42",
      },
    ],
  };
}

function createReplaySnapshotOne() {
  return {
    competitors: [
      { id: "player-1", name: "Alice Smith" },
      { id: "player-2", name: "Bob Jones" },
      { id: "player-3", name: "Cara West" },
    ],
    rounds: [
      {
        id: "game-77",
        createdAt: "2026-04-01T10:00:00Z",
        name: "Round A",
        description: "Opening round",
        playlistUrl: "https://example.com/round-a",
      },
      {
        id: "round-b",
        createdAt: "2026-04-02T10:00:00Z",
        name: "Round B",
        description: "Second round",
        playlistUrl: "https://example.com/round-b",
      },
    ],
    submissions: [
      {
        spotifyUri: "spotify:track:1",
        title: "Song One",
        artist: "Artist One",
        submitterId: "player-1",
        createdAt: "2026-04-03T10:00:00Z",
        comment: "",
        roundId: "game-77",
        visibleToVoters: true,
      },
      {
        spotifyUri: "spotify:track:2",
        title: "Song Two",
        artist: "Artist Two",
        submitterId: "player-2",
        createdAt: "2026-04-03T10:05:00Z",
        comment: "Round A holdover",
        roundId: "game-77",
        visibleToVoters: false,
      },
      {
        spotifyUri: "spotify:track:3",
        title: "Song Three",
        artist: "Artist Three",
        submitterId: "player-3",
        createdAt: "2026-04-04T10:00:00Z",
        comment: "",
        roundId: "round-b",
        visibleToVoters: true,
      },
    ],
    votes: [
      {
        spotifyUri: "spotify:track:1",
        voterId: "player-2",
        createdAt: "2026-04-05T10:00:00Z",
        pointsAssigned: 5,
        comment: "",
        roundId: "game-77",
      },
      {
        spotifyUri: "spotify:track:2",
        voterId: "player-1",
        createdAt: "2026-04-05T10:05:00Z",
        pointsAssigned: 2,
        comment: "",
        roundId: "game-77",
      },
      {
        spotifyUri: "spotify:track:3",
        voterId: "player-1",
        createdAt: "2026-04-06T10:00:00Z",
        pointsAssigned: 4,
        comment: "For round b",
        roundId: "round-b",
      },
    ],
  };
}

function createReplaySnapshotTwo() {
  return {
    competitors: [
      { id: "player-1", name: "Alice Smith" },
      { id: "player-2", name: "Bob Jones" },
    ],
    rounds: [
      {
        id: "game-77",
        createdAt: "2026-04-07T10:00:00Z",
        name: "Round A Remix",
        description: "Refreshed round",
        playlistUrl: "https://example.com/round-a-remix",
      },
    ],
    submissions: [
      {
        spotifyUri: "spotify:track:2",
        title: "Song Two",
        artist: "Artist Two",
        submitterId: "player-2",
        createdAt: "2026-04-08T10:00:00Z",
        comment: "Still here",
        roundId: "game-77",
        visibleToVoters: false,
      },
      {
        spotifyUri: "spotify:track:4",
        title: "Song Four",
        artist: "Artist Four",
        submitterId: "player-1",
        createdAt: "2026-04-08T10:05:00Z",
        comment: "New entrant",
        roundId: "game-77",
        visibleToVoters: true,
      },
    ],
    votes: [
      {
        spotifyUri: "spotify:track:2",
        voterId: "player-1",
        createdAt: "2026-04-09T10:00:00Z",
        pointsAssigned: 7,
        comment: "Updated points",
        roundId: "game-77",
      },
      {
        spotifyUri: "spotify:track:4",
        voterId: "player-2",
        createdAt: "2026-04-09T10:05:00Z",
        pointsAssigned: 1,
        comment: "",
        roundId: "game-77",
      },
    ],
  };
}

test(
  "commits a ready batch into canonical tables with hydrated fields and recomputed results",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const matched = await seedMatchedReferenceData(prisma);
      const { bundlePath, staged, analyzed } = await stageAndAnalyzeSnapshot(
        prisma,
        createSingleRoundSnapshot(),
      );

      try {
        assert.equal(analyzed.status, "ready");

        const committedAt = new Date("2026-04-17T04:00:00.000Z");
        const result = await commitImportBatch(staged.batchId, {
          prisma,
          now: () => committedAt,
        });

        assert.deepEqual(result, {
          batchId: staged.batchId,
          status: "committed",
          canonicalWrites: {
            playersCreated: 1,
            roundsCreated: 0,
            artistsCreated: 1,
            songsCreated: 1,
            submissionsUpserted: 2,
            votesUpserted: 2,
          },
          affectedRoundIds: [matched.matchedRound.id],
        });

        const [batch, players, artists, songs, round, submissions, votes] =
          await Promise.all([
            prisma.importBatch.findUniqueOrThrow({
              where: { id: staged.batchId },
            }),
            prisma.player.findMany({
              orderBy: {
                sourcePlayerId: "asc",
              },
            }),
            prisma.artist.findMany({
              orderBy: {
                normalizedName: "asc",
              },
            }),
            prisma.song.findMany({
              orderBy: {
                spotifyUri: "asc",
              },
            }),
            prisma.round.findUniqueOrThrow({
              where: { id: matched.matchedRound.id },
            }),
            prisma.submission.findMany({
              where: { roundId: matched.matchedRound.id },
              include: {
                player: {
                  select: {
                    sourcePlayerId: true,
                  },
                },
                song: {
                  select: {
                    spotifyUri: true,
                    title: true,
                  },
                },
              },
              orderBy: {
                id: "asc",
              },
            }),
            prisma.vote.findMany({
              where: { roundId: matched.matchedRound.id },
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

        assert.equal(batch.status, "committed");
        assert.equal(batch.failureStage, null);
        assert.equal(batch.failureSummary, null);
        assert.equal(batch.createdPlayerCount, 1);
        assert.equal(batch.createdRoundCount, 0);
        assert.equal(batch.createdArtistCount, 1);
        assert.equal(batch.createdSongCount, 1);
        assert.equal(batch.submissionsUpsertedCount, 2);
        assert.equal(batch.votesUpsertedCount, 2);
        assert.equal(batch.committedAt?.toISOString(), committedAt.toISOString());

        assert.deepEqual(
          players.map((player) => ({
            sourcePlayerId: player.sourcePlayerId,
            displayName: player.displayName,
          })),
          [
            {
              sourcePlayerId: "player-1",
              displayName: "Alice Smith",
            },
            {
              sourcePlayerId: "player-2",
              displayName: "Bob Jones",
            },
          ],
        );
        assert.deepEqual(
          artists.map((artist) => ({
            normalizedName: artist.normalizedName,
            name: artist.name,
          })),
          [
            {
              normalizedName: "artist b",
              name: "Artist B",
            },
            {
              normalizedName: "switchfoot",
              name: "Switchfoot",
            },
          ],
        );
        assert.deepEqual(
          songs.map((song) => ({
            spotifyUri: song.spotifyUri,
            title: song.title,
          })),
          [
            {
              spotifyUri: "spotify:track:1",
              title: "Wake Up",
            },
            {
              spotifyUri: "spotify:track:2",
              title: "Second Song",
            },
          ],
        );
        assert.deepEqual(
          {
            leagueSlug: round.leagueSlug,
            name: round.name,
            description: round.description,
            playlistUrl: round.playlistUrl,
            occurredAt: round.occurredAt?.toISOString(),
            sourceRoundId: round.sourceRoundId,
          },
          {
            leagueSlug: "game-42",
            name: "Rediscovered",
            description: "Find old favorites",
            playlistUrl: "https://example.com/playlist",
            occurredAt: "2026-04-02T22:39:07.000Z",
            sourceRoundId: "game-42",
          },
        );
        assert.deepEqual(
          Object.fromEntries(
            submissions.map((submission) => [
              submission.song.spotifyUri,
              {
                player: submission.player.sourcePlayerId,
                comment: submission.comment,
                visibleToVoters: submission.visibleToVoters,
                score: submission.score,
                rank: submission.rank,
                sourceImportId: submission.sourceImportId,
              },
            ]),
          ),
          {
            "spotify:track:1": {
              player: "player-1",
              comment: null,
              visibleToVoters: true,
              score: 3,
              rank: 1,
              sourceImportId: staged.batchId,
            },
            "spotify:track:2": {
              player: "player-2",
              comment: "Great pick",
              visibleToVoters: false,
              score: -1,
              rank: 2,
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
                comment: vote.comment,
                sourceImportId: vote.sourceImportId,
              },
            ]),
          ),
          {
            "spotify:track:1": {
              voter: "player-2",
              pointsAssigned: 3,
              comment: null,
              sourceImportId: staged.batchId,
            },
            "spotify:track:2": {
              voter: "player-1",
              pointsAssigned: -1,
              comment: "Too loud",
              sourceImportId: staged.batchId,
            },
          },
        );
      } finally {
        fs.rmSync(bundlePath, { recursive: true, force: true });
      }
    });
  },
);

test(
  "re-ingesting the same game overwrites stale game-scoped rounds submissions and votes without duplicating globals",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const first = await stageAndAnalyzeSnapshot(prisma, createReplaySnapshotOne());

      try {
        assert.equal(first.analyzed.status, "ready");

        await commitImportBatch(first.staged.batchId, {
          prisma,
          now: () => new Date("2026-04-17T05:00:00.000Z"),
        });

        const second = await stageAndAnalyzeSnapshot(prisma, createReplaySnapshotTwo());

        try {
          assert.equal(second.analyzed.status, "ready");

          const secondCommittedAt = new Date("2026-04-17T06:00:00.000Z");
          const secondResult = await commitImportBatch(second.staged.batchId, {
            prisma,
            now: () => secondCommittedAt,
          });

          const rounds = await prisma.round.findMany({
            where: {
              leagueSlug: "game-77",
            },
            orderBy: {
              sourceRoundId: "asc",
            },
          });
          const submissions = await prisma.submission.findMany({
            include: {
              round: {
                select: {
                  leagueSlug: true,
                  sourceRoundId: true,
                  name: true,
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
                  title: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          });
          const votes = await prisma.vote.findMany({
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
          });
          const batch = await prisma.importBatch.findUniqueOrThrow({
            where: { id: second.staged.batchId },
          });
          const counts = await getCanonicalCounts(prisma);

          assert.deepEqual(secondResult, {
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

          assert.equal(batch.status, "committed");
          assert.equal(batch.committedAt?.toISOString(), secondCommittedAt.toISOString());
          assert.deepEqual(counts, {
            players: 3,
            rounds: 1,
            artists: 4,
            songs: 4,
            submissions: 2,
            votes: 2,
          });
          assert.deepEqual(
            rounds.map((round) => ({
              leagueSlug: round.leagueSlug,
              sourceRoundId: round.sourceRoundId,
              name: round.name,
              description: round.description,
            })),
            [
              {
                leagueSlug: "game-77",
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
              title: submission.song.title,
              score: submission.score,
              rank: submission.rank,
              sourceImportId: submission.sourceImportId,
            })),
            [
              {
                round: "game-77",
                player: "player-2",
                spotifyUri: "spotify:track:2",
                title: "Song Two",
                score: 7,
                rank: 1,
                sourceImportId: second.staged.batchId,
              },
              {
                round: "game-77",
                player: "player-1",
                spotifyUri: "spotify:track:4",
                title: "Song Four",
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
        } finally {
          fs.rmSync(second.bundlePath, { recursive: true, force: true });
        }
      } finally {
        fs.rmSync(first.bundlePath, { recursive: true, force: true });
      }
    });
  },
);

test(
  "rejects non-ready batches and leaves canonical tables unchanged",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const bundlePath = createTempBundle(buildBundleFiles(createSingleRoundSnapshot()));

      try {
        const parsedBundle = parseMusicLeagueBundle({ bundlePath });
        const staged = await stageImportBundle({ parsedBundle, prisma });

        await assert.rejects(
          () => commitImportBatch(staged.batchId, { prisma }),
          /commitImportBatch: batch status is not ready: /,
        );

        const [batch, counts] = await Promise.all([
          prisma.importBatch.findUniqueOrThrow({
            where: { id: staged.batchId },
          }),
          getCanonicalCounts(prisma),
        ]);

        assert.equal(batch.status, "parsed");
        assert.deepEqual(counts, {
          players: 0,
          rounds: 0,
          artists: 0,
          songs: 0,
          submissions: 0,
          votes: 0,
        });
      } finally {
        fs.rmSync(bundlePath, { recursive: true, force: true });
      }
    });
  },
);

test(
  "rejects ready batches that still have blocking issues and leaves canonical tables unchanged",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const { bundlePath, staged, analyzed } = await stageAndAnalyzeSnapshot(
        prisma,
        createSingleRoundSnapshot(),
      );

      try {
        assert.equal(analyzed.status, "ready");

        await prisma.importIssue.create({
          data: {
            importBatchId: staged.batchId,
            sourceFileKind: "batch",
            recordKind: "batch",
            issueCode: "manual_block",
            blocking: true,
            message: "Manual blocking issue",
          },
        });

        await assert.rejects(
          () => commitImportBatch(staged.batchId, { prisma }),
          /commitImportBatch: open blocking issues remain: /,
        );

        const [batch, counts] = await Promise.all([
          prisma.importBatch.findUniqueOrThrow({
            where: { id: staged.batchId },
          }),
          getCanonicalCounts(prisma),
        ]);

        assert.equal(batch.status, "ready");
        assert.deepEqual(counts, {
          players: 0,
          rounds: 0,
          artists: 0,
          songs: 0,
          submissions: 0,
          votes: 0,
        });
      } finally {
        fs.rmSync(bundlePath, { recursive: true, force: true });
      }
    });
  },
);

test(
  "marks the batch failed and rolls back canonical writes when recompute fails during commit",
  { concurrency: false },
  async () => {
    await withTestDatabase(async (prisma) => {
      const { bundlePath, staged, analyzed } = await stageAndAnalyzeSnapshot(
        prisma,
        createSingleRoundSnapshot(),
      );

      try {
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

        const [batch, counts] = await Promise.all([
          prisma.importBatch.findUniqueOrThrow({
            where: { id: staged.batchId },
          }),
          getCanonicalCounts(prisma),
        ]);

        assert.equal(batch.status, "failed");
        assert.equal(batch.failureStage, "commit");
        assert.equal(
          batch.failureSummary,
          "Commit failed: simulated recompute failure",
        );
        assert.equal(batch.committedAt, null);
        assert.equal(batch.submissionsUpsertedCount, 0);
        assert.equal(batch.votesUpsertedCount, 0);
        assert.deepEqual(counts, {
          players: 0,
          rounds: 0,
          artists: 0,
          songs: 0,
          submissions: 0,
          votes: 0,
        });
      } finally {
        fs.rmSync(bundlePath, { recursive: true, force: true });
      }
    });
  },
);
