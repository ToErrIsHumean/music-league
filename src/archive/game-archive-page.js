const React = require("react");
const {
  buildArchiveHref,
  buildCanonicalSongMemoryHref,
  getPlayerModalSubmission,
  getPlayerRoundModal,
  getRoundDetail,
  getSelectedGameMemoryBoard,
  getSongMemoryModal,
  listSelectableGames,
} = require("./archive-utils");

const archiveDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function normalizeQueryInteger(value) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate !== "string" || !/^\d+$/.test(candidate)) {
    return null;
  }

  const parsedValue = Number.parseInt(candidate, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

async function resolveNestedSelection(searchParams, roundSelection, input) {
  if (!roundSelection.openRound) {
    return {
      nestedEntity: null,
      openSongModal: null,
      openPlayerModal: null,
    };
  }

  const requestedPlayerId = normalizeQueryInteger(searchParams?.player);
  const requestedPlayerSubmissionId = normalizeQueryInteger(searchParams?.playerSubmission);
  const requestedSongId = normalizeQueryInteger(searchParams?.song);

  if (requestedPlayerId !== null && requestedPlayerSubmissionId !== null) {
    const openPlayerModal = await getPlayerRoundModal(
      roundSelection.openRound.id,
      requestedPlayerId,
      input,
    );

    if (openPlayerModal) {
      const activeSubmission = await getPlayerModalSubmission(
        roundSelection.openRound.id,
        requestedPlayerId,
        requestedPlayerSubmissionId,
        input,
      );

      return {
        nestedEntity: {
          kind: "player",
          id: openPlayerModal.playerId,
        },
        openSongModal: null,
        openPlayerModal: {
          ...openPlayerModal,
          activeSubmissionId: activeSubmission?.submissionId ?? null,
          activeSubmission,
        },
      };
    }
  }

  if (requestedSongId !== null) {
    const openSongModal = await getSongMemoryModal(
      roundSelection.openRound.id,
      requestedSongId,
      input,
    );

    return {
      nestedEntity: openSongModal
        ? {
            kind: "song",
            id: openSongModal.song?.id ?? requestedSongId,
          }
        : null,
      openSongModal,
      openPlayerModal: null,
    };
  }

  if (requestedPlayerId !== null) {
    const openPlayerModal = await getPlayerRoundModal(
      roundSelection.openRound.id,
      requestedPlayerId,
      input,
    );

    if (!openPlayerModal) {
      return {
        nestedEntity: null,
        openSongModal: null,
        openPlayerModal: null,
      };
    }

    return {
      nestedEntity: {
        kind: "player",
        id: openPlayerModal.playerId,
      },
      openSongModal: null,
      openPlayerModal: {
        ...openPlayerModal,
        activeSubmissionId: null,
        activeSubmission: null,
      },
    };
  }

  return {
    nestedEntity: null,
    openSongModal: null,
    openPlayerModal: null,
  };
}

function findSelectableGame(games, gameId) {
  if (gameId === null) {
    return null;
  }

  return games.find((game) => game.id === gameId) ?? null;
}

function compareIsoDescending(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left < right ? 1 : left > right ? -1 : 0;
}

function compareNullableNumberDescending(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right - left;
}

function determineDefaultSelectionBasis(games) {
  const selectedGame = games[0] ?? null;
  const nextGame = games[1] ?? null;

  if (!selectedGame) {
    return "stable-source-game-id";
  }

  if (!nextGame) {
    if (selectedGame.latestOccurredAt !== null) {
      return "round-occurred-at";
    }

    if (selectedGame.highestSequenceNumber !== null) {
      return "round-sequence";
    }

    return selectedGame.createdAt !== null ? "game-created-at" : "stable-source-game-id";
  }

  if (compareIsoDescending(selectedGame.latestOccurredAt, nextGame.latestOccurredAt) !== 0) {
    return selectedGame.latestOccurredAt !== null ? "round-occurred-at" : "stable-source-game-id";
  }

  if (
    compareNullableNumberDescending(
      selectedGame.highestSequenceNumber,
      nextGame.highestSequenceNumber,
    ) !== 0
  ) {
    return selectedGame.highestSequenceNumber !== null
      ? "round-sequence"
      : "stable-source-game-id";
  }

  if (compareIsoDescending(selectedGame.createdAt, nextGame.createdAt) !== 0) {
    return selectedGame.createdAt !== null ? "game-created-at" : "stable-source-game-id";
  }

  return "stable-source-game-id";
}

function formatFrameDate(value) {
  return archiveDateFormatter.format(new Date(value));
}

function buildTimeframeLabel(game) {
  if (game.earliestOccurredAt && game.latestOccurredAt) {
    const earliest = formatFrameDate(game.earliestOccurredAt);
    const latest = formatFrameDate(game.latestOccurredAt);

    return earliest === latest ? earliest : `${earliest} - ${latest}`;
  }

  if (game.latestOccurredAt) {
    return formatFrameDate(game.latestOccurredAt);
  }

  if (game.highestSequenceNumber !== null) {
    return `Through round ${game.highestSequenceNumber}`;
  }

  return `${game.roundCount} round${game.roundCount === 1 ? "" : "s"}`;
}

function buildSelectionCopy(selectionBasis) {
  return selectionBasis === "round-occurred-at" ||
    selectionBasis === "round-sequence" ||
    selectionBasis === "game-created-at"
    ? "Latest game"
    : "Selected game";
}

function buildSelectedGameFrame(game, selectionBasis) {
  if (!game) {
    return null;
  }

  return {
    id: game.id,
    sourceGameId: game.sourceGameId,
    displayLabel: game.displayLabel,
    timeframeLabel: buildTimeframeLabel(game),
    roundCount: game.roundCount,
    scoredRoundCount: game.scoredRoundCount,
    selectionBasis,
    selectionCopy: buildSelectionCopy(selectionBasis),
  };
}

function buildGameSwitcherOptions(games, selectedGameId) {
  if (games.length < 2) {
    return [];
  }

  return games.map((game) => ({
    id: game.id,
    displayLabel: game.displayLabel,
    timeframeLabel: buildTimeframeLabel(game),
    isSelected: game.id === selectedGameId,
    href: buildArchiveHref({ gameId: game.id }),
  }));
}

function resolveSelectedGame({ selectableGames, requestedGameId, requestedRound }) {
  const explicitGame = findSelectableGame(selectableGames, requestedGameId);

  if (explicitGame) {
    return {
      selectedGame: explicitGame,
      selectionBasis: "explicit-query",
      invalidGameNotice: null,
    };
  }

  if (requestedRound) {
    const roundGame = findSelectableGame(selectableGames, requestedRound.game.id);

    if (roundGame) {
      return {
        selectedGame: roundGame,
        selectionBasis: "explicit-query",
        invalidGameNotice: requestedGameId === null ? null : "Game not found.",
      };
    }
  }

  return {
    selectedGame: selectableGames[0] ?? null,
    selectionBasis: determineDefaultSelectionBasis(selectableGames),
    invalidGameNotice: requestedGameId === null ? null : "Game not found.",
  };
}

function resolveRoundSelection({ requestedRoundId, requestedRound, selectedGame }) {
  if (requestedRoundId === null) {
    return {
      openRoundId: null,
      openRound: null,
      notice: null,
    };
  }

  if (!requestedRound) {
    return {
      openRoundId: null,
      openRound: null,
      notice: "Round not found.",
    };
  }

  if (!selectedGame || requestedRound.game.id !== selectedGame.id) {
    return {
      openRoundId: null,
      openRound: null,
      notice: "Round not found in selected game.",
    };
  }

  return {
    openRoundId: requestedRound.id,
    openRound: requestedRound,
    notice: null,
  };
}

async function buildGameMemoryBoardPageProps(input = {}) {
  const searchParams = (await input.searchParams) ?? {};
  const archiveInput = input.prisma ? { prisma: input.prisma } : {};
  const requestedGameId = normalizeQueryInteger(searchParams?.game);
  const requestedRoundId = normalizeQueryInteger(searchParams?.round);
  const [selectableGames, requestedRound] = await Promise.all([
    listSelectableGames(archiveInput),
    requestedRoundId === null ? Promise.resolve(null) : getRoundDetail(requestedRoundId, archiveInput),
  ]);

  if (selectableGames.length === 0) {
    return {
      selectedGame: null,
      games: [],
      board: null,
      notices: [],
      openRoundId: null,
      openRound: null,
      nestedEntity: null,
      openSongModal: null,
      openPlayerModal: null,
    };
  }

  const selected = resolveSelectedGame({
    selectableGames,
    requestedGameId,
    requestedRound,
  });
  const selectedGameFrame = buildSelectedGameFrame(
    selected.selectedGame,
    selected.selectionBasis,
  );
  const selectedGameMemoryBoard =
    selected.selectedGame === null
      ? null
      : await getSelectedGameMemoryBoard(selected.selectedGame.id, archiveInput);
  const roundSelection = resolveRoundSelection({
    requestedRoundId,
    requestedRound,
    selectedGame: selected.selectedGame,
  });
  const nestedSelection = await resolveNestedSelection(searchParams, roundSelection, archiveInput);
  const notices = [selected.invalidGameNotice, roundSelection.notice].filter(Boolean);

  return {
    selectedGame: selectedGameFrame,
    games: buildGameSwitcherOptions(selectableGames, selected.selectedGame?.id ?? null),
    board: selectedGameMemoryBoard?.board ?? null,
    openRoundId: roundSelection.openRoundId,
    openRound: roundSelection.openRound,
    notices,
    nestedEntity: nestedSelection.nestedEntity,
    openSongModal: nestedSelection.openSongModal,
    openPlayerModal: nestedSelection.openPlayerModal,
  };
}

const buildGameArchivePageProps = buildGameMemoryBoardPageProps;

function formatRoundDate(occurredAt) {
  if (!occurredAt) {
    return "Date TBD";
  }

  return archiveDateFormatter.format(new Date(occurredAt));
}

function formatRoundOutcome(round) {
  if (round.winnerLabel) {
    return `Winner: ${round.winnerLabel}`;
  }

  if (round.statusLabel === "pending") {
    return "Awaiting votes";
  }

  return "Winner pending";
}

function formatSubmissionCount(submissionCount) {
  return `${submissionCount} submission${submissionCount === 1 ? "" : "s"}`;
}

function buildRoundSignals(round) {
  return [
    formatRoundDate(round.occurredAt),
    formatRoundOutcome(round),
    formatSubmissionCount(round.submissionCount),
  ];
}

function buildRoundDetailHighlights(round) {
  return [
    ...round.highlights,
    {
      kind: "anomaly",
      label: "Submissions",
      value: `${round.submissions.length} songs in play`,
    },
    {
      kind: "anomaly",
      label: "Playlist",
      value: round.playlistUrl ? "Playlist ready" : "Playlist link pending",
    },
    {
      kind: "anomaly",
      label: "Date",
      value: formatRoundDate(round.occurredAt),
    },
  ].slice(0, 3);
}

function formatSubmissionRank(rank) {
  return rank === null ? "Unranked" : `#${rank}`;
}

function formatSubmissionScore(score) {
  return score === null ? "Score pending" : `${score} pts`;
}

function formatSubmissionRankLabel(rank) {
  return `Rank ${formatSubmissionRank(rank)}`;
}

function formatSubmissionScoreLabel(score) {
  return `Score ${formatSubmissionScore(score)}`;
}

function formatPlayerHistoryCount(submissionCount) {
  return `${submissionCount} submission${submissionCount === 1 ? "" : "s"} across this game`;
}

function formatGenericCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatVotePoints(pointsAssigned) {
  const prefix = pointsAssigned > 0 ? "+" : "";

  return `${prefix}${pointsAssigned} pts`;
}

function formatSongArtistFootprint(artistFootprint) {
  if (artistFootprint.submissionCount === 0) {
    return "No other songs by this artist";
  }

  return `${formatGenericCount(artistFootprint.submissionCount, "submission")} across ${formatGenericCount(
    artistFootprint.songCount,
    "other song",
  )} by ${formatGenericCount(artistFootprint.submitterCount, "submitter")}`;
}

function formatSongFamiliarityVerdict(familiarity, summary) {
  if (familiarity.kind === "brought-back") {
    const artistCopy =
      summary.artistFootprint.submissionCount > 0
        ? `, with ${formatSongArtistFootprint(summary.artistFootprint).toLowerCase()}`
        : "";

    return `${formatGenericCount(
      familiarity.priorExactSongSubmissionCount,
      "earlier exact-song submission",
    )}${artistCopy}.`;
  }

  if (familiarity.kind === "known-artist") {
    return `First exact-song appearance here, with ${formatGenericCount(
      familiarity.priorArtistSubmissionCount,
      "earlier artist submission",
    )} across ${formatGenericCount(familiarity.priorArtistSongCount, "other song")}.`;
  }

  return "No earlier exact-song or same-artist history before this round.";
}

function formatBestSongFinish(bestExactSongFinish) {
  if (!bestExactSongFinish) {
    return null;
  }

  return bestExactSongFinish.score === null
    ? formatSubmissionRank(bestExactSongFinish.rank)
    : `${formatSubmissionRank(bestExactSongFinish.rank)}, ${formatSubmissionScore(
        bestExactSongFinish.score,
      )}`;
}

function buildSongSummaryFacts(songModal) {
  const summary = songModal.summary;
  const facts = [];

  if (summary.firstSubmitter) {
    facts.push({
      label: "First appearance",
      value: summary.firstSubmitter.displayName,
    });
  }

  if (summary.mostRecentSubmitter) {
    facts.push({
      label: "Most recent",
      value: summary.mostRecentSubmitter.displayName,
    });
  }

  facts.push({
    label: "Exact history",
    value: formatGenericCount(summary.exactSongSubmissionCount, "submission"),
  });
  facts.push({
    label: "Artist footprint",
    value: formatSongArtistFootprint(summary.artistFootprint),
  });

  const bestFinish = formatBestSongFinish(summary.bestExactSongFinish);

  if (bestFinish) {
    facts.push({
      label: "Best finish",
      value: bestFinish,
    });
  }

  return facts;
}

function renderRoundCard(round, openRoundId) {
  const isOpen = round.id === openRoundId;

  return React.createElement(
    "li",
    { className: "archive-round-item", key: round.id },
    React.createElement(
      "a",
      {
        href: round.href,
        className: isOpen ? "archive-round-card is-open" : "archive-round-card",
        "aria-current": isOpen ? "page" : undefined,
      },
      React.createElement(
        "div",
        { className: "archive-round-copy" },
        React.createElement(
          "p",
          { className: "archive-round-kicker" },
          round.sequenceNumber === null ? "Round" : `Round ${round.sequenceNumber}`,
        ),
        React.createElement("h3", { className: "archive-round-title" }, round.name),
      ),
      React.createElement(
        "ul",
        { className: "archive-round-signals", "aria-label": `${round.name} summary` },
        buildRoundSignals(round).map((signal) =>
          React.createElement("li", { className: "archive-signal", key: signal }, signal),
        ),
      ),
    ),
  );
}

function renderGameSwitcher(games) {
  if (games.length === 0) {
    return null;
  }

  return React.createElement(
    "nav",
    { className: "archive-game-switcher", "aria-label": "Select game" },
    games.map((game) =>
      React.createElement(
        "a",
        {
          href: game.href,
          className: game.isSelected
            ? "archive-game-switcher-link is-selected"
            : "archive-game-switcher-link",
          "aria-current": game.isSelected ? "page" : undefined,
          key: game.id,
        },
        React.createElement("span", { className: "archive-game-switcher-name" }, game.displayLabel),
        game.timeframeLabel
          ? React.createElement(
              "span",
              { className: "archive-game-switcher-timeframe" },
              game.timeframeLabel,
            )
          : null,
      ),
    ),
  );
}

function renderCompetitiveAnchor(anchor) {
  if (!anchor) {
    return React.createElement(
      "article",
      { className: "archive-competitive-anchor archive-competitive-anchor-sparse" },
      React.createElement("p", { className: "archive-moment-label" }, "Competitive anchor"),
      React.createElement("h3", { className: "archive-moment-title" }, "Scores still pending"),
      React.createElement(
        "p",
        { className: "archive-moment-body" },
        "No scored submissions are available yet, so the board omits game-level result claims.",
      ),
    );
  }

  return React.createElement(
    "article",
    { className: "archive-competitive-anchor" },
    React.createElement("p", { className: "archive-moment-label" }, "Competitive anchor"),
    React.createElement("h3", { className: "archive-moment-title" }, anchor.title),
    React.createElement("p", { className: "archive-moment-body" }, anchor.body),
    React.createElement(
      "ol",
      { className: "archive-anchor-standings", "aria-label": "Top selected-game standings" },
      anchor.standings.map((standing) =>
        React.createElement(
          "li",
          { className: "archive-anchor-standing", key: standing.playerName },
          React.createElement("span", null, standing.playerName),
          React.createElement("strong", null, `${standing.totalScore} pts`),
        ),
      ),
    ),
  );
}

function renderMemoryMoment(moment) {
  const content = React.createElement(
    React.Fragment,
    null,
    React.createElement("p", { className: "archive-moment-label" }, moment.label),
    React.createElement("h3", { className: "archive-moment-title" }, moment.title),
    React.createElement("p", { className: "archive-moment-body" }, moment.body),
  );

  if (moment.href) {
    return React.createElement(
      "li",
      { className: `archive-memory-moment archive-memory-moment-${moment.kind}`, key: moment.title },
      React.createElement("a", { href: moment.href, className: "archive-memory-moment-link" }, content),
    );
  }

  return React.createElement(
    "li",
    { className: `archive-memory-moment archive-memory-moment-${moment.kind}`, key: moment.title },
    content,
  );
}

function renderSelectedGameBoard(selectedGame, board, openRoundId) {
  const rounds = board?.rounds ?? [];
  const moments = board?.moments ?? [];

  return React.createElement(
    "section",
    {
      className: "archive-game-section archive-selected-game-board",
      "aria-labelledby": `game-${selectedGame.id}-title`,
    },
    React.createElement(
      "div",
      { className: "archive-game-header" },
      React.createElement("p", { className: "archive-game-kicker" }, "Selected memory board"),
      React.createElement(
        "h2",
        { className: "archive-game-title", id: `game-${selectedGame.id}-title` },
        selectedGame.displayLabel,
      ),
      React.createElement(
        "p",
        { className: "archive-game-meta" },
        [
          `${selectedGame.roundCount} round${selectedGame.roundCount === 1 ? "" : "s"}`,
          `${selectedGame.scoredRoundCount} scored`,
        ].join(" | "),
      ),
    ),
    rounds.length === 0 || moments.length === 0
      ? React.createElement(
          "p",
          { className: "archive-game-meta" },
          "This selected game has no round evidence available.",
        )
      : React.createElement(
          React.Fragment,
          null,
          renderCompetitiveAnchor(board.competitiveAnchor),
          React.createElement(
            "ul",
            { className: "archive-memory-grid", "aria-label": "Selected game memory moments" },
            moments.map(renderMemoryMoment),
          ),
        ),
  );
}

function renderEmptyState() {
  return React.createElement(
    "section",
    { className: "archive-empty-state" },
    React.createElement("p", { className: "archive-empty-kicker" }, "Archive unavailable"),
    React.createElement("h2", { className: "archive-empty-title" }, "No selectable game is available."),
    React.createElement(
      "p",
      { className: "archive-empty-body" },
      "Import a game with at least one round to open the selected-game memory board.",
    ),
  );
}

function renderRoundHighlight(highlight) {
  return React.createElement(
    "li",
    {
      className: `archive-highlight-card archive-highlight-${highlight.kind}`,
      key: `${highlight.kind}-${highlight.label}`,
    },
    React.createElement("p", { className: "archive-highlight-label" }, highlight.label),
    React.createElement("p", { className: "archive-highlight-value" }, highlight.value),
  );
}

function renderSubmissionRow(roundId, submission, gameId = null) {
  const songHref = buildCanonicalSongMemoryHref({
    gameId,
    roundId,
    songId: submission.song.id,
  });
  const playerHref = buildArchiveHref({
    gameId,
    roundId,
    playerId: submission.player.id,
  });

  return React.createElement(
    "li",
    { className: "archive-submission-row", key: submission.id },
    React.createElement(
      "div",
      { className: "archive-submission-main" },
      React.createElement(
        "div",
        { className: "archive-submission-copy" },
        React.createElement(
          "a",
          {
            href: songHref,
            className: "archive-submission-link archive-submission-song-link",
            "aria-label": `Open song detail for ${submission.song.title}`,
          },
          React.createElement(
            "span",
            { className: "archive-submission-song" },
            submission.song.title,
          ),
          React.createElement(
            "span",
            { className: "archive-submission-artist" },
            submission.song.artistName,
          ),
          submission.song.familiarity
            ? React.createElement(
                "span",
                {
                  className: "archive-submission-familiarity",
                  "data-familiarity-kind": submission.song.familiarity.kind,
                },
                submission.song.familiarity.label,
              )
            : null,
        ),
        React.createElement(
          "a",
          {
            href: playerHref,
            className: "archive-submission-link archive-submission-player",
            "aria-label": `Open player detail for ${submission.player.displayName}`,
          },
          `Submitted by ${submission.player.displayName}`,
        ),
      ),
      React.createElement(
        "div",
        { className: "archive-submission-stats", "aria-label": `${submission.song.title} result` },
        React.createElement("span", { className: "archive-submission-rank" }, formatSubmissionRank(submission.rank)),
        React.createElement("span", { className: "archive-submission-score" }, formatSubmissionScore(submission.score)),
      ),
    ),
    submission.comment
      ? React.createElement(
          "p",
          {
            className: "archive-submission-comment",
            id: `round-${roundId}-submission-${submission.id}-comment`,
          },
          submission.comment,
        )
      : null,
  );
}

function renderRoundVote(vote, index) {
  return React.createElement(
    "li",
    {
      className: "archive-vote-row",
      key: `${vote.voter.id}-${vote.pointsAssigned}-${vote.votedAt ?? "no-date"}-${index}`,
    },
    React.createElement(
      "div",
      { className: "archive-vote-main" },
      React.createElement(
        "div",
        { className: "archive-vote-copy" },
        React.createElement("p", { className: "archive-vote-voter" }, vote.voter.displayName),
        vote.votedAt
          ? React.createElement(
              "p",
              { className: "archive-vote-date" },
              formatRoundDate(vote.votedAt),
            )
          : null,
      ),
      React.createElement(
        "span",
        { className: "archive-vote-points" },
        formatVotePoints(vote.pointsAssigned),
      ),
    ),
    vote.voteComment
      ? React.createElement(
          "p",
          { className: "archive-vote-comment" },
          React.createElement("span", { className: "archive-evidence-label" }, "Vote comment"),
          vote.voteComment,
        )
      : null,
  );
}

function renderRoundVoteBreakdownGroup(group) {
  return React.createElement(
    "li",
    { className: "archive-vote-breakdown-item", key: group.submissionId },
    React.createElement(
      "article",
      { className: "archive-vote-breakdown-card" },
      React.createElement(
        "div",
        { className: "archive-vote-breakdown-main" },
        React.createElement(
          "div",
          { className: "archive-vote-breakdown-copy" },
          React.createElement("h3", { className: "archive-vote-song" }, group.song.title),
          React.createElement("p", { className: "archive-vote-artist" }, group.song.artistName),
          React.createElement(
            "p",
            { className: "archive-vote-submitter" },
            `Submitted by ${group.submitter.displayName}`,
          ),
        ),
        React.createElement(
          "div",
          { className: "archive-vote-result", "aria-label": `${group.song.title} result` },
          React.createElement(
            "span",
            { className: "archive-submission-rank" },
            formatSubmissionRank(group.rank),
          ),
          React.createElement(
            "span",
            { className: "archive-submission-score" },
            formatSubmissionScore(group.score),
          ),
        ),
      ),
      group.submissionComment
        ? React.createElement(
            "p",
            { className: "archive-submission-comment archive-submission-evidence-comment" },
            React.createElement("span", { className: "archive-evidence-label" }, "Submission comment"),
            group.submissionComment,
          )
        : null,
      group.votes.length > 0
        ? React.createElement(
            "ol",
            {
              className: "archive-vote-list",
              "aria-label": `${group.song.title} votes`,
            },
            group.votes.map(renderRoundVote),
          )
        : React.createElement(
            "p",
            { className: "archive-vote-empty" },
            "No imported votes for this submission.",
          ),
    ),
  );
}

function renderRoundVoteBreakdownSection(round) {
  const voteBreakdown = round.voteBreakdown ?? [];
  const voteCount = voteBreakdown.reduce((count, group) => count + group.votes.length, 0);

  return React.createElement(
    "div",
    { className: "archive-vote-breakdown-section" },
    React.createElement(
      "div",
      { className: "archive-submission-section-header" },
      React.createElement("p", { className: "archive-round-dialog-kicker" }, "Vote evidence"),
      React.createElement(
        "p",
        { className: "archive-submission-section-meta" },
        formatGenericCount(voteCount, "imported vote"),
      ),
    ),
    React.createElement(
      "ol",
      { className: "archive-vote-breakdown-list" },
      voteBreakdown.map(renderRoundVoteBreakdownGroup),
    ),
  );
}

function renderSongSummaryFact(fact) {
  return React.createElement(
    "li",
    { className: "archive-song-summary-fact", key: fact.label },
    React.createElement("span", { className: "archive-song-summary-label" }, fact.label),
    React.createElement("span", { className: "archive-song-summary-value" }, fact.value),
  );
}

function renderSongEvidenceShortcuts(shortcuts) {
  if (shortcuts.length === 0) {
    return null;
  }

  return React.createElement(
    "nav",
    { className: "archive-song-shortcuts", "aria-label": "Song evidence shortcuts" },
    shortcuts.map((shortcut) =>
      React.createElement(
        "a",
        {
          href: `#song-history-submission-${shortcut.submissionId}`,
          className: "archive-song-shortcut",
          key: shortcut.kind,
        },
        shortcut.label,
      ),
    ),
  );
}

function renderSongHistoryRow(row) {
  const playerHref = buildArchiveHref({
    gameId: row.gameId,
    roundId: row.roundId,
    playerId: row.submitter.id,
  });
  const roundHref = buildArchiveHref({ gameId: row.gameId, roundId: row.roundId });

  return React.createElement(
    "li",
    {
      className: row.isOrigin
        ? "archive-song-history-item is-origin"
        : "archive-song-history-item",
      id: `song-history-submission-${row.submissionId}`,
      key: row.submissionId,
    },
    React.createElement(
      "article",
      { className: "archive-song-history-card" },
      React.createElement(
        "div",
        { className: "archive-song-history-main" },
        React.createElement(
          "div",
          { className: "archive-song-history-copy" },
          React.createElement(
            "a",
            {
              href: playerHref,
              className: "archive-song-history-player",
              "aria-label": `Open ${row.submitter.displayName} from ${row.roundName}`,
            },
            row.submitter.displayName,
          ),
          React.createElement(
            "a",
            {
              href: roundHref,
              className: "archive-song-history-round",
              "aria-label": `Open ${row.roundName}`,
            },
            row.roundName,
          ),
          React.createElement(
            "span",
            { className: "archive-song-history-date" },
            formatRoundDate(row.occurredAt),
          ),
          row.isOrigin
            ? React.createElement("span", { className: "archive-song-origin-pill" }, "Origin")
            : null,
        ),
        React.createElement(
          "div",
          { className: "archive-song-history-result" },
          React.createElement(
            "span",
            { className: "archive-submission-rank" },
            formatSubmissionRankLabel(row.result.rank),
          ),
          React.createElement(
            "span",
            { className: "archive-submission-score" },
            formatSubmissionScoreLabel(row.result.score),
          ),
        ),
      ),
      row.comment
        ? React.createElement("p", { className: "archive-song-history-comment" }, row.comment)
        : null,
    ),
  );
}

function renderSongHistoryGroup(group) {
  return React.createElement(
    "section",
    { className: "archive-song-history-group", key: group.gameId },
    React.createElement(
      "div",
      { className: "archive-song-history-group-header" },
      React.createElement("h4", { className: "archive-song-history-game" }, group.gameLabel),
      group.isOriginGame
        ? React.createElement("span", { className: "archive-song-origin-pill" }, "Origin game")
        : null,
    ),
    React.createElement(
      "ol",
      { className: "archive-song-history-list" },
      group.rows.map(renderSongHistoryRow),
    ),
  );
}

function renderUnavailableSongState(songModal) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "p",
      { className: "archive-nested-shell-line" },
      "This song detail is unavailable for the open round, but the round remains available.",
    ),
    React.createElement(
      "a",
      {
        href: songModal.closeHref,
        className: "archive-song-unavailable-action",
        "aria-label": "Return to the origin round",
      },
      "Return to round",
    ),
  );
}

