-- AlterTable
ALTER TABLE "Game" ADD COLUMN "description" TEXT;
ALTER TABLE "Game" ADD COLUMN "leagueMaster" TEXT;
ALTER TABLE "Game" ADD COLUMN "speed" TEXT CHECK ("speed" IS NULL OR "speed" IN ('Steady', 'Accelerated', 'Speedy'));
