const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function loadDatabaseUrlFromEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envPath = path.resolve(__dirname, "..", "..", ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const envFile = fs.readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (key !== "DATABASE_URL") {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env.DATABASE_URL = value;
    return;
  }
}

function assertNonEmptyArray(value, message) {
  assert.ok(Array.isArray(value), message);
  assert.ok(value.length > 0, message);
}

loadDatabaseUrlFromEnv();
assert.ok(
  process.env.DATABASE_URL,
  "DATABASE_URL must point to a migrated, seeded database",
);

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function findSongIdPresentInBothRounds() {
  const song = await prisma.song.findFirst({
    where: {
      AND: [
        {
          submissions: {
            some: {
              round: {
                sourceRoundId: "seed-r1",
              },
            },
          },
        },
        {
          submissions: {
            some: {
              round: {
                sourceRoundId: "seed-r2",
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  assert.ok(song, "expected a seeded song reused across both rounds");
  return song.id;
}

async function findPlayerIdWithSubmissions() {
  const player = await prisma.player.findFirst({
    where: {
      submissions: {
        some: {},
      },
    },
    select: {
      id: true,
    },
  });

  assert.ok(player, "expected a seeded player with submissions");
  return player.id;
}

async function findVoteTarget() {
  const vote = await prisma.vote.findFirst({
    select: {
      roundId: true,
      songId: true,
      voterId: true,
    },
  });

  assert.ok(vote, "expected seeded votes to exist");
  return vote;
}

test(
  "song modal query returns a reused seeded song with artist and submissions",
  { concurrency: false },
  async () => {
    const songId = await findSongIdPresentInBothRounds();
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        artist: true,
        submissions: {
          include: {
            player: true,
            round: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    assert.ok(song);
    assert.ok(song.artist);
    assertNonEmptyArray(song.submissions, "expected seeded song submissions");
    assert.ok(
      new Set(song.submissions.map((submission) => submission.round.id)).size >= 2,
      "expected song modal fixture to include both seeded rounds",
    );
  },
);

test(
  "player modal query returns seeded submissions with song, artist, and round",
  { concurrency: false },
  async () => {
    const playerId = await findPlayerIdWithSubmissions();
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        submissions: {
          include: {
            song: {
              include: {
                artist: true,
              },
            },
            round: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    assert.ok(player);
    assertNonEmptyArray(player.submissions, "expected seeded player submissions");
    assert.ok(
      player.submissions.every(
        (submission) => submission.song && submission.song.artist && submission.round,
      ),
      "expected player modal includes to resolve song, artist, and round",
    );
  },
);

test(
  "round page query returns seeded scored submissions in rank order",
  { concurrency: false },
  async () => {
    const round = await prisma.round.findFirst({
      where: {
        sourceRoundId: "seed-r1",
      },
      include: {
        submissions: {
          orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
          include: {
            player: {
              select: {
                id: true,
                displayName: true,
              },
            },
            song: {
              include: {
                artist: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    assert.ok(round);
    assertNonEmptyArray(round.submissions, "expected seeded round submissions");

    const ranks = round.submissions.map((submission) => submission.rank);
    assert.deepEqual(
      ranks,
      [...ranks].sort((left, right) => left - right),
      "expected round page submissions ordered by rank ascending",
    );
  },
);

test(
  "overview artist aggregation query returns seeded submissions for app-layer grouping",
  { concurrency: false },
  async () => {
    const submissions = await prisma.submission.findMany({
      include: {
        song: {
          include: {
            artist: true,
          },
        },
      },
    });

    assertNonEmptyArray(
      submissions,
      "expected seeded submissions for most-submitted artist aggregation",
    );

    const countsByArtistId = submissions.reduce((counts, submission) => {
      const artistId = submission.song.artist.id;
      const current = counts.get(artistId);

      counts.set(artistId, {
        artist: submission.song.artist,
        count: (current?.count ?? 0) + 1,
      });

      return counts;
    }, new Map());

    const mostSubmittedArtist = [...countsByArtistId.values()].sort(
      (left, right) => right.count - left.count,
    )[0];

    assert.ok(mostSubmittedArtist);
    assert.ok(mostSubmittedArtist.count > 0);
  },
);

test(
  "overview player activity aggregation query groups seeded submissions by player",
  { concurrency: false },
  async () => {
    const groupedSubmissions = await prisma.submission.groupBy({
      by: ["playerId"],
      _count: {
        id: true,
      },
    });

    assertNonEmptyArray(
      groupedSubmissions,
      "expected seeded submission groups for most-active player aggregation",
    );
    assert.ok(
      groupedSubmissions.some((row) => row._count.id > 0),
      "expected grouped submissions to include at least one counted player",
    );
  },
);

test(
  "vote query by round and song returns seeded voters",
  { concurrency: false },
  async () => {
    const { roundId, songId } = await findVoteTarget();
    const votes = await prisma.vote.findMany({
      where: {
        roundId,
        songId,
      },
      include: {
        voter: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    assertNonEmptyArray(votes, "expected votes for a seeded round/song pair");
    assert.ok(
      votes.every((vote) => vote.voter),
      "expected vote query to include seeded voter details",
    );
  },
);

test(
  "vote query by voter returns seeded songs, artists, and rounds",
  { concurrency: false },
  async () => {
    const { voterId } = await findVoteTarget();
    const votes = await prisma.vote.findMany({
      where: {
        voterId,
      },
      include: {
        song: {
          include: {
            artist: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        round: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    assertNonEmptyArray(votes, "expected votes for a seeded voter");
    assert.ok(
      votes.every((vote) => vote.song && vote.song.artist && vote.round),
      "expected voter vote query to include song, artist, and round details",
    );
  },
);

test.after(async () => {
  await prisma.$disconnect();
});
