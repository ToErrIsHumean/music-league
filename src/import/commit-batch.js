const { PrismaClient } = require("@prisma/client");

async function commitImportBatch(batchId, input = {}) {
  const prisma = input.prisma ?? new PrismaClient();
  const ownsPrismaClient = !input.prisma;

  try {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!batch) {
      throw new Error(`commitImportBatch: batch not found: ${batchId}`);
    }

    if (batch.status !== "ready") {
      throw new Error(`commitImportBatch: batch status is not ready: ${batchId}`);
    }

    const openBlockingIssues = await prisma.importIssue.count({
      where: {
        importBatchId: batchId,
        blocking: true,
      },
    });

    if (openBlockingIssues > 0) {
      throw new Error(`commitImportBatch: open blocking issues remain: ${batchId}`);
    }

    throw new Error(`commitImportBatch: not implemented for ready batches: ${batchId}`);
  } finally {
    if (ownsPrismaClient) {
      await prisma.$disconnect();
    }
  }
}

module.exports = {
  commitImportBatch,
};