function renderCanonicalSongState(songModal) {
  const summaryFacts = buildSongSummaryFacts(songModal);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "section",
      { className: "archive-song-summary", "aria-label": "Song memory summary" },
      React.createElement(
        "p",
        {
          className: "archive-song-modal-familiarity",
          "data-familiarity-kind": songModal.familiarity.kind,
        },
        songModal.familiarity.label,
      ),
      React.createElement(
        "p",
        { className: "archive-song-verdict-copy" },
        formatSongFamiliarityVerdict(songModal.familiarity, songModal.summary),
      ),
      React.createElement(
        "ul",
        { className: "archive-song-summary-grid" },
        summaryFacts.map(renderSongSummaryFact),
      ),
      songModal.summary.recallComment
        ? React.createElement(
            "p",
            { className: "archive-song-recall-comment" },
            songModal.summary.recallComment.text,
          )
        : null,
      renderSongEvidenceShortcuts(songModal.shortcuts),
    ),
    React.createElement(
      "section",
      { className: "archive-song-history-section", "aria-label": "Submission history" },
      React.createElement(
        "div",
        { className: "archive-song-history-header" },
        React.createElement("p", { className: "archive-round-dialog-kicker" }, "Submission evidence"),
        React.createElement(
          "p",
          { className: "archive-submission-section-meta" },
          formatGenericCount(songModal.summary.exactSongSubmissionCount, "exact-song submission"),
        ),
      ),
      songModal.historyGroups.map(renderSongHistoryGroup),
    ),
  );
}

