const React = require("react");
const {
  buildArchiveHref,
  getPlayerModalSubmission,
  getPlayerRoundModal,
  getRoundDetail,
  getSongRoundModal,
  listArchiveGames,
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

async function resolveRoundSelection(searchParams, input) {
  const requestedRoundId = normalizeQueryInteger(searchParams?.round);

  if (requestedRoundId === null) {
    return {
      openRoundId: null,
      openRound: null,
      notFoundNotice: null,
    };
  }

  const openRound = await getRoundDetail(requestedRoundId, input);

  return {
    openRoundId: openRound ? openRound.id : null,
    openRound,
    notFoundNotice: openRound ? null : "Round not found.",
  };
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

    let activeSubmissionId = null;
    let activeSubmission = null;

    if (requestedPlayerSubmissionId !== null) {
      activeSubmission = await getPlayerModalSubmission(
        roundSelection.openRound.id,
        requestedPlayerId,
        requestedPlayerSubmissionId,
        input,
      );
      activeSubmissionId = activeSubmission?.submissionId ?? null;
    }

    return {
      nestedEntity: {
        kind: "player",
        id: openPlayerModal.playerId,
      },
      openSongModal: null,
      openPlayerModal: {
        ...openPlayerModal,
        activeSubmissionId,
        activeSubmission,
      },
    };
  }

  if (requestedSongId !== null) {
    const openSongModal = await getSongRoundModal(roundSelection.openRound.id, requestedSongId, input);

    return {
      nestedEntity: openSongModal
        ? {
            kind: "song",
            id: openSongModal.songId,
          }
        : null,
      openSongModal,
      openPlayerModal: null,
    };
  }

  return {
    nestedEntity: null,
    openSongModal: null,
    openPlayerModal: null,
  };
}

function withRoundHrefs(games) {
  return games.map((game) => ({
    ...game,
    rounds: game.rounds.map((round) => ({
      ...round,
      href: buildArchiveHref({ roundId: round.id }),
    })),
  }));
}

async function buildGameArchivePageProps(input = {}) {
  const searchParams = (await input.searchParams) ?? {};
  const archiveInput = input.prisma ? { prisma: input.prisma } : {};
  const [games, roundSelection] = await Promise.all([
    listArchiveGames(archiveInput).then(withRoundHrefs),
    resolveRoundSelection(searchParams, archiveInput),
  ]);
  const nestedSelection = await resolveNestedSelection(searchParams, roundSelection, archiveInput);

  return {
    games,
    openRoundId: roundSelection.openRoundId,
    openRound: roundSelection.openRound,
    notFoundNotice: roundSelection.notFoundNotice,
    nestedEntity: nestedSelection.nestedEntity,
    openSongModal: nestedSelection.openSongModal,
    openPlayerModal: nestedSelection.openPlayerModal,
  };
}

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

function renderGameSection(game, openRoundId) {
  return React.createElement(
    "section",
    {
      className: "archive-game-section",
      key: game.id,
      "aria-labelledby": `game-${game.id}-title`,
    },
    React.createElement(
      "div",
      { className: "archive-game-header" },
      React.createElement("p", { className: "archive-game-kicker" }, "Game archive"),
      React.createElement("h2", { className: "archive-game-title", id: `game-${game.id}-title` }, game.displayLabel),
      React.createElement(
        "p",
        { className: "archive-game-meta" },
        `${game.roundCount} round${game.roundCount === 1 ? "" : "s"}`,
      ),
    ),
    React.createElement(
      "ul",
      { className: "archive-round-list" },
      game.rounds.map((round) => renderRoundCard(round, openRoundId)),
    ),
  );
}

