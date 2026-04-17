async function listArchiveGames(prisma) {
  return prisma.game.findMany({
    orderBy: {
      id: "asc",
    },
    include: {
      rounds: {
        orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
        select: {
          id: true,
          gameId: true,
          leagueSlug: true,
          name: true,
          sourceRoundId: true,
        },
      },
    },
  });
}

module.exports = {
  listArchiveGames,
};