function renderNestedSongModal(roundId, songModal) {
  const isUnavailable = songModal.unavailable === true;
  const dialogTitleId = isUnavailable
    ? `round-${roundId}-song-unavailable-title`
    : `round-${roundId}-song-${songModal.song.id}-title`;
  const closeHref = songModal.closeHref ?? buildArchiveHref({ roundId });

  return React.createElement(
    "div",
    { className: "archive-nested-shell-layer", "data-nested-kind": "song" },
    React.createElement("a", {
      href: closeHref,
      className: "archive-nested-shell-backdrop",
      "aria-label": "Close song detail",
    }),
    React.createElement(
      "aside",
      {
        className: isUnavailable
          ? "archive-nested-shell archive-song-shell archive-song-unavailable-shell"
          : "archive-nested-shell archive-song-shell",
        role: "dialog",
        "aria-modal": "false",
        "aria-labelledby": dialogTitleId,
      },
      React.createElement(
        "div",
        { className: "archive-nested-shell-header" },
        React.createElement(
          "div",
          { className: "archive-nested-shell-copy" },
          React.createElement("p", { className: "archive-round-dialog-kicker" }, "Song memory"),
          React.createElement(
            "h3",
            { className: "archive-nested-shell-title", id: dialogTitleId },
            isUnavailable ? "Song detail unavailable" : songModal.song.title,
          ),
          React.createElement(
            "p",
            { className: "archive-round-context" },
            isUnavailable ? `Requested song ${songModal.requestedSongId ?? "unknown"}` : songModal.song.artistName,
          ),
        ),
        React.createElement(
          "a",
          {
            href: closeHref,
            className: "archive-round-close",
            "aria-label": "Close song detail",
          },
          "Back to round",
        ),
      ),
      React.createElement(
        "div",
        { className: "archive-nested-shell-body" },
        isUnavailable ? renderUnavailableSongState(songModal) : renderCanonicalSongState(songModal),
      ),
    ),
  );
}

