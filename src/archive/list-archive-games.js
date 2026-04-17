function compareNullableAscending(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNullableDescending(left, right) {
  return compareNullableAscending(right, left);
}

function findNewestOccurredAt(rounds) {
  return rounds.reduce((newest, round) => {
    if (round.occurredAt === null) {
      return newest;
    }

    if (newest === null || round.occurredAt > newest) {
      return round.occurredAt;
    }

    return newest;
  }, null);
}

async function listArchiveGames(prisma) {
  const games = await prisma.game.findMany({
    include: {
      rounds: {
        select: {
          id: true,
          gameId: true,
          leagueSlug: true,
          name: true,
          occurredAt: true,
          sequenceNumber: true,
          sourceRoundId: true,
        },
      },
    },
  });

  return games
    .filter((game) => game.rounds.length > 0)
    .map((game) => ({
      ...game,
      rounds: [...game.rounds].sort((left, right) => {
        const sequenceComparison = compareNullableAscending(
          left.sequenceNumber,
          right.sequenceNumber,
        );

        if (sequenceComparison !== 0) {
          return sequenceComparison;
        }

        const occurredAtComparison = compareNullableAscending(
          left.occurredAt,
          right.occurredAt,
        );

        if (occurredAtComparison !== 0) {
          return occurredAtComparison;
        }

        return left.id - right.id;
      }),
    }))
    .sort((left, right) => {
      const newestOccurredAtComparison = compareNullableDescending(
        findNewestOccurredAt(left.rounds),
        findNewestOccurredAt(right.rounds),
      );

      if (newestOccurredAtComparison !== 0) {
        return newestOccurredAtComparison;
      }

      return left.sourceGameId.localeCompare(right.sourceGameId);
    });
}

module.exports = {
  listArchiveGames,
};
