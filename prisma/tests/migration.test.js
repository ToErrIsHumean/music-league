const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const prismaCommand = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const inheritedEnvKeys = [
  "PATH",
  "Path",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "SystemRoot",
  "ComSpec",
  "TMPDIR",
  "TEMP",
  "TMP",
];
const gameMetadataMigration = path.join(
  repoRoot,
  "prisma",
  "migrations",
  "20260425160000_add_game_metadata_fields",
  "migration.sql",
);
const gameFinishedMigration = path.join(
  repoRoot,
  "prisma",
  "migrations",
  "20260426090000_add_game_finished_field",
  "migration.sql",
);

function createPrismaEnv(databaseUrl) {
  const env = { DATABASE_URL: databaseUrl };

  for (const key of inheritedEnvKeys) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }

  return env;
}

function runPrisma(args, databaseUrl, input) {
  execFileSync(prismaCommand, args, {
    cwd: repoRoot,
    env: createPrismaEnv(databaseUrl),
    input,
    stdio: "pipe",
  });
}

function executeSqlFile(databaseUrl, filePath) {
  runPrisma(
    ["db", "execute", "--url", databaseUrl, "--file", filePath],
    databaseUrl,
  );
}

function executeSql(databaseUrl, sql) {
  runPrisma(
    ["db", "execute", "--url", databaseUrl, "--stdin"],
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
      executeSqlFile(databaseUrl, gameMetadataMigration);
      executeSqlFile(databaseUrl, gameFinishedMigration);

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

test(
  "game metadata migrations add metadata without game date or player relationship",
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
          VALUES (
            'legacy-main',
            'Opening',
            1,
            'opening-round',
            '2026-04-01T00:00:00.000Z',
            '2026-04-01T00:00:00.000Z'
          );
        `,
      );
      executeSqlFile(databaseUrl, explicitGameMigration);
      executeSqlFile(databaseUrl, gameMetadataMigration);
      executeSqlFile(databaseUrl, gameFinishedMigration);

      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      });

      try {
        const columns = await prisma.$queryRaw`PRAGMA table_info("Game")`;
        const columnByName = new Map(
          columns.map((column) => [column.name, column]),
        );

        assert.equal(columnByName.get("description")?.type, "TEXT");
        assert.equal(columnByName.get("finished")?.type, "BOOLEAN");
        assert.equal(columnByName.get("speed")?.type, "TEXT");
        assert.equal(columnByName.get("leagueMaster")?.type, "TEXT");
        assert.equal(columnByName.get("description")?.notnull, 0n);
        assert.equal(columnByName.get("finished")?.notnull, 1n);
        assert.equal(columnByName.get("finished")?.dflt_value, "true");
        assert.equal(columnByName.get("speed")?.notnull, 0n);
        assert.equal(columnByName.get("leagueMaster")?.notnull, 0n);
        assert.equal(columnByName.has("date"), false);
        assert.equal(columnByName.has("occurredAt"), false);

        const foreignKeys = await prisma.$queryRaw`PRAGMA foreign_key_list("Game")`;

        assert.deepEqual(foreignKeys, []);

        const migratedGame = await prisma.game.findUniqueOrThrow({
          where: {
            sourceGameId: "legacy-main",
          },
        });

        assert.equal(migratedGame.description, null);
        assert.equal(migratedGame.finished, true);
        assert.equal(migratedGame.speed, null);
        assert.equal(migratedGame.leagueMaster, null);

        executeSql(
          databaseUrl,
          `
            INSERT INTO "Game" (
              "sourceGameId",
              "speed",
              "createdAt",
              "updatedAt"
            )
            VALUES (
              'valid-speed',
              'Speedy',
              '2026-04-02T00:00:00.000Z',
              '2026-04-02T00:00:00.000Z'
            );
          `,
        );

        assert.throws(
          () =>
            executeSql(
              databaseUrl,
              `
                INSERT INTO "Game" (
                  "sourceGameId",
                  "speed",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  'invalid-speed',
                  'Glacial',
                  '2026-04-03T00:00:00.000Z',
                  '2026-04-03T00:00:00.000Z'
                );
              `,
            ),
          /CHECK constraint failed|constraint failed/i,
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