function renderPlayerNotablePick(kind, submission, gameId = null) {
  if (!submission) {
    return null;
  }

  const pickLabel = kind === "best" ? "Best Pick" : "Worst Pick";
  const songHref = buildCanonicalSongMemoryHref({
    gameId: submission.gameId ?? gameId,
    roundId: submission.roundId,
    songId: submission.song.id,
  });
  const roundHref = buildArchiveHref({
    gameId: submission.gameId ?? gameId,
    roundId: submission.roundId,
  });

  return React.createElement(
    "article",
    {
      className:
        kind === "best"
          ? "archive-player-pick-card archive-player-pick-best"
          : "archive-player-pick-card archive-player-pick-worst",
      key: `${kind}-${submission.submissionId}`,
    },
    React.createElement("p", { className: "archive-player-pick-label" }, pickLabel),
    React.createElement(
      "a",
      {
        href: songHref,
        className: "archive-player-pick-song",
        "aria-label": `Open ${submission.song.title} in ${submission.roundName}`,
      },
      submission.song.title,
    ),
    React.createElement("p", { className: "archive-player-pick-artist" }, submission.song.artistName),
    React.createElement(
      "a",
      {
        href: roundHref,
        className: "archive-player-pick-round",
        "aria-label": `Open ${submission.roundName}`,
      },
      submission.roundName,
    ),
    React.createElement(
      "div",
      { className: "archive-player-pick-meta" },
      React.createElement(
        "span",
        { className: "archive-player-pick-stat archive-submission-rank" },
        formatSubmissionRankLabel(submission.rank),
      ),
      React.createElement(
        "span",
        { className: "archive-player-pick-stat archive-submission-score" },
        formatSubmissionScoreLabel(submission.score),
      ),
    ),
  );
}

