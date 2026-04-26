"use client";

const React = require("react");
const {
  ARCHIVE_BADGE_VARIANTS,
  buildArchiveBadgeModel,
} = require("./archive-badges");

function normalizeSubmissionIds(submissionIds) {
  return (Array.isArray(submissionIds) ? submissionIds : [])
    .filter((submissionId) => Number.isInteger(submissionId))
    .sort((left, right) => left - right);
}

function useRoundVoteDisclosureState(submissionIds) {
  const expandableIds = React.useMemo(
    () => normalizeSubmissionIds(submissionIds),
    [submissionIds],
  );
  const expandableIdSet = React.useMemo(() => new Set(expandableIds), [expandableIds]);
  const [expandedIds, setExpandedIds] = React.useState(() => new Set());

  React.useEffect(() => {
    setExpandedIds((current) => {
      const filtered = new Set();

      for (const submissionId of current) {
        if (expandableIdSet.has(submissionId)) {
          filtered.add(submissionId);
        }
      }

      return filtered;
    });
  }, [expandableIdSet]);

  const isExpanded = React.useCallback(
    (submissionId) => expandedIds.has(submissionId),
    [expandedIds],
  );
  const toggleSubmission = React.useCallback(
    (submissionId) => {
      if (!expandableIdSet.has(submissionId)) {
        return;
      }

      setExpandedIds((current) => {
        const next = new Set(current);

        if (next.has(submissionId)) {
          next.delete(submissionId);
        } else {
          next.add(submissionId);
        }

        return next;
      });
    },
    [expandableIdSet],
  );
  const allExpanded = expandableIds.length > 0 && expandedIds.size === expandableIds.length;
  const toggleAll = React.useCallback(() => {
    setExpandedIds((current) =>
      expandableIds.length > 0 && current.size === expandableIds.length
        ? new Set()
        : new Set(expandableIds),
    );
  }, [expandableIds]);

  return {
    isExpanded,
    toggleSubmission,
    toggleAll,
    allExpanded,
  };
}

function ArchiveBadge({ variant, label, ariaLabel, href, rel, target }) {
  const badge = buildArchiveBadgeModel({ variant, label, ariaLabel });
  const props = {
    className: "archive-badge",
    "data-archive-badge-variant": badge.variant,
    "data-archive-badge-role": ARCHIVE_BADGE_VARIANTS[badge.variant].tokenRole,
    "aria-label": badge.ariaLabel ?? undefined,
  };

  if (href) {
    return React.createElement("a", { ...props, href, rel, target }, badge.label);
  }

  return React.createElement("span", props, badge.label);
}

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function VoteRows({ votes }) {
  return React.createElement(
    "ul",
    { className: "archive-round-vote-list" },
    votes.map((vote) =>
      React.createElement(
        "li",
        { key: vote.voteId, className: "archive-round-vote-row" },
        React.createElement(
          "span",
          { className: "archive-round-vote-main" },
          React.createElement("a", { href: vote.voter.href }, vote.voter.displayName),
          React.createElement(ArchiveBadge, {
            variant: "score",
            label: `${vote.pointsAssigned} points`,
          }),
        ),
        vote.votedAtLabel
          ? React.createElement("span", { className: "archive-round-vote-meta" }, vote.votedAtLabel)
          : null,
        vote.comment
          ? React.createElement("p", { className: "archive-round-vote-comment" }, vote.comment)
          : null,
      ),
    ),
  );
}

function RoundSubmissionVotes({ submission, expanded, onToggle }) {
  const panelId = `round-submission-${submission.submissionId}-votes`;
  const voteCount = submission.votes.length;

  if (voteCount === 0) {
    return React.createElement("p", { className: "archive-round-vote-empty" }, "No imported votes");
  }

  return React.createElement(
    "div",
    { className: "archive-round-vote-disclosure" },
    React.createElement(
      "button",
      {
        type: "button",
        "aria-expanded": expanded,
        "aria-controls": panelId,
        onClick: onToggle,
      },
      `${expanded ? "Hide" : "Show"} ${formatCount(voteCount, "vote")}`,
    ),
    expanded
      ? React.createElement("div", { id: panelId }, React.createElement(VoteRows, { votes: submission.votes }))
      : null,
  );
}

function RoundSubmissionsList({ submissions }) {
  const expandableSubmissionIds = React.useMemo(
    () =>
      submissions
        .filter((submission) => submission.votes.length > 0)
        .map((submission) => submission.submissionId),
    [submissions],
  );
  const disclosureState = useRoundVoteDisclosureState(expandableSubmissionIds);

  return React.createElement(
    "section",
    { className: "archive-route-section archive-round-submissions", "aria-labelledby": "round-submissions-heading" },
    React.createElement(
      "div",
      { className: "archive-round-section-heading" },
      React.createElement("h2", { id: "round-submissions-heading" }, "Submissions"),
      React.createElement(
        "button",
        {
          type: "button",
          className: "archive-round-expand-all",
          onClick: disclosureState.toggleAll,
          disabled: expandableSubmissionIds.length === 0,
        },
        disclosureState.allExpanded ? "Collapse all votes" : "Expand all votes",
      ),
    ),
    submissions.length === 0
      ? React.createElement("p", { className: "archive-route-empty" }, "No submissions imported for this round.")
      : React.createElement(
          "ol",
          { className: "archive-round-submission-list" },
          submissions.map((submission) => {
            const expanded = disclosureState.isExpanded(submission.submissionId);

            return React.createElement(
              "li",
              { key: submission.submissionId, id: `submission-${submission.submissionId}` },
              React.createElement(
                "div",
                { className: "archive-round-submission-main" },
                React.createElement(
                  "div",
                  { className: "archive-round-submission-copy" },
                  React.createElement(
                    "a",
                    { className: "archive-round-submission-song", href: submission.song.href },
                    submission.song.title,
                  ),
                  React.createElement("span", null, submission.song.artistName),
                  React.createElement(
                    "span",
                    null,
                    "Submitted by ",
                    React.createElement("a", { href: submission.submitter.href }, submission.submitter.displayName),
                  ),
                ),
                React.createElement(
                  "span",
                  { className: "archive-round-submission-badges" },
                  React.createElement(ArchiveBadge, {
                    variant: submission.isTiedRank ? "rank-tie" : "rank-plain",
                    label: submission.rankLabel,
                  }),
                  React.createElement(ArchiveBadge, {
                    variant: "score",
                    label: submission.scoreLabel,
                  }),
                  React.createElement(ArchiveBadge, {
                    variant:
                      submission.familiarity.kind === "first-time"
                        ? "familiarity-first-time"
                        : "familiarity-returning",
                    label: submission.familiarity.label,
                  }),
                ),
              ),
              submission.submissionComment
                ? React.createElement(
                    "p",
                    { className: "archive-round-submission-comment" },
                    submission.submissionComment,
                  )
                : null,
              React.createElement(RoundSubmissionVotes, {
                submission,
                expanded,
                onToggle: () => disclosureState.toggleSubmission(submission.submissionId),
              }),
            );
          }),
        ),
  );
}

module.exports = {
  RoundSubmissionsList,
  useRoundVoteDisclosureState,
};