function renderEmptyState() {
  return React.createElement(
    "section",
    { className: "archive-empty-state" },
    React.createElement("p", { className: "archive-empty-kicker" }, "Nothing here yet"),
    React.createElement("h2", { className: "archive-empty-title" }, "Import a game to start the archive."),
    React.createElement(
      "p",
      { className: "archive-empty-body" },
      "The route is live, but there are no seeded or imported games to display yet.",
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

function renderSubmissionRow(roundId, submission) {
  const songHref = buildArchiveHref({
    roundId,
    songId: submission.song.id,
  });
  const playerHref = buildArchiveHref({
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

function renderNestedSongModal(roundId, songModal) {
  const dialogTitleId = `round-${roundId}-song-${songModal.songId}-title`;
  const closeHref = buildArchiveHref({ roundId });

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
        className: "archive-nested-shell",
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
          React.createElement("p", { className: "archive-round-dialog-kicker" }, "Song detail"),
          React.createElement("h3", { className: "archive-nested-shell-title", id: dialogTitleId }, songModal.title),
          React.createElement("p", { className: "archive-round-context" }, songModal.artistName),
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
        React.createElement(
          "p",
          { className: "archive-nested-shell-line" },
          `Submitted by ${songModal.submitterName}`,
        ),
        React.createElement(
          "div",
          { className: "archive-nested-shell-meta" },
          React.createElement("span", { className: "archive-submission-rank" }, formatSubmissionRank(songModal.rank)),
          React.createElement("span", { className: "archive-submission-score" }, formatSubmissionScore(songModal.score)),
        ),
      ),
    ),
  );
}

function renderPlayerNotablePick(originRoundId, playerId, kind, submission) {
  if (!submission) {
    return null;
  }

  const pickLabel = kind === "best" ? "Best Pick" : "Worst Pick";
  const songHref = buildArchiveHref({
    roundId: originRoundId,
    playerId,
    playerSubmissionId: submission.submissionId,
  });
  const roundHref = buildArchiveHref({ roundId: submission.roundId });

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

function renderPlayerHistoryRow(originRoundId, playerId, submission) {
  const songHref = buildArchiveHref({
    roundId: originRoundId,
    playerId,
    playerSubmissionId: submission.submissionId,
  });
  const roundHref = buildArchiveHref({ roundId: submission.roundId });

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
    renderPlayerNotablePick(
      playerModal.originRoundId,
      playerModal.playerId,
      "best",
      playerModal.notablePicks.best,
    ),
    renderPlayerNotablePick(
      playerModal.originRoundId,
      playerModal.playerId,
      "worst",
      playerModal.notablePicks.worst,
    ),
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
          renderPlayerHistoryRow(playerModal.originRoundId, playerModal.playerId, submission),
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
  const closeHref = buildArchiveHref({ roundId: playerModal.originRoundId });
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

function renderRoundDetailDialog(round, nestedEntity, openSongModal, openPlayerModal) {
  const dialogTitleId = `round-${round.id}-title`;
  const closeHref = buildArchiveHref({});

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
          "Back to archive",
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
          round.submissions.map((submission) => renderSubmissionRow(round.id, submission)),
        ),
      ),
    ),
    renderNestedEntityModal(round.id, nestedEntity, openSongModal, openPlayerModal),
  );
}

function GameArchivePage({
  games,
  openRoundId,
  openRound,
  notFoundNotice,
  nestedEntity,
  openSongModal,
  openPlayerModal,
}) {
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
        React.createElement("h1", { className: "archive-hero-title" }, "Archive by game"),
        React.createElement(
          "p",
          { className: "archive-hero-body" },
          "Browse every game as its own chapter, then dip into a round without losing the bigger picture.",
        ),
      ),
      notFoundNotice
        ? React.createElement(
            "aside",
            { className: "archive-notice", role: "status" },
            notFoundNotice,
          )
        : null,
      games.length === 0
        ? renderEmptyState()
        : React.createElement(
            "div",
            { className: "archive-game-grid" },
            games.map((game) => renderGameSection(game, openRoundId)),
          ),
    ),
    openRound ? renderRoundDetailDialog(openRound, nestedEntity, openSongModal, openPlayerModal) : null,
  );
}

module.exports = {
  GameArchivePage,
  buildGameArchivePageProps,
};