function renderPlayerHistoryRow(submission, gameId = null) {
  const songHref = buildCanonicalSongMemoryHref({
    gameId: submission.gameId ?? gameId,
    roundId: submission.roundId,
    songId: submission.song.id,
  });
  const roundHref = buildArchiveHref({
    gameId: submission.gameId ?? gameId,
    roundId: submission.roundId,
  });

  return React.createElement(
    "li",
    { className: "archive-player-history-item", key: submission.submissionId },
    React.createElement(
      "article",
      { className: "archive-player-history-card" },
      React.createElement(
        "div",
        { className: "archive-player-history-main" },
        React.createElement(
          "div",
          { className: "archive-player-history-copy" },
          React.createElement(
            "a",
            {
              href: songHref,
              className: "archive-player-history-song",
              "aria-label": `Open ${submission.song.title} from ${submission.roundName}`,
            },
            submission.song.title,
          ),
          React.createElement(
            "p",
            { className: "archive-player-history-artist" },
            submission.song.artistName,
          ),
          React.createElement(
            "a",
            {
              href: roundHref,
              className: "archive-player-history-round",
              "aria-label": `Open ${submission.roundName}`,
            },
            submission.roundName,
          ),
        ),
        React.createElement(
          "div",
          { className: "archive-player-history-meta" },
          React.createElement(
            "span",
            { className: "archive-submission-rank" },
            formatSubmissionRankLabel(submission.rank),
          ),
          React.createElement(
            "span",
            { className: "archive-submission-score" },
            formatSubmissionScoreLabel(submission.score),
          ),
        ),
      ),
      submission.comment
        ? React.createElement(
            "p",
            { className: "archive-player-history-comment" },
            submission.comment,
          )
        : null,
    ),
  );
}

