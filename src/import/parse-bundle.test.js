const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { parseMusicLeagueBundle } = require("./parse-bundle");

function createTempBundle(files) {
  const bundlePath = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-parse-bundle-"),
  );

  for (const [filename, contents] of Object.entries(files)) {
    const filePath = path.join(bundlePath, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (contents?.type === "directory") {
      fs.mkdirSync(filePath, { recursive: true });
      continue;
    }

    fs.writeFileSync(filePath, contents, "utf8");
  }

  return bundlePath;
}

test("parses a valid bundle into typed rows and derives the game key", () => {
  const bundlePath = createTempBundle({
    "competitors.csv": " id , NAME \nplayer-1,Alice\nplayer-2,Bob\n",
    "rounds.csv":
      "ID,Created,Name,Description,Playlist URL\n game-42 ,2026-04-02T22:39:07Z,Rediscovered,,https://example.com/playlist\n",
    "submissions.csv":
      'Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters,Ignored Column\nspotify:track:1,"Wake Up, Mr. Crow",Switchfoot,player-1,2026-04-03T06:56:48Z,, game-42 ,Yes,ignore me\nspotify:track:2,Second Song,"Artist A, Artist B",player-2,2026-04-03T06:57:48Z,Great pick, game-42 ,No,still ignored\n',
    "votes.csv":
      "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:1,player-2,2026-04-04T06:18:48Z,3,, game-42 \nspotify:track:2,player-1,2026-04-04T06:19:48Z,-1,Too loud, game-42 \n",
  });

  const parsedBundle = parseMusicLeagueBundle({ bundlePath });

  assert.equal(parsedBundle.sourceLabel, path.basename(bundlePath));
  assert.equal(parsedBundle.gameKey, "game-42");
  assert.deepEqual(parsedBundle.issues, []);

  assert.deepEqual(parsedBundle.files.competitors, {
    filename: "competitors.csv",
    rowCount: 2,
    rows: [
      {
        sourceRowNumber: 2,
        sourcePlayerId: "player-1",
        displayName: "Alice",
      },
      {
        sourceRowNumber: 3,
        sourcePlayerId: "player-2",
        displayName: "Bob",
      },
    ],
  });

  assert.equal(parsedBundle.files.rounds.rowCount, 1);
  assert.equal(parsedBundle.files.rounds.rows[0].sourceRowNumber, 2);
  assert.equal(parsedBundle.files.rounds.rows[0].sourceRoundId, " game-42 ");
  assert.equal(
    parsedBundle.files.rounds.rows[0].occurredAt.toISOString(),
    "2026-04-02T22:39:07.000Z",
  );
  assert.equal(parsedBundle.files.rounds.rows[0].description, null);
  assert.equal(
    parsedBundle.files.rounds.rows[0].playlistUrl,
    "https://example.com/playlist",
  );

  assert.deepEqual(
    parsedBundle.files.submissions.rows.map((row) => ({
      sourceRowNumber: row.sourceRowNumber,
      spotifyUri: row.spotifyUri,
      visibleToVoters: row.visibleToVoters,
      comment: row.comment,
    })),
    [
      {
        sourceRowNumber: 2,
        spotifyUri: "spotify:track:1",
        visibleToVoters: true,
        comment: null,
      },
      {
        sourceRowNumber: 3,
        spotifyUri: "spotify:track:2",
        visibleToVoters: false,
        comment: "Great pick",
      },
    ],
  );

  assert.deepEqual(
    parsedBundle.files.votes.rows.map((row) => ({
      sourceRowNumber: row.sourceRowNumber,
      pointsAssigned: row.pointsAssigned,
      comment: row.comment,
    })),
    [
      {
        sourceRowNumber: 2,
        pointsAssigned: 3,
        comment: null,
      },
      {
        sourceRowNumber: 3,
        pointsAssigned: -1,
        comment: "Too loud",
      },
    ],
  );
});

test("surfaces missing files and missing headers as issues without throwing", () => {
  const bundlePath = createTempBundle({
    "competitors.csv": "ID,Wrong Name\nplayer-1,Alice\n",
    "rounds.csv": "ID,Created,Name,Description,Playlist URL\nround-1,,Round 1,,\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\n",
  });

  const parsedBundle = parseMusicLeagueBundle({
    bundlePath,
    sourceLabel: "manual-label",
  });

  assert.equal(parsedBundle.sourceLabel, "manual-label");
  assert.equal(parsedBundle.files.competitors.rowCount, 1);
  assert.deepEqual(parsedBundle.files.competitors.rows, []);
  assert.equal(parsedBundle.files.submissions.rowCount, 0);
  assert.equal(parsedBundle.files.votes.rowCount, 0);

  assert.deepEqual(
    parsedBundle.issues.map((issue) => ({
      sourceFileKind: issue.sourceFileKind,
      sourceRowNumber: issue.sourceRowNumber,
      issueCode: issue.issueCode,
      message: issue.message,
    })),
    [
      {
        sourceFileKind: "competitors",
        sourceRowNumber: null,
        issueCode: "missing_header",
        message: "Missing required header: Name",
      },
      {
        sourceFileKind: "votes",
        sourceRowNumber: null,
        issueCode: "missing_file",
        message: "Missing required file: votes.csv",
      },
    ],
  );
});

