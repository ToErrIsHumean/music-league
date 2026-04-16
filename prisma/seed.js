const { PrismaClient } = require("@prisma/client");
const { normalize } = require("../src/lib/normalize");

const prisma = new PrismaClient();

const players = [
  {
    displayName: "Alice Arcade",
    sourcePlayerId: "seed-player-alice",
  },
  {
    displayName: "Benny Beats",
    sourcePlayerId: "seed-player-benny",
  },
  {
    displayName: "Casey Chorus",
    sourcePlayerId: "seed-player-casey",
  },
  {
    displayName: "Drew Delay",
    sourcePlayerId: "seed-player-drew",
  },
];

const artists = [
  { name: "The Midnight Owls" },
  { name: "Solar Static" },
  { name: "Neon Harbor" },
  { name: "Juniper Sundays" },
];

const songs = [
  {
    title: "Mr. Brightside",
    artistName: "The Midnight Owls",
    spotifyUri: "spotify:track:seed-song-001",
  },
  {
    title: "Wake Up, Mr Crow",
    artistName: "Solar Static",
    spotifyUri: "spotify:track:seed-song-002",
  },
  {
    title: "It's a Trap",
    artistName: "Neon Harbor",
    spotifyUri: "spotify:track:seed-song-003",
  },
  {
    title: "Beyonce Nights",
    artistName: "Juniper Sundays",
    spotifyUri: "spotify:track:seed-song-004",
  },
  {
    title: "The Long Way Home",
    artistName: "Solar Static",
    spotifyUri: "spotify:track:seed-song-005",
  },
  {
    title: "Parallel Lines",
    artistName: "The Midnight Owls",
    spotifyUri: "spotify:track:seed-song-006",
  },
];

const rounds = [
  {
    leagueSlug: "main",
    sourceRoundId: "seed-r1",
    name: "Opening Night",
    description: "Seeded scored round for downstream query development.",
    playlistUrl: "https://open.spotify.com/playlist/seed-r1",
    sequenceNumber: 1,
    occurredAt: new Date("2024-01-18T19:00:00.000Z"),
  },
  {
    leagueSlug: "main",
    sourceRoundId: "seed-r2",
    name: "Second Spin",
    description: "Seeded partially scored round for downstream query development.",
    playlistUrl: "https://open.spotify.com/playlist/seed-r2",
    sequenceNumber: 2,
    occurredAt: new Date("2024-02-01T19:00:00.000Z"),
  },
];

// TASK-04b extends this file to upsert submissions. Keeping the planned overlap
// here ensures the shared fixture has at least one song scheduled for both rounds.
const plannedRoundSongs = {
  "seed-r1": [
    "spotify:track:seed-song-001",
    "spotify:track:seed-song-002",
    "spotify:track:seed-song-003",
    "spotify:track:seed-song-004",
  ],
  "seed-r2": [
    "spotify:track:seed-song-001",
    "spotify:track:seed-song-005",
    "spotify:track:seed-song-006",
  ],
};

function validateSeedPlan() {
  const roundSongUris = Object.values(plannedRoundSongs);
  const seenUris = new Set(roundSongUris[0] || []);
  const overlappingUris = (roundSongUris[1] || []).filter((uri) =>
    seenUris.has(uri),
  );

  if (overlappingUris.length === 0) {
    throw new Error("seed plan must reuse at least one song across rounds");
  }
}

async function seedPlayers() {
  for (const player of players) {
    const normalizedName = normalize(player.displayName);

    await prisma.player.upsert({
      where: { normalizedName },
      update: {
        displayName: player.displayName,
        normalizedName,
        sourcePlayerId: player.sourcePlayerId,
      },
      create: {
        displayName: player.displayName,
        normalizedName,
        sourcePlayerId: player.sourcePlayerId,
      },
    });
  }
}

async function seedArtists() {
  const artistMap = new Map();

  for (const artist of artists) {
    const normalizedName = normalize(artist.name);
    const record = await prisma.artist.upsert({
      where: { normalizedName },
      update: {
        name: artist.name,
        normalizedName,
      },
      create: {
        name: artist.name,
        normalizedName,
      },
    });

    artistMap.set(artist.name, record);
  }

  return artistMap;
}

async function seedSongs(artistMap) {
  for (const song of songs) {
    const artist = artistMap.get(song.artistName);

    if (!artist) {
      throw new Error(`missing artist for song: ${song.title}`);
    }

    await prisma.song.upsert({
      where: { spotifyUri: song.spotifyUri },
      update: {
        title: song.title,
        normalizedTitle: normalize(song.title),
        artistId: artist.id,
      },
      create: {
        title: song.title,
        normalizedTitle: normalize(song.title),
        artistId: artist.id,
        spotifyUri: song.spotifyUri,
      },
    });
  }
}

async function seedRounds() {
  for (const round of rounds) {
    await prisma.round.upsert({
      where: {
        leagueSlug_sourceRoundId: {
          leagueSlug: round.leagueSlug,
          sourceRoundId: round.sourceRoundId,
        },
      },
      update: {
        name: round.name,
        description: round.description,
        playlistUrl: round.playlistUrl,
        sequenceNumber: round.sequenceNumber,
        occurredAt: round.occurredAt,
      },
      create: round,
    });
  }
}

async function main() {
  validateSeedPlan();
  await seedPlayers();
  const artistMap = await seedArtists();
  await seedSongs(artistMap);
  await seedRounds();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