function renderPlayerSummaryBody(playerModal) {
  const notablePickCards = [
    renderPlayerNotablePick("best", playerModal.notablePicks.best, playerModal.originGameId),
    renderPlayerNotablePick("worst", playerModal.notablePicks.worst, playerModal.originGameId),
  ].filter(Boolean);

  return React.createElement(
    "div",
    { className: "archive-player-summary-view" },
    React.createElement(
      "div",
      { className: "archive-player-summary-top" },
      playerModal.traitLine
        ? React.createElement(
            "p",
            {
              className: "archive-player-trait-line",
              "data-trait-kind": playerModal.traitKind ?? undefined,
            },
            playerModal.traitLine,
          )
        : null,
      notablePickCards.length > 0
        ? React.createElement(
            "section",
            { className: "archive-player-picks-section", "aria-label": "Notable picks" },
            React.createElement("p", { className: "archive-round-dialog-kicker" }, "Notable picks"),
            React.createElement(
              "div",
              { className: "archive-player-pick-grid" },
              notablePickCards,
            ),
          )
        : null,
    ),
    React.createElement(
      "section",
      { className: "archive-player-history-section" },
      React.createElement(
        "div",
        { className: "archive-player-history-header" },
        React.createElement("p", { className: "archive-round-dialog-kicker" }, "Full history"),
        React.createElement(
          "p",
          { className: "archive-submission-section-meta" },
          formatPlayerHistoryCount(playerModal.history.length),
        ),
      ),
      React.createElement(
        "ol",
        { className: "archive-player-history-list" },
        playerModal.history.map((submission) =>
          renderPlayerHistoryRow(submission, playerModal.originGameId),
        ),
      ),
    ),
  );
}

