PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ImportBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceType" TEXT NOT NULL,
    "sourceFilename" TEXT,
    "gameKey" TEXT,
    "status" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "createdPlayerCount" INTEGER NOT NULL DEFAULT 0,
    "createdRoundCount" INTEGER NOT NULL DEFAULT 0,
    "createdArtistCount" INTEGER NOT NULL DEFAULT 0,
    "createdSongCount" INTEGER NOT NULL DEFAULT 0,
    "submissionsUpsertedCount" INTEGER NOT NULL DEFAULT 0,
    "votesUpsertedCount" INTEGER NOT NULL DEFAULT 0,
    "committedAt" DATETIME,
    "failureStage" TEXT,
    "failureSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_ImportBatch" (
    "id",
    "sourceType",
    "sourceFilename",
    "status",
    "rowCount",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "sourceType",
    "sourceFilename",
    "status",
    "rowCount",
    "createdAt",
    "updatedAt"
FROM "ImportBatch";

DROP TABLE "ImportBatch";
ALTER TABLE "new_ImportBatch" RENAME TO "ImportBatch";

CREATE TABLE "ImportSourceFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "importBatchId" INTEGER NOT NULL,
    "fileKind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportSourceFile_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ImportPlayerRow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "importBatchId" INTEGER NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "sourcePlayerId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "recordStatus" TEXT NOT NULL,
    "matchedPlayerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportPlayerRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportPlayerRow_matchedPlayerId_fkey" FOREIGN KEY ("matchedPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ImportRoundRow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "importBatchId" INTEGER NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "sourceRoundId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "rawDescription" TEXT,
    "rawPlaylistUrl" TEXT,
    "rawOccurredAt" DATETIME,
    "recordStatus" TEXT NOT NULL,
    "matchedRoundId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportRoundRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportRoundRow_matchedRoundId_fkey" FOREIGN KEY ("matchedRoundId") REFERENCES "Round" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ImportSubmissionRow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "importBatchId" INTEGER NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "sourceRoundId" TEXT NOT NULL,
    "sourceSubmitterId" TEXT NOT NULL,
    "spotifyUri" TEXT NOT NULL,
    "rawTitle" TEXT NOT NULL,
    "rawArtist" TEXT NOT NULL,
    "rawSubmittedAt" DATETIME,
    "rawComment" TEXT,
    "rawVisibleToVoters" BOOLEAN,
    "recordStatus" TEXT NOT NULL,
    "matchedArtistId" INTEGER,
    "matchedSongId" INTEGER,
    "matchedPlayerId" INTEGER,
    "matchedRoundId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportSubmissionRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportSubmissionRow_matchedArtistId_fkey" FOREIGN KEY ("matchedArtistId") REFERENCES "Artist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportSubmissionRow_matchedSongId_fkey" FOREIGN KEY ("matchedSongId") REFERENCES "Song" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportSubmissionRow_matchedPlayerId_fkey" FOREIGN KEY ("matchedPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportSubmissionRow_matchedRoundId_fkey" FOREIGN KEY ("matchedRoundId") REFERENCES "Round" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ImportVoteRow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "importBatchId" INTEGER NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "sourceRoundId" TEXT NOT NULL,
    "sourceVoterId" TEXT NOT NULL,
    "spotifyUri" TEXT NOT NULL,
    "rawPointsAssigned" INTEGER NOT NULL,
    "rawComment" TEXT,
    "rawVotedAt" DATETIME,
    "recordStatus" TEXT NOT NULL,
    "matchedSongId" INTEGER,
    "matchedVoterId" INTEGER,
    "matchedRoundId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportVoteRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportVoteRow_matchedSongId_fkey" FOREIGN KEY ("matchedSongId") REFERENCES "Song" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportVoteRow_matchedVoterId_fkey" FOREIGN KEY ("matchedVoterId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportVoteRow_matchedRoundId_fkey" FOREIGN KEY ("matchedRoundId") REFERENCES "Round" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ImportIssue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "importBatchId" INTEGER NOT NULL,
    "sourceFileKind" TEXT NOT NULL,
    "sourceRowNumber" INTEGER,
    "recordKind" TEXT NOT NULL,
    "issueCode" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT NOT NULL,
    "rowPreviewJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportIssue_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ImportBatch_gameKey_idx" ON "ImportBatch"("gameKey");
CREATE UNIQUE INDEX "ImportSourceFile_importBatchId_fileKind_key" ON "ImportSourceFile"("importBatchId", "fileKind");
CREATE INDEX "ImportSourceFile_importBatchId_idx" ON "ImportSourceFile"("importBatchId");
CREATE UNIQUE INDEX "ImportPlayerRow_importBatchId_sourcePlayerId_key" ON "ImportPlayerRow"("importBatchId", "sourcePlayerId");
CREATE UNIQUE INDEX "ImportPlayerRow_importBatchId_sourceRowNumber_key" ON "ImportPlayerRow"("importBatchId", "sourceRowNumber");
CREATE INDEX "ImportPlayerRow_importBatchId_recordStatus_idx" ON "ImportPlayerRow"("importBatchId", "recordStatus");
CREATE UNIQUE INDEX "ImportRoundRow_importBatchId_sourceRoundId_key" ON "ImportRoundRow"("importBatchId", "sourceRoundId");
CREATE UNIQUE INDEX "ImportRoundRow_importBatchId_sourceRowNumber_key" ON "ImportRoundRow"("importBatchId", "sourceRowNumber");
CREATE INDEX "ImportRoundRow_importBatchId_recordStatus_idx" ON "ImportRoundRow"("importBatchId", "recordStatus");
CREATE UNIQUE INDEX "ImportSubmissionRow_importBatchId_sourceRowNumber_key" ON "ImportSubmissionRow"("importBatchId", "sourceRowNumber");
CREATE INDEX "ImportSubmissionRow_importBatchId_recordStatus_idx" ON "ImportSubmissionRow"("importBatchId", "recordStatus");
CREATE INDEX "ImportSubmissionRow_importBatchId_sourceRoundId_idx" ON "ImportSubmissionRow"("importBatchId", "sourceRoundId");
CREATE INDEX "ImportSubmissionRow_importBatchId_sourceSubmitterId_idx" ON "ImportSubmissionRow"("importBatchId", "sourceSubmitterId");
CREATE INDEX "ImportSubmissionRow_importBatchId_spotifyUri_idx" ON "ImportSubmissionRow"("importBatchId", "spotifyUri");
CREATE UNIQUE INDEX "ImportVoteRow_importBatchId_sourceRowNumber_key" ON "ImportVoteRow"("importBatchId", "sourceRowNumber");
CREATE INDEX "ImportVoteRow_importBatchId_recordStatus_idx" ON "ImportVoteRow"("importBatchId", "recordStatus");
CREATE INDEX "ImportVoteRow_importBatchId_sourceRoundId_idx" ON "ImportVoteRow"("importBatchId", "sourceRoundId");
CREATE INDEX "ImportVoteRow_importBatchId_sourceVoterId_idx" ON "ImportVoteRow"("importBatchId", "sourceVoterId");
CREATE INDEX "ImportVoteRow_importBatchId_spotifyUri_idx" ON "ImportVoteRow"("importBatchId", "spotifyUri");
CREATE INDEX "ImportIssue_importBatchId_sourceFileKind_idx" ON "ImportIssue"("importBatchId", "sourceFileKind");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
