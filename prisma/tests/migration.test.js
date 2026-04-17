const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function runPrisma(args, databaseUrl, input) {
  execFileSync(prismaCommand, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    input,
    stdio: "pipe",
  });
}

function executeSqlFile(databaseUrl, filePath) {
  runPrisma(
    ["prisma", "db", "execute", "--url", databaseUrl, "--file", filePath],
    databaseUrl,
  );
}

function executeSql(databaseUrl, sql) {
  runPrisma(
    ["prisma", "db", "execute", "--url", databaseUrl, "--stdin"],
    databaseUrl,
    sql,
  );
}

function createTempDatabase() {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "music-league-prisma-migration-"),
  );
  const databasePath = path.join(tempDir, "migration.sqlite");
  const databaseUrl = `file:${databasePath}`;

  return { tempDir, databaseUrl };
}

function isConstraintViolation(error) {
  return error && (error.code === "P2003" || error.code === "P2004");
}

test(
  "migration backfills explicit games and preserves the round mirror constraint",
  { concurrency: false },
  async () => {
    const { tempDir, databaseUrl } = createTempDatabase();
    const initialMigration = path.join(
      repoRoot,
      "prisma",
      "migrations",
      "20260416015910_init",
      "migration.sql",
    );
    const importBatchMigration = path.join(
      repoRoot,
      "prisma",
      "migrations",
      "20260417090000_import_batch_staging",
      "migration.sql",
    );
    const explicitGameMigration = path.join(
      repoRoot,
      "prisma",
      "migrations",
      "20260417113000_explicit_game_identity",
      "migration.sql",
    );

    try {
      executeSqlFile(databaseUrl, initialMigration);
      executeSqlFile(databaseUrl, importBatchMigration);
      executeSql(
        databaseUrl,
        `
          INSERT INTO "Round" (
            "leagueSlug",
            "name",
            "sequenceNumber",
            "sourceRoundId",
            "createdAt",
            "updatedAt"
          )
          VALUES
            ('legacy-main', 'Opening', 1, 'shared-round', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z'),
            ('legacy-main', 'Encore', 2, 'main-round-2', '2026-04-02T00:00:00.000Z', '2026-04-02T00:00:00.000Z'),
            ('legacy-side', 'Opening', 1, 'shared-round', '2026-04-03T00:00:00.000Z', '2026-04-03T00:00:00.000Z');
        `,
      );
      executeSqlFile(databaseUrl, explicitGameMigration);

      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      });

      try {
        const games = await prisma.game.findMany({
          orderBy: {
            sourceGameId: "asc",
          },
          include: {
            rounds: {
              orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
            },
          },
        });

        assert.deepEqual(
          games.map((game) => ({
            sourceGameId: game.sourceGameId,
            displayName: game.displayName,
            rounds: game.rounds.map((round) => ({
              sourceRoundId: round.sourceRoundId,
              leagueSlug: round.leagueSlug,
              gameId: round.gameId,
            })),
          })),
          [
            {
              sourceGameId: "legacy-main",
              displayName: null,
              rounds: [
                {
                  sourceRoundId: "shared-round",
                  leagueSlug: "legacy-main",
                  gameId: games[0].id,
                },
                {
                  sourceRoundId: "main-round-2",
                  leagueSlug: "legacy-main",
                  gameId: games[0].id,
                },
              ],
            },
            {
              sourceGameId: "legacy-side",
              displayName: null,
              rounds: [
                {
                  sourceRoundId: "shared-round",
                  leagueSlug: "legacy-side",
                  gameId: games[1].id,
                },
              ],
            },
          ],
        );

        const renamedGame = await prisma.game.update({
          where: {
            id: games[0].id,
          },
          data: {
            sourceGameId: "legacy-main-renamed",
          },
        });
        const renamedRounds = await prisma.round.findMany({
          where: {
            gameId: renamedGame.id,
          },
        });

        assert.ok(
          renamedRounds.every(
            (round) => round.leagueSlug === "legacy-main-renamed",
          ),
          "expected game sourceGameId updates to preserve the temporary round mirror",
        );

        await assert.rejects(
          prisma.round.create({
            data: {
              gameId: renamedGame.id,
              leagueSlug: "wrong-game-id",
              name: "Broken mirror",
              sourceRoundId: "broken-round",
            },
          }),
          isConstraintViolation,
        );

        await prisma.$disconnect();
      } catch (error) {
        await prisma.$disconnect();
        throw error;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  },
);