function renderPlayerSongView(playerModal) {
  const submission = playerModal.activeSubmission;

  if (!submission) {
    return null;
  }

  const backHref = buildArchiveHref({
    gameId: playerModal.originGameId,
    roundId: playerModal.originRoundId,
    playerId: playerModal.playerId,
  });

  return React.createElement(
    "div",
    { className: "archive-player-song-view" },
    React.createElement(
      "a",
      {
        href: backHref,
        className: "archive-player-song-back",
        "aria-label": `Back to ${playerModal.displayName} summary`,
      },
      `Back to ${playerModal.displayName} summary`,
    ),
    React.createElement(
      "article",
      { className: "archive-player-song-card" },
      React.createElement("p", { className: "archive-round-dialog-kicker" }, "Song detail"),
      React.createElement("h4", { className: "archive-player-song-title" }, submission.title),
      React.createElement("p", { className: "archive-player-song-artist" }, submission.artistName),
      submission.familiarity
        ? React.createElement(
            "p",
            {
              className: "archive-nested-shell-line archive-song-modal-familiarity",
              "data-familiarity-kind": submission.familiarity.kind,
            },
            `${submission.familiarity.label}: ${submission.familiarity.shortSummary}`,
          )
        : null,
      React.createElement(
        "div",
        { className: "archive-player-song-field" },
        React.createElement("p", { className: "archive-player-song-label" }, "Round"),
        React.createElement("p", { className: "archive-player-song-round" }, submission.roundName),
      ),
      React.createElement(
        "div",
        { className: "archive-player-song-meta" },
        React.createElement(
          "span",
          { className: "archive-submission-rank" },
          formatSubmissionRankLabel(submission.rank),
        ),
        React.createElement(
          "span",
          { className: "archive-submission-score" },
          formatSubmissionScoreLabel(submission.score),
        ),
      ),
      submission.comment
        ? React.createElement("p", { className: "archive-player-song-comment" }, submission.comment)
        : null,
    ),
  );
}

