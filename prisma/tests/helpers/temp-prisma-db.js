const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const prismaCommand = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const nodeCommand = process.execPath;
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

function createCommandEnv(databaseUrl) {
  const env = {
    DATABASE_URL: databaseUrl,
  };

  for (const key of inheritedEnvKeys) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }

  return env;
}

function runInRepo(command, args, databaseUrl) {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: createCommandEnv(databaseUrl),
    stdio: "pipe",
  });
}

function createTempPrismaDb({ prefix, filename, seed = false }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const databasePath = path.join(tempDir, filename);
  const databaseUrl = `file:${databasePath}`;

  runInRepo(prismaCommand, ["migrate", "deploy"], databaseUrl);

  function runSeed() {
    runInRepo(nodeCommand, ["prisma/seed.js"], databaseUrl);
  }

  if (seed) {
    runSeed();
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  let cleanedUp = false;

  async function cleanup() {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    await prisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return {
    prisma,
    tempDir,
    databasePath,
    databaseUrl,
    runSeed,
    cleanup,
  };
}

module.exports = {
  createTempPrismaDb,
};