test("reports invalid scalar rows with row previews and excludes them from typed output", () => {
  const bundlePath = createTempBundle({
    "competitors.csv": "ID,Name\nplayer-1,Alice\n",
    "rounds.csv":
      "ID,Created,Name,Description,Playlist URL\nround-1,not-a-timestamp,Round 1,,\nround-2,2026-04-02T22:39:07Z,Round 2,,\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\nspotify:track:1,Song 1,Artist 1,player-1,2026-04-03T06:56:48Z,,round-2,Maybe\nspotify:track:2,Song 2,Artist 2,player-1,2026-04-03T06:57:48Z,,round-2,\n",
    "votes.csv":
      "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\nspotify:track:1,player-1,2026-04-04T06:18:48Z,nope,,round-2\nspotify:track:2,player-1,2026-04-04T06:19:48Z,5,,round-2\n",
  });

  const parsedBundle = parseMusicLeagueBundle({ bundlePath });

  assert.equal(parsedBundle.gameKey, "round-2");
  assert.equal(parsedBundle.files.rounds.rowCount, 2);
  assert.equal(parsedBundle.files.submissions.rowCount, 2);
  assert.equal(parsedBundle.files.votes.rowCount, 2);

  assert.deepEqual(
    parsedBundle.files.rounds.rows.map((row) => row.sourceRoundId),
    ["round-2"],
  );
  assert.deepEqual(
    parsedBundle.files.submissions.rows.map((row) => row.spotifyUri),
    ["spotify:track:2"],
  );
  assert.deepEqual(
    parsedBundle.files.votes.rows.map((row) => row.spotifyUri),
    ["spotify:track:2"],
  );

  assert.deepEqual(
    parsedBundle.issues.map((issue) => ({
      sourceFileKind: issue.sourceFileKind,
      sourceRowNumber: issue.sourceRowNumber,
      issueCode: issue.issueCode,
      rowPreview: issue.rowPreview,
    })),
    [
      {
        sourceFileKind: "rounds",
        sourceRowNumber: 2,
        issueCode: "invalid_scalar",
        rowPreview: {
          ID: "round-1",
          Created: "not-a-timestamp",
          Name: "Round 1",
          Description: "",
          "Playlist URL": "",
        },
      },
      {
        sourceFileKind: "submissions",
        sourceRowNumber: 2,
        issueCode: "invalid_scalar",
        rowPreview: {
          "Spotify URI": "spotify:track:1",
          Title: "Song 1",
          "Artist(s)": "Artist 1",
          "Submitter ID": "player-1",
          Created: "2026-04-03T06:56:48Z",
          Comment: "",
          "Round ID": "round-2",
          "Visible To Voters": "Maybe",
        },
      },
      {
        sourceFileKind: "votes",
        sourceRowNumber: 2,
        issueCode: "invalid_scalar",
        rowPreview: {
          "Spotify URI": "spotify:track:1",
          "Voter ID": "player-1",
          Created: "2026-04-04T06:18:48Z",
          "Points Assigned": "nope",
          Comment: "",
          "Round ID": "round-2",
        },
      },
    ],
  );
});

test("reports row-level parse errors without throwing for readable bundles", () => {
  const bundlePath = createTempBundle({
    "competitors.csv": 'ID,Name\nplayer-1,"Alice\n',
    "rounds.csv": "ID,Created,Name,Description,Playlist URL\nround-1,,Round 1,,\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\n",
    "votes.csv":
      "Spotify URI,Voter ID,Created,Points Assigned,Comment,Round ID\n",
  });

  const parsedBundle = parseMusicLeagueBundle({ bundlePath });

  assert.equal(parsedBundle.files.competitors.rowCount, 1);
  assert.deepEqual(parsedBundle.files.competitors.rows, []);
  assert.deepEqual(parsedBundle.issues, [
    {
      sourceFileKind: "competitors",
      sourceRowNumber: 2,
      issueCode: "parse_error",
      message: "Unterminated quoted field",
      rowPreview: { rawRow: 'player-1,"Alice\n' },
    },
  ]);
});

test("throws for unreadable bundle paths and unreadable CSV files", () => {
  assert.throws(
    () =>
      parseMusicLeagueBundle({
        bundlePath: path.join(os.tmpdir(), "missing-bundle-path-does-not-exist"),
      }),
    /unreadable bundle path/,
  );

  const unreadableFileBundlePath = createTempBundle({
    "competitors.csv": "ID,Name\nplayer-1,Alice\n",
    "rounds.csv": "ID,Created,Name,Description,Playlist URL\nround-1,,Round 1,,\n",
    "submissions.csv":
      "Spotify URI,Title,Artist(s),Submitter ID,Created,Comment,Round ID,Visible To Voters\n",
    "votes.csv": { type: "directory" },
  });

  assert.throws(
    () => parseMusicLeagueBundle({ bundlePath: unreadableFileBundlePath }),
    /unreadable CSV file: votes\.csv/,
  );
});