function renderNestedPlayerModal(roundId, playerModal) {
  const dialogTitleId = `round-${roundId}-player-${playerModal.playerId}-title`;
  const closeHref = buildArchiveHref({
    gameId: playerModal.originGameId,
    roundId: playerModal.originRoundId,
  });
  const isSongView = Boolean(playerModal.activeSubmission);
  const contextCopy = isSongView
    ? `${playerModal.activeSubmission.title} by ${playerModal.activeSubmission.artistName}`
    : formatPlayerHistoryCount(playerModal.history.length);

  return React.createElement(
    "div",
    { className: "archive-nested-shell-layer", "data-nested-kind": "player" },
    React.createElement("a", {
      href: closeHref,
      className: "archive-nested-shell-backdrop",
      "aria-label": "Close player detail",
    }),
    React.createElement(
      "aside",
      {
        className: "archive-nested-shell archive-player-shell",
        role: "dialog",
        "aria-modal": "false",
        "aria-labelledby": dialogTitleId,
      },
      React.createElement(
        "div",
        { className: "archive-nested-shell-header" },
        React.createElement(
          "div",
          { className: "archive-nested-shell-copy" },
          React.createElement("p", { className: "archive-round-dialog-kicker" }, "Player detail"),
          React.createElement(
            "h3",
            { className: "archive-nested-shell-title", id: dialogTitleId },
            playerModal.displayName,
          ),
          React.createElement("p", { className: "archive-round-context" }, contextCopy),
        ),
        React.createElement(
          "a",
          {
            href: closeHref,
            className: "archive-round-close",
            "aria-label": "Close player detail",
          },
          "Back to round",
        ),
      ),
      React.createElement(
        "div",
        { className: "archive-nested-shell-body" },
        isSongView ? renderPlayerSongView(playerModal) : renderPlayerSummaryBody(playerModal),
      ),
    ),
  );
}

function renderNestedEntityModal(roundId, nestedEntity, openSongModal, openPlayerModal) {
  if (!nestedEntity) {
    return null;
  }

  if (nestedEntity.kind === "song" && openSongModal) {
    return renderNestedSongModal(roundId, openSongModal);
  }

  if (nestedEntity.kind === "player" && openPlayerModal) {
    return renderNestedPlayerModal(roundId, openPlayerModal);
  }

  return null;
}

function renderRoundDetailDialog(round, nestedEntity, openSongModal, openPlayerModal, selectedGameId) {
  const dialogTitleId = `round-${round.id}-title`;
  const closeHref = buildArchiveHref({ gameId: selectedGameId });

  return React.createElement(
    "div",
    { className: "archive-overlay", "data-round-overlay": String(round.id) },
    React.createElement("a", {
      href: closeHref,
      className: "archive-overlay-backdrop",
      "aria-label": "Close round detail",
    }),
    React.createElement(
      "section",
      {
        className: "archive-round-dialog",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": dialogTitleId,
      },
      React.createElement(
        "div",
        { className: "archive-round-dialog-header" },
        React.createElement(
          "div",
          { className: "archive-round-dialog-copy" },
          React.createElement("p", { className: "archive-round-dialog-kicker" }, "Round detail"),
          React.createElement(
            "p",
            { className: "archive-round-context" },
            `From ${round.game.displayLabel}`,
          ),
          React.createElement("h2", { className: "archive-round-dialog-title", id: dialogTitleId }, round.name),
          React.createElement(
            "div",
            { className: "archive-round-dialog-meta" },
            React.createElement("span", { className: "archive-round-dialog-pill" }, formatRoundDate(round.occurredAt)),
            React.createElement(
              "span",
              { className: "archive-round-dialog-pill" },
              round.playlistUrl ? "Playlist linked" : "Playlist TBD",
            ),
          ),
          round.description
            ? React.createElement(
                "p",
                { className: "archive-round-description" },
                round.description,
              )
            : null,
        ),
        React.createElement(
          "a",
          {
            href: closeHref,
            className: "archive-round-close",
            "aria-label": "Close round detail",
          },
          "Back to game",
        ),
      ),
      React.createElement(
        "ul",
        { className: "archive-highlight-list", "aria-label": `${round.name} highlights` },
        buildRoundDetailHighlights(round).map(renderRoundHighlight),
      ),
      React.createElement(
        "div",
        { className: "archive-submission-section" },
        React.createElement(
          "div",
          { className: "archive-submission-section-header" },
          React.createElement("p", { className: "archive-round-dialog-kicker" }, "Full submissions"),
          React.createElement(
            "p",
            { className: "archive-submission-section-meta" },
            formatSubmissionCount(round.submissions.length),
          ),
        ),
        React.createElement(
          "ol",
          { className: "archive-submission-list" },
          round.submissions.map((submission) =>
            renderSubmissionRow(round.id, submission, selectedGameId),
          ),
        ),
      ),
      renderRoundVoteBreakdownSection(round),
    ),
    renderNestedEntityModal(round.id, nestedEntity, openSongModal, openPlayerModal),
  );
}

function GameMemoryBoardPage({
  selectedGame,
  games,
  board,
  notices,
  openRoundId,
  openRound,
  nestedEntity,
  openSongModal,
  openPlayerModal,
}) {
  const selectedGameId = selectedGame?.id ?? null;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "main",
      { className: "archive-page-shell" },
      React.createElement(
        "header",
        { className: "archive-hero" },
        React.createElement("p", { className: "archive-hero-kicker" }, "Music League"),
        React.createElement(
          "h1",
          { className: "archive-hero-title" },
          selectedGame ? selectedGame.displayLabel : "Archive unavailable",
        ),
        React.createElement(
          "p",
          { className: "archive-hero-body" },
          selectedGame
            ? `${selectedGame.selectionCopy}${
                selectedGame.timeframeLabel ? ` | ${selectedGame.timeframeLabel}` : ""
              }`
            : "No selectable game has enough round evidence for the memory board.",
        ),
        renderGameSwitcher(games),
      ),
      notices?.length > 0
        ? notices.map((notice) =>
            React.createElement(
              "aside",
              { className: "archive-notice", role: "status", key: notice },
              notice,
            ),
          )
        : null,
      selectedGame ? renderSelectedGameBoard(selectedGame, board, openRoundId) : renderEmptyState(),
    ),
    openRound
      ? renderRoundDetailDialog(
          openRound,
          nestedEntity,
          openSongModal,
          openPlayerModal,
          selectedGameId,
        )
      : null,
  );
}

const GameArchivePage = GameMemoryBoardPage;

module.exports = {
  GameMemoryBoardPage,
  buildGameMemoryBoardPageProps,
  GameArchivePage,
  buildGameArchivePageProps,
};
