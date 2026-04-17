-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceGameId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "Game" ("sourceGameId", "displayName", "createdAt", "updatedAt")
SELECT
    "leagueSlug",
    NULL,
    MIN("createdAt"),
    MAX("updatedAt")
FROM "Round"
GROUP BY "leagueSlug";

CREATE TABLE "new_Round" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "leagueSlug" TEXT NOT NULL DEFAULT 'main',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "playlistUrl" TEXT,
    "sequenceNumber" INTEGER,
    "occurredAt" DATETIME,
    "sourceRoundId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Round" (
    "id",
    "gameId",
    "leagueSlug",
    "name",
    "description",
    "playlistUrl",
    "sequenceNumber",
    "occurredAt",
    "sourceRoundId",
    "createdAt",
    "updatedAt"
)
SELECT
    "Round"."id",
    "Game"."id",
    "Round"."leagueSlug",
    "Round"."name",
    "Round"."description",
    "Round"."playlistUrl",
    "Round"."sequenceNumber",
    "Round"."occurredAt",
    "Round"."sourceRoundId",
    "Round"."createdAt",
    "Round"."updatedAt"
FROM "Round"
INNER JOIN "Game" ON "Game"."sourceGameId" = "Round"."leagueSlug";

DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";

CREATE UNIQUE INDEX "Game_sourceGameId_key" ON "Game"("sourceGameId");
CREATE INDEX "Game_sourceGameId_idx" ON "Game"("sourceGameId");
CREATE UNIQUE INDEX "Round_gameId_sourceRoundId_key" ON "Round"("gameId", "sourceRoundId");
CREATE UNIQUE INDEX "Round_leagueSlug_sourceRoundId_key" ON "Round"("leagueSlug", "sourceRoundId");
CREATE INDEX "Round_gameId_sequenceNumber_idx" ON "Round"("gameId", "sequenceNumber");
CREATE INDEX "Round_gameId_occurredAt_idx" ON "Round"("gameId", "occurredAt");
CREATE INDEX "Round_leagueSlug_sequenceNumber_idx" ON "Round"("leagueSlug", "sequenceNumber");

CREATE TRIGGER "Round_leagueSlug_matches_game_insert"
BEFORE INSERT ON "Round"
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Round.leagueSlug must match Game.sourceGameId')
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Game"
        WHERE "Game"."id" = NEW."gameId"
          AND "Game"."sourceGameId" = NEW."leagueSlug"
    );
END;

CREATE TRIGGER "Round_leagueSlug_matches_game_update"
BEFORE UPDATE OF "gameId", "leagueSlug" ON "Round"
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Round.leagueSlug must match Game.sourceGameId')
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Game"
        WHERE "Game"."id" = NEW."gameId"
          AND "Game"."sourceGameId" = NEW."leagueSlug"
    );
END;

CREATE TRIGGER "Game_sourceGameId_round_mirror_update"
AFTER UPDATE OF "sourceGameId" ON "Game"
FOR EACH ROW
BEGIN
    UPDATE "Round"
    SET "leagueSlug" = NEW."sourceGameId"
    WHERE "gameId" = NEW."id";
END;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
